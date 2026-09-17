/**
 * @file    src/stores/project-store.ts
 * @version 2.0.0
 * @description
 *   Zustand store for managing multi-workflow projects, hierarchical folders/directories,
 *   and Dual-Mode persistence (LocalStorage vs FastAPI Backend) with Antigravity-style left drawer.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type { WorkflowNode, WorkflowEdge } from '../engine/types.ts';
import { useWorkflowStore } from './workflow-store.ts';
import { useSettingsStore } from './settings-store.ts';
import { PRESETS_DATA } from '../presets/index.ts';
import { getStorageAdapter } from '../services/storage/storage-adapter.ts';
import { RUNTIME_DEFAULTS } from '../config/runtime-defaults.ts';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
  isExpanded?: boolean;
  isPreset?: boolean;
}

export interface WorkflowMemoryConfig {
  maxHistoryRounds?: number;
  maxTokenBudget?: number;
}

export interface SavedWorkflow {
  id: string;
  name: string;
  folderId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  globalInputs: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  isPreset?: boolean;
  isLocked?: boolean;
  api_enabled?: boolean;
  api_key?: string;
  memoryConfig?: WorkflowMemoryConfig;
}

export interface ProjectStoreState {
  folders: Folder[];
  workflows: SavedWorkflow[];
  activeWorkflowId: string | null;
  isSidebarOpen: boolean;
  searchQuery: string;
  isLoading: boolean;

  // Actions
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSearchQuery: (query: string) => void;

  // Workflow CRUD
  createWorkflow: (name?: string, folderId?: string) => string;
  loadWorkflow: (id: string) => Promise<void>;
  saveCurrentWorkflow: (id?: string) => void;
  autoSaveCurrentWorkflow: () => void;
  toggleWorkflowLock: (id: string) => void;
  setWorkflowLocked: (id: string, locked: boolean) => void;
  renameWorkflow: (id: string, name: string) => void;
  updateWorkflow: (id: string, updates: Partial<SavedWorkflow>) => void;
  duplicateWorkflow: (id: string) => string;
  deleteWorkflow: (id: string) => void;
  moveWorkflow: (workflowId: string, targetFolderId: string) => void;
  updateGlobalInputs: (workflowId: string, globalInputs: Record<string, unknown>) => void;

  // Folder CRUD
  createFolder: (name: string) => string;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  toggleFolder: (id: string) => void;

  // Synchronization & Seed
  seedPresetsIfEmpty: (language?: 'en' | 'zh') => void;
  syncWithStorage: () => Promise<void>;
  clearAllWorkflows: () => Promise<void>;
}

const STORAGE_KEY_FOLDERS = 'patchcat_folders_v2';
const STORAGE_KEY_WORKFLOWS = 'patchcat_workflows_v2';
const STORAGE_KEY_SIDEBAR = 'patchcat_sidebar_open_v2';
const STORAGE_KEY_ACTIVE = 'patchcat_active_workflow_v2';

// ─────────────────────────────────────────────────────────────────────────────
// 2. Storage Helpers
// ─────────────────────────────────────────────────────────────────────────────

export const OFFICIAL_PRESET_KEYS = [
  'customer-support',
  'report-critic',
  'model-arena',
  'rag-qa',
  'rag-agentic-auditor',
  'conditional-routing',
  'weather-api',
] as const;

export function getInitialLanguage(): 'en' | 'zh' {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('patchcat-language-v1');
      if (saved === 'en' || saved === 'zh') return saved;
      if (typeof navigator !== 'undefined' && navigator.language?.startsWith('zh')) return 'zh';
    } catch {
      // ignore
    }
  }
  return 'zh';
}

/**
 * Reconciles folders and workflows to guarantee:
 * 1. A dedicated 'presets' folder exists, named '预设模版' (zh) or 'Preset Templates' (en).
 * 2. A 'default' folder exists, named '默认目录' (zh) or 'Default' (en).
 * 3. ALL 7 official sample presets reside inside 'folderId: presets' (never in 'default').
 * 4. Any missing presets are backfilled.
 * 5. Existing user-created folders and workflows are strictly preserved.
 */
