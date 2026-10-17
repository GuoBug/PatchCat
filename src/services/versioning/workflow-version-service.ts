/**
 * @file    src/services/versioning/workflow-version-service.ts
 * @version 1.0.0
 * @description
 *   PRD-020 Part B: user-named workflow version snapshots.
 *
 *   Save pipeline:
 *     1. Sanitize: strip API keys (PRD-017 zero-plaintext) and runtime outputs.
 *        Prompt-variable masking and local-path redaction are deliberately NOT
 *        applied: versions never leave the device, and those two passes rewrite
 *        user content, which would make rollback lossy.
 *     2. Strip layout/UI flags (selected, dragging, measured) but keep positions,
 *        so a rollback restores the original layout.
 *     3. Hash the canonical logical graph (SHA-256).
 *     4. Reject if identical to the newest version (no-op save).
 *     5. Insert under a transactional 30-version quota; never evict.
 */

import type { WorkflowNode, WorkflowEdge } from '../../engine/types.ts';
import { sanitizeWorkflow, isGraphFullySanitized } from '../export/workflow-sanitizer.ts';
import {
  computeCanonicalGraphHash,
  diffWorkflowGraphs,
  type GraphLike,
  type WorkflowDiffResult,
} from '../diff/workflow-diff.ts';
import {
  indexedDb,
  WorkflowVersionQuotaError,
  type WorkflowVersionRecord,
} from '../storage/indexeddb-adapter.ts';
import { RUNTIME_DEFAULTS } from '../../config/runtime-defaults.ts';

export { WorkflowVersionQuotaError };
export type { WorkflowVersionRecord };

export const MAX_WORKFLOW_VERSIONS = RUNTIME_DEFAULTS.WORKFLOW_VERSION_MAX_PER_WORKFLOW;
export const MAX_VERSION_LABEL_LENGTH = 80;

export class DuplicateWorkflowVersionError extends Error {
  public readonly code = 'WORKFLOW_VERSION_DUPLICATE';
  public readonly existingVersionId: string;
  public readonly existingLabel: string;

  constructor(existingVersionId: string, existingLabel: string) {
    super(
      `The canvas is logically identical to the latest version "${existingLabel}"; nothing to save.`,
    );
    this.name = 'DuplicateWorkflowVersionError';
    this.existingVersionId = existingVersionId;
    this.existingLabel = existingLabel;
  }
}

export interface PreparedVersionGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  globalInputs?: Record<string, unknown>;
  strippedApiKeysCount: number;
  isSanitized: boolean;
}

/** UI-only node fields that must not be persisted in a version. */
const NODE_UI_FIELDS = ['selected', 'dragging', 'measured', 'resizing'] as const;
/** UI-only edge fields that must not be persisted in a version. */
const EDGE_UI_FIELDS = ['selected', 'animated', 'style'] as const;

/**
 * Produces the persisted form of a graph: deep-cloned, API keys stripped,
 * runtime outputs removed, UI flags removed. Never mutates the input.
 */
export function prepareVersionGraph(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  globalInputs?: Record<string, unknown>,
): PreparedVersionGraph {
  const { sanitizedWorkflow, stats } = sanitizeWorkflow(
    { nodes, edges, ...(globalInputs ? { globalInputs } : {}) } as unknown as Record<string, unknown>,
    {
      stripApiKeys: true,
      clearExecutionOutputs: true,
      maskSensitivePromptVars: false,
      stripLocalPaths: false,
    },
  );
  const sw = sanitizedWorkflow as unknown as {
    nodes?: WorkflowNode[];
    edges?: WorkflowEdge[];
    globalInputs?: Record<string, unknown>;
  };

  const cleanNodes = (sw.nodes ?? []).map((n) => {
    const node = { ...n } as Record<string, unknown>;
    for (const f of NODE_UI_FIELDS) delete node[f];
    const data = { ...(n.data as Record<string, unknown>) };
    // sanitizeWorkflow resets outputs to {} and status to 'idle'; drop them
    // entirely so the stored version carries no runtime state at all.
    delete data['outputs'];
    delete data['status'];
    delete data['executionResult'];
    delete data['streamingOutput'];
    delete data['streamingReasoning'];
    node['data'] = data;
    return node as unknown as WorkflowNode;
  });

  const cleanEdges = (sw.edges ?? []).map((e) => {
    const edge = { ...e } as Record<string, unknown>;
    for (const f of EDGE_UI_FIELDS) delete edge[f];
    return edge as unknown as WorkflowEdge;
  });

  const isSanitized = isGraphFullySanitized(cleanNodes);

  return {
    nodes: cleanNodes,
    edges: cleanEdges,
    ...(sw.globalInputs && Object.keys(sw.globalInputs).length > 0
      ? { globalInputs: sw.globalInputs }
      : {}),
    strippedApiKeysCount: stats.strippedApiKeysCount,
    isSanitized,
  };
}

