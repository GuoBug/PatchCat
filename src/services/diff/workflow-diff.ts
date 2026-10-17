/**
 * @file    src/services/diff/workflow-diff.ts
 * @version 1.0.0
 * @description
 *   PRD-020 Part B: Canonical graph fingerprint & structural workflow diff.
 *
 *   - `canonicalizeGraph` strips layout (position/size/selection) and runtime
 *     state (outputs/status/executionResult/streaming) so that only the logical
 *     DAG topology and node configuration remain.
 *   - `computeCanonicalGraphHash` hashes the canonical form with SHA-256
 *     (Web Crypto). It is invariant to node/edge array ordering, edge ids and
 *     node coordinates.
 *   - `diffWorkflowGraphs` aligns nodes by `id` and edges by the logical key
 *     `source:sourceHandle->target:targetHandle`, and separates pure
 *     coordinate moves into a `layoutOnly` bucket so they never count as
 *     logical changes.
 *   - `diffTextLines` provides an LCS line diff for long text fields
 *     (prompt templates, code scripts).
 *
 *   All functions are pure and never mutate their inputs.
 */

import type { WorkflowNode, WorkflowEdge } from '../../engine/types.ts';
import {
  SENSITIVE_KEY_NAME_RE,
  SENSITIVE_HEADER_RE,
  SENSITIVE_VALUE_HEURISTIC_RE,
} from '../export/workflow-sanitizer.ts';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Canonical form
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Keys in `node.data` that describe runtime state rather than logic.
 * They are excluded from the hash and the diff.
 */
export const TRANSIENT_NODE_DATA_KEYS: ReadonlySet<string> = new Set([
  'outputs',
  'status',
  'executionResult',
  'streamingOutput',
  'streamingReasoning',
  // `data.type` mirrors `node.type`; comparing it twice would only add noise.
  'type',
]);

export interface CanonicalNode {
  id: string;
  type: string;
  parentId?: string;
  data: Record<string, unknown>;
}

export interface CanonicalEdge {
  key: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

export interface CanonicalGraph {
  nodes: CanonicalNode[];
  edges: CanonicalEdge[];
  globalInputs?: Record<string, unknown>;
}

/** Logical identity of an edge. Edge `id`s are random and therefore ignored. */
export function edgeLogicalKey(edge: Pick<WorkflowEdge, 'source' | 'target' | 'sourceHandle' | 'targetHandle'>): string {
  return `${edge.source}:${edge.sourceHandle ?? ''}->${edge.target}:${edge.targetHandle ?? ''}`;
}

/** Returns a copy of `node.data` without transient runtime keys. */
export function extractLogicalNodeData(node: WorkflowNode): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const data = (node.data ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(data)) {
    if (TRANSIENT_NODE_DATA_KEYS.has(k)) continue;
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export function canonicalizeGraph(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  globalInputs?: Record<string, unknown>,
): CanonicalGraph {
  const canonicalNodes: CanonicalNode[] = (nodes ?? [])
    .map((n) => {
      const cn: CanonicalNode = {
        id: n.id,
        type: String(n.type ?? (n.data as Record<string, unknown> | undefined)?.['type'] ?? ''),
        data: extractLogicalNodeData(n),
      };
      if (n.parentId) cn.parentId = n.parentId;
      return cn;
    })
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // De-duplicate edges by logical key: two edges with identical endpoints are
  // the same data dependency for the DAG engine.
  const edgeMap = new Map<string, CanonicalEdge>();
  for (const e of edges ?? []) {
    const key = edgeLogicalKey(e);
    if (!edgeMap.has(key)) {
      edgeMap.set(key, {
        key,
        source: e.source,
        sourceHandle: e.sourceHandle ?? '',
        target: e.target,
        targetHandle: e.targetHandle ?? '',
      });
    }
  }
  const canonicalEdges = Array.from(edgeMap.values()).sort((a, b) =>
    a.key < b.key ? -1 : a.key > b.key ? 1 : 0,
  );

  const res: CanonicalGraph = { nodes: canonicalNodes, edges: canonicalEdges };
  if (globalInputs && Object.keys(globalInputs).length > 0) {
    res.globalInputs = globalInputs;
  }
  return res;
}

/**
 * Deterministic JSON serialization: object keys are sorted recursively,
 * `undefined` values and functions are dropped (same as JSON.stringify).
 */
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => (v === undefined ? null : sortKeysDeep(v)));
  }
  if (value && typeof value === 'object') {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src).sort()) {
      const v = src[k];
      if (v === undefined || typeof v === 'function') continue;
      out[k] = sortKeysDeep(v);
    }
    return out;
  }
  return value;
}

