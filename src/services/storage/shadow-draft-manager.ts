/**
 * @file    src/services/storage/shadow-draft-manager.ts
 * @version 1.0.0
 * @description
 *   Ultra-low latency micro-draft persistence (Shadow Draft) for catastrophic recovery.
 *   Provides Scheme B time-delta diffing between committed workflows and unsynced
 *   in-flight property edits (Prompt templates, JS code scripts, etc.).
 *   Zero reliance on third-party libraries — pure deterministic LocalStorage.
 */

export const STORAGE_KEY_SHADOW_DRAFT = 'patchcat_shadow_draft_v1';

export interface ShadowDraft {
  workflowId: string;
  timestamp: number;
  nodeDrafts: Record<string, Record<string, unknown>>; // nodeId -> partial data/config
  activeNodeId?: string | null;
}

/**
 * Saves or merges a node configuration/data patch into the shadow draft in localStorage.
 *
 * @param workflowId - ID of the active workflow graph
 * @param nodeId     - Target node ID being modified
 * @param patch      - Partial data or config slice
 */
export function saveShadowDraft(
  workflowId: string,
  nodeId: string,
  patch: Record<string, unknown>,
): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const existing = getShadowDraft();
    let nodeDrafts: Record<string, Record<string, unknown>> = {};

    if (existing && existing.workflowId === workflowId) {
      nodeDrafts = { ...existing.nodeDrafts };
    }

    const previousNodeDraft = nodeDrafts[nodeId] || {};
    const updatedNodeDraft: Record<string, unknown> = {
      ...previousNodeDraft,
      ...patch,
    };

    // Deep merge 'config' if both previous and current patch contain config objects
    if (
      patch.config &&
      typeof patch.config === 'object' &&
      previousNodeDraft.config &&
      typeof previousNodeDraft.config === 'object'
    ) {
      updatedNodeDraft.config = {
        ...(previousNodeDraft.config as Record<string, unknown>),
        ...(patch.config as Record<string, unknown>),
      };
    }

    nodeDrafts[nodeId] = updatedNodeDraft;

    const draft: ShadowDraft = {
      workflowId,
      timestamp: Date.now(),
      nodeDrafts,
      activeNodeId: nodeId,
    };

    localStorage.setItem(STORAGE_KEY_SHADOW_DRAFT, JSON.stringify(draft));
  } catch (err) {
    console.warn('[ShadowDraftManager] Failed to write shadow draft to localStorage:', err);
  }
}

/**
 * Retrieves and validates the current shadow draft from localStorage.
 * Returns `null` if no draft exists or if the format is corrupted.
 */
export function getShadowDraft(): ShadowDraft | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_SHADOW_DRAFT);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ShadowDraft>;
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.workflowId === 'string' &&
      typeof parsed.timestamp === 'number' &&
      parsed.nodeDrafts &&
      typeof parsed.nodeDrafts === 'object'
    ) {
      return parsed as ShadowDraft;
    }
    return null;
  } catch (err) {
    console.warn('[ShadowDraftManager] Failed to read or parse shadow draft:', err);
    return null;
  }
}

/**
 * Clears the shadow draft from localStorage.
 * Should be invoked after a successful formal debounced save or upon explicit discard/recovery.
 */
export function clearShadowDraft(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY_SHADOW_DRAFT);
  } catch (err) {
    console.warn('[ShadowDraftManager] Failed to clear shadow draft from localStorage:', err);
  }
}

/**
 * Checks whether an unsynced shadow draft exists that is newer than the committed workflow.
 *
 * @param currentWorkflowId - ID of the active workflow
 * @param currentUpdatedAt  - Last formal commit timestamp of the active workflow
 * @returns Object indicating whether recovery is needed, and the candidate draft
 */
export function checkRecoveryNeeded(
  currentWorkflowId: string,
  currentUpdatedAt: number,
): { needed: boolean; draft: ShadowDraft | null } {
  const draft = getShadowDraft();
  if (
    draft &&
    draft.workflowId === currentWorkflowId &&
    draft.timestamp > currentUpdatedAt
  ) {
    return { needed: true, draft };
  }
  return { needed: false, draft: null };
}

export const ShadowDraftManager = {
  saveShadowDraft,
  getShadowDraft,
  clearShadowDraft,
  checkRecoveryNeeded,
};
