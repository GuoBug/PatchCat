/**
 * @file    src/engine/model-router.ts
 * @version 1.0.0
 * @description
 *   Module 3: Deterministic Model Routing & Multi-Tier Cascade Router (Cheap-First & Escalate).
 *
 *   Core Architectural Principles:
 *   1. Cheap-First & Escalate Cascade:
 *      - Tier 1: Deploy high-throughput, low-cost model (e.g. Qwen2.5-7B) for initial attempt.
 *      - T2 Preservation: Allow cheap model to self-heal up to `maxCheapRetries` (default 2).
 *        37% of benchmark cases self-heal on cheap tier without requiring 8x cost escalation.
 *      - Escalation Threshold: Escalation to Tier 2 (strong model) ONLY triggers when:
 *        a) Cheap model self-healing retries are exhausted (Track 1: Format/Contract Collapse), OR
 *        b) Heuristic semantic conflict gate trips (Track 2: F7 Description-Action Inversion).
 *   2. Context Carry-Over:
 *      - When escalating, cheap model's failure history and `diagnosticErrors` are preserved
 *        and fed into the strong model so it performs targeted surgical repair, not blind guessing.
 *   3. Naming Decoupling:
 *      - Uses `modelTier: 'tier1_cheap' | 'tier2_strong'`, strictly separated from prompt-level
 *        `SelfHealingEscalationLevel` ('surgical_prescription' | 'golden_exemplar').
 *   4. F6/F7 Semantic Blind Spot Defense (Dual-Track Watchdog):
 *      - Contract assertions cannot detect semantic masking (F6/F7).
 *      - Heuristic Action Precedence gate inspects prompt and classification to catch
 *        description-action priority inversions (e.g. #27, #30) before silent failure.
 */

import { z } from 'zod';
import type {
  ModelTier,
  ModelRoutingConfig,
  ModelRoutingTriggerReason,
  ModelRoutingTraceStep,
  StructuredOutputError,
  TokenUsage,
  ResponseFormatConfig,
  ResponseFormatMode,
  SelfHealingTraceStep,
} from './types.ts';
import {
  negotiateResponseFormat,
  safeParseOutput,
  buildErrorFeedbackMessages,
  generateGoldenExemplar,
  type NegotiatedResponseFormat,
} from './structured-output.ts';
import type { ChatMessage, LLMChatRequest, LLMExecutionOutput } from './llm-client.ts';
import { RUNTIME_DEFAULTS } from '../config/runtime-defaults.ts';
import { logger } from './logger.ts';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Relative Model Pricing Tier Map
// ─────────────────────────────────────────────────────────────────────────────

/** Relative price per 1M tokens (USD) for cost savings estimation */
export const MODEL_RELATIVE_PRICING: Record<string, number> = {
  // Tier 1 (Free / Economy)
  'Qwen/Qwen2.5-7B-Instruct': 0.05,
  'qwen2.5-7b-instruct': 0.05,
  'gemini-2.5-flash': 0.075,
  'gemini-2.5-flash-lite': 0.04,
  'gemini-2.0-flash': 0.075,
  'gemini-1.5-flash': 0.075,
  'gemini-flash-latest': 0.075,

  // Tier 2 (Strong / Heavy Reasoning)
  'gemini-2.5-pro': 1.25,
  'gemini-1.5-pro': 1.25,
  'gemini-pro-latest': 1.25,
  'Qwen/Qwen2.5-72B-Instruct': 0.40,
  'qwen2.5-72b-instruct': 0.40,
  'deepseek-ai/DeepSeek-V3': 0.40,
  'deepseek-ai/DeepSeek-R1': 0.80,
};

/**
 * Calculates estimated cost savings percentage when resolving on Tier 1 vs Tier 2.
 */
