/**
 * @file src/stores/workflow-store.ts
 * @description Global Zustand Store for Canvas, Execution State & Workflow Management
 */

import {
  WorkflowNode,
  WorkflowEdge,
  WorkflowGraph,
  NodeRuntimeState,
  ExecutionLog,
  EngineMode,
  NodeExecutionStatus,
} from '../engine/types';
import { BrowserWorkflowEngine } from '../engine/browser-engine';

export interface WorkflowStoreState {
  // Canvas Slice
  graphId: string;
  graphName: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;

  // Execution Slice
  engineMode: EngineMode;
  isExecuting: boolean;
  globalExecutionStatus: 'idle' | 'running' | 'success' | 'error';
  nodeStates: Record<string, NodeRuntimeState>;
  logs: ExecutionLog[];

  // Actions
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  addNode: (node: WorkflowNode) => void;
  updateNodeData: (id: string, data: Partial<WorkflowNode['data']>) => void;
  removeNode: (id: string) => void;
  setSelectedNodeId: (id: string | null) => void;
  setEngineMode: (mode: EngineMode) => void;
  loadPreset: (graph: WorkflowGraph) => void;

  // Execution Triggers
  runWorkflow: () => Promise<void>;
  stopWorkflow: () => void;
  resetExecution: () => void;
  appendLog: (log: Omit<ExecutionLog, 'id' | 'timestamp'>) => void;
}

const browserEngine = new BrowserWorkflowEngine();

/**
 * Zustand Store Hook Mock / Baseline Definition
 * In full production, this hooks into `create<WorkflowStoreState>()` from 'zustand'.
 */
export const createWorkflowStoreInitialState = (): WorkflowStoreState => {
  return {
    graphId: 'default-graph',
    graphName: 'New AI Workflow',
    nodes: [],
    edges: [],
    selectedNodeId: null,

    engineMode: 'browser',
    isExecuting: false,
    globalExecutionStatus: 'idle',
    nodeStates: {},
    logs: [],

    setNodes: () => {},
    setEdges: () => {},
    addNode: () => {},
    updateNodeData: () => {},
    removeNode: () => {},
    setSelectedNodeId: () => {},
    setEngineMode: () => {},
    loadPreset: () => {},

    runWorkflow: async () => {},
    stopWorkflow: () => {},
    resetExecution: () => {},
    appendLog: () => {},
  };
};
