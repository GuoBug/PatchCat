/**
 * @file    tests/bm25-hybrid-search.node.test.ts
 * @version 1.0.0
 * @description
 *   Integration and contract tests for PatchCat v0.4.14 Lightweight Hybrid Search (BM25 + Dense Vector).
 *   Validates:
 *     - Multi-mode retrieval in LocalKnowledgeAdapter ('hybrid', 'bm25', 'vector').
 *     - Exact keyword & error code matching (RFC-101, Kahn, DAG_CYCLE_DETECTED).
 *     - Multi-channel Reciprocal Rank Fusion (RRF) and chunk telemetry observability.
 *     - Backward compatibility for legacy 4-argument retrieve calls and safety fallbacks.
 *     - End-to-end execution of knowledge node within BrowserWorkflowEngine.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LocalKnowledgeAdapter } from '../src/services/storage/knowledge-adapter.ts';
import { BrowserWorkflowEngine } from '../src/engine/browser-engine.ts';
import type { WorkflowGraph, WorkflowNode } from '../src/engine/types.ts';

describe('LocalKnowledgeAdapter Multi-Mode & Hybrid RAG Retrieval', () => {
  const adapter = new LocalKnowledgeAdapter();
  const SEED_KB_ID = 'kb_patchcat_arch';

  it('should retrieve chunks in default hybrid mode and attach RRF & BM25 telemetry', async () => {
    const res = await adapter.retrieve(SEED_KB_ID, '拓扑排序 Kahn 调度算法', 3, 0.2);

    assert.ok(res.chunks.length >= 1, 'Should recall at least 1 chunk');
    assert.ok(res.context.includes('Kahn'), 'Context should contain Kahn');
    assert.ok(res.chunks[0].similarity >= 0.65, `Expected high similarity >= 0.65, got ${res.chunks[0].similarity}`);

    const topChunk = res.chunks[0];
    assert.strictEqual(topChunk.search_mode, 'hybrid');
    assert.ok(typeof topChunk.bm25_score === 'number' && topChunk.bm25_score > 0, 'bm25_score should be positive');
    assert.ok(typeof topChunk.dense_score === 'number' && topChunk.dense_score > 0, 'dense_score should be positive');
    assert.ok(typeof topChunk.rrf_score === 'number' && topChunk.rrf_score > 0, 'rrf_score should be positive');
    assert.ok(Array.isArray(topChunk.matched_terms), 'matched_terms should be array');
    assert.ok(topChunk.matched_terms.length > 0, 'matched_terms should not be empty');
  });

  it('should retrieve chunks in pure BM25 mode with lexical exact matching', async () => {
    const res = await adapter.retrieve(SEED_KB_ID, 'Kahn', 3, 0.0, { searchMode: 'bm25' });

    assert.ok(res.chunks.length >= 1);
    assert.strictEqual(res.chunks[0].search_mode, 'bm25');
    assert.ok(typeof res.chunks[0].bm25_score === 'number');
    assert.ok(res.chunks[0].matched_terms?.includes('kahn'));
    // In pure BM25 mode, rrf_score and dense_score should be undefined
    assert.strictEqual(res.chunks[0].rrf_score, undefined);
    assert.strictEqual(res.chunks[0].dense_score, undefined);
  });

  it('should retrieve chunks in pure vector mode with semantic scoring', async () => {
    const res = await adapter.retrieve(SEED_KB_ID, 'Kahn 调度', 3, 0.0, { searchMode: 'vector' });

    assert.ok(res.chunks.length >= 1);
    assert.strictEqual(res.chunks[0].search_mode, 'vector');
    assert.ok(typeof res.chunks[0].dense_score === 'number');
    assert.strictEqual(res.chunks[0].bm25_score, undefined);
    assert.strictEqual(res.chunks[0].rrf_score, undefined);
  });

  it('should boost exact technical identifiers (DAG_CYCLE_DETECTED, RFC-101) to rank #1 in BM25 & Hybrid modes', async () => {
    // 1. Query for the exact error code: DAG_CYCLE_DETECTED
    const cycleResBM25 = await adapter.retrieve(SEED_KB_ID, 'DAG_CYCLE_DETECTED', 1, 0.0, {
      searchMode: 'bm25',
    });
    assert.strictEqual(cycleResBM25.chunks[0].id, 'chunk_arch_03', 'DAG_CYCLE_DETECTED must hit Chapter 3 chunk');
    assert.ok(cycleResBM25.chunks[0].matched_terms?.includes('dag_cycle_detected'));

    const cycleResHybrid = await adapter.retrieve(SEED_KB_ID, 'DAG_CYCLE_DETECTED', 1, 0.0, {
      searchMode: 'hybrid',
    });
    assert.strictEqual(cycleResHybrid.chunks[0].id, 'chunk_arch_03', 'Hybrid search must also rank Chapter 3 #1');
    assert.ok(cycleResHybrid.chunks[0].similarity >= 0.65);

    // 2. Query for RFC-101
    const rfcRes = await adapter.retrieve(SEED_KB_ID, 'RFC-101', 3, 0.0, { searchMode: 'hybrid' });
    assert.ok(rfcRes.chunks.length >= 1);
    assert.ok(rfcRes.chunks.some((c) => c.matched_terms?.includes('rfc-101')));
  });

  it('should reflect channel weights in hybrid retrieval ranking', async () => {
    // When bm25Weight is dominant vs vectorWeight dominant
    const bm25Dominant = await adapter.retrieve(SEED_KB_ID, 'DAG_CYCLE_DETECTED', 3, 0.0, {
      searchMode: 'hybrid',
      bm25Weight: 1.0,
      vectorWeight: 0.1,
    });
    assert.strictEqual(bm25Dominant.chunks[0].id, 'chunk_arch_03');

    const vectorDominant = await adapter.retrieve(SEED_KB_ID, '拓扑排序 Kahn', 3, 0.0, {
      searchMode: 'hybrid',
      bm25Weight: 0.1,
      vectorWeight: 1.0,
    });
    assert.ok(vectorDominant.chunks.length >= 1);
  });

  it('should maintain backward compatibility for 4-argument retrieve calls and handle empty inputs safely', async () => {
    // Legacy 4-argument call (no options passed)
    const legacyRes = await adapter.retrieve(SEED_KB_ID, 'PatchCat 架构', 2, 0.3);
    assert.ok(legacyRes.chunks.length <= 2);
    assert.strictEqual(legacyRes.chunks[0].search_mode, 'hybrid');

    // Empty query fallback
    const emptyQueryRes = await adapter.retrieve(SEED_KB_ID, '', 2);
    assert.ok(Array.isArray(emptyQueryRes.chunks));

    // Whitespace only query
    const wsQueryRes = await adapter.retrieve(SEED_KB_ID, '   ', 2);
    assert.ok(Array.isArray(wsQueryRes.chunks));

    // Non-existent KB
    const nonExistentRes = await adapter.retrieve('kb_non_existent', 'test query');
    assert.deepStrictEqual(nonExistentRes, { context: '', chunks: [] });
  });
});

describe('BrowserWorkflowEngine Knowledge Node Hybrid Search Execution', () => {
  const engine = new BrowserWorkflowEngine();
  const adapter = new LocalKnowledgeAdapter();

  it('should execute knowledge node with hybrid searchMode and emit enriched chunk telemetry', async () => {
    const node: WorkflowNode = {
      id: 'kb_node_test',
      type: 'knowledge',
      position: { x: 0, y: 0 },
      data: {
        label: 'Knowledge Retrieval',
        type: 'knowledge',
        status: 'idle',
        inputs: {},
        outputs: {},
        config: {
          knowledgeBaseId: 'kb_patchcat_arch',
          query: 'DAG_CYCLE_DETECTED',
          topK: 2,
          scoreThreshold: 0.1,
          searchMode: 'hybrid',
          bm25Weight: 0.6,
          vectorWeight: 0.4,
        },
      },
    };

    const graph: WorkflowGraph = {
      nodes: [node],
      edges: [],
    };

    const events: unknown[] = [];
    for await (const event of engine.executeWorkflow(graph, {
      skipLLM: true,
      context: { knowledgeAdapter: adapter },
    })) {
      events.push(event);
    }

    const completeEvent = events.find(
      (e: any) => e.type === 'NODE_COMPLETE' && e.payload?.nodeId === 'kb_node_test',
    ) as any;

    assert.ok(completeEvent, 'Knowledge node must complete');
    const out = completeEvent.payload.output;
    assert.strictEqual(out.searchMode, 'hybrid');
    assert.ok(Array.isArray(out.chunks));
    assert.ok(out.chunks.length >= 1);
    assert.strictEqual(out.chunks[0].id, 'chunk_arch_03');
    assert.strictEqual(out.chunks[0].search_mode, 'hybrid');
    assert.ok(typeof out.chunks[0].bm25_score === 'number');
    assert.ok(out.chunks[0].matched_terms.includes('dag_cycle_detected'));
  });
});
