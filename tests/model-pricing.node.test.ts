/**
 * @file    tests/model-pricing.node.test.ts
 * @description
 *   Unit test suite for PatchCat v0.4.8 token pricing rules, fuzzy resolution,
 *   and cost calculation engine.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveModelPricing,
  estimateTokenCostUSD,
  MODEL_PRICING_TABLE,
  DEFAULT_FALLBACK_PRICING,
} from '../src/config/model-pricing.ts';

describe('v0.4.8 Model Pricing & Token Cost Estimation Suite', () => {
  it('should accurately resolve exact pricing for known cloud providers', () => {
    const geminiFlash = resolveModelPricing('gemini-2.5-flash');
    assert.equal(geminiFlash.promptPer1M, 0.075);
    assert.equal(geminiFlash.completionPer1M, 0.30);

    const deepseekV3 = resolveModelPricing('deepseek-v3');
    assert.equal(deepseekV3.promptPer1M, 0.14);
    assert.equal(deepseekV3.completionPer1M, 0.28);

    const gpt4o = resolveModelPricing('gpt-4o');
    assert.equal(gpt4o.promptPer1M, 2.50);
    assert.equal(gpt4o.completionPer1M, 10.00);
  });

  it('should support case-insensitive and whitespace-tolerant resolution', () => {
    const rule = resolveModelPricing('  DeepSeek-Chat  ');
    assert.equal(rule.promptPer1M, 0.14);
    assert.equal(rule.completionPer1M, 0.28);
  });

  it('should resolve local Ollama models as strictly $0.00 (free)', () => {
    const ollamaRule = resolveModelPricing('ollama/llama3.2');
    assert.equal(ollamaRule.promptPer1M, 0.0);
    assert.equal(ollamaRule.completionPer1M, 0.0);

    const cost = estimateTokenCostUSD('ollama/qwen2.5', {
      promptTokens: 500000,
      completionTokens: 250000,
      totalTokens: 750000,
    });
    assert.equal(cost, 0);
  });

  it('should calculate accurate cost in USD for typical LLM invocations', () => {
    // 10,000 prompt tokens + 2,000 completion tokens on gemini-2.5-flash
    // Prompt: 10,000 * 0.075 / 1,000,000 = $0.00075
    // Completion: 2,000 * 0.30 / 1,000,000 = $0.00060
    // Total = $0.00135
    const cost = estimateTokenCostUSD('gemini-2.5-flash', {
      promptTokens: 10000,
      completionTokens: 2000,
      totalTokens: 12000,
    });
    assert.equal(cost, 0.00135);
  });

  it('should handle zero tokens, negative counts, and missing tokenUsage gracefully', () => {
    assert.equal(estimateTokenCostUSD('gpt-4o', undefined), 0);
    assert.equal(
      estimateTokenCostUSD('gpt-4o', { promptTokens: 0, completionTokens: 0, totalTokens: 0 }),
      0
    );
    assert.equal(
      estimateTokenCostUSD('gpt-4o', { promptTokens: -50, completionTokens: -10, totalTokens: 0 }),
      0
    );
  });

  it('should apply fallback pricing for completely unrecognized model names', () => {
    const unknownRule = resolveModelPricing('my-custom-unrecognized-model-v99');
    assert.equal(unknownRule.promptPer1M, DEFAULT_FALLBACK_PRICING.promptPer1M);
    assert.equal(unknownRule.completionPer1M, DEFAULT_FALLBACK_PRICING.completionPer1M);

    const cost = estimateTokenCostUSD('my-custom-unrecognized-model-v99', {
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
      totalTokens: 2_000_000,
    });
    assert.equal(cost, 0.75); // 0.15 + 0.60
  });
});
