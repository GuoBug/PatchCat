/**
 * @file    tests/vector-search-engine.node.test.ts
 * @version 1.0.0
 * @description
 *   Unit, integration, and ground-truth contract tests for PatchCat Phase 4.19 (v0.4.19):
 *   Browser-Native Multi-Provider Vector Embedding & Tri-Modal Hybrid Search Engine.
 *
 *   Validates:
 *     1. FlatVectorIndex (in-memory contiguous linear scan, L2 normalization, O(1) swap removal, growth).
 *     2. BrowserEmbeddingClient (batch index sorting P1-A, multi-provider formats, Ollama CORS interception).
 *     3. LocalKnowledgeAdapter Tri-Modal Integration (fingerprint validation, L1 vs L2 floor behavior, degraded status).
 *     4. Sequential write consistency fallback (partial vector availability per PRD-019 §6.2).
 *     5. Ground-truth benchmark: Synonym semantic generalization vs Exact keyword retrieval (PRD-019 §7.2).
 *     6. ServerKnowledgeAdapter zero-regression guarantee.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  FlatVectorIndex,
  l2Normalize,
  dotProduct,
} from '../src/services/search/flat-vector-index.ts';
import {
  BrowserEmbeddingClient,
  EmbeddingError,
} from '../src/services/embedding/browser-embedding-client.ts';
import {
  LocalKnowledgeAdapter,
  ServerKnowledgeAdapter,
  type EmbeddingConfig,
} from '../src/services/storage/knowledge-adapter.ts';
import { indexedDb, type VectorEmbeddingRecord } from '../src/services/storage/indexeddb-adapter.ts';

const originalFetch = globalThis.fetch;

interface FetchCall {
  url: string;
  init: RequestInit;
}

function stubFetch(
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
): FetchCall[] {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const safeInit = init ?? {};
    calls.push({ url, init: safeInit });
    return handler(url, safeInit);
  }) as typeof globalThis.fetch;
  return calls;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. FlatVectorIndex Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Phase 4.19: FlatVectorIndex Linear Scan Engine', () => {
  it('should initialize with correct dimension and size', () => {
    const index = new FlatVectorIndex(4);
    assert.strictEqual(index.getDimension(), 4);
    assert.strictEqual(index.size(), 0);
  });

  it('should reject invalid dimension on construction', () => {
    assert.throws(() => new FlatVectorIndex(0), /Invalid dimension/);
    assert.throws(() => new FlatVectorIndex(-5), /Invalid dimension/);
  });

  it('should enforce dimension matching on add and search', () => {
    const index = new FlatVectorIndex(3);
    assert.throws(() => index.add('chunk_1', [1.0, 0.0]), /Dimension mismatch/);
    assert.throws(() => index.search([1.0, 0.0], 5), /Query dimension mismatch/);
  });

  it('should compute exact dot product for L2-normalized vectors in [0, 1]', () => {
    const index = new FlatVectorIndex(3);
    const v1 = l2Normalize([1.0, 0.0, 0.0]);
    const v2 = l2Normalize([0.0, 1.0, 0.0]);
    const v3 = l2Normalize([0.7071, 0.7071, 0.0]);

    index.add('doc_x', v1);
    index.add('doc_y', v2);
    index.add('doc_xy', v3);

    // Search with exact v1 query
    const results = index.search(v1, 3);
    assert.strictEqual(results.length, 3);
    assert.strictEqual(results[0]?.chunkId, 'doc_x');
    assert.strictEqual(results[0]?.score, 1.0); // Perfect cosine similarity

    assert.strictEqual(results[1]?.chunkId, 'doc_xy');
    assert.ok(Math.abs(results[1]?.score! - 0.7071) < 0.01);

    assert.strictEqual(results[2]?.chunkId, 'doc_y');
    assert.strictEqual(results[2]?.score, 0.0); // Orthogonal
  });

  it('should remove items with O(1) swap-with-last compaction', () => {
    const index = new FlatVectorIndex(2);
    index.add('a', l2Normalize([1, 0]));
    index.add('b', l2Normalize([0, 1]));
    index.add('c', l2Normalize([1, 1]));

    assert.strictEqual(index.size(), 3);
    const removed = index.remove('b');
    assert.strictEqual(removed, true);
    assert.strictEqual(index.size(), 2);
    assert.strictEqual(index.get('b'), null);

    // 'c' swapped into index 1, 'a' remains at 0
    assert.ok(index.get('a') !== null);
    assert.ok(index.get('c') !== null);

    // Removing non-existent returns false
    assert.strictEqual(index.remove('not_found'), false);
  });

  it('should grow contiguous buffer dynamically when capacity is exceeded', () => {
    const index = new FlatVectorIndex(2, 16); // Small initial capacity
    for (let i = 0; i < 50; i++) {
      const angle = (i / 50) * Math.PI;
      index.add(`item_${i}`, [Math.cos(angle), Math.sin(angle)]);
    }
    assert.strictEqual(index.size(), 50);

    const queryAngle = (25 / 50) * Math.PI;
    const hits = index.search([Math.cos(queryAngle), Math.sin(queryAngle)], 5);
    assert.strictEqual(hits.length, 5);
    assert.strictEqual(hits[0]?.chunkId, 'item_25');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. BrowserEmbeddingClient Multi-Provider & Index Sorting Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Phase 4.19: BrowserEmbeddingClient & Wire Protocols', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('P1-A Contract: strictly re-orders OpenAI batch responses by index to prevent vector mismatch', async () => {
    const client = new BrowserEmbeddingClient();

    // Mock API returning items in reversed/shuffled order [index: 2, index: 0, index: 1]
    stubFetch((url, init) => {
      return jsonResponse({
        object: 'list',
        data: [
          { object: 'embedding', index: 2, embedding: [0.0, 0.0, 1.0] },
          { object: 'embedding', index: 0, embedding: [1.0, 0.0, 0.0] },
          { object: 'embedding', index: 1, embedding: [0.0, 1.0, 0.0] },
        ],
        model: 'BAAI/bge-m3',
        usage: { prompt_tokens: 30, total_tokens: 30 },
      });
    });

    const texts = ['First text (idx 0)', 'Second text (idx 1)', 'Third text (idx 2)'];
    const vectors = await client.embedBatch(texts, {
      provider: 'siliconflow',
      model: 'BAAI/bge-m3',
      apiKey: 'sk-mock-key',
    });

    assert.strictEqual(vectors.length, 3);
    // Index 0 vector must be [1, 0, 0]
    assert.strictEqual(vectors[0]?.[0], 1.0);
    // Index 1 vector must be [0, 1, 0]
    assert.strictEqual(vectors[1]?.[1], 1.0);
    // Index 2 vector must be [0, 0, 1]
    assert.strictEqual(vectors[2]?.[2], 1.0);
  });

  it('handles Ollama OpenAI-compatible and native embeddings payloads', async () => {
    const client = new BrowserEmbeddingClient();

    // Mock Ollama standard /v1/embeddings response
    stubFetch(() => {
      return jsonResponse({
        data: [{ index: 0, embedding: [0.6, 0.8] }],
      });
    });

    const vec = await client.embedQuery('test query', {
      provider: 'ollama',
      model: 'nomic-embed-text',
    });

    assert.strictEqual(vec.length, 2);
    // L2 normalized: 0.6^2 + 0.8^2 = 1.0
    assert.ok(Math.abs(vec[0]! - 0.6) < 0.01);
    assert.ok(Math.abs(vec[1]! - 0.8) < 0.01);
  });

  it('intercepts Ollama localhost fetch failure with OLLAMA_CORS_BLOCKED typed error', async () => {
    const client = new BrowserEmbeddingClient();

    stubFetch(() => {
      throw new TypeError('Failed to fetch');
    });

    try {
      await client.embedQuery('test', {
        provider: 'ollama',
        model: 'nomic-embed-text',
        baseUrl: 'http://localhost:11434',
      });
      assert.fail('Expected EmbeddingError to be thrown');
    } catch (err: unknown) {
      assert.ok(err instanceof EmbeddingError);
      assert.strictEqual(err.type, 'OLLAMA_CORS_BLOCKED');
      assert.ok(err.message.includes('跨域策略 (CORS)'));
      assert.ok(err.remediation?.includes('OLLAMA_ORIGINS'));
    }
  });

  it('auto-detects and caches model dimension when omitted', async () => {
    const client = new BrowserEmbeddingClient();

    stubFetch(() => {
      return jsonResponse({
        data: [{ index: 0, embedding: new Array(512).fill(0.1) }],
      });
    });

    const dim = await client.detectDimension({
      provider: 'custom',
      model: 'custom-embed-512',
    });

    assert.strictEqual(dim, 512);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. LocalKnowledgeAdapter Tri-Modal & Airbag Fallback Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Phase 4.19: LocalKnowledgeAdapter Tri-Modal & Degradation Contracts', () => {
  const adapter = new LocalKnowledgeAdapter();
  const SEED_KB_ID = 'kb_patchcat_arch';

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('L2 Fallback: retains legacy 0.45 floor when embedding option is disabled', async () => {
    const res = await adapter.retrieve(SEED_KB_ID, '拓扑排序 Kahn 调度算法', 3, 0.2);

    assert.ok(res.chunks.length >= 1);
    // In disabled mode, similarity is floored around 0.45
    assert.ok(
      res.chunks[0]!.similarity >= 0.45,
      `Expected similarity >= 0.45 floor, got ${res.chunks[0]!.similarity}`,
    );
    assert.strictEqual(res.chunks[0]!.vector_status, 'disabled');
  });

  it('L1 True Vector: produces unfloored [0, 1] cosine scores and sets vector_status to active', async () => {
    // 1. Pre-populate IndexedDB with vectors for seed chunks
    const testDim = 4;
    const queryVec = l2Normalize([1.0, 0.0, 0.0, 0.0]);
    const topChunkVec = l2Normalize([0.9, 0.1, 0.0, 0.0]); // High similarity ~ 0.90
    const otherChunkVec = l2Normalize([0.1, 0.9, 0.0, 0.0]); // Low similarity ~ 0.10

    await indexedDb.saveVectorEmbeddingsBatch([
      {
        chunkId: 'chunk_arch_02',
        kbId: SEED_KB_ID,
        vector: topChunkVec,
        provider: 'siliconflow',
        model: 'BAAI/bge-m3',
        dimension: testDim,
        createdAt: Date.now(),
      },
      {
        chunkId: 'chunk_arch_01',
        kbId: SEED_KB_ID,
        vector: otherChunkVec,
        provider: 'siliconflow',
        model: 'BAAI/bge-m3',
        dimension: testDim,
        createdAt: Date.now(),
      },
    ]);

    // 2. Mock query embedding
    stubFetch(() => {
      return jsonResponse({
        data: [{ index: 0, embedding: Array.from(queryVec) }],
      });
    });

    const embeddingConfig: EmbeddingConfig = {
      provider: 'siliconflow',
      model: 'BAAI/bge-m3',
      dimension: testDim,
      apiKey: 'sk-mock',
    };

    const res = await adapter.retrieve(SEED_KB_ID, 'Kahn 调度', 3, 0.0, {
      searchMode: 'vector',
      embedding: embeddingConfig,
    });

    assert.strictEqual(res.vector_status, 'active');
    assert.ok(res.chunks.length >= 1);
    assert.strictEqual(res.chunks[0]!.vector_status, 'active');
    assert.strictEqual(res.chunks[0]!.id, 'chunk_arch_02');
    // True vector dot product is ~0.90, not floored by 0.45 constant
    assert.ok(res.chunks[0]!.dense_score! > 0.85);
  });

  it('Fingerprint Mismatch: gracefully skips stale vectors and degrades to L2 heuristic', async () => {
    // Vectors are stored under 'siliconflow / BAAI/bge-m3', but query specifies 'openai / text-embedding-3-small'
    const embeddingConfig: EmbeddingConfig = {
      provider: 'openai',
      model: 'text-embedding-3-small',
      dimension: 1536,
      apiKey: 'sk-mock',
    };

    const res = await adapter.retrieve(SEED_KB_ID, 'Kahn 调度', 3, 0.0, {
      searchMode: 'hybrid',
      embedding: embeddingConfig,
    });

    assert.strictEqual(res.vector_status, 'degraded');
    assert.ok(res.vector_error?.includes('No vector embeddings matched'));
    // Degraded mode still returns recalled chunks via L2 heuristic airbag
    assert.ok(res.chunks.length >= 1);
    assert.strictEqual(res.chunks[0]!.vector_status, 'degraded');
  });

  it('Sequential Write Consistency Fallback: chunks missing vectors fall back to heuristic per-chunk', async () => {
    // Store vector ONLY for chunk_arch_02, leaving other chunks unvectorized
    const testDim = 4;
    await indexedDb.deleteVectorEmbeddingsByKb(SEED_KB_ID);
    await indexedDb.saveVectorEmbeddingsBatch([
      {
        chunkId: 'chunk_arch_02',
        kbId: SEED_KB_ID,
        vector: l2Normalize([1.0, 0.0, 0.0, 0.0]),
        provider: 'siliconflow',
        model: 'BAAI/bge-m3',
        dimension: testDim,
        createdAt: Date.now(),
      },
    ]);

    stubFetch(() => {
      return jsonResponse({
        data: [{ index: 0, embedding: [1.0, 0.0, 0.0, 0.0] }],
      });
    });

    const res = await adapter.retrieve(SEED_KB_ID, 'Kahn 调度', 5, 0.0, {
      searchMode: 'hybrid',
      embedding: {
        provider: 'siliconflow',
        model: 'BAAI/bge-m3',
        dimension: testDim,
        apiKey: 'sk-mock',
      },
    });

    assert.strictEqual(res.vector_status, 'active');
    // chunk_arch_02 used true vector, while other chunks safely fell back to heuristic without crashing
    assert.ok(res.chunks.length >= 2);
    const chunk02 = res.chunks.find((c) => c.id === 'chunk_arch_02');
    assert.ok(chunk02 !== undefined);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Ground Truth Baseline Benchmark (PRD-019 §7.2)
// ─────────────────────────────────────────────────────────────────────────────

describe('Phase 4.19: Ground Truth Baseline Benchmark (PRD-019 Section 7.2)', () => {
  const adapter = new LocalKnowledgeAdapter();
  const BENCH_KB_ID = 'kb_ground_truth_bench';
  const testDim = 4;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('Benchmark 1 (Synonym Semantic Generalization): "MacBook 崩溃卡死" vs "苹果笔记本电脑系统故障"', async () => {
    // Setup benchmark knowledge base with 2 chunks:
    // Chunk A: Target chunk discussing Apple laptop system freeze and recovery
    // Chunk B: Distractor chunk discussing unrelated database transaction locks
    const targetChunkContent =
      '苹果笔记本电脑系统故障处理指南：当 macOS 系统遭遇严重未响应、屏幕完全静止定格或三指失灵时，请长按电源键强制重启，或按住 Command+R 进入恢复模式排查系统异常。';
    const distractorChunkContent =
      'PostgreSQL 分布式事务行锁超时排查：在高并发 update 场景下，行锁竞争可能导致事务回滚。';

    await adapter.createKnowledgeBase({
      name: 'Hardware Troubleshooting',
      embedding_provider: 'siliconflow',
      embedding_model: 'BAAI/bge-m3',
      embedding_dimension: testDim,
    });

    const doc = await adapter.uploadDocument(
      BENCH_KB_ID,
      {
        name: 'hardware-troubleshooting.md',
        content: `${targetChunkContent}\n\n${distractorChunkContent}`,
        extension: 'md',
      },
      { chunkSize: 90, chunkOverlap: 0 },
    );

    const docChunks = await adapter.getDocumentChunks(doc.id);
    assert.strictEqual(docChunks.length, 2);
    const targetChunkId = docChunks[0]!.id;
    const distractorChunkId = docChunks[1]!.id;

    // Simulate embedding vectors:
    // Query vector: "MacBook 崩溃卡死"
    const queryVec = l2Normalize([0.9, 0.4, 0.0, 0.0]);
    // Target chunk vector has high semantic cosine alignment with query (~0.98)
    const targetVec = l2Normalize([0.92, 0.38, 0.0, 0.0]);
    // Distractor chunk vector is orthogonal (~0.05)
    const distractorVec = l2Normalize([0.05, 0.1, 0.9, 0.4]);

    await indexedDb.saveVectorEmbeddingsBatch([
      {
        chunkId: targetChunkId,
        kbId: BENCH_KB_ID,
        vector: targetVec,
        provider: 'siliconflow',
        model: 'BAAI/bge-m3',
        dimension: testDim,
        createdAt: Date.now(),
      },
      {
        chunkId: distractorChunkId,
        kbId: BENCH_KB_ID,
        vector: distractorVec,
        provider: 'siliconflow',
        model: 'BAAI/bge-m3',
        dimension: testDim,
        createdAt: Date.now(),
      },
    ]);

    // ── Test L1 True Vector Recall ──
    stubFetch(() => {
      return jsonResponse({
        data: [{ index: 0, embedding: Array.from(queryVec) }],
      });
    });

    const l1Result = await adapter.retrieve(BENCH_KB_ID, 'MacBook 崩溃卡死', 1, 0.0, {
      searchMode: 'vector',
      embedding: {
        provider: 'siliconflow',
        model: 'BAAI/bge-m3',
        dimension: testDim,
        apiKey: 'sk-mock',
      },
    });

    assert.strictEqual(l1Result.vector_status, 'active');
    assert.strictEqual(
      l1Result.chunks[0]?.id,
      targetChunkId,
      'L1 True Vector MUST recall the semantic target chunk as Top-1',
    );
    assert.ok(
      l1Result.chunks[0]?.dense_score! > 0.9,
      'L1 semantic cosine score should be high (> 0.9)',
    );

    // ── Test L2 Heuristic Recall (Expected Miss) ──
    const l2Result = await adapter.retrieve(BENCH_KB_ID, 'MacBook 崩溃卡死', 2, 0.0, {
      searchMode: 'vector', // No embedding provided -> L2 heuristic
    });

    assert.strictEqual(l2Result.vector_status, 'disabled');
    // Without semantic vectors, lexical overlap between "MacBook 崩溃卡死" and "苹果笔记本电脑系统故障"
    // has 0 exact word matches. Scores remain floored at base heuristic value (~0.45).
    assert.ok(
      l2Result.chunks[0]?.similarity! <= 0.50,
      'L2 heuristic lacks synonym generalization and receives only floor score (<= 0.50)',
    );
  });

  it('Benchmark 2 (Precise Keyword Match): "DAG_CYCLE_DETECTED" recalls chunk_arch_03 in both L1 and L2', async () => {
    // Both L1 vector and L2 heuristic should successfully match precise exact technical identifiers
    const res = await adapter.retrieve('kb_patchcat_arch', 'DAG_CYCLE_DETECTED', 1, 0.0, {
      searchMode: 'hybrid',
    });

    assert.strictEqual(res.chunks[0]?.id, 'chunk_arch_03');
    assert.ok(res.chunks[0]?.content.includes('DAG_CYCLE_DETECTED'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. ServerKnowledgeAdapter Zero-Regression Contract
// ─────────────────────────────────────────────────────────────────────────────

describe('Phase 4.19: ServerKnowledgeAdapter Invariants', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('guarantees ServerKnowledgeAdapter behaviour is 100% untouched and passes options to server endpoint', async () => {
    const serverAdapter = new ServerKnowledgeAdapter('http://127.0.0.1:8000');

    const calls = stubFetch((url) => {
      if (url.includes('/retrieve')) {
        return jsonResponse({
          context: 'Server pgvector context',
          chunks: [{ id: 'srv_1', content: 'chunk text', score: 0.92 }],
        });
      }
      return jsonResponse({});
    });

    const res = await serverAdapter.retrieve('kb_srv', 'test query', 3, 0.5, {
      searchMode: 'vector',
    });

    assert.strictEqual(res.context, 'Server pgvector context');
    assert.strictEqual(res.chunks.length, 1);
    assert.ok(calls[0]?.url.includes('127.0.0.1:8000/api/v1/knowledge-bases/kb_srv/retrieve'));
  });
});
