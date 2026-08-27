/**
 * @file src/engine/types.ts
 * @description Core Domain Types for AI Prompt Flow Orchestrator Engine
 */

export type NodeType = 'input' | 'prompt' | 'llm' | 'code' | 'router' | 'output';

export type NodeExecutionStatus = 'idle' | 'pending' | 'running' | 'success' | 'error' | 'skipped';

export type EngineMode = 'browser' | 'server';

export interface WorkflowNodeData {
  label: string;
  description?: string;
  disabled?: boolean;
  config?: Record<string, unknown>;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  label?: string;
  animated?: boolean;
  data?: {
    condition?: string;
  };
}

export interface WorkflowGraph {
  id?: string;
  name?: string;
  version?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface NodeRuntimeState {
  status: NodeExecutionStatus;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string;
  streamingOutput?: string;
}

export interface ExecutionLog {
  id: string;
  timestamp: number;
  nodeId?: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: unknown;
}

export type ExecutionEventType =
  | 'WORKFLOW_START'
  | 'NODE_START'
  | 'NODE_CHUNK'
  | 'NODE_COMPLETE'
  | 'NODE_ERROR'
  | 'NODE_SKIPPED'
  | 'WORKFLOW_COMPLETE'
  | 'WORKFLOW_ERROR';

export interface ExecutionEventPayload {
  WORKFLOW_START: { graphId?: string; timestamp: number; totalNodes: number };
  NODE_START: { nodeId: string; nodeType: NodeType; timestamp: number; inputs: Record<string, unknown> };
  NODE_CHUNK: { nodeId: string; delta: string; fullContent: string };
  NODE_COMPLETE: { nodeId: string; output: Record<string, unknown>; durationMs: number };
  NODE_ERROR: { nodeId: string; error: string; durationMs: number };
  NODE_SKIPPED: { nodeId: string; reason: string };
  WORKFLOW_COMPLETE: { outputs: Record<string, unknown>; totalDurationMs: number; timestamp: number };
  WORKFLOW_ERROR: { error: string; failedNodeId?: string; timestamp: number };
}

export interface ExecutionEvent<T extends ExecutionEventType = ExecutionEventType> {
  type: T;
  payload: ExecutionEventPayload[T];
}

export interface NodeExecutionResult {
  nodeId: string;
  status: NodeExecutionStatus;
  output?: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

export interface WorkflowRunOptions {
  inputs?: Record<string, unknown>;
  maxConcurrency?: number;
  timeoutMs?: number;
  mockMode?: boolean;
  apiKeys?: Record<string, string>;
  signal?: AbortSignal;
}

export interface GraphValidationResult {
  valid: boolean;
  errors: string[];
  cycleNodes?: string[];
  executionLayers?: string[][];
}