/**
 * Hash of the canvas as it would be stored. API keys are stripped before
 * hashing, so a canvas holding a key compares equal to its keyless version.
 */
export async function computeWorkflowStateHash(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  globalInputs?: Record<string, unknown>,
): Promise<string> {
  const prepared = prepareVersionGraph(nodes, edges, globalInputs);
  return computeCanonicalGraphHash(prepared.nodes, prepared.edges, prepared.globalInputs);
}

function generateVersionId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `ver_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface CreateVersionInput {
  workflowId: string;
  label: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  globalInputs?: Record<string, unknown>;
  /** Injectable clock for deterministic tests. */
  now?: number;
}

export async function createWorkflowVersion(
  input: CreateVersionInput,
): Promise<WorkflowVersionRecord> {
  const workflowId = input.workflowId?.trim();
  if (!workflowId) throw new Error('createWorkflowVersion: workflowId is required.');

  const label = (input.label ?? '').trim().slice(0, MAX_VERSION_LABEL_LENGTH);
  if (!label) throw new Error('createWorkflowVersion: label is required.');

  const prepared = prepareVersionGraph(input.nodes, input.edges, input.globalInputs);
  const graphHash = await computeCanonicalGraphHash(
    prepared.nodes,
    prepared.edges,
    prepared.globalInputs,
  );

  const existing = await indexedDb.getWorkflowVersions(workflowId);
  const latest = existing[0];
  if (latest && latest.graphHash === graphHash) {
    throw new DuplicateWorkflowVersionError(latest.id, latest.label);
  }
  // Fast-path quota check for a clear error; the authoritative check is the
  // transactional one inside saveWorkflowVersionWithQuota.
  if (existing.length >= MAX_WORKFLOW_VERSIONS) {
    throw new WorkflowVersionQuotaError(workflowId, existing.length, MAX_WORKFLOW_VERSIONS);
  }

  const description = input.description?.trim();
  const record: WorkflowVersionRecord = {
    id: generateVersionId(),
    workflowId,
    label,
    ...(description ? { description } : {}),
    createdAt: input.now ?? Date.now(),
    graph: {
      nodes: prepared.nodes,
      edges: prepared.edges,
      ...(prepared.globalInputs && Object.keys(prepared.globalInputs).length > 0
        ? { globalInputs: prepared.globalInputs }
        : {}),
    },
    graphHash,
    metadata: {
      nodeCount: prepared.nodes.length,
      edgeCount: prepared.edges.length,
      sanitized: prepared.isSanitized,
      strippedApiKeysCount: prepared.strippedApiKeysCount,
    },
  };

  await indexedDb.saveWorkflowVersionWithQuota(record, MAX_WORKFLOW_VERSIONS);
  return record;
}

export function listWorkflowVersions(workflowId: string): Promise<WorkflowVersionRecord[]> {
  return indexedDb.getWorkflowVersions(workflowId);
}

export function getWorkflowVersion(id: string): Promise<WorkflowVersionRecord | null> {
  return indexedDb.getWorkflowVersion(id);
}

export function deleteWorkflowVersion(id: string): Promise<void> {
  return indexedDb.deleteWorkflowVersion(id);
}

/**
 * Diffs a saved version snapshot against a live canvas graph.
 * Automatically sanitizes live graph credentials and transient state first,
 * preventing phantom diffs and preventing credential leakage.
 */
export function diffVersionAgainstLive(
  versionGraph: GraphLike,
  liveGraph: GraphLike,
): WorkflowDiffResult {
  const prepared = prepareVersionGraph(liveGraph.nodes, liveGraph.edges, liveGraph.globalInputs);
  return diffWorkflowGraphs(versionGraph, {
    nodes: prepared.nodes,
    edges: prepared.edges,
    globalInputs: prepared.globalInputs,
  });
}

export interface DirtyState {
  currentHash: string;
  latestVersion: WorkflowVersionRecord | null;
  /** True when the canvas differs logically from the newest version (or no version exists). */
  isDirty: boolean;
}

/**
 * Compares the canvas against the newest saved version. Used as the rollback
 * pre-check (PRD-020 §3.4). With no versions at all, any non-empty canvas is
 * considered dirty.
 */
export async function getDirtyState(
  workflowId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  globalInputs?: Record<string, unknown>,
): Promise<DirtyState> {
  const [currentHash, versions] = await Promise.all([
    computeWorkflowStateHash(nodes, edges, globalInputs),
    indexedDb.getWorkflowVersions(workflowId),
  ]);
  const latestVersion = versions[0] ?? null;
  const isDirty = latestVersion
    ? latestVersion.graphHash !== currentHash
    : (nodes?.length ?? 0) > 0 || (edges?.length ?? 0) > 0;
  return { currentHash, latestVersion, isDirty };
}
