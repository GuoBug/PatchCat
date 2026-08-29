/**
 * @file    src/stores/workflow-store.ts
 * @version 2.0.0
 * @description
 *   Global Zustand store that manages the **entire** client-side state for the
 *   AI Prompt Flow Orchestrator.
 *
 *   Architecture:
 *   ┌─────────────────────────────────────────────────────┐
 *   │  useWorkflowStore (Zustand)                         │
 *   │  ┌───────────────┬───────────────┬────────────────┐ │
 *   │  │ Canvas State  │ Execution St. │  Settings      │ │
 *   │  │ nodes, edges  │ isExecuting   │  engineMode    │ │
 *   │  │ selectedNode  │ globalInputs  │                │ │
 *   │  └───────────────┴───────────────┴────────────────┘ │
 *   └─────────────────────────────────────────────────────┘
 *
 *   The store uses `immer` middleware for immutable updates without
 *   boilerplate spread operators.
 *
 *   Zero use of `any` — every unstructured bag uses `Record<string, unknown>`.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type {
  NodeChange,
  EdgeChange,
  Connection,
} from '@xyflow/react';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';

import type {
  NodeType,
  NodeStatus,
  EngineMode,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeData,
  WorkflowGraph,
  NodeExecutionResult,
} from '../engine/types.ts';
import {
  getDefaultNodeConfig,
  getDefaultNodeLabel,
} from '../engine/types.ts';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Store Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowStoreState {
  // ── Canvas State ─────────────────────────────────────────────────────────
  /** All nodes currently on the canvas. */
  nodes: WorkflowNode[];
  /** All directed edges between nodes. */
  edges: WorkflowEdge[];
  /** ID of the node whose property panel is currently open, or `null`. */
  selectedNodeId: string | null;

  // ── Execution State ──────────────────────────────────────────────────────
  /** Current execution engine mode (mock / browser-BYOK / local server). */
  engineMode: EngineMode;
  /** `true` while a workflow run is in progress. */
  isExecuting: boolean;
  /** Top-level inputs fed into `input`-type nodes when execution starts. */
  globalInputs: Record<string, unknown>;

  // ── React Flow Callbacks ─────────────────────────────────────────────────
  /** Applies React Flow internal node changes (drag, select, remove …). */
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;
  /** Applies React Flow internal edge changes (select, remove …). */
  onEdgesChange: (changes: EdgeChange<WorkflowEdge>[]) => void;
  /** Handles a new connection drawn between two handles on the canvas. */
  onConnect: (connection: Connection) => void;

  // ── Node & Edge Setters ──────────────────────────────────────────────────
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  deleteNode: (nodeId: string) => void;

  // ── Node CRUD ────────────────────────────────────────────────────────────
  /**
   * Creates a new node of the given `type` at the specified canvas
   * position (defaults to a staggered offset from the origin).
   *
   * @returns The ID of the newly created node.
   */
  addNode: (type: NodeType, position?: { x: number; y: number }) => string;

  /** Shallow-merges `data` into the target node's `WorkflowNodeData`. */
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;

  /** Deep-merges `config` into the target node's `data.config`. */
  updateNodeConfig: (nodeId: string, config: Record<string, unknown>) => void;

  // ── Execution Control ────────────────────────────────────────────────────
  /**
   * Updates a node's execution status and optionally attaches a
   * {@link NodeExecutionResult} with telemetry data.
   */
  setNodeStatus: (
    nodeId: string,
    status: NodeStatus,
    result?: NodeExecutionResult,
  ) => void;

  /** Sets or clears the currently selected (focused) node. */
  setSelectedNodeId: (nodeId: string | null) => void;

  /** Switches the execution engine mode for subsequent runs. */
  setEngineMode: (mode: EngineMode) => void;

  /**
   * Replaces the entire canvas with a previously saved or preset
   * workflow graph.
   */
  loadPreset: (graph: WorkflowGraph) => void;

  /**
   * Resets **every** node's `status` to `idle` and clears its
   * `executionResult`, `outputs`, without touching the graph topology.
   */
  resetExecutionState: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Default Node Counter (for auto-incrementing labels)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple per-session counter so each newly created node gets a unique
 * sequential suffix (e.g. "LLM Call #3").
 */
