/**
 * @file    tests/engine.test.ts
 * @description
 *   Unit tests for the core engine modules:
 *   - Topological Sort (Kahn's algorithm + cycle detection)
 *   - Variable Resolver ({{nodeId.key}} template interpolation)
 *
 *   Run with: npx vitest run
 */

import { describe, it, expect } from 'vitest';
import { topologicalSort, validateGraphTopology } from '../src/engine/topological-sort';
import {
  resolveTemplateVariables,
  extractVariableReferences,
  getNestedProperty,
} from '../src/engine/variable-resolver';
import type { WorkflowNode, WorkflowEdge } from '../src/engine/types';

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// 1. Topological Sort Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Topological Sort (Kahn\'s Algorithm)', () => {
  it('should sort a simple linear chain: A → B → C', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'C')];

    const result = topologicalSort({ nodes, edges });

    expect(result.hasCycle).toBe(false);
    expect(result.executionLayers).toEqual([['A'], ['B'], ['C']]);
    expect(result.sortedNodeIds).toEqual(['A', 'B', 'C']);
  });

  it('should handle parallel branches: A → B, A → C, B+C → D', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
    const edges = [
      makeEdge('A', 'B'),
      makeEdge('A', 'C'),
      makeEdge('B', 'D'),
      makeEdge('C', 'D'),
    ];

    const result = topologicalSort({ nodes, edges });

    expect(result.hasCycle).toBe(false);
    // Layer 0: A, Layer 1: B+C (parallel), Layer 2: D
    expect(result.executionLayers[0]).toEqual(['A']);
    expect(result.executionLayers[1]?.sort()).toEqual(['B', 'C']);
    expect(result.executionLayers[2]).toEqual(['D']);
  });

  it('should detect a simple cycle: A → B → A', () => {
    const nodes = [makeNode('A'), makeNode('B')];
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'A')];

    const result = topologicalSort({ nodes, edges });

    expect(result.hasCycle).toBe(true);
    expect(result.cycleNodeIds.sort()).toEqual(['A', 'B']);
  });

  it('should detect an indirect cycle: A → B → C → A', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'C'), makeEdge('C', 'A')];

    const result = topologicalSort({ nodes, edges });

    expect(result.hasCycle).toBe(true);
    expect(result.cycleNodeIds.length).toBe(3);
  });

  it('should handle a single isolated node', () => {
    const nodes = [makeNode('Solo')];
    const result = topologicalSort({ nodes, edges: [] });

    expect(result.hasCycle).toBe(false);
    expect(result.executionLayers).toEqual([['Solo']]);
  });

  it('should handle an empty graph', () => {
    const result = topologicalSort({ nodes: [], edges: [] });

    expect(result.hasCycle).toBe(false);
    expect(result.executionLayers).toEqual([]);
    expect(result.sortedNodeIds).toEqual([]);
  });
});

describe('Graph Validation', () => {
  it('should pass validation for a valid DAG', () => {
    const nodes = [makeNode('A'), makeNode('B')];
    const edges = [makeEdge('A', 'B')];

    const result = validateGraphTopology({ nodes, edges });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('should report orphan edges referencing non-existent nodes', () => {
    const nodes = [makeNode('A')];
    const edges = [makeEdge('A', 'GHOST')];

    const result = validateGraphTopology({ nodes, edges });

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('GHOST'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Variable Resolver Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Variable Resolver', () => {
  describe('getNestedProperty', () => {
    it('should access top-level keys', () => {
      expect(getNestedProperty({ name: 'Alice' }, 'name')).toBe('Alice');
    });

    it('should access nested keys', () => {
      const obj = { result: { items: [{ name: 'First' }] } };
      expect(getNestedProperty(obj, 'result.items[0].name')).toBe('First');
    });

    it('should return undefined for missing paths', () => {
      expect(getNestedProperty({ a: 1 }, 'b.c.d')).toBeUndefined();
    });

    it('should block prototype pollution attempts', () => {
      expect(getNestedProperty({}, '__proto__')).toBeUndefined();
      expect(getNestedProperty({}, 'constructor')).toBeUndefined();
      expect(getNestedProperty({}, 'prototype')).toBeUndefined();
    });
  });

  describe('extractVariableReferences', () => {
    it('should extract simple references', () => {
      const refs = extractVariableReferences('Hello {{node_1.output}}!');
      expect(refs).toHaveLength(1);
      expect(refs[0]?.nodeId).toBe('node_1');
      expect(refs[0]?.propertyPath).toBe('output');
    });

    it('should extract references with default values', () => {
      const refs = extractVariableReferences('{{llm.summary | "N/A"}}');
      expect(refs).toHaveLength(1);
      expect(refs[0]?.defaultValue).toBe('N/A');
    });

    it('should extract multiple references', () => {
      const template = '{{a.x}} and {{b.y}} and {{c.z}}';
      const refs = extractVariableReferences(template);
      expect(refs).toHaveLength(3);
    });
  });

  describe('resolveTemplateVariables', () => {
    const context = {
      input_1: { user_name: 'Alice', query: 'What is AI?' },
      llm_1: { response: 'AI is artificial intelligence.' },
    };

    it('should resolve a simple variable', () => {
      const result = resolveTemplateVariables('Hello, {{input_1.user_name}}!', context);
      expect(result).toBe('Hello, Alice!');
    });

    it('should resolve multiple variables', () => {
      const result = resolveTemplateVariables(
        'Q: {{input_1.query}} A: {{llm_1.response}}',
        context,
      );
      expect(result).toBe('Q: What is AI? A: AI is artificial intelligence.');
    });

    it('should use fallback when node output is missing', () => {
      const result = resolveTemplateVariables(
        '{{missing_node.value | "default"}}',
        context,
      );
      expect(result).toBe('default');
    });

    it('should keep unresolved placeholders when no fallback is set', () => {
      const result = resolveTemplateVariables('{{ghost.data}}', context);
      expect(result).toBe('{{ghost.data}}');
    });

    it('should handle empty template', () => {
      expect(resolveTemplateVariables('', context)).toBe('');
    });
  });
});
