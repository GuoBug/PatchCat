/**
 * @file    tests/bm25-engine.node.test.ts
 * @version 1.0.0
 * @description
 *   Node.js tests for PatchCat Lightweight BM25 Engine & Reciprocal Rank Fusion (RRF).
 *   Validates:
 *     - CJK bi-gram tokenizer and bilingual stopword filtering.
 *     - BM25 mathematical properties (exact vs partial match, length penalty b, smoothed RSJ IDF).
 *     - Edge and boundary conditions (empty query, empty index, single-char query, super long query, doc deletion).
 *     - RRF multi-channel ranking fusion and weight tuning.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenize,
  BM25Index,
  reciprocalRankFusion,
  DEFAULT_STOPWORDS,
} from '../src/services/search/bm25-engine.ts';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Tokenizer Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('BM25 Tokenizer (tokenize)', () => {
  it('should generate overlapping bi-grams for CJK text according to RFC spec', () => {
    // Exact spec requirement: "拓扑排序" -> ["拓扑", "扑排", "排序"]
    const tokens = tokenize('拓扑排序');
    assert.deepStrictEqual(tokens, ['拓扑', '扑排', '排序']);

    // 2-character CJK sequence
    assert.deepStrictEqual(tokenize('架构'), ['架构']);

    // 3-character CJK sequence: bi-grams
    assert.deepStrictEqual(tokenize('拓扑排'), ['拓扑', '扑排']);
  });

  it('should fallback to unigram when no bi-gram can form (single CJK character)', () => {
    // Single CJK char fallback
    assert.deepStrictEqual(tokenize('拓'), ['拓']);
    assert.deepStrictEqual(tokenize('猫'), ['猫']);
  });

  it('should split CJK sequences across spaces and punctuation without cross bi-grams', () => {
    // Whitespace separation
    const spaced = tokenize('拓扑 排序');
    assert.deepStrictEqual(spaced, ['拓扑', '排序']);

    // Punctuation separation
    const punctuated = tokenize('拓扑，排序；引擎。');
    assert.deepStrictEqual(punctuated, ['拓扑', '排序', '引擎']);
  });

  it('should tokenize mixed English and alphanumeric identifiers properly', () => {
    // Lowercase normalization
    const tokens = tokenize('PatchCat DAG ENGINE');
    assert.deepStrictEqual(tokens, ['patchcat', 'dag', 'engine']);

    // Underscores and hyphens in identifiers
    const identifiers = tokenize('kahn_schedule state-machine v2_0');
    assert.deepStrictEqual(identifiers, ['kahn_schedule', 'state-machine', 'v2_0']);

    // Leading and trailing hyphens/underscores stripped
    const cleaned = tokenize('--hello__world--');
    assert.deepStrictEqual(cleaned, ['hello__world']);
  });

  it('should filter single alphanumeric characters and pure symbols', () => {
    // Single characters filtered by default (minAlphaNumLength = 2)
    assert.deepStrictEqual(tokenize('a b c x 1 2'), []);

    // Pure symbols filtered
    assert.deepStrictEqual(tokenize('--- ___ - - _'), []);
    assert.deepStrictEqual(tokenize('!@#$%^&*()_+'), []);
  });

  it('should filter built-in Chinese and English stopwords', () => {
    // Chinese single-char and composite stopwords
    const filteredChinese = tokenize('这是在测试中的模型');
    // '这是', '在', '中', '的' are stopwords, '测试' and '模型' are meaningful bi-grams
    assert.deepStrictEqual(filteredChinese, ['测试', '模型']);

    // Explicit Chinese 2-char stopwords
    assert.deepStrictEqual(tokenize('没有 自己'), []);

    // English stopwords
    const filteredEnglish = tokenize('the quick brown fox is with by');
    assert.deepStrictEqual(filteredEnglish, ['quick', 'brown', 'fox']);

    // Stopword only queries return empty
    assert.deepStrictEqual(tokenize('的 了 在 是 我 有'), []);
    assert.deepStrictEqual(tokenize('the an is was were'), []);
  });

  it('should respect custom stopwords and tokenize options', () => {
    // Custom stopword addition
    const custom = tokenize('patchcat dag engine', {
      customStopwords: ['patchcat'],
    });
    assert.deepStrictEqual(custom, ['dag', 'engine']);

    // Disable stopword removal
    const withStopwords = tokenize('the model', {
      removeStopwords: false,
    });
    assert.deepStrictEqual(withStopwords, ['the', 'model']);

    // Disable CJK bi-grams (pure unigram mode)
    const unigrams = tokenize('拓扑排序', {
      cjkBiGram: false,
    });
    assert.deepStrictEqual(unigrams, ['拓', '扑', '排', '序']);
  });

  it('should verify DEFAULT_STOPWORDS dictionary integrity', () => {
    assert.ok(DEFAULT_STOPWORDS.has('的'));
    assert.ok(DEFAULT_STOPWORDS.has('没有'));
    assert.ok(DEFAULT_STOPWORDS.has('the'));
    assert.ok(DEFAULT_STOPWORDS.has('with'));
    assert.ok(!DEFAULT_STOPWORDS.has('拓扑'));
    assert.ok(!DEFAULT_STOPWORDS.has('patchcat'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. BM25 Core Characteristics & Mathematical Principles
// ─────────────────────────────────────────────────────────────────────────────

describe('BM25 Core Characteristics & Mathematical Principles', () => {
  it('should rank exact match significantly higher than partial or generalized match', () => {
    const index = new BM25Index();

    index.addDocument('doc-exact', 'PatchCat 拓扑排序算法与状态机引擎');
    index.addDocument('doc-partial', 'PatchCat 调度算法与事件驱动系统');
    index.addDocument('doc-unrelated', 'Web Worker 沙箱安全与存储持久化');

    const results = index.search('拓扑排序');

    assert.ok(results.length >= 1, 'Should find matching documents');
    assert.strictEqual(results[0]?.id, 'doc-exact', 'Exact match must rank first');
    assert.strictEqual(results[0]?.normalizedScore, 1.0, 'Top result normalizedScore should be 1.0');
    assert.ok(
      results[0]?.matchedTerms.includes('拓扑') && results[0]?.matchedTerms.includes('排序'),
      'Should record matched terms'
    );

    // doc-unrelated should not appear
    assert.ok(!results.some((r) => r.id === 'doc-unrelated'));
  });

  it('should penalize verbose long documents when b > 0 and reward concise matches', () => {
    // When b = 0.75 (standard BM25):
    // A concise document with the exact match should score higher than a bloated document
    // containing the same term frequency diluted by 200 non-matching tokens.
    const indexNormal = new BM25Index({ b: 0.75, k1: 1.5 });

    const conciseText = '拓扑排序状态机';
    const bloatedText =
      '拓扑排序状态机 ' +
      Array.from({ length: 150 }, (_, i) => `无关数据片段序号${i}扩展日志`).join(' ');

    indexNormal.addDocument('doc-concise', conciseText);
    indexNormal.addDocument('doc-bloated', bloatedText);

    const normalResults = indexNormal.search('拓扑排序');
    assert.strictEqual(normalResults[0]?.id, 'doc-concise');
    assert.strictEqual(normalResults[1]?.id, 'doc-bloated');

    const conciseScore = normalResults[0]!.score;
    const bloatedScore = normalResults[1]!.score;
    assert.ok(
      conciseScore > bloatedScore * 1.5,
      `Concise doc score (${conciseScore}) should be significantly higher than bloated doc (${bloatedScore}) under b=0.75`
    );

    // When b = 0.0 (no length penalization):
    // Document length is neutralized (lenNorm = 1), so equal TF yields identical scores!
    const indexNoLengthNorm = new BM25Index({ b: 0.0, k1: 1.5 });
    indexNoLengthNorm.addDocument('doc-concise', conciseText);
    indexNoLengthNorm.addDocument('doc-bloated', bloatedText);

    const noNormResults = indexNoLengthNorm.search('拓扑排序');
    const scoreA = noNormResults.find((r) => r.id === 'doc-concise')!.score;
    const scoreB = noNormResults.find((r) => r.id === 'doc-bloated')!.score;

    assert.ok(
      Math.abs(scoreA - scoreB) < 1e-4,
      `When b=0, both documents must have identical BM25 scores (A: ${scoreA}, B: ${scoreB})`
    );
  });

  it('should assign higher IDF weight to rare terms than frequent terms via Robertson-Spärck Jones smoothing', () => {
    const index = new BM25Index();

    // In a collection of 10 documents:
    // "系统" appears in 9 documents (high frequency, low IDF)
    // "死锁检测" appears in only 1 document (rare keyword, high IDF)
    for (let i = 1; i <= 8; i++) {
      index.addDocument(`doc-common-${i}`, `系统 工作流 引擎 节点 运行 状态${i}`);
    }
    index.addDocument('doc-rare', '系统 死锁检测 看门狗 拓扑 调度');
    index.addDocument('doc-common-9', '系统 工作流 画布 渲染 交互');

    const idfCommon = index.calculateIDF('系统');
    const idfRare = index.calculateIDF('死锁');

    assert.ok(idfRare > idfCommon, `Rare term IDF (${idfRare}) must be higher than common term IDF (${idfCommon})`);
    assert.ok(idfCommon > 0, 'Common term IDF must still be strictly positive');
    assert.ok(idfRare > idfCommon * 2, 'Rare term IDF should be substantially higher');

    // Mathematical verification of Robertson-Spärck Jones RSJ non-negativity:
    // Even if term appears in ALL documents (n = N = 10):
    // IDF = ln(1 + (10 - 10 + 0.5) / (10 + 0.5)) = ln(1 + 0.5 / 10.5) > 0
    index.addDocument('doc-extra', '系统');
    const idfUniversal = index.calculateIDF('系统');
    assert.ok(idfUniversal > 0, `Universal term IDF must never be negative or zero (got ${idfUniversal})`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. BM25 Lifecycle & Boundary Conditions
// ─────────────────────────────────────────────────────────────────────────────

describe('BM25 Lifecycle & Boundary Conditions', () => {
  it('should handle empty queries, whitespace, and stopword-only queries gracefully', () => {
    const index = new BM25Index();
    index.addDocument('doc-1', 'PatchCat 拓扑排序');

    assert.deepStrictEqual(index.search(''), []);
    assert.deepStrictEqual(index.search('   '), []);
    assert.deepStrictEqual(index.search('在 是 的 了'), []);
  });

  it('should handle empty index gracefully without throwing', () => {
    const emptyIndex = new BM25Index();
    assert.strictEqual(emptyIndex.documentCount, 0);
    assert.strictEqual(emptyIndex.avgDocLength, 0);
    assert.deepStrictEqual(emptyIndex.search('拓扑排序'), []);
  });

  it('should handle single-character queries properly', () => {
    const index = new BM25Index();
    index.addDocument('doc-1', '拓');
    index.addDocument('doc-2', '排序');

    // Single character query matching doc-1
    const matchSingle = index.search('拓');
    assert.strictEqual(matchSingle.length, 1);
    assert.strictEqual(matchSingle[0]?.id, 'doc-1');

    // Single character stopword query returns empty
    assert.deepStrictEqual(index.search('的'), []);

    // Single character English query returns empty (filtered by min length)
    assert.deepStrictEqual(index.search('a'), []);
  });

  it('should handle ultra-long queries without stack overflow or performance degradation', () => {
    const index = new BM25Index();
    index.addDocument('doc-target', 'PatchCat 拓扑排序 算法 状态机');

    // Construct a 2000-token query
    const longQuery = Array.from({ length: 500 }, () => '拓扑 排序 性能 测试').join(' ');
    const start = performance.now();
    const results = index.search(longQuery);
    const duration = performance.now() - start;

    assert.ok(results.length >= 1);
    assert.strictEqual(results[0]?.id, 'doc-target');
    assert.ok(duration < 200, `Super long query should complete quickly (took ${duration.toFixed(2)}ms)`);
  });

  it('should support document removal, updating, and full clear', () => {
    const index = new BM25Index<{ category: string }>();

    index.addDocument('doc-1', '拓扑排序调度', { category: 'arch' });
    index.addDocument('doc-2', 'React Flow 渲染优化', { category: 'ui' });
    assert.strictEqual(index.documentCount, 2);

    // Verify searchable with metadata
    const r1 = index.search('拓扑');
    assert.strictEqual(r1.length, 1);
    assert.strictEqual(r1[0]?.metadata?.category, 'arch');

    // Remove doc-1
    const removed = index.removeDocument('doc-1');
    assert.strictEqual(removed, true);
    assert.strictEqual(index.documentCount, 1);

    // Search again: doc-1 must not appear
    const r2 = index.search('拓扑');
    assert.strictEqual(r2.length, 0);

    // doc-2 still searchable
    const r3 = index.search('渲染');
    assert.strictEqual(r3.length, 1);
    assert.strictEqual(r3[0]?.id, 'doc-2');

    // Overwrite existing doc
    index.addDocument('doc-2', '全新内容 拓扑排序升级版', { category: 'new' });
    assert.strictEqual(index.documentCount, 1);
    const r4 = index.search('拓扑');
    assert.strictEqual(r4.length, 1);
    assert.strictEqual(r4[0]?.metadata?.category, 'new');

    // Clear all
    index.clear();
    assert.strictEqual(index.documentCount, 0);
    assert.strictEqual(index.avgDocLength, 0);
    assert.strictEqual(index.totalTokens, 0);
    assert.deepStrictEqual(index.search('拓扑'), []);
  });

  it('should respect topK parameter and limit returned count', () => {
    const index = new BM25Index();
    for (let i = 1; i <= 20; i++) {
      index.addDocument(`doc-${i}`, `PatchCat 工作流编排测试样本 ${i}`);
    }

    const top3 = index.search('工作流', 3);
    assert.strictEqual(top3.length, 3);

    const top5 = index.search('工作流', 5);
    assert.strictEqual(top5.length, 5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Reciprocal Rank Fusion (RRF)
// ─────────────────────────────────────────────────────────────────────────────

describe('Reciprocal Rank Fusion (RRF)', () => {
  it('should boost documents that appear near the top in multiple search channels', () => {
    // Channel 1: BM25 Lexical Search Results
    const bm25List = {
      name: 'bm25',
      weight: 1.0,
      items: [
        { id: 'doc-A', score: 10.5, item: { title: 'Doc A' } },
        { id: 'doc-B', score: 8.2, item: { title: 'Doc B' } },
        { id: 'doc-C', score: 5.1, item: { title: 'Doc C' } },
      ],
    };

    // Channel 2: Dense Vector Similarity Search Results
    const vectorList = {
      name: 'vector',
      weight: 1.0,
      items: [
        { id: 'doc-B', score: 0.95, item: { title: 'Doc B' } },
        { id: 'doc-C', score: 0.88, item: { title: 'Doc C' } },
        { id: 'doc-D', score: 0.82, item: { title: 'Doc D' } },
      ],
    };

    // Standard RRF with k = 60:
    // doc-A: 1/(60+1) = 1/61 ≈ 0.01639344
    // doc-B: 1/(60+2) + 1/(60+1) = 1/62 + 1/61 ≈ 0.01612903 + 0.01639344 = 0.03252247
    // doc-C: 1/(60+3) + 1/(60+2) = 1/63 + 1/62 ≈ 0.01587302 + 0.01612903 = 0.03200205
    // doc-D: 1/(60+3) = 1/63 ≈ 0.01587302
    const fused = reciprocalRankFusion([bm25List, vectorList], { k: 60 });

    assert.strictEqual(fused.length, 4);
    assert.strictEqual(fused[0]?.id, 'doc-B', 'doc-B must be ranked #1 due to multi-channel recall');
    assert.strictEqual(fused[1]?.id, 'doc-C', 'doc-C must be ranked #2');
    assert.strictEqual(fused[2]?.id, 'doc-A', 'doc-A must be ranked #3');
    assert.strictEqual(fused[3]?.id, 'doc-D', 'doc-D must be ranked #4');

    // Check mathematical precision
    assert.ok(Math.abs(fused[0]!.score - (1 / 62 + 1 / 61)) < 1e-6);
  });

  it('should provide complete channel transparency and observability in channelDetails', () => {
    const list1 = {
      name: 'lexical_bm25',
      weight: 1.0,
      items: [{ id: 'doc-X', score: 4.5, item: { title: 'Item X' } }],
    };
    const list2 = {
      name: 'semantic_vector',
      weight: 1.0,
      items: [{ id: 'doc-X', score: 0.91, item: { title: 'Item X' } }],
    };

    const fused = reciprocalRankFusion([list1, list2]);
    assert.strictEqual(fused.length, 1);

    const docX = fused[0]!;
    assert.strictEqual(docX.channelDetails.length, 2);

    const ch0 = docX.channelDetails[0]!;
    assert.strictEqual(ch0.channelName, 'lexical_bm25');
    assert.strictEqual(ch0.channelIndex, 0);
    assert.strictEqual(ch0.rank, 1);
    assert.strictEqual(ch0.rawScore, 4.5);

    const ch1 = docX.channelDetails[1]!;
    assert.strictEqual(ch1.channelName, 'semantic_vector');
    assert.strictEqual(ch1.channelIndex, 1);
    assert.strictEqual(ch1.rank, 1);
    assert.strictEqual(ch1.rawScore, 0.91);
  });

  it('should adjust channel influence proportionally when weights are configured', () => {
    const channelBM25 = {
      name: 'bm25',
      weight: 3.0, // High priority lexical channel
      items: [
        { id: 'doc-bm25-top', score: 10, item: 'A' },
        { id: 'doc-hybrid', score: 8, item: 'B' },
      ],
    };

    const channelVector = {
      name: 'vector',
      weight: 0.5, // Low priority vector channel
      items: [
        { id: 'doc-vector-top', score: 0.99, item: 'C' },
        { id: 'doc-hybrid', score: 0.95, item: 'B' },
      ],
    };

    const fused = reciprocalRankFusion([channelBM25, channelVector]);

    // doc-bm25-top score: 3.0 / (60 + 1) = 3 / 61 ≈ 0.04918
    // doc-hybrid score: 3.0 / (60 + 2) + 0.5 / (60 + 2) = 3.5 / 62 ≈ 0.05645
    // doc-hybrid still wins because it is present in both channels!
    assert.strictEqual(fused[0]?.id, 'doc-hybrid');
    assert.strictEqual(fused[1]?.id, 'doc-bm25-top');
    assert.strictEqual(fused[2]?.id, 'doc-vector-top');
  });

  it('should handle edge cases in RRF (empty lists, deduplication, missing scores)', () => {
    // Empty rankedLists
    assert.deepStrictEqual(reciprocalRankFusion([]), []);

    // Empty items within a list
    const emptyList = { name: 'empty', items: [] };
    assert.deepStrictEqual(reciprocalRankFusion([emptyList]), []);

    // Duplicate item within the same list should only count once (highest rank)
    const dupeList = {
      name: 'dupe',
      weight: 1.0,
      items: [
        { id: 'doc-dup', score: 10, item: 'first' },
        { id: 'doc-dup', score: 5, item: 'second' },
      ],
    };
    const fused = reciprocalRankFusion([dupeList]);
    assert.strictEqual(fused.length, 1);
    assert.strictEqual(fused[0]?.channelDetails.length, 1);
    assert.strictEqual(fused[0]?.channelDetails[0]?.rank, 1);
  });
});
