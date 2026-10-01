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
  CandidateAttemptRecord,
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
  'gemini-3.5-flash-lite': 0.05,
  'gemini-3.1-flash-lite': 0.05,
  'gemini-2.5-flash': 0.075,
  'gemini-2.5-flash-lite': 0.04,
  'gemini-2.0-flash': 0.075,
  'gemini-1.5-flash': 0.075,
  'gemini-flash-latest': 0.075,

  // Tier 2 (Strong / Heavy Reasoning)
  'gemini-3.8-flash': 0.15,
  'gemini-3.5-flash': 0.15,
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
// 2. Track 2: Generic Semantic Conflict Gate Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface SemanticConflictResult {
  hasConflict: boolean;
  conflictType?: string;
  reason?: string;
  suggestedAction?: string;
  suggestedCategory?: string;
  detectedTerms?: string[];
  detectedSymptomTerms?: string[];
  detectedActionTerms?: string[];
  directive?: string;
}

/**
 * Pluggable heuristic gate interface for detecting domain-specific semantic blind spots (e.g. F7).
 * "引擎认接口，preset 认业务" (Engine recognizes interfaces, preset owns domain logic).
 */
export interface ISemanticConflictGate {
  evaluate(userPrompt?: string, outputData?: unknown): SemanticConflictResult;
}

/**
 * @deprecated Use `detectTicketSemanticConflict` from `src/presets/ticket-semantic-gate.ts`.
 * Kept for backward compatibility with existing tests.
 */
