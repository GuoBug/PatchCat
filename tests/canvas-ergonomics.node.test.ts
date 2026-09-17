import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HistoryManager } from '../src/engine/history-manager.ts';
import { BrowserWorkflowEngine } from '../src/engine/browser-engine.ts';
import type { WorkflowNode, WorkflowEdge, ExecutionEvent } from '../src/engine/types.ts';

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
});
