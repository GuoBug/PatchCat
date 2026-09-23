/**
 * @file    tests/storage-hardening.node.test.ts
 * @version 1.0.0
 * @description
 *   Unit and integration tests for PatchCat v0.4.11 Storage Hardening:
 *   1. Ephemeral streaming channel isolation (zero disk I/O during LLM token streaming).
 *   2. Strict Checkpoint FIFO ring-buffer eviction (max 5 checkpoints per workflow).
 *   3. Metadata-First catalog separation (workflows_meta vs workflows_payload lazy loading).
 *   4. IndexedDbStorageAdapter CRUD operations conforming to IStorageAdapter.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { indexedDb, STORES, type WorkflowMetadata, type WorkflowPayload } from '../src/services/storage/indexeddb-adapter.ts';
import { IndexedDbStorageAdapter } from '../src/services/storage/storage-adapter.ts';
import { useWorkflowStore } from '../src/stores/workflow-store.ts';
import { useProjectStore, type SavedWorkflow } from '../src/stores/project-store.ts';
import type { DAGCheckpoint, WorkflowNode, WorkflowEdge } from '../src/engine/types.ts';

describe('Phase 4.11: Storage Hardening & Ephemeral Stream (v0.4.11)', () => {
  beforeEach(async () => {
    indexedDb.resetWriteCount();
    await indexedDb.clear(STORES.CHECKPOINTS);
    await indexedDb.clear(STORES.WORKFLOWS_META);
    await indexedDb.clear(STORES.WORKFLOWS_PAYLOAD);
    await indexedDb.clear(STORES.FOLDERS);
    indexedDb.resetWriteCount();
  });

  // ── 1. Ephemeral Streaming Channel Isolation (Zero Disk I/O) ───────────────
  describe('1. Ephemeral Streaming Channel Isolation (Red Line 2)', () => {
    it('guarantees 0 IndexedDB writes during high-frequency token streaming (100 chunks)', () => {
      indexedDb.resetWriteCount();
      const startWriteCount = indexedDb.getWriteCount();
      assert.equal(startWriteCount, 0);

      const wfStore = useWorkflowStore.getState();
      useWorkflowStore.setState({ nodes: [], edges: [], isExecuting: false });
      const nodeId = wfStore.addNode('llm', { x: 100, y: 100 });

      // Simulate active workflow execution
      useWorkflowStore.setState({ isExecuting: true });

      // Simulate 100 consecutive streaming chunks (at 60+ tokens/s)
      for (let i = 1; i <= 100; i++) {
        const chunkText = `Token ${i} `;
        const fullContent = `Hello world response so far: ${chunkText.repeat(i)}`;
        wfStore.updateNodeStreamingOutput(nodeId, fullContent, 'Reasoning step...');
      }

      // Assert that IndexedDB was NOT touched at all
      const writesAfterStreaming = indexedDb.getWriteCount();
      assert.equal(
        writesAfterStreaming,
        0,
        `Expected 0 IndexedDB writes during streaming, but got ${writesAfterStreaming}`,
      );

      // Verify node outputs in memory
      const node = useWorkflowStore.getState().nodes.find((n) => n.id === nodeId);
      assert.ok(node);
      assert.ok(String(node.data.outputs?.response).includes('Token 100'));
      assert.equal(node.data.outputs?.reasoning, 'Reasoning step...');

      // Reset execution state
      useWorkflowStore.setState({ isExecuting: false });
    });

    it('intercepts autoSaveCurrentWorkflow and shadow draft while isExecuting is true', () => {
      const projStore = useProjectStore.getState();
      const wfStore = useWorkflowStore.getState();

      useWorkflowStore.setState({ nodes: [], edges: [], isExecuting: false });
      const nodeId = wfStore.addNode('prompt', { x: 50, y: 50 });

      // Mark executing
      useWorkflowStore.setState({ isExecuting: true });
      indexedDb.resetWriteCount();

      // Trigger autoSaveCurrentWorkflow during execution
      projStore.autoSaveCurrentWorkflow();

      // Trigger updateNodeData with outputs during execution
      wfStore.updateNodeData(nodeId, {
        outputs: { text: 'Ephemeral output' },
      });

      // Assert 0 IndexedDB writes occurred
      assert.equal(indexedDb.getWriteCount(), 0);

      useWorkflowStore.setState({ isExecuting: false });
    });
  });

  // ── 2. Checkpoint FIFO Ring-Buffer Logrotate (Strictly 5 Max) ──────────────
  describe('2. Checkpoint FIFO Ring-Buffer Logrotate (PRD-017 & ADR-003)', () => {
    it('strictly bounds checkpoints to 5 per workflow across 30 consecutive execution waves', async () => {
      const workflowId = 'wf-hardening-test';

      // Simulate 30 execution checkpoints for the same workflow
      for (let i = 1; i <= 30; i++) {
        const checkpoint: DAGCheckpoint = {
          id: `chk_${workflowId}_${i}`,
          checkpointId: `chk_${workflowId}_${i}`,
          runId: `run_${i}`,
          workflowId,
          timestamp: 1000000 + i * 1000, // strictly increasing timestamps
          graphTopologyHash: 'hash-abc',
          currentWaveIndex: i,
          totalWaves: 30,
          isCompleted: i === 30,
          failedNodeIds: [],
          contextBag: { step: i },
          nodeStates: {},
        };

        await indexedDb.saveCheckpoint(checkpoint, 5);
      }

      // Query all checkpoints for this workflow
      const remainingCheckpoints = await indexedDb.getCheckpointsForWorkflow(workflowId, 50);

      // 1. Strict size check: exactly 5 records remain
      assert.equal(
        remainingCheckpoints.length,
        5,
        `Expected exactly 5 checkpoints, but found ${remainingCheckpoints.length}`,
      );

      // 2. Strict freshness check: must be the 5 most recent (i = 30, 29, 28, 27, 26)
      const expectedWaveIndices = [30, 29, 28, 27, 26];
      const actualWaveIndices = remainingCheckpoints.map((c) => c.currentWaveIndex);
      assert.deepEqual(actualWaveIndices, expectedWaveIndices);

      // 3. Oldest checkpoints (e.g. i = 1..25) must be completely purged
      const chk1 = await indexedDb.getCheckpointById(`chk_${workflowId}_1`);
      assert.equal(chk1, null, 'Oldest checkpoint 1 should have been purged');
      const chk25 = await indexedDb.getCheckpointById(`chk_${workflowId}_25`);
      assert.equal(chk25, null, 'Oldest checkpoint 25 should have been purged');

      // 4. Most recent checkpoint 30 must exist and be completed
      const chk30 = await indexedDb.getCheckpointById(`chk_${workflowId}_30`);
      assert.ok(chk30);
      assert.equal(chk30.isCompleted, true);
    });

    it('supports explicit eviction via evictCheckpoints', async () => {
      const workflowId = 'wf-evict-test';

      // Insert 5 checkpoints
      for (let i = 1; i <= 5; i++) {
        await indexedDb.saveCheckpoint(
          {
            id: `chk_evict_${i}`,
            checkpointId: `chk_evict_${i}`,
            runId: `run_evict_${i}`,
            workflowId,
            timestamp: 10000 + i,
            graphTopologyHash: 'hash',
            currentWaveIndex: 0,
            totalWaves: 1,
            isCompleted: true,
            failedNodeIds: [],
            contextBag: {},
            nodeStates: {},
          },
          10,
        );
      }

      const beforeList = await indexedDb.getCheckpointsForWorkflow(workflowId, 10);
      assert.equal(beforeList.length, 5);

      // Evict to max 3
      const deletedCount = await indexedDb.evictCheckpoints(workflowId, 3);
      assert.equal(deletedCount, 2);

      const afterList = await indexedDb.getCheckpointsForWorkflow(workflowId, 10);
      assert.equal(afterList.length, 3);
    });
  });

  // ── 3. Metadata-First Catalog Separation & Lazy Loading ────────────────────
  describe('3. Metadata-First Catalog Separation & Lazy Loading', () => {
    it('separates workflows_meta from workflows_payload and allows on-demand lazy hydration', async () => {
      const mockNodes: WorkflowNode[] = Array.from({ length: 50 }, (_, i) => ({
        id: `node_${i}`,
        type: 'prompt',
        position: { x: i * 20, y: i * 20 },
        data: {
          label: `Prompt Node ${i}`,
          type: 'prompt',
          status: 'idle',
          inputs: { prompt: `Very large template content ${i}`.repeat(50) },
          outputs: {},
          config: {},
        },
      }));

      const mockEdges: WorkflowEdge[] = Array.from({ length: 49 }, (_, i) => ({
        id: `edge_${i}`,
        source: `node_${i}`,
        target: `node_${i + 1}`,
      }));

      const meta: WorkflowMetadata = {
        id: 'wf-large-catalog-test',
        name: 'Enterprise Large Pipeline',
        folderId: 'folder_prod',
        description: '50-node production DAG pipeline',
        tags: ['production', 'rag', 'llm'],
        nodeCount: mockNodes.length,
        createdAt: 1700000000000,
        updatedAt: 1700000005000,
        isPreset: false,
        isLocked: true,
        version: 1,
      };

      const payload: WorkflowPayload = {
        id: 'wf-large-catalog-test',
        nodes: mockNodes,
        edges: mockEdges,
        globalInputs: { apiKey: 'test', batchSize: 50 },
        viewport: { x: 0, y: 0, zoom: 1 },
      };

      // Atomic multi-store save
      await indexedDb.saveWorkflowMetaAndPayload(meta, payload);

      // 1. Catalog read: getAllWorkflowMetas must return lightweight metadata without node arrays
      const catalogMetas = await indexedDb.getAllWorkflowMetas();
      assert.equal(catalogMetas.length, 1);
      assert.equal(catalogMetas[0]?.name, 'Enterprise Large Pipeline');
      assert.equal(catalogMetas[0]?.nodeCount, 50);
      assert.equal((catalogMetas[0] as unknown as { nodes?: unknown }).nodes, undefined);

      // 2. Payload read: getWorkflowPayload returns nodes and edges
      const fetchedPayload = await indexedDb.getWorkflowPayload('wf-large-catalog-test');
      assert.ok(fetchedPayload);
      assert.equal(fetchedPayload.nodes.length, 50);
      assert.equal(fetchedPayload.edges.length, 49);

      // 3. Complete hydration: getCompleteWorkflow returns unified SavedWorkflow
      const complete = await indexedDb.getCompleteWorkflow('wf-large-catalog-test');
      assert.ok(complete);
      assert.equal(complete.id, 'wf-large-catalog-test');
      assert.equal(complete.name, 'Enterprise Large Pipeline');
      assert.equal(complete.nodes.length, 50);
      assert.equal(complete.edges.length, 49);
      assert.equal(complete.isLocked, true);
      assert.equal(complete.nodeCount, 50);

      // 4. Delete operation cleans both stores
      await indexedDb.deleteWorkflowFromDb('wf-large-catalog-test');
      assert.equal(await indexedDb.getWorkflowMeta('wf-large-catalog-test'), null);
      assert.equal(await indexedDb.getWorkflowPayload('wf-large-catalog-test'), null);
      assert.equal(await indexedDb.getCompleteWorkflow('wf-large-catalog-test'), null);
    });
  });

  // ── 4. IndexedDbStorageAdapter Full Contract Conformance ───────────────────
  describe('4. IndexedDbStorageAdapter IStorageAdapter Conformance', () => {
    it('supports full workflow and folder CRUD lifecycle via adapter interface', async () => {
      const adapter = new IndexedDbStorageAdapter();

      // 1. Folders
      const initialFolders = await adapter.getFolders();
      assert.ok(initialFolders.length >= 1);

      const createdFolder = await adapter.createFolder({ name: 'Finance Workflows' });
      assert.equal(createdFolder.name, 'Finance Workflows');

      const updatedFolder = await adapter.updateFolder(createdFolder.id, { name: 'FinTech Workflows' });
      assert.equal(updatedFolder.name, 'FinTech Workflows');

      // 2. Create Workflow
      const newWorkflow: SavedWorkflow = {
        id: 'wf-adapter-crud',
        name: 'Financial Auditor',
        folderId: createdFolder.id,
        nodes: [
          {
            id: 'n1',
            type: 'input',
            position: { x: 0, y: 0 },
            data: { label: 'Input', type: 'input', status: 'idle', inputs: {}, outputs: {}, config: {} },
          },
          {
            id: 'n2',
            type: 'llm',
            position: { x: 200, y: 0 },
            data: { label: 'LLM Auditor', type: 'llm', status: 'idle', inputs: {}, outputs: {}, config: {} },
          },
        ],
        edges: [{ id: 'e1-2', source: 'n1', target: 'n2' }],
        globalInputs: { currency: 'USD' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPreset: false,
      };

      await adapter.createWorkflow(newWorkflow);

      // 3. getWorkflows should return summary with nodes: [] and populated nodeCount
      const list = await adapter.getWorkflows(createdFolder.id);
      assert.equal(list.length, 1);
      assert.equal(list[0]?.id, 'wf-adapter-crud');
      assert.equal(list[0]?.nodes.length, 0); // lightweight!
      assert.equal(list[0]?.nodeCount, 2);

      // 4. getWorkflow should return complete nodes and edges
      const hydrated = await adapter.getWorkflow('wf-adapter-crud');
      assert.ok(hydrated);
      assert.equal(hydrated.nodes.length, 2);
      assert.equal(hydrated.edges.length, 1);
      assert.equal(hydrated.globalInputs.currency, 'USD');

      // 5. saveWorkflow updates
      const saved = await adapter.saveWorkflow('wf-adapter-crud', {
        name: 'Financial Auditor Pro',
        isLocked: true,
      });
      assert.equal(saved.name, 'Financial Auditor Pro');
      assert.equal(saved.isLocked, true);

      // 6. duplicateWorkflow
      const duplicated = await adapter.duplicateWorkflow('wf-adapter-crud');
      assert.ok(duplicated.id !== 'wf-adapter-crud');
      assert.equal(duplicated.name, 'Financial Auditor Pro (Copy)');
      assert.equal(duplicated.nodes.length, 2);

      // 7. deleteWorkflow
      await adapter.deleteWorkflow('wf-adapter-crud');
      const shouldBeNull = await adapter.getWorkflow('wf-adapter-crud');
      assert.equal(shouldBeNull, null);

      await adapter.deleteWorkflow(duplicated.id);
      await adapter.deleteFolder(createdFolder.id);
    });
  });
});
