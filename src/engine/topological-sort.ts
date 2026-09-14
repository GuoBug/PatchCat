/**
 * @file src/engine/topological-sort.ts
 * @description DAG Topological Sorting & Cycle Detection using Kahn's Algorithm
 */

import type { WorkflowNode, WorkflowEdge, GraphValidationResult } from './types';
import { extractVariableReferences } from './variable-resolver.ts';

/** Minimal graph shape accepted by the sorting / validation functions. */
interface GraphInput {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface TopologicalSortResult {
  hasCycle: boolean;
  sortedNodeIds: string[];
  executionLayers: string[][];
  cycleNodeIds: string[];
}

/**
 * Performs Kahn's algorithm on the workflow graph to produce execution layers and detect cycles.
 */
export function topologicalSort(graph: GraphInput): TopologicalSortResult {
  const nodeMap = new Map<string, (typeof graph.nodes)[0]>();
  const inDegree = new Map<string, number>();
  const adjacencyList = new Map<string, string[]>();

  // All nodes participate in the topological sort
  const activeNodes = graph.nodes;
  const activeNodeIds = new Set(activeNodes.map((n) => n.id));

  for (const node of activeNodes) {
    nodeMap.set(node.id, node);
    inDegree.set(node.id, 0);
    adjacencyList.set(node.id, []);
  }

  // Build adjacency list & calculate in-degrees
  for (const edge of graph.edges) {
    if (activeNodeIds.has(edge.source) && activeNodeIds.has(edge.target)) {
      adjacencyList.get(edge.source)!.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }
  }

  // Queue nodes with 0 in-degree for Layer 0
  let currentLayer: string[] = [];
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      currentLayer.push(nodeId);
    }
  }

  const sortedNodeIds: string[] = [];
  const executionLayers: string[][] = [];
  let visitedCount = 0;

  while (currentLayer.length > 0) {
    executionLayers.push([...currentLayer]);
    const nextLayer: string[] = [];

    for (const u of currentLayer) {
      sortedNodeIds.push(u);
      visitedCount++;

      const neighbors = adjacencyList.get(u) || [];
      for (const v of neighbors) {
        const updatedDegree = (inDegree.get(v) || 0) - 1;
        inDegree.set(v, updatedDegree);
        if (updatedDegree === 0) {
          nextLayer.push(v);
        }
      }
    }

    currentLayer = nextLayer;
  }

  const hasCycle = visitedCount !== activeNodes.length;
  const cycleNodeIds: string[] = [];

  if (hasCycle) {
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree > 0) {
        cycleNodeIds.push(nodeId);
      }
    }
  }

  return {
    hasCycle,
    sortedNodeIds,
    executionLayers,
    cycleNodeIds,
  };
}

/**
 * Validates the topological integrity of a given graph.
 */
export function validateGraphTopology(graph: GraphInput): GraphValidationResult {
  const errors: string[] = [];
  const { hasCycle, cycleNodeIds, executionLayers } = topologicalSort(graph);

  if (hasCycle) {
    errors.push(
      `Workflow contains circular dependency cycles involving nodes: [${cycleNodeIds.join(', ')}]`,
    );
  }

  // Check for orphan edges
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge ${edge.id} references non-existent source node "${edge.source}"`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge ${edge.id} references non-existent target node "${edge.target}"`);
    }
  }

  // Check for unconnected condition node branches (pre-flight validation warning)
  const warnings: string[] = [];
  for (const node of graph.nodes) {
    if (node.data?.type === 'condition' || node.type === 'condition') {
      const config = (node.data?.config || {}) as {
        conditions?: Array<{ targetHandle?: string }>;
        defaultBranch?: string;
      };
      const expectedBranches = new Set<string>();
      for (const rule of config.conditions || []) {
        if (rule.targetHandle) expectedBranches.add(rule.targetHandle);
      }
      if (config.defaultBranch) expectedBranches.add(config.defaultBranch);
      if (expectedBranches.size === 0) {
        expectedBranches.add('if_true');
        expectedBranches.add('else');
      }

      const connectedHandles = new Set(
        graph.edges
          .filter((e) => e.source === node.id && e.sourceHandle)
          .map((e) => e.sourceHandle as string),
      );

      for (const branch of expectedBranches) {
        if (!connectedHandles.has(branch)) {
          warnings.push(
            `Condition node "${node.data?.label || node.id}" has an unconnected branch: "${branch}"`,
          );
        }
      }
    }
  }

  // 3. Build upstream ancestor reachability map to detect Ghost Edges
  const ancestorsMap = new Map<string, Set<string>>();
  for (const node of graph.nodes) {
    ancestorsMap.set(node.id, new Set<string>());
  }
  const incomingMap = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!incomingMap.has(edge.target)) incomingMap.set(edge.target, []);
    incomingMap.get(edge.target)!.push(edge.source);
  }
  for (const node of graph.nodes) {
    const visited = ancestorsMap.get(node.id)!;
    const queue = [...(incomingMap.get(node.id) || [])];
    while (queue.length > 0) {
      const parent = queue.shift()!;
      if (!visited.has(parent)) {
        visited.add(parent);
        const grandParents = incomingMap.get(parent) || [];
        for (const gp of grandParents) {
          if (!visited.has(gp)) queue.push(gp);
        }
      }
    }
  }

  const collectStrings = (target: unknown, out: string[]) => {
    if (typeof target === 'string') {
      out.push(target);
    } else if (Array.isArray(target)) {
      for (const item of target) collectStrings(item, out);
    } else if (target !== null && typeof target === 'object') {
      for (const val of Object.values(target as Record<string, unknown>)) {
        collectStrings(val, out);
      }
    }
  };

  for (const node of graph.nodes) {
    const stringPool: string[] = [];
    if (node.data?.inputs) collectStrings(node.data.inputs, stringPool);
    if (node.data?.config) collectStrings(node.data.config, stringPool);

    const referencedNodeIds = new Set<string>();
    for (const str of stringPool) {
      const refs = extractVariableReferences(str);
      for (const ref of refs) {
        if (ref.nodeId && ref.nodeId !== 'global_input') {
          referencedNodeIds.add(ref.nodeId);
        }
      }
    }

    const nodeLabel = node.data?.label || node.id;
    for (const refId of referencedNodeIds) {
      if (!nodeIds.has(refId)) {
        warnings.push(
          `Node "${nodeLabel}" (${node.id}) references a non-existent node "${refId}" in its template slots.`,
        );
      } else if (refId !== node.id && !ancestorsMap.get(node.id)?.has(refId)) {
        warnings.push(
          `Ghost variable dependency detected: Node "${nodeLabel}" references "{{${refId}...}}", but there is no directed connection from "${refId}" to this node in the canvas.`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined,
    cycleNodes: hasCycle ? cycleNodeIds : undefined,
    executionLayers: hasCycle ? undefined : executionLayers,
  };
}
