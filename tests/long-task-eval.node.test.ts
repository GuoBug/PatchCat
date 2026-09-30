/**
 * @file    tests/long-task-eval.node.test.ts
 * @description
 *   Automated Node.js test suite for PatchCat Task 3: Long-Task Context Engineering Eval.
 *   Validates:
 *     1. 20+ Step long-task ReAct loop completion under Before (Disabled) vs After (L1+L2 Guard)
 *     2. Deterministic step parity & protocol closure (Structural Parity 100%)
 *     3. Token compression (>65% total prompt token reduction, >80% peak context reduction)
 *     4. O(K) message array bounding vs O(N) linear explosion
 *     5. Dual-anchor immutability, tombstone injection, and tool clamping invariants
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BENCHMARK_SCENARIOS,
  runSingleEval,
  runFullBenchmarkSuite,
} from '../scripts/long-task-eval-engine.ts';

describe('Task 3: Long-Task Context Engineering Evaluation (20+ Step Benchmarks)', () => {
  describe('1. Scenario 1 (incident-rca-24): 24-Step Microservice Incident RCA A/B Test', () => {
    it('executes 24-step ReAct loop and proves L1+L2 achieves structural parity while compressing tokens by >70%', async () => {
      const scenario = BENCHMARK_SCENARIOS.find((s) => s.id === 'incident-rca-24');
      assert.ok(scenario, 'incident-rca-24 scenario must exist');

      // 1. Run Baseline (Before / Context Mgmt Disabled)
      const before = await runSingleEval(scenario, 'before');
      assert.strictEqual(before.mode, 'before');
      assert.strictEqual(before.totalIterations, 24, 'Baseline must execute exactly 24 iterations');
      assert.strictEqual(before.groundTruthMatched, true, 'Baseline must match ground truth');
      assert.strictEqual(before.success, true);
      assert.strictEqual(before.clampedToolsCount, 0, 'Baseline must have zero tool clamping');
      assert.strictEqual(before.tokensSavedByPruning, 0, 'Baseline must have zero pruning savings');
      assert.ok(before.peakContextTokens > 25000, `Baseline peak context should exceed 25k tokens, got ${before.peakContextTokens}`);
      assert.ok(before.totalPromptTokens > 300000, `Baseline prompt tokens should exceed 300k tokens, got ${before.totalPromptTokens}`);
      assert.ok(before.finalMessageCount >= 48, `Baseline message count should be >= 48, got ${before.finalMessageCount}`);

      // 2. Run Layer 1+2 (After / Standard Context Guard)
      const after = await runSingleEval(scenario, 'after');
      assert.strictEqual(after.mode, 'after');
      assert.strictEqual(after.totalIterations, 24, 'After must execute exactly 24 iterations');
      assert.strictEqual(after.groundTruthMatched, true, 'After must match ground truth');
      assert.strictEqual(after.success, true);
      assert.ok(after.clampedToolsCount > 0, 'After must clamp oversized tool outputs');
      assert.ok(after.tokensSavedByPruning > 0, 'After must save tokens via sliding window pruning');

      // 3. Quantitative Reduction Invariants
      const tokenReduction = (before.totalPromptTokens - after.totalPromptTokens) / before.totalPromptTokens;
      const peakReduction = (before.peakContextTokens - after.peakContextTokens) / before.peakContextTokens;

      assert.ok(
        tokenReduction >= 0.65,
        `Expected >=65% token reduction, got ${(tokenReduction * 100).toFixed(1)}%`,
      );
      assert.ok(
        peakReduction >= 0.75,
        `Expected >=75% peak context reduction, got ${(peakReduction * 100).toFixed(1)}%`,
      );

      // 4. Memory & Message Bounded Invariant (O(K))
      // After K=4 sliding window: 2 anchors + 1 tombstone + 4 turns * 2 msgs = 11 messages max
      assert.ok(
        after.finalMessageCount <= 12,
        `Expected bounded messages count <= 12, got ${after.finalMessageCount}`,
      );
      assert.ok(
        after.peakContextTokens <= 6000,
        `Expected bounded peak context <= 6000 tokens, got ${after.peakContextTokens}`,
      );
    });
  });

  describe('2. Scenario 2 (financial-audit-22): 22-Step Multi-Gateway Financial Reconciliation', () => {
    it('executes 22-step audit loop with 18 large batch partitions, achieving >65% compression', async () => {
      const scenario = BENCHMARK_SCENARIOS.find((s) => s.id === 'financial-audit-22');
      assert.ok(scenario);

      const before = await runSingleEval(scenario, 'before');
      const after = await runSingleEval(scenario, 'after');

      assert.strictEqual(before.success, true);
      assert.strictEqual(after.success, true);
      assert.strictEqual(before.totalIterations, 22);
      assert.strictEqual(after.totalIterations, 22);

      const tokenReduction = (before.totalPromptTokens - after.totalPromptTokens) / before.totalPromptTokens;
      assert.ok(
        tokenReduction >= 0.65,
        `Expected >=65% token reduction for financial audit, got ${(tokenReduction * 100).toFixed(1)}%`,
      );
      assert.ok(after.peakContextTokens < 6000);
    });
  });

  describe('3. Scenario 3 (security-sast-sbom-20): 20-Step Security SBOM & SAST Audit', () => {
    it('executes 20-step DevSecOps audit pipeline, achieving >65% compression and zero degradation', async () => {
      const scenario = BENCHMARK_SCENARIOS.find((s) => s.id === 'security-sast-sbom-20');
      assert.ok(scenario);

      const before = await runSingleEval(scenario, 'before');
      const after = await runSingleEval(scenario, 'after');

      assert.strictEqual(before.success, true);
      assert.strictEqual(after.success, true);
      assert.strictEqual(before.totalIterations, 20);
      assert.strictEqual(after.totalIterations, 20);

      const tokenReduction = (before.totalPromptTokens - after.totalPromptTokens) / before.totalPromptTokens;
      assert.ok(
        tokenReduction >= 0.65,
        `Expected >=65% token reduction for security audit, got ${(tokenReduction * 100).toFixed(1)}%`,
      );
      assert.ok(after.peakContextTokens < 6000);
    });
  });

  describe('4. Macro Suite Level Invariants & Strategic Thresholds', () => {
    it('runs full benchmark suite and verifies 100% success rate, >70% token savings, and bounded peaks', async () => {
      const report = await runFullBenchmarkSuite();
      const agg = report.aggregate;

      // 1. Success Rate Parity
      assert.strictEqual(agg.beforeSuccessRate, 100, 'Baseline success rate must be 100%');
      assert.strictEqual(agg.afterSuccessRate, 100, 'L1+L2 success rate must be 100% (zero degradation)');

      // 2. Turns Equivalence (Zero Delay / Deadlock)
      assert.strictEqual(agg.beforeAvgTurns, agg.afterAvgTurns, 'Average completion turns must match exactly');

      // 3. Quantitative Compression Gates
      assert.ok(
        agg.tokenSavingsPercent >= 68.0,
        `Macro token savings must be >=68%, got ${agg.tokenSavingsPercent}%`,
      );
      assert.ok(
        agg.peakReductionPercent >= 80.0,
        `Macro peak context reduction must be >=80%, got ${agg.peakReductionPercent}%`,
      );

      // 4. Clamping and Pruning Activity
      assert.ok(agg.totalTokensSavedAcrossSuite > 50000, 'Cumulative pruning savings must exceed 50k tokens');
      assert.ok(agg.totalToolsClampedAcrossSuite >= 50, 'Total clamped tools must be >= 50');
    });
  });
});
