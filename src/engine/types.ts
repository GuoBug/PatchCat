/**
 * @file    src/engine/types.ts
 * @version 2.0.0
 * @description
 *   Core domain types for the AI Prompt Flow Orchestrator.
 *
 *   This module is the **single source of truth** for every type that flows
 *   through the canvas UI, the DAG execution engine, and the persistence
 *   layer. It extends `@xyflow/react` primitives (`Node`, `Edge`) to keep
 *   the visual graph and the semantic workflow graph in perfect sync.
 *
 *   Design constraints:
 *   - Zero use of `any` — every bag-of-data uses `Record<string, unknown>`.
 *   - All optional fields are explicitly marked; no implicit `undefined`.
 *   - Types are ordered bottom-up so dependent types always appear after
 *     the types they reference.
 */

import type { Node, Edge } from '@xyflow/react';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Enumerations & Literal Unions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Discriminator for built-in node kinds.
 *
 * | Kind     | Responsibility                                           |
 * | -------- | -------------------------------------------------------- |
 * | `input`  | Captures workflow-level user parameters                   |
 * | `prompt` | Assembles a prompt template with dynamic variable slots   |
 * | `llm`    | Calls a large language model (cloud or local)             |
 * | `code`   | Runs a lightweight JS / Python transformation             |
 * | `output` | Aggregates and renders the final workflow response        |
 */
export type NodeType = 'input' | 'prompt' | 'llm' | 'code' | 'output';

/**
 * Execution lifecycle status for an individual node.
 *
 * State transitions:
 * ```
 *   idle ──▶ queued ──▶ running ──▶ success
 *                   │            └──▶ error
 *                   └──▶ (skipped via conditional route)
 * ```
 */
export type NodeStatus = 'idle' | 'queued' | 'running' | 'success' | 'error';

/**
 * Runtime engine mode that determines *how* each node is executed.
 *
 * - `mock`           — Built-in fixture data; zero network calls.
 * - `byok_browser`   — Direct browser `fetch()` with user-supplied API keys.
 * - `local_server`   — Proxied through the local FastAPI backend (SSE).
 */
export type EngineMode = 'mock' | 'byok_browser' | 'local_server';

// ─────────────────────────────────────────────────────────────────────────────
// 2. Execution Telemetry
// ─────────────────────────────────────────────────────────────────────────────

/** Token-level usage counters returned by LLM providers. */
export interface TokenUsage {
  /** Number of tokens consumed by the prompt / input. */
  prompt: number;
  /** Number of tokens produced by the completion / output. */
  completion: number;
  /** Convenience total (`prompt + completion`). */
  total: number;
}

/**
 * Post-execution telemetry attached to a node after it finishes (or fails).
 *
 * This structure is intentionally **read-only** at the type level — it is
 * only ever written by the execution engine, never mutated by UI code.
 */
export interface NodeExecutionResult {
  /** Wall-clock execution time in milliseconds. */
  latencyMs?: number;
  /** LLM token consumption breakdown (only populated for `llm` nodes). */
  tokenUsage?: TokenUsage;
  /** Human-readable error message when the node terminates abnormally. */
  error?: string;
  /** Unix-epoch timestamp (ms) when execution completed or failed. */
  timestamp?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Node Data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Business-level payload stored inside every workflow node's `data` slot.
 *
 * This is the *semantic* layer that sits on top of the React Flow `Node`
 * positional / rendering data. It carries:
 *
 * - **`inputs`**  — upstream-injected or manually configured variable map.
 * - **`outputs`** — the result map produced after execution.
 * - **`config`**  — node-kind-specific settings (model, temperature, template…).
 */
export interface WorkflowNodeData {
  /** Human-readable display label rendered on the canvas card. */
  label: string;

  /** Discriminator that drives per-kind rendering and execution logic. */
  type: NodeType;

  /** Current lifecycle status (painted as border color on the canvas). */
  status: NodeStatus;

  /**
   * Variable map injected from upstream edges or set manually.
   * Keys are slot names; values are resolved at execution time.
   *
   * @example
   * ```ts
   * { prompt: '{{input_1.user_query}}', context: '{{retriever.chunks}}' }
   * ```
   */
  inputs: Record<string, unknown>;

  /**
   * Result map produced after successful execution.
   * Downstream nodes reference these via `{{thisNodeId.outputKey}}`.
   */
  outputs: Record<string, unknown>;

  /**
   * Kind-specific configuration bag.
   *
   * Examples per `NodeType`:
   * - `input`  → `{ schema: {...}, defaultValues: {...} }`
   * - `prompt` → `{ template: '...' }`
   * - `llm`    → `{ model: 'gpt-4o', temperature: 0.7, topP: 1 }`
   * - `code`   → `{ runtime: 'javascript', script: '...' }`
   * - `output` → `{ format: 'markdown' }`
   */
  config: Record<string, unknown>;

  /** Post-execution telemetry; `undefined` until the node has been run. */
  executionResult?: NodeExecutionResult;

  /** Optional free-text description shown in the property panel. */
  description?: string;

