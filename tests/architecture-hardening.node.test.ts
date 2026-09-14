import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveVariables,
  resolveNodeInputs,
} from '../src/engine/variable-resolver.ts';
import { runSandboxedScript } from '../src/engine/sandbox-executor.ts';
import { validateGraphTopology } from '../src/engine/topological-sort.ts';
import { BrowserWorkflowEngine } from '../src/engine/browser-engine.ts';
import type { WorkflowNode, WorkflowEdge, ExecutionEvent } from '../src/engine/types.ts';
import { IndexedDBAdapter } from '../src/services/storage/indexeddb-adapter.ts';
import { safeSetLocalStorageItem } from '../src/services/storage/storage-adapter.ts';

async function collectEvents(generator: AsyncGenerator<ExecutionEvent>): Promise<ExecutionEvent[]> {
  const events: ExecutionEvent[] = [];
  for await (const ev of generator) {
    events.push(ev);
  }
  return events;
}

describe('Architecture Hardening & Technical Debt Verification', () => {
  describe('Module 9: Native Variable Slot Object/Array Type Preservation', () => {
    it('preserves native arrays when template exactly matches a single slot', () => {
      const outputs = {
        node_1: {
          items: ['apple', 'banana', 'orange'],
        },
      };

      const result = resolveVariables('{{node_1.items}}', outputs);
      assert.ok(Array.isArray(result), 'Result should be a native array');
      assert.deepStrictEqual(result, ['apple', 'banana', 'orange']);
    });

    it('preserves native objects when template exactly matches a single slot', () => {
      const outputs = {
        node_1: {
          user: { id: 101, name: 'Alice', active: true },
        },
      };

      const result = resolveVariables('{{node_1.user}}', outputs);
      assert.strictEqual(typeof result, 'object');
      assert.strictEqual((result as { name: string }).name, 'Alice');
      assert.strictEqual((result as { active: boolean }).active, true);
    });

    it('preserves native numbers and booleans', () => {
      const outputs = {
        node_1: {
          count: 42,
          isEnabled: false,
        },
      };

      assert.strictEqual(resolveVariables('{{node_1.count}}', outputs), 42);
      assert.strictEqual(resolveVariables('{{node_1.isEnabled}}', outputs), false);
    });

    it('converts to string interpolation when text is mixed or multiple slots exist', () => {
      const outputs = {
        node_1: {
          name: 'Alice',
          role: 'Admin',
        },
      };

      const result = resolveVariables('User: {{node_1.name}} ({{node_1.role}})', outputs);
      assert.strictEqual(result, 'User: Alice (Admin)');
    });

    it('resolveNodeInputs passes native object slots through to inputs map', () => {
      const nodeInputs = {
        data: '{{source.payload}}',
        label: 'Result: {{source.title}}',
      };
      const outputs = {
        source: {
          payload: { records: [1, 2, 3] },
          title: 'Summary',
        },
      };

      const resolved = resolveNodeInputs(nodeInputs, outputs);
      assert.deepStrictEqual(resolved.data, { records: [1, 2, 3] });
      assert.strictEqual(resolved.label, 'Result: Summary');
    });
  });

  describe('Module 7: Sandbox Executor Async / Promise Support', () => {
    it('executes async JavaScript functions returning Promises in Node VM', async () => {
      const script = `
        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        await delay(10);
        return { success: true, count: inputs.initial + 5 };
      `;
      const { result } = await runSandboxedScript(script, { initial: 10 }, { timeoutMs: 2000 });
      assert.deepStrictEqual(result, { success: true, count: 15 });
    });

    it('handles synchronous returns seamlessly in Node VM', async () => {
      const script = `
        return { doubled: inputs.val * 2 };
      `;
      const { result } = await runSandboxedScript(script, { val: 21 }, { timeoutMs: 1000 });
      assert.deepStrictEqual(result, { doubled: 42 });
    });

    it('triggers timeout watchdog when async code hangs or exceeds timeoutMs', async () => {
      const script = `
        await new Promise(() => {}); // never resolves
      `;
      await assert.rejects(
        async () => {
          await runSandboxedScript(script, {}, { timeoutMs: 100 });
        },
        /沙箱执行超时/,
      );
    });
  });

  describe('Module 5: Graph Topology Ghost Edge & Dependency Scanning', () => {
    it('detects unlinked variable dependencies as warnings without crashing topology sort', () => {
      const nodes: WorkflowNode[] = [
        {
          id: 'node_a',
          type: 'input',
          position: { x: 0, y: 0 },
          data: { label: 'Input', inputs: { query: 'test' } },
        },
        {
          id: 'node_b',
          type: 'llm',
          position: { x: 200, y: 0 },
          // Node B references node_a but there is NO edge connecting node_a -> node_b!
          data: { label: 'LLM', inputs: { prompt: '{{node_a.query}}' } },
        },
      ];

      const edges: WorkflowEdge[] = []; // empty edges = disconnected

      const report = validateGraphTopology({ nodes, edges });
      assert.strictEqual(report.valid, true);
      assert.ok(report.warnings && report.warnings.length > 0, 'Expected warnings for ghost variable dependency');
      assert.ok(
        report.warnings.some((w) => w.includes('Ghost variable dependency detected')),
        'Warning should explicitly mention ghost variable dependency',
      );
      assert.ok(
        report.warnings.some((w) => w.includes('LLM') && w.includes('node_a')),
        'Warning should indicate consumer and producer nodes',
      );
    });

    it('produces no ghost edge warnings when graph edges properly connect dependencies', () => {
      const nodes: WorkflowNode[] = [
        {
          id: 'node_a',
          type: 'input',
          position: { x: 0, y: 0 },
          data: { label: 'Input', inputs: { query: 'test' } },
        },
        {
          id: 'node_b',
          type: 'llm',
          position: { x: 200, y: 0 },
          data: { label: 'LLM', inputs: { prompt: '{{node_a.query}}' } },
        },
      ];

      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 'node_a', target: 'node_b' },
      ];

      const report = validateGraphTopology({ nodes, edges });
      assert.strictEqual(report.valid, true);
      const ghostWarnings = (report.warnings || []).filter((w) => w.includes('Ghost variable dependency detected'));
      assert.strictEqual(ghostWarnings.length, 0);
    });
  });

  describe('Module 2: Execution Engine IoC Dependency Injection', () => {
    it('engine uses injected settings and knowledgeAdapter from context options', async () => {
      const engine = new BrowserWorkflowEngine();

      const nodes: WorkflowNode[] = [
        {
          id: 'in_1',
          type: 'input',
          position: { x: 0, y: 0 },
          data: { label: 'Input', inputs: { val: 'hello' } },
        },
        {
          id: 'code_1',
          type: 'code',
          position: { x: 200, y: 0 },
          data: {
            label: 'Transform',
            inputs: { inputVal: '{{in_1.val}}' },
            config: { script: 'return { echoed: inputs.inputVal };' },
          },
        },
      ];

      const edges: WorkflowEdge[] = [
        { id: 'e1', source: 'in_1', target: 'code_1' },
      ];

      // Inject custom settings context
      const customContext = {
        settings: {
          activeProvider: 'ollama' as const,
          providers: {
            ollama: {
              id: 'ollama' as const,
              name: 'Ollama (Injected)',
              apiKey: '',
              apiBaseUrl: 'http://localhost:11434',
              defaultModel: 'llama3',
              availableModels: ['llama3'],
            },
          },
        },
        knowledgeAdapter: {
          retrieve: async () => ({
            query: 'test',
            chunks: [],
            totalChunks: 0,
            retrievalTimeMs: 1,
          }),
        },
      };

      const events = await collectEvents(
        engine.executeWorkflow(
          { nodes, edges },
          { context: customContext },
        ),
      );

      const completeEvent = events.find((e) => e.type === 'WORKFLOW_COMPLETE');
      assert.ok(completeEvent, 'Workflow should complete successfully');
      assert.deepStrictEqual(completeEvent.payload?.outputs?.code_1?.result, { echoed: 'hello' });
    });
  });

  describe('Module 6: Storage LocalStorage Safe Quota Guard & IndexedDB Interface', () => {
    it('safeSetLocalStorageItem intercepts QuotaExceededError and provides structured hint', () => {
      const originalSetItem = globalThis.localStorage?.setItem;
      try {
        if (globalThis.localStorage) {
          globalThis.localStorage.setItem = () => {
            const err = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
            throw err;
          };
          assert.throws(
            () => safeSetLocalStorageItem('test_key', 'test_val'),
            /\[存储空间耗尽\] 本地浏览器 LocalStorage 5MB 配额已满/,
          );
        }
      } finally {
        if (globalThis.localStorage && originalSetItem) {
          globalThis.localStorage.setItem = originalSetItem;
        }
      }
    });

    it('IndexedDBAdapter initializes and matches async persistence API', () => {
      const adapter = new IndexedDBAdapter();
      assert.ok(adapter, 'IndexedDBAdapter should instantiate');
      assert.strictEqual(typeof adapter.isSupported, 'function');
      assert.strictEqual(typeof adapter.get, 'function');
      assert.strictEqual(typeof adapter.getAll, 'function');
      assert.strictEqual(typeof adapter.put, 'function');
      assert.strictEqual(typeof adapter.delete, 'function');
      assert.strictEqual(typeof adapter.clear, 'function');
    });
  });
});