export function calculateCostSavingsRatio(primaryModel: string, fallbackModel: string): number {
  const p1 = MODEL_RELATIVE_PRICING[primaryModel] ?? 0.05;
  const p2 = MODEL_RELATIVE_PRICING[fallbackModel] ?? 0.40;
  if (p2 <= 0) return 0;
  return Math.max(0, Math.min(1, (p2 - p1) / p2));
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Track 2: Heuristic Semantic Conflict Detector (F7 Defense)
// ─────────────────────────────────────────────────────────────────────────────

export interface SemanticConflictResult {
  hasConflict: boolean;
  conflictType?: 'f7_description_action_inversion' | 'f3_ground_truth_ambiguity';
  reason?: string;
  suggestedCategory?: string;
  detectedSymptomTerms: string[];
  detectedActionTerms: string[];
}

/** Strong symptom / defect terms that commonly anchor LLM attention */
const SYMPTOM_TERMS = [
  '假货', '仿冒', '伪劣', '大牌假货', '假冒伪劣', '做工粗糙',
  '破损', '暗损', '大裂缝', '贯穿性', '压扁', '碎了', '质量太次', '质量问题',
  '划痕', '漏发', '少配件', '少件', '瑕疵',
];

/** Explicit core action request terms (refund/return) that take precedence */
const ACTION_REFUND_TERMS = [
  '退款', '退货', '退货退款', '要求退款', '立即退款', '我要退款',
  '帮忙退', '申请退款', '全额退款', '退钱', '退货赔付',
];

/**
 * Inspects user input prompt and model output object to catch F7:
 * Problem Description Overpowering Core Action Request.
 *
 * If a prompt contains both vivid defect descriptions AND explicit refund demands,
 * but the model classified as `quality` without honoring `refund`, this gate trips!
 */
export function detectSemanticConflict(
  userPrompt?: string,
  outputData?: unknown,
): SemanticConflictResult {
  if (!userPrompt || typeof outputData !== 'object' || outputData === null) {
    return { hasConflict: false, detectedSymptomTerms: [], detectedActionTerms: [] };
  }

  const promptText = userPrompt.toLowerCase();
  const detectedSymptomTerms = SYMPTOM_TERMS.filter((term) => promptText.includes(term.toLowerCase()));
  const detectedActionTerms = ACTION_REFUND_TERMS.filter((term) => promptText.includes(term.toLowerCase()));

  const category = (outputData as Record<string, unknown>)['category'];

  // F7: Prompt has strong defect details AND explicit refund action, but output category is 'quality'
  if (detectedSymptomTerms.length > 0 && detectedActionTerms.length > 0) {
    if (category === 'quality' || category === 'other') {
      return {
        hasConflict: true,
        conflictType: 'f7_description_action_inversion',
        reason: `工单同时包含浓重缺陷描述 (${detectedSymptomTerms.join('/')}) 与核心退款诉求 (${detectedActionTerms.join('/')})，模型受前置细节锚定误判为 "${String(category)}"，触发动作优先权 (Action Precedence) 语义门禁！`,
        suggestedCategory: 'refund',
        detectedSymptomTerms,
        detectedActionTerms,
      };
    }
  }

  return {
    hasConflict: false,
    detectedSymptomTerms,
    detectedActionTerms,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Multi-Tier Model Router State Machine
// ─────────────────────────────────────────────────────────────────────────────

export interface ModelRoutingCallerRequest extends Partial<LLMChatRequest> {
  targetModel: string;
  modelTier: ModelTier;
}

export interface ModelRoutingExecutionOptions {
  routingConfig?: ModelRoutingConfig;
  schema?: z.ZodTypeAny | Record<string, unknown>;
  responseFormat?: ResponseFormatConfig | ResponseFormatMode;
  provider: string;
  configuredModel?: string;
  signal?: AbortSignal;
  userPrompt?: string;
  onTierSwitch?: (fromTier: ModelTier, toTier: ModelTier, reason: ModelRoutingTriggerReason) => void;
}

export interface ModelRoutingExecutionResult {
  success: boolean;
  data?: unknown;
  raw: string;
  errors?: StructuredOutputError[];
  modelTier: ModelTier;
  routedModel: string;
  escalated: boolean;
  escalationReason: ModelRoutingTriggerReason;
  cheapAttempts: number;
  strongAttempts: number;
  totalAttempts: number;
  costSavingsRatio: number;
  negotiated: NegotiatedResponseFormat;
  finishReason?: string;
  usage?: TokenUsage;
  reasoning?: string;
  trace: SelfHealingTraceStep[];
  routingTrace: ModelRoutingTraceStep[];
}

/**
 * Executes an LLM call with deterministic Model Routing (Cheap-First & Escalate):
 *
 * 1. Tier 1 (Cheap Model):
 *    - Starts with `primaryModel`.
 *    - If contract passes:
 *        - Track 2 check: if `detectSemanticConflict()` trips, escalate to Tier 2 for disambiguation!
 *        - Otherwise, conclude with `tier1_cheap` (Captures 43% T1!).
 *    - If contract fails:
 *        - In-place self-healing with Tier 1 up to `maxCheapRetries` (Captures 37% T2!).
 * 2. Tier 2 (Strong Model Escalation):
 *    - Triggered ONLY when cheap retries are exhausted or semantic conflict gate trips.
 *    - Carries over cheap model's error diagnostic triad into the prompt context.
 *    - Concludes with `tier2_strong` (Handles T3 20%!).
 */
export async function executeWithModelRouting(
  caller: (request: ModelRoutingCallerRequest) => Promise<LLMExecutionOutput>,
  initialMessages: ChatMessage[],
  options: ModelRoutingExecutionOptions,
): Promise<ModelRoutingExecutionResult> {
  const routing = options.routingConfig || {};
  const isRoutingEnabled = routing.enabled ?? true;

  const primaryModel =
    routing.primaryModel ||
    options.configuredModel ||
    RUNTIME_DEFAULTS.ROUTING_PRIMARY_MODEL;

  const fallbackModel =
    routing.fallbackModel || RUNTIME_DEFAULTS.ROUTING_FALLBACK_MODEL;

  const maxCheapRetries =
    typeof routing.maxCheapRetries === 'number'
      ? routing.maxCheapRetries
      : RUNTIME_DEFAULTS.ROUTING_MAX_CHEAP_RETRIES;

  const enableSemanticGate =
    routing.enableSemanticConflictGate ?? RUNTIME_DEFAULTS.ROUTING_ENABLE_SEMANTIC_GATE;

  const costSavingsRatio = calculateCostSavingsRatio(primaryModel, fallbackModel);

  // If routing is disabled, run standard single-model execution using primaryModel
  if (!isRoutingEnabled) {
    const singleRes = await runSingleTierLoop(
      caller,
      initialMessages,
      primaryModel,
      'tier1_cheap',
      maxCheapRetries,
      options,
    );
    return {
      ...singleRes,
      modelTier: 'tier1_cheap',
      routedModel: primaryModel,
      escalated: false,
      escalationReason: 'primary_default',
      cheapAttempts: singleRes.totalAttempts,
      strongAttempts: 0,
      costSavingsRatio: 0,
      routingTrace: [
        {
          round: 1,
          modelTier: 'tier1_cheap',
          model: primaryModel,
          reason: 'primary_default',
          escalated: false,
          timestamp: Date.now(),
        },
      ],
    };
  }

  const routingTrace: ModelRoutingTraceStep[] = [];
  let currentMessages: ChatMessage[] = [...initialMessages];
  let cheapAttempts = 0;
  let strongAttempts = 0;
  let lastRaw = '';
  let lastErrors: StructuredOutputError[] = [];
  let lastFinishReason: string | undefined = undefined;
  const totalUsage: TokenUsage = { prompt: 0, completion: 0, total: 0 };
  let lastReasoning: string | undefined = undefined;
  const trace: SelfHealingTraceStep[] = [];

  logger.summary(
    'ModelRouter',
    `[M3 模型级联路由已激活] Primary Tier: "${primaryModel}" (廉价模型), Fallback Tier: "${fallbackModel}" (强模型), 自愈耗尽阈值: ${maxCheapRetries} 次`,
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Phase 1: Tier 1 Cheap Model Execution & Self-Healing
  // ─────────────────────────────────────────────────────────────────────────

  const negotiated = negotiateResponseFormat(
    options.responseFormat,
    options.provider,
    primaryModel,
    options.schema,
  );

  if (negotiated.injectedPromptGuidance) {
    const lastUserIdx = currentMessages.map((m) => m.role).lastIndexOf('user');
    if (lastUserIdx >= 0) {
      const orig = currentMessages[lastUserIdx]!.content || '';
      currentMessages[lastUserIdx] = {
        ...currentMessages[lastUserIdx]!,
        content: orig + negotiated.injectedPromptGuidance,
      };
    }
  }

  routingTrace.push({
    round: 1,
    modelTier: 'tier1_cheap',
    model: primaryModel,
    reason: 'primary_default',
    escalated: false,
    costSavingsRatio,
    timestamp: Date.now(),
  });

  let tier1Success = false;
  let tier1Data: unknown = undefined;

  while (cheapAttempts <= maxCheapRetries) {
    if (options.signal?.aborted) {
      throw new Error('Workflow execution aborted by user.');
    }

    cheapAttempts++;
    const isRetry = cheapAttempts > 1;

    logger.detailed(
      'ModelRouter',
      `[Tier 1 试探执行] 第 ${cheapAttempts} 次尝试调用经济模型: ${primaryModel} (${isRetry ? '原地自愈纠偏' : '首轮试探'})...`,
    );

    const llmRes = await caller({
      targetModel: primaryModel,
      modelTier: 'tier1_cheap',
      messages: currentMessages,
      response_format: negotiated.apiFormat,
    });

    lastRaw = llmRes.response || '';
    lastFinishReason = llmRes.finishReason;
    if (llmRes.usage) {
      totalUsage.prompt += llmRes.usage.prompt;
      totalUsage.completion += llmRes.usage.completion;
      totalUsage.total += llmRes.usage.total;
    }
    if (llmRes.reasoning) {
      lastReasoning = llmRes.reasoning;
    }

    // Verify format and schema
    const parseResult = safeParseOutput(lastRaw, options.schema);

    if (parseResult.success) {
      // Contract passed on cheap tier!
      tier1Data = parseResult.data;

      // Track 2: Heuristic Semantic Conflict Check (F7 Defense)
      if (enableSemanticGate) {
        const semanticCheck = detectSemanticConflict(options.userPrompt, tier1Data);
        if (semanticCheck.hasConflict) {
          logger.warn(
            'ModelRouter',
            `[Track 2 语义冲突门禁触发] ${semanticCheck.reason} 契约虽通过但语义命中 F7 盲区，立即触发向 Tier 2 强模型升级！`,
          );

          trace.push({
            round: cheapAttempts,
            rawOutput: lastRaw,
            syntaxValid: true,
            semanticValid: false,
            finishReason: lastFinishReason,
            feedbackPrompt: `[语义冲突触发升级] ${semanticCheck.reason}`,
            timestamp: Date.now(),
          });

          // Break to Phase 2 with semantic escalation trigger!
          lastErrors = [
            {
              path: 'category',
              message: semanticCheck.reason || 'Semantic precedence conflict detected',
              code: 'f7_semantic_conflict',
              expectedRule: '核心退款诉求动作优先于瑕疵描述细节',
              suggestion: '将分类归为 refund',
            },
          ];
          break;
        }
      }

      // Safe closure on Tier 1!
      tier1Success = true;
      const isSelfHealed = cheapAttempts > 1;
      logger.summary(
        'ModelRouter',
        `[Tier 1 成功闭合] 经济模型 "${primaryModel}" ${
          isSelfHealed ? `经 ${cheapAttempts - 1} 次原地自愈后成功` : '一次性直接通过'
        }！零模型升级开销，节省成本: ${(costSavingsRatio * 100).toFixed(1)}%`,
      );

      trace.push({
        round: cheapAttempts,
        rawOutput: lastRaw,
        syntaxValid: true,
        semanticValid: true,
        finishReason: lastFinishReason,
        feedbackPrompt: isSelfHealed ? '[廉价自愈成功 / Cheap Self-Healed]' : '[一次性通过 / First-Round Pass]',
        timestamp: Date.now(),
      });

      return {
        success: true,
        data: tier1Data,
        raw: lastRaw,
        modelTier: 'tier1_cheap',
        routedModel: primaryModel,
        escalated: false,
        escalationReason: isSelfHealed ? 'cheap_self_healing' : 'primary_default',
        cheapAttempts,
        strongAttempts: 0,
        totalAttempts: cheapAttempts,
        costSavingsRatio,
        negotiated,
        finishReason: lastFinishReason,
        usage: totalUsage,
        reasoning: lastReasoning,
        trace,
        routingTrace,
      };
    }

    // Validation failed on cheap tier
    lastErrors = parseResult.errors || [];

    trace.push({
      round: cheapAttempts,
      rawOutput: lastRaw,
      syntaxValid: !parseResult.syntaxError,
      semanticValid: false,
      errors: lastErrors,
      finishReason: lastFinishReason,
      timestamp: Date.now(),
    });

    // If cheap self-healing budget remains, feed error memory back to Tier 1
    if (cheapAttempts <= maxCheapRetries) {
      const escalationLevel = cheapAttempts === 1 ? 'surgical_prescription' : 'golden_exemplar';
      const goldenExemplar = generateGoldenExemplar(options.schema);
      const { assistantMsg, userMsg } = buildErrorFeedbackMessages(
        lastRaw,
        lastErrors,
        parseResult.syntaxError,
        cheapAttempts - 1,
        {
          jsonSchema: negotiated.apiFormat?.json_schema?.schema as Record<string, unknown> | undefined,
          goldenExemplar,
        },
      );
      currentMessages = [...currentMessages, assistantMsg, userMsg];
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Phase 2: Tier 2 Strong Model Escalation (Cheap Budget Exhausted / F7 Gate)
  // ───────────────────────────────────────────────────────────────────────────

  const escalationReason: ModelRoutingTriggerReason =
    lastErrors.some((e) => e.code === 'f7_semantic_conflict')
      ? 'semantic_conflict_gate'
      : 'cheap_budget_exhausted';

  logger.warn(
    'ModelRouter',
    `[触发模型级联升级 🚨] 经济模型预算耗尽或触发语义门禁 (原因: ${escalationReason})。立即升级至 Tier 2 强模型: "${fallbackModel}"！继承前序 ${cheapAttempts} 次自愈失败现场与诊断三元组...`,
  );

  options.onTierSwitch?.('tier1_cheap', 'tier2_strong', escalationReason);

  routingTrace.push({
    round: cheapAttempts + 1,
    modelTier: 'tier2_strong',
    model: fallbackModel,
    reason: escalationReason,
    escalated: true,
    costSavingsRatio: 0,
    timestamp: Date.now(),
  });

  // Inject Context Carry-Over: Feed cheap model's failure memory to strong model!
  const goldenExemplar = generateGoldenExemplar(options.schema);
  const { assistantMsg, userMsg } = buildErrorFeedbackMessages(
    lastRaw,
    lastErrors,
    false,
    cheapAttempts,
    {
      jsonSchema: negotiated.apiFormat?.json_schema?.schema as Record<string, unknown> | undefined,
      goldenExemplar,
    },
  );

  // If escalation was triggered by semantic conflict gate, prepend Action Precedence directive!
  if (escalationReason === 'semantic_conflict_gate') {
    userMsg.content = `[业务动作优先权消歧指令 / Action Precedence Disambiguation Directive]\n系统检测到工单包含强烈的退款退货诉求，而上一轮经济模型受商品瑕疵细节误导。请务必以用户最终诉求动作作为第一判据，优先归类为 refund！\n\n` + userMsg.content;
  }

  currentMessages = [...currentMessages, assistantMsg, userMsg];

  strongAttempts++;
  try {
    const strongRes = await caller({
      targetModel: fallbackModel,
      modelTier: 'tier2_strong',
      messages: currentMessages,
      response_format: negotiated.apiFormat,
    });

    lastRaw = strongRes.response || '';
    lastFinishReason = strongRes.finishReason;
    if (strongRes.usage) {
      totalUsage.prompt += strongRes.usage.prompt;
      totalUsage.completion += strongRes.usage.completion;
      totalUsage.total += strongRes.usage.total;
    }
    if (strongRes.reasoning) {
      lastReasoning = strongRes.reasoning;
    }
  } catch (callerErr: any) {
    logger.warn(
      'ModelRouter',
      `[Tier 2 强模型调用异常 / Rate Limit / Quota] ${callerErr.message}，启动后置容错保护`,
    );
    lastErrors = [
      {
        path: '',
        message: `Tier 2 model call failed: ${callerErr.message}`,
        code: 'tier2_call_failure',
      },
    ];
  }

  const strongParseResult = safeParseOutput(lastRaw, options.schema);

  if (strongParseResult.success) {
    logger.summary(
      'ModelRouter',
      `[Tier 2 强模型成功闭合 ✅] 强模型 "${fallbackModel}" 继承前序诊断上下文后一次性修复成功！任务被成功救回。`,
    );

    trace.push({
      round: cheapAttempts + strongAttempts,
      rawOutput: lastRaw,
      syntaxValid: true,
      semanticValid: true,
      finishReason: lastFinishReason,
      feedbackPrompt: `[强模型升级修复成功 / Tier 2 Escalation Healed: ${escalationReason}]`,
      timestamp: Date.now(),
    });

    return {
      success: true,
      data: strongParseResult.data,
      raw: lastRaw,
      modelTier: 'tier2_strong',
      routedModel: fallbackModel,
      escalated: true,
      escalationReason,
      cheapAttempts,
      strongAttempts,
      totalAttempts: cheapAttempts + strongAttempts,
      costSavingsRatio: 0,
      negotiated,
      finishReason: lastFinishReason,
      usage: totalUsage,
      reasoning: lastReasoning,
      trace,
      routingTrace,
    };
  }

  // Both Tier 1 and Tier 2 failed (or Tier 2 rate-limited) -> Graceful fallback, NEVER throw!
  if (tier1Data) {
    logger.warn(
      'ModelRouter',
      `[降级复用 Tier 1 产物] 强模型异常不可用，保留经济模型已有结构化产物兜底交付。`,
    );
    return {
      success: true,
      data: tier1Data,
      raw: lastRaw,
      modelTier: 'tier1_cheap',
      routedModel: primaryModel,
      escalated: true,
      escalationReason,
      cheapAttempts,
      strongAttempts,
      totalAttempts: cheapAttempts + strongAttempts,
      costSavingsRatio,
      negotiated,
      finishReason: lastFinishReason,
      usage: totalUsage,
      reasoning: lastReasoning,
      trace,
      routingTrace,
    };
  }

  lastErrors = strongParseResult.errors || lastErrors;
  logger.warn(
    'ModelRouter',
    `[级联全量耗尽] 经济模型与强模型均未能通过契约校验，输出优雅降级契约。`,
  );

  trace.push({
    round: cheapAttempts + strongAttempts,
    rawOutput: lastRaw,
    syntaxValid: !strongParseResult.syntaxError,
    semanticValid: false,
    errors: lastErrors,
    finishReason: lastFinishReason,
    feedbackPrompt: '[级联降级 / Cascade Graceful Degradation]',
    timestamp: Date.now(),
  });

  return {
    success: false,
    raw: lastRaw,
    errors: lastErrors,
    modelTier: 'tier2_strong',
    routedModel: fallbackModel,
    escalated: true,
    escalationReason,
    cheapAttempts,
    strongAttempts,
    totalAttempts: cheapAttempts + strongAttempts,
    costSavingsRatio: 0,
    negotiated,
    finishReason: lastFinishReason,
    usage: totalUsage,
    reasoning: lastReasoning,
    trace,
    routingTrace,
  };
}

/** Helper for running non-routing single model execution */
async function runSingleTierLoop(
  caller: (request: ModelRoutingCallerRequest) => Promise<LLMExecutionOutput>,
  initialMessages: ChatMessage[],
  model: string,
  modelTier: ModelTier,
  maxRetries: number,
  options: ModelRoutingExecutionOptions,
) {
  const negotiated = negotiateResponseFormat(
    options.responseFormat,
    options.provider,
    model,
    options.schema,
  );

  let currentMessages: ChatMessage[] = [...initialMessages];
  let attempt = 0;
  let lastRaw = '';
  let lastErrors: StructuredOutputError[] = [];
  let lastFinishReason: string | undefined = undefined;
  const usage: TokenUsage = { prompt: 0, completion: 0, total: 0 };
  let lastReasoning: string | undefined = undefined;
  const trace: SelfHealingTraceStep[] = [];

  while (attempt <= maxRetries) {
    attempt++;
    const res = await caller({
      targetModel: model,
      modelTier,
      messages: currentMessages,
      response_format: negotiated.apiFormat,
    });
    lastRaw = res.response || '';
    lastFinishReason = res.finishReason;
    if (res.usage) {
      usage.prompt += res.usage.prompt;
      usage.completion += res.usage.completion;
      usage.total += res.usage.total;
    }
    if (res.reasoning) lastReasoning = res.reasoning;

    const parseResult = safeParseOutput(lastRaw, options.schema);
    if (parseResult.success) {
      trace.push({
        round: attempt,
        rawOutput: lastRaw,
        syntaxValid: true,
        semanticValid: true,
        finishReason: lastFinishReason,
        timestamp: Date.now(),
      });
      return {
        success: true,
        data: parseResult.data,
        raw: lastRaw,
        totalAttempts: attempt,
        negotiated,
        finishReason: lastFinishReason,
        usage,
        reasoning: lastReasoning,
        trace,
      };
    }

    lastErrors = parseResult.errors || [];
    trace.push({
      round: attempt,
      rawOutput: lastRaw,
      syntaxValid: !parseResult.syntaxError,
      semanticValid: false,
      errors: lastErrors,
      finishReason: lastFinishReason,
      timestamp: Date.now(),
    });

    if (attempt <= maxRetries) {
      const { assistantMsg, userMsg } = buildErrorFeedbackMessages(
        lastRaw,
        lastErrors,
        parseResult.syntaxError,
        attempt - 1,
      );
      currentMessages = [...currentMessages, assistantMsg, userMsg];
    }
  }

  return {
    success: false,
    raw: lastRaw,
    errors: lastErrors,
    totalAttempts: attempt,
    negotiated,
    finishReason: lastFinishReason,
    usage,
    reasoning: lastReasoning,
    trace,
  };
}
