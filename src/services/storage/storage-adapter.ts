/**
 * @file    src/services/storage/storage-adapter.ts
 * @version 1.0.0
 * @description
 *   StorageAdapter pattern implementation providing a unified interface for
 *   both browser LocalStorage (Client-Side BYOK) and FastAPI Backend (PostgreSQL/SQLite).
 */

import { nanoid } from 'nanoid';
import {
  type Folder,
  type SavedWorkflow,
  reconcileFoldersAndWorkflows,
} from '../../stores/project-store.ts';
import type { WorkflowNode, WorkflowEdge } from '../../engine/types.ts';

export interface IStorageAdapter {
  // Folder Operations
  getFolders(): Promise<Folder[]>;
  createFolder(folder: { id?: string; name: string; isExpanded?: boolean }): Promise<Folder>;
  updateFolder(id: string, updates: { name?: string; isExpanded?: boolean }): Promise<Folder>;
  deleteFolder(id: string): Promise<void>;

  // Workflow Operations
  getWorkflows(folderId?: string, search?: string): Promise<SavedWorkflow[]>;
  getWorkflow(id: string): Promise<SavedWorkflow | null>;
  createWorkflow(workflow: SavedWorkflow): Promise<SavedWorkflow>;
  saveWorkflow(id: string, updates: Partial<SavedWorkflow>): Promise<SavedWorkflow>;
  duplicateWorkflow(id: string): Promise<SavedWorkflow>;
  moveWorkflow(id: string, targetFolderId: string): Promise<SavedWorkflow>;
  deleteWorkflow(id: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. LocalStorage Adapter (Client-Side BYOK Mode)
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY_FOLDERS = 'patchcat_folders_v2';
const STORAGE_KEY_WORKFLOWS = 'patchcat_workflows_v2';

/**
 * Safely writes to localStorage with QuotaExceededError detection and graceful error handling.
 */
export function safeSetLocalStorageItem(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch (err: unknown) {
    const isQuota =
      err instanceof DOMException &&
      (err.code === 22 ||
        err.code === 1014 ||
        err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    if (isQuota) {
      console.error(
        `[LocalStorage QuotaExceededError] 本地存储物理配额已满 (${key})。`,
      );
      throw new Error(
        `[存储空间耗尽] 本地浏览器 LocalStorage 5MB 配额已满，无法保存 "${key}"。请清理无用工作流或切片。`,
      );
    }
    throw err;
  }
}

export class LocalStorageAdapter implements IStorageAdapter {
  private getStoredFolders(): Folder[] {
    if (typeof localStorage === 'undefined') return [];
    let rawFolders: Folder[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY_FOLDERS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) rawFolders = parsed;
      }
    } catch (e) {
      console.warn('[LocalStorageAdapter] Failed to parse folders:', e);
    }
    const { folders, hasChanges } = reconcileFoldersAndWorkflows(rawFolders, [], 'en');
    if (hasChanges) {
      this.setStoredFolders(folders);
    }
    return folders;
  }

  private setStoredFolders(folders: Folder[]): void {
    safeSetLocalStorageItem(STORAGE_KEY_FOLDERS, JSON.stringify(folders));
  }

  private getStoredWorkflows(): SavedWorkflow[] {
    if (typeof localStorage === 'undefined') return [];
    let rawWorkflows: SavedWorkflow[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY_WORKFLOWS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) rawWorkflows = parsed;
      }
    } catch (e) {
      console.warn('[LocalStorageAdapter] Failed to parse workflows:', e);
    }
    const { workflows, hasChanges } = reconcileFoldersAndWorkflows([], rawWorkflows, 'en');
    if (hasChanges) {
      this.setStoredWorkflows(workflows);
    }
    return workflows;
  }

  private setStoredWorkflows(workflows: SavedWorkflow[]): void {
    safeSetLocalStorageItem(STORAGE_KEY_WORKFLOWS, JSON.stringify(workflows));
  }

  async getFolders(): Promise<Folder[]> {
    return this.getStoredFolders();
  }

  async createFolder(folder: { id?: string; name: string; isExpanded?: boolean }): Promise<Folder> {
    const folders = this.getStoredFolders();
    const newFolder: Folder = {
      id: folder.id || `folder_${nanoid(6)}`,
      name: folder.name.trim(),
      createdAt: Date.now(),
      isExpanded: folder.isExpanded !== false,
      isPreset: false,
    };
    folders.push(newFolder);
    this.setStoredFolders(folders);
    return newFolder;
  }

  async updateFolder(
    id: string,
    updates: { name?: string; isExpanded?: boolean },
  ): Promise<Folder> {
    const folders = this.getStoredFolders();
    const idx = folders.findIndex((f) => f.id === id);
    if (idx === -1) throw new Error(`Folder '${id}' not found`);

    const existing = folders[idx]!;
    const updated: Folder = {
      ...existing,
      ...(updates.name ? { name: updates.name.trim() } : {}),
      ...(updates.isExpanded !== undefined ? { isExpanded: updates.isExpanded } : {}),
    };
    folders[idx] = updated;
    this.setStoredFolders(folders);
    return updated;
  }

  async deleteFolder(id: string): Promise<void> {
    const folders = this.getStoredFolders();
    const remaining = folders.filter((f) => f.id !== id);
    this.setStoredFolders(remaining);

    // Re-assign orphaned workflows to default folder
    const workflows = this.getStoredWorkflows();
    const targetFolderId = remaining[0]?.id || 'default';
    let changed = false;
    for (const wf of workflows) {
      if (wf.folderId === id) {
        wf.folderId = targetFolderId;
        changed = true;
      }
    }
    if (changed) this.setStoredWorkflows(workflows);
  }

  async getWorkflows(folderId?: string, search?: string): Promise<SavedWorkflow[]> {
    let workflows = this.getStoredWorkflows();
    if (folderId) workflows = workflows.filter((w) => w.folderId === folderId);
    if (search) {
      const q = search.toLowerCase();
      workflows = workflows.filter((w) => w.name.toLowerCase().includes(q));
    }
    return workflows;
  }

  async getWorkflow(id: string): Promise<SavedWorkflow | null> {
    const workflows = this.getStoredWorkflows();
    return workflows.find((w) => w.id === id) || null;
  }

  async createWorkflow(workflow: SavedWorkflow): Promise<SavedWorkflow> {
    const workflows = this.getStoredWorkflows();
    workflows.unshift(workflow);
    this.setStoredWorkflows(workflows);
    return workflow;
  }

  async saveWorkflow(id: string, updates: Partial<SavedWorkflow>): Promise<SavedWorkflow> {
    const workflows = this.getStoredWorkflows();
    const idx = workflows.findIndex((w) => w.id === id);
    if (idx === -1) throw new Error(`Workflow '${id}' not found`);

    const existing = workflows[idx]!;
    const updated: SavedWorkflow = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };
    workflows[idx] = updated;
    this.setStoredWorkflows(workflows);
    return updated;
  }

  async duplicateWorkflow(id: string): Promise<SavedWorkflow> {
    const workflows = this.getStoredWorkflows();
    const source = workflows.find((w) => w.id === id);
    if (!source) throw new Error(`Workflow '${id}' not found`);

    const newId = `wf_${nanoid(8)}`;
    const now = Date.now();
    const copy: SavedWorkflow = {
      ...source,
      id: newId,
      name: `${source.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
      isPreset: false,
    };

    const idx = workflows.findIndex((w) => w.id === id);
    workflows.splice(idx + 1, 0, copy);
    this.setStoredWorkflows(workflows);
    return copy;
  }

  async moveWorkflow(id: string, targetFolderId: string): Promise<SavedWorkflow> {
    return this.saveWorkflow(id, { folderId: targetFolderId });
  }

  async deleteWorkflow(id: string): Promise<void> {
    const workflows = this.getStoredWorkflows();
    const remaining = workflows.filter((w) => w.id !== id);
    this.setStoredWorkflows(remaining);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ApiServer Adapter (FastAPI + PostgreSQL / SQLite Mode)
// ─────────────────────────────────────────────────────────────────────────────

interface ApiWorkflowDetail {
  id: string;
  name: string;
  folder_id: string | null;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  global_inputs: Record<string, unknown>;
  memory_config?: { maxHistoryRounds?: number; maxTokenBudget?: number };
  is_preset: boolean;
  created_at: string;
  updated_at: string;
}

export class ApiServerAdapter implements IStorageAdapter {
  private baseUrl: string;

  constructor(baseUrl = 'http://localhost:8000') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    };

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      let errorDetail = response.statusText;
      try {
        const errorJson = await response.json();
        if (errorJson.detail) errorDetail = errorJson.detail;
      } catch {
        // Fallback to text
      }
      throw new Error(`[Backend API ${response.status}] ${errorDetail}`);
    }

    if (response.status === 204) {
      return null as unknown as T;
    }

    return response.json();
  }

  async getFolders(): Promise<Folder[]> {
    interface ApiFolder {
      id: string;
      name: string;
      is_expanded: boolean;
      is_preset: boolean;
      created_at: string;
      updated_at: string;
    }
    const apiFolders = await this.request<ApiFolder[]>('/api/v1/folders');
    return apiFolders.map((f) => ({
      id: f.id,
      name: f.name,
      isExpanded: f.is_expanded,
      isPreset: f.is_preset,
      createdAt: new Date(f.created_at).getTime(),
    }));
  }

  async createFolder(folder: { id?: string; name: string; isExpanded?: boolean }): Promise<Folder> {
    interface ApiFolder {
      id: string;
      name: string;
      is_expanded: boolean;
      is_preset: boolean;
      created_at: string;
    }
    const res = await this.request<ApiFolder>('/api/v1/folders', {
      method: 'POST',
      body: JSON.stringify({
        id: folder.id,
        name: folder.name,
        is_expanded: folder.isExpanded !== false,
      }),
    });
    return {
      id: res.id,
      name: res.name,
      isExpanded: res.is_expanded,
      isPreset: res.is_preset,
      createdAt: new Date(res.created_at).getTime(),
    };
  }

  async updateFolder(
    id: string,
    updates: { name?: string; isExpanded?: boolean },
  ): Promise<Folder> {
    interface ApiFolder {
      id: string;
      name: string;
      is_expanded: boolean;
      is_preset: boolean;
      created_at: string;
    }
    const res = await this.request<ApiFolder>(`/api/v1/folders/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: updates.name,
        is_expanded: updates.isExpanded,
      }),
    });
    return {
      id: res.id,
      name: res.name,
      isExpanded: res.is_expanded,
      isPreset: res.is_preset,
      createdAt: new Date(res.created_at).getTime(),
    };
  }

  async deleteFolder(id: string): Promise<void> {
    await this.request<void>(`/api/v1/folders/${id}`, { method: 'DELETE' });
  }

  async getWorkflows(folderId?: string, search?: string): Promise<SavedWorkflow[]> {
    interface ApiWorkflowSummary {
      id: string;
      name: string;
      folder_id: string | null;
      description: string | null;
      is_preset: boolean;
      created_at: string;
      updated_at: string;
    }

    const params = new URLSearchParams();
    if (folderId) params.set('folder_id', folderId);
    if (search) params.set('search', search);

    const query = params.toString() ? `?${params.toString()}` : '';
    const summaries = await this.request<ApiWorkflowSummary[]>(`/api/v1/workflows${query}`);

    // If we need the complete graph (nodes/edges), we can fetch them or map summaries
    // For fast listing, we map summaries with empty arrays and lazy-load details on select
    return summaries.map((s) => ({
      id: s.id,
      name: s.name,
      folderId: s.folder_id || 'default',
      nodes: [],
      edges: [],
      globalInputs: {},
      createdAt: new Date(s.created_at).getTime(),
      updatedAt: new Date(s.updated_at).getTime(),
      isPreset: s.is_preset,
    }));
  }

  async getWorkflow(id: string): Promise<SavedWorkflow | null> {
    try {
      const res = await this.request<ApiWorkflowDetail>(`/api/v1/workflows/${id}`);
      return {
        id: res.id,
        name: res.name,
        folderId: res.folder_id || 'default',
        nodes: res.nodes || [],
        edges: res.edges || [],
        globalInputs: res.global_inputs || {},
        memoryConfig: res.memory_config,
        createdAt: new Date(res.created_at).getTime(),
        updatedAt: new Date(res.updated_at).getTime(),
        isPreset: res.is_preset,
      };
    } catch {
      return null;
    }
  }

  async createWorkflow(workflow: SavedWorkflow): Promise<SavedWorkflow> {
    const res = await this.request<ApiWorkflowDetail>('/api/v1/workflows', {
      method: 'POST',
      body: JSON.stringify({
        id: workflow.id,
        name: workflow.name,
        folder_id: workflow.folderId,
        nodes: workflow.nodes,
        edges: workflow.edges,
        global_inputs: workflow.globalInputs,
        memory_config: workflow.memoryConfig,
      }),
    });

    return {
      id: res.id,
      name: res.name,
      folderId: res.folder_id || 'default',
      nodes: res.nodes || [],
      edges: res.edges || [],
      globalInputs: res.global_inputs || {},
      memoryConfig: res.memory_config,
      createdAt: new Date(res.created_at).getTime(),
      updatedAt: new Date(res.updated_at).getTime(),
      isPreset: res.is_preset,
    };
  }

  async saveWorkflow(id: string, updates: Partial<SavedWorkflow>): Promise<SavedWorkflow> {
    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.folderId !== undefined) payload.folder_id = updates.folderId;
    if (updates.nodes !== undefined) payload.nodes = updates.nodes;
    if (updates.edges !== undefined) payload.edges = updates.edges;
    if (updates.globalInputs !== undefined) payload.global_inputs = updates.globalInputs;
    if (updates.memoryConfig !== undefined) payload.memory_config = updates.memoryConfig;

    const res = await this.request<ApiWorkflowDetail>(`/api/v1/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    return {
      id: res.id,
      name: res.name,
      folderId: res.folder_id || 'default',
      nodes: res.nodes || [],
      edges: res.edges || [],
      globalInputs: res.global_inputs || {},
      memoryConfig: res.memory_config,
      createdAt: new Date(res.created_at).getTime(),
      updatedAt: new Date(res.updated_at).getTime(),
      isPreset: res.is_preset,
    };
  }

  async duplicateWorkflow(id: string): Promise<SavedWorkflow> {
    const res = await this.request<ApiWorkflowDetail>(`/api/v1/workflows/${id}/duplicate`, {
      method: 'POST',
    });

    return {
      id: res.id,
      name: res.name,
      folderId: res.folder_id || 'default',
      nodes: res.nodes || [],
      edges: res.edges || [],
      globalInputs: res.global_inputs || {},
      createdAt: new Date(res.created_at).getTime(),
      updatedAt: new Date(res.updated_at).getTime(),
      isPreset: res.is_preset,
    };
  }

  async moveWorkflow(id: string, targetFolderId: string): Promise<SavedWorkflow> {
    const res = await this.request<ApiWorkflowDetail>(`/api/v1/workflows/${id}/move`, {
      method: 'POST',
      body: JSON.stringify({ target_folder_id: targetFolderId }),
    });

    return {
      id: res.id,
      name: res.name,
      folderId: res.folder_id || 'default',
      nodes: res.nodes || [],
      edges: res.edges || [],
      globalInputs: res.global_inputs || {},
      createdAt: new Date(res.created_at).getTime(),
      updatedAt: new Date(res.updated_at).getTime(),
      isPreset: res.is_preset,
    };
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.request<void>(`/api/v1/workflows/${id}`, { method: 'DELETE' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Factory Function
// ─────────────────────────────────────────────────────────────────────────────

export function getStorageAdapter(mode: 'local' | 'server', baseUrl?: string): IStorageAdapter {
  if (mode === 'server') {
    return new ApiServerAdapter(baseUrl || 'http://localhost:8000');
  }
  return new LocalStorageAdapter();
}
