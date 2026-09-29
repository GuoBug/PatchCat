/**
 * @file    scripts/run-siliconflow-ab-test.ts
 * @description
 *   SiliconFlow Qwen2.5-7B A/B Benchmark Evaluation Harness (v3 — Correctness-Aware).
 *
 *   What changed vs v2 (audit-driven):
 *   - [P0-1] Ground-truth correctness is now measured (category / orderId accuracy),
 *           kept strictly separate from schema-compliance rate. 100% compliant != 100% correct.
 *   - [P0-2] Every L2 violation is classified by rule, and split into CROSS-FIELD invariants
 *           vs SINGLE-FIELD constraints, so the report can never claim "we caught cross-field
 *           conflicts" when in fact only length rules fired.
 *   - [P0-3] Two genuinely cross-field invariants added (summary x orderId, urgency x category)
 *           plus 4 adversarial cases, because the flagship invariant (refund => urgency>=4)
 *           was violated 0/60 times by this model.
 *   - [P1]   Network/timeout failures bucketed separately (no longer miscounted as L1 syntax
 *           failures); `wasInterceptedByL2` now requires syntaxValid; 0/0 prints n/a;
 *           token usage + self-healing overhead tracked; Wilson 95% CI + McNemar exact test.
 *
 *   Rigorous Evaluation Design (retained from v2):
 *   1. Variable Isolation: Group A and Group B share 100% IDENTICAL System Prompts.
 *   2. Measured (Not Asserted) L1 Syntax: derived from actual Zod safeParse & healing trace.
 *   3. Statistical Robustness: 3 repetitions x N cases.
 *   4. Full Trace Persistence: eval-results/<timestamp>.json.
 *   5. Post-Mortem Autopsy for every degraded case.
 *   6. Strict Billing Guard: only free 'Qwen/Qwen2.5-7B-Instruct', never 'Pro/'.
 *
 *   Usage:
 *     $env:SILICONFLOW_API_KEY="sk-your-siliconflow-key"
 *     npm run test:ab                # full 3-round run
 *     npm run test:ab -- --single    # quick 1-round smoke run
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import {
  executeWithSelfHealing,
  safeParseOutput,
} from '../src/engine/structured-output.ts';
import {
  TicketSemanticSchema,
  TicketSemanticSchemaE0b,
  TicketSemanticSchemaE2,
} from '../src/presets/self-healing-scenarios.ts';
import type { ChatMessage, LLMChatRequest, LLMExecutionOutput } from '../src/engine/llm-client.ts';
import type { SelfHealingTraceStep } from '../src/engine/types.ts';

// ─────────────────────────────────────────────────────────────────────────────
// 0. Strict Model Name & Billing Guard
// ─────────────────────────────────────────────────────────────────────────────
export const TARGET_FREE_MODEL = 'Qwen/Qwen2.5-7B-Instruct';
const REQUEST_TIMEOUT_MS = 20000;

if (TARGET_FREE_MODEL.startsWith('Pro/') || TARGET_FREE_MODEL.includes('/Pro/')) {
  console.error('FATAL BILLING ERROR: Paid "Pro/" model prefix detected!');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. API Key Resolution
// ─────────────────────────────────────────────────────────────────────────────
function loadSiliconFlowApiKey(): string {
  if (process.env.SILICONFLOW_API_KEY) return process.env.SILICONFLOW_API_KEY.trim();

  for (const envPath of ['.env', '.env.local']) {
    const fullPath = resolve(process.cwd(), envPath);
    if (!existsSync(fullPath)) continue;
    try {
      const match = readFileSync(fullPath, 'utf-8').match(/SILICONFLOW_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/i);
      if (match?.[1]) return match[1].trim();
    } catch {
      /* ignore */
    }
  }
  return '';
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Real SiliconFlow Caller
// ─────────────────────────────────────────────────────────────────────────────
async function callSiliconFlowApi(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  responseFormatMode: 'none' | 'json_object',
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<LLMExecutionOutput> {
  if (model.startsWith('Pro/')) throw new Error(`[Billing Guard] Refusing to call paid model: ${model}`);

  const start = Date.now();
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.2,
    max_tokens: 512,
  };
  if (responseFormatMode === 'json_object') body.response_format = { type: 'json_object' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`SiliconFlow API call failed (${res.status}): ${await res.text()}`);

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const choice = json.choices?.[0];

    return {
      response: choice?.message?.content || '',
      usage: {
        prompt: json.usage?.prompt_tokens || 0,
        completion: json.usage?.completion_tokens || 0,
        total: json.usage?.total_tokens || 0,
      },
      finishReason: choice?.finish_reason || 'stop',
      durationMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. UNIFIED SYSTEM PROMPT — identical for both groups (variable isolation)
// ─────────────────────────────────────────────────────────────────────────────
const UNIFIED_SYSTEM_PROMPT = `你是一个工单结构化解析助手。请直接以 JSON 格式输出工单，必须包含以下字段：
- urgency: 1-5 整数，代表紧急度
- category: 工单分类，仅允许 'logistics' | 'refund' | 'quality' | 'other'
- summary: 问题摘要，严格限制在 5-30 字内
- orderId: 订单号，必须提取自输入并严格符合 ORD-xxxxxx 格式（形如 ORD-123456）

业务硬性约束：
1. 退款类工单 (category === 'refund') 涉及资金流转，urgency 必须 >= 4；
2. 高优先级工单 (urgency >= 4) 的 summary 至少需要 15 字阐述详情理由；
3. 订单号只允许出现在 orderId 字段，summary 中不得复述任何订单号；
4. 物流类工单 (category === 'logistics') 不涉及资金流转，urgency 必须 <= 3。`;

// ─────────────────────────────────────────────────────────────────────────────
// 4. Benchmark Suite — 10 original cases + 4 adversarial cases
//    `expectedCategory` / `expectedOrderId` are GROUND TRUTH used only for the
//    correctness metric; they are never fed to the contract validator.
// ─────────────────────────────────────────────────────────────────────────────
import {
  type CaseDef,
  type WatchTarget,
  BENCHMARK_CASES,
  WATCH_LIST,
  assertSentinelIntegrity,
} from '../src/presets/benchmark-dataset.ts';

// ANSI helpers. Red = drift detected on a guarded case; yellow = the targeted fix
// did not land. Kept as raw escapes so the artifact JSON stays clean.
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

// ─────────────────────────────────────────────────────────────────────────────
// 5. Rule Classification — prevents "cross-field" from being claimed loosely
// ─────────────────────────────────────────────────────────────────────────────
type RuleClass =
  | 'CROSSFIELD_refund_urgency_floor'
  | 'CROSSFIELD_summary_min_len_when_urgent'
  | 'CROSSFIELD_summary_contains_order_no'
  | 'CROSSFIELD_logistics_urgency_cap'
  | 'SINGLEFIELD_summary_max_len'
  | 'SINGLEFIELD_summary_min_len'
  | 'SINGLEFIELD_field_type_or_enum'
  | 'STRUCTURE_root_shape'
  | 'OTHER';

const RULE_LABEL: Record<RuleClass, string> = {
  CROSSFIELD_refund_urgency_floor: 'refund ⇒ urgency ≥ 4 (urgency × category)',
  CROSSFIELD_summary_min_len_when_urgent: 'urgency ≥ 4 ⇒ summary ≥ 15 字 (summary × urgency)',
  CROSSFIELD_summary_contains_order_no: 'summary 不得含订单号 (summary × orderId)',
  CROSSFIELD_logistics_urgency_cap: 'logistics ⇒ urgency ≤ 3 (urgency × category)',
  SINGLEFIELD_summary_max_len: 'summary ≤ 30 字 (单字段)',
  SINGLEFIELD_summary_min_len: 'summary ≥ 5 字 (单字段)',
  SINGLEFIELD_field_type_or_enum: '字段类型 / enum / 正则 (单字段)',
  STRUCTURE_root_shape: '根级结构错误（输出了数组/非对象）',
  OTHER: '其他',
};

function classifyError(message: string): RuleClass {
  if (message.includes('Expected object') || message.includes('received array')) return 'STRUCTURE_root_shape';
  if (message.includes('退款类工单')) return 'CROSSFIELD_refund_urgency_floor';
  if (message.includes('物流类工单')) return 'CROSSFIELD_logistics_urgency_cap';
  if (message.includes('不得复述任何订单号')) return 'CROSSFIELD_summary_contains_order_no';
  if (message.includes('至少需要 15 字')) return 'CROSSFIELD_summary_min_len_when_urgent';
  if (message.includes('at most 30') || message.includes('最多 30')) return 'SINGLEFIELD_summary_max_len';
  if (message.includes('at least 5') || message.includes('至少 5')) return 'SINGLEFIELD_summary_min_len';
  return 'SINGLEFIELD_field_type_or_enum';
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Statistics helpers
// ─────────────────────────────────────────────────────────────────────────────
function pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : ((n / d) * 100).toFixed(1) + '%';
}

/** Wilson score interval (95%) — honest interval for small n, unlike normal approximation. */
function wilson95(k: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.96;
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

function binom(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
}

/** Two-sided exact McNemar test on discordant pairs (b = A-fail/B-pass, c = A-pass/B-fail). */
function mcnemarExact(b: number, c: number): number {
  const n = b + c;
  if (n === 0) return 1;
  const lo = Math.min(b, c);
  let sum = 0;
  for (let i = 0; i <= lo; i++) sum += binom(n, i);
  return Math.min(1, (2 * sum) / Math.pow(2, n));
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Records
// ─────────────────────────────────────────────────────────────────────────────
interface TrialRecord {
  repetitionIndex: number;
  caseId: number;
  caseTitle: string;
  difficulty: 'easy' | 'hard';
  groupA: {
    rawOutput: string;
    durationMs: number;
    networkFailure: boolean;
    l1SyntaxOk: boolean;
    l2SemanticOk: boolean;
    endToEndSuccess: boolean;
    ruleClasses: RuleClass[];
    categoryCorrect?: boolean;
    finalCategory?: string;
    orderIdCorrect?: boolean;
    tokens: number;
  };
  groupB: {
    durationMs: number;
    l1SyntaxOk: boolean;
    endToEndSuccess: boolean;
    totalAttempts: number;
    wasInterceptedByL2: boolean;
    wasHealed: boolean;
    reachedR2Escalation: boolean;
    fallbackReason?: string;
    round1RuleClasses: RuleClass[];
    finalRuleClasses: RuleClass[];
    categoryCorrect?: boolean;
    finalCategory?: string;
    orderIdCorrect?: boolean;
    tokens: number;
    trace: SelfHealingTraceStep[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const isSingleRun = process.argv.includes('--single');
  const isE0NoL1 = process.argv.includes('--e0-no-l1');
  const isE0bEnumOrder = process.argv.includes('--e0b-enum-order');
  const isE2Disambiguate = process.argv.includes('--e2-disambiguate');
  const caseArg = process.argv.find((arg) => arg.startsWith('--case='));
  const repsArg = process.argv.find((arg) => arg.startsWith('--reps='));
  const saveBaselineArg = process.argv.find((arg) => arg.startsWith('--save-baseline'));
  const compareBaselineArg = process.argv.find((arg) => arg.startsWith('--compare-baseline'));
  const saveBaselinePath = saveBaselineArg?.includes('=')
    ? resolve(process.cwd(), saveBaselineArg.split('=')[1] ?? '')
    : saveBaselineArg
      ? resolve(process.cwd(), 'eval-results/baseline.json')
      : undefined;
  const compareBaselinePath = compareBaselineArg?.includes('=')
    ? resolve(process.cwd(), compareBaselineArg.split('=')[1] ?? '')
    : compareBaselineArg
      ? resolve(process.cwd(), 'eval-results/baseline.json')
      : undefined;

  if (saveBaselinePath && compareBaselinePath) {
    console.error('[FATAL] --save-baseline and --compare-baseline cannot be used in the same run.');
    process.exit(1);
  }

  // Pre-flight check: if compare-baseline is requested, make sure baseline file exists before making costly API calls!
  if (compareBaselinePath && !existsSync(compareBaselinePath)) {
    console.error(`\n${RED}${BOLD}❌ [回归门禁预检失败] 未找到基线快照文件: ${compareBaselinePath}${RESET}`);
    console.error(`提示: 请先运行 npm run eval:baseline 固化黄金基线后再执行回归门禁！\n`);
    process.exit(1);
  }

  // Pre-flight check: assert sentinel integrity across cases to avoid silent drift
  assertSentinelIntegrity(BENCHMARK_CASES, WATCH_LIST);

  const targetCaseId = caseArg ? parseInt(caseArg.split('=')[1] ?? '', 10) : undefined;
  const benchmarkCases = targetCaseId
    ? BENCHMARK_CASES.filter((c) => c.id === targetCaseId)
    : BENCHMARK_CASES;

  // Experiment variants are mutually exclusive — mixing them would break single-variable attribution.
  const activeVariants = [isE0NoL1, isE0bEnumOrder, isE2Disambiguate].filter(Boolean).length;
  if (activeVariants > 1) {
    console.error('[FATAL] --e0-no-l1 / --e0b-enum-order / --e2-disambiguate are mutually exclusive.');
    process.exit(1);
  }

  // Contract used by Group B. Variants reuse the SAME cross-field invariants (see presets).
  const activeSchema = isE0bEnumOrder
    ? TicketSemanticSchemaE0b
    : isE2Disambiguate
      ? TicketSemanticSchemaE2
      : TicketSemanticSchema;
  const experimentTag = isE0NoL1
    ? 'E0_no_l1'
    : isE0bEnumOrder
      ? 'E0b_enum_order'
      : isE2Disambiguate
        ? 'E2_disambiguate'
        : 'baseline';

  const REPETITIONS = repsArg
    ? Math.max(1, parseInt(repsArg.split('=')[1] ?? '', 10) || 3)
    : isSingleRun
      ? 1
      : 3;
  const totalSamples = REPETITIONS * benchmarkCases.length;

  console.log('='.repeat(80));
  console.log('PatchCat A/B Benchmark v3 — Compliance + Correctness');
  console.log(`Model: ${TARGET_FREE_MODEL}  (free tier only; "Pro/" hard-blocked)`);
  console.log(`Protocol: ${REPETITIONS} rounds x ${benchmarkCases.length} cases = ${totalSamples} samples/group`);
  if (experimentTag !== 'baseline') {
    console.log(`[Experiment ${experimentTag}] B group contract variant active`);
  }
  if (isE0NoL1) {
    console.log('  └─ L1 API-level response_format disabled (mode = none)');
  }
  if (isE0bEnumOrder) {
    console.log('  └─ enum order permuted: refund first (tests position-bias hypothesis)');
  }
  if (isE2Disambiguate) {
    console.log('  └─ category description gains disambiguation rule (enum order UNCHANGED)');
  }
  if (targetCaseId) {
    console.log(`[Filter] Targeting single Case #${targetCaseId} only`);
  }
  console.log('='.repeat(80));

  const apiKey = loadSiliconFlowApiKey();
  const isLive = Boolean(apiKey);
  if (isLive) {
    console.log('[Mode] LIVE API MODE');
  } else {
    console.log('[Mode] SIMULATION (no API key) — ALL NUMERS BELOW ARE SYNTHETIC, DO NOT REPORT');
  }
  console.log('-'.repeat(80) + '\n');

  const allRecords: TrialRecord[] = [];

  // Group A counters
  let a_total = 0;
  let a_network = 0;
  let a_l1_ok = 0;
  let a_l2_violation = 0;
  let a_e2e = 0;
  let a_cat_ok = 0;
  let a_cat_n = 0;
  let a_ord_ok = 0;
  let a_ord_n = 0;
  let a_tokens = 0;
  let a_duration_total = 0;

  // Group B counters
  let b_total = 0;
  let b_network_errors = 0;
  let b_rounds = 0;
  let b_rounds_l1_ok = 0;
  let b_cases_l1_ok = 0;
  let b_l2_intercept = 0;
  let b_healed = 0;
  let b_e2e = 0;
  let b_r2_reached = 0;
  let b_cat_ok = 0;
  let b_cat_n = 0;
  let b_ord_ok = 0;
  let b_ord_n = 0;
  let b_tokens = 0;
  let b_duration_total = 0;

  const ruleHits: Record<string, { a: number; b: number }> = {};
  const bumpRule = (cls: RuleClass, group: 'a' | 'b') => {
    ruleHits[cls] ||= { a: 0, b: 0 };
    ruleHits[cls][group] += 1;
  };

  for (let rep = 1; rep <= REPETITIONS; rep++) {
    console.log(`\n=============== ROUND [${rep}/${REPETITIONS}] ===============`);

    for (const item of benchmarkCases) {
      console.log(`[R${rep} #${item.id}] ${item.title} (${item.difficulty})`);

      const messages: ChatMessage[] = [
        { role: 'system', content: UNIFIED_SYSTEM_PROMPT },
        { role: 'user', content: item.prompt },
      ];

      // ── Group A: single-shot, no state machine ────────────────────────────
      a_total++;
      let groupARaw = '';
      let aTok = 0;
      const startA = Date.now();
      if (isLive) {
        try {
          const out = await callSiliconFlowApi(apiKey, TARGET_FREE_MODEL, messages, 'none');
          groupARaw = out.response;
          aTok = out.usage?.total || 0;
        } catch (err) {
          console.error('  ├─ A: network/API error:', err instanceof Error ? err.message : err);
        }
      } else {
        // Synthetic fallback — clearly not reportable.
        groupARaw = JSON.stringify({
          urgency: item.expectedCategory === 'refund' ? 4 : 3,
          category: item.expectedCategory,
          summary: `已合规登记${item.title}工单详情，请尽快协调跟进处理`,
          orderId: item.expectedOrderId,
        });
      }
      const durationA = Date.now() - startA;

      // Timeout / empty-response must NOT be counted as a decoding failure.
      const aNetworkFailure = !groupARaw.trim() || durationA >= REQUEST_TIMEOUT_MS - 100;
      // Group A is the untouched control: always validated against the BASELINE contract,
      // even when B runs an experiment variant.
      const parseA = safeParseOutput(groupARaw, TicketSemanticSchema);
      const aL1 = !aNetworkFailure && !parseA.syntaxError;
      const aL2 = parseA.success;
      const aE2E = aL1 && aL2;

      if (aNetworkFailure) a_network++;
      if (aL1) a_l1_ok++;
      if (aL1 && !aL2) a_l2_violation++;
      if (aE2E) a_e2e++;
      a_tokens += aTok;
      a_duration_total += durationA;

      const aRuleClasses = (parseA.errors || []).map((e) => classifyError(e.message));
      aRuleClasses.forEach((c) => bumpRule(c, 'a'));

      const aObj = extractJsonObject(groupARaw);
      const aCatOk = aObj ? aObj['category'] === item.expectedCategory : undefined;
      const aOrdOk = aObj ? String(aObj['orderId']).toUpperCase() === item.expectedOrderId : undefined;
      if (aCatOk !== undefined) {
        a_cat_n++;
        if (aCatOk) a_cat_ok++;
      }
      if (aOrdOk !== undefined) {
        a_ord_n++;
        if (aOrdOk) a_ord_ok++;
      }

      if (aNetworkFailure) {
        console.log(`  ├─ A: [网络/超时] ${durationA}ms — 已从 L1 语法口径中剔除`);
      } else if (aE2E) {
        console.log(`  ├─ A: 合规 (${durationA}ms)`);
      } else if (!aL1) {
        console.log(`  ├─ A: L1 语法损坏 (${durationA}ms)`);
      } else {
        const wrong = aCatOk === false ? ' [分类错误]' : '';
        console.log(`  ├─ A: L2 违规 — ${parseA.errors?.[0]?.message}${wrong} (${durationA}ms)`);
      }

      // ── Group B: L1 json_object + L2 refine + self-healing state machine ──
      b_total++;
      const startB = Date.now();
      let bCallCount = 0;
      const callerB = async (overrides: Partial<LLMChatRequest>): Promise<LLMExecutionOutput> => {
        bCallCount++;
        if (isLive) {
          try {
            const apiMode = isE0NoL1
              ? 'none'
              : (overrides.response_format?.type === 'json_object' ? 'json_object' : 'none');
            return await callSiliconFlowApi(apiKey, TARGET_FREE_MODEL, overrides.messages || messages, apiMode);
          } catch (err) {
            // A transient timeout must not destroy a multi-minute run. Surface it as an
            // empty response so the state machine's empty-output triage can retry.
            b_network_errors++;
            console.error(`  └─ B: network/API error on call ${bCallCount}:`, err instanceof Error ? err.message : err);
            return {
              response: '',
              usage: { prompt: 0, completion: 0, total: 0 },
              finishReason: 'error',
              durationMs: 0,
            };
          }
        }
        return {
          response: JSON.stringify({
            urgency: item.expectedCategory === 'refund' ? 4 : 3,
            category: item.expectedCategory,
            summary: `已合规登记${item.title}工单详情，请尽快协调跟进处理`,
            orderId: item.expectedOrderId,
          }),
          usage: { prompt: 80, completion: 25, total: 105 },
          finishReason: 'stop',
          durationMs: 90,
        };
      };

      const healingB = await executeWithSelfHealing(callerB, messages, {
        maxRetries: 2,
        schema: activeSchema,
        provider: 'siliconflow',
        model: TARGET_FREE_MODEL,
      });
      const durationB = Date.now() - startB;

      const trace = healingB.trace ?? [];
      // Exclude network/timeout glitches from L1 syntax metric denominator, matching Group A's isolation
      const validRounds = trace.filter((t) => t.finishReason !== 'error' && t.rawOutput.trim().length > 0);
      b_rounds += validRounds.length;
      b_rounds_l1_ok += validRounds.filter((t) => t.syntaxValid).length;
      const bCaseL1Ok = validRounds.length > 0 && validRounds.every((t) => t.syntaxValid);
      if (bCaseL1Ok) b_cases_l1_ok++;

      // FIX: an L2 interception requires the syntax layer to have passed first.
      const firstRound = trace[0];
      const wasInterceptedByL2 = firstRound ? firstRound.syntaxValid && !firstRound.semanticValid : false;
      if (wasInterceptedByL2) b_l2_intercept++;
      const wasHealed = wasInterceptedByL2 && healingB.success;
      if (wasHealed) b_healed++;

      // Round 1 rule classes = what the contract actually caught.
      const round1Classes = (trace[0]?.errors || []).map((e) => classifyError(e.message));
      round1Classes.forEach((c) => bumpRule(c, 'b'));

      // Canonical signal: the state machine only emits this level on escalated retries.
      const reachedR2 = trace.some((t) => t.escalationLevel === 'golden_exemplar');
      if (reachedR2) b_r2_reached++;

      if (healingB.success) b_e2e++;
      b_tokens += healingB.usage?.total || 0;
      b_duration_total += durationB;

      const finalRaw = trace[trace.length - 1]?.rawOutput || healingB.raw || '';
      const bObj = extractJsonObject(finalRaw);
      const bCatOk = bObj ? bObj['category'] === item.expectedCategory : undefined;
      const bOrdOk = bObj ? String(bObj['orderId']).toUpperCase() === item.expectedOrderId : undefined;
      if (bCatOk !== undefined) {
        b_cat_n++;
        if (bCatOk) b_cat_ok++;
      }
      if (bOrdOk !== undefined) {
        b_ord_n++;
        if (bOrdOk) b_ord_ok++;
      }

      if (healingB.success) {
        const wrong = bCatOk === false ? ' [分类错误]' : '';
        console.log(`  └─ B: ${healingB.totalAttempts > 1 ? `第 ${healingB.totalAttempts} 轮自愈成功` : '首轮通过'}${wrong} (${durationB}ms)`);
      } else {
        console.log(`  └─ B: 耗尽 ${healingB.totalAttempts} 次预算，降级 (${durationB}ms)`);
      }

      allRecords.push({
        repetitionIndex: rep,
        caseId: item.id,
        caseTitle: item.title,
        difficulty: item.difficulty,
        groupA: {
          rawOutput: groupARaw,
          durationMs: durationA,
          networkFailure: aNetworkFailure,
          l1SyntaxOk: aL1,
          l2SemanticOk: aL2,
          endToEndSuccess: aE2E,
          ruleClasses: aRuleClasses,
          categoryCorrect: aCatOk,
          finalCategory: aObj ? String(aObj['category']) : undefined,
          orderIdCorrect: aOrdOk,
          tokens: aTok,
        },
        groupB: {
          durationMs: durationB,
          l1SyntaxOk: bCaseL1Ok,
          endToEndSuccess: healingB.success,
          totalAttempts: healingB.totalAttempts,
          wasInterceptedByL2,
          wasHealed,
          reachedR2Escalation: reachedR2,
          fallbackReason: healingB.fallbackReason,
          round1RuleClasses: round1Classes,
          finalRuleClasses: (healingB.errors || []).map((e) => classifyError(e.message)),
          categoryCorrect: bCatOk,
          finalCategory: bObj ? String(bObj['category']) : undefined,
          orderIdCorrect: bOrdOk,
          tokens: healingB.usage?.total || 0,
          trace,
        },
      });
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Report
  // ───────────────────────────────────────────────────────────────────────────
  const aL1Denom = a_total - a_network;
  const [aLo, aHi] = wilson95(a_e2e, a_total);
  const [bLo, bHi] = wilson95(b_e2e, b_total);

  console.log('\n' + '='.repeat(80));
  console.log(`REPORT  (${a_total} samples/group, model ${TARGET_FREE_MODEL}, mode=${isLive ? 'LIVE' : 'SIMULATION'})`);
  console.log('='.repeat(80));

  console.log('\n[表 1] 合规（schema 层面：L1 语法 / L2 契约 / 端到端交付）');
  console.log('| 组别 | 样本 | L1 语法合规率 | L2 契约拦截率 | 拦截后自愈转化 | 端到端合规交付率 [95% CI] |');
  console.log('| :--- | :--- | :--- | :--- | :--- | :--- |');
  console.log(`| A 自然解码单轮 | ${a_total} | ${pct(a_l1_ok, aL1Denom)} (${a_l1_ok}/${aL1Denom}) | ${pct(a_l2_violation, a_total)} | n/a (无状态机) | ${pct(a_e2e, a_total)} [${(aLo * 100).toFixed(1)}%, ${(aHi * 100).toFixed(1)}%] |`);
  console.log(`| B 双层防御+自愈 | ${b_total} | ${pct(b_cases_l1_ok, b_total)} (轮次级 ${pct(b_rounds_l1_ok, b_rounds)}) | ${pct(b_l2_intercept, b_total)} | ${pct(b_healed, b_l2_intercept)} (${b_healed}/${b_l2_intercept}) | ${pct(b_e2e, b_total)} [${(bLo * 100).toFixed(1)}%, ${(bHi * 100).toFixed(1)}%] |`);
  if (a_network > 0 || b_network_errors > 0) {
    console.log(`| 注 | 网络/超时：A 组 ${a_network} 例（已从 L1 语法分母剔除，仍计入端到端失败）；B 组 ${b_network_errors} 次调用（按空响应进入重试，不污染 L1 语法口径） |`);
  }

  console.log('\n[表 2] 正确性与成本（对照 ground truth 与单样本开销）');
  console.log('| 组别 | 分类准确率 | orderId 准确率 | 平均 tokens/样本 | 平均耗时/样本 |');
  console.log('| :--- | :--- | :--- | :--- | :--- |');
  console.log(`| A | ${pct(a_cat_ok, a_cat_n)} (${a_cat_ok}/${a_cat_n}) | ${pct(a_ord_ok, a_ord_n)} (${a_ord_ok}/${a_ord_n}) | ${(a_tokens / Math.max(1, a_total)).toFixed(0)} | ${(a_duration_total / Math.max(1, a_total)).toFixed(0)}ms |`);
  console.log(`| B | ${pct(b_cat_ok, b_cat_n)} (${b_cat_ok}/${b_cat_n}) | ${pct(b_ord_ok, b_ord_n)} (${b_ord_ok}/${b_ord_n}) | ${(b_tokens / Math.max(1, b_total)).toFixed(0)} | ${(b_duration_total / Math.max(1, b_total)).toFixed(0)}ms |`);
  console.log(`| 自愈开销 | B 组共 ${b_rounds} 次调用 / ${b_total} 样本 (+${(((b_rounds - b_total) / Math.max(1, b_total)) * 100).toFixed(1)}% 调用，+${(((b_tokens - a_tokens) / Math.max(1, a_tokens)) * 100).toFixed(1)}% tokens) |`);

  console.log('\n[表 3] L2 违规规则构成 — 本次实际触发了什么');
  console.log('| 规则 | 类型 | A 触发 | B 触发 |');
  console.log('| :--- | :--- | :--- | :--- |');
  const crossTotal = { a: 0, b: 0 };
  const singleTotal = { a: 0, b: 0 };
  const structTotal = { a: 0, b: 0 };
  const kindOf = (cls: string) =>
    cls.startsWith('CROSSFIELD') ? '跨字段' : cls.startsWith('SINGLEFIELD') ? '单字段' : '结构';
  for (const [cls, hits] of Object.entries(ruleHits)) {
    if (cls.startsWith('CROSSFIELD')) {
      crossTotal.a += hits.a;
      crossTotal.b += hits.b;
    } else if (cls.startsWith('SINGLEFIELD')) {
      singleTotal.a += hits.a;
      singleTotal.b += hits.b;
    } else {
      structTotal.a += hits.a;
      structTotal.b += hits.b;
    }
    console.log(`| ${RULE_LABEL[cls as RuleClass]} | ${kindOf(cls)} | ${hits.a} | ${hits.b} |`);
  }
  for (const cls of Object.keys(RULE_LABEL) as RuleClass[]) {
    if (!ruleHits[cls]) console.log(`| ${RULE_LABEL[cls]} | ${kindOf(cls)} | 0 | 0 |`);
  }
  console.log(`| **合计** | 跨字段 ${crossTotal.a}/${crossTotal.b} · 单字段 ${singleTotal.a}/${singleTotal.b} · 结构 ${structTotal.a}/${structTotal.b} | ${crossTotal.a + singleTotal.a + structTotal.a} | ${crossTotal.b + singleTotal.b + structTotal.b} |`);
  console.log('| 说明 | 只有「跨字段」行非零时，才可以说本实验测到了跨字段契约 |');

  console.log('\n[表 4] 逐轮波动');
  for (let r = 1; r <= REPETITIONS; r++) {
    const rs = allRecords.filter((x) => x.repetitionIndex === r);
    console.log(`| R${r} | A 端到端 ${rs.filter((x) => x.groupA.endToEndSuccess).length}/${rs.length} | B 端到端 ${rs.filter((x) => x.groupB.endToEndSuccess).length}/${rs.length} | B 拦截 ${rs.filter((x) => x.groupB.wasInterceptedByL2).length} | B 触发 R2+ ${rs.filter((x) => x.groupB.reachedR2Escalation).length} |`);
  }

  console.log('\n[表 5] 显著性（配对 McNemar 精确检验）');
  let bPair = 0;
  let cPair = 0;
  for (const r of allRecords) {
    if (!r.groupA.endToEndSuccess && r.groupB.endToEndSuccess) bPair++;
    else if (r.groupA.endToEndSuccess && !r.groupB.endToEndSuccess) cPair++;
  }
  const caseB = new Set(allRecords.filter((r) => !r.groupA.endToEndSuccess && r.groupB.endToEndSuccess).map((r) => r.caseId)).size;
  const caseC = new Set(allRecords.filter((r) => r.groupA.endToEndSuccess && !r.groupB.endToEndSuccess).map((r) => r.caseId)).size;
  console.log(`| 按样本配对 (n=${bPair + cPair}, b=${bPair}, c=${cPair}) | p = ${mcnemarExact(bPair, cPair).toFixed(4)} |`);
  console.log(`| 按独立用例 (n=${caseB + caseC}, b=${caseB}, c=${caseC}) | p = ${mcnemarExact(caseB, caseC).toFixed(4)}  ← 重复是对同用例的重测，此口径更保守 |`);
  // NOTE: these lines previously hardcoded numbers from one specific run. Hardcoded
  // narratives silently go stale and then misreport the very experiment they describe —
  // always derive them from the current run's counters.
  const caseP = mcnemarExact(caseB, caseC);
  const sampleP = mcnemarExact(bPair, cPair);
  const deltaPt = ((b_e2e / b_total - a_e2e / a_total) * 100).toFixed(1);
  const healPt = ((b_healed / b_total) * 100).toFixed(1);
  const firstPassPt = (((b_e2e - b_healed) / b_total - a_e2e / a_total) * 100).toFixed(1);
  console.log(
    `  * 统计口径说明：按样本配对 p = ${sampleP.toFixed(4)}${sampleP < 0.01 ? '（显著）' : '（未达显著）'}；` +
      `按独立用例 p = ${caseP.toFixed(4)}${caseP < 0.05 ? '（显著）' : '（未达显著，样本量不足，非效果问题）'}。`,
  );
  console.log(
    `  * 收益归因：结构类错误由 L1 抹平 (${structTotal.a}->${structTotal.b})，跨字段违规初始依然存在 (${crossTotal.a}->${crossTotal.b})；`,
  );
  console.log(
    `  * 端到端提升 (${deltaPt}pt) 中，L1/提示词（首轮）贡献 ${firstPassPt}pt，L3 自愈救回 ${b_healed} 次贡献 ${healPt}pt。`,
  );
  console.log(
    `  * 结论表述必须严格限定口径为：“端到端 ${pct(a_e2e, a_total)} -> ${pct(b_e2e, b_total)}` +
      `（按样本配对 McNemar p = ${sampleP.toFixed(4)}，按独立用例 p = ${caseP.toFixed(4)}）”。`,
  );

  console.log(`\n[表 6] 逐用例（${REPETITIONS} 轮合并）`);
  console.log('| # | 用例 | 难度 | A 合规 | B 合规 | B 拦截 | A 分类正确 | B 分类正确 |');
  console.log('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');
  for (const c of BENCHMARK_CASES) {
    const rs = allRecords.filter((x) => x.caseId === c.id);
    const aOk = rs.filter((x) => x.groupA.endToEndSuccess).length;
    const bOk = rs.filter((x) => x.groupB.endToEndSuccess).length;
    const bi = rs.filter((x) => x.groupB.wasInterceptedByL2).length;
    const aC = rs.filter((x) => x.groupA.categoryCorrect).length;
    const bC = rs.filter((x) => x.groupB.categoryCorrect).length;
    const flag = aOk === rs.length && bOk === rs.length ? '  (无区分力)' : '';
    console.log(`| ${c.id} | ${c.title} | ${c.difficulty} | ${aOk}/${rs.length} | ${bOk}/${rs.length} | ${bi} | ${aC}/${rs.length} | ${bC}/${rs.length}${flag} |`);
  }

  // ── Sentinel Watch-List ────────────────────────────────────────────────────
  // Declared before the run (see WATCH_LIST). A group always runs the BASELINE
  // schema, so it doubles as the in-run control: if A holds and B drifts, the
  // variant caused it; if A also drifts, the case is unstable independent of the
  // variant and must not be blamed on it.
  const sentinel = WATCH_LIST.map((w) => {
    const rs = allRecords.filter((x) => x.caseId === w.caseId);
    const bHold = rs.filter((x) => x.groupB.finalCategory === w.mustHold).length;
    const aHold = rs.filter((x) => x.groupA.finalCategory === w.mustHold).length;
    const drifted = rs
      .filter((x) => x.groupB.finalCategory !== undefined && x.groupB.finalCategory !== w.mustHold)
      .map((x) => `R${x.repetitionIndex}:${x.groupB.finalCategory}`);
    const bVals = [...new Set(rs.map((x) => x.groupB.finalCategory ?? 'n/a'))];
    const aVals = [...new Set(rs.map((x) => x.groupA.finalCategory ?? 'n/a'))];
    return { ...w, samples: rs.length, bHold, aHold, drifted, bVals, aVals, ran: rs.length > 0 };
  });

  const guardCases = sentinel.filter((s) => s.caseId !== 7);
  const targetCase = sentinel.find((s) => s.caseId === 7);
  const collateralHit = guardCases.filter((s) => s.ran && s.drifted.length > 0);
  const targetMissed = targetCase?.ran && targetCase.drifted.length > 0;

  console.log('\n[哨兵监控 Watch-List]  #2 物流 · #7 退款 · #13 物流');
  for (const s of sentinel) {
    if (!s.ran) {
      console.log(`  #${s.caseId} 必须=${s.mustHold} — 本次未运行（--case 过滤），跳过`);
      continue;
    }
    const ok = s.drifted.length === 0;
    const marker = s.caseId === 7
      ? ok ? `${GREEN}靶心命中${RESET}` : `${YELLOW}靶心未命中${RESET}`
      : ok ? `${GREEN}守住了${RESET}` : `${RED}${BOLD}漂 移${RESET}`;
    console.log(
      `  #${s.caseId} 必须=${s.mustHold.padEnd(9)} B 持守 ${s.bHold}/${s.samples}` +
        ` (B 取值 ${s.bVals.join('/')}；A 对照组 ${s.aHold}/${s.samples}，取值 ${s.aVals.join('/')})  ${marker}`,
    );
    if (!ok) {
      console.log(`${RED}      ↳ 漂移明细: ${s.drifted.join('  ')}   — ${s.risk}${RESET}`);
    }
  }

  if (collateralHit.length > 0) {
    console.log(
      `\n${RED}${BOLD}🚨 哨兵告警：改动造成连带损伤 — #${collateralHit.map((s) => s.caseId).join(', #')} 从原分类漂走。` +
        `这是「修好一个、打坏一个」的信号：聚合分类准确率会把这种互换当成打平而掩盖它。${RESET}`,
    );
    console.log(`${RED}   判定：本变体在当前形态下不应合入；需收窄消歧规则的适用面后重跑。${RESET}`);
  } else if (targetMissed) {
    console.log(
      `\n${YELLOW}⚠ 哨兵提示：#7 未命中靶心，但 #2/#13 未受连带损伤 — 修复无效但无害，需换思路重做。${RESET}`,
    );
  } else {
    const skipped = sentinel.filter((s) => !s.ran);
    if (skipped.length > 0) {
      // Do NOT claim "all green" when part of the list never ran — a partial pass
      // is not a pass, and an unrun guard case is an untested risk, not a cleared one.
      console.log(
        `\n${YELLOW}⚠ 哨兵结论不完整：#${skipped.map((s) => s.caseId).join(', #')} 本次未运行，` +
          `已跑的 #${sentinel.filter((s) => s.ran).map((s) => s.caseId).join(', #')} 无漂移。尚未构成完整无连带损伤的证据。${RESET}`,
      );
    } else {
      console.log(`\n${GREEN}✅ 哨兵全绿：#2/#13 保持 logistics，#7 保持 refund — 本变体无连带损伤。${RESET}`);
    }
  }

  // ── Autopsy ────────────────────────────────────────────────────────────────
  const degraded = allRecords.filter((r) => !r.groupB.endToEndSuccess);
  console.log('\n' + '='.repeat(80));
  if (degraded.length === 0) {
    console.log('自愈失败尸检：0 例降级');
  } else {
    console.log(`自愈失败尸检：${degraded.length} 例降级`);
    for (const d of degraded) {
      console.log(`[R${d.repetitionIndex} #${d.caseId} ${d.caseTitle}] attempts=${d.groupB.totalAttempts} reason=${d.groupB.fallbackReason}`);
      d.groupB.trace.forEach((s, i) => {
        const errs = (s.errors || []).map((e) => `[${e.path}] ${e.message} (got=${JSON.stringify(e.receivedValue)})`).join('; ') || '-';
        console.log(`  Round ${i + 1} [${s.escalationLevel || '-'}] syn=${s.syntaxValid} sem=${s.semanticValid} :: ${errs}`);
      });
    }
  }
  console.log('='.repeat(80));

  // ── Persistence ────────────────────────────────────────────────────────────
  const evalDir = resolve(process.cwd(), 'eval-results');
  mkdirSync(evalDir, { recursive: true });
  const artifactPath = resolve(evalDir, `siliconflow-benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(
    artifactPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        harnessVersion: 3,
        experiment: experimentTag,
        filterCase: targetCaseId,
        mode: isLive ? 'live' : 'simulation',
        model: TARGET_FREE_MODEL,
        repetitions: REPETITIONS,
        samplesPerGroup: a_total,
        systemPrompt: UNIFIED_SYSTEM_PROMPT,
        summary: {
          groupA: {
            samples: a_total,
            networkFailures: a_network,
            l1SyntaxRate: pct(a_l1_ok, aL1Denom),
            l2ViolationRate: pct(a_l2_violation, a_total),
            endToEndRate: pct(a_e2e, a_total),
            endToEndCI95: [(aLo * 100).toFixed(1), (aHi * 100).toFixed(1)],
            categoryAccuracy: pct(a_cat_ok, a_cat_n),
            orderIdAccuracy: pct(a_ord_ok, a_ord_n),
            meanTokens: Math.round(a_tokens / Math.max(1, a_total)),
            meanDurationMs: Math.round(a_duration_total / Math.max(1, a_total)),
          },
          groupB: {
            samples: b_total,
            l1CaseRate: pct(b_cases_l1_ok, b_total),
            l1RoundRate: pct(b_rounds_l1_ok, b_rounds),
            l2InterceptRate: pct(b_l2_intercept, b_total),
            healingConversion: pct(b_healed, b_l2_intercept),
            endToEndRate: pct(b_e2e, b_total),
            endToEndCI95: [(bLo * 100).toFixed(1), (bHi * 100).toFixed(1)],
            categoryAccuracy: pct(b_cat_ok, b_cat_n),
            orderIdAccuracy: pct(b_ord_ok, b_ord_n),
            r2Escalations: b_r2_reached,
            r2EscalationRate: pct(b_r2_reached, b_total),
            networkErrors: b_network_errors,
            totalCalls: b_rounds,
            meanTokens: Math.round(b_tokens / Math.max(1, b_total)),
            meanDurationMs: Math.round(b_duration_total / Math.max(1, b_total)),
          },
          ruleBreakdown: ruleHits,
          crossFieldTotals: crossTotal,
          singleFieldTotals: singleTotal,
          structureTotals: structTotal,
          significance: {
            mcnemarBySample: mcnemarExact(bPair, cPair),
            mcnemarByCase: mcnemarExact(caseB, caseC),
          },
          sentinel: {
            // Declared before the run — see WATCH_LIST. Never post-hoc.
            watchList: WATCH_LIST,
            results: sentinel,
            verdict:
              collateralHit.length > 0
                ? 'COLLATERAL_DAMAGE'
                : targetMissed
                  ? 'TARGET_MISSED_NO_HARM'
                  : sentinel.some((s) => !s.ran)
                    ? 'INCOMPLETE'
                    : 'ALL_GREEN',
          },
        },
        trials: allRecords,
      },
      null,
      2,
    ),
    'utf-8',
  );
  console.log(`\n完整 trace 已落盘: ${artifactPath}`);

  // ── Baseline Snapshot Save ──────────────────────────────────────────────────
  if (saveBaselinePath) {
    const caseRecords = benchmarkCases.map((c) => {
      const rs = allRecords.filter((x) => x.caseId === c.id);
      const runs = rs.length;
      const compliancePassCount = rs.filter((x) => x.groupB.endToEndSuccess).length;
      const categoryAccuracyCount = rs.filter((x) => x.groupB.categoryCorrect).length;
      const orderIdAccuracyCount = rs.filter((x) => x.groupB.orderIdCorrect).length;
      return {
        caseId: c.id,
        semanticKey: c.semanticKey,
        title: c.title,
        expectedCategory: c.expectedCategory,
        runs,
        compliancePassCount,
        categoryAccuracyCount,
        orderIdAccuracyCount,
      };
    });

    const baselineSnapshot = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      model: TARGET_FREE_MODEL,
      experimentTag,
      repetitions: REPETITIONS,
      totalCases: benchmarkCases.length,
      totalSamples: b_total,
      metrics: {
        groupA: {
          complianceRate: pct(a_e2e, a_total),
          complianceCI95: [parseFloat((aLo * 100).toFixed(1)), parseFloat((aHi * 100).toFixed(1))],
          categoryAccuracy: pct(a_cat_ok, a_cat_n),
          orderIdAccuracy: pct(a_ord_ok, a_ord_n),
          meanTokens: Math.round(a_total > 0 ? a_tokens / a_total : 0),
          meanDurationMs: Math.round(a_total > 0 ? a_duration_total / a_total : 0),
        },
        groupB: {
          complianceRate: pct(b_e2e, b_total),
          complianceCI95: [parseFloat((bLo * 100).toFixed(1)), parseFloat((bHi * 100).toFixed(1))],
          categoryAccuracy: pct(b_cat_ok, b_cat_n),
          categoryAccuracyCI95: (() => {
            const [catLo, catHi] = wilson95(b_cat_ok, b_cat_n);
            return [parseFloat((catLo * 100).toFixed(1)), parseFloat((catHi * 100).toFixed(1))];
          })(),
          orderIdAccuracy: pct(b_ord_ok, b_ord_n),
          r2EscalationRate: pct(b_r2_reached, b_total),
          healingConversionRate: pct(b_healed, b_l2_intercept),
          meanTokens: Math.round(b_total > 0 ? b_tokens / b_total : 0),
          meanDurationMs: Math.round(b_total > 0 ? b_duration_total / b_total : 0),
          avgTokenCost: Math.round(b_total > 0 ? b_tokens / b_total : 0),
        },
      },
      sentinelVerdict:
        collateralHit.length > 0
          ? 'COLLATERAL_DAMAGE'
          : targetMissed
            ? 'TARGET_MISSED_NO_HARM'
            : sentinel.some((s) => !s.ran)
              ? 'INCOMPLETE'
              : 'ALL_GREEN',
      cases: caseRecords,
    };

    writeFileSync(saveBaselinePath, JSON.stringify(baselineSnapshot, null, 2), 'utf-8');
    console.log(`\n${GREEN}${BOLD}✔ 黄金基线已成功固化到:${RESET} ${saveBaselinePath}`);
  }

  // ── Baseline Regression Comparison & Gating ─────────────────────────────────
  if (compareBaselinePath) {
    const baselineRaw = readFileSync(compareBaselinePath, 'utf-8');
    const baseline = JSON.parse(baselineRaw) as {
      version: string;
      timestamp: string;
      model: string;
      experimentTag: string;
      metrics: {
        groupB: {
          complianceRate: string;
          complianceCI95?: [number, number];
          categoryAccuracy: string;
          categoryAccuracyCI95?: [number, number];
          orderIdAccuracy: string;
          r2EscalationRate?: string;
          meanTokens?: number;
          meanDurationMs?: number;
          avgTokenCost: number;
        };
      };
      cases: Array<{
        caseId: number;
        semanticKey: string;
        title: string;
        expectedCategory: string;
        runs: number;
        compliancePassCount: number;
        categoryAccuracyCount: number;
        orderIdAccuracyCount: number;
      }>;
    };

    console.log(`\n================================================================================`);
    console.log(`${BOLD}PatchCat 回归门禁看板 (Compared against ${basename(compareBaselinePath)})${RESET}`);
    console.log(`基线时间: ${baseline.timestamp} | 实验标签: ${baseline.experimentTag} | 模型: ${baseline.model}`);
    if (baseline.experimentTag !== experimentTag) {
      console.log(
        `${YELLOW}⚠ [配置亲和性提示] 基线快照为 '${baseline.experimentTag}'，当前运行为 '${experimentTag}'。` +
          `若参数不同（如未带 --e2-disambiguate），分类差异属于已知语义配置差异而非底层代码退化。${RESET}`,
      );
    }
    console.log(`================================================================================`);
    console.log(`编号    | 用例场景描述               | 基线合规 | 当前合规 | 基线分类 | 当前分类 | 门禁判定`);
    console.log(`--------------------------------------------------------------------------------`);

    let regressedCount = 0;
    let flakyCount = 0;
    let improvedCount = 0;
    let stablePassCount = 0;
    let stableFailCount = 0;

    for (const c of benchmarkCases) {
      const baseCase = baseline.cases.find((x) => x.semanticKey === c.semanticKey || x.caseId === c.id);
      const currRecords = allRecords.filter((r) => r.caseId === c.id);
      const currRuns = currRecords.length;
      const currCompliancePass = currRecords.filter((r) => r.groupB.endToEndSuccess).length;
      const currCategoryPass = currRecords.filter((r) => r.groupB.categoryCorrect).length;

      const basePassRate = baseCase && baseCase.runs > 0 ? baseCase.compliancePassCount / baseCase.runs : 0;
      const currPassRate = currRuns > 0 ? currCompliancePass / currRuns : 0;
      const baseCatRate = baseCase && baseCase.runs > 0 ? baseCase.categoryAccuracyCount / baseCase.runs : 0;
      const currCatRate = currRuns > 0 ? currCategoryPass / currRuns : 0;

      const isSentinel = WATCH_LIST.some((w) => w.caseId === c.id);
      const sentinelTag = isSentinel ? ' [哨兵]' : '';

      let statusMarker = `${GREEN}STABLE_PASS${RESET}`;

      // ── Dual-Track Gating: Sentinel Zero Tolerance vs Non-Sentinel Statistical Tolerance ──
      const compDrop = (baseCase?.compliancePassCount ?? 0) - currCompliancePass;
      const catDrop = (baseCase?.categoryAccuracyCount ?? 0) - currCategoryPass;

      if (!baseCase) {
        statusMarker = `${CYAN}NEW_CASE 🆕${RESET}`;
        if (currPassRate === 1.0 && currCatRate === 1.0) {
          stablePassCount++;
        } else {
          flakyCount++;
        }
      } else if (isSentinel) {
        // Sentinel cases: strict ZERO TOLERANCE on semantic category drift
        const targetW = WATCH_LIST.find((w) => w.caseId === c.id);
        const drifted = targetW && currRecords.some((r) => r.groupB.finalCategory !== targetW.mustHold);
        if (drifted || currPassRate < basePassRate || currCatRate < baseCatRate) {
          statusMarker = `${RED}${BOLD}REGRESSED 🚨 (哨兵失守)${RESET}`;
          regressedCount++;
        } else if (currCatRate > baseCatRate || currPassRate > basePassRate) {
          statusMarker = `${GREEN}${BOLD}IMPROVED 🟢${RESET}`;
          improvedCount++;
        } else {
          statusMarker = `${GREEN}STABLE_PASS${RESET}`;
          stablePassCount++;
        }
      } else {
        // Non-sentinel cases:
        // In small sample (e.g. n=4), a 1-sample drop (4/4 -> 3/4) has Wilson CI overlap (34.9%~96.8%)
        // Flag as FLAKY_WARN to avoid winner's curse false alarms.
        // A drop of >= 2 passes (e.g. 4/4 -> 2/4 or 1/4) is a statistically strong regression signal.
        if (compDrop >= 2 || catDrop >= 2) {
          statusMarker = `${RED}${BOLD}REGRESSED 🚨${RESET}`;
          regressedCount++;
        } else if (compDrop === 1 || catDrop === 1) {
          statusMarker = `${YELLOW}FLAKY_WARN ⚠️${RESET}`;
          flakyCount++;
        } else if (currCatRate > baseCatRate || currPassRate > basePassRate) {
          statusMarker = `${GREEN}${BOLD}IMPROVED 🟢${RESET}`;
          improvedCount++;
        } else if (currPassRate < 1.0 || currCatRate < 1.0) {
          statusMarker = `${YELLOW}STABLE_FAIL${RESET}`;
          stableFailCount++;
        } else {
          statusMarker = `${GREEN}STABLE_PASS${RESET}`;
          stablePassCount++;
        }
      }

      const baseCompStr = baseCase ? `${(basePassRate * 100).toFixed(0)}% (${baseCase.compliancePassCount}/${baseCase.runs})` : 'N/A';
      const currCompStr = `${(currPassRate * 100).toFixed(0)}% (${currCompliancePass}/${currRuns})`;
      const baseCatStr = baseCase ? `${(baseCatRate * 100).toFixed(0)}% (${baseCase.categoryAccuracyCount}/${baseCase.runs})` : 'N/A';
      const currCatStr = `${(currCatRate * 100).toFixed(0)}% (${currCategoryPass}/${currRuns})`;
      const titlePadded = (c.title + sentinelTag).padEnd(20);

      console.log(`Case ${String(c.id).padStart(2, '0')} | ${titlePadded} | ${baseCompStr.padEnd(8)} | ${currCompStr.padEnd(8)} | ${baseCatStr.padEnd(8)} | ${currCatStr.padEnd(8)} | ${statusMarker}`);
    }

    console.log(`================================================================================`);
    console.log(`【差分汇总对账】`);
    const baseComp = parseFloat(baseline.metrics.groupB.complianceRate);
    const currComp = parseFloat(pct(b_e2e, b_total));
    const compDelta = (currComp - baseComp).toFixed(1);

    const baseCat = parseFloat(baseline.metrics.groupB.categoryAccuracy);
    const currCat = parseFloat(pct(b_cat_ok, b_cat_n));
    const catDelta = (currCat - baseCat).toFixed(1);

    const baseTok = baseline.metrics.groupB.meanTokens || baseline.metrics.groupB.avgTokenCost || 0;
    const currTok = Math.round(b_total > 0 ? b_tokens / b_total : 0);
    const tokDelta = currTok - baseTok;

    const baseDur = baseline.metrics.groupB.meanDurationMs || 0;
    const currDur = Math.round(b_total > 0 ? b_duration_total / b_total : 0);
    const durDelta = currDur - baseDur;

    const baseR2 = baseline.metrics.groupB.r2EscalationRate || 'n/a';
    const currR2 = pct(b_r2_reached, b_total);

    // Derived Wilson 95% lower bounds to absorb binomial noise (winner's curse protection)
    const baseCompLo = baseline.metrics.groupB.complianceCI95 ? baseline.metrics.groupB.complianceCI95[0] : Math.max(0, baseComp - 8.0);
    const baseCatLo = baseline.metrics.groupB.categoryAccuracyCI95 ? baseline.metrics.groupB.categoryAccuracyCI95[0] : Math.max(0, baseCat - 10.0);

    console.log(`  - 契约合规率:   ${baseComp}% [95%下界: ${baseCompLo}%] -> ${currComp}% (Δ ${Number(compDelta) >= 0 ? '+' : ''}${compDelta}%)`);
    console.log(`  - 分类准确率:   ${baseCat}% [95%下界: ${baseCatLo}%] -> ${currCat}% (Δ ${Number(catDelta) >= 0 ? '+' : ''}${catDelta}%)`);
    console.log(`  - R2 升级率:    ${baseR2} -> ${currR2}`);
    console.log(`  - 平均 Token:   ${baseTok} -> ${currTok} tok (Δ ${tokDelta >= 0 ? '+' : ''}${tokDelta} tok)`);
    if (baseDur > 0) {
      console.log(`  - 平均耗时:     ${baseDur}ms -> ${currDur}ms (Δ ${durDelta >= 0 ? '+' : ''}${durDelta}ms)`);
    }
    console.log(`  - 晋级用例数:   ${improvedCount} 个`);
    console.log(`  - 抖动观察数:   ${flakyCount} 个 (小样本单次扰动)`);
    console.log(`  - 确诊退化数:   ${regressedCount} 个 (单用例 ≥2 次失效或哨兵失守)`);
    console.log(`  - 哨兵裁决:     ${collateralHit.length > 0 ? RED + 'COLLATERAL_DAMAGE 🚨' : targetMissed ? YELLOW + 'TARGET_MISSED ⚠️' : GREEN + 'ALL_GREEN ✔'}${RESET}`);
    console.log(`================================================================================`);

    const isFullSuiteRun = targetCaseId === undefined;
    const hasRegression = regressedCount > 0;
    const hasSentinelBreach = collateralHit.length > 0 || targetMissed;
    // Macro drop only triggers if the aggregate rate breaks below the baseline's 95% Wilson confidence lower bound!
    const isCompStatisticallyRegressed = isFullSuiteRun && currComp < baseCompLo;
    const isCatStatisticallyRegressed = isFullSuiteRun && currCat < baseCatLo;
    const hasMacroDrop = isCompStatisticallyRegressed || isCatStatisticallyRegressed;

    // Cost SLA gate: Token budget blowout limit (+25% over baseline)
    const isCostBlown = baseTok > 0 && currTok > baseTok * 1.25;

    if (hasRegression || hasSentinelBreach || hasMacroDrop || isCostBlown) {
      console.log(`\n${RED}${BOLD}❌ [门禁裁决]: REGRESSION GATE FAILED (检测到违规或退化，阻断 CI 合并)${RESET}`);
      if (hasSentinelBreach) console.log(`   - 失败根因: 核心业务哨兵失守或未中靶心 (0% 容差红线违背)`);
      if (hasRegression) console.log(`   - 失败根因: 确诊用例退化 (单用例 ≥2 次失败或哨兵漂移)`);
      if (isCompStatisticallyRegressed) console.log(`   - 失败根因: 契约合规率 (${currComp}%) 跌破 Wilson 95% 置信下界 (${baseCompLo}%)`);
      if (isCatStatisticallyRegressed) console.log(`   - 失败根因: 分类准确率 (${currCat}%) 跌破 Wilson 95% 置信下界 (${baseCatLo}%)`);
      if (isCostBlown) console.log(`   - 失败根因: Token 成本超标 (+${(((currTok - baseTok) / baseTok) * 100).toFixed(1)}% 超过 25% 预算 SLA)`);
      console.log();
      process.exitCode = 1;
      return;
    } else {
      console.log(`\n${GREEN}${BOLD}✔ [门禁裁决]: REGRESSION GATE PASSED (核心契约与意图分类稳固，统计与成本均在 SLA 内，准予合并)${RESET}\n`);
      process.exitCode = 0;
      return;
    }
  }
}

main().catch((err) => {
  console.error('Benchmark execution failed:', err);
  process.exit(1);
});