export function reconcileFoldersAndWorkflows(
  rawFolders: Folder[] = [],
  rawWorkflows: SavedWorkflow[] = [],
  lang: 'en' | 'zh' = getInitialLanguage(),
): { folders: Folder[]; workflows: SavedWorkflow[]; hasChanges: boolean } {
  let hasChanges = false;
  const presets = PRESETS_DATA[lang] || PRESETS_DATA.en;
  const now = Date.now();

  // 1. Folders reconciliation
  const folders = Array.isArray(rawFolders) ? [...rawFolders] : [];

  const defaultIndex = folders.findIndex((f) => f.id === 'default');
  const expectedDefaultName = lang === 'zh' ? '默认目录' : 'Default';
  if (defaultIndex === -1) {
    folders.unshift({
      id: 'default',
      name: expectedDefaultName,
      createdAt: now,
      isExpanded: true,
      isPreset: true,
    });
    hasChanges = true;
  } else {
    const existingDefault = folders[defaultIndex];
    if (
      existingDefault &&
      ((existingDefault.name === 'Default' && lang === 'zh') ||
        (existingDefault.name === '默认目录' && lang === 'en'))
    ) {
      folders[defaultIndex] = {
        ...existingDefault,
        name: expectedDefaultName,
        isPreset: true,
      };
      hasChanges = true;
    }
  }

  const presetsIndex = folders.findIndex((f) => f.id === 'presets');
  const expectedPresetsName = lang === 'zh' ? '预设模版' : 'Preset Templates';
  if (presetsIndex === -1) {
    folders.push({
      id: 'presets',
      name: expectedPresetsName,
      createdAt: now,
      isExpanded: true,
      isPreset: true,
    });
    hasChanges = true;
  } else {
    const existingPresets = folders[presetsIndex];
    if (existingPresets) {
      const currentName = existingPresets.name;
      if (
        currentName !== expectedPresetsName &&
        (currentName === 'Official Presets' ||
          currentName === '官方预设库' ||
          currentName === 'Preset Templates' ||
          currentName === '预设模版')
      ) {
        folders[presetsIndex] = {
          ...existingPresets,
          name: expectedPresetsName,
          isPreset: true,
          isExpanded: true,
        };
        hasChanges = true;
      }
    }
  }

  // 2. Workflows reconciliation
  let workflows = Array.isArray(rawWorkflows) ? [...rawWorkflows] : [];

  function matchPresetKey(wf: SavedWorkflow): (typeof OFFICIAL_PRESET_KEYS)[number] | null {
    if (wf.id.startsWith('wf-')) {
      const candidate = wf.id.replace('wf-', '') as (typeof OFFICIAL_PRESET_KEYS)[number];
      if (OFFICIAL_PRESET_KEYS.includes(candidate)) return candidate;
    }
    for (const k of OFFICIAL_PRESET_KEYS) {
      const enItem = PRESETS_DATA.en[k];
      const zhItem = PRESETS_DATA.zh[k];
      if (wf.name === enItem?.name || wf.name === zhItem?.name) {
        return k;
      }
    }
    return null;
  }

  // A. Ensure any existing preset workflow is in folder 'presets' and marked isPreset: true
  workflows = workflows.map((wf) => {
    const key = matchPresetKey(wf);
    if (key) {
      let wfChanged = false;
      const updated = { ...wf };
      if (updated.folderId !== 'presets') {
        updated.folderId = 'presets';
        wfChanged = true;
      }
      if (!updated.isPreset) {
        updated.isPreset = true;
        wfChanged = true;
      }
      if (updated.isLocked === undefined) {
        updated.isLocked = true;
        wfChanged = true;
      }
      // Update localized name and graph data if matching standard preset
      const currentExpected = presets[key]?.name;
      const altLang = lang === 'zh' ? 'en' : 'zh';
      const altName = PRESETS_DATA[altLang]?.[key]?.name;
      if (currentExpected && (updated.name === altName || updated.name === currentExpected || updated.isLocked)) {
        if (updated.name !== currentExpected) {
          updated.name = currentExpected;
          wfChanged = true;
        }
        // Deeply sync localized nodes, edges and inputs for presets
        const targetPreset = presets[key];
        if (targetPreset) {
          updated.nodes = targetPreset.data.nodes;
          updated.edges = targetPreset.data.edges;
          updated.globalInputs =
            (targetPreset.data as unknown as { globalInputs?: Record<string, unknown> }).globalInputs || {};
          wfChanged = true;
        }
      }
      if (wfChanged) {
        hasChanges = true;
        return updated;
      }
    }
    return wf;
  });

  // B. Ensure all official presets exist
  OFFICIAL_PRESET_KEYS.forEach((key, index) => {
    const exists = workflows.some((w) => matchPresetKey(w) === key);
    if (!exists) {
      const item = presets[key] || PRESETS_DATA.en[key];
      if (item) {
        workflows.push({
          id: `wf-${key}`,
          name: item.name,
          folderId: 'presets',
          nodes: item.data.nodes,
          edges: item.data.edges,
          globalInputs:
            (item.data as unknown as { globalInputs?: Record<string, unknown> }).globalInputs || {},
          createdAt: now - 3600000 * (index + 1),
          updatedAt: now - 3600000 * (index + 1),
          isPreset: true,
          isLocked: true,
        });
        hasChanges = true;
      }
    }
  });

  return { folders, workflows, hasChanges };
}

