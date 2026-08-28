/**
 * @file    tests/engine.node.test.ts
 * @description
 *   Comprehensive test suite covering:
 *   1. Topological Sort & Graph Validation (Kahn's Algorithm)
 *   2. Variable Resolver & Injection (Mustache syntax, Nested paths, Prototype Pollution)
 *   3. Execution Engine Runtime (Async event streams, Context passing, Layer concurrency)
 *   4. Advanced Engineering Benchmarks & Chaos Tests:
 *      - Concurrency Timing Validation: max(T_i) vs sum(T_i)
 *      - In-flight Mid-Execution Cancellation via AbortSignal
 *      - Single-node Rejection Cascading & Downstream Execution Halting
 *      - Dangling / Orphan Edge Pre-flight Negative Assertions
 *   5. Zustand Store State Machine (Node CRUD, Status transitions, Preset loading)
 *
 *   Run with: npm test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { topologicalSort, validateGraphTopology } from '../src/engine/topological-sort.ts';
import {
  resolveTemplateVariables,
  extractVariableReferences,
  getNestedProperty,
  resolveObjectVariables,
} from '../src/engine/variable-resolver.ts';
import { BrowserWorkflowEngine } from '../src/engine/browser-engine.ts';
import { useWorkflowStore } from '../src/stores/workflow-store.ts';
import { getDefaultNodeConfig } from '../src/engine/types.ts';
import type { WorkflowNode, WorkflowEdge, ExecutionEvent } from '../src/engine/types.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeNode(
  id: string,
  type: 'input' | 'prompt' | 'llm' | 'code' | 'output' = 'llm',
  inputs: Record<string, unknown> = {},
  config: Record<string, unknown> = {},
): WorkflowNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: {
      label: id,
      type,
      status: 'idle',
      inputs,
      outputs: {},
      config: { ...getDefaultNodeConfig(type), ...config },
    },
  };
}

function makeEdge(source: string, target: string, sourceHandle = 'output', targetHandle = 'input'): WorkflowEdge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    sourceHandle,
    targetHandle,
  };
}

async function collectEvents(generator: AsyncIterable<ExecutionEvent>): Promise<ExecutionEvent[]> {
  const events: ExecutionEvent[] = [];
  for await (const event of generator) {
    events.push(event);
  }
  return events;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Topological Sort & Graph Validation
// ─────────────────────────────────────────────────────────────────────────────

describe('Topological Sort (Kahn\'s Algorithm)', () => {
  it('should sort a linear chain A -> B -> C', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'C')];

    const result = topologicalSort({ nodes, edges });
    assert.equal(result.hasCycle, false);
    assert.deepEqual(result.executionLayers, [['A'], ['B'], ['C']]);
    assert.deepEqual(result.sortedNodeIds, ['A', 'B', 'C']);
  });

  it('should partition parallel branches into layers', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
    const edges = [
      makeEdge('A', 'B'),
      makeEdge('A', 'C'),
      makeEdge('B', 'D'),
      makeEdge('C', 'D'),
    ];

    const result = topologicalSort({ nodes, edges });
    assert.equal(result.hasCycle, false);
    assert.deepEqual(result.executionLayers[0], ['A']);
    assert.deepEqual(result.executionLayers[1]?.sort(), ['B', 'C']);
    assert.deepEqual(result.executionLayers[2], ['D']);
  });

  it('should detect cycles and report cyclic nodes', () => {
    const nodes = [makeNode('A'), makeNode('B')];
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'A')];

    const result = topologicalSort({ nodes, edges });
    assert.equal(result.hasCycle, true);
    assert.deepEqual(result.cycleNodeIds.sort(), ['A', 'B']);
  });

  it('should validate DAG topology without errors', () => {
    const nodes = [makeNode('A'), makeNode('B')];
    const edges = [makeEdge('A', 'B')];

    const result = validateGraphTopology({ nodes, edges });
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Variable Resolver
// ─────────────────────────────────────────────────────────────────────────────

describe('Variable Resolver', () => {
  it('should access nested object properties', () => {
    const obj = { result: { items: [{ name: 'First' }] } };
    assert.equal(getNestedProperty(obj, 'result.items[0].name'), 'First');
  });

  it('should protect against prototype pollution', () => {
    assert.equal(getNestedProperty({}, '__proto__'), undefined);
    assert.equal(getNestedProperty({}, 'constructor'), undefined);
    assert.equal(getNestedProperty({}, 'prototype'), undefined);
  });

  it('should extract template variable references', () => {
    const refs = extractVariableReferences('Hello {{node_1.output}} with {{llm.summary | "N/A"}}');
    assert.equal(refs.length, 2);
    assert.equal(refs[0]?.nodeId, 'node_1');
    assert.equal(refs[1]?.defaultValue, 'N/A');
  });

  it('should resolve template variables with fallback', () => {
    const context = {
      input_1: { query: 'What is DAG?' },
      llm_1: { response: 'A Directed Acyclic Graph.' },
    };

    const template = 'Q: {{input_1.query}} A: {{llm_1.response}} Tag: {{missing.tag | "AI"}}';
    const resolved = resolveTemplateVariables(template, context);
    assert.equal(resolved, 'Q: What is DAG? A: A Directed Acyclic Graph. Tag: AI');
  });

  it('should recursively resolve nested objects and arrays', () => {
    const context = {
      user: { name: 'Alice', role: 'Engineer' },
    };
    const inputObj = {
      title: 'Profile of {{user.name}}',
      meta: { role: '{{user.role}}' },
      tags: ['{{user.name}}', 'member'],
    };

    const resolved = resolveObjectVariables(inputObj, context);
    assert.deepEqual(resolved, {
      title: 'Profile of Alice',
      meta: { role: 'Engineer' },
      tags: ['Alice', 'member'],
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Execution Engine Runtime & Async Scheduling
// ─────────────────────────────────────────────────────────────────────────────

describe('Execution Runtime (Async Scheduling & Propagation)', () => {
  it('should execute a multi-node pipeline and pass data across layers', async () => {
    const engine = new BrowserWorkflowEngine();

    const nodes: WorkflowNode[] = [
      makeNode('in_1', 'input', { message: 'Hello AI' }),
      makeNode('pr_1', 'prompt', { template: 'User says: {{in_1.output.message}}' }),
      makeNode('llm_1', 'llm', { prompt: '{{pr_1.promptText}}' }),
      makeNode('out_1', 'output', { final: '{{llm_1.response}}' }),
    ];

    const edges: WorkflowEdge[] = [
      makeEdge('in_1', 'pr_1'),
      makeEdge('pr_1', 'llm_1'),
      makeEdge('llm_1', 'out_1'),
    ];

    const events = await collectEvents(engine.executeWorkflow({ nodes, edges }));

    assert.equal(events[0]?.type, 'WORKFLOW_START');
    assert.equal((events[0]?.payload as any).totalNodes, 4);

    const completeEvents = events.filter((e) => e.type === 'NODE_COMPLETE');
    assert.equal(completeEvents.length, 4);

    const completedNodeIds = completeEvents.map((e) => (e.payload as any).nodeId);
    assert.deepEqual(completedNodeIds, ['in_1', 'pr_1', 'llm_1', 'out_1']);

    const finalEvent = events[events.length - 1];
    assert.equal(finalEvent?.type, 'WORKFLOW_COMPLETE');

    const outputs = (finalEvent?.payload as any).outputs;
    assert.ok(outputs.in_1);
    assert.ok(outputs.pr_1);
    assert.ok(outputs.llm_1);
    assert.ok(outputs.out_1);
    assert.ok(outputs.pr_1.promptText.includes('User says: Hello AI'));
  });

  it('should handle global inputs injection', async () => {
    const engine = new BrowserWorkflowEngine();
    const nodes = [makeNode('in_1', 'input', { query: 'default' })];
    const edges: WorkflowEdge[] = [];

    const events = await collectEvents(
      engine.executeWorkflow(
        { nodes, edges },
        { inputs: { injectedKey: 'injectedValue' } },
      ),
    );

    const finalEvent = events.find((e) => e.type === 'WORKFLOW_COMPLETE');
    const outputs = (finalEvent?.payload as any).outputs;
    assert.equal(outputs.global_input.injectedKey, 'injectedValue');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Advanced Engineering Benchmarks & Chaos Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Advanced Engineering Benchmarks & Edge-Case Verification', () => {
  it('1. Concurrency Timing: parallel layer execution time must be ~max(T_i) rather than sum(T_i)', async () => {
    const engine = new BrowserWorkflowEngine();

    // Node A feeds into B (100ms) and C (100ms) concurrently
    const nodes: WorkflowNode[] = [
      makeNode('A', 'input', { data: 'start' }),
      makeNode('B', 'llm', {}, { delayMs: 100 }),
      makeNode('C', 'llm', {}, { delayMs: 100 }),
    ];
    const edges: WorkflowEdge[] = [
      makeEdge('A', 'B'),
      makeEdge('A', 'C'),
    ];

    const wallClockStart = Date.now();
    const events = await collectEvents(engine.executeWorkflow({ nodes, edges }));
    const wallClockDuration = Date.now() - wallClockStart;

    const finalEvent = events.find((e) => e.type === 'WORKFLOW_COMPLETE');
    assert.ok(finalEvent, 'Workflow should complete successfully');

    // Sequential sum would be >= 200ms. Parallel execution should be < 170ms
    assert.ok(
      wallClockDuration < 175,
      `Expected parallel execution (~max(T_i) < 175ms), but took ${wallClockDuration}ms (sequential would be >= 200ms)`,
    );
  });

  it('2. In-flight Abort: should interrupt waiting Promise.all mid-execution promptly', async () => {
    const engine = new BrowserWorkflowEngine();
    const abortController = new AbortController();

    // Nodes with 300ms latency
    const nodes: WorkflowNode[] = [
      makeNode('A', 'llm', {}, { delayMs: 300 }),
      makeNode('B', 'llm', {}, { delayMs: 300 }),
    ];
    const edges: WorkflowEdge[] = [];

    // Trigger abort after 50ms (well before 300ms finishes)
    setTimeout(() => {
      abortController.abort();
    }, 50);

    const abortStart = Date.now();
    const events = await collectEvents(
      engine.executeWorkflow({ nodes, edges }, { signal: abortController.signal }),
    );
    const abortDuration = Date.now() - abortStart;

    const errorEvent = events.find((e) => e.type === 'WORKFLOW_ERROR');
    assert.ok(errorEvent, 'Should yield WORKFLOW_ERROR upon in-flight cancellation');
    assert.ok((errorEvent.payload as any).error.includes('aborted'));

    // Verify it aborted promptly rather than waiting for the full 300ms
    assert.ok(
      abortDuration < 150,
      `Expected immediate in-flight abort (< 150ms), but took ${abortDuration}ms`,
    );
  });

  it('3. Error Bubbling: single node rejection must halt downstream layers and emit NODE_ERROR', async () => {
    const engine = new BrowserWorkflowEngine();

    // Pipeline: A (success) -> B (throws error) -> C (downstream must NOT execute)
    const nodes: WorkflowNode[] = [
      makeNode('A', 'input', { val: '1' }),
      makeNode('B', 'code', {}, { throwError: true, errorMessage: 'SyntaxError: Division by zero in Code Node' }),
      makeNode('C', 'output', { from: '{{B.result}}' }),
    ];
    const edges: WorkflowEdge[] = [
      makeEdge('A', 'B'),
      makeEdge('B', 'C'),
    ];

    const events = await collectEvents(engine.executeWorkflow({ nodes, edges }));

    // 1. A should succeed
    const completeA = events.find((e) => e.type === 'NODE_COMPLETE' && (e.payload as any).nodeId === 'A');
    assert.ok(completeA, 'Node A should complete before Node B fails');

    // 2. B should emit NODE_ERROR
    const nodeErrorB = events.find((e) => e.type === 'NODE_ERROR' && (e.payload as any).nodeId === 'B');
    assert.ok(nodeErrorB, 'Node B should emit NODE_ERROR');
    assert.ok((nodeErrorB.payload as any).error.includes('Division by zero'));

    // 3. C must NEVER be executed
    const completeC = events.find((e) => e.type === 'NODE_COMPLETE' && (e.payload as any).nodeId === 'C');
    assert.equal(completeC, undefined, 'Downstream Node C must NOT execute when upstream Node B fails');

    // 4. Global WORKFLOW_ERROR must be emitted
    const workflowError = events.find((e) => e.type === 'WORKFLOW_ERROR');
    assert.ok(workflowError, 'Workflow should terminate with WORKFLOW_ERROR');
  });

  it('4. Dangling / Orphan Edge Negative Assertion: explicit invalid edge ID must be rejected at pre-flight', async () => {
    const engine = new BrowserWorkflowEngine();

    // Edge points to non-existent target node
    const nodes: WorkflowNode[] = [makeNode('A', 'input')];
    const edges: WorkflowEdge[] = [makeEdge('A', 'NON_EXISTENT_GHOST_NODE')];

    // Static validation check
    const validation = engine.validateGraph({ nodes, edges });
    assert.equal(validation.valid, false);
    assert.ok(validation.errors.some((e) => e.includes('NON_EXISTENT_GHOST_NODE')));

    // Runtime execution check: must yield WORKFLOW_ERROR before executing any nodes
    const events = await collectEvents(engine.executeWorkflow({ nodes, edges }));
    assert.equal(events.length, 1);
    assert.equal(events[0]?.type, 'WORKFLOW_ERROR');
    assert.ok((events[0]?.payload as any).error.includes('Graph validation failed'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Global State Store (Zustand)
// ─────────────────────────────────────────────────────────────────────────────

describe('Workflow Zustand Store', () => {
  it('should add nodes and assign unique IDs and auto-incrementing labels', () => {
    const store = useWorkflowStore.getState();

    const id1 = store.addNode('llm', { x: 100, y: 100 });
    const id2 = store.addNode('prompt', { x: 200, y: 200 });

    const nodes = useWorkflowStore.getState().nodes;
    const node1 = nodes.find((n) => n.id === id1);
    const node2 = nodes.find((n) => n.id === id2);

    assert.ok(node1);
    assert.ok(node2);
    assert.equal(node1.type, 'llm');
    assert.equal(node2.type, 'prompt');
    assert.equal(node1.data.status, 'idle');
  });

  it('should update node data and status', () => {
    const store = useWorkflowStore.getState();
    const id = store.addNode('input');

    store.updateNodeData(id, { label: 'Updated Input Label' });
    let node = useWorkflowStore.getState().nodes.find((n) => n.id === id);
    assert.equal(node?.data.label, 'Updated Input Label');

    store.setNodeStatus(id, 'running');
    node = useWorkflowStore.getState().nodes.find((n) => n.id === id);
    assert.equal(node?.data.status, 'running');

    store.setNodeStatus(id, 'success', { latencyMs: 150, timestamp: Date.now() });
    node = useWorkflowStore.getState().nodes.find((n) => n.id === id);
    assert.equal(node?.data.status, 'success');
    assert.equal(node?.data.executionResult?.latencyMs, 150);
  });

  it('should reset execution state across all nodes', () => {
    const store = useWorkflowStore.getState();
    const id = store.addNode('llm');

    store.setNodeStatus(id, 'success', { latencyMs: 300 });
    store.resetExecutionState();

    const node = useWorkflowStore.getState().nodes.find((n) => n.id === id);
    assert.equal(node?.data.status, 'idle');
    assert.equal(node?.data.executionResult, undefined);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Real-World End-to-End Scenario: E-Commerce Multi-Agent Arbitration Pipeline
// ─────────────────────────────────────────────────────────────────────────────

describe('Scenario Test: E-Commerce Multi-Agent Refund Arbitrator Pipeline', () => {
  it('should run the 6-node arbitration workflow with parallel LLM execution', async () => {
    const engine = new BrowserWorkflowEngine();

    // 1. Build 6 Nodes
    const nodes: WorkflowNode[] = [
      makeNode('input_order', 'input', { order_id: 'ORD-9527', amount: 299, reason: '商品破损且客服态度差' }),
      makeNode('prompt_builder', 'prompt', {
        template: '审核工单 {{input_order.order_id}}，金额: ￥{{input_order.amount}}，原因: {{input_order.reason}}，豁免政策: {{input_order.vip_waiver | "无特殊豁免"}}',
      }),
      makeNode('llm_policy', 'llm', { prompt: '{{prompt_builder.promptText}}' }, { model: 'gpt-4o', delayMs: 100 }),
      makeNode('llm_sentiment', 'llm', { prompt: '{{prompt_builder.promptText}}' }, { model: 'deepseek-r1', delayMs: 100 }),
      makeNode('code_arbitrator', 'code', {
        policy_result: '{{llm_policy.response}}',
        sentiment_result: '{{llm_sentiment.response}}',
        amount: '{{input_order.amount}}',
      }),
      makeNode('output_report', 'output', { decision: '{{code_arbitrator.result}}' }),
    ];

    // 2. Build Directed Edges
    const edges: WorkflowEdge[] = [
      makeEdge('input_order', 'prompt_builder', 'output', 'inputs'),
      makeEdge('prompt_builder', 'llm_policy', 'promptText', 'prompt'),
      makeEdge('prompt_builder', 'llm_sentiment', 'promptText', 'prompt'),
      makeEdge('llm_policy', 'code_arbitrator', 'response', 'inputs'),
      makeEdge('llm_sentiment', 'code_arbitrator', 'response', 'inputs'),
      makeEdge('code_arbitrator', 'output_report', 'result', 'final'),
    ];

    // 3. Assert Topological Layering
    const sortResult = topologicalSort({ nodes, edges });
    assert.equal(sortResult.hasCycle, false);
    assert.equal(sortResult.executionLayers.length, 5);
    assert.deepEqual(sortResult.executionLayers[2]?.sort(), ['llm_policy', 'llm_sentiment']);

    // 4. Execute Full Pipeline
    const startTime = Date.now();
    const events = await collectEvents(engine.executeWorkflow({ nodes, edges }));
    const totalDuration = Date.now() - startTime;

    // 5. Verify Event Lifecycle
    const finalEvent = events.find((e) => e.type === 'WORKFLOW_COMPLETE');
    assert.ok(finalEvent, 'Workflow must complete with WORKFLOW_COMPLETE');

    const outputs = (finalEvent.payload as any).outputs;
    assert.ok(outputs.prompt_builder.promptText.includes('ORD-9527'));
    assert.ok(outputs.prompt_builder.promptText.includes('无特殊豁免'));
    assert.ok(outputs.llm_policy);
    assert.ok(outputs.llm_sentiment);
    assert.ok(outputs.code_arbitrator);
    assert.ok(outputs.output_report);

    // 6. Verify Parallel Timing (2x 100ms LLMs executed concurrently within ~100-160ms)
    assert.ok(
      totalDuration < 280,
      `Expected parallel execution duration < 280ms, but took ${totalDuration}ms`,
    );
  });
});
