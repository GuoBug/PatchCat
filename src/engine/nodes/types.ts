import type { WorkflowNode, WorkflowEdge, NodeType, WorkflowRunOptions } from '../types.ts';

/**
 * Resolved runtime settings for node executors.
 */
export interface ResolvedSettings {
  baseUrl: string;
  apiKey: string;
  model?: string;
  provider?: string;
  availableModels?: string[];
  hasKey: boolean;
  serverBaseUrl: string;
  runtimeProtection: unknown;
}

/**
 * Execution context provided to each node executor.
 * Replaces monolithic parameter passing with a strongly-typed context bag.
 */
export interface NodeExecContext {
  node: WorkflowNode;
  resolvedInputs: Record<string, unknown>;
  context: Record<string, Record<string, unknown>>;
  signal: AbortSignal;
  onChunk?: (chunk: {
    delta: string;
    fullContent: string;
    reasoningDelta?: string;
    fullReasoning?: string;
  }) => void;
  options?: WorkflowRunOptions;
  nodeMap?: Map<string, WorkflowNode>;
  incomingEdges: WorkflowEdge[];
  skippedNodes: Set<string>;
  settings?: ResolvedSettings;
  knowledge?: unknown;
}

/**
 * Standard contract for modular node executors.
 */
export interface INodeExecutor {
  readonly type: NodeType;
  execute(ctx: NodeExecContext): Promise<Record<string, unknown>> | Record<string, unknown>;
}
