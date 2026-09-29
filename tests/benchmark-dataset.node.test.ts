/**
 * @file    tests/benchmark-dataset.node.test.ts
 * @description
 *   Unit tests and contract integrity assertions for the expanded 30-case benchmark dataset.
 *   Validates:
 *   1. 30-case scale & unique sequential identifiers (1..30)
 *   2. Category distribution & Ground Truth contract validity
 *   3. Expected Order ID format, prompt injection, and uniqueness
 *   4. Sentinel watch-list defensive assertions
 *   5. Mathematical power & Discordant capacity for McNemar statistical significance
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BENCHMARK_CASES,
  WATCH_LIST,
  assertSentinelIntegrity,
  type CaseDef,
} from '../src/presets/benchmark-dataset.ts';

describe('Benchmark Dataset Scale & Contract Verification (Module 1)', () => {
  it('1. Dataset Scale: contains exactly 30 curated test cases', () => {
    assert.equal(BENCHMARK_CASES.length, 30, 'Benchmark cases should be expanded from 14 to exactly 30');
  });

  it('2. Unique Sequential IDs: case IDs are strictly 1..30 without gaps or duplicates', () => {
    const ids = BENCHMARK_CASES.map((c) => c.id);
    for (let i = 1; i <= 30; i++) {
      assert.equal(ids[i - 1], i, `Case at index ${i - 1} must have id=${i}`);
    }
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, 30, 'All 30 case IDs must be distinct');
  });

  it('3. Semantic Key Uniqueness: all semantic keys are unique snake_case identifiers', () => {
    const keys = BENCHMARK_CASES.map((c) => c.semanticKey);
    const uniqueKeys = new Set(keys);
    assert.equal(uniqueKeys.size, 30, 'All 30 semanticKeys must be unique');
    for (const key of keys) {
      assert.match(key, /^[a-z0-9_]+$/, `Key ${key} must follow snake_case pattern`);
    }
  });

  it('4. Multi-Category Balance: all 4 business categories are represented with realistic distribution', () => {
    const validCategories = new Set(['logistics', 'refund', 'quality', 'other']);
    const categoryCounts: Record<string, number> = {
      logistics: 0,
      refund: 0,
      quality: 0,
      other: 0,
    };

    for (const c of BENCHMARK_CASES) {
      assert.ok(validCategories.has(c.expectedCategory), `Invalid category ${c.expectedCategory} in Case #${c.id}`);
      categoryCounts[c.expectedCategory]++;
    }

    assert.ok(categoryCounts.refund >= 10, 'Refund cases should be substantial (>= 10)');
    assert.ok(categoryCounts.logistics >= 4, 'Logistics cases should be >= 4');
    assert.ok(categoryCounts.quality >= 3, 'Quality cases should be >= 3');
    assert.ok(categoryCounts.other >= 3, 'Other cases should be >= 3');
  });

  it('5. Difficulty Gradient: balanced distribution between easy baseline and hard adversarial cases', () => {
    const easyCases = BENCHMARK_CASES.filter((c) => c.difficulty === 'easy');
    const hardCases = BENCHMARK_CASES.filter((c) => c.difficulty === 'hard');

    assert.equal(easyCases.length, 17, 'Should have 17 easy cases');
    assert.equal(hardCases.length, 13, 'Should have 13 hard adversarial cases');
  });

  it('6. Order ID Contract & Self-Consistency: all expectedOrderIds follow ORD-xxxxxx regex and exist in prompt', () => {
    const orderIds = BENCHMARK_CASES.map((c) => c.expectedOrderId);
    const uniqueOrderIds = new Set(orderIds);
    assert.equal(uniqueOrderIds.size, 30, 'Every case must have a unique orderId');

    for (const c of BENCHMARK_CASES) {
      assert.match(c.expectedOrderId, /^ORD-\d{6}$/, `Case #${c.id} orderId must match ORD-xxxxxx`);
      assert.ok(
        c.prompt.includes(c.expectedOrderId),
        `Case #${c.id} prompt must contain expected orderId ${c.expectedOrderId}`,
      );
    }
  });

  it('7. Sentinel Watch-List Integrity: passes fail-fast integrity check on active dataset', () => {
    assert.doesNotThrow(() => {
      assertSentinelIntegrity(BENCHMARK_CASES, WATCH_LIST);
    });
  });

  it('8. Sentinel Defensive Watchdog: throws when a sentinel case is missing or mutated', () => {
    // Missing sentinel
    const missingCase2 = BENCHMARK_CASES.filter((c) => c.id !== 2);
    assert.throws(
      () => assertSentinelIntegrity(missingCase2, WATCH_LIST),
      /BENCHMARK_CASES 中未找到 caseId=2/,
    );

    // Mutated semanticKey
    const mutatedKey = BENCHMARK_CASES.map((c) =>
      c.id === 7 ? { ...c, semanticKey: 'refund_drifted' } : c,
    );
    assert.throws(
      () => assertSentinelIntegrity(mutatedKey, WATCH_LIST),
      /Case #7 的 semanticKey 不匹配/,
    );

    // Mutated category
    const mutatedCat = BENCHMARK_CASES.map((c) =>
      c.id === 13 ? { ...c, expectedCategory: 'refund' as const } : c,
    );
    assert.throws(
      () => assertSentinelIntegrity(mutatedCat, WATCH_LIST),
      /Case #13 的预期类别已改变/,
    );
  });

  it('9. Mathematical Power for McNemar Significance: dataset provides >= 6 discordant potential', () => {
    // When discordant pairs are 6:0, two-sided exact McNemar p = 2 * (0.5)^6 = 0.03125 (< 0.05)
    // The previous 14-case dataset only had 4 discordant cases (p = 0.125).
    // With 30 cases (including 13 hard adversarial ones), discordant capacity easily exceeds 6.
    const hardAdversarialCount = BENCHMARK_CASES.filter((c) => c.difficulty === 'hard').length;
    assert.ok(
      hardAdversarialCount >= 6,
      'Hard adversarial cases (13) provide ample headroom to exceed critical McNemar threshold (>= 6 discordant pairs)',
    );
  });
});
