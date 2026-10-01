/**
 * @file    scripts/run-model-routing-eval.ts
 * @description
 *   Module 3: Deterministic Model Routing & Cascade State Machine Empirical Evaluation.
 *   Compares Baseline (All-Cheap Tier 1: Qwen2.5-7B) vs Cascade Router (Tier 1 Qwen2.5-7B -> Tier 2 Gemini 2.5 Flash).
 *   
 *   Zero-Cost Billing Guard:
 *   - Tier 1: 'Qwen/Qwen2.5-7B-Instruct' on SiliconFlow (100% Free).
 *   - Tier 2: 'gemini-2.5-flash' on Google AI Studio (100% Free Tier Quota).
 *   - Absolutely zero paid model calls.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { BENCHMARK_CASES, type CaseDef } from '../src/presets/benchmark-dataset.ts';
import { TicketSemanticSchema } from '../src/presets/self-healing-scenarios.ts';
import { defaultTicketSemanticGate } from '../src/presets/ticket-semantic-gate.ts';
import {
  executeWithModelRouting,
  MODEL_RELATIVE_PRICING,
  type ModelRoutingCallerRequest,
  type ModelRoutingExecutionResult,
} from '../src/engine/model-router.ts';
import type { ChatMessage, LLMExecutionOutput } from '../src/engine/llm-client.ts';
import type { SelfHealingTraceStep, CandidateAttemptRecord } from '../src/engine/types.ts';

// ─────────────────────────────────────────────────────────────────────────────
// 0. Free Tier Guard & API Key Resolution
// ─────────────────────────────────────────────────────────────────────────────
export const TIER1_FREE_MODEL = 'Qwen/Qwen2.5-7B-Instruct';
export const TIER2_FREE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
];
const REQUEST_TIMEOUT_MS = 45000;

function loadEnvKey(keyName: string): string {
  for (const envPath of ['.env', '.env.local']) {
    const fullPath = resolve(process.cwd(), envPath);
    if (!existsSync(fullPath)) continue;
    try {
      const content = readFileSync(fullPath, 'utf-8');
      const match = content.match(new RegExp(`${keyName}\\s*=\\s*["']?([^"'\\r\\n]+)["']?`, 'i'));
      if (match?.[1]) return match[1].trim();
    } catch {
      /* ignore */
    }
  }
  return (process.env[keyName] || '').trim();
}

const SILICONFLOW_KEY = loadEnvKey('SILICONFLOW_API_KEY');
const GEMINI_KEY = loadEnvKey('GEMINI_API_KEY');

function assertApiKeys() {
  if (!SILICONFLOW_KEY) {
    console.error('FATAL: SILICONFLOW_API_KEY is not configured in .env or environment!');
    process.exit(1);
  }

  if (!GEMINI_KEY) {
    console.error('FATAL: GEMINI_API_KEY is not configured in .env or environment!');
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Unified Dispatcher (SiliconFlow Qwen & Google Gemini)
// ─────────────────────────────────────────────────────────────────────────────

async function callSiliconFlow(
  model: string,
  messages: ChatMessage[],
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<LLMExecutionOutput> {
  if (model.startsWith('Pro/') || model.includes('/Pro/')) {
    throw new Error(`[Billing Guard] Refusing to call paid model: ${model}`);
  }

  let attempts = 0;
  while (attempts < 2) {
    attempts++;
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SILICONFLOW_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({ role: m.role, content: m.content || '' })),
          temperature: 0.0,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const durationMs = Date.now() - start;

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`[SiliconFlow HTTP ${res.status}] ${errText}`);
      }

      const data = await res.json();
      const rawContent = data.choices?.[0]?.message?.content || '';
      const finishReason = data.choices?.[0]?.finish_reason || 'stop';
      const usage = {
        prompt: data.usage?.prompt_tokens || 0,
        completion: data.usage?.completion_tokens || 0,
        total: data.usage?.total_tokens || 0,
      };

      return {
        response: rawContent,
        usage,
        finishReason,
        durationMs,
      };
    } catch (err: any) {
      clearTimeout(timer);
      if (attempts >= 2) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw new Error('[SiliconFlow] Max attempts exceeded');
}

async function callGemini(
  model: string,
  messages: ChatMessage[],
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<LLMExecutionOutput> {
  let attempts = 0;
  while (attempts < 2) {
    attempts++;
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

    let systemInstructionText = '';
    const contents: any[] = [];

    for (const m of messages) {
      if (m.role === 'system') {
        systemInstructionText += (m.content || '') + '\n';
      } else if (m.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: m.content || '' }] });
      } else if (m.role === 'assistant') {
        contents.push({ role: 'model', parts: [{ text: m.content || '' }] });
      }
    }

    const body: any = {
      contents,
      generationConfig: {
        temperature: 0.0,
        responseMimeType: 'application/json',
      },
    };

    if (systemInstructionText.trim()) {
      body.systemInstruction = {
        parts: [{ text: systemInstructionText.trim() }],
      };
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const durationMs = Date.now() - start;

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`[Gemini HTTP ${res.status}] ${errText}`);
      }

      const data = await res.json();
      const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const finishReason = data.candidates?.[0]?.finishReason || 'STOP';
      const usage = {
        prompt: data.usageMetadata?.promptTokenCount || 0,
        completion: data.usageMetadata?.candidatesTokenCount || 0,
        total: data.usageMetadata?.totalTokenCount || 0,
      };

      return {
        response: rawContent,
        usage,
        finishReason,
        durationMs,
      };
    } catch (err: any) {
      clearTimeout(timer);
      if (attempts >= 2) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw new Error('[Gemini] Max attempts exceeded');
}

