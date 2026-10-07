/**
 * @file tests/rerank-adapter.node.test.ts
 * @description Contract and integration tests for Phase 2:
 *              Two-Stage Cross-Encoder Reranking in LocalKnowledgeAdapter,
 *              threshold decoupling, graceful degradation airbags, and Server mode warning.
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  LocalKnowledgeAdapter,
  ServerKnowledgeAdapter,
  type KnowledgeRetrieveOptions,
} from '../src/services/storage/knowledge-adapter.ts';
import { BrowserWorkflowEngine } from '../src/engine/browser-engine.ts';
import type { WorkflowGraph, WorkflowNode } from '../src/engine/types.ts';

const originalFetch = globalThis.fetch;

interface FetchCall {
  url: string;
  init: RequestInit;
}

function stubFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>): FetchCall[] {
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

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const SEED_KB_ID = 'kb_patchcat_arch';

describe('LocalKnowledgeAdapter — Two-Stage Cross-Encoder Reranking', () => {
  const adapter = new LocalKnowledgeAdapter();

  it('should reorder coarse candidates according to Cross-Encoder scores and attach telemetry', async () => {
    const fetchCalls = stubFetch((url, init) => {
      assert.ok(url.endsWith('/v2/rerank'));
      const body = JSON.parse(String(init.body));
      assert.equal(body.query, 'Kahn 调度死锁检测');
      assert.ok(Array.isArray(body.documents));
      assert.ok(body.documents.length >= 3);

      // Invert or promote candidate index 2 to rank #1
      return jsonResponse({
        results: [
          { index: 2, relevance_score: 0.9654 },
          { index: 0, relevance_score: 0.8123 },
          { index: 1, relevance_score: 0.5432 },
        ],
      });
    });

    const options: KnowledgeRetrieveOptions = {
      searchMode: 'hybrid',
      rerank: {
        enabled: true,
        protocol: 'cohere',
        baseUrl: 'https://api.cohere.com',
        model: 'rerank-v3.5',
        topN: 3,
      },
    };

    const res = await adapter.retrieve(SEED_KB_ID, 'Kahn 调度死锁检测', 3, 0.0, options);

    assert.equal(fetchCalls.length, 1);
    assert.equal(res.chunks.length, 3);

    // Verify candidate 2 was promoted to rank #1
    assert.equal(res.chunks[0].rerank_score, 0.9654);
    assert.equal(res.chunks[1].rerank_score, 0.8123);
    assert.equal(res.chunks[2].rerank_score, 0.5432);

    // `similarity` must retain the coarse-stage value instead of being overwritten
    // by the cross-encoder score, otherwise provenance is destroyed and the emitted
    // chunk mixes two score domains under one label.
    assert.notEqual(
      res.chunks[0].similarity,
      0.9654,
      'similarity must stay on the coarse scale, not mirror rerank_score',
    );
    assert.ok(
      res.chunks[0].similarity >= 0.45,
      `coarse similarity is floored around 0.45, got ${res.chunks[0].similarity}`,
    );

    // Verify rank telemetry invariants
    assert.equal(res.chunks[0].original_rank, 3, 'candidate index 2 should have original_rank 3');
    assert.equal(res.chunks[0].rerank_rank, 1, 'promoted candidate should have rerank_rank 1');
    assert.equal(res.chunks[0].rank_delta, 2, 'rank_delta should be +2 (promoted by 2 positions)');

    assert.equal(res.chunks[1].original_rank, 1);
    assert.equal(res.chunks[1].rerank_rank, 2);
    assert.equal(res.chunks[1].rank_delta, -1, 'rank_delta should be -1 (demoted by 1 position)');

    assert.equal(res.chunks[2].original_rank, 2);
    assert.equal(res.chunks[2].rerank_rank, 3);
    assert.equal(res.chunks[2].rank_delta, -1);

    // Verify context formatting contains granular rerank score
    assert.ok(res.context.includes('- Rerank: 0.9654'));
  });

  it('should support TEI bare-array response and apply sigmoid normalization', async () => {
    stubFetch((url) => {
      assert.ok(url.endsWith('/rerank'));
      // HuggingFace TEI returns bare array with raw logits
      return jsonResponse([
        { index: 1, score: 2.5 },
        { index: 0, score: -0.5 },
      ]);
    });

    const res = await adapter.retrieve(SEED_KB_ID, '死锁检测', 2, 0.0, {
      rerank: {
        enabled: true,
        protocol: 'tei',
        baseUrl: 'http://localhost:8080',
        model: 'bge-reranker-large',
      },
    });

    assert.equal(res.chunks.length, 2);
    // index 1 had logit 2.5 -> sigmoid(2.5) ~ 0.9241
    assert.ok(
      res.chunks[0].rerank_score! > 0.9,
      `Expected rerank_score > 0.9, got ${res.chunks[0].rerank_score}`,
    );
    // index 0 had logit -0.5 -> sigmoid(-0.5) ~ 0.3775
    assert.ok(
      res.chunks[1].rerank_score! < 0.5,
      `Expected rerank_score < 0.5, got ${res.chunks[1].rerank_score}`,
    );
    assert.ok(res.chunks[0].rerank_score! > res.chunks[1].rerank_score!);
  });

  it('should filter post-rerank items using rerank.scoreThreshold override', async () => {
    stubFetch(() => {
      return jsonResponse({
        results: [
          { index: 0, relevance_score: 0.88 },
          { index: 1, relevance_score: 0.72 },
          { index: 2, relevance_score: 0.45 },
        ],
      });
    });

    // Pass coarse scoreThreshold=0.0, but strict rerank.scoreThreshold=0.75
    const res = await adapter.retrieve(SEED_KB_ID, '拓扑排序', 3, 0.0, {
      rerank: {
        enabled: true,
        protocol: 'jina',
        baseUrl: 'https://api.jina.ai',
        model: 'jina-reranker-v2',
        scoreThreshold: 0.75, // Should filter out 0.72 and 0.45
      },
    });

    assert.equal(res.chunks.length, 1);
    assert.equal(res.chunks[0].rerank_score, 0.88);
  });

  it('should NOT inherit the coarse scoreThreshold for rerank scores (different scales)', async () => {
    stubFetch(() => {
      return jsonResponse({
        results: [
          { index: 0, relevance_score: 0.85 },
          { index: 1, relevance_score: 0.65 },
        ],
      });
    });

    // Coarse scoreThreshold 0.70 is meaningful on the coarse scale (floored ~0.45)
    // but would be a heavy cutoff on sigmoid rerank scores. It must not be reused.
    const res = await adapter.retrieve(SEED_KB_ID, '拓扑排序', 3, 0.70, {
      rerank: {
        enabled: true,
        protocol: 'openai',
        baseUrl: 'https://api.siliconflow.cn',
        model: 'BAAI/bge-reranker-v2-m3',
      },
    });

    assert.equal(
      res.chunks.length,
      2,
      'Coarse scoreThreshold must not filter rerank results — the two live on different scales',
    );
    assert.equal(res.chunks[0].rerank_score, 0.85);
    assert.equal(res.chunks[1].rerank_score, 0.65);
  });

  it('CRITICAL AIRBAG: should gracefully fall back to coarse RRF retrieval without applying rerank threshold when reranker endpoint fails', async () => {
    stubFetch(() => {
      return jsonResponse({ error: 'Internal Server Error' }, 500);
    });

    // Even if rerank.scoreThreshold is 0.95 (which would kill all coarse candidates if misapplied),
    // the fallback MUST preserve coarse candidates using outer scoreThreshold (0.1).
    const res = await adapter.retrieve(SEED_KB_ID, 'Kahn 算法', 3, 0.1, {
      searchMode: 'hybrid',
      rerank: {
        enabled: true,
        protocol: 'cohere',
        baseUrl: 'https://api.cohere.com',
        model: 'rerank-v3.5',
        scoreThreshold: 0.95, // Must NOT wipe out fallback!
      },
    });

    assert.ok(res.chunks.length >= 1, 'Degradation airbag must return coarse candidates');
    assert.equal(res.chunks[0].rerank_score, undefined, 'Coarse fallback chunks must not have rerank_score');
    assert.strictEqual(res.chunks[0].search_mode, 'hybrid');
    assert.ok(res.context.includes('Kahn'));
  });

  it('CRITICAL AIRBAG: should gracefully fall back on network exception / timeout', async () => {
    stubFetch(() => {
      throw new TypeError('Failed to fetch (DNS / network drop)');
    });

    const res = await adapter.retrieve(SEED_KB_ID, '拓扑排序', 2, 0.0, {
      rerank: {
        enabled: true,
        protocol: 'jina',
        baseUrl: 'https://api.jina.ai',
        model: 'jina-reranker-v2',
      },
    });

    assert.ok(res.chunks.length >= 1, 'Should fall back to coarse results on network drop');
    assert.equal(res.chunks[0].rerank_score, undefined);
  });

  it('should respect candidatePoolSize to constrain API candidate load', async () => {
    let sentCandidateCount = 0;
    stubFetch((_url, init) => {
      const body = JSON.parse(String(init.body));
      sentCandidateCount = body.documents.length;
      return jsonResponse({
        results: body.documents.map((_: unknown, i: number) => ({ index: i, relevance_score: 0.9 })),
      });
    });

    await adapter.retrieve(SEED_KB_ID, 'RFC-101 规范', 3, 0.0, {
      rerank: {
        enabled: true,
        protocol: 'cohere',
        baseUrl: 'https://api.cohere.com',
        model: 'rerank-v3.5',
        candidatePoolSize: 2, // Strictly limit pool to 2 candidates
      },
    });

    assert.equal(sentCandidateCount, 2, 'Should only send candidatePoolSize candidates to provider');
  });

  it('should bypass reranker completely when rerank.enabled is false', async () => {
    let fetchCalled = false;
    stubFetch(() => {
      fetchCalled = true;
      return jsonResponse({ results: [] });
    });

    const res = await adapter.retrieve(SEED_KB_ID, 'Kahn', 3, 0.0, {
      rerank: {
        enabled: false,
        protocol: 'cohere',
        baseUrl: 'https://api.cohere.com',
        model: 'rerank-v3.5',
      },
    });

    assert.equal(fetchCalled, false, 'Fetch must not be called when rerank is disabled');
    assert.ok(res.chunks.length >= 1);
  });
});

describe('ServerKnowledgeAdapter — Unsupported Options Handling', () => {
  it('should issue warning and skip rerank parameters in Server mode', async () => {
    const serverAdapter = new ServerKnowledgeAdapter('http://127.0.0.1:8000');
    let capturedBody: Record<string, unknown> | null = null;

    stubFetch((url, init) => {
      assert.ok(url.includes('/api/v1/knowledge-bases/kb_123/retrieve'));
      capturedBody = JSON.parse(String(init.body));
      return jsonResponse({
        context: 'Server context',
        chunks: [],
      });
    });

    const res = await serverAdapter.retrieve('kb_123', 'test query', 3, 0.0, {
      searchMode: 'hybrid',
      rerank: {
        enabled: true,
        protocol: 'cohere',
        baseUrl: 'https://api.cohere.com',
        model: 'rerank-v3.5',
      },
    });

    assert.equal(res.context, 'Server context');
    assert.ok(capturedBody !== null);
    // Backend body does NOT contain rerank object
    assert.equal((capturedBody as any).rerank, undefined);
  });
});

describe('BrowserWorkflowEngine — Knowledge Node with Reranker in Local Mode', () => {
  const engine = new BrowserWorkflowEngine();

  it('should execute knowledge node with reranking in workflow and pass reranked context downstream', async () => {
    stubFetch((url) => {
      assert.ok(url.endsWith('/v2/rerank'));
      return jsonResponse({
        results: [
          { index: 1, relevance_score: 0.9789 },
          { index: 0, relevance_score: 0.7412 },
        ],
      });
    });

    const node: WorkflowNode = {
      id: 'knowledge_node_1',
      type: 'knowledge',
      position: { x: 0, y: 0 },
      data: {
        label: 'PatchCat Reranked KB',
        type: 'knowledge',
        status: 'idle',
        inputs: {},
        outputs: {},
        config: {
          knowledgeBaseId: SEED_KB_ID,
          query: 'Kahn 调度',
          topK: 2,
          scoreThreshold: 0.0,
          rerank: {
            enabled: true,
            protocol: 'cohere',
            baseUrl: 'https://api.cohere.com',
            model: 'rerank-v3.5',
          },
        },
      },
    };

    const graph: WorkflowGraph = {
      nodes: [node],
      edges: [],
    };

    const localAdapter = new LocalKnowledgeAdapter();
    const events: any[] = [];
    for await (const event of engine.executeWorkflow(graph, {
      context: {
        knowledgeAdapter: localAdapter,
      },
    })) {
      events.push(event);
    }

    const completed = events.find(
      (e) => e.type === 'NODE_COMPLETE' && e.payload?.nodeId === 'knowledge_node_1',
    );

    assert.ok(completed, 'Node should complete');
    const output = completed.payload.output;
    assert.ok(output.chunks.length >= 1);
    assert.equal(output.chunks[0].rerank_score, 0.9789);
    assert.ok(output.context.includes('Rerank: 0.9789'));
  });
});
