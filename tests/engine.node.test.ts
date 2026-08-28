/**
 * @file    tests/engine.node.test.ts
 * @description
 *   Native Node.js test runner suite for core engine modules.
 *   Runs out of the box with zero extra dependencies:
 *     node --test tests/engine.node.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { topologicalSort, validateGraphTopology } from '../src/engine/topological-sort.ts';
import {
  resolveTemplateVariables,
  extractVariableReferences,
  getNestedProperty,
} from '../src/engine/variable-resolver.ts';
import type { WorkflowNode, WorkflowEdge } from '../src/engine/types.ts';

function makeNode(id: string, type: 'input' | 'prompt' | 'llm' | 'code' | 'output' = 'llm'): WorkflowNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: {
      label: id,
      type,
      status: 'idle',
      inputs: {},
      outputs: {},
      config: {},
    },
  };
}

function makeEdge(source: string, target: string): WorkflowEdge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    sourceHandle: 'output',
    targetHandle: 'input',
  };
}

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

describe('Variable Resolver', () => {
  it('should access nested object properties', () => {
    const obj = { result: { items: [{ name: 'First' }] } };
    assert.equal(getNestedProperty(obj, 'result.items[0].name'), 'First');
  });

  it('should protect against prototype pollution', () => {
    assert.equal(getNestedProperty({}, '__proto__'), undefined);
    assert.equal(getNestedProperty({}, 'constructor'), undefined);
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
});
