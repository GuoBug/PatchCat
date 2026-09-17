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
import type { NodeChange, EdgeChange, Connection } from '@xyflow/react';
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react';

import type {
  NodeType,
  NodeStatus,
  EngineMode,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeData,
  WorkflowGraph,
  NodeExecutionResult,
  TokenUsage,
} from '../engine/types.ts';
import { getDefaultNodeConfig, getDefaultNodeLabel } from '../engine/types.ts';
import { HistoryManager } from '../engine/history-manager.ts';
import { BrowserWorkflowEngine } from '../engine/browser-engine.ts';
import { useSettingsStore } from './settings-store.ts';

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
  /** Whether the right property panel drawer is open / expanded. */
  isPropertyPanelOpen: boolean;
  togglePropertyPanel: () => void;
  setPropertyPanelOpen: (open: boolean) => void;
  /** UI Theme mode ('light' for Modern Slate/Indigo or 'dark' for Cyberpunk/Dark Slate). */
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;

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
  deleteEdge: (edgeId: string) => void;

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
  setNodeStatus: (nodeId: string, status: NodeStatus, result?: NodeExecutionResult) => void;

  /** Updates live streaming content / reasoning for a node during execution */
  updateNodeStreamingOutput: (nodeId: string, content: string, reasoning?: string) => void;

  /** Sets or clears the currently selected (focused) node. */
  setSelectedNodeId: (nodeId: string | null) => void;

  /** Switches the execution engine mode for subsequent runs. */
  setEngineMode: (mode: EngineMode) => void;

  /**
   * Replaces the entire canvas with a previously saved or preset
   * workflow graph.
   */
  loadPreset: (graph: WorkflowGraph | { nodes: WorkflowNode[]; edges: WorkflowEdge[] }) => void;

  /**
   * Resets **every** node's `status` to `idle` and clears its
   * `executionResult`, `outputs`, without touching the graph topology.
   */
  resetExecutionState: () => void;

  // ── Ergonomics & Pinpoint Focus ──────────────────────────────────────────
  highlightedNodeId: string | null;
  highlightNode: (nodeId: string) => void;
  centerTargetNodeId: string | null;
  clearCenterTarget: () => void;

  // ── Multi-Node Clipboard ─────────────────────────────────────────────────
  clipboard: { nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null;
  copySelectedNodes: () => boolean;
  pasteNodes: () => boolean;

  // ── Undo / Redo History ──────────────────────────────────────────────────
  captureSnapshot: () => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // ── In-Place Local Retry ─────────────────────────────────────────────────
  retryNode: (nodeId: string, options?: { resumeDownstream?: boolean }) => Promise<void>;
  retryAllFailedNodes: () => Promise<void>;
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
  knowledge: 0,
  condition: 0,
  aggregator: 0,
  http: 0,
  agent: 0,
  loop: 0,
  sub_workflow: 0,
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
const historyManager = new HistoryManager(25);

export const useWorkflowStore = create<WorkflowStoreState>()(
  immer((set, get) => ({
    // ── Initial State ──────────────────────────────────────────────────────
    nodes: [],
    edges: [],
    selectedNodeId: null,
    isPropertyPanelOpen: typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,

    togglePropertyPanel: () => {
      set((state) => {
        state.isPropertyPanelOpen = !state.isPropertyPanelOpen;
      });
    },

    setPropertyPanelOpen: (open) => {
      set((state) => {
        state.isPropertyPanelOpen = open;
      });
    },

    theme:
      typeof window !== 'undefined' && localStorage.getItem('patchcat-theme') === 'dark'
        ? 'dark'
        : 'light',

    setTheme: (theme) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('patchcat-theme', theme);
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      set((state) => {
        state.theme = theme;
      });
    },

    toggleTheme: () => {
      const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
      get().setTheme(nextTheme);
    },

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
      get().captureSnapshot();
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
      get().captureSnapshot();
      set((state) => {
        state.nodes = state.nodes.filter((n) => n.id !== nodeId);
        state.edges = state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
        if (state.selectedNodeId === nodeId) {
          state.selectedNodeId = null;
        }
      });
    },

    deleteEdge: (edgeId) => {
      get().captureSnapshot();
      set((state) => {
        state.edges = state.edges.filter((e) => e.id !== edgeId);
      });
    },

    // ── Node CRUD ────────────────────────────────────────────────────────
    addNode: (type, position) => {
      get().captureSnapshot();
      nodeCounters[type] += 1;
      const id = `${type}_${nanoid(8)}`;
      const label = `${getDefaultNodeLabel(type)} #${nodeCounters[type]}`;

      /** Stagger new nodes so they don't pile on top of each other. */
      const existingCount = get().nodes.length;
      const defaultPosition = position ?? {
        x: 100 + existingCount * 40,
        y: 150 + existingCount * 40,
      };

      const nodeConfig = getDefaultNodeConfig(type);
      if (type === 'llm' || type === 'agent') {
        try {
          const settings = useSettingsStore.getState();
          const activeProv = settings.providers[settings.activeProvider];
          if (activeProv?.defaultModel) {
            nodeConfig['model'] = activeProv.defaultModel;
          }
        } catch {
          // Keep default
        }
      }

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
          config: nodeConfig,
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

    updateNodeStreamingOutput: (nodeId, content, reasoning) => {
      set((state) => {
        const node = state.nodes.find((n) => n.id === nodeId);
        if (node) {
          node.data.outputs = {
            ...node.data.outputs,
            response: content,
            ...(reasoning ? { reasoning } : {}),
          };
        }
      });
    },

    setSelectedNodeId: (nodeId) => {
      set((state) => {
        state.selectedNodeId = nodeId;
        if (nodeId) {
          state.isPropertyPanelOpen = true;
        }
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
        state.edges = (graph.edges || []).map((e) => ({
          ...e,
          type: 'default',
          animated: false,
        }));
        state.selectedNodeId = null;
        state.isExecuting = false;
        state.globalInputs = {};
      });
      historyManager.clear();
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

    // ── Ergonomics & Pinpoint Focus ──────────────────────────────────────────
    highlightedNodeId: null,
    highlightNode: (nodeId: string) => {
      set((state) => {
        state.highlightedNodeId = nodeId;
        state.selectedNodeId = nodeId;
        state.centerTargetNodeId = nodeId;
        state.isPropertyPanelOpen = true;
      });
      if (typeof window !== 'undefined') {
        setTimeout(() => {
          set((state) => {
            if (state.highlightedNodeId === nodeId) {
              state.highlightedNodeId = null;
            }
          });
        }, 1600);
      }
    },
    centerTargetNodeId: null,
    clearCenterTarget: () => {
      set((state) => {
        state.centerTargetNodeId = null;
      });
    },

    // ── Multi-Node Clipboard ─────────────────────────────────────────────────
    clipboard: null,
    copySelectedNodes: () => {
      const currentNodes = get().nodes;
      const currentEdges = get().edges;
      let selected = currentNodes.filter((n) => n.selected);
      if (selected.length === 0 && get().selectedNodeId) {
        const single = currentNodes.find((n) => n.id === get().selectedNodeId);
        if (single) selected = [single];
      }
      if (selected.length === 0) return false;

      const selectedIds = new Set(selected.map((n) => n.id));
      const internalEdges = currentEdges.filter(
        (e) => selectedIds.has(e.source) && selectedIds.has(e.target),
      );

      set((state) => {
        state.clipboard = {
          nodes: JSON.parse(JSON.stringify(selected)),
          edges: JSON.parse(JSON.stringify(internalEdges)),
        };
      });
      return true;
    },

    pasteNodes: () => {
      const clipboard = get().clipboard;
      if (!clipboard || clipboard.nodes.length === 0) return false;

      get().captureSnapshot();

      const idMap: Record<string, string> = {};
      const newNodes: WorkflowNode[] = [];
      const newEdges: WorkflowEdge[] = [];

      // Deselect all existing nodes
      set((state) => {
        state.nodes.forEach((n) => {
          n.selected = false;
        });
      });

      for (const node of clipboard.nodes) {
        nodeCounters[node.type] = (nodeCounters[node.type] || 0) + 1;
        const newId = `${node.type}_${nanoid(8)}`;
        idMap[node.id] = newId;

        const clonedData = JSON.parse(JSON.stringify(node.data));
        clonedData.status = 'idle';
        clonedData.executionResult = undefined;
        clonedData.label = `${node.data.label || getDefaultNodeLabel(node.type)} (Copy)`;

        const newNode: WorkflowNode = {
          ...node,
          id: newId,
          position: {
            x: node.position.x + 50,
            y: node.position.y + 50,
          },
          selected: true,
          data: clonedData,
        };
        newNodes.push(newNode);
      }

      for (const edge of clipboard.edges) {
        const newSource = idMap[edge.source];
        const newTarget = idMap[edge.target];
        if (newSource && newTarget) {
          newEdges.push({
            ...edge,
            id: `edge-${nanoid(8)}`,
            source: newSource,
            target: newTarget,
            animated: false,
          });
        }
      }

      set((state) => {
        state.nodes.push(...newNodes);
        state.edges.push(...newEdges);
        if (newNodes.length === 1 && newNodes[0]) {
          state.selectedNodeId = newNodes[0].id;
        }
      });

      // Update clipboard positions so repeated pastes cascade (+50px, +50px)
      set((state) => {
        if (state.clipboard) {
          state.clipboard.nodes.forEach((n) => {
            n.position.x += 50;
            n.position.y += 50;
          });
        }
      });

      return true;
    },

    // ── Undo / Redo History ──────────────────────────────────────────────────
    captureSnapshot: () => {
      historyManager.pushSnapshot({
        nodes: get().nodes,
        edges: get().edges,
      });
    },

    undo: () => {
      const current = { nodes: get().nodes, edges: get().edges };
      const previous = historyManager.undo(current);
      if (!previous) return false;

      set((state) => {
        state.nodes = previous.nodes;
        state.edges = previous.edges;
        if (state.selectedNodeId && !previous.nodes.some((n) => n.id === state.selectedNodeId)) {
          state.selectedNodeId = null;
        }
      });
      return true;
    },

    redo: () => {
      const current = { nodes: get().nodes, edges: get().edges };
      const next = historyManager.redo(current);
      if (!next) return false;

      set((state) => {
        state.nodes = next.nodes;
        state.edges = next.edges;
      });
      return true;
    },

    canUndo: () => historyManager.canUndo(),
    canRedo: () => historyManager.canRedo(),

    // ── In-Place Local Retry ─────────────────────────────────────────────────
    retryNode: async (nodeId: string, options?: { resumeDownstream?: boolean }) => {
      const state = get();
      if (state.isExecuting) return;
      const targetNode = state.nodes.find((n) => n.id === nodeId);
      if (!targetNode) return;

      set((s) => {
        s.isExecuting = true;
      });
      state.setNodeStatus(nodeId, 'running');

      try {
        const engine = new BrowserWorkflowEngine();
        for await (const event of engine.executeSingleNode(
          { nodes: get().nodes, edges: get().edges },
          nodeId,
          { inputs: get().globalInputs, resumeDownstream: options?.resumeDownstream },
        )) {
          if (event.type === 'NODE_START') {
            get().setNodeStatus(event.payload.nodeId, 'running');
          } else if (event.type === 'NODE_CHUNK') {
            get().updateNodeStreamingOutput(
              event.payload.nodeId,
              event.payload.fullContent,
              event.payload.fullReasoning,
            );
          } else if (event.type === 'NODE_COMPLETE') {
            const rawUsage = event.payload.output?.usage as TokenUsage | undefined;
            const tokenUsage = rawUsage || { prompt: 60, completion: 60, total: 120 };
            get().setNodeStatus(event.payload.nodeId, 'success', {
              latencyMs: event.payload.durationMs,
              tokenUsage,
              timestamp: Date.now(),
            });
            if (event.payload.output) {
              get().updateNodeData(event.payload.nodeId, {
                outputs: event.payload.output,
              });
            }
          } else if (event.type === 'NODE_ERROR') {
            get().setNodeStatus(event.payload.nodeId, 'error', {
              latencyMs: event.payload.durationMs,
              error: event.payload.error,
              timestamp: Date.now(),
            });
          }
        }
      } finally {
        set((s) => {
          s.isExecuting = false;
        });
      }
    },

    retryAllFailedNodes: async () => {
      const state = get();
      if (state.isExecuting) return;
      const failedNodes = state.nodes.filter((n) => n.data.status === 'error');
      if (failedNodes.length === 0) return;

      set((s) => {
        s.isExecuting = true;
      });

      try {
        const engine = new BrowserWorkflowEngine();
        for await (const event of engine.executeWorkflow(
          { nodes: get().nodes, edges: get().edges },
          {
            inputs: get().globalInputs,
            resumeFromExisting: true,
            targetNodeIds: failedNodes.map((n) => n.id),
          },
        )) {
          if (event.type === 'NODE_START') {
            get().setNodeStatus(event.payload.nodeId, 'running');
          } else if (event.type === 'NODE_CHUNK') {
            get().updateNodeStreamingOutput(
              event.payload.nodeId,
              event.payload.fullContent,
              event.payload.fullReasoning,
            );
          } else if (event.type === 'NODE_COMPLETE') {
            const rawUsage = event.payload.output?.usage as TokenUsage | undefined;
            const tokenUsage = rawUsage || { prompt: 60, completion: 60, total: 120 };
            get().setNodeStatus(event.payload.nodeId, 'success', {
              latencyMs: event.payload.durationMs,
              tokenUsage,
              timestamp: Date.now(),
            });
            if (event.payload.output) {
              get().updateNodeData(event.payload.nodeId, {
                outputs: event.payload.output,
              });
            }
          } else if (event.type === 'NODE_ERROR') {
            get().setNodeStatus(event.payload.nodeId, 'error', {
              latencyMs: event.payload.durationMs,
              error: event.payload.error,
              timestamp: Date.now(),
            });
          }
        }
      } finally {
        set((s) => {
          s.isExecuting = false;
        });
      }
    },
  })),
);