function loadInitialFoldersAndWorkflows(lang: 'en' | 'zh' = getInitialLanguage()): {
  folders: Folder[];
  workflows: SavedWorkflow[];
} {
  let rawFolders: Folder[] = [];
  let rawWorkflows: SavedWorkflow[] = [];

  if (typeof localStorage !== 'undefined') {
    try {
      const rawF = localStorage.getItem(STORAGE_KEY_FOLDERS);
      if (rawF) {
        const parsed = JSON.parse(rawF);
        if (Array.isArray(parsed) && parsed.length > 0) rawFolders = parsed;
      }
      const rawW = localStorage.getItem(STORAGE_KEY_WORKFLOWS);
      if (rawW) {
        const parsed = JSON.parse(rawW);
        if (Array.isArray(parsed) && parsed.length > 0) rawWorkflows = parsed;
      }
    } catch (e) {
      console.warn('[ProjectStore] Failed to parse stored state:', e);
    }
  }

  const { folders, workflows, hasChanges } = reconcileFoldersAndWorkflows(
    rawFolders,
    rawWorkflows,
    lang,
  );

  if (hasChanges) {
    persistToLocalStorage(folders, workflows, workflows[0]?.id || null);
  }

  return { folders, workflows };
}

function persistToLocalStorage(
  folders: Folder[],
  workflows: SavedWorkflow[],
  activeId: string | null,
) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_FOLDERS, JSON.stringify(folders));
    localStorage.setItem(STORAGE_KEY_WORKFLOWS, JSON.stringify(workflows));
    if (activeId) {
      localStorage.setItem(STORAGE_KEY_ACTIVE, activeId);
    }
  } catch (e) {
    console.warn('[ProjectStore] Failed to save to localStorage:', e);
  }
}

function getActiveAdapter() {
  const settings = useSettingsStore.getState();
  return getStorageAdapter(settings.storageMode, settings.serverBaseUrl);
}

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

export function cancelAutoSaveTimer(): void {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
}

