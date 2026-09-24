import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BrowserWorkflowEngine } from '../src/engine/browser-engine.ts';
import {
  NODE_EXECUTORS,
  InputNodeExecutor,
  PromptNodeExecutor,
  OutputNodeExecutor,
} from '../src/engine/nodes/index.ts';
import type { WorkflowNode, ExecutionEvent } from '../src/engine/types.ts';

async function collectEvents(generator: AsyncGenerator<ExecutionEvent>): Promise<ExecutionEvent[]> {
  const events: ExecutionEvent[] = [];
  for await (const ev of generator) {
    events.push(ev);
  }
  return events;
}

describe('DAG Wave Concurrency & Modular Node Executors', () => {
  describe('Modular Node Executors (T1 Probe Interface)', () => {
    it('InputNodeExecutor overlays options.inputs namespace and flat parameters', () => {
      const mockNode: WorkflowNode = {
        id: 'in_1',
        type: 'input',
        position: { x: 0, y: 0 },
        data: {
          label: 'Input Node',
          type: 'input',
          inputs: { defaultVal: 'hello' },
          outputs: {},
          status: 'idle',
        },
      };

      const result = InputNodeExecutor.execute({
        node: mockNode,
        resolvedInputs: { defaultVal: 'hello' },
        context: {},
        options: {
          inputs: {
            in_1: { customNamespaceVal: 'world' },
            query: 'search term',
          },
        },
      });

      assert.strictEqual((result as any).defaultVal, 'hello');
      assert.strictEqual((result as any).customNamespaceVal, 'world');
      assert.strictEqual((result as any).query, 'search term');
      assert.ok((result as any).output);
    });

    it('PromptNodeExecutor handles string templates and object fallback', () => {
      const mockNode: WorkflowNode = {
        id: 'p_1',
        type: 'prompt',
        position: { x: 0, y: 0 },
        data: { label: 'Prompt', type: 'prompt', inputs: {}, outputs: {}, status: 'idle' },
      };

      const stringResult = PromptNodeExecutor.execute({
        node: mockNode,
        resolvedInputs: { template: 'Summarize: {{text}}' },
        context: {},
      });
      assert.strictEqual((stringResult as any).promptText, 'Summarize: {{text}}');

      const jsonFallbackResult = PromptNodeExecutor.execute({
        node: mockNode,
        resolvedInputs: { data: { num: 42 } },
        context: {},
      });
      assert.strictEqual((jsonFallbackResult as any).promptText, JSON.stringify({ data: { num: 42 } }));
    });

    it('OutputNodeExecutor formats finalResult with ISO timestamp', () => {
      const mockNode: WorkflowNode = {
        id: 'out_1',
        type: 'output',
        position: { x: 0, y: 0 },
        data: { label: 'Output', type: 'output', inputs: {}, outputs: {}, status: 'idle' },
      };

      const result = OutputNodeExecutor.execute({
        node: mockNode,
        resolvedInputs: { score: 98, status: 'pass' },
        context: {},
      });
      assert.deepStrictEqual((result as any).finalResult, { score: 98, status: 'pass' });
      assert.ok(typeof (result as any).renderedAt === 'string');
      assert.ok(!isNaN(Date.parse((result as any).renderedAt)));
    });

    it('NODE_EXECUTORS registry correctly resolves input, prompt, and output', () => {
      assert.strictEqual(NODE_EXECUTORS.input, InputNodeExecutor);
      assert.strictEqual(NODE_EXECUTORS.prompt, PromptNodeExecutor);
      assert.strictEqual(NODE_EXECUTORS.output, OutputNodeExecutor);
    });
  });

  describe('DAG Wave Concurrency Chunking', () => {
    it('executes a wide layer of 12 parallel nodes chunked by maxConcurrency: 3', async () => {
      const engine = new BrowserWorkflowEngine();
      const nodeCount = 12;
      const nodes: WorkflowNode[] = [];

      for (let i = 0; i < nodeCount; i++) {
        nodes.push({
          id: `worker_${i}`,
          type: 'code',
          position: { x: i * 50, y: 0 },
          data: {
            label: `Worker ${i}`,
            type: 'code',
            inputs: {},
            outputs: {},
            status: 'idle',
            config: {
              script: `return { workerIndex: ${i}, processed: true };`,
            },
          },
        });
      }

      // 0 edges means all 12 nodes are in Layer 0 (a single parallel wave)
      const events = await collectEvents(
        engine.executeWorkflow(
          { nodes, edges: [] },
          { maxConcurrency: 3 },
        ),
      );

      const completeEvents = events.filter((e) => e.type === 'NODE_COMPLETE');
      assert.strictEqual(completeEvents.length, 12, 'All 12 chunked workers must complete');

      const workflowComplete = events.find((e) => e.type === 'WORKFLOW_COMPLETE');
      assert.ok(workflowComplete, 'Workflow should complete successfully');

      if (workflowComplete && workflowComplete.type === 'WORKFLOW_COMPLETE') {
        for (let i = 0; i < nodeCount; i++) {
          const workerOutput = (workflowComplete.payload.outputs as any)[`worker_${i}`];
          assert.ok(workerOutput, `Output for worker_${i} must exist`);
          assert.strictEqual(workerOutput.result.workerIndex, i);
          assert.strictEqual(workerOutput.result.processed, true);
        }
      }
    });

    it('aborts cleanly during chunked wave execution if signal is aborted', async () => {
      const engine = new BrowserWorkflowEngine();
      const nodes: WorkflowNode[] = [];

      for (let i = 0; i < 8; i++) {
        nodes.push({
          id: `node_${i}`,
          type: 'code',
          position: { x: i * 50, y: 0 },
          data: {
            label: `Node ${i}`,
            type: 'code',
            inputs: {},
            outputs: {},
            status: 'idle',
            config: {
              code: 'return { ok: true };',
            },
          },
        });
      }

      const controller = new AbortController();
      controller.abort(); // Abort before chunk processing

      let workflowError: string | undefined;
      try {
        const events = await collectEvents(
          engine.executeWorkflow(
            { nodes, edges: [] },
            { signal: controller.signal, maxConcurrency: 2 },
          ),
        );
        const errEvt = events.find((e) => e.type === 'WORKFLOW_ERROR');
        if (errEvt && errEvt.type === 'WORKFLOW_ERROR') {
          workflowError = errEvt.payload.error;
        }
      } catch (err) {
        workflowError = (err as Error).message;
      }

      assert.ok(workflowError, 'Aborted workflow must report error');
      assert.match(workflowError, /aborted/i);
    });
  });
});
