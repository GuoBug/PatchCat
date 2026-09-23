/**
 * @file    tests/checkpoint-resumption.node.test.ts
 * @description
 *   Node.js tests for v0.4.10:
 *   1. IndexedDbAdapter DAG Checkpoint CRUD & FIFO (5 per workflow) eviction.
 *   2. Topological helper algorithms: computeAncestors, computeDescendants, computeNodeConfigHash, computeGraphTopologyHash.
 *   3. BrowserWorkflowEngine resumable DAG execution from failed nodes (resumeFromNodeId).
 *   4. Zero-token & zero-duration cached ancestor output injection.
 *   5. Diamond graph upward expansion when upstream dependencies are unfulfilled.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { BrowserWorkflowEngine } from '../src/engine/browser-engine.ts';
import {
  computeAncestors,
  computeDescendants,
  computeNodeConfigHash,
  computeGraphTopologyHash,
} from '../src/engine/topological-sort.ts';
import { indexedDb } from '../src/services/storage/indexeddb-adapter.ts';
import type {
  WorkflowNode,
  WorkflowEdge,
  DAGCheckpoint,
  ExecutionEvent,
} from '../src/engine/types.ts';

describe('v0.4.10 Immutable Checkpointing & Resumable DAG Execution', () => {
  beforeEach(async () => {
    await indexedDb.clearCheckpointsForWorkflow('test-wf-chk');
    await indexedDb.clearCheckpointsForWorkflow('test-wf-diamond');
  });

  describe('1. IndexedDbAdapter Checkpoint CRUD & FIFO Eviction', () => {
    test('saves and retrieves checkpoints for a workflow in descending order', async () => {
      const chk1: DAGCheckpoint = {
        id: 'chk_1',
        checkpointId: 'chk_1',
        runId: 'run_1',
        workflowId: 'test-wf-chk',
        timestamp: 1000,
        graphTopologyHash: 'topo_1',
        currentWaveIndex: 0,
        totalWaves: 2,
        isCompleted: false,
        failedNodeIds: [],
        contextBag: { node_1: { text: 'Hello' } },
        nodeStates: {
          node_1: {
            nodeId: 'node_1',
            nodeType: 'input',
            status: 'success',
            durationMs: 10,
            configHash: 'hash_1',
          },
        },
      };

      const chk2: DAGCheckpoint = {
        ...chk1,
        id: 'chk_2',
        checkpointId: 'chk_2',
        timestamp: 2000,
        currentWaveIndex: 1,
        isCompleted: true,
      };

      await indexedDb.saveCheckpoint(chk1, 5);
      await indexedDb.saveCheckpoint(chk2, 5);

      const latest = await indexedDb.getLatestCheckpoint('test-wf-chk');
      assert.ok(latest);
      assert.equal(latest.checkpointId, 'chk_2');
      assert.equal(latest.isCompleted, true);

      const byId = await indexedDb.getCheckpointById('chk_1');
      assert.ok(byId);
      assert.equal(byId.checkpointId, 'chk_1');

      const all = await indexedDb.getCheckpointsForWorkflow('test-wf-chk', 10);
      assert.equal(all.length, 2);
      assert.equal(all[0]?.checkpointId, 'chk_2');
      assert.equal(all[1]?.checkpointId, 'chk_1');
    });

    test('enforces strict 5-record FIFO ring-buffer eviction per workflow', async () => {
      for (let i = 1; i <= 8; i++) {
        const chk: DAGCheckpoint = {
          id: `chk_${i}`,
          checkpointId: `chk_${i}`,
          runId: `run_${i}`,
          workflowId: 'test-wf-chk',
          timestamp: 1000 * i,
          graphTopologyHash: 'topo_x',
          currentWaveIndex: 0,
          totalWaves: 1,
          isCompleted: false,
          failedNodeIds: [],
          contextBag: {},
          nodeStates: {},
        };
        await indexedDb.saveCheckpoint(chk, 5);
      }

      const remaining = await indexedDb.getCheckpointsForWorkflow('test-wf-chk', 10);
      assert.equal(remaining.length, 5);
      // Newest should be chk_8, oldest should be chk_4
      assert.equal(remaining[0]?.checkpointId, 'chk_8');
      assert.equal(remaining[4]?.checkpointId, 'chk_4');

      // chk_1, chk_2, chk_3 must have been evicted
      const evicted = await indexedDb.getCheckpointById('chk_1');
      assert.equal(evicted, null);
    });
  });

  describe('2. Topological Traversal & Graph Hashing Algorithms', () => {
    const nodes: WorkflowNode[] = [
      { id: 'A', type: 'input', position: { x: 0, y: 0 }, data: { label: 'A', type: 'input', status: 'idle' } },
      { id: 'B', type: 'llm', position: { x: 100, y: 0 }, data: { label: 'B', type: 'llm', status: 'idle' } },
      { id: 'C', type: 'code', position: { x: 100, y: 100 }, data: { label: 'C', type: 'code', status: 'idle' } },
      { id: 'D', type: 'output', position: { x: 200, y: 50 }, data: { label: 'D', type: 'output', status: 'idle' } },
      { id: 'X', type: 'input', position: { x: 0, y: 200 }, data: { label: 'X', type: 'input', status: 'idle' } },
    ];

    // Diamond: A -> B -> D, A -> C -> D, and independent X
    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'A', target: 'C' },
      { id: 'e3', source: 'B', target: 'D' },
      { id: 'e4', source: 'C', target: 'D' },
    ];

    test('computeAncestors correctly returns transitive parent closure', () => {
      const ancestorsOfD = computeAncestors('D', { nodes, edges });
      assert.equal(ancestorsOfD.size, 3);
      assert.ok(ancestorsOfD.has('A'));
      assert.ok(ancestorsOfD.has('B'));
      assert.ok(ancestorsOfD.has('C'));
      assert.ok(!ancestorsOfD.has('X'));

      const ancestorsOfB = computeAncestors('B', { nodes, edges });
      assert.equal(ancestorsOfB.size, 1);
      assert.ok(ancestorsOfB.has('A'));

      const ancestorsOfA = computeAncestors('A', { nodes, edges });
      assert.equal(ancestorsOfA.size, 0);
    });

    test('computeDescendants correctly returns transitive child closure', () => {
      const descendantsOfA = computeDescendants(['A'], { nodes, edges });
      assert.equal(descendantsOfA.size, 3);
      assert.ok(descendantsOfA.has('B'));
      assert.ok(descendantsOfA.has('C'));
      assert.ok(descendantsOfA.has('D'));

      const descendantsOfB = computeDescendants(['B'], { nodes, edges });
      assert.equal(descendantsOfB.size, 1);
      assert.ok(descendantsOfB.has('D'));

      const descendantsOfD = computeDescendants(['D'], { nodes, edges });
      assert.equal(descendantsOfD.size, 0);
    });

    test('computeNodeConfigHash produces deterministic hashes', () => {
      const node1: WorkflowNode = {
        id: 'node_1',
        type: 'llm',
        position: { x: 0, y: 0 },
        data: { label: 'LLM 1', type: 'llm', status: 'idle', inputs: { prompt: 'Hello' }, config: { model: 'gemini' } },
      };
      const node2: WorkflowNode = {
        id: 'node_2',
        type: 'llm',
        position: { x: 0, y: 0 },
        data: { label: 'LLM 2', type: 'llm', status: 'idle', inputs: { prompt: 'Hello' }, config: { model: 'gemini' } },
      };
      const node3: WorkflowNode = {
        id: 'node_3',
        type: 'llm',
        position: { x: 0, y: 0 },
        data: { label: 'LLM 3', type: 'llm', status: 'idle', inputs: { prompt: 'Different' }, config: { model: 'gemini' } },
      };

      assert.equal(computeNodeConfigHash(node1), computeNodeConfigHash(node2));
      assert.notEqual(computeNodeConfigHash(node1), computeNodeConfigHash(node3));
    });

    test('computeGraphTopologyHash produces deterministic topological signature', () => {
      const hash1 = computeGraphTopologyHash({ nodes, edges });
      const hash2 = computeGraphTopologyHash({ nodes: [...nodes].reverse(), edges });
      assert.equal(hash1, hash2);
      assert.ok(hash1.startsWith('topo_'));
    });
  });

  describe('3. Resumable DAG Execution (resumeFromNodeId)', () => {
    test('100% reuses upstream ancestor outputs and executes only downstream subgraph', async () => {
      const engine = new BrowserWorkflowEngine();
      const workflowId = 'test-wf-chk';

      const nodes: WorkflowNode[] = [
        {
          id: 'node_input',
          type: 'input',
          position: { x: 0, y: 0 },
          data: {
            label: 'Input',
            type: 'input',
            inputs: { query: 'Initial Question' },
            status: 'idle',
          },
        },
        {
          id: 'node_llm_1',
          type: 'llm',
          position: { x: 200, y: 0 },
          data: {
            label: 'LLM Step 1',
            type: 'llm',
            inputs: { prompt: '{{node_input.query}}' },
            config: { model: 'gemini-2.5-flash', delayMs: 1 },
            status: 'idle',
          },
        },
        {
          id: 'node_llm_2',
          type: 'llm',
          position: { x: 400, y: 0 },
          data: {
            label: 'LLM Step 2',
            type: 'llm',
            inputs: { prompt: '{{node_llm_1.text}}' },
            config: { model: 'gemini-2.5-flash', delayMs: 1 },
            status: 'idle',
          },
        },
        {
          id: 'node_output',
          type: 'output',
          position: { x: 600, y: 0 },
          data: {
            label: 'Final Output',
            type: 'output',
            inputs: { result: '{{node_llm_2.text}}' },
            status: 'idle',
          },
        },
      ];

      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 'node_input', target: 'node_llm_1' },
        { id: 'e2', source: 'node_llm_1', target: 'node_llm_2' },
        { id: 'e3', source: 'node_llm_2', target: 'node_output' },
      ];

      // Pre-seed an initial checkpoint simulating that node_input and node_llm_1 succeeded,
      // but node_llm_2 failed.
      const initialCheckpoint: DAGCheckpoint = {
        id: `chk_preseed_err`,
        checkpointId: `chk_preseed_err`,
        runId: 'run_preseed',
        workflowId,
        timestamp: 1000,
        graphTopologyHash: computeGraphTopologyHash({ nodes, edges }),
        currentWaveIndex: 1,
        totalWaves: 4,
        isCompleted: false,
        failedNodeIds: ['node_llm_2'],
        contextBag: {
          node_input: { query: 'Initial Question' },
          node_llm_1: { text: 'Synthesized Summary from Step 1' },
        },
        nodeStates: {
          node_input: {
            nodeId: 'node_input',
            nodeType: 'input',
            status: 'success',
            outputsSnapshot: { query: 'Initial Question' },
            durationMs: 5,
            configHash: computeNodeConfigHash(nodes[0]!),
          },
          node_llm_1: {
            nodeId: 'node_llm_1',
            nodeType: 'llm',
            status: 'success',
            outputsSnapshot: { text: 'Synthesized Summary from Step 1' },
            durationMs: 250,
            tokensUsed: { prompt: 150, completion: 50, total: 200 },
            configHash: computeNodeConfigHash(nodes[1]!),
          },
          node_llm_2: {
            nodeId: 'node_llm_2',
            nodeType: 'llm',
            status: 'error',
            errorMessage: 'Network timeout (simulated)',
            durationMs: 500,
            configHash: computeNodeConfigHash(nodes[2]!),
          },
        },
      };

      await indexedDb.saveCheckpoint(initialCheckpoint);

      // Now resume from node_llm_2
      const receivedEvents: ExecutionEvent[] = [];
      const executedNodeStarts: string[] = [];

      for await (const event of engine.executeWorkflow(
        { nodes, edges },
        {
          workflowId,
          resumeFromNodeId: 'node_llm_2',
        },
      )) {
        receivedEvents.push(event);
        if (event.type === 'NODE_START') {
          executedNodeStarts.push(event.payload.nodeId);
        }
      }

      // Assert that node_input and node_llm_1 were NOT scheduled in NODE_START
      // Only node_llm_2 and node_output were actively scheduled to run
      assert.ok(!executedNodeStarts.includes('node_input'));
      assert.ok(!executedNodeStarts.includes('node_llm_1'));
      assert.ok(executedNodeStarts.includes('node_llm_2'));
      assert.ok(executedNodeStarts.includes('node_output'));

      // Check workflow completion event
      const completeEvent = receivedEvents.find((e) => e.type === 'WORKFLOW_COMPLETE');
      assert.ok(completeEvent);
      if (completeEvent?.type === 'WORKFLOW_COMPLETE') {
        // Assert that context contains both the cached upstream output and the newly computed outputs
        assert.equal(completeEvent.payload.outputs['node_input']?.query, 'Initial Question');
        assert.equal(completeEvent.payload.outputs['node_llm_1']?.text, 'Synthesized Summary from Step 1');
        assert.ok(completeEvent.payload.outputs['node_llm_2']);
        assert.ok(completeEvent.payload.outputs['node_output']);
      }

      // Verify that a final completed checkpoint was saved into IndexedDB
      const latestCheckpoint = await indexedDb.getLatestCheckpoint(workflowId);
      assert.ok(latestCheckpoint);
      assert.equal(latestCheckpoint.isCompleted, true);
      assert.equal(latestCheckpoint.failedNodeIds.length, 0);
      assert.equal(latestCheckpoint.nodeStates['node_llm_1']?.status, 'cached');
    });

    test('automatically expands upward in diamond graph if an upstream parent is missing cached outputs', async () => {
      const engine = new BrowserWorkflowEngine();
      const workflowId = 'test-wf-diamond';

      // Diamond topology:
      // Root (A) -> Branch1 (B) -> Merge (D)
      // Root (A) -> Branch2 (C) -> Merge (D)
      const nodes: WorkflowNode[] = [
        { id: 'A', type: 'input', position: { x: 0, y: 0 }, data: { label: 'A', type: 'input', inputs: { val: 'Seed' }, status: 'idle' } },
        { id: 'B', type: 'code', position: { x: 100, y: 0 }, data: { label: 'B', type: 'code', inputs: { in: '{{A.val}}' }, config: { code: 'return { b: inputs.in + "_B" };' }, status: 'idle' } },
        { id: 'C', type: 'code', position: { x: 100, y: 100 }, data: { label: 'C', type: 'code', inputs: { in: '{{A.val}}' }, config: { code: 'return { c: inputs.in + "_C" };' }, status: 'idle' } },
        { id: 'D', type: 'output', position: { x: 200, y: 50 }, data: { label: 'D', type: 'output', inputs: { out: '{{B.b}}-{{C.c}}' }, status: 'idle' } },
      ];

      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 'A', target: 'B' },
        { id: 'e2', source: 'A', target: 'C' },
        { id: 'e3', source: 'B', target: 'D' },
        { id: 'e4', source: 'C', target: 'D' },
      ];

      // Pre-seed checkpoint where A succeeded, B succeeded, but C was NOT finished (no cached output)
      const partialCheckpoint: DAGCheckpoint = {
        id: 'chk_partial',
        checkpointId: 'chk_partial',
        runId: 'run_part',
        workflowId,
        timestamp: 1000,
        graphTopologyHash: computeGraphTopologyHash({ nodes, edges }),
        currentWaveIndex: 1,
        totalWaves: 3,
        isCompleted: false,
        failedNodeIds: ['C'],
        contextBag: {
          A: { val: 'Seed' },
          B: { b: 'Seed_B' },
          // C is missing from contextBag!
        },
        nodeStates: {
          A: { nodeId: 'A', nodeType: 'input', status: 'success', outputsSnapshot: { val: 'Seed' }, durationMs: 0, configHash: 'hA' },
          B: { nodeId: 'B', nodeType: 'code', status: 'success', outputsSnapshot: { b: 'Seed_B' }, durationMs: 5, configHash: 'hB' },
        },
      };

      await indexedDb.saveCheckpoint(partialCheckpoint);

      // Now user asks to resume from D.
      // D depends on B (cached) and C (not cached).
      // The upward expansion must automatically detect that C is missing, and schedule C and D!
      const executedNodeStarts: string[] = [];
      const allEvents: ExecutionEvent[] = [];
      for await (const event of engine.executeWorkflow(
        { nodes, edges },
        {
          workflowId,
          resumeFromNodeId: 'D',
        },
      )) {
        allEvents.push(event);
        if (event.type === 'NODE_START') {
          executedNodeStarts.push(event.payload.nodeId);
        }
      }

      // Node A and B should NOT re-run
      assert.ok(!executedNodeStarts.includes('A'));
      assert.ok(!executedNodeStarts.includes('B'));

      // Node C (auto-expanded parent) and Node D (target) MUST run
      assert.ok(executedNodeStarts.includes('C'));
      assert.ok(executedNodeStarts.includes('D'));

      // Latest checkpoint should now be completed
      const latest = await indexedDb.getLatestCheckpoint(workflowId);
      assert.ok(latest);
      assert.equal(latest.isCompleted, true);
    });
  });
});