export function scheduleAutoSave(): void {
  cancelAutoSaveTimer();
  const debounceMs =
    useSettingsStore.getState().editorPreferences?.autoSaveDebounceMs ??
    RUNTIME_DEFAULTS.AUTOSAVE_DEBOUNCE_MS;
  autoSaveTimer = setTimeout(() => {
    useProjectStore.getState().autoSaveCurrentWorkflow();
  }, debounceMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Zustand Store Implementation
// ─────────────────────────────────────────────────────────────────────────────

export const useProjectStore = create<ProjectStoreState>()(
  immer((set, get) => {
    const initialLang = getInitialLanguage();
    const { folders: initialFolders, workflows: initialWorkflows } =
      loadInitialFoldersAndWorkflows(initialLang);
    const savedActiveId =
      typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_ACTIVE) : null;
    const initialActiveId =
      savedActiveId && initialWorkflows.some((w) => w.id === savedActiveId)
        ? savedActiveId
        : initialWorkflows[0]?.id || null;

    const initialSidebarOpen =
      typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_SIDEBAR) !== 'false' : true;

    return {
      folders: initialFolders,
      workflows: initialWorkflows,
      activeWorkflowId: initialActiveId,
      isSidebarOpen: initialSidebarOpen,
      searchQuery: '',
      isLoading: false,

      setSidebarOpen: (open) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_SIDEBAR, String(open));
        }
        set((state) => {
          state.isSidebarOpen = open;
        });
      },

      toggleSidebar: () => {
        const next = !get().isSidebarOpen;
        get().setSidebarOpen(next);
      },

      setSearchQuery: (query) => {
        set((state) => {
          state.searchQuery = query;
        });
      },

      createWorkflow: (name, folderId) => {
        const id = `wf-${nanoid(8)}`;
        const targetFolderId = folderId || get().folders[0]?.id || 'default';
        const workflowName = name?.trim() || `Workflow ${get().workflows.length + 1}`;
        const now = Date.now();

        const initialNodes: WorkflowNode[] = [
          {
            id: 'input_1',
            type: 'input',
            position: { x: 120, y: 180 },
            data: {
              label: 'Input Node',
              type: 'input',
              status: 'idle',
              inputs: { query: 'Hello PatchCat' },
              outputs: {},
              config: {},
            },
          },
          {
            id: 'llm_1',
            type: 'llm',
            position: { x: 420, y: 180 },
            data: {
              label: 'LLM Call',
              type: 'llm',
              status: 'idle',
              inputs: { prompt: '{{input_1.query}}' },
              outputs: {},
              config: { model: 'gpt-4o-mini', temperature: 0.7 },
            },
          },
          {
            id: 'output_1',
            type: 'output',
            position: { x: 720, y: 180 },
            data: {
              label: 'Output Node',
              type: 'output',
              status: 'idle',
              inputs: { result: '{{llm_1.response}}' },
              outputs: {},
              config: {},
            },
          },
        ];

        const initialEdges: WorkflowEdge[] = [
          {
            id: 'edge-input-llm',
            source: 'input_1',
            target: 'llm_1',
            sourceHandle: 'output',
            targetHandle: 'input',
            animated: false,
            style: { stroke: '#3B82F6', strokeWidth: 2 },
          },
          {
            id: 'edge-llm-output',
            source: 'llm_1',
            target: 'output_1',
            sourceHandle: 'output',
            targetHandle: 'input',
            animated: false,
            style: { stroke: '#3B82F6', strokeWidth: 2 },
          },
        ];

        const newWorkflow: SavedWorkflow = {
          id,
          name: workflowName,
          folderId: targetFolderId,
          nodes: initialNodes,
          edges: initialEdges,
          globalInputs: {},
          createdAt: now,
          updatedAt: now,
        };

        set((state) => {
          state.workflows.unshift(newWorkflow);
          state.activeWorkflowId = id;
        });

        const wfStore = useWorkflowStore.getState();
        wfStore.loadPreset({
          nodes: initialNodes,
          edges: initialEdges,
        });

        persistToLocalStorage(get().folders, get().workflows, id);

        // Async save to active storage adapter (e.g. FastAPI)
        const adapter = getActiveAdapter();
        adapter.createWorkflow(newWorkflow).catch((err) => {
          console.warn('[ProjectStore] Failed to save workflow to backend:', err);
        });

        return id;
      },

      loadWorkflow: async (id) => {
        const wf = get().workflows.find((w) => w.id === id);
        if (!wf) return;

        cancelAutoSaveTimer();

        // Auto-save currently active workflow only if not locked
        const currentActiveId = get().activeWorkflowId;
        if (currentActiveId && currentActiveId !== id) {
          const currentWf = get().workflows.find((w) => w.id === currentActiveId);
          if (currentWf && !currentWf.isLocked) {
            const currentNodes = useWorkflowStore.getState().nodes;
            const currentEdges = useWorkflowStore.getState().edges;
            const currentInputs = useWorkflowStore.getState().globalInputs;
            set((state) => {
              const existing = state.workflows.find((w) => w.id === currentActiveId);
              if (existing && !existing.isLocked) {
                existing.nodes = currentNodes;
                existing.edges = currentEdges;
                existing.globalInputs = currentInputs;
                existing.updatedAt = Date.now();
              }
            });
            getActiveAdapter()
              .saveWorkflow(currentActiveId, {
                nodes: currentNodes,
                edges: currentEdges,
                globalInputs: currentInputs,
              })
              .catch(() => {});
          }
        }

        set((state) => {
          state.activeWorkflowId = id;
        });

        // If nodes/edges are empty (lazy-loaded from server), fetch details from adapter
        let targetWorkflow = wf;
        if (!wf.nodes || wf.nodes.length === 0) {
          try {
            const fullWf = await getActiveAdapter().getWorkflow(id);
            if (fullWf && fullWf.nodes && fullWf.nodes.length > 0) {
              targetWorkflow = fullWf;
              set((state) => {
                const item = state.workflows.find((w) => w.id === id);
                if (item) {
                  item.nodes = fullWf.nodes;
                  item.edges = fullWf.edges;
                  item.globalInputs = fullWf.globalInputs;
                }
              });
            }
          } catch (e) {
            console.warn('[ProjectStore] Failed to fetch full workflow detail:', e);
          }
        }

        const wfStore = useWorkflowStore.getState();
        wfStore.loadPreset({
          nodes: targetWorkflow.nodes,
          edges: targetWorkflow.edges,
        });

        persistToLocalStorage(get().folders, get().workflows, id);
      },

      saveCurrentWorkflow: (id) => {
        const targetId = id || get().activeWorkflowId;
        if (!targetId) return;

        const targetWf = get().workflows.find((w) => w.id === targetId);
        if (!targetWf || targetWf.isLocked) return;

        const currentNodes = useWorkflowStore.getState().nodes;
        const currentEdges = useWorkflowStore.getState().edges;
        const currentInputs = useWorkflowStore.getState().globalInputs;

        set((state) => {
          const wf = state.workflows.find((w) => w.id === targetId);
          if (wf && !wf.isLocked) {
            wf.nodes = currentNodes;
            wf.edges = currentEdges;
            wf.globalInputs = currentInputs;
            wf.updatedAt = Date.now();
          }
        });

        persistToLocalStorage(get().folders, get().workflows, get().activeWorkflowId);

        getActiveAdapter()
          .saveWorkflow(targetId, {
            nodes: currentNodes,
            edges: currentEdges,
            globalInputs: currentInputs,
          })
          .catch((e) => {
            console.warn('[ProjectStore] Failed to sync saved workflow to backend:', e);
          });
      },

      autoSaveCurrentWorkflow: () => {
        const activeId = get().activeWorkflowId;
        if (!activeId) return;
        const currentWf = get().workflows.find((w) => w.id === activeId);
        if (!currentWf || currentWf.isLocked) return;

        get().saveCurrentWorkflow(activeId);
      },

      toggleWorkflowLock: (id) => {
        cancelAutoSaveTimer();
        let nextLocked = false;
        set((state) => {
          const wf = state.workflows.find((w) => w.id === id);
          if (wf) {
            wf.isLocked = !wf.isLocked;
            nextLocked = Boolean(wf.isLocked);
            wf.updatedAt = Date.now();
          }
        });

        persistToLocalStorage(get().folders, get().workflows, get().activeWorkflowId);

        getActiveAdapter()
          .saveWorkflow(id, { isLocked: nextLocked })
          .catch((e) => {
            console.warn('[ProjectStore] Failed to sync workflow lock state to backend:', e);
          });
      },

      setWorkflowLocked: (id, locked) => {
        cancelAutoSaveTimer();
        set((state) => {
          const wf = state.workflows.find((w) => w.id === id);
          if (wf) {
            wf.isLocked = locked;
            wf.updatedAt = Date.now();
          }
        });

        persistToLocalStorage(get().folders, get().workflows, get().activeWorkflowId);

        getActiveAdapter()
          .saveWorkflow(id, { isLocked: locked })
          .catch((e) => {
            console.warn('[ProjectStore] Failed to sync workflow lock state to backend:', e);
          });
      },

      renameWorkflow: (id, name) => {
        const cleanName = name.trim();
        if (!cleanName) return;

        set((state) => {
          const wf = state.workflows.find((w) => w.id === id);
          if (wf) {
            wf.name = cleanName;
            wf.updatedAt = Date.now();
          }
        });

        persistToLocalStorage(get().folders, get().workflows, get().activeWorkflowId);

        getActiveAdapter()
          .saveWorkflow(id, { name: cleanName })
          .catch((e) => {
            console.warn('[ProjectStore] Failed to rename workflow on backend:', e);
          });
      },

      updateWorkflow: (id, updates) => {
        set((state) => {
          const wf = state.workflows.find((w) => w.id === id);
          if (wf) {
            Object.assign(wf, updates);
            wf.updatedAt = Date.now();
          }
        });

        persistToLocalStorage(get().folders, get().workflows, get().activeWorkflowId);

        getActiveAdapter()
          .saveWorkflow(id, updates)
          .catch((e) => {
            console.warn('[ProjectStore] Failed to update workflow on backend:', e);
          });
      },

      duplicateWorkflow: (id) => {
        const source = get().workflows.find((w) => w.id === id);
        if (!source) return '';

        const newId = `wf-${nanoid(8)}`;
        const now = Date.now();
        const copy: SavedWorkflow = {
          ...source,
          id: newId,
          name: `${source.name} (Copy)`,
          createdAt: now,
          updatedAt: now,
          isPreset: false,
        };

        set((state) => {
          const idx = state.workflows.findIndex((w) => w.id === id);
          state.workflows.splice(idx + 1, 0, copy);
          state.activeWorkflowId = newId;
        });

        const wfStore = useWorkflowStore.getState();
        wfStore.loadPreset({
          nodes: copy.nodes,
          edges: copy.edges,
        });

        persistToLocalStorage(get().folders, get().workflows, newId);

        getActiveAdapter()
          .createWorkflow(copy)
          .catch((e) => {
            console.warn('[ProjectStore] Failed to duplicate workflow on backend:', e);
          });

        return newId;
      },

      deleteWorkflow: (id) => {
        const workflows = get().workflows;
        if (workflows.length <= 1) {
          get().createWorkflow('New Workflow');
        }

        set((state) => {
          state.workflows = state.workflows.filter((w) => w.id !== id);
          if (state.activeWorkflowId === id) {
            state.activeWorkflowId = state.workflows[0]?.id || null;
          }
        });

        const nextActive = get().activeWorkflowId;
        if (nextActive) {
          const nextWf = get().workflows.find((w) => w.id === nextActive);
          if (nextWf) {
            useWorkflowStore.getState().loadPreset({
              nodes: nextWf.nodes,
              edges: nextWf.edges,
            });
          }
        }

        persistToLocalStorage(get().folders, get().workflows, get().activeWorkflowId);

        getActiveAdapter()
          .deleteWorkflow(id)
          .catch((e) => {
            console.warn('[ProjectStore] Failed to delete workflow on backend:', e);
          });
      },

      moveWorkflow: (workflowId, targetFolderId) => {
        set((state) => {
          const wf = state.workflows.find((w) => w.id === workflowId);
          if (wf) {
            wf.folderId = targetFolderId;
            wf.updatedAt = Date.now();
          }
        });

        persistToLocalStorage(get().folders, get().workflows, get().activeWorkflowId);

        getActiveAdapter()
          .moveWorkflow(workflowId, targetFolderId)
          .catch((e) => {
            console.warn('[ProjectStore] Failed to move workflow on backend:', e);
          });
      },

      updateGlobalInputs: (workflowId, globalInputs) => {
        set((state) => {
          const wf = state.workflows.find((w) => w.id === workflowId);
          if (wf) {
            wf.globalInputs = globalInputs;
            wf.updatedAt = Date.now();
          }
        });

        persistToLocalStorage(get().folders, get().workflows, get().activeWorkflowId);

        getActiveAdapter()
          .saveWorkflow(workflowId, { globalInputs })
          .catch((e: unknown) => {
            console.warn('[ProjectStore] Failed to update global inputs on backend:', e);
          });
      },

      createFolder: (name) => {
        const cleanName = name.trim() || `Folder ${get().folders.length + 1}`;
        const id = `folder-${nanoid(6)}`;

        const newFolder: Folder = {
          id,
          name: cleanName,
          createdAt: Date.now(),
          isExpanded: true,
        };

        set((state) => {
          state.folders.push(newFolder);
        });

        persistToLocalStorage(get().folders, get().workflows, get().activeWorkflowId);

        getActiveAdapter()
          .createFolder(newFolder)
          .catch((err) => {
            console.warn('[ProjectStore] Failed to create folder on backend:', err);
          });

        return id;
      },

      renameFolder: (id, name) => {
        const cleanName = name.trim();
        if (!cleanName) return;

        set((state) => {
          const folder = state.folders.find((f) => f.id === id);
          if (folder) {
            folder.name = cleanName;
          }
        });

        persistToLocalStorage(get().folders, get().workflows, get().activeWorkflowId);

        getActiveAdapter()
          .updateFolder(id, { name: cleanName })
          .catch((e) => {
            console.warn('[ProjectStore] Failed to rename folder on backend:', e);
          });
      },

      deleteFolder: (id) => {
        const folders = get().folders;
        if (folders.length <= 1) return;

        const remainingFolderId = folders.find((f) => f.id !== id)?.id || 'default';

        set((state) => {
          state.folders = state.folders.filter((f) => f.id !== id);
          for (const wf of state.workflows) {
            if (wf.folderId === id) {
              wf.folderId = remainingFolderId;
            }
          }
        });

        persistToLocalStorage(get().folders, get().workflows, get().activeWorkflowId);

        getActiveAdapter()
          .deleteFolder(id)
          .catch((e) => {
            console.warn('[ProjectStore] Failed to delete folder on backend:', e);
          });
      },

      toggleFolder: (id) => {
        set((state) => {
          const folder = state.folders.find((f) => f.id === id);
          if (folder) {
            folder.isExpanded = !folder.isExpanded;
          }
        });

        persistToLocalStorage(get().folders, get().workflows, get().activeWorkflowId);
      },

      seedPresetsIfEmpty: (lang = getInitialLanguage()) => {
        const currentFolders = get().folders;
        const currentWorkflows = get().workflows;
        const { folders, workflows, hasChanges } = reconcileFoldersAndWorkflows(
          currentFolders,
          currentWorkflows,
          lang,
        );
        if (hasChanges || currentWorkflows.length === 0) {
          set((state) => {
            state.folders = folders;
            state.workflows = workflows;
            if (!state.activeWorkflowId || !workflows.some((w) => w.id === state.activeWorkflowId)) {
              state.activeWorkflowId = workflows[0]?.id || null;
            }
          });
          persistToLocalStorage(folders, workflows, get().activeWorkflowId);
        }
      },

      syncWithStorage: async () => {
        const adapter = getActiveAdapter();
        set((state) => {
          state.isLoading = true;
        });

        try {
          const [remoteFolders, remoteWorkflows] = await Promise.all([
            adapter.getFolders(),
            adapter.getWorkflows(),
          ]);

          // If server is connected but empty, initialize with default seed data
          if (remoteFolders.length === 0 && remoteWorkflows.length === 0) {
            const { folders: seedFolders, workflows: seedWorkflows } =
              loadInitialFoldersAndWorkflows();
            for (const f of seedFolders) {
              await adapter.createFolder(f).catch(() => {});
            }
            for (const w of seedWorkflows) {
              await adapter.createWorkflow(w).catch(() => {});
            }
            set((state) => {
              state.folders = seedFolders;
              state.workflows = seedWorkflows;
              state.activeWorkflowId = seedWorkflows[0]?.id || null;
              state.isLoading = false;
            });
            return;
          }

          const lang = useSettingsStore.getState().language || getInitialLanguage();
          const { folders: reconciledFolders, workflows: reconciledWorkflows } =
            reconcileFoldersAndWorkflows(remoteFolders, remoteWorkflows, lang);

          set((state) => {
            state.folders = reconciledFolders;
            state.workflows = reconciledWorkflows;
            state.activeWorkflowId = reconciledWorkflows[0]?.id || state.activeWorkflowId;
            state.isLoading = false;
          });

          // Load first workflow into canvas if activeWorkflowId changed
          const firstId = reconciledWorkflows[0]?.id;
          if (firstId) {
            const fullWf = await adapter.getWorkflow(firstId);
            if (fullWf && fullWf.nodes && fullWf.nodes.length > 0) {
              useWorkflowStore.getState().loadPreset({
                nodes: fullWf.nodes,
                edges: fullWf.edges,
              });
            }
          }
        } catch (e) {
          console.warn('[ProjectStore] syncWithStorage fallback to local:', e);
          set((state) => {
            state.isLoading = false;
          });
        }
      },

      clearAllWorkflows: async () => {
        const lang = useSettingsStore.getState().language || getInitialLanguage();
        const defaultFolderName = lang === 'zh' ? '默认目录' : 'Default';
        const defaultFolder: Folder = {
          id: 'default',
          name: defaultFolderName,
          createdAt: Date.now(),
          isExpanded: true,
          isPreset: true,
        };

        const presetsFolderName = lang === 'zh' ? '预设模版' : 'Preset Templates';
        const presetsFolder: Folder = {
          id: 'presets',
          name: presetsFolderName,
          createdAt: Date.now(),
          isExpanded: true,
          isPreset: true,
        };

        const initialWfId = `wf-${nanoid(8)}`;
        const initialWfName = lang === 'zh' ? '未命名流程' : 'Untitled Workflow';
        const initialWf: SavedWorkflow = {
          id: initialWfId,
          name: initialWfName,
          folderId: 'default',
          nodes: [],
          edges: [],
          globalInputs: {},
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isPreset: false,
        };

        const presets = PRESETS_DATA[lang] || PRESETS_DATA.en;
        const now = Date.now();
        const presetWorkflows: SavedWorkflow[] = OFFICIAL_PRESET_KEYS.map((key, index) => {
          const item = presets[key] || PRESETS_DATA.en[key] || PRESETS_DATA.zh[key];
          return {
            id: `wf-${key}`,
            name: item?.name || key,
            folderId: 'presets',
            nodes: item?.data?.nodes || [],
            edges: item?.data?.edges || [],
            globalInputs:
              (item?.data as unknown as { globalInputs?: Record<string, unknown> })?.globalInputs || {},
            createdAt: now - 3600000 * (index + 1),
            updatedAt: now - 3600000 * (index + 1),
            isPreset: true,
            isLocked: true,
          };
        });

        const newFolders = [defaultFolder, presetsFolder];
        const newWorkflows = [initialWf, ...presetWorkflows];

        set((state) => {
          state.folders = newFolders;
          state.workflows = newWorkflows;
          state.activeWorkflowId = initialWfId;
        });

        // Reset canvas
        const wfStore = useWorkflowStore.getState();
        wfStore.loadPreset({ nodes: [], edges: [] });
        wfStore.resetExecutionState();

        persistToLocalStorage(newFolders, newWorkflows, initialWfId);

        // Also clean up remote adapter if server mode is connected
        try {
          const adapter = getActiveAdapter();
          const remoteWfs = await adapter.getWorkflows();
          for (const w of remoteWfs) {
            await adapter.deleteWorkflow(w.id).catch(() => {});
          }
          for (const w of newWorkflows) {
            await adapter.createWorkflow(w).catch(() => {});
          }
        } catch (e: unknown) {
          console.warn('[ProjectStore] Failed to clear remote workflows:', e);
        }
      },
    };
  }),
);