export { detectTicketSemanticConflict as detectSemanticConflict } from '../presets/ticket-semantic-gate.ts';

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
  semanticConflictGate?: ISemanticConflictGate;
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
  candidateAttempts?: CandidateAttemptRecord[];
  candidateRotations?: number;
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
    const isSelfHealed = singleRes.totalAttempts > 1;
    const closureReason: ModelRoutingTriggerReason = !singleRes.success
      ? 'cheap_budget_exhausted'
      : isSelfHealed
        ? 'cheap_self_healing'
        : 'primary_default';
    return {
      ...singleRes,
      modelTier: 'tier1_cheap',
      routedModel: primaryModel,
      escalated: false,
      escalationReason: closureReason,
      cheapAttempts: singleRes.totalAttempts,
      strongAttempts: 0,
      candidateAttempts: [],
      candidateRotations: 0,
      costSavingsRatio: 0,
      routingTrace: [
        {
          round: 1,
          modelTier: 'tier1_cheap',
          model: primaryModel,
          reason: closureReason,
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
  let lastSemanticDirective: string | undefined = undefined;
  let hasSemanticConflict = false;
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

    let llmRes: LLMExecutionOutput;
    try {
      llmRes = await caller({
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
    } catch (callerErr: any) {
      logger.warn(
        'ModelRouter',
        `[Tier 1 调用异常] 经济模型调用失败: ${callerErr.message || callerErr}`,
      );
      lastRaw = '';
      lastErrors = [
        {
          path: 'root',
          message: `Cheap tier execution failed: ${callerErr.message || callerErr}`,
          code: 'CHEAP_CALLER_ERROR',
        },
      ];
      trace.push({
        round: cheapAttempts,
        rawOutput: '',
        syntaxValid: false,
        semanticValid: false,
        errors: lastErrors,
        finishReason: 'error',
        timestamp: Date.now(),
      });
      continue;
    }

    // Verify format and schema
    const parseResult = safeParseOutput(lastRaw, options.schema);

    if (parseResult.success) {
      // Contract passed on cheap tier!
      tier1Data = parseResult.data;

      // Track 2: Heuristic Semantic Conflict Check (via pluggable ISemanticConflictGate)
      const gate = options.semanticConflictGate;
      if (enableSemanticGate && gate) {
        const semanticCheck = gate.evaluate(options.userPrompt, tier1Data);
        if (semanticCheck.hasConflict) {
          logger.warn(
            'ModelRouter',
            `[Track 2 语义冲突门禁触发] ${semanticCheck.reason || 'Semantic conflict detected'} 契约虽通过但触发冲突门禁，立即触发向 Tier 2 强模型升级！`,
          );

          trace.push({
            round: cheapAttempts,
            rawOutput: lastRaw,
            syntaxValid: true,
            semanticValid: false,
            finishReason: lastFinishReason,
            feedbackPrompt: `[语义冲突触发升级] ${semanticCheck.reason || 'Semantic conflict'}`,
            timestamp: Date.now(),
          });

          hasSemanticConflict = true;
          lastSemanticDirective = semanticCheck.directive;
          lastErrors = [
            {
              path: 'category',
              message: semanticCheck.reason || 'Semantic precedence conflict detected',
              code: semanticCheck.conflictType || 'semantic_conflict_gate',
              expectedRule: '核心诉求优先权',
              suggestion: semanticCheck.suggestedAction,
            },
          ];
          break;
        }
      }

      // Safe closure on Tier 1!
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
        candidateAttempts: [],
        candidateRotations: 0,
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
    hasSemanticConflict
      ? 'semantic_conflict_gate'
      : 'cheap_budget_exhausted';

  const fallbackCandidates: string[] =
    routing.fallbackModels && routing.fallbackModels.length > 0
      ? routing.fallbackModels
      : [fallbackModel];

  logger.warn(
    'ModelRouter',
    `[触发模型级联升级 🚨] 经济模型预算耗尽或触发语义门禁 (原因: ${escalationReason})。立即升级至 Tier 2 强模型候选队列: [${fallbackCandidates.join(', ')}]！继承前序 ${cheapAttempts} 次自愈失败现场与诊断三元组...`,
  );

  options.onTierSwitch?.('tier1_cheap', 'tier2_strong', escalationReason);

  routingTrace.push({
    round: cheapAttempts + 1,
    modelTier: 'tier2_strong',
    model: fallbackCandidates[0] || fallbackModel,
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

  // If escalation was triggered by semantic conflict gate, prepend custom directive from gate!
  if (escalationReason === 'semantic_conflict_gate' && lastSemanticDirective) {
    userMsg.content = `${lastSemanticDirective}\n\n` + userMsg.content;
  }

  currentMessages = [...currentMessages, assistantMsg, userMsg];

  const candidateAttempts: CandidateAttemptRecord[] = [];
  let routedStrongModel = fallbackCandidates[0] || fallbackModel;
  let strongSuccess = false;
  let strongData: unknown = undefined;
  let lastStrongSyntaxValid = true;

  for (let candidateIdx = 0; candidateIdx < fallbackCandidates.length; candidateIdx++) {
    const candidateModel = fallbackCandidates[candidateIdx]!;
    routedStrongModel = candidateModel;
    strongAttempts++;
    const candStart = Date.now();

    try {
      if (candidateIdx > 0) {
        logger.warn(
          'ModelRouter',
          `[Tier 2 候选模型轮换触发 🔄] 切换至候选队列第 ${candidateIdx + 1} 位模型: "${candidateModel}"...`,
        );
        routingTrace.push({
          round: cheapAttempts + strongAttempts,
          modelTier: 'tier2_strong',
          model: candidateModel,
          reason: escalationReason,
          escalated: true,
          costSavingsRatio: 0,
          timestamp: Date.now(),
        });
      }

      const strongRes = await caller({
        targetModel: candidateModel,
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

      const strongParseResult = safeParseOutput(lastRaw, options.schema);
      if (strongParseResult.success) {
        strongSuccess = true;
        strongData = strongParseResult.data;
        candidateAttempts.push({
          model: candidateModel,
          attemptIndex: candidateIdx,
          outcome: 'ok',
          durationMs: Date.now() - candStart,
        });
        logger.summary(
          'ModelRouter',
          `[Tier 2 强模型成功闭合 ✅] 候选模型 "${candidateModel}" 继承前序诊断上下文后一次性修复成功！任务被成功救回。`,
        );
        break;
      } else {
        lastErrors = strongParseResult.errors || [];
        candidateAttempts.push({
          model: candidateModel,
          attemptIndex: candidateIdx,
          outcome: 'contract_fail',
          errorMessage: strongParseResult.errors?.[0]?.message || 'Schema validation failed',
          durationMs: Date.now() - candStart,
        });
        logger.warn(
          'ModelRouter',
          `[Tier 2 强模型返回契约未通过] 候选模型 "${candidateModel}" 输出未能满足 Schema，准备尝试队列后续模型或后置降级`,
        );
      }
    } catch (callerErr: any) {
      const errMsg = String(callerErr?.message || callerErr);
      let outcome: CandidateAttemptRecord['outcome'] = 'error';
      if (
        errMsg.includes('429') ||
        errMsg.toLowerCase().includes('resourceexhausted') ||
        errMsg.toLowerCase().includes('quota')
      ) {
        outcome = 'http_429';
      } else if (
        errMsg.includes('503') ||
        errMsg.toLowerCase().includes('unavailable') ||
        errMsg.toLowerCase().includes('high demand')
      ) {
        outcome = 'http_503';
      } else if (
        errMsg.toLowerCase().includes('timeout') ||
        errMsg.toLowerCase().includes('abort') ||
        errMsg.toLowerCase().includes('network') ||
        errMsg.toLowerCase().includes('econnreset') ||
        errMsg.toLowerCase().includes('fetch failed')
      ) {
        outcome = 'network';
      }

      candidateAttempts.push({
        model: candidateModel,
        attemptIndex: candidateIdx,
        outcome,
        errorMessage: errMsg,
        durationMs: Date.now() - candStart,
      });

      logger.warn(
        'ModelRouter',
        `[Tier 2 候选模型调用异常 (${outcome})] "${candidateModel}": ${errMsg}，启动队列顺延轮换`,
      );
      lastErrors = [
        {
          path: '',
          message: `Tier 2 model call failed for "${candidateModel}": ${errMsg}`,
          code: 'tier2_call_failure',
        },
      ];
    }
  }

  const candidateRotations = Math.max(0, candidateAttempts.length - 1);

  if (strongSuccess) {
    trace.push({
      round: cheapAttempts + strongAttempts,
      rawOutput: lastRaw,
      syntaxValid: true,
      semanticValid: true,
      finishReason: lastFinishReason,
      feedbackPrompt: `[强模型升级修复成功 / Tier 2 Escalation Healed: ${escalationReason} via ${routedStrongModel}]`,
      timestamp: Date.now(),
    });

    return {
      success: true,
      data: strongData,
      raw: lastRaw,
      modelTier: 'tier2_strong',
      routedModel: routedStrongModel,
      escalated: true,
      escalationReason,
      cheapAttempts,
      strongAttempts,
      candidateAttempts,
      candidateRotations,
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
      candidateAttempts,
      candidateRotations,
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

  logger.warn(
    'ModelRouter',
    `[级联全量耗尽] 经济模型与强模型均未能通过契约校验，输出优雅降级契约。`,
  );

  trace.push({
    round: cheapAttempts + strongAttempts,
    rawOutput: lastRaw,
    syntaxValid: lastStrongSyntaxValid,
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
    candidateAttempts,
    candidateRotations,
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

  let attempt = 0;
  let lastRaw = '';
  let lastErrors: StructuredOutputError[] = [];
  let lastFinishReason: string | undefined = undefined;
  const usage: TokenUsage = { prompt: 0, completion: 0, total: 0 };
  let lastReasoning: string | undefined = undefined;
  const trace: SelfHealingTraceStep[] = [];

  while (attempt <= maxRetries) {
    attempt++;
    try {
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
    } catch (err: any) {
      lastRaw = '';
      lastErrors = [
        {
          path: 'root',
          message: `Single tier execution failed: ${err.message || err}`,
          code: 'SINGLE_TIER_CALLER_ERROR',
        },
      ];
      trace.push({
        round: attempt,
        rawOutput: '',
        syntaxValid: false,
        semanticValid: false,
        errors: lastErrors,
        finishReason: 'error',
        timestamp: Date.now(),
      });
      continue;
    }

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
      const goldenExemplar = generateGoldenExemplar(options.schema);
      const { assistantMsg, userMsg } = buildErrorFeedbackMessages(
        lastRaw,
        lastErrors,
        parseResult.syntaxError,
        attempt - 1,
        {
          jsonSchema: negotiated.apiFormat?.json_schema?.schema as Record<string, unknown> | undefined,
          goldenExemplar,
        },
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
