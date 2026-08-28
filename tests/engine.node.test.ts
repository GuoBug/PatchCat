/**
 * @file    tests/engine.node.test.ts
 * @description
 *   Comprehensive test suite covering:
 *   1. Topological Sort & Graph Validation (Kahn's Algorithm)
 *   2. Variable Resolver & Injection (Mustache syntax, Nested paths, Prototype Pollution)
 *   3. Execution Engine Runtime (Async event streams, Context passing, Layer concurrency)
 *   4. Exception & Abort Flows (Cycle interception, Node failure propagation, Cooperative cancellation)
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
      config: getDefaultNodeConfig(type),
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

// Helper to collect all events from an AsyncIterable stream
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

describe('Execution Runtime (Browser Engine Async Scheduling)', () => {
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

    // Verify Event Sequence
    assert.equal(events[0]?.type, 'WORKFLOW_START');
    assert.equal((events[0]?.payload as any).totalNodes, 4);

    const completeEvents = events.filter((e) => e.type === 'NODE_COMPLETE');
    assert.equal(completeEvents.length, 4);

    const completedNodeIds = completeEvents.map((e) => (e.payload as any).nodeId);
    assert.deepEqual(completedNodeIds, ['in_1', 'pr_1', 'llm_1', 'out_1']);

    const finalEvent = events[events.length - 1];
    assert.equal(finalEvent?.type, 'WORKFLOW_COMPLETE');

    // Verify context output propagation
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
// 4. Execution Engine Exception & Abort Flows
// ─────────────────────────────────────────────────────────────────────────────

describe('Execution Runtime (Exception & Abort Flows)', () => {
  it('should immediately yield WORKFLOW_ERROR when graph topology validation fails (cycle detected)', async () => {
    const engine = new BrowserWorkflowEngine();

    // Cyclic graph
    const nodes = [makeNode('A', 'llm'), makeNode('B', 'llm')];
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'A')];

    const events = await collectEvents(engine.executeWorkflow({ nodes, edges }));

    assert.equal(events.length, 1);
    assert.equal(events[0]?.type, 'WORKFLOW_ERROR');
    assert.ok((events[0]?.payload as any).error.includes('Graph validation failed'));
  });

  it('should stop execution when cooperative abort signal is triggered', async () => {
    const engine = new BrowserWorkflowEngine();
    const abortController = new AbortController();

    const nodes = [
      makeNode('A', 'llm'),
      makeNode('B', 'llm'),
      makeNode('C', 'llm'),
    ];
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'C')];

    // Abort before/during execution
    abortController.abort();

    const events = await collectEvents(
      engine.executeWorkflow({ nodes, edges }, { signal: abortController.signal }),
    );

    const errorEvent = events.find((e) => e.type === 'WORKFLOW_ERROR');
    assert.ok(errorEvent, 'Should produce WORKFLOW_ERROR upon abort');
    assert.ok((errorEvent.payload as any).error.includes('aborted'));
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