/**
 * SHA-256 (hex) of the canonical logical graph.
 * Uses Web Crypto, available in browsers and Node >= 19 via `globalThis.crypto`.
 */
export async function computeCanonicalGraphHash(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  globalInputs?: Record<string, unknown>,
): Promise<string> {
  const payload = canonicalStringify(canonicalizeGraph(nodes, edges, globalInputs));
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto SubtleCrypto is unavailable; cannot compute graph hash.');
  }
  const bytes = new TextEncoder().encode(payload);
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Structural diff
// ─────────────────────────────────────────────────────────────────────────────

export interface NodePropertyDiff {
  /** Dot path relative to `node`, e.g. `data.config.temperature`. */
  path: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface NodeDiff {
  nodeId: string;
  nodeType: string;
  label: string;
  status: 'added' | 'deleted' | 'modified' | 'layout';
  changes: NodePropertyDiff[];
  isLayoutOnly: boolean;
  positionDelta?: { dx: number; dy: number };
}

export interface WorkflowDiffResult {
  /** Any difference at all, including pure coordinate moves. */
  hasChanges: boolean;
  /** Node add/delete, logical property change, edge add/delete, or globalInputs change. */
  hasLogicalChanges: boolean;
  nodes: {
    added: WorkflowNode[];
    deleted: WorkflowNode[];
    modified: NodeDiff[];
    layoutOnly: NodeDiff[];
  };
  edges: {
    added: CanonicalEdge[];
    deleted: CanonicalEdge[];
  };
  globals?: NodePropertyDiff[];
  stats: {
    addedNodeCount: number;
    deletedNodeCount: number;
    modifiedNodeCount: number;
    layoutNodeCount: number;
    addedEdgeCount: number;
    deletedEdgeCount: number;
  };
}

export interface GraphLike {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  globalInputs?: Record<string, unknown>;
}

/**
 * Computes the structural diff from `base` (older, e.g. a saved version)
 * to `target` (newer, e.g. the current canvas).
 */
export function diffWorkflowGraphs(base: GraphLike, target: GraphLike): WorkflowDiffResult {
  const baseNodes = new Map((base.nodes ?? []).map((n) => [n.id, n]));
  const targetNodes = new Map((target.nodes ?? []).map((n) => [n.id, n]));

  const added: WorkflowNode[] = [];
  const deleted: WorkflowNode[] = [];
  const modified: NodeDiff[] = [];
  const layoutOnly: NodeDiff[] = [];

  for (const [id, tn] of targetNodes) {
    if (!baseNodes.has(id)) added.push(tn);
  }
  for (const [id, bn] of baseNodes) {
    if (!targetNodes.has(id)) deleted.push(bn);
  }

  for (const [id, bn] of baseNodes) {
    const tn = targetNodes.get(id);
    if (!tn) continue;

    const changes: NodePropertyDiff[] = [];
    if (String(bn.type) !== String(tn.type)) {
      changes.push({ path: 'type', oldValue: bn.type, newValue: tn.type });
    }
    if ((bn.parentId ?? null) !== (tn.parentId ?? null)) {
      changes.push({ path: 'parentId', oldValue: bn.parentId, newValue: tn.parentId });
    }
    collectDeepDiff(extractLogicalNodeData(bn), extractLogicalNodeData(tn), 'data', changes);

    const bx = bn.position?.x ?? 0;
    const by = bn.position?.y ?? 0;
    const tx = tn.position?.x ?? 0;
    const ty = tn.position?.y ?? 0;
    const moved = bx !== tx || by !== ty;
    const positionDelta = moved ? { dx: tx - bx, dy: ty - by } : undefined;

    const label = String((tn.data as Record<string, unknown>)?.['label'] ?? tn.id);
    if (changes.length > 0) {
      modified.push({
        nodeId: id,
        nodeType: String(tn.type),
        label,
        status: 'modified',
        changes,
        isLayoutOnly: false,
        positionDelta,
      });
    } else if (moved) {
      layoutOnly.push({
        nodeId: id,
        nodeType: String(tn.type),
        label,
        status: 'layout',
        changes: [],
        isLayoutOnly: true,
        positionDelta,
      });
    }
  }

  const baseEdges = new Map(canonicalizeGraph([], base.edges).edges.map((e) => [e.key, e]));
  const targetEdges = new Map(canonicalizeGraph([], target.edges).edges.map((e) => [e.key, e]));
  const addedEdges: CanonicalEdge[] = [];
  const deletedEdges: CanonicalEdge[] = [];
  for (const [k, e] of targetEdges) if (!baseEdges.has(k)) addedEdges.push(e);
  for (const [k, e] of baseEdges) if (!targetEdges.has(k)) deletedEdges.push(e);

  const globalInputsChanges: NodePropertyDiff[] = [];
  if (base.globalInputs || target.globalInputs) {
    collectDeepDiff(base.globalInputs ?? {}, target.globalInputs ?? {}, 'globalInputs', globalInputsChanges);
  }

  const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  added.sort(byId);
  deleted.sort(byId);
  modified.sort((a, b) => (a.nodeId < b.nodeId ? -1 : 1));
  layoutOnly.sort((a, b) => (a.nodeId < b.nodeId ? -1 : 1));

  const hasLogicalChanges =
    added.length > 0 ||
    deleted.length > 0 ||
    modified.length > 0 ||
    addedEdges.length > 0 ||
    deletedEdges.length > 0 ||
    globalInputsChanges.length > 0;

  return {
    hasChanges: hasLogicalChanges || layoutOnly.length > 0,
    hasLogicalChanges,
    nodes: { added, deleted, modified, layoutOnly },
    edges: { added: addedEdges, deleted: deletedEdges },
    ...(globalInputsChanges.length > 0 ? { globals: globalInputsChanges } : {}),
    stats: {
      addedNodeCount: added.length,
      deletedNodeCount: deleted.length,
      modifiedNodeCount: modified.length,
      layoutNodeCount: layoutOnly.length,
      addedEdgeCount: addedEdges.length,
      deletedEdgeCount: deletedEdges.length,
    },
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function maskSensitiveDiffValue(val: unknown, path: string): unknown {
  if (val === undefined || val === null) return val;
  const segments = path.split('.');
  const lastKey = segments[segments.length - 1] || '';
  const isHeader = segments.includes('headers');

  if (typeof val === 'string') {
    if (
      SENSITIVE_KEY_NAME_RE.test(lastKey) ||
      (isHeader && SENSITIVE_HEADER_RE.test(lastKey)) ||
      SENSITIVE_VALUE_HEURISTIC_RE.test(val)
    ) {
      return val ? '••••••••' : '';
    }
  } else if (Array.isArray(val) && SENSITIVE_KEY_NAME_RE.test(lastKey)) {
    return val.map((item) => (typeof item === 'string' && item ? '••••••••' : item));
  }
  return val;
}

/**
 * Recursive diff on plain objects. Arrays and primitives are compared as
 * whole values (via canonical JSON) and reported at their own path; this keeps
 * paths stable and readable (e.g. `data.config.tools` instead of `tools.3.name`).
 */
function collectDeepDiff(a: unknown, b: unknown, path: string, out: NodePropertyDiff[]): void {
  if (isPlainObject(a) && isPlainObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of Array.from(keys).sort()) {
      collectDeepDiff(a[k], b[k], `${path}.${k}`, out);
    }
    return;
  }
  if (canonicalStringify(a ?? null) !== canonicalStringify(b ?? null)) {
    const maskedA = maskSensitiveDiffValue(a, path);
    const maskedB = maskSensitiveDiffValue(b, path);
    out.push({ path, oldValue: maskedA, newValue: maskedB });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Line-level text diff (LCS)
// ─────────────────────────────────────────────────────────────────────────────

export interface TextDiffLine {
  type: 'equal' | 'added' | 'removed';
  text: string;
}

/**
 * Upper bound on the LCS table size (rows x cols). Beyond this the diff falls
 * back to "remove all old lines, add all new lines" to keep the UI thread
 * responsive; 4M cells is roughly a 2000 x 2000 line comparison.
 */
export const MAX_LCS_CELLS = 4_000_000;

export function diffTextLines(oldText: string, newText: string): TextDiffLine[] {
  const a = (oldText ?? '').split('\n');
  const b = (newText ?? '').split('\n');
  const n = a.length;
  const m = b.length;

  if (n * m > MAX_LCS_CELLS) {
    return [
      ...a.map((text) => ({ type: 'removed' as const, text })),
      ...b.map((text) => ({ type: 'added' as const, text })),
    ];
  }

  // dp[i][j] = LCS length of a[i..] and b[j..], flattened row-major.
  const width = m + 1;
  const dp = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * width + j] =
        a[i] === b[j]
          ? dp[(i + 1) * width + (j + 1)]! + 1
          : Math.max(dp[(i + 1) * width + j]!, dp[i * width + (j + 1)]!);
    }
  }

  const result: TextDiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      result.push({ type: 'equal', text: a[i]! });
      i++;
      j++;
    } else if (dp[(i + 1) * width + j]! >= dp[i * width + (j + 1)]!) {
      result.push({ type: 'removed', text: a[i]! });
      i++;
    } else {
      result.push({ type: 'added', text: b[j]! });
      j++;
    }
  }
  while (i < n) result.push({ type: 'removed', text: a[i++]! });
  while (j < m) result.push({ type: 'added', text: b[j++]! });
  return result;
}
