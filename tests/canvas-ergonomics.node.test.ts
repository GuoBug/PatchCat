import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HistoryManager } from '../src/engine/history-manager.ts';
import { BrowserWorkflowEngine } from '../src/engine/browser-engine.ts';
import type { WorkflowNode, WorkflowEdge, ExecutionEvent, DAGCheckpoint, RunHistoryRecord } from '../src/engine/types.ts';
import { resolveAABBCollision, useWorkflowStore } from '../src/stores/workflow-store.ts';
import { TEMPLATES_META, TEMPLATE_CATEGORIES } from '../src/presets/preset-meta.ts';
import { translations } from '../src/i18n/translations.ts';
import { indexedDb } from '../src/services/storage/indexeddb-adapter.ts';

async function collectEvents(generator: AsyncGenerator<ExecutionEvent>): Promise<ExecutionEvent[]> {
  const events: ExecutionEvent[] = [];
  for await (const ev of generator) {
    events.push(ev);
  }
  return events;
}

describe('v0.4.6 Canvas Ergonomics & Productivity Tests', () => {
  describe('HistoryManager (Undo / Redo bounded stack)', () => {
    it('pushes snapshots and allows undo and redo correctly', () => {
      const hm = new HistoryManager(25);
      assert.strictEqual(hm.canUndo(), false);
      assert.strictEqual(hm.canRedo(), false);

      const state0 = {
        nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: { label: 'Node 1', type: 'input', status: 'idle', inputs: {}, outputs: {} } } as WorkflowNode],
        edges: [],
      };
      hm.pushSnapshot(state0);
      assert.strictEqual(hm.canUndo(), true);
      assert.strictEqual(hm.canRedo(), false);

      const state1 = {
        nodes: [
          { id: 'n1', position: { x: 10, y: 10 }, data: { label: 'Node 1', type: 'input', status: 'idle', inputs: {}, outputs: {} } } as WorkflowNode,
          { id: 'n2', position: { x: 100, y: 100 }, data: { label: 'Node 2', type: 'prompt', status: 'idle', inputs: {}, outputs: {} } } as WorkflowNode,
        ],
        edges: [],
      };

      const undone = hm.undo(state1);
      assert.ok(undone);
      assert.strictEqual(undone.nodes.length, 1);
      assert.strictEqual(undone.nodes[0]!.id, 'n1');
      assert.strictEqual(undone.nodes[0]!.position.x, 0);
      assert.strictEqual(hm.canRedo(), true);

      const redone = hm.redo(undone);
      assert.ok(redone);
      assert.strictEqual(redone.nodes.length, 2);
      assert.strictEqual(redone.nodes[1]!.id, 'n2');
    });

    it('enforces maximum capacity of 25 snapshots', () => {
      const hm = new HistoryManager(25);
      for (let i = 0; i < 30; i++) {
        hm.pushSnapshot({
          nodes: [{ id: `n_${i}`, position: { x: i, y: i }, data: { label: `Node ${i}`, type: 'input', status: 'idle', inputs: {}, outputs: {} } } as WorkflowNode],
          edges: [],
        });
      }
      assert.strictEqual(hm.getUndoDepth(), 25);
    });

    it('clears redo stack when a new action is performed after undo', () => {
      const hm = new HistoryManager(25);
      hm.pushSnapshot({ nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: '1', type: 'input', status: 'idle', inputs: {}, outputs: {} } } as WorkflowNode], edges: [] });
      hm.pushSnapshot({ nodes: [{ id: '2', position: { x: 10, y: 10 }, data: { label: '2', type: 'input', status: 'idle', inputs: {}, outputs: {} } } as WorkflowNode], edges: [] });

      const undone = hm.undo({ nodes: [{ id: '3', position: { x: 20, y: 20 }, data: { label: '3', type: 'input', status: 'idle', inputs: {}, outputs: {} } } as WorkflowNode], edges: [] });
      assert.ok(undone);
      assert.strictEqual(hm.canRedo(), true);

      // Branching: new action pushes new snapshot, clearing redo
      hm.pushSnapshot({ nodes: [{ id: '4', position: { x: 30, y: 30 }, data: { label: '4', type: 'input', status: 'idle', inputs: {}, outputs: {} } } as WorkflowNode], edges: [] });
      assert.strictEqual(hm.canRedo(), false);
    });
  });

  describe('Single Node In-Place Execution (executeSingleNode)', () => {
    it('executes target node using cached upstream outputs without restarting previous steps', async () => {
      const engine = new BrowserWorkflowEngine();

      const nodes: WorkflowNode[] = [
        {
          id: 'upstream_prompt',
          type: 'prompt',
          position: { x: 0, y: 0 },
          data: {
            label: 'Prompt',
            type: 'prompt',
            status: 'success',
            inputs: { template: 'Hello {{global_input.name}}' },
            outputs: { promptText: 'Hello Alice' },
          },
        },
        {
          id: 'target_llm',
          type: 'llm',
          position: { x: 300, y: 0 },
          data: {
            label: 'LLM Response',
            type: 'llm',
            status: 'error',
            inputs: { prompt: '{{upstream_prompt.promptText}}' },
            outputs: {},
            config: { model: 'mock', temperature: 0.7 },
          },
        },
      ];

      const edges: WorkflowEdge[] = [
        {
          id: 'e1',
          source: 'upstream_prompt',
          target: 'target_llm',
        },
      ];

      const events = await collectEvents(
        engine.executeSingleNode({ nodes, edges }, 'target_llm', {
          inputs: { name: 'Alice' },
          skipLLM: true,
        }),
      );

      // Verify that ONLY target_llm was executed, and NOT upstream_prompt
      const nodeStartEvents = events.filter((e) => e.type === 'NODE_START');
      assert.strictEqual(nodeStartEvents.length, 1);
      assert.strictEqual(nodeStartEvents[0]?.payload.nodeId, 'target_llm');

      const completeEvent = events.find((e) => e.type === 'NODE_COMPLETE');
      assert.ok(completeEvent);
      assert.strictEqual(completeEvent.payload.nodeId, 'target_llm');
      assert.ok(completeEvent.payload.output['response']);
    });

    it('returns NODE_ERROR when target node does not exist', async () => {
      const engine = new BrowserWorkflowEngine();
      const events = await collectEvents(
        engine.executeSingleNode({ nodes: [], edges: [] }, 'nonexistent_node'),
      );
      assert.strictEqual(events.length, 1);
      assert.strictEqual(events[0]?.type, 'NODE_ERROR');
      assert.strictEqual(events[0]?.payload.nodeId, 'nonexistent_node');
    });
  });

  describe('Parallel Failure Recovery with resumeFromExisting', () => {
    it('reuses successful nodes and executes failed/downstream nodes', async () => {
      const engine = new BrowserWorkflowEngine();

      const nodes: WorkflowNode[] = [
        {
          id: 'node_start',
          type: 'input',
          position: { x: 0, y: 0 },
          data: {
            label: 'Input Node',
            type: 'input',
            status: 'success',
            inputs: { query: 'test query' },
            outputs: { query: 'test query' },
          },
        },
        {
          id: 'node_failed_branch',
          type: 'code',
          position: { x: 200, y: 0 },
          data: {
            label: 'Code Transform',
            type: 'code',
            status: 'error',
            inputs: { inputData: '{{node_start.query}}' },
            outputs: {},
            config: { code: 'return { transformed: inputs.inputData.toUpperCase() };' },
          },
        },
        {
          id: 'node_output',
          type: 'output',
          position: { x: 400, y: 0 },
          data: {
            label: 'Output Node',
            type: 'output',
            status: 'idle',
            inputs: { result: '{{node_failed_branch.result.transformed}}' },
            outputs: {},
          },
        },
      ];

      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 'node_start', target: 'node_failed_branch' },
        { id: 'e2', source: 'node_failed_branch', target: 'node_output' },
      ];

      const events = await collectEvents(
        engine.executeWorkflow(
          { nodes, edges },
          {
            resumeFromExisting: true,
            targetNodeIds: ['node_failed_branch'],
          },
        ),
      );

      // Verify node_start was NOT re-executed (cached output reused)
      const startedNodeIds = events
        .filter((e) => e.type === 'NODE_START')
        .map((e) => e.payload.nodeId);

      assert.ok(!startedNodeIds.includes('node_start'));
      assert.ok(startedNodeIds.includes('node_failed_branch'));
      assert.ok(startedNodeIds.includes('node_output'));
      const workflowComplete = events.find((e) => e.type === 'WORKFLOW_COMPLETE');
      assert.ok(workflowComplete);
    });
  });

  describe('v0.4.8 (PRD-013) Drop-to-Add AABB Collision Avoidance', () => {
    it('preserves target position when no overlapping nodes exist', () => {
      const existing = [
        { position: { x: 100, y: 100 }, width: 280, height: 180 },
      ];
      // Far away coordinates
      const res = resolveAABBCollision({ x: 500, y: 500 }, existing);
      assert.strictEqual(res.x, 500);
      assert.strictEqual(res.y, 500);
    });

    it('shifts target position rightwards along DAG vector when colliding with an existing node', () => {
      const existing = [
        { position: { x: 100, y: 100 }, width: 280, height: 180 },
      ];
      // Overlaps directly at (120, 120)
      const res = resolveAABBCollision({ x: 120, y: 120 }, existing, 280, 180, 40);
      // nx (100) + nw (280) + gap (40) = 420
      assert.strictEqual(res.x, 420);
      assert.strictEqual(res.y, 120);
    });

    it('cascades multiple collisions sequentially until clear', () => {
      const existing = [
        { position: { x: 100, y: 100 }, width: 280, height: 180 },
        { position: { x: 420, y: 100 }, width: 280, height: 180 },
      ];
      const res = resolveAABBCollision({ x: 100, y: 100 }, existing, 280, 180, 40);
      // First shift to 420, which also collides, so second shift to 420 + 280 + 40 = 740
      assert.strictEqual(res.x, 740);
      assert.strictEqual(res.y, 100);
    });

    it('wraps downwards when right boundary (> 1800) is reached', () => {
      const existing = [
        { position: { x: 1700, y: 100 }, width: 280, height: 180 },
      ];
      const res = resolveAABBCollision({ x: 1750, y: 100 }, existing, 280, 180, 40);
      // Shifting right would put it at 1700 + 280 + 40 = 2020 > 1800, so it wraps to targetPos.x (1750) and y = 100 + 180 + 40 = 320
      assert.strictEqual(res.x, 1750);
      assert.strictEqual(res.y, 320);
    });
  });

  describe('v0.4.8 (PRD-013) Scenario Template Gallery Metadata Integrity', () => {
    it('verifies all 8 scenario templates have complete metadata, tags, and pipelines in both languages', () => {
      const zhKeys = Object.keys(TEMPLATES_META.zh);
      const enKeys = Object.keys(TEMPLATES_META.en);
      assert.strictEqual(zhKeys.length, 8);
      assert.strictEqual(enKeys.length, 8);

      for (const lang of ['zh', 'en'] as const) {
        for (const [key, tpl] of Object.entries(TEMPLATES_META[lang])) {
          assert.strictEqual(tpl.key, key);
          assert.ok(tpl.name, `Template ${key} missing name in ${lang}`);
          assert.ok(tpl.shortDesc, `Template ${key} missing shortDesc in ${lang}`);
          assert.ok(tpl.scenario, `Template ${key} missing scenario in ${lang}`);
          assert.ok(tpl.category, `Template ${key} missing category in ${lang}`);
          assert.ok(Array.isArray(tpl.pipelineCapsules), `Template ${key} pipelineCapsules must be array`);
          assert.ok(tpl.pipelineCapsules.length >= 3, `Template ${key} should have at least 3 pipeline nodes`);
          assert.ok(tpl.difficulty, `Template ${key} difficulty must exist`);
        }
      }
    });

    it('verifies all categories in TEMPLATE_CATEGORIES are unique and have labels', () => {
      for (const lang of ['zh', 'en'] as const) {
        const categories = TEMPLATE_CATEGORIES[lang];
        assert.ok(categories.length >= 6);
        const catIds = categories.map((c) => c.id);
        const uniqueIds = new Set(catIds);
        assert.strictEqual(catIds.length, uniqueIds.size);
        for (const c of categories) {
          assert.ok(c.name);
          assert.ok(c.icon);
        }
      }
    });
  });

  describe('v0.4.10 (PRD-016) Checkpointing & Resumption Ergonomics & Store Integration', () => {
    it('verifies bilingual translations for resumeFromNode, resumeAllFailed, and cachedOutputBadge exist', () => {
      const enErgo = translations.en.ergonomics;
      const zhErgo = translations.zh.ergonomics;

      assert.ok(enErgo.resumeFromNode, 'Missing en.ergonomics.resumeFromNode');
      assert.ok(enErgo.resumeFromNodeHint, 'Missing en.ergonomics.resumeFromNodeHint');
      assert.ok(enErgo.resumeAllFailed, 'Missing en.ergonomics.resumeAllFailed');
      assert.ok(enErgo.cachedOutputBadge, 'Missing en.ergonomics.cachedOutputBadge');

      assert.ok(zhErgo.resumeFromNode, 'Missing zh.ergonomics.resumeFromNode');
      assert.ok(zhErgo.resumeFromNodeHint, 'Missing zh.ergonomics.resumeFromNodeHint');
      assert.ok(zhErgo.resumeAllFailed, 'Missing zh.ergonomics.resumeAllFailed');
      assert.ok(zhErgo.cachedOutputBadge, 'Missing zh.ergonomics.cachedOutputBadge');

      assert.strictEqual(enErgo.cachedOutputBadge, 'Cached (0 Token)');
      assert.strictEqual(zhErgo.cachedOutputBadge, '缓存已复用 (0 Token)');
    });

    it('restores checkpoint node states and outputs to canvas via restoreCheckpointToCanvas', async () => {
      const store = useWorkflowStore.getState();
      store.loadPreset({
        nodes: [
          {
            id: 'node_a',
            type: 'input',
            position: { x: 0, y: 0 },
            data: { label: 'Node A', type: 'input', status: 'idle', inputs: {}, outputs: {} },
          } as WorkflowNode,
          {
            id: 'node_b',
            type: 'prompt',
            position: { x: 100, y: 0 },
            data: { label: 'Node B', type: 'prompt', status: 'idle', inputs: {}, outputs: {} },
          } as WorkflowNode,
        ],
        edges: [],
      });

      const checkpoint: DAGCheckpoint = {
        id: 'chk_test_canvas',
        checkpointId: 'chk_test_canvas',
        runId: 'run_test_canvas',
        workflowId: 'wf_canvas',
        timestamp: Date.now(),
        graphTopologyHash: 'top_hash',
        currentWaveIndex: 1,
        totalWaves: 2,
        isCompleted: false,
        failedNodeIds: [],
        contextBag: {},
        nodeStates: {
          node_a: {
            nodeId: 'node_a',
            nodeType: 'input',
            status: 'cached',
            durationMs: 0,
            outputsSnapshot: { text: 'hydrated output a' },
            configHash: 'hash_a',
            tokensUsed: { prompt: 0, completion: 0, total: 0 },
          },
          node_b: {
            nodeId: 'node_b',
            nodeType: 'prompt',
            status: 'cached',
            durationMs: 0,
            outputsSnapshot: { promptText: 'hydrated output b' },
            configHash: 'hash_b',
            tokensUsed: { prompt: 0, completion: 0, total: 0 },
          },
        },
      };

      await indexedDb.saveCheckpoint(checkpoint);
      const restored = await store.restoreCheckpointToCanvas('chk_test_canvas');
      assert.strictEqual(restored, true);

      const updatedNodes = useWorkflowStore.getState().nodes;
      const nodeA = updatedNodes.find((n) => n.id === 'node_a');
      const nodeB = updatedNodes.find((n) => n.id === 'node_b');

      assert.ok(nodeA);
      assert.strictEqual(nodeA.data.status, 'cached');
      assert.deepStrictEqual(nodeA.data.outputs, { text: 'hydrated output a' });

      assert.ok(nodeB);
      assert.strictEqual(nodeB.data.status, 'cached');
      assert.deepStrictEqual(nodeB.data.outputs, { promptText: 'hydrated output b' });
    });

    it('restores run history snapshots to canvas via restoreRunToCanvas', () => {
      const store = useWorkflowStore.getState();
      store.loadPreset({
        nodes: [
          {
            id: 'node_x',
            type: 'code',
            position: { x: 0, y: 0 },
            data: { label: 'Node X', type: 'code', status: 'idle', inputs: {}, outputs: {} },
          } as WorkflowNode,
        ],
        edges: [],
      });

      const runRecord: RunHistoryRecord = {
        id: 'rec_1',
        runId: 'run_1',
        traceId: 'trace_1',
        workflowId: 'wf_1',
        startedAt: 1000,
        completedAt: 1150,
        durationMs: 150,
        totalDurationMs: 150,
        status: 'success',
        triggerMode: 'manual',
        totalTokens: { prompt: 10, completion: 20, total: 30 },
        estimatedCostUSD: 0.0001,
        totalCostUSD: 0.0001,
        nodeSnapshots: {
          node_x: {
            nodeId: 'node_x',
            nodeType: 'code',
            status: 'success',
            durationMs: 45,
            inputs: {},
            outputs: { result: 42 },
            tokenUsage: { prompt: 0, completion: 0, total: 0 },
            error: undefined,
          },
        },
        stepSnapshots: [],
        spans: [],
      };

      store.restoreRunToCanvas(runRecord);

      const nodeX = useWorkflowStore.getState().nodes.find((n) => n.id === 'node_x');
      assert.ok(nodeX);
      assert.strictEqual(nodeX.data.status, 'cached');
      assert.deepStrictEqual(nodeX.data.outputs, { result: 42 });
      assert.strictEqual(nodeX.data.executionResult?.latencyMs, 45);
    });
  });
});