  /**
   * Index signature required by `@xyflow/react`'s `Node<T>` generic
   * constraint (`T extends Record<string, unknown>`).
   */
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Graph Primitives (extending @xyflow/react)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A workflow node is a standard React Flow `Node` whose `data` slot carries
 * our domain-specific {@link WorkflowNodeData}.
 *
 * The generic parameter binds React Flow's internal type narrowing so that
 * `node.data.label`, `node.data.status`, etc. are fully typed without casts.
 */
export type WorkflowNode = Node<WorkflowNodeData, NodeType>;

/**
 * A workflow edge extends React Flow's `Edge` with mandatory handle IDs.
 *
 * `sourceHandle` and `targetHandle` are *required* (not optional as in the
 * base type) because every edge in our DAG must unambiguously reference a
 * specific output port on the source and an input port on the target.
 */
export type WorkflowEdge = Edge & {
  /** ID of the output port on the source node, or undefined/null for default port. */
  sourceHandle?: string | null;
  /** ID of the input port on the target node, or undefined/null for default port. */
  targetHandle?: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. Workflow Metadata & Top-Level Graph
// ─────────────────────────────────────────────────────────────────────────────

/** Descriptive metadata envelope for a saved workflow. */
export interface WorkflowMetadata {
  /** Human-readable workflow name. */
  name: string;
  /** Optional multi-line description or changelog note. */
  description?: string;
  /** Author display name (for preset attribution). */
  author?: string;
  /** Free-form tags for filtering / search. */
  tags?: string[];
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-modified timestamp. */
  updatedAt: string;
}

/**
 * The complete, self-contained representation of a workflow.
 *
 * This is the JSON shape that is:
 * - **persisted** to LocalStorage or the backend.
 * - **exported / imported** as preset templates.
 * - **validated** against `graph-schema-specification.json`.
 */
export interface WorkflowGraph {
  /** Unique workflow identifier (UUID v4). */
  workflowId: string;
  /** Semantic version of the graph schema (for migrations). */
  version?: string;
  /** Descriptive metadata. */
  metadata: WorkflowMetadata;
  /** Ordered list of all nodes in the graph. */
  nodes: WorkflowNode[];
  /** Ordered list of all directed edges in the graph. */
  edges: WorkflowEdge[];
  /** Last-saved canvas viewport (for restoring the user's view). */
  viewport?: { x: number; y: number; zoom: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Execution Event Stream
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Discriminated union tag for events emitted during workflow execution.
 * Both the browser engine (AsyncGenerator) and the server engine (SSE)
 * emit the same set of event types.
 */
export type ExecutionEventType =
  | 'WORKFLOW_START'
  | 'NODE_START'
  | 'NODE_CHUNK'
  | 'NODE_COMPLETE'
  | 'NODE_ERROR'
  | 'NODE_SKIPPED'
  | 'WORKFLOW_COMPLETE'
  | 'WORKFLOW_ERROR';

/** Type-safe payload map keyed by {@link ExecutionEventType}. */
export interface ExecutionEventPayloadMap {
  WORKFLOW_START:    { graphId: string; timestamp: number; totalNodes: number };
  NODE_START:        { nodeId: string; nodeType: NodeType; timestamp: number; inputs: Record<string, unknown> };
  NODE_CHUNK:        { nodeId: string; delta: string; fullContent: string };
  NODE_COMPLETE:     { nodeId: string; output: Record<string, unknown>; durationMs: number };
  NODE_ERROR:        { nodeId: string; error: string; durationMs: number };
  NODE_SKIPPED:      { nodeId: string; reason: string };
  WORKFLOW_COMPLETE: { outputs: Record<string, unknown>; totalDurationMs: number; timestamp: number };
  WORKFLOW_ERROR:    { error: string; failedNodeId?: string; timestamp: number };
}

/**
 * A single typed event emitted by the execution engine.
 *
 * @typeParam T — The specific event type for narrowing `payload`.
 *
 * @example
 * ```ts
 * function handleEvent(event: ExecutionEvent) {
 *   if (event.type === 'NODE_CHUNK') {
 *     console.log(event.payload.delta); // ← fully typed
 *   }
 * }
 * ```
 */
export type ExecutionEvent = {
  [K in ExecutionEventType]: {
    type: K;
    payload: ExecutionEventPayloadMap[K];
  };
}[ExecutionEventType];

// ─────────────────────────────────────────────────────────────────────────────
// 7. Graph Validation
// ─────────────────────────────────────────────────────────────────────────────

/** Result returned by the topology validator before execution begins. */
export interface GraphValidationResult {
  /** `true` when the graph passes all pre-flight checks. */
  valid: boolean;
  /** Human-readable error descriptions (empty when `valid` is `true`). */
  errors: string[];
  /** Node IDs involved in a cycle (only populated when a cycle exists). */
  cycleNodes?: string[];
  /** Layer-by-layer execution plan (only populated when `valid` is `true`). */
  executionLayers?: string[][];
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Execution Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Options bag passed to `IWorkflowEngineAdapter.executeWorkflow()`. */
export interface WorkflowRunOptions {
  /** Global inputs fed into every `input`-type node. */
  inputs?: Record<string, unknown>;
  /** Max number of nodes executed concurrently within a single layer. */
  maxConcurrency?: number;
  /** Per-node hard timeout in milliseconds. */
  timeoutMs?: number;
  /** Provider → API key mapping for BYOK browser mode. */
  apiKeys?: Record<string, string>;
  /** Abort signal for cooperative cancellation. */
  signal?: AbortSignal;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Node Default Config Factories
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the canonical default `config` bag for a given node type.
 * Used by `addNode()` in the store to populate newly created nodes.
 */
export function getDefaultNodeConfig(type: NodeType): Record<string, unknown> {
  switch (type) {
    case 'input':
      return { schema: {}, defaultValues: {} };
    case 'prompt':
      return { template: '' };
    case 'llm':
      return { model: 'gpt-4o-mini', temperature: 0.7, topP: 1, maxTokens: 2048 };
    case 'code':
      return { runtime: 'javascript', script: '' };
    case 'output':
      return { format: 'markdown' };
  }
}

/**
 * Returns a human-readable default label for a newly created node.
 */
export function getDefaultNodeLabel(type: NodeType): string {
  const labels: Record<NodeType, string> = {
    input:  'Input',
    prompt: 'Prompt Template',
    llm:    'LLM Call',
    code:   'Code Transform',
    output: 'Output',
  };
  return labels[type];
}
