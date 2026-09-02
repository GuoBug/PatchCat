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
  renameWorkflow: (id: string, name: string) => void;
  duplicateWorkflow: (id: string) => string;
  deleteWorkflow: (id: string) => void;
  moveWorkflow: (workflowId: string, targetFolderId: string) => void;

  // Folder CRUD
  createFolder: (name: string) => string;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  toggleFolder: (id: string) => void;

  // Synchronization & Seed
  seedPresetsIfEmpty: (language?: 'en' | 'zh') => void;
  syncWithStorage: () => Promise<void>;
}

const STORAGE_KEY_FOLDERS = 'patchcat_folders_v2';
const STORAGE_KEY_WORKFLOWS = 'patchcat_workflows_v2';
const STORAGE_KEY_SIDEBAR = 'patchcat_sidebar_open_v2';
const STORAGE_KEY_ACTIVE = 'patchcat_active_workflow_v2';

// ─────────────────────────────────────────────────────────────────────────────
// 2. Storage Helpers
// ─────────────────────────────────────────────────────────────────────────────

function loadInitialFolders(lang: 'en' | 'zh' = 'en'): Folder[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_FOLDERS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch (e) {
    console.warn('[ProjectStore] Failed to parse stored folders:', e);
  }

  return [
    {
      id: 'default',
      name: lang === 'zh' ? '默认目录' : 'Default',
      createdAt: Date.now(),
      isExpanded: true,
      isPreset: true,
    },
    {
      id: 'presets',
      name: lang === 'zh' ? '官方预设库' : 'Official Presets',
      createdAt: Date.now(),
      isExpanded: true,
      isPreset: true,
    },
  ];
}

function loadInitialWorkflows(lang: 'en' | 'zh' = 'en'): SavedWorkflow[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_WORKFLOWS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch (e) {
    console.warn('[ProjectStore] Failed to parse stored workflows:', e);
  }

  const presets = PRESETS_DATA[lang] || PRESETS_DATA.en;
  const now = Date.now();

  const customerSupport = presets['customer-support'];
  const reportCritic = presets['report-critic'];
  const modelArena = presets['model-arena'];

  const initialList: SavedWorkflow[] = [];

  if (customerSupport) {
    initialList.push({
      id: 'wf-customer-support',
      name: customerSupport.name,
      folderId: 'default',
      nodes: customerSupport.data.nodes,
      edges: customerSupport.data.edges,
      globalInputs: (customerSupport.data as unknown as { globalInputs?: Record<string, unknown> }).globalInputs || {},
      createdAt: now - 3600000 * 5,
      updatedAt: now - 3600000 * 5,
      isPreset: true,
    });
  }

  if (reportCritic) {
    initialList.push({
      id: 'wf-report-critic',
      name: reportCritic.name,
      folderId: 'presets',
      nodes: reportCritic.data.nodes,
      edges: reportCritic.data.edges,
      globalInputs: (reportCritic.data as unknown as { globalInputs?: Record<string, unknown> }).globalInputs || {},
      createdAt: now - 86400000 * 2,
      updatedAt: now - 86400000 * 2,
      isPreset: true,
    });
  }

  if (modelArena) {
    initialList.push({
      id: 'wf-model-arena',
      name: modelArena.name,
      folderId: 'presets',
      nodes: modelArena.data.nodes,
      edges: modelArena.data.edges,
      globalInputs: (modelArena.data as unknown as { globalInputs?: Record<string, unknown> }).globalInputs || {},
      createdAt: now - 86400000 * 4,
      updatedAt: now - 86400000 * 4,
      isPreset: true,
    });
  }

  return initialList;
}

function persistToLocalStorage(folders: Folder[], workflows: SavedWorkflow[], activeId: string | null) {
  if (typeof window === 'undefined') return;
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

// ─────────────────────────────────────────────────────────────────────────────
// 3. Zustand Store Implementation
// ─────────────────────────────────────────────────────────────────────────────

export const useProjectStore = create<ProjectStoreState>()(
  immer((set, get) => {
    const initialFolders = loadInitialFolders();
    const initialWorkflows = loadInitialWorkflows();
    const savedActiveId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_ACTIVE) : null;
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

        // Auto-save currently active workflow
        const currentActiveId = get().activeWorkflowId;
        if (currentActiveId && currentActiveId !== id) {
          const currentNodes = useWorkflowStore.getState().nodes;
          const currentEdges = useWorkflowStore.getState().edges;
          set((state) => {
            const existing = state.workflows.find((w) => w.id === currentActiveId);
            if (existing) {
              existing.nodes = currentNodes;
              existing.edges = currentEdges;
              existing.updatedAt = Date.now();
            }
          });
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

        const currentNodes = useWorkflowStore.getState().nodes;
        const currentEdges = useWorkflowStore.getState().edges;
        const currentInputs = useWorkflowStore.getState().globalInputs;

        set((state) => {
          const wf = state.workflows.find((w) => w.id === targetId);
          if (wf) {
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

      seedPresetsIfEmpty: (lang = 'en') => {
        const currentWorkflows = get().workflows;
        if (currentWorkflows.length === 0) {
          const initialFolders = loadInitialFolders(lang);
          const initialWorkflows = loadInitialWorkflows(lang);
          set((state) => {
            state.folders = initialFolders;
            state.workflows = initialWorkflows;
            state.activeWorkflowId = initialWorkflows[0]?.id || null;
          });
          persistToLocalStorage(initialFolders, initialWorkflows, initialWorkflows[0]?.id || null);
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
            const seedFolders = loadInitialFolders();
            const seedWorkflows = loadInitialWorkflows();
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

          set((state) => {
            state.folders = remoteFolders;
            state.workflows = remoteWorkflows;
            state.activeWorkflowId = remoteWorkflows[0]?.id || state.activeWorkflowId;
            state.isLoading = false;
          });

          // Load first workflow into canvas if activeWorkflowId changed
          const firstId = remoteWorkflows[0]?.id;
          if (firstId) {
            const fullWf = await adapter.getWorkflow(firstId);
            if (fullWf && fullWf.nodes.length > 0) {
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
    };
  })
);