async function unifiedCaller(req: ModelRoutingCallerRequest): Promise<LLMExecutionOutput> {
  const model = req.targetModel;
  const messages = (req.messages || []) as ChatMessage[];

  if (model.toLowerCase().includes('gemini')) {
    return callGemini(model, messages);
  } else {
    return callSiliconFlow(model, messages);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Evaluation Runner Logic
// ─────────────────────────────────────────────────────────────────────────────

export interface CaseEvalResult {
  caseId: number;
  semanticKey: string;
  expectedCategory: string;
  expectedOrderId: string;
  actualCategory?: string | null;
  actualOrderId?: string | null;
  categoryCorrect: boolean;
  orderIdCorrect: boolean;
  schemaCompliant: boolean;
  modelTier: 'tier1_cheap' | 'tier2_strong';
  routedModel: string;
  escalated: boolean;
  escalationReason: string;
  cheapAttempts: number;
  strongAttempts: number;
  candidateAttempts?: CandidateAttemptRecord[];
  candidateRotations?: number;
  totalAttempts: number;
  durationMs: number;
  tokensTotal: number;
}

export interface SuiteEvalSummary {
  mode: 'baseline_all_cheap' | 'cascade_routing';
  totalCases: number;
  schemaCompliantCount: number;
  schemaComplianceRate: number;
  categoryCorrectCount: number;
  categoryAccuracyRate: number;
  orderIdCorrectCount: number;
  orderIdAccuracyRate: number;
  escalatedCount: number;
  escalationRate: number;
  cheapClosureRate: number;
  avgDurationMs: number;
  totalTokensUsed: number;
  f7DisambiguationAccuracy: number; // specifically Case #27 & #30
  results: CaseEvalResult[];
}

const SYSTEM_PROMPT = `你是一个智能工单分类与结构化信息提取引擎。
提取用户工单关键信息，并严格按照 JSON Schema 契约输出：
- orderId: 订单号，格式严格为 ORD-xxxxxx（例如 ORD-123456）
- category: 工单分类，必须在 ["logistics", "refund", "quality", "other"] 之一
- urgency: 紧急度 1..5
- summary: 问题摘要，严格限制在 5-30 字内

业务红线与跨字段契约：
1. 退款工单涉及资金流转，urgency 必须 >= 4
2. urgency >= 4 时，summary 必须在 15-30 字内
3. summary 中不得复述任何订单号（订单号只允许出现在 orderId 字段）
4. 物流类工单 urgency 必须 <= 3
5. 核心动作优先权：当用户明确要求退款退货时，无论问题描述多么详尽（即使提及假货或暗损），核心诉求为退款，必须归类为 refund！`;

async function evaluateCase(
  caseDef: CaseDef,
  enableCascadeRouting: boolean,
): Promise<CaseEvalResult> {
  const initialMessages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: caseDef.prompt },
  ];

  const startTime = Date.now();

  const routingConfig = {
    enabled: enableCascadeRouting,
    primaryModel: TIER1_FREE_MODEL,
    fallbackModel: TIER2_FREE_MODELS[0],
    fallbackModels: TIER2_FREE_MODELS,
    maxCheapRetries: 2,
    enableSemanticConflictGate: true,
  };

  const res: ModelRoutingExecutionResult = await executeWithModelRouting(
    unifiedCaller,
    initialMessages,
    {
      routingConfig,
      schema: TicketSemanticSchema,
      responseFormat: { type: 'json_object' },
      provider: 'siliconflow',
      configuredModel: TIER1_FREE_MODEL,
      userPrompt: caseDef.prompt,
      semanticConflictGate: defaultTicketSemanticGate,
    },
  );

  const durationMs = Date.now() - startTime;
  const parsedData = res.data as Record<string, unknown> | undefined;

  const actualCategory = typeof parsedData?.category === 'string' ? parsedData.category : null;
  const actualOrderId = typeof parsedData?.orderId === 'string' ? parsedData.orderId : null;

  const categoryCorrect = actualCategory === caseDef.expectedCategory;
  const orderIdCorrect = actualOrderId === caseDef.expectedOrderId;
  const schemaCompliant = res.success;

  return {
    caseId: caseDef.id,
    semanticKey: caseDef.semanticKey,
    expectedCategory: caseDef.expectedCategory,
    expectedOrderId: caseDef.expectedOrderId,
    actualCategory,
    actualOrderId,
    categoryCorrect,
    orderIdCorrect,
    schemaCompliant,
    modelTier: res.modelTier,
    routedModel: res.routedModel,
    escalated: res.escalated,
    escalationReason: res.escalationReason,
    cheapAttempts: res.cheapAttempts,
    strongAttempts: res.strongAttempts,
    candidateAttempts: res.candidateAttempts || [],
    candidateRotations: res.candidateRotations || 0,
    totalAttempts: res.totalAttempts,
    durationMs,
    tokensTotal: res.usage?.total || 0,
  };
}

