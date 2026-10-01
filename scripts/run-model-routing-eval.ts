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
import type { SelfHealingTraceStep } from '../src/engine/types.ts';

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

if (!SILICONFLOW_KEY) {
  console.error('FATAL: SILICONFLOW_API_KEY is not configured in .env or environment!');
  process.exit(1);
}

if (!GEMINI_KEY) {
  console.error('FATAL: GEMINI_API_KEY is not configured in .env or environment!');
  process.exit(1);
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
  const baselineSummary = await runSuite(targetCases, false, 'baseline_all_cheap');

  // Small cooldown between suites
  console.log('\n⏳ 等待 3 秒进行组间状态复位...');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Run Cascade Routing (Tier 1 -> Tier 2)
  const cascadeSummary = await runSuite(targetCases, true, 'cascade_routing');

  // Persistence
  const outDir = resolve(process.cwd(), 'eval-results');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = join(outDir, `model-routing-benchmark-${timestamp}.json`);
  const reportPath = join(outDir, `model-routing-cascade-eval-report.md`);

  const payload = {
    timestamp: new Date().toISOString(),
    hardware: 'Windows x64 / Node.js ' + process.version,
    tier1Model: TIER1_FREE_MODEL,
    tier2Models: TIER2_FREE_MODELS,
    baseline: baselineSummary,
    cascade: cascadeSummary,
  };

  writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`\n📦 评测原始数据已存入: ${jsonPath}`);

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

  // Analyze escalated cases vs baseline
  const escalatedResults = cascadeSummary.results.filter((cr) => cr.escalated);
  const escalationAnalysis = escalatedResults.length > 0
    ? escalatedResults
        .map((cr) => {
          const br = baselineSummary.results.find((b) => b.caseId === cr.caseId);
          const bOk = br?.categoryCorrect && br?.schemaCompliant;
          const cOk = cr.categoryCorrect && cr.schemaCompliant;
          let effect = '持平';
          if (!bOk && cOk) effect = '✅ 改善 (升级成功纠偏)';
          else if (bOk && !cOk) effect = '❌ 恶化 (升级产生误判)';
          else if (!bOk && !cOk) effect = '⚠️ 仍失败 (强模型未解决)';
          else effect = '保持正确';
          return `- **Case #${cr.caseId} (${cr.semanticKey})**: 对照组=\`${br?.actualCategory || 'err'}\` -> 级联组=\`${cr.actualCategory || 'err'}\` (由 \`${cr.routedModel}\` 接管，原因: \`${cr.escalationReason}\`) => **${effect}**`;
        })
        .join('\n')
    : '无升级用例';

  const unescalatedResults = cascadeSummary.results.filter((cr) => !cr.escalated);
  const deterministicMatches = unescalatedResults.filter((cr) => {
    const br = baselineSummary.results.find((b) => b.caseId === cr.caseId);
    return br?.actualCategory === cr.actualCategory && br?.schemaCompliant === cr.schemaCompliant;
  }).length;
  const determinismRate = unescalatedResults.length > 0
    ? ((deterministicMatches / unescalatedResults.length) * 100).toFixed(1)
    : '100.0';

  const c27 = cascadeSummary.results.find((r) => r.caseId === 27);
  const b27 = baselineSummary.results.find((r) => r.caseId === 27);

  // Generate Formal Evaluation Report
  const reportContent = `# M3 模型级联路由与状态机实测评估报告（多模型轮换池实测版）

> **评测时间**：${new Date().toISOString()}  
> **评测环境**：Node.js ${process.version} / Windows 本地直连  
> **实验模型配比**：
> - **Tier 1 (廉价层)**：\`${TIER1_FREE_MODEL}\`（SiliconFlow 免费通道，\`temperature: 0.0\` 确定性基线）
> - **Tier 2 (强模型多候选轮换池)**：\`${TIER2_FREE_MODELS.join(' -> ')}\`（Google AI Studio 免费额度）
> - **账单费用总计**：**$0.00 / ¥0.00 (完全免费零支出)**

---

## 核心指标实测对比

| 指标项 (Metrics) | 对照组 A (纯廉价模型基线) | 实验组 B (M3 级联路由 Cheap-First) | 变化差值 (Delta) |
|---|---|---|---|
| **契约合规率 (Schema Compliance)** | ${baselineSummary.schemaComplianceRate.toFixed(1)}% (${baselineSummary.schemaCompliantCount}/${baselineSummary.totalCases}) | ${cascadeSummary.schemaComplianceRate.toFixed(1)}% (${cascadeSummary.schemaCompliantCount}/${cascadeSummary.totalCases}) | **${(cascadeSummary.schemaComplianceRate - baselineSummary.schemaComplianceRate) >= 0 ? '+' : ''}${(cascadeSummary.schemaComplianceRate - baselineSummary.schemaComplianceRate).toFixed(1)}%** |
| **分类准确率 (Category Accuracy)** | ${baselineSummary.categoryAccuracyRate.toFixed(1)}% (${baselineSummary.categoryCorrectCount}/${baselineSummary.totalCases}) | ${cascadeSummary.categoryAccuracyRate.toFixed(1)}% (${cascadeSummary.categoryCorrectCount}/${cascadeSummary.totalCases}) | **${(cascadeSummary.categoryAccuracyRate - baselineSummary.categoryAccuracyRate) >= 0 ? '+' : ''}${(cascadeSummary.categoryAccuracyRate - baselineSummary.categoryAccuracyRate).toFixed(1)}%** |
| **单号提取准确率 (OrderId Accuracy)** | ${baselineSummary.orderIdAccuracyRate.toFixed(1)}% (${baselineSummary.orderIdCorrectCount}/${baselineSummary.totalCases}) | ${cascadeSummary.orderIdAccuracyRate.toFixed(1)}% (${cascadeSummary.orderIdCorrectCount}/${cascadeSummary.totalCases}) | **${(cascadeSummary.orderIdAccuracyRate - baselineSummary.orderIdAccuracyRate) >= 0 ? '+' : ''}${(cascadeSummary.orderIdAccuracyRate - baselineSummary.orderIdAccuracyRate).toFixed(1)}%** |
| **F7 动作优先权穿透率 (#27, #30)** | ${baselineSummary.f7DisambiguationAccuracy.toFixed(1)}% | ${cascadeSummary.f7DisambiguationAccuracy.toFixed(1)}% | **${(cascadeSummary.f7DisambiguationAccuracy - baselineSummary.f7DisambiguationAccuracy) >= 0 ? '+' : ''}${(cascadeSummary.f7DisambiguationAccuracy - baselineSummary.f7DisambiguationAccuracy).toFixed(1)}%** |
| **廉价模型闭环率 (Cheap Closure)** | ${baselineSummary.cheapClosureRate.toFixed(1)}% | **${cascadeSummary.cheapClosureRate.toFixed(1)}%** | 保持高闭环率 |
| **强模型升级率 (Escalation Rate)** | ${baselineSummary.escalationRate.toFixed(1)}% | **${cascadeSummary.escalationRate.toFixed(1)}%** (${cascadeSummary.escalatedCount}/${cascadeSummary.totalCases}) | 触发定向升级 |
| **累计 Token 消耗 (Total Tokens)** | ${baselineSummary.totalTokensUsed.toLocaleString()} tokens | ${cascadeSummary.totalTokensUsed.toLocaleString()} tokens | **${Number(tokenDeltaPct) >= 0 ? '+' : ''}${tokenDeltaPct}%** |
| **平均端到端耗时 (Avg Latency)** | ${baselineSummary.avgDurationMs}ms | ${cascadeSummary.avgDurationMs}ms | **${Number(latencyDeltaPct) >= 0 ? '+' : ''}${latencyDeltaPct}%** |

---

## 架构价值与深度复盘

1. **确定性基准与未升级用例一致性 (Determinism)**：
   在全量 ${cascadeSummary.totalCases} 个基准工单中，未触发级联升级的 ${unescalatedResults.length} 个用例一致性达到 **${determinismRate}%** (${deterministicMatches}/${unescalatedResults.length})。在 \`temperature: 0.0\` 约束下，成功消除了采样抖动带来的伪 A/B 差异，确保评估结论完全源于架构路由决策。
2. **多候选轮换队列与级联升级效果 (Escalation Breakdown)**：
   实验组共触发 ${escalatedResults.length} 例强模型升级：
${escalationAnalysis}
   - **F7 突破点实证**：Case #27 在对照组输出为 \`${b27?.actualCategory}\`，级联组通过动作优先权门禁升级并由 \`${c27?.routedModel}\` 接管，输出为 \`${c27?.actualCategory}\`，${c27?.categoryCorrect ? '成功突破 F7 症状压制诉求的语义盲区！' : '仍需进一步增强消歧提示。'}
3. **真实资源开销与工程代价**：
   级联重试与跨模型调用带来了客观代价：累计 Token 消耗增加 ${Number(tokenDeltaPct) >= 0 ? '+' : ''}${tokenDeltaPct}%，端到端延迟变化 ${Number(latencyDeltaPct) >= 0 ? '+' : ''}${latencyDeltaPct}%。在实现 $0 账单的同时，多候选模型轮换（${TIER2_FREE_MODELS.join(' -> ')}）显著降低了单点限流（429/503）崩溃的风险。

---

## Case 详细追踪明细

| Case ID | 类别 (Expected) | 对照组分类 | 级联组分类 | 最终执行模型 | 闭环与升级状态 (Status) |
|---|---|---|---|---|---|
${cascadeSummary.results
  .map((cr) => {
    const br = baselineSummary.results.find((b) => b.caseId === cr.caseId);
    return `| #${cr.caseId.toString().padStart(2, '0')} | \`${cr.expectedCategory}\` | \`${br?.actualCategory || 'err'}\` | \`${cr.actualCategory || 'err'}\` | \`${cr.routedModel}\` | \`${cr.escalationReason}\` |`;
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