// Defer subscriptions to microtask so all circular module dependencies are fully evaluated
if (typeof window !== 'undefined') {
  queueMicrotask(() => {
    // Subscribe to language changes so preset titles and folder names update automatically
    useSettingsStore.subscribe((state, prevState) => {
      if (state.language !== prevState.language) {
        useProjectStore.getState().seedPresetsIfEmpty(state.language);
        // If current active workflow is a preset, immediately reload localized nodes to canvas
        const activeId = useProjectStore.getState().activeWorkflowId;
        const activeWf = useProjectStore.getState().workflows.find((w) => w.id === activeId);
        if (activeWf && activeWf.isPreset) {
          useWorkflowStore.getState().loadPreset({
            nodes: activeWf.nodes,
            edges: activeWf.edges,
          });
        }
      }
    });

    // Auto-save subscription: monitor canvas changes and debounced-save if workflow is not locked
    let prevNodes = useWorkflowStore.getState().nodes;
    let prevEdges = useWorkflowStore.getState().edges;
    let prevInputs = useWorkflowStore.getState().globalInputs;

    useWorkflowStore.subscribe((state) => {
      if (
        state.nodes !== prevNodes ||
        state.edges !== prevEdges ||
        state.globalInputs !== prevInputs
      ) {
        prevNodes = state.nodes;
        prevEdges = state.edges;
        prevInputs = state.globalInputs;

        // Do not auto-save during execution
        if (state.isExecuting) return;

        const projectStore = useProjectStore.getState();
        const activeId = projectStore.activeWorkflowId;
        if (!activeId) return;
        const currentWf = projectStore.workflows.find((w) => w.id === activeId);
        if (!currentWf || currentWf.isLocked) return;

        scheduleAutoSave();
      }
    });
  });
}
