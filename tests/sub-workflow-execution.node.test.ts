import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BrowserWorkflowEngine } from '../src/engine/browser-engine.ts';
import type { WorkflowNode, WorkflowEdge, ExecutionEvent } from '../src/engine/types.ts';

async function collectEvents(generator: AsyncGenerator<ExecutionEvent>): Promise<ExecutionEvent[]> {
  const events: ExecutionEvent[] = [];
  for await (const ev of generator) {
    events.push(ev);
  }
  return events;
}

describe('SubWorkflowNode & LoopNode Real Execution & Delegation', () => {
  const engine = new BrowserWorkflowEngine();

  describe('SubWorkflowNode Execution', () => {
    it('Mode 1: delegates execution to a target canvas node with mapped inputs', async () => {
      const nodes: WorkflowNode[] = [
        {
          id: 'code_target',
          type: 'code',
          data: {
            label: 'Target Transform Code',
            type: 'code',
            inputs: {},
            outputs: {},
            status: 'idle',
            config: {
              language: 'javascript',
              code: 'return { echoed: (inputs.message || "").toUpperCase(), timestamp: 12345 };',
            },
          },
          position: { x: 0, y: 0 },
        },
        {
          id: 'sub_wf_1',
          type: 'sub_workflow',
          data: {
            label: 'Sub Workflow Delegate',
            type: 'sub_workflow',
            inputs: {},
            outputs: {},
            status: 'idle',
            config: {
              targetWorkflowId: 'code_target',
            },
          },
          position: { x: 200, y: 0 },
        },
      ];

      const edges: WorkflowEdge[] = [];

      const events = await collectEvents(
        engine.executeWorkflow(
          { nodes, edges },
          {
            inputs: { message: 'hello patchcat' },
          },
        ),
      );

      const subCompleteEvt = events.find(
        (e) => e.type === 'NODE_COMPLETE' && e.payload.nodeId === 'sub_wf_1',
      );
      assert.ok(subCompleteEvt, 'SubWorkflow node should complete successfully');

      if (subCompleteEvt && subCompleteEvt.type === 'NODE_COMPLETE') {
        assert.strictEqual(subCompleteEvt.payload.output['echoed'], 'HELLO PATCHCAT');
        assert.strictEqual(subCompleteEvt.payload.output['timestamp'], 12345);
        assert.strictEqual(subCompleteEvt.payload.output['delegatedNodeId'], 'code_target');
        assert.strictEqual(subCompleteEvt.payload.output['delegatedStatus'], 'success');
      }
    });

    it('Mode 2: executes a nested workflow graph passed via context', async () => {
      const nestedNodes: WorkflowNode[] = [
        {
          id: 'nested_code',
          type: 'code',
          data: {
            label: 'Nested Calculation',
            type: 'code',
            inputs: {},
            outputs: {},
            status: 'idle',
            config: {
              language: 'javascript',
              code: 'return { squared: (inputs.val || 0) * (inputs.val || 0) };',
            },
          },
          position: { x: 0, y: 0 },
        },
      ];

      const parentNodes: WorkflowNode[] = [
        {
          id: 'sub_wf_parent',
          type: 'sub_workflow',
          data: {
            label: 'Sub Workflow Caller',
            type: 'sub_workflow',
            inputs: {},
            outputs: {},
            status: 'idle',
            config: {
              targetWorkflowId: 'wf_nested_math',
            },
          },
          position: { x: 0, y: 0 },
        },
      ];

      const events = await collectEvents(
        engine.executeWorkflow(
          { nodes: parentNodes, edges: [] },
          {
            inputs: { val: 9 },
            context: {
              subWorkflows: {
                wf_nested_math: { nodes: nestedNodes, edges: [] },
              },
            },
          },
        ),
      );

      const subCompleteEvt = events.find(
        (e) => e.type === 'NODE_COMPLETE' && e.payload.nodeId === 'sub_wf_parent',
      );
      assert.ok(subCompleteEvt, 'Nested workflow should complete successfully');

      if (subCompleteEvt && subCompleteEvt.type === 'NODE_COMPLETE') {
        assert.strictEqual(subCompleteEvt.payload.output['squared'], 81);
        assert.strictEqual(subCompleteEvt.payload.output['targetWorkflowId'], 'wf_nested_math');
        assert.strictEqual(subCompleteEvt.payload.output['executedNodeCount'], 1);
      }
    });

    it('fails with explicit error when target ID is missing', async () => {
      const nodes: WorkflowNode[] = [
        {
          id: 'sub_wf_empty',
          type: 'sub_workflow',
          data: {
            label: 'Sub Workflow Empty Target',
            type: 'sub_workflow',
            inputs: {},
            outputs: {},
            status: 'idle',
            config: {},
          },
          position: { x: 0, y: 0 },
        },
      ];

      const events = await collectEvents(
        engine.executeWorkflow({ nodes, edges: [] }, { context: { strictSubWorkflow: true } }),
      );
      const errorEvt = events.find(
        (e) => e.type === 'NODE_ERROR' && e.payload.nodeId === 'sub_wf_empty',
      );
      assert.ok(errorEvt, 'Should yield NODE_ERROR when target is not configured');
      if (errorEvt && errorEvt.type === 'NODE_ERROR') {
        assert.match(errorEvt.payload.error, /Target workflow or canvas node ID is not specified/);
      }
    });

    it('fails with explicit error by default when target does not exist in canvas or storage (no backdoor)', async () => {
      const nodes: WorkflowNode[] = [
        {
          id: 'sub_wf_unknown',
          type: 'sub_workflow',
          data: {
            label: 'Sub Workflow Unknown Target',
            type: 'sub_workflow',
            inputs: {},
            outputs: {},
            status: 'idle',
            config: {
              targetWorkflowId: 'finance_recon_report_missing',
            },
          },
          position: { x: 0, y: 0 },
        },
      ];

      // Note: No strictSubWorkflow flag passed - defaults to strict
      const events = await collectEvents(engine.executeWorkflow({ nodes, edges: [] }));
      const errorEvt = events.find(
        (e) => e.type === 'NODE_ERROR' && e.payload.nodeId === 'sub_wf_unknown',
      );
      assert.ok(errorEvt, 'Should yield NODE_ERROR when target is not found by default');
      if (errorEvt && errorEvt.type === 'NODE_ERROR') {
        assert.match(errorEvt.payload.error, /was not found in active canvas or persistent storage/);
      }
    });

    it('allows stub fallback when allowStub is explicitly configured true', async () => {
      const nodes: WorkflowNode[] = [
        {
          id: 'sub_wf_stub_allowed',
          type: 'sub_workflow',
          data: {
            label: 'Sub Workflow Stub Allowed',
            type: 'sub_workflow',
            inputs: { sample: 'val' },
            outputs: {},
            status: 'idle',
            config: {
              targetWorkflowId: 'future_module_unimplemented',
              allowStub: true,
            },
          },
          position: { x: 0, y: 0 },
        },
      ];

      const events = await collectEvents(engine.executeWorkflow({ nodes, edges: [] }));
      const completeEvt = events.find(
        (e) => e.type === 'NODE_COMPLETE' && e.payload.nodeId === 'sub_wf_stub_allowed',
      );
      assert.ok(completeEvt, 'Should complete with stub when allowStub is true');
      if (completeEvt && completeEvt.type === 'NODE_COMPLETE') {
        assert.strictEqual(completeEvt.payload.output['targetWorkflowId'], 'future_module_unimplemented');
        assert.strictEqual(completeEvt.payload.output['isExperimentalStub'], true);
      }
    });

    it('allows stub fallback when strictSubWorkflow is explicitly disabled in context', async () => {
      const nodes: WorkflowNode[] = [
        {
          id: 'sub_wf_context_lenient',
          type: 'sub_workflow',
          data: {
            label: 'Sub Workflow Context Lenient',
            type: 'sub_workflow',
            inputs: {},
            outputs: {},
            status: 'idle',
            config: {
              targetWorkflowId: 'lenient_module_stub',
            },
          },
          position: { x: 0, y: 0 },
        },
      ];

      const events = await collectEvents(
        engine.executeWorkflow(
          { nodes, edges: [] },
          { context: { strictSubWorkflow: false } },
        ),
      );
      const completeEvt = events.find(
        (e) => e.type === 'NODE_COMPLETE' && e.payload.nodeId === 'sub_wf_context_lenient',
      );
      assert.ok(completeEvt, 'Should complete with stub when strictSubWorkflow is false');
    });

    it('detects self-recursion deadlock and aborts immediately', async () => {
      const nodes: WorkflowNode[] = [
        {
          id: 'sub_wf_recursive',
          type: 'sub_workflow',
          data: {
            label: 'Self Recursive Sub Workflow',
            type: 'sub_workflow',
            inputs: {},
            outputs: {},
            status: 'idle',
            config: {
              targetWorkflowId: 'sub_wf_recursive',
            },
          },
          position: { x: 0, y: 0 },
        },
      ];

      const events = await collectEvents(engine.executeWorkflow({ nodes, edges: [] }));
      const errorEvt = events.find(
        (e) => e.type === 'NODE_ERROR' && e.payload.nodeId === 'sub_wf_recursive',
      );
      assert.ok(errorEvt, 'Should detect self recursion');
      if (errorEvt && errorEvt.type === 'NODE_ERROR') {
        assert.match(errorEvt.payload.error, /cannot delegate to itself \(recursion detected\)/);
      }
    });

    it('detects indirect recursion cycle (A -> B -> A) and aborts immediately', async () => {
      const nodes: WorkflowNode[] = [
        {
          id: 'sub_wf_a',
          type: 'sub_workflow',
          data: {
            label: 'Sub Workflow A',
            type: 'sub_workflow',
            inputs: {},
            outputs: {},
            status: 'idle',
            config: {
              targetWorkflowId: 'sub_wf_b',
            },
          },
          position: { x: 0, y: 0 },
        },
        {
          id: 'sub_wf_b',
          type: 'sub_workflow',
          data: {
            label: 'Sub Workflow B',
            type: 'sub_workflow',
            inputs: {},
            outputs: {},
            status: 'idle',
            config: {
              targetWorkflowId: 'sub_wf_a',
            },
          },
          position: { x: 100, y: 0 },
        },
      ];

      // Edge from A to B so topological sort runs A first
      const edges = [{ id: 'e1', source: 'sub_wf_a', target: 'sub_wf_b' }];
      const events = await collectEvents(engine.executeWorkflow({ nodes, edges }));
      const errorEvt = events.find(
        (e) => e.type === 'NODE_ERROR' && (e.payload.nodeId === 'sub_wf_a' || e.payload.nodeId === 'sub_wf_b'),
      );
      assert.ok(errorEvt, 'Should detect indirect cycle recursion');
      if (errorEvt && errorEvt.type === 'NODE_ERROR') {
        assert.match(
          errorEvt.payload.error,
          /SubWorkflow cycle detected: .* \(indirect recursion is strictly prohibited\)/,
        );
      }
    });

    it('enforces maximum delegation depth protection (MAX_DELEGATION_DEPTH = 5)', async () => {
      // Chain of 7 nodes: d1 -> d2 -> d3 -> d4 -> d5 -> d6 -> d7
      const nodes: WorkflowNode[] = [
        { id: 'd1', type: 'sub_workflow', position: { x: 0, y: 0 }, data: { label: 'D1', type: 'sub_workflow', inputs: {}, outputs: {}, status: 'idle', config: { targetWorkflowId: 'd2' } } },
        { id: 'd2', type: 'sub_workflow', position: { x: 0, y: 0 }, data: { label: 'D2', type: 'sub_workflow', inputs: {}, outputs: {}, status: 'idle', config: { targetWorkflowId: 'd3' } } },
        { id: 'd3', type: 'sub_workflow', position: { x: 0, y: 0 }, data: { label: 'D3', type: 'sub_workflow', inputs: {}, outputs: {}, status: 'idle', config: { targetWorkflowId: 'd4' } } },
        { id: 'd4', type: 'sub_workflow', position: { x: 0, y: 0 }, data: { label: 'D4', type: 'sub_workflow', inputs: {}, outputs: {}, status: 'idle', config: { targetWorkflowId: 'd5' } } },
        { id: 'd5', type: 'sub_workflow', position: { x: 0, y: 0 }, data: { label: 'D5', type: 'sub_workflow', inputs: {}, outputs: {}, status: 'idle', config: { targetWorkflowId: 'd6' } } },
        { id: 'd6', type: 'sub_workflow', position: { x: 0, y: 0 }, data: { label: 'D6', type: 'sub_workflow', inputs: {}, outputs: {}, status: 'idle', config: { targetWorkflowId: 'd7' } } },
        { id: 'd7', type: 'code', position: { x: 0, y: 0 }, data: { label: 'D7', type: 'code', inputs: {}, outputs: {}, status: 'idle', config: { code: 'return { done: true };' } } },
      ];

      const events = await collectEvents(
        engine.executeWorkflow({
          nodes,
          edges: [],
        }),
      );

      const errorEvt = events.find(
        (e) => e.type === 'NODE_ERROR' && (e.payload.nodeId === 'd1' || e.payload.nodeId === 'd6'),
      );
      assert.ok(errorEvt, 'Should detect max delegation depth exceeded');
      if (errorEvt && errorEvt.type === 'NODE_ERROR') {
        assert.match(
          errorEvt.payload.error,
          /SubWorkflow maximum delegation depth \(5\) exceeded/,
        );
      }
    });
  });

  describe('LoopNode Execution', () => {
    it('iterates over array and delegates execution to target canvas node', async () => {
      const nodes: WorkflowNode[] = [
        {
          id: 'item_processor',
          type: 'code',
          data: {
            label: 'Item Processor',
            type: 'code',
            inputs: {},
            outputs: {},
            status: 'idle',
            config: {
              language: 'javascript',
              code: 'return { len: String(inputs.item).length, original: inputs.item, pos: inputs.index };',
            },
          },
          position: { x: 0, y: 0 },
        },
        {
          id: 'loop_node_1',
          type: 'loop',
          data: {
            label: 'Loop Node',
            type: 'loop',
            inputs: {},
            outputs: {},
            status: 'idle',
            config: {
              inputArrayVariable: 'names',
              targetNodeId: 'item_processor',
              maxConcurrency: 2,
            },
          },
          position: { x: 200, y: 0 },
        },
      ];

      const events = await collectEvents(
        engine.executeWorkflow(
          { nodes, edges: [] },
          {
            inputs: { names: ['ant', 'beetle', 'caterpillar'] },
          },
        ),
      );

      const loopComplete = events.find(
        (e) => e.type === 'NODE_COMPLETE' && e.payload.nodeId === 'loop_node_1',
      );
      assert.ok(loopComplete, 'Loop node should complete successfully');

      if (loopComplete && loopComplete.type === 'NODE_COMPLETE') {
        assert.strictEqual(loopComplete.payload.output['totalItems'], 3);
        assert.strictEqual(loopComplete.payload.output['successCount'], 3);
        assert.strictEqual(loopComplete.payload.output['errorCount'], 0);

        const results = loopComplete.payload.output['results'] as Array<any>;
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0].output.len, 3);
        assert.strictEqual(results[0].output.pos, 0);
        assert.strictEqual(results[1].output.len, 6);
        assert.strictEqual(results[1].output.pos, 1);
        assert.strictEqual(results[2].output.len, 11);
        assert.strictEqual(results[2].output.pos, 2);
      }
    });

    it('returns honest summary when no target processor is bound (no fake processed: true)', async () => {
      const nodes: WorkflowNode[] = [
        {
          id: 'loop_standalone',
          type: 'loop',
          data: {
            label: 'Standalone Loop',
            type: 'loop',
            inputs: {},
            outputs: {},
            status: 'idle',
            config: {
              inputArrayVariable: 'list',
            },
          },
          position: { x: 0, y: 0 },
        },
      ];

      const events = await collectEvents(
        engine.executeWorkflow(
          { nodes, edges: [] },
          {
            inputs: { list: ['a', 'b', 'c', 'd'] },
          },
        ),
      );

      const loopComplete = events.find(
        (e) => e.type === 'NODE_COMPLETE' && e.payload.nodeId === 'loop_standalone',
      );
      assert.ok(loopComplete);
      if (loopComplete && loopComplete.type === 'NODE_COMPLETE') {
        assert.strictEqual(loopComplete.payload.output['totalItems'], 4);
        assert.deepStrictEqual(loopComplete.payload.output['items'], ['a', 'b', 'c', 'd']);
        assert.match(String(loopComplete.payload.output['summary']), /Batch processed 4 items/);
        assert.strictEqual(loopComplete.payload.output['results'].length, 4);
        assert.strictEqual(loopComplete.payload.output['results'][0].item, 'a');
      }
    });
  });
});
