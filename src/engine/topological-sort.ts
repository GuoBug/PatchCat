/**
 * @file src/engine/topological-sort.ts
 * @description DAG Topological Sorting & Cycle Detection using Kahn's Algorithm
 */

import { WorkflowGraph, GraphValidationResult } from './types';

export interface TopologicalSortResult {
  hasCycle: boolean;
  sortedNodeIds: string[];
  executionLayers: string[][];
  cycleNodeIds: string[];
}

/**
 * Performs Kahn's algorithm on the workflow graph to produce execution layers and detect cycles.
 */
export function topologicalSort(graph: WorkflowGraph): TopologicalSortResult {
  const nodeMap = new Map<string, typeof graph.nodes[0]>();
  const inDegree = new Map<string, number>();
  const adjacencyList = new Map<string, string[]>();

  // Filter active nodes (not disabled)
  const activeNodes = graph.nodes.filter(n => !n.data.disabled);
  const activeNodeIds = new Set(activeNodes.map(n => n.id));

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
export function validateGraphTopology(graph: WorkflowGraph): GraphValidationResult {
  const errors: string[] = [];
  const { hasCycle, cycleNodeIds, executionLayers } = topologicalSort(graph);

  if (hasCycle) {
    errors.push(`Workflow contains circular dependency cycles involving nodes: [${cycleNodeIds.join(', ')}]`);
  }

  // Check for orphan edges
  const nodeIds = new Set(graph.nodes.map(n => n.id));
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge ${edge.id} references non-existent source node "${edge.source}"`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge ${edge.id} references non-existent target node "${edge.target}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    cycleNodes: hasCycle ? cycleNodeIds : undefined,
    executionLayers: hasCycle ? undefined : executionLayers,
  };
}