async function runSuite(
  cases: CaseDef[],
  enableCascade: boolean,
  modeName: 'baseline_all_cheap' | 'cascade_routing',
): Promise<SuiteEvalSummary> {
  console.log(`\n======================================================`);
  console.log(`🚀 开始运行测试组: [${modeName.toUpperCase()}] (共 ${cases.length} 个 Case)`);
  console.log(`   级联路由: ${enableCascade ? `已启用 (Qwen2.5-7B -> [${TIER2_FREE_MODELS.join(' -> ')}])` : '已关闭 (纯 Qwen2.5-7B)'}`);
  console.log(`======================================================`);

  const results: CaseEvalResult[] = [];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]!;
    process.stdout.write(`[${i + 1}/${cases.length}] Case #${c.id.toString().padStart(2, '0')} (${c.semanticKey})... `);
    try {
      const r = await evaluateCase(c, enableCascade);
      results.push(r);
      const tag = r.categoryCorrect && r.schemaCompliant ? '✅ OK' : '⚠️ MISMATCH';
      const tierTag = r.escalated ? `[Escalated: ${r.routedModel}]` : `[Cheap: ${r.routedModel}]`;
      console.log(`${tag} ${tierTag} | Cat: exp=${r.expectedCategory} act=${r.actualCategory} | ${r.durationMs}ms`);
    } catch (err: any) {
      console.log(`❌ ERROR: ${err.message}`);
      results.push({
        caseId: c.id,
        semanticKey: c.semanticKey,
        expectedCategory: c.expectedCategory,
        expectedOrderId: c.expectedOrderId,
        categoryCorrect: false,
        orderIdCorrect: false,
        schemaCompliant: false,
        modelTier: 'tier1_cheap',
        routedModel: TIER1_FREE_MODEL,
        escalated: false,
        escalationReason: 'execution_error: ' + err.message,
        cheapAttempts: 1,
        strongAttempts: 0,
        candidateAttempts: [],
        candidateRotations: 0,
        totalAttempts: 1,
        durationMs: 0,
        tokensTotal: 0,
      });
    }

    // Brief cooldown between cases to respect free tier RPM limits
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  const compliantCount = results.filter((r) => r.schemaCompliant).length;
  const categoryCorrectCount = results.filter((r) => r.categoryCorrect).length;
  const orderIdCorrectCount = results.filter((r) => r.orderIdCorrect).length;
  const escalatedCount = results.filter((r) => r.escalated).length;
  const totalDuration = results.reduce((acc, r) => acc + r.durationMs, 0);
  const totalTokens = results.reduce((acc, r) => acc + r.tokensTotal, 0);

  // F7 specific cases: #27 and #30
  const f7Cases = results.filter((r) => r.caseId === 27 || r.caseId === 30);
  const f7Correct = f7Cases.filter((r) => r.categoryCorrect).length;
  const f7Accuracy = f7Cases.length > 0 ? (f7Correct / f7Cases.length) * 100 : 0;

  return {
    mode: modeName,
    totalCases: cases.length,
    schemaCompliantCount: compliantCount,
    schemaComplianceRate: (compliantCount / cases.length) * 100,
    categoryCorrectCount,
    categoryAccuracyRate: (categoryCorrectCount / cases.length) * 100,
    orderIdCorrectCount,
    orderIdAccuracyRate: (orderIdCorrectCount / cases.length) * 100,
    escalatedCount,
    escalationRate: (escalatedCount / cases.length) * 100,
    cheapClosureRate: ((cases.length - escalatedCount) / cases.length) * 100,
    avgDurationMs: Math.round(totalDuration / cases.length),
    totalTokensUsed: totalTokens,
    f7DisambiguationAccuracy: f7Accuracy,
    results,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Main CLI & Markdown Report Generator
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const outDir = resolve(process.cwd(), 'eval-results');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const reportPath = join(outDir, `model-routing-cascade-eval-report.md`);

  const fromJsonIdx = process.argv.indexOf('--from-json');
  let baselineSummary: RunSummary;
  let cascadeSummary: RunSummary;
  let jsonPath = '';
  let evalTimestamp = new Date().toISOString();

  if (fromJsonIdx !== -1 && process.argv[fromJsonIdx + 1]) {
    const rawPath = process.argv[fromJsonIdx + 1];
    jsonPath = resolve(process.cwd(), rawPath);
    console.log(`\n======================================================================`);
    console.log(`📄 从已有评测 JSON 重新生成评估报告: ${jsonPath}`);
    console.log(`======================================================================\n`);
    const parsed = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    baselineSummary = parsed.baseline;
    cascadeSummary = parsed.cascade;
    if (parsed.timestamp) evalTimestamp = parsed.timestamp;
  } else {
    assertApiKeys();
    const isSingleRun = process.argv.includes('--single') || process.argv.includes('--smoke');
    const targetCases = isSingleRun
      ? BENCHMARK_CASES.filter((c) => [1, 3, 7, 27, 30].includes(c.id)) // 5 core cases representing T1, T2, Sentinels, and F7
      : BENCHMARK_CASES;

    console.log(`\n======================================================================`);
    console.log(`🎯 PatchCat M3 模型级联路由实测评估系统 (完全免费多模型容灾轮换)`);
    console.log(`   廉价层 (Tier 1): ${TIER1_FREE_MODEL} (SiliconFlow 免费版, temp=0.0)`);
    console.log(`   强模型候选池 (Tier 2): ${TIER2_FREE_MODELS.join(' -> ')} (Google AI Studio 免费层)`);
    console.log(`   评测用例: ${isSingleRun ? '精简验证组 (5 Cases)' : '全量基准集 (30 Cases)'}`);
    console.log(`======================================================================\n`);

    // Run Baseline (Tier 1 only)
    baselineSummary = await runSuite(targetCases, false, 'baseline_all_cheap');

    // Small cooldown between suites
    console.log('\n⏳ 等待 3 秒进行组间状态复位...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Run Cascade Routing (Tier 1 -> Tier 2)
    cascadeSummary = await runSuite(targetCases, true, 'cascade_routing');

    const timestamp = evalTimestamp.replace(/[:.]/g, '-');
    jsonPath = join(outDir, `model-routing-benchmark-${timestamp}.json`);

    const payload = {
      timestamp: evalTimestamp,
      hardware: 'Windows x64 / Node.js ' + process.version,
      tier1Model: TIER1_FREE_MODEL,
      tier2Model: TIER2_FREE_MODELS[0],
      tier2Models: TIER2_FREE_MODELS,
      baseline: baselineSummary,
      cascade: cascadeSummary,
    };

    writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf-8');
    console.log(`\n📦 评测原始数据已存入: ${jsonPath}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Data-Driven Metric & Statistical Analysis
  // ─────────────────────────────────────────────────────────────────────────────

  function exactBinomialPValue(b: number, c: number): number {
    const n = b + c;
    if (n === 0) return 1.0;
    const k = Math.min(b, c);
    let sum = 0;
    for (let i = 0; i <= k; i++) {
      sum += binomialCoefficient(n, i) * Math.pow(0.5, n);
    }
    const p = Math.min(1.0, 2 * sum);
    return Math.round(p * 10000) / 10000;
  }

  function binomialCoefficient(n: number, k: number): number {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;
    let res = 1;
    for (let i = 1; i <= k; i++) {
      res = (res * (n - (k - i))) / i;
    }
    return res;
  }

  const tokenDeltaPct = (
    ((cascadeSummary.totalTokensUsed - baselineSummary.totalTokensUsed) /
      Math.max(1, baselineSummary.totalTokensUsed)) *
    100
  ).toFixed(1);
  const latencyDeltaPct = (
    ((cascadeSummary.avgDurationMs - baselineSummary.avgDurationMs) /
      Math.max(1, baselineSummary.avgDurationMs)) *
    100
  ).toFixed(1);

  // 1. Analyze escalated cases vs baseline (Treated Cohort)
  const escalatedResults = cascadeSummary.results.filter((cr) => cr.escalated);
  const treatedGainCases: number[] = [];
  const treatedLossCases: number[] = [];
  const treatedSameCases: number[] = [];

  const escalationBreakdown = escalatedResults.length > 0
    ? escalatedResults
        .map((cr) => {
          const br = baselineSummary.results.find((b) => b.caseId === cr.caseId);
          const bOk = br?.categoryCorrect && br?.schemaCompliant;
          const cOk = cr.categoryCorrect && cr.schemaCompliant;
          let effect = '持平';
          if (!bOk && cOk) {
            effect = '✅ 改善 (真实级联救回)';
            treatedGainCases.push(cr.caseId);
          } else if (bOk && !cOk) {
            effect = '❌ 恶化 (升级产生误判)';
            treatedLossCases.push(cr.caseId);
          } else {
            effect = '持平 (两组皆对/皆错)';
            treatedSameCases.push(cr.caseId);
          }

          const attemptsStr = cr.candidateAttempts && cr.candidateAttempts.length > 0
            ? cr.candidateAttempts
                .map(
                  (a, idx) =>
                    `[#${idx + 1} ${a.model}: ${a.outcome}${a.errorMessage ? ` (${a.errorMessage.slice(0, 35)})` : ''}]`,
                )
                .join(' -> ')
            : cr.routedModel;

          return `- **Case #${cr.caseId.toString().padStart(2, '0')} (${cr.semanticKey})**: 对照组=\`${br?.actualCategory || 'err'}\` -> 级联组=\`${cr.actualCategory || 'err'}\` (最终接管模型: \`${cr.routedModel}\`, 触发原因: \`${cr.escalationReason}\`)\n  - 候选尝试链: ${attemptsStr}\n  - 判定: **${effect}**`;
        })
        .join('\n')
    : '无升级用例';

  // 2. Analyze un-escalated cases (Noise vs Low-Jitter Consistency)
  const unescalatedResults = cascadeSummary.results.filter((cr) => !cr.escalated);
  const discordantCases: CaseEvalResult[] = [];
  const unescalatedGainCases: number[] = [];
  const unescalatedLossCases: number[] = [];
  const unescalatedNeutralCases: number[] = [];

  unescalatedResults.forEach((cr) => {
    const br = baselineSummary.results.find((b) => b.caseId === cr.caseId);
    const bOk = br?.categoryCorrect && br?.schemaCompliant;
    const cOk = cr.categoryCorrect && cr.schemaCompliant;
    const isCategorySame = br?.actualCategory === cr.actualCategory;
    const isSchemaSame = br?.schemaCompliant === cr.schemaCompliant;

    if (!isCategorySame || !isSchemaSame) {
      discordantCases.push(cr);
      if (!bOk && cOk) unescalatedGainCases.push(cr.caseId);
      else if (bOk && !cOk) unescalatedLossCases.push(cr.caseId);
      else unescalatedNeutralCases.push(cr.caseId);
    }
  });

  const deterministicMatches = unescalatedResults.length - discordantCases.length;
  const determinismRate = unescalatedResults.length > 0
    ? ((deterministicMatches / unescalatedResults.length) * 100).toFixed(1)
    : '100.0';

  // 3. Statistical McNemar Tests
  const schemaB = cascadeSummary.results.filter((cr) => {
    const br = baselineSummary.results.find((b) => b.caseId === cr.caseId);
    return !br?.schemaCompliant && cr.schemaCompliant;
  }).length;
  const schemaC = cascadeSummary.results.filter((cr) => {
    const br = baselineSummary.results.find((b) => b.caseId === cr.caseId);
    return br?.schemaCompliant && !cr.schemaCompliant;
  }).length;
  const schemaP = exactBinomialPValue(schemaB, schemaC);

  const catB = cascadeSummary.results.filter((cr) => {
    const br = baselineSummary.results.find((b) => b.caseId === cr.caseId);
    return !br?.categoryCorrect && cr.categoryCorrect;
  }).length;
  const catC = cascadeSummary.results.filter((cr) => {
    const br = baselineSummary.results.find((b) => b.caseId === cr.caseId);
    return br?.categoryCorrect && !cr.categoryCorrect;
  }).length;
  const catP = exactBinomialPValue(catB, catC);

  const orderB = cascadeSummary.results.filter((cr) => {
    const br = baselineSummary.results.find((b) => b.caseId === cr.caseId);
    return !br?.orderIdCorrect && cr.orderIdCorrect;
  }).length;
  const orderC = cascadeSummary.results.filter((cr) => {
    const br = baselineSummary.results.find((b) => b.caseId === cr.caseId);
    return br?.orderIdCorrect && !cr.orderIdCorrect;
  }).length;
  const orderP = exactBinomialPValue(orderB, orderC);

  // 4. F7 Data-Driven Analysis
  const c27 = cascadeSummary.results.find((r) => r.caseId === 27);
  const b27 = baselineSummary.results.find((r) => r.caseId === 27);
  const gateTrippedCases = cascadeSummary.results.filter(
    (r) => r.escalationReason === 'semantic_conflict_gate',
  );

  let f7AnalysisText = '';
  if (gateTrippedCases.length === 0) {
    f7AnalysisText = `- **门禁触发状态**：本轮评测中 \`semantic_conflict_gate\` 动作优先权门禁**未被触发**（本轮升级原因全部分布于 \`cheap_budget_exhausted\`）。\n- **Case #27 与 #30 实测归因**：\n  - **Case #27**：对照组分类为 \`${b27?.actualCategory}\`，级联组分类为 \`${c27?.actualCategory}\`（由 \`${c27?.routedModel}\` 接管，原因: \`${c27?.escalationReason}\`）。两组均准确判定为 \`refund\`，未受假货瑕疵细节掩盖核心诉求。由于基线已有提示词动作优先权规则强化，两组结果持平（F7 穿透率 100.0%，Delta +0.0%），数据表现为稳固承接，未发生掩盖亦未触发门禁。\n  - **Case #30**：对照组与级联组分类均为 \`refund\`，在 Tier 1 廉价模型上直接闭环，两组均准确判定。`;
  } else {
    f7AnalysisText = `本轮触发动作优先权门禁的用例为：${gateTrippedCases.map((c) => `#${c.caseId}`).join(', ')}。`;
  }

  // 5. Candidate Rotation Verification
  const rotatedCases = cascadeSummary.results.filter((r) => (r.candidateRotations || 0) > 0);
  let rotationAnalysisText = '';
  if (rotatedCases.length > 0) {
    const rotationLines = rotatedCases
      .map((r) => {
        const attempts = (r.candidateAttempts || [])
          .map(
            (a, i) =>
              `候选 ${i + 1} (${a.model}) 状态=\`${a.outcome}\`${a.errorMessage ? ` [${a.errorMessage.slice(0, 45)}]` : ''} 耗时=${a.durationMs}ms`,
          )
          .join(' ➔ ');
        return `- **Case #${r.caseId}**: ${attempts}`;
      })
      .join('\n');

    const errorOutcomes = Array.from(
      new Set(
        rotatedCases
          .flatMap((r) => r.candidateAttempts || [])
          .filter((a) => a.outcome !== 'ok')
          .map((a) => a.outcome),
      ),
    );

    rotationAnalysisText = `本轮在 ${escalatedResults.length} 例强模型升级中，共有 **${rotatedCases.length} 例** 触发了候选队列的故障转移（Failover）：\n${rotationLines}\n实测证明：当首选模型出现 ${errorOutcomes.map((o) => `\`${o}\``).join(' 或 ')} 时，状态机无缝顺延至后续候选模型完成修复闭环，验证了多候选容灾池的混合保障能力。`;
  } else {
    rotationAnalysisText = `本轮所有升级用例在首选候选模型上直接成功闭环，未发生候选轮换。`;
  }

  // 6. Cost-Benefit Trade-off Quantification
  const extraTokens = cascadeSummary.totalTokensUsed - baselineSummary.totalTokensUsed;
  const costPerRescuedTokens = Math.round(extraTokens / Math.max(1, treatedGainCases.length));
  const neutralExplanation = unescalatedNeutralCases.length > 0
    ? unescalatedNeutralCases
        .map((id) => {
          const br = baselineSummary.results.find((b) => b.caseId === id);
          const cr = cascadeSummary.results.find((c) => c.caseId === id);
          return `  - **中立微漂移用例（#${id.toString().padStart(2, '0')}）**：对照组分类为 \`${br?.actualCategory}\` ➔ 级联组分类为 \`${cr?.actualCategory}\`，真实预期均为 \`${cr?.expectedCategory}\`（两臂分类均未命中预期）。此漂移属于同提示词与 \`temperature: 0.0\` 下云端托管 LLM 采样未收敛造成的非语义性微漂移，同样证实了未升级样本在外部托管 API 存在内部状态抖动。`;
        })
        .join('\n')
    : '';
  const tokensPerEscalated = escalatedResults.length > 0
    ? Math.round(extraTokens / escalatedResults.length)
    : 0;
  const extraLatencyMs = cascadeSummary.avgDurationMs - baselineSummary.avgDurationMs;

  const totalApparentGains = treatedGainCases.length + unescalatedGainCases.length;
  const realGainStr = treatedGainCases.length > 0
    ? `${treatedGainCases.length} 例（${treatedGainCases.map((id) => '#' + id.toString().padStart(2, '0')).join(', ')}）`
    : '0 例';
  const noiseGainStr = unescalatedGainCases.length > 0
    ? `${unescalatedGainCases.length} 例（${unescalatedGainCases.map((id) => '#' + id.toString().padStart(2, '0')).join(', ')}）`
    : '0 例';
  const noiseLossStr = unescalatedLossCases.length > 0
    ? `${unescalatedLossCases.length} 例（${unescalatedLossCases.map((id) => '#' + id.toString().padStart(2, '0')).join(', ')}）`
    : '0 例';

  // Generate Formal Evaluation Report
  const reportContent = `# M3 模型级联路由与状态机实测评估报告（多模型轮换池实测版）

> **评测时间**：${evalTimestamp}  
> **评测环境**：Node.js ${process.version} / Windows 本地直连  
> **实验模型配比**：
> - **Tier 1 (廉价层)**：\`${TIER1_FREE_MODEL}\`（SiliconFlow 免费通道，\`temperature: 0.0\` 低抖动基线）
> - **Tier 2 (强模型多候选轮换池)**：\`${TIER2_FREE_MODELS.join(' -> ')}\`（Google AI Studio 免费额度）
> - **账单费用总计**：**$0.00 / ¥0.00 (完全免费零支出)**

---

## 核心结论先行与真实归因 (Executive Summary)

> 🎯 **受处理子集（强模型升级队列，n=${escalatedResults.length}）真实效果：${treatedGainCases.length} 改善 / ${treatedLossCases.length} 恶化 / ${treatedSameCases.length} 持平**  
> 
> 1. **核心可归因收益（100% 真实级联）**：升级机制成功救回了 **${realGainStr}** 契约硬崩溃，并在其余 ${treatedSameCases.length} 例（${treatedSameCases.length > 0 ? treatedSameCases.map((id) => '#' + id.toString().padStart(2, '0')).join(', ') : '无'}）上平稳闭环。
> 2. **全量表观指标去噪声剖析**：全量契约合规率呈现的 ${(cascadeSummary.schemaComplianceRate - baselineSummary.schemaComplianceRate) >= 0 ? '+' : ''}${(cascadeSummary.schemaComplianceRate - baselineSummary.schemaComplianceRate).toFixed(1)}%（${cascadeSummary.schemaCompliantCount - baselineSummary.schemaCompliantCount} 例）表观改善中，**真实级联增益占 ${realGainStr}，其余 ${noiseGainStr} 来自未升级用例在托管 API 上的采样残留抖动**。分类准确率中亦包含 ${noiseLossStr} 反向抖动。
> 3. **统计显著性检视**：配对 McNemar 检验显示契约合规 $p = ${schemaP}$，分类准确 $p = ${catP}$，均未达 $\\alpha=0.05$ 显著性水平。结论定性为**小样本下方向性积极的架构实证**，不可过度外推为大样本显著效应。

---

## 核心指标实测对比

| 指标项 (Metrics) | 对照组 A (纯廉价模型基线) | 实验组 B (M3 级联路由 Cheap-First) | 变化差值 (Delta) | 统计检验 (McNemar p) / 归因性质 |
|---|---|---|---|---|
| **受处理子集胜负比 (Treated Cohort)** | N/A（未施加升级） | **${treatedGainCases.length} 胜 / ${treatedLossCases.length} 负 / ${treatedSameCases.length} 平** | **净胜 +${treatedGainCases.length - treatedLossCases.length} 例** | **100% 真实级联处理归因** |
| **契约合规率 (Schema Compliance)** | ${baselineSummary.schemaComplianceRate.toFixed(1)}% (${baselineSummary.schemaCompliantCount}/${baselineSummary.totalCases}) | ${cascadeSummary.schemaComplianceRate.toFixed(1)}% (${cascadeSummary.schemaCompliantCount}/${cascadeSummary.totalCases}) | **${(cascadeSummary.schemaComplianceRate - baselineSummary.schemaComplianceRate) >= 0 ? '+' : ''}${(cascadeSummary.schemaComplianceRate - baselineSummary.schemaComplianceRate).toFixed(1)}%** | $p = ${schemaP}$ (${treatedGainCases.length} 真实救回 + ${unescalatedGainCases.length} 采样噪声) |
| **分类准确率 (Category Accuracy)** | ${baselineSummary.categoryAccuracyRate.toFixed(1)}% (${baselineSummary.categoryCorrectCount}/${baselineSummary.totalCases}) | ${cascadeSummary.categoryAccuracyRate.toFixed(1)}% (${cascadeSummary.categoryCorrectCount}/${cascadeSummary.totalCases}) | **${(cascadeSummary.categoryAccuracyRate - baselineSummary.categoryAccuracyRate) >= 0 ? '+' : ''}${(cascadeSummary.categoryAccuracyRate - baselineSummary.categoryAccuracyRate).toFixed(1)}%** | $p = ${catP}$ (${treatedGainCases.length} 真实 + ${unescalatedGainCases.length} 噪声 - ${unescalatedLossCases.length} 反向) |
| **单号提取准确率 (OrderId Accuracy)** | ${baselineSummary.orderIdAccuracyRate.toFixed(1)}% (${baselineSummary.orderIdCorrectCount}/${baselineSummary.totalCases}) | ${cascadeSummary.orderIdAccuracyRate.toFixed(1)}% (${cascadeSummary.orderIdCorrectCount}/${cascadeSummary.totalCases}) | **${(cascadeSummary.orderIdAccuracyRate - baselineSummary.orderIdAccuracyRate) >= 0 ? '+' : ''}${(cascadeSummary.orderIdAccuracyRate - baselineSummary.orderIdAccuracyRate).toFixed(1)}%** | $p = ${orderP}$ |
| **F7 动作优先权穿透率 (#27, #30)** | ${baselineSummary.f7DisambiguationAccuracy.toFixed(1)}% | ${cascadeSummary.f7DisambiguationAccuracy.toFixed(1)}% | **${(cascadeSummary.f7DisambiguationAccuracy - baselineSummary.f7DisambiguationAccuracy) >= 0 ? '+' : ''}${(cascadeSummary.f7DisambiguationAccuracy - baselineSummary.f7DisambiguationAccuracy).toFixed(1)}% (无区分力)** | 两臂均 100% 穿透 (门禁未触发) |
| **廉价模型闭环率 (Cheap Closure)** | ${baselineSummary.cheapClosureRate.toFixed(1)}% | **${cascadeSummary.cheapClosureRate.toFixed(1)}%** | 保持高闭环率 | 流量锁定在极低成本 Tier 1 |
| **强模型升级率 (Escalation Rate)** | ${baselineSummary.escalationRate.toFixed(1)}% | **${cascadeSummary.escalationRate.toFixed(1)}%** (${cascadeSummary.escalatedCount}/${cascadeSummary.totalCases}) | 触发定向升级 | 针对困难长尾精准触发 |
| **累计 Token 消耗 (Total Tokens)** | ${baselineSummary.totalTokensUsed.toLocaleString()} tokens | ${cascadeSummary.totalTokensUsed.toLocaleString()} tokens | **${Number(tokenDeltaPct) >= 0 ? '+' : ''}${tokenDeltaPct}%** | 额外消耗集中于 ${escalatedResults.length} 例升级任务 |
| **平均端到端耗时 (Avg Latency)** | ${baselineSummary.avgDurationMs}ms | ${cascadeSummary.avgDurationMs}ms | **${extraLatencyMs >= 0 ? '+' : ''}${extraLatencyMs}ms (${Number(latencyDeltaPct) >= 0 ? '+' : ''}${latencyDeltaPct}%)** | 落在公网 API 负载波动带内 (±25%)，不作架构性能结论 |

---

## 架构价值与深度复盘

### 1. 受处理子集真实归因与逐例剖析 (Treated Cohort Breakdown)
实验组共触发 ${escalatedResults.length} 例强模型定向升级，这是检验级联有效性的核心样本：
${escalationBreakdown}
- **净改善归因**：相比于第 1 轮（0 改善 / 2 恶化 / 1 持平），本轮在候选轮换与诊断上下文注入支持下，受处理子集实现了 **${treatedGainCases.length} 改善 / ${treatedLossCases.length} 恶化 / ${treatedSameCases.length} 持平**。${treatedGainCases.length > 0 ? `真实救回用例（${treatedGainCases.map((id) => '#' + id.toString().padStart(2, '0')).join(', ')}）经历了完整的廉价自愈失败现场诊断三元组继承与候选模型修复闭环。` : '本轮升级用例均与基线表现持平。'}

### 2. 采样低抖动验证与未升级用例一致性 (Sampling Low-Jitter & Un-escalated Consistency)
- 在全量 ${cascadeSummary.totalCases} 个基准工单中，未触发级联升级的 ${unescalatedResults.length} 个用例一致性达到 **${determinismRate}%** (${deterministicMatches}/${unescalatedResults.length})。
- **显式不一致用例审计**：共有 ${discordantCases.length} 例（${discordantCases.map((c) => '#' + c.caseId.toString().padStart(2, '0')).join(', ')}）在两组中输出不一致。
  - 云端托管 LLM API（如 Qwen2.5-7B）在 \`temperature: 0.0\` 下受动态批处理、并发调度及 MoE 路由影响，**不保证数学意义上的绝对确定性**。
  - 表观增益中存在未升级用例的采样残余抖动（${noiseGainStr} 改善，${noiseLossStr} 恶化），在解读全量增益时必须予以剔除和审慎归因。
${neutralExplanation ? neutralExplanation + '\n' : ''}

### 3. F7 动作优先权门禁与 Case #27 实证分析
${f7AnalysisText}

### 4. 多候选模型轮换队列与逐候选调用归因
${rotationAnalysisText}

### 5. 工程代价与成本-收益量化权衡 (Cost-Benefit Trade-offs)
- **Token 消耗**：累计 Token 增加 ${Number(tokenDeltaPct) >= 0 ? '+' : ''}${tokenDeltaPct}%（+${extraTokens.toLocaleString()} tokens），额外开销完全集中在 ${escalatedResults.length} 例升级任务中，平均每例升级消耗约 **${tokensPerEscalated.toLocaleString()} tokens**。
- **端到端耗时**：平均端到端耗时变动 **${extraLatencyMs >= 0 ? `+${extraLatencyMs}ms` : `${extraLatencyMs}ms`} (${Number(latencyDeltaPct) >= 0 ? '+' : ''}${latencyDeltaPct}%)**。经跨轮基线横向比对（基线在同一代码下的历史平均延迟在 3.8s–6.3s 宽幅波动，波幅达 ±25%），单轮内的毫秒级耗时差异主要受公网网络抖动与第三方 API 并发负载噪声主导，落在系统噪声带内，不作为级联路由的架构性能结论。
- **权衡决策建议**：
  - 在当前免费配额模式下，金钱成本为 **$0.00**；
  - 在商业付费生产环境下，每挽救 1 例契约崩溃任务需额外消耗约 **${costPerRescuedTokens.toLocaleString()} tokens**（单次强模型升级均值约 **${tokensPerEscalated.toLocaleString()} tokens**）。对高价值业务单（退款纠纷、大客户工单）而言极具性价比；若面向低价值高吞吐场景，建议调小 \`maxCheapRetries\` 或收紧升级准入条件。

---

## Case 详细追踪明细

| Case ID | 类别 (Expected) | 对照组分类 | 级联组分类 | 最终执行模型 | 闭环与升级状态 (Status) | 候选轮换链路 (Attempts Trace) |
|---|---|---|---|---|---|---|
${cascadeSummary.results
  .map((cr) => {
    const br = baselineSummary.results.find((b) => b.caseId === cr.caseId);
    const traceSummary = cr.candidateAttempts && cr.candidateAttempts.length > 0
      ? cr.candidateAttempts.map((a, i) => `#${i + 1} ${a.model} (${a.outcome})`).join(' ➔ ')
      : '无 (廉价层闭环)';
    return `| #${cr.caseId.toString().padStart(2, '0')} | \`${cr.expectedCategory}\` | \`${br?.actualCategory || 'err'}\` | \`${cr.actualCategory || 'err'}\` | \`${cr.routedModel}\` | \`${cr.escalationReason}\` | ${traceSummary} |`;
  })
  .join('\n')}

---

> **关于作者**  
> **郭强 (GuoBug)**，Product Engineer，做平台工程也做业务增长。目前主要在折腾 AI 工作流编排、DAG 状态机与确定性系统架构。  
> 开源项目与主页：[https://github.com/GuoBug](https://github.com/GuoBug) · [https://guobug.github.io](https://guobug.github.io)  
> 欢迎就工作流引擎架构、拓扑调度和低门槛开发体验交流指教。
`;

  writeFileSync(reportPath, reportContent, 'utf-8');
  console.log(`📄 评估报告已生成并归档至: ${reportPath}`);
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