const nodeCounters: Record<NodeType, number> = {
  input: 0,
  prompt: 0,
  llm: 0,
  code: 0,
  output: 0,
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Store Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Global Zustand hook.
 *
 * Usage in any React component:
 * ```tsx
 * const nodes = useWorkflowStore(s => s.nodes);
 * const addNode = useWorkflowStore(s => s.addNode);
 * ```
 */
export const useWorkflowStore = create<WorkflowStoreState>()(
  immer((set, get) => ({
    // ── Initial State ──────────────────────────────────────────────────────
    nodes: [],
    edges: [],
    selectedNodeId: null,

    engineMode: 'mock' as EngineMode,
    isExecuting: false,
    globalInputs: {},

    // ── React Flow Callbacks ─────────────────────────────────────────────
    onNodesChange: (changes) => {
      set((state) => {
        state.nodes = applyNodeChanges(changes, state.nodes) as WorkflowNode[];
      });
    },

    onEdgesChange: (changes) => {
      set((state) => {
        state.edges = applyEdgeChanges(changes, state.edges) as WorkflowEdge[];
      });
    },

    onConnect: (connection) => {
      set((state) => {
        state.edges = addEdge(
          {
            ...connection,
            id: `edge-${nanoid(8)}`,
            animated: false,
          },
          state.edges,
        ) as WorkflowEdge[];
      });
    },

    setNodes: (nodes) => {
      set((state) => {
        state.nodes = nodes;
      });
    },

    setEdges: (edges) => {
      set((state) => {
        state.edges = edges;
      });
    },

    deleteNode: (nodeId) => {
      set((state) => {
        state.nodes = state.nodes.filter((n) => n.id !== nodeId);
        state.edges = state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
        if (state.selectedNodeId === nodeId) {
          state.selectedNodeId = null;
        }
      });
    },

    // ── Node CRUD ────────────────────────────────────────────────────────
    addNode: (type, position) => {
      nodeCounters[type] += 1;
      const id = `${type}_${nanoid(8)}`;
      const label = `${getDefaultNodeLabel(type)} #${nodeCounters[type]}`;

      /** Stagger new nodes so they don't pile on top of each other. */
      const existingCount = get().nodes.length;
      const defaultPosition = position ?? {
        x: 100 + existingCount * 40,
        y: 150 + existingCount * 40,
      };

      const newNode: WorkflowNode = {
        id,
        type,
        position: defaultPosition,
        data: {
          label,
          type,
          status: 'idle',
          inputs: {},
          outputs: {},
          config: getDefaultNodeConfig(type),
        },
      };

      set((state) => {
        state.nodes.push(newNode);
      });

      return id;
    },

    updateNodeData: (nodeId, data) => {
      set((state) => {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (node) {
          Object.assign(node.data, data);
        }
      });
    },

    updateNodeConfig: (nodeId, config) => {
      set((state) => {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (node) {
          node.data.config = { ...node.data.config, ...config };
        }
      });
    },

    // ── Execution Control ──────────────────────────────────────────────────
    setNodeStatus: (nodeId, status, result) => {
      set((state) => {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (node) {
          node.data.status = status;
          if (result !== undefined) {
            node.data.executionResult = result;
          }
        }
      });
    },

    setSelectedNodeId: (nodeId) => {
      set((state) => {
        state.selectedNodeId = nodeId;
      });
    },

    setEngineMode: (mode) => {
      set((state) => {
        state.engineMode = mode;
      });
    },

    loadPreset: (graph) => {
      set((state) => {
        state.nodes = (graph.nodes || []).map((node) => ({
          ...node,
          data: {
            ...node.data,
            type: node.type,
            status: node.data?.status || 'idle',
            inputs: node.data?.inputs || {},
            outputs: node.data?.outputs || {},
            config: node.data?.config || getDefaultNodeConfig(node.type),
          },
        }));
        state.edges = graph.edges || [];
        state.selectedNodeId = null;
        state.isExecuting = false;
        state.globalInputs = {};
      });
    },

    resetExecutionState: () => {
      set((state) => {
        state.isExecuting = false;
        state.edges = state.edges.map((e) => ({
          ...e,
          animated: false,
          style: { stroke: '#475569', strokeWidth: 2 },
        }));
        for (const node of state.nodes) {
          node.data.status = 'idle';
          node.data.executionResult = undefined;
          node.data.outputs = {};
        }
      });
    },
  })),
);
