/**
 * @file    tests/workflow-version-snapshots.node.test.ts
 * @version 1.0.0
 * @description
 *   Comprehensive unit & integration tests for PRD-020 Part B:
 *   - Workflow Version Snapshots & IndexedDB v7 persistence
 *   - 30-version hard quota enforcement without silent eviction
 *   - Credential stripping & execution output sanitization
 *   - Canonical graph hash invariance (order-independent, layout-independent)
 *   - Structural DAG Diff engine (nodes, edges, layout-only folding, line diff)
 *   - Atomic rollback and Ctrl+Z undo stack integration
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  indexedDb,
  STORES,
  WorkflowVersionQuotaError,
  type WorkflowVersionRecord,
} from '../src/services/storage/indexeddb-adapter.ts';
import {
  canonicalizeGraph,
  computeCanonicalGraphHash,
  diffWorkflowGraphs,
  diffTextLines,
  edgeLogicalKey,
} from '../src/services/diff/workflow-diff.ts';
import {
  createWorkflowVersion,
  listWorkflowVersions,
  getWorkflowVersion,
  deleteWorkflowVersion,
  prepareVersionGraph,
  getDirtyState,
  DuplicateWorkflowVersionError,
  MAX_WORKFLOW_VERSIONS,
} from '../src/services/versioning/workflow-version-service.ts';
import { useWorkflowStore } from '../src/stores/workflow-store.ts';
import type { WorkflowNode, WorkflowEdge } from '../src/engine/types.ts';

// Helper to construct test nodes
function createMockNode(
  id: string,
  type: string,
  position = { x: 100, y: 100 },
  config: Record<string, unknown> = {},
  outputs: Record<string, unknown> = {},
): WorkflowNode {
  return {
    id,
    type: type as any,
    position,
    data: {
      id,
      label: `Node ${id}`,
      type: type as any,
      status: 'idle',
      inputs: {},
      outputs,
      config,
    },
  } as WorkflowNode;
}

function createMockEdge(source: string, target: string, sourceHandle = 'out', targetHandle = 'in'): WorkflowEdge {
  return {
    id: `edge_${source}_${target}`,
    source,
    target,
    sourceHandle,
    targetHandle,
  };
}

describe('PRD-020 Part B: Workflow Version Snapshots & Structural Diff', () => {
  beforeEach(async () => {
    indexedDb.resetWriteCount();
    await indexedDb.clear(STORES.WORKFLOW_VERSIONS);
    useWorkflowStore.setState({ nodes: [], edges: [], isExecuting: false });
  });

  // ── 1. Canonical Graph Hashing & Invariance ───────────────────────────────
  describe('1. Canonical Graph Hashing & Invariance (PRD-020 §3.2)', () => {
    it('generates a 64-character hex SHA-256 digest', async () => {
      const nodes = [createMockNode('n1', 'input')];
      const edges = [createMockEdge('n1', 'n2')];
      const hash = await computeCanonicalGraphHash(nodes, edges);

      assert.equal(typeof hash, 'string');
      assert.equal(hash.length, 64);
      assert.match(hash, /^[0-9a-f]{64}$/);
    });

    it('is strictly invariant to node array permutation', async () => {
      const n1 = createMockNode('node_a', 'prompt', { x: 0, y: 0 }, { template: 'Hello' });
      const n2 = createMockNode('node_b', 'llm', { x: 100, y: 100 }, { model: 'gpt-4o' });
      const n3 = createMockNode('node_c', 'output', { x: 200, y: 200 });
      const edges = [createMockEdge('node_a', 'node_b'), createMockEdge('node_b', 'node_c')];

      const hash1 = await computeCanonicalGraphHash([n1, n2, n3], edges);
      const hash2 = await computeCanonicalGraphHash([n3, n1, n2], edges);
      const hash3 = await computeCanonicalGraphHash([n2, n3, n1], edges);

      assert.equal(hash1, hash2);
      assert.equal(hash2, hash3);
    });

    it('is strictly invariant to edge array permutation and edge IDs', async () => {
      const nodes = [createMockNode('a', 'input'), createMockNode('b', 'llm'), createMockNode('c', 'output')];
      const e1: WorkflowEdge = { id: 'random_id_1', source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' };
      const e2: WorkflowEdge = { id: 'random_id_2', source: 'b', target: 'c', sourceHandle: 'out', targetHandle: 'in' };

      const hash1 = await computeCanonicalGraphHash(nodes, [e1, e2]);

      // Swap edge IDs and order
      const e1Alt: WorkflowEdge = { id: 'different_id_A', source: 'b', target: 'c', sourceHandle: 'out', targetHandle: 'in' };
      const e2Alt: WorkflowEdge = { id: 'different_id_B', source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' };
      const hash2 = await computeCanonicalGraphHash(nodes, [e1Alt, e2Alt]);

      assert.equal(hash1, hash2);
    });

    it('is invariant to node coordinate changes (layout movements)', async () => {
      const n1 = createMockNode('n1', 'prompt', { x: 50, y: 50 }, { template: 'Query' });
      const n2 = createMockNode('n1', 'prompt', { x: 999, y: 888 }, { template: 'Query' });

      const hashOriginal = await computeCanonicalGraphHash([n1], []);
      const hashMoved = await computeCanonicalGraphHash([n2], []);

      assert.equal(hashOriginal, hashMoved);
    });

    it('produces avalanche change on any logical config modification', async () => {
      const n1 = createMockNode('n1', 'llm', { x: 0, y: 0 }, { temperature: 0.7 });
      const n2 = createMockNode('n1', 'llm', { x: 0, y: 0 }, { temperature: 0.8 });

      const hash1 = await computeCanonicalGraphHash([n1], []);
      const hash2 = await computeCanonicalGraphHash([n2], []);

      assert.notEqual(hash1, hash2);
    });
  });

  // ── 2. Data Sanitization & Zero Plaintext ──────────────────────────────────
  describe('2. Data Sanitization & Zero Plaintext (PRD-020 §3.1.3)', () => {
    it('unconditionally strips API keys (including nested embedding & rerank) and clears runtime outputs', () => {
      const dirtyNode = createMockNode(
        'node_llm',
        'llm',
        { x: 100, y: 100 },
        {
          model: 'gpt-4o',
          apiKey: 'sk-secret-leak-12345',
          providerOverride: { apiKey: 'sk-provider-secret-67890' },
          embedding: { apiKey: 'sk-embedding-secret-abc' },
          rerank: { apiKey: 'sk-rerank-secret-def' },
        },
        { result: 'Transient big output buffer that should not be in snapshot' },
      );
      (dirtyNode.data as any).status = 'success';
      (dirtyNode.data as any).executionResult = { latencyMs: 500 };
      (dirtyNode as any).selected = true;
      (dirtyNode as any).dragging = true;

      const prepared = prepareVersionGraph([dirtyNode], []);

      assert.equal(prepared.strippedApiKeysCount >= 4, true);
      assert.equal(prepared.nodes.length, 1);
      assert.equal(prepared.isSanitized, true);

      const cleanNode = prepared.nodes[0]!;
      assert.equal((cleanNode as any).selected, undefined);
      assert.equal((cleanNode as any).dragging, undefined);
      assert.equal((cleanNode.data as any).outputs, undefined);
      assert.equal((cleanNode.data as any).status, undefined);
      assert.equal((cleanNode.data as any).executionResult, undefined);

      // Verify all credentials stripped of non-empty secret values
      assert.ok(!cleanNode.data.config['apiKey'] || cleanNode.data.config['apiKey'] === '');
      const po = cleanNode.data.config['providerOverride'] as Record<string, unknown>;
      assert.ok(!po?.['apiKey'] || po?.['apiKey'] === '');
      const emb = cleanNode.data.config['embedding'] as Record<string, unknown>;
      assert.ok(!emb?.['apiKey'] || emb?.['apiKey'] === '');
      const rerank = cleanNode.data.config['rerank'] as Record<string, unknown>;
      assert.ok(!rerank?.['apiKey'] || rerank?.['apiKey'] === '');
    });

    it('preserves prompt template text and node positions intact without destructive masking', () => {
      const promptNode = createMockNode('p1', 'prompt', { x: 350, y: 420 }, {
        template: 'You are an assistant. Please answer {{user_query}}.',
      });

      const prepared = prepareVersionGraph([promptNode], []);
      const cleanNode = prepared.nodes[0]!;

      assert.equal(cleanNode.position.x, 350);
      assert.equal(cleanNode.position.y, 420);
      assert.equal(cleanNode.data.config['template'], 'You are an assistant. Please answer {{user_query}}.');
    });
  });

  // ── 3. Version CRUD & Quota Governance ────────────────────────────────────
  describe('3. Version CRUD & Quota Governance (PRD-020 §3.1.4)', () => {
    it('creates, lists and retrieves workflow versions ordered newest first', async () => {
      const nodes = [createMockNode('n1', 'input')];
      const wfId = 'wf_test_1';

      const v1 = await createWorkflowVersion({
        workflowId: wfId,
        label: 'Version 1',
        description: 'First milestone',
        nodes,
        edges: [],
        now: 1000,
      });

      const v2 = await createWorkflowVersion({
        workflowId: wfId,
        label: 'Version 2',
        nodes: [...nodes, createMockNode('n2', 'output')],
        edges: [createMockEdge('n1', 'n2')],
        now: 2000,
      });

      const list = await listWorkflowVersions(wfId);
      assert.equal(list.length, 2);
      assert.equal(list[0]!.id, v2.id); // Newest first
      assert.equal(list[1]!.id, v1.id);

      const fetched = await getWorkflowVersion(v1.id);
      assert.notEqual(fetched, null);
      assert.equal(fetched?.label, 'Version 1');
      assert.equal(fetched?.description, 'First milestone');
    });

    it('rejects duplicate saves when canvas is logically identical to latest version', async () => {
      const nodes = [createMockNode('n1', 'input')];
      const wfId = 'wf_test_dupe';

      await createWorkflowVersion({
        workflowId: wfId,
        label: 'Version 1',
        nodes,
        edges: [],
      });

      // Attempting to create identical version must throw DuplicateWorkflowVersionError
      await assert.rejects(
        async () => {
          await createWorkflowVersion({
            workflowId: wfId,
            label: 'Version 2 Duplicate',
            nodes,
            edges: [],
          });
        },
        (err: any) => {
          assert.equal(err instanceof DuplicateWorkflowVersionError, true);
          assert.equal(err.code, 'WORKFLOW_VERSION_DUPLICATE');
          return true;
        },
      );
    });

    it('enforces 30-version hard quota and rejects 31st without silent eviction', async () => {
      const wfId = 'wf_test_quota';

      // Seed exactly 30 distinct versions
      for (let i = 1; i <= MAX_WORKFLOW_VERSIONS; i++) {
        await createWorkflowVersion({
          workflowId: wfId,
          label: `Version ${i}`,
          nodes: [createMockNode(`node_${i}`, 'input', { x: 0, y: 0 }, { seed: i })],
          edges: [],
          now: i * 1000,
        });
      }

      const countBefore = (await listWorkflowVersions(wfId)).length;
      assert.equal(countBefore, 30);

      // Attempt 31st version: must be rejected with WorkflowVersionQuotaError
      await assert.rejects(
        async () => {
          await createWorkflowVersion({
            workflowId: wfId,
            label: 'Version 31 Overflow',
            nodes: [createMockNode('node_31', 'input', { x: 0, y: 0 }, { seed: 31 })],
            edges: [],
            now: 31000,
          });
        },
        (err: any) => {
          assert.equal(err instanceof WorkflowVersionQuotaError, true);
          assert.equal(err.code, 'WORKFLOW_VERSION_QUOTA_EXCEEDED');
          assert.equal(err.limit, 30);
          assert.equal(err.count, 30);
          return true;
        },
      );

      // Verify zero silent eviction: all 30 initial versions remain intact
      const countAfter = (await listWorkflowVersions(wfId)).length;
      assert.equal(countAfter, 30);

      // Delete one version to reclaim quota
      const all = await listWorkflowVersions(wfId);
      await deleteWorkflowVersion(all[all.length - 1]!.id);

      // Now 31st version can be saved successfully
      const reclaimed = await createWorkflowVersion({
        workflowId: wfId,
        label: 'Version Reclaimed',
        nodes: [createMockNode('node_reclaimed', 'input', { x: 0, y: 0 }, { seed: 999 })],
        edges: [],
      });
      assert.equal(reclaimed.label, 'Version Reclaimed');
      assert.equal((await listWorkflowVersions(wfId)).length, 30);
    });
  });

  // ── 4. Structural DAG Diff Engine ─────────────────────────────────────────
  describe('4. Structural DAG Diff Engine (PRD-020 §3.3)', () => {
    it('correctly detects node additions, deletions, and property modifications', () => {
      const baseGraph = {
        nodes: [
          createMockNode('n1', 'input', { x: 0, y: 0 }),
          createMockNode('n2', 'llm', { x: 100, y: 100 }, { temperature: 0.7, model: 'gpt-4o' }),
          createMockNode('n3_old', 'output', { x: 200, y: 200 }),
        ],
        edges: [createMockEdge('n1', 'n2'), createMockEdge('n2', 'n3_old')],
      };

      const targetGraph = {
        nodes: [
          createMockNode('n1', 'input', { x: 0, y: 0 }),
          createMockNode('n2', 'llm', { x: 100, y: 100 }, { temperature: 0.2, model: 'gpt-4o' }), // modified temp
          createMockNode('n4_new', 'output', { x: 300, y: 300 }), // added
        ],
        edges: [createMockEdge('n1', 'n2'), createMockEdge('n2', 'n4_new')],
      };

      const diff = diffWorkflowGraphs(baseGraph, targetGraph);

      assert.equal(diff.hasChanges, true);
      assert.equal(diff.hasLogicalChanges, true);
      assert.equal(diff.stats.addedNodeCount, 1);
      assert.equal(diff.nodes.added[0]!.id, 'n4_new');
      assert.equal(diff.stats.deletedNodeCount, 1);
      assert.equal(diff.nodes.deleted[0]!.id, 'n3_old');
      assert.equal(diff.stats.modifiedNodeCount, 1);
      assert.equal(diff.nodes.modified[0]!.nodeId, 'n2');

      // Verify field-level diff
      const change = diff.nodes.modified[0]!.changes.find((c) => c.path === 'data.config.temperature');
      assert.notEqual(change, undefined);
      assert.equal(change?.oldValue, 0.7);
      assert.equal(change?.newValue, 0.2);

      // Verify edges diff
      assert.equal(diff.stats.addedEdgeCount, 1);
      assert.equal(diff.edges.added[0]!.target, 'n4_new');
      assert.equal(diff.stats.deletedEdgeCount, 1);
      assert.equal(diff.edges.deleted[0]!.target, 'n3_old');
    });

    it('isolates pure coordinate movements as layoutOnly without triggering hasLogicalChanges', () => {
      const baseGraph = {
        nodes: [
          createMockNode('n1', 'prompt', { x: 100, y: 100 }, { template: 'Query' }),
          createMockNode('n2', 'llm', { x: 200, y: 200 }, { model: 'gpt-4o' }),
        ],
        edges: [createMockEdge('n1', 'n2')],
      };

      // Target graph has identical logic/config, but nodes are dragged to new positions
      const targetGraph = {
        nodes: [
          createMockNode('n1', 'prompt', { x: 150, y: 180 }, { template: 'Query' }),
          createMockNode('n2', 'llm', { x: 300, y: 400 }, { model: 'gpt-4o' }),
        ],
        edges: [createMockEdge('n1', 'n2')],
      };

      const diff = diffWorkflowGraphs(baseGraph, targetGraph);

      assert.equal(diff.hasChanges, true);
      assert.equal(diff.hasLogicalChanges, false); // Crucial: pure layout move is NOT a logical change
      assert.equal(diff.stats.addedNodeCount, 0);
      assert.equal(diff.stats.deletedNodeCount, 0);
      assert.equal(diff.stats.modifiedNodeCount, 0);
      assert.equal(diff.stats.layoutNodeCount, 2);

      const n1Layout = diff.nodes.layoutOnly.find((n) => n.nodeId === 'n1');
      assert.notEqual(n1Layout, undefined);
      assert.equal(n1Layout?.isLayoutOnly, true);
      assert.deepEqual(n1Layout?.positionDelta, { dx: 50, dy: 80 });
    });

    it('computes line-level text differences using LCS algorithm (diffTextLines)', () => {
      const oldPrompt = 'Line 1: Hello\nLine 2: Common\nLine 3: Goodbye';
      const newPrompt = 'Line 1: Hello\nLine 2: Common modified\nLine 3: Goodbye\nLine 4: Extra';

      const lineDiff = diffTextLines(oldPrompt, newPrompt);
      assert.equal(Array.isArray(lineDiff), true);

      const addedLines = lineDiff.filter((l) => l.type === 'added');
      const removedLines = lineDiff.filter((l) => l.type === 'removed');
      const equalLines = lineDiff.filter((l) => l.type === 'equal');

      assert.equal(equalLines.length >= 2, true);
      assert.equal(addedLines.some((l) => l.text.includes('Extra')), true);
      assert.equal(removedLines.some((l) => l.text === 'Line 2: Common'), true);
    });

    it('does not produce phantom changes or leak tokens when live canvas contains credentials', () => {
      const liveNode = createMockNode(
        'http_node',
        'http',
        { x: 0, y: 0 },
        {
          url: 'https://api.example.com',
          authConfig: { token: 'sk-live-secret-token-12345' },
        },
      );
      // Stored snapshot is prepared
      const snapshot = prepareVersionGraph([liveNode], []);

      // When diffing against prepared live canvas (as done in WorkflowDiffModal & CreateVersionModal)
      const sanitizedLive = prepareVersionGraph([liveNode], []);
      const diff = diffWorkflowGraphs(snapshot, sanitizedLive);

      assert.equal(diff.hasLogicalChanges, false);
      assert.equal(diff.stats.modifiedNodeCount, 0);
      assert.equal(diff.nodes.modified.length, 0);
    });
  });

  // ── 5. Rollback State Machine & Undo Stack Integration ─────────────────────
  describe('5. Rollback State Machine & Undo Stack Integration (PRD-020 §3.4)', () => {
    it('restores canvas to target version and pushes pre-rollback state to history stack', async () => {
      const wfStore = useWorkflowStore.getState();

      // 1. Initial canvas state (V1)
      const v1Nodes = [createMockNode('n1', 'input', { x: 10, y: 10 })];
      const v1Edges: WorkflowEdge[] = [];
      useWorkflowStore.setState({ nodes: v1Nodes, edges: v1Edges });

      const v1Record = await createWorkflowVersion({
        workflowId: 'wf_rollback_test',
        label: 'V1 Initial',
        nodes: v1Nodes,
        edges: v1Edges,
      });

      // 2. User edits canvas to V2 (adds node n2)
      wfStore.captureSnapshot();
      const v2Nodes = [
        createMockNode('n1', 'input', { x: 10, y: 10 }),
        createMockNode('n2', 'llm', { x: 100, y: 100 }),
      ];
      const v2Edges = [createMockEdge('n1', 'n2')];
      useWorkflowStore.setState({ nodes: v2Nodes, edges: v2Edges });

      // Verify V2 is active
      assert.equal(useWorkflowStore.getState().nodes.length, 2);

      // 3. User performs rollback to V1
      const rollbackSuccess = wfStore.restoreVersionGraph(v1Record.graph);
      assert.equal(rollbackSuccess, true);

      // Canvas is now V1
      const currentAfterRollback = useWorkflowStore.getState().nodes;
      assert.equal(currentAfterRollback.length, 1);
      assert.equal(currentAfterRollback[0]!.id, 'n1');

      // 4. User presses Ctrl+Z (undo rollback)
      assert.equal(wfStore.canUndo(), true);
      const undoSuccess = wfStore.undo();
      assert.equal(undoSuccess, true);

      // Canvas is restored to V2!
      const currentAfterUndo = useWorkflowStore.getState().nodes;
      assert.equal(currentAfterUndo.length, 2);
      assert.equal(currentAfterUndo.some((n) => n.id === 'n2'), true);
    });

    it('accurately identifies dirty state against latest version', async () => {
      const wfId = 'wf_dirty_check';
      const nodes = [createMockNode('n1', 'input')];

      // Initially no versions -> dirty if nodes exist
      const dirtyInit = await getDirtyState(wfId, nodes, []);
      assert.equal(dirtyInit.isDirty, true);

      // Save version 1
      await createWorkflowVersion({
        workflowId: wfId,
        label: 'V1',
        nodes,
        edges: [],
      });

      // Exactly identical canvas -> NOT dirty
      const dirtyClean = await getDirtyState(wfId, nodes, []);
      assert.equal(dirtyClean.isDirty, false);

      // Modified canvas -> dirty
      const modifiedNodes = [createMockNode('n1', 'input', { x: 0, y: 0 }, { changed: true })];
      const dirtyModified = await getDirtyState(wfId, modifiedNodes, []);
      assert.equal(dirtyModified.isDirty, true);
    });
  });

  // ── 6. IndexedDB Transactional Quota & Upgrade Paths (PRD-020 §3.1.4 & §4.2) ──
  describe('6. IndexedDB Transactional Quota & Upgrade Paths', () => {
    it('aborts transaction and fires onabort with WorkflowVersionQuotaError when count >= limit', async () => {
      let txAborted = false;
      let putCalled = false;

      const mockStore = {
        index: (_name: string) => ({
          count: (_key: string) => {
            const req: any = { result: 30 };
            setTimeout(() => {
              if (req.onsuccess) req.onsuccess();
            }, 0);
            return req;
          },
        }),
        put: (_val: any) => {
          putCalled = true;
          const req: any = {};
          setTimeout(() => {
            if (req.onsuccess) req.onsuccess();
          }, 0);
          return req;
        },
      };

      const mockTx: any = {
        objectStore: (_name: string) => mockStore,
        abort: () => {
          txAborted = true;
          setTimeout(() => {
            if (mockTx.onabort) mockTx.onabort();
          }, 0);
        },
        oncomplete: null,
        onabort: null,
        onerror: null,
        error: null,
      };

      const mockDb = {
        transaction: (_stores: any, _mode: any) => mockTx,
      };

      const originalIsSupported = indexedDb.isSupported.bind(indexedDb);
      const originalGetDB = (indexedDb as any).getDB.bind(indexedDb);

      (indexedDb as any).isSupported = () => true;
      (indexedDb as any).getDB = async () => mockDb;

      try {
        const dummyRecord: any = {
          id: 'v_overflow',
          workflowId: 'wf_quota_test',
          label: 'Overflow Version',
          createdAt: Date.now(),
          graph: { nodes: [], edges: [] },
          graphHash: 'hash',
          metadata: { nodeCount: 0, edgeCount: 0, sanitized: true, strippedApiKeysCount: 0 },
        };

        await assert.rejects(
          async () => {
            await indexedDb.saveWorkflowVersionWithQuota(dummyRecord, 30);
          },
          (err: any) => {
            assert.equal(err instanceof WorkflowVersionQuotaError, true);
            assert.equal(err.count, 30);
            assert.equal(err.limit, 30);
            return true;
          },
        );

        assert.equal(txAborted, true);
        assert.equal(putCalled, false);
      } finally {
        (indexedDb as any).isSupported = originalIsSupported;
        (indexedDb as any).getDB = originalGetDB;
      }
    });

    it('successfully puts record and increments write count on putReq.onsuccess when count < limit', async () => {
      let putCalled = false;
      const initialPutCount = indexedDb.getWriteCount();

      const mockStore = {
        index: (_name: string) => ({
          count: (_key: string) => {
            const req: any = { result: 5 };
            setTimeout(() => {
              if (req.onsuccess) req.onsuccess();
            }, 0);
            return req;
          },
        }),
        put: (_val: any) => {
          putCalled = true;
          const req: any = {};
          setTimeout(() => {
            if (req.onsuccess) req.onsuccess();
            if (mockTx.oncomplete) mockTx.oncomplete();
          }, 0);
          return req;
        },
      };

      const mockTx: any = {
        objectStore: (_name: string) => mockStore,
        abort: () => {},
        oncomplete: null,
        onabort: null,
        onerror: null,
        error: null,
      };

      const mockDb = {
        transaction: (_stores: any, _mode: any) => mockTx,
      };

      const originalIsSupported = indexedDb.isSupported.bind(indexedDb);
      const originalGetDB = (indexedDb as any).getDB.bind(indexedDb);

      (indexedDb as any).isSupported = () => true;
      (indexedDb as any).getDB = async () => mockDb;

      try {
        const dummyRecord: any = {
          id: 'v_success',
          workflowId: 'wf_quota_test',
          label: 'Success Version',
          createdAt: Date.now(),
          graph: { nodes: [], edges: [] },
          graphHash: 'hash',
          metadata: { nodeCount: 0, edgeCount: 0, sanitized: true, strippedApiKeysCount: 0 },
        };

        await indexedDb.saveWorkflowVersionWithQuota(dummyRecord, 30);
        assert.equal(putCalled, true);
        assert.equal(indexedDb.getWriteCount(), initialPutCount + 1);
      } finally {
        (indexedDb as any).isSupported = originalIsSupported;
        (indexedDb as any).getDB = originalGetDB;
      }
    });
  });
});
