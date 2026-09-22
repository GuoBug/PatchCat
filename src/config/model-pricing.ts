/**
 * @file    src/config/model-pricing.ts
 * @version 1.0.0
 * @description
 *   Static, zero-network token pricing table and cost estimation engine for PatchCat.
 *   Provides transparent billing estimation for Gemini, DeepSeek, OpenAI, SiliconFlow,
 *   and local Ollama models without external API dependencies.
 */

import type { TokenUsage } from '../engine/types.ts';

export interface ModelPricingRule {
  /** Cost per 1,000,000 prompt/input tokens in USD. */
  promptPer1M: number;
  /** Cost per 1,000,000 completion/output tokens in USD. */
  completionPer1M: number;
}

/**
 * Standard public pricing table (USD per 1M tokens).
 * Last updated: September 2026.
 */
export const MODEL_PRICING_TABLE: Record<string, ModelPricingRule> = {
  // ── Google Gemini ────────────────────────────────────────────────────────
  'gemini-2.5-flash': { promptPer1M: 0.075, completionPer1M: 0.30 },
  'gemini-2.5-pro': { promptPer1M: 1.25, completionPer1M: 5.00 },
  'gemini-2.0-flash': { promptPer1M: 0.10, completionPer1M: 0.40 },
  'gemini-1.5-flash': { promptPer1M: 0.075, completionPer1M: 0.30 },
  'gemini-1.5-pro': { promptPer1M: 1.25, completionPer1M: 5.00 },

  // ── DeepSeek ─────────────────────────────────────────────────────────────
  'deepseek-chat': { promptPer1M: 0.14, completionPer1M: 0.28 },
  'deepseek-v3': { promptPer1M: 0.14, completionPer1M: 0.28 },
  'deepseek-reasoner': { promptPer1M: 0.55, completionPer1M: 2.19 },
  'deepseek-r1': { promptPer1M: 0.55, completionPer1M: 2.19 },

  // ── OpenAI ───────────────────────────────────────────────────────────────
  'gpt-4o': { promptPer1M: 2.50, completionPer1M: 10.00 },
  'gpt-4o-mini': { promptPer1M: 0.15, completionPer1M: 0.60 },
  'o1': { promptPer1M: 15.00, completionPer1M: 60.00 },
  'o1-mini': { promptPer1M: 3.00, completionPer1M: 12.00 },
  'o3-mini': { promptPer1M: 1.10, completionPer1M: 4.40 },
  'gpt-4-turbo': { promptPer1M: 10.00, completionPer1M: 30.00 },
  'gpt-3.5-turbo': { promptPer1M: 0.50, completionPer1M: 1.50 },

  // ── SiliconFlow Hosted Open Source ───────────────────────────────────────
  'deepseek-ai/deepseek-v3': { promptPer1M: 0.28, completionPer1M: 0.56 },
  'deepseek-ai/deepseek-r1': { promptPer1M: 0.55, completionPer1M: 2.19 },
  'qwen/qwen2.5-72b-instruct': { promptPer1M: 0.40, completionPer1M: 0.80 },
  'qwen/qwen2.5-32b-instruct': { promptPer1M: 0.18, completionPer1M: 0.36 },
  'qwen/qwen2.5-7b-instruct': { promptPer1M: 0.05, completionPer1M: 0.10 },
  'meta-llama/meta-llama-3.1-70b-instruct': { promptPer1M: 0.40, completionPer1M: 0.80 },
  'meta-llama/meta-llama-3.1-8b-instruct': { promptPer1M: 0.05, completionPer1M: 0.10 },

  // ── Local Ollama (Always 100% Free) ──────────────────────────────────────
  'ollama': { promptPer1M: 0.0, completionPer1M: 0.0 },
};

/**
 * Fallback baseline pricing applied when a custom or unrecognized model is used.
 */
export const DEFAULT_FALLBACK_PRICING: ModelPricingRule = {
  promptPer1M: 0.15,
  completionPer1M: 0.60,
};

/**
 * Resolves the matching pricing rule for a given model string identifier.
 */
export function resolveModelPricing(modelName: string): ModelPricingRule {
  if (!modelName || typeof modelName !== 'string') {
    return DEFAULT_FALLBACK_PRICING;
  }

  const normalized = modelName.trim().toLowerCase();

  // Ollama or local check
  if (normalized.includes('ollama') || normalized.startsWith('local/')) {
    return MODEL_PRICING_TABLE['ollama'] || DEFAULT_FALLBACK_PRICING;
  }

  // Exact match
  if (MODEL_PRICING_TABLE[normalized]) {
    return MODEL_PRICING_TABLE[normalized]!;
  }

  // Fuzzy match by key containment
  for (const [key, rule] of Object.entries(MODEL_PRICING_TABLE)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return rule;
    }
  }

  return DEFAULT_FALLBACK_PRICING;
}

export const getModelPricing = resolveModelPricing;

/**
 * Estimates the token cost in USD based on model pricing rules.
 * Supports both `(modelName, tokenUsage)` and `(tokenUsage, modelName)`.
 *
 * Formula:
 *   Cost = (PromptTokens * promptPer1M / 1,000,000) + (CompletionTokens * completionPer1M / 1,000,000)
 */
export function estimateTokenCostUSD(
  arg1: string | TokenUsage,
  arg2?: string | TokenUsage
): number {
  let modelName = '';
  let tokenUsage: TokenUsage | undefined = undefined;

  if (typeof arg1 === 'string') {
    modelName = arg1;
    if (arg2 && typeof arg2 === 'object') {
      tokenUsage = arg2 as TokenUsage;
    }
  } else if (typeof arg1 === 'object') {
    tokenUsage = arg1 as TokenUsage;
    if (typeof arg2 === 'string') {
      modelName = arg2;
    }
  }

  if (!tokenUsage || !modelName) {
    return 0;
  }

  const promptTokens = Math.max(
    0,
    tokenUsage.prompt ?? (tokenUsage as unknown as { promptTokens?: number }).promptTokens ?? 0
  );
  const completionTokens = Math.max(
    0,
    tokenUsage.completion ?? (tokenUsage as unknown as { completionTokens?: number }).completionTokens ?? 0
  );

  if (promptTokens === 0 && completionTokens === 0) {
    return 0;
  }

  const rule = resolveModelPricing(modelName);
  if (rule.promptPer1M === 0 && rule.completionPer1M === 0) {
    return 0;
  }

  const cost =
    (promptTokens * rule.promptPer1M) / 1_000_000 +
    (completionTokens * rule.completionPer1M) / 1_000_000;

  // Round to 6 decimal places to prevent floating point inaccuracies
  return Math.round(cost * 1_000_000) / 1_000_000;
}

