/**
 * @file    tests/model-routing.node.test.ts
 * @version 1.0.0
 * @description
 *   Unit and integration test suite for Module 3: Deterministic Model Routing & Multi-Tier Cascade.
 *
 *   Verifies:
 *   1. Relative Pricing & Cost Savings Ratio calculations (8x price gap between 7B and 72B).
 *   2. Track 2: Heuristic Semantic Conflict Detector for F7 (Description-Action Priority Inversion).
 *   3. T1 Cohort (43%): Cheap model passes on first round -> zero escalation, 87.5% cost savings.
 *   4. T2 Cohort (37%): Cheap model fails round 1, self-heals in-place on retry -> stays on cheap tier.
 *   5. T3 Cohort (20%): Cheap model exhausts self-healing budget -> escalates to strong model with context carry-over.
 *   6. Track 2 Gate: Format valid but F7 conflict detected -> trips semantic gate to escalate to strong model.
 *   7. Zero Throw: Graceful degradation when both tiers fail.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  calculateCostSavingsRatio,
  detectSemanticConflict,
  executeWithModelRouting,
  type ModelRoutingCallerRequest,
} from '../src/engine/model-router.ts';
import { defaultTicketSemanticGate } from '../src/presets/ticket-semantic-gate.ts';
import type { LLMExecutionOutput } from '../src/engine/llm-client.ts';

describe('Module 3: Deterministic Model Routing & Cascade State Machine', () => {
  // ───────────────────────────────────────────────────────────────────────────
  // 1. Cost Savings Calculator
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Relative Pricing & Cost Savings Calculator', () => {
    it('calculates 87.5% cost savings between 7B ($0.05) and 72B ($0.40)', () => {
      const ratio = calculateCostSavingsRatio(
        'Qwen/Qwen2.5-7B-Instruct',
        'deepseek-ai/DeepSeek-V3',
      );
      assert.equal(ratio, (0.40 - 0.05) / 0.40); // 0.875
    });

    it('returns 0% when models have equal pricing or target is cheaper', () => {
      const ratio = calculateCostSavingsRatio(
        'deepseek-ai/DeepSeek-V3',
        'deepseek-ai/DeepSeek-V3',
      );
      assert.equal(ratio, 0);
    });

    it('calculates 94.0% cost savings for Gemini-native cascade (gemini-2.5-flash vs gemini-2.5-pro)', () => {
      const ratio = calculateCostSavingsRatio('gemini-2.5-flash', 'gemini-2.5-pro');
      assert.equal(ratio, (1.25 - 0.075) / 1.25); // 0.94 (94.0%)
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Track 2: Heuristic Semantic Conflict Detector (F7 Defense)
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Track 2: Heuristic Semantic Conflict Detector (F7 Defense)', () => {
    it('detects F7 conflict when prompt has severe defect terms + refund action but output is quality (Case #27)', () => {
      const prompt =
        '订单 ORD-246810 收到的大牌香水瓶身做工粗糙，去专柜验货鉴定为假货。商品存在严重仿冒质量问题，我要求立即退款并保留向市监局举报的权利！';
      const output = {
        orderId: 'ORD-246810',
        category: 'quality', // F7 misclassification!
        urgency: 4,
      };

      const result = detectSemanticConflict(prompt, output);
      assert.equal(result.hasConflict, true);
      assert.equal(result.conflictType, 'f7_description_action_inversion');
      assert.equal(result.suggestedCategory, 'refund');
      assert.ok(result.detectedSymptomTerms.length > 0);
      assert.ok(result.detectedActionTerms.includes('退款'));
    });

    it('detects F7 conflict on Case #30 (暗损桌子开裂 + 退款退货诉求)', () => {
      const prompt =
        '买的书桌 ORD-975310 包装完好，组装后才发现背板有一道贯穿性的大裂缝，质量太次了，我要退款退货！';
      const output = {
        orderId: 'ORD-975310',
        category: 'quality',
      };

      const result = detectSemanticConflict(prompt, output);
      assert.equal(result.hasConflict, true);
      assert.equal(result.suggestedCategory, 'refund');
    });

    it('does NOT trip when model correctly honored refund action', () => {
      const prompt =
        '订单 ORD-246810 鉴定为假货，严重仿冒，要求立即退款！';
      const output = {
        orderId: 'ORD-246810',
        category: 'refund', // Correct!
      };

      const result = detectSemanticConflict(prompt, output);
      assert.equal(result.hasConflict, false);
    });

    it('does NOT trip for pure quality complaint without refund action', () => {
      const prompt =
        '订单 ORD-112233 收到衣服纽扣掉了，线头很多做工粗糙，请你们注意品控。';
      const output = {
        orderId: 'ORD-112233',
        category: 'quality',
      };

      const result = detectSemanticConflict(prompt, output);
      assert.equal(result.hasConflict, false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. T1 Cohort: First-Round Cheap Model Pass (43% in benchmark)
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. T1 Cohort: Cheap-First Direct Pass (43% Resolution)', () => {
    it('completes on Tier 1 with zero escalation when cheap model passes on first try', async () => {
      const schema = z.object({
        orderId: z.string(),
        category: z.enum(['logistics', 'refund', 'quality', 'other']),
        urgency: z.number().min(1).max(5),
      });

      const calls: ModelRoutingCallerRequest[] = [];

      const mockCaller = async (req: ModelRoutingCallerRequest): Promise<LLMExecutionOutput> => {
        calls.push(req);
        return {
          response: JSON.stringify({
            orderId: 'ORD-123456',
            category: 'logistics',
            urgency: 3,
          }),
          usage: { prompt: 100, completion: 30, total: 130 },
          finishReason: 'stop',
        };
      };

      const res = await executeWithModelRouting(
        mockCaller,
        [{ role: 'user', content: '查询快递 ORD-123456 进度' }],
        {
          schema,
          provider: 'siliconflow',
          routingConfig: {
            enabled: true,
            primaryModel: 'Qwen/Qwen2.5-7B-Instruct',
            fallbackModel: 'deepseek-ai/DeepSeek-V3',
            maxCheapRetries: 2,
          },
        },
      );

      assert.equal(res.success, true);
      assert.equal(res.modelTier, 'tier1_cheap');
      assert.equal(res.routedModel, 'Qwen/Qwen2.5-7B-Instruct');
      assert.equal(res.escalated, false);
      assert.equal(res.cheapAttempts, 1);
      assert.equal(res.strongAttempts, 0);
      assert.equal(res.totalAttempts, 1);
      assert.equal(res.costSavingsRatio, 0.875);
      assert.equal(calls.length, 1);
      assert.equal(calls[0]!.targetModel, 'Qwen/Qwen2.5-7B-Instruct');
      assert.equal(calls[0]!.modelTier, 'tier1_cheap');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. T2 Cohort: Cheap Model In-Place Self-Healing (37% in benchmark)
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. T2 Cohort: Cheap Model In-Place Self-Healing (37% Preservation)', () => {
    it('heals on cheap tier without escalating to strong model when round 1 has schema error', async () => {
      const schema = z.object({
        orderId: z.string(),
        category: z.enum(['logistics', 'refund', 'quality', 'other']),
        urgency: z.number().min(1).max(5),
      });

      const calls: ModelRoutingCallerRequest[] = [];
      let attempt = 0;

      const mockCaller = async (req: ModelRoutingCallerRequest): Promise<LLMExecutionOutput> => {
        calls.push(req);
        attempt++;

        if (attempt === 1) {
          // Attempt 1 fails: urgency out of range (8)
          return {
            response: JSON.stringify({
              orderId: 'ORD-556677',
              category: 'logistics',
              urgency: 8, // Invalid!
            }),
            usage: { prompt: 100, completion: 30, total: 130 },
            finishReason: 'stop',
          };
        }

        // Attempt 2 heals on cheap model after receiving diagnostic error feedback!
        return {
          response: JSON.stringify({
            orderId: 'ORD-556677',
            category: 'logistics',
            urgency: 4, // Fixed!
          }),
          usage: { prompt: 180, completion: 30, total: 210 },
          finishReason: 'stop',
        };
      };

      const res = await executeWithModelRouting(
        mockCaller,
        [{ role: 'user', content: '加急件 ORD-556677' }],
        {
          schema,
          provider: 'siliconflow',
          routingConfig: {
            enabled: true,
            primaryModel: 'Qwen/Qwen2.5-7B-Instruct',
            fallbackModel: 'deepseek-ai/DeepSeek-V3',
            maxCheapRetries: 2,
          },
        },
      );

      assert.equal(res.success, true);
      assert.equal(res.modelTier, 'tier1_cheap');
      assert.equal(res.routedModel, 'Qwen/Qwen2.5-7B-Instruct');
      assert.equal(res.escalated, false);
      assert.equal(res.escalationReason, 'cheap_self_healing');
      assert.equal(res.cheapAttempts, 2);
      assert.equal(res.strongAttempts, 0);
      assert.equal(calls.length, 2);
      // Both calls must remain on Tier 1
      assert.equal(calls[0]!.targetModel, 'Qwen/Qwen2.5-7B-Instruct');
      assert.equal(calls[1]!.targetModel, 'Qwen/Qwen2.5-7B-Instruct');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. T3 Cohort: Cheap Budget Exhaustion -> Tier 2 Escalation (20% cohort)
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. T3 Cohort: Escalation to Tier 2 Strong Model with Context Carry-Over', () => {
    it('escalates to fallbackModel when cheap model exhausts maxCheapRetries, passing diagnostic context', async () => {
      const schema = z.object({
        orderId: z.string(),
        category: z.enum(['logistics', 'refund', 'quality', 'other']),
        urgency: z.number().min(1).max(5),
      });

      const calls: ModelRoutingCallerRequest[] = [];
      let attempt = 0;

      const mockCaller = async (req: ModelRoutingCallerRequest): Promise<LLMExecutionOutput> => {
        calls.push(req);
        attempt++;

        if (attempt <= 3) {
          // Cheap model fails repeatedly across all allowed budget
          return {
            response: 'Invalid non-json output from cheap model',
            usage: { prompt: 100, completion: 20, total: 120 },
            finishReason: 'stop',
          };
        }

        // Tier 2 Strong model takes over and produces clean output!
        return {
          response: JSON.stringify({
            orderId: 'ORD-999000',
            category: 'other',
            urgency: 2,
          }),
          usage: { prompt: 350, completion: 35, total: 385 },
          finishReason: 'stop',
        };
      };

      const res = await executeWithModelRouting(
        mockCaller,
        [{ role: 'user', content: '复杂咨询 ORD-999000' }],
        {
          schema,
          provider: 'siliconflow',
          routingConfig: {
            enabled: true,
            primaryModel: 'Qwen/Qwen2.5-7B-Instruct',
            fallbackModel: 'deepseek-ai/DeepSeek-V3',
            maxCheapRetries: 2, // 1 initial + 2 retries = 3 calls
          },
        },
      );

      assert.equal(res.success, true);
      assert.equal(res.modelTier, 'tier2_strong');
      assert.equal(res.routedModel, 'deepseek-ai/DeepSeek-V3');
      assert.equal(res.escalated, true);
      assert.equal(res.escalationReason, 'cheap_budget_exhausted');
      assert.equal(res.cheapAttempts, 3);
      assert.equal(res.strongAttempts, 1);
      assert.equal(calls.length, 4);

      // Verify model dispatch sequence
      assert.equal(calls[0]!.targetModel, 'Qwen/Qwen2.5-7B-Instruct');
      assert.equal(calls[1]!.targetModel, 'Qwen/Qwen2.5-7B-Instruct');
      assert.equal(calls[2]!.targetModel, 'Qwen/Qwen2.5-7B-Instruct');
      assert.equal(calls[3]!.targetModel, 'deepseek-ai/DeepSeek-V3');
      assert.equal(calls[3]!.modelTier, 'tier2_strong');

      // Verify Context Carry-Over: Strong model received error history in messages
      const strongMessages = calls[3]!.messages || [];
      assert.ok(strongMessages.length >= 3);
      assert.ok(strongMessages.some((m) => m.role === 'assistant'));
      assert.ok(
        strongMessages.some(
          (m) =>
            m.role === 'user' &&
            (m.content.includes('JSON 语法解析失败') || m.content.includes('业务语义校验')),
        ),
      );
    });

    it('supports Google Gemini as Tier 2 fallback model with context carry-over', async () => {
      const schema = z.object({
        orderId: z.string(),
        category: z.enum(['logistics', 'refund', 'quality', 'other']),
      });

      const calls: ModelRoutingCallerRequest[] = [];
      let attempt = 0;

      const mockCaller = async (req: ModelRoutingCallerRequest): Promise<LLMExecutionOutput> => {
        calls.push(req);
        attempt++;

        if (attempt <= 2) {
          return {
            response: 'Invalid output from cheap tier',
            usage: { prompt: 80, completion: 20, total: 100 },
            finishReason: 'stop',
          };
        }

        // Gemini takes over on Tier 2
        return {
          response: JSON.stringify({
            orderId: 'ORD-GEMINI-001',
            category: 'refund',
          }),
          usage: { prompt: 200, completion: 25, total: 225 },
          finishReason: 'stop',
        };
      };

      const res = await executeWithModelRouting(
        mockCaller,
        [{ role: 'user', content: '退款工单 ORD-GEMINI-001' }],
        {
          schema,
          provider: 'siliconflow',
          routingConfig: {
            enabled: true,
            primaryModel: 'Qwen/Qwen2.5-7B-Instruct',
            fallbackModel: 'gemini-2.5-flash',
            maxCheapRetries: 1,
          },
        },
      );

      assert.equal(res.success, true);
      assert.equal(res.modelTier, 'tier2_strong');
      assert.equal(res.routedModel, 'gemini-2.5-flash');
      assert.equal(res.escalated, true);
      assert.equal(calls.length, 3);
      assert.equal(calls[2]!.targetModel, 'gemini-2.5-flash');
      assert.equal(calls[2]!.modelTier, 'tier2_strong');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Track 2: Heuristic Semantic Conflict Escalation (F7 Defense)
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. Track 2: Semantic Conflict Gate Escalation', () => {
    it('escalates to Tier 2 when cheap model output is format-valid but hits F7 conflict (Case #27)', async () => {
      const schema = z.object({
        orderId: z.string(),
        category: z.enum(['logistics', 'refund', 'quality', 'other']),
        urgency: z.number().min(1).max(5),
      });

      const userPrompt =
        '订单 ORD-246810 收到的大牌香水瓶身做工粗糙，去专柜验货鉴定为假货。商品存在严重仿冒质量问题，我要求立即退款并保留向市监局举报的权利！';

      const calls: ModelRoutingCallerRequest[] = [];
      let attempt = 0;

      const mockCaller = async (req: ModelRoutingCallerRequest): Promise<LLMExecutionOutput> => {
        calls.push(req);
        attempt++;

        if (attempt === 1) {
          // Cheap model produces valid JSON, but misclassifies as 'quality' (F7)
          return {
            response: JSON.stringify({
              orderId: 'ORD-246810',
              category: 'quality', // Format valid, semantic wrong!
              urgency: 4,
            }),
            usage: { prompt: 120, completion: 30, total: 150 },
            finishReason: 'stop',
          };
        }

        // Strong model resolves after receiving Action Precedence directive!
        return {
          response: JSON.stringify({
            orderId: 'ORD-246810',
            category: 'refund', // Successfully disambiguated!
            urgency: 5,
          }),
          usage: { prompt: 250, completion: 35, total: 285 },
          finishReason: 'stop',
        };
      };

      const res = await executeWithModelRouting(
        mockCaller,
        [{ role: 'user', content: userPrompt }],
        {
          schema,
          provider: 'siliconflow',
          userPrompt,
          semanticConflictGate: defaultTicketSemanticGate,
          routingConfig: {
            enabled: true,
            primaryModel: 'Qwen/Qwen2.5-7B-Instruct',
            fallbackModel: 'deepseek-ai/DeepSeek-V3',
            enableSemanticConflictGate: true,
          },
        },
      );

      assert.equal(res.success, true);
      assert.equal(res.modelTier, 'tier2_strong');
      assert.equal(res.routedModel, 'deepseek-ai/DeepSeek-V3');
      assert.equal(res.escalated, true);
      assert.equal(res.escalationReason, 'semantic_conflict_gate');
      assert.equal((res.data as Record<string, unknown>)['category'], 'refund');

      // Verify that Action Precedence Directive was injected into strong model's prompt!
      const strongMessages = calls[1]!.messages || [];
      const userDirectives = strongMessages
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join('\n');
      assert.ok(userDirectives.includes('业务动作优先权消歧指令'));
      assert.ok(userDirectives.includes('refund'));
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Graceful Degradation: Zero-Throw Architecture
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Graceful Degradation (Zero-Throw Guarantee)', () => {
    it('never throws when both cheap and strong models fail, returning standardized fallback', async () => {
      const schema = z.object({
        orderId: z.string(),
        category: z.enum(['logistics', 'refund', 'quality', 'other']),
      });

      const mockCaller = async (): Promise<LLMExecutionOutput> => {
        return {
          response: 'Broken text across all models',
          usage: { prompt: 50, completion: 10, total: 60 },
          finishReason: 'stop',
        };
      };

      const res = await executeWithModelRouting(
        mockCaller,
        [{ role: 'user', content: '测试全崩溃' }],
        {
          schema,
          provider: 'siliconflow',
          routingConfig: {
            enabled: true,
            maxCheapRetries: 1,
          },
        },
      );

      assert.equal(res.success, false);
      assert.ok(res.errors && res.errors.length > 0);
      assert.equal(res.modelTier, 'tier2_strong');
      assert.equal(res.escalated, true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Multi-Candidate Model Rotation Queue (Quota Pooling & Automatic Failover)
  // ───────────────────────────────────────────────────────────────────────────
  describe('8. Multi-Candidate Model Rotation Queue', () => {
    it('rotates to next candidate model in fallbackModels when first candidate fails with 429/quota', async () => {
      const schema = z.object({
        orderId: z.string(),
        category: z.enum(['logistics', 'refund', 'quality', 'other']),
      });

      const calledModels: string[] = [];

      const mockCaller = async (req: ModelRoutingCallerRequest): Promise<LLMExecutionOutput> => {
        calledModels.push(req.targetModel);
        if (req.targetModel === 'Qwen/Qwen2.5-7B-Instruct') {
          return {
            response: 'Invalid format on cheap',
            usage: { prompt: 50, completion: 10, total: 60 },
            finishReason: 'stop',
          };
        }
        if (req.targetModel === 'gemini-3.8-flash') {
          throw new Error('HTTP 429: ResourceExhausted quota exceeded');
        }
        if (req.targetModel === 'gemini-3.5-flash-lite') {
          return {
            response: JSON.stringify({ orderId: 'ORD-888888', category: 'refund' }),
            usage: { prompt: 100, completion: 20, total: 120 },
            finishReason: 'stop',
          };
        }
        throw new Error('Unexpected model');
      };

      const res = await executeWithModelRouting(
        mockCaller,
        [{ role: 'user', content: '测试轮换' }],
        {
          schema,
          provider: 'google',
          routingConfig: {
            enabled: true,
            primaryModel: 'Qwen/Qwen2.5-7B-Instruct',
            fallbackModels: ['gemini-3.8-flash', 'gemini-3.5-flash-lite'],
            maxCheapRetries: 0,
          },
        },
      );

      assert.equal(res.success, true);
      assert.equal(res.routedModel, 'gemini-3.5-flash-lite');
      assert.equal(res.escalated, true);
      assert.equal(res.candidateRotations, 1);
      assert.equal(res.candidateAttempts?.length, 2);
      assert.equal(res.candidateAttempts?.[0]?.outcome, 'http_429');
      assert.equal(res.candidateAttempts?.[0]?.model, 'gemini-3.8-flash');
      assert.equal(res.candidateAttempts?.[1]?.outcome, 'ok');
      assert.equal(res.candidateAttempts?.[1]?.model, 'gemini-3.5-flash-lite');
      assert.deepEqual(calledModels, [
        'Qwen/Qwen2.5-7B-Instruct',
        'gemini-3.8-flash',
        'gemini-3.5-flash-lite',
      ]);
    });

    it('rotates to next candidate model when first candidate returns schema contract violation', async () => {
      const schema = z.object({
        orderId: z.string(),
        category: z.enum(['logistics', 'refund', 'quality', 'other']),
      });

      const calledModels: string[] = [];

      const mockCaller = async (req: ModelRoutingCallerRequest): Promise<LLMExecutionOutput> => {
        calledModels.push(req.targetModel);
        if (req.targetModel === 'Qwen/Qwen2.5-7B-Instruct') {
          return {
            response: 'Invalid format on cheap',
            usage: { prompt: 50, completion: 10, total: 60 },
            finishReason: 'stop',
          };
        }
        if (req.targetModel === 'gemini-3.8-flash') {
          // Schema violation: missing orderId
          return {
            response: JSON.stringify({ category: 'refund' }),
            usage: { prompt: 80, completion: 10, total: 90 },
            finishReason: 'stop',
          };
        }
        if (req.targetModel === 'gemini-3.5-flash-lite') {
          return {
            response: JSON.stringify({ orderId: 'ORD-999999', category: 'refund' }),
            usage: { prompt: 100, completion: 20, total: 120 },
            finishReason: 'stop',
          };
        }
        throw new Error('Unexpected model');
      };

      const res = await executeWithModelRouting(
        mockCaller,
        [{ role: 'user', content: '测试契约违背轮换' }],
        {
          schema,
          provider: 'google',
          routingConfig: {
            enabled: true,
            primaryModel: 'Qwen/Qwen2.5-7B-Instruct',
            fallbackModels: ['gemini-3.8-flash', 'gemini-3.5-flash-lite'],
            maxCheapRetries: 0,
          },
        },
      );

      assert.equal(res.success, true);
      assert.equal(res.routedModel, 'gemini-3.5-flash-lite');
      assert.equal(res.candidateRotations, 1);
      assert.equal(res.candidateAttempts?.length, 2);
      assert.equal(res.candidateAttempts?.[0]?.outcome, 'contract_fail');
      assert.equal(res.candidateAttempts?.[1]?.outcome, 'ok');
    });
  });
});
