import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useProjectStore } from '../src/stores/project-store.ts';
import { useWorkflowStore } from '../src/stores/workflow-store.ts';

// Mock localStorage for node environment
const storageMock: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => storageMock[key] ?? null,
  setItem: (key: string, val: string) => {
    storageMock[key] = val;
  },
  removeItem: (key: string) => {
    delete storageMock[key];
  },
  clear: () => {
    for (const k of Object.keys(storageMock)) {
      delete storageMock[k];
    }
  },
  length: 0,
  key: () => null,
};

describe('Project & Workflow Folder Management Store', () => {
  beforeEach(() => {
    localStorage.clear();
    const store = useProjectStore.getState();
    store.seedPresetsIfEmpty('en');
  });

  it('should initialize with default folders and seeded workflows', () => {
    const store = useProjectStore.getState();
    assert.ok(store.folders.length >= 2);
    assert.ok(store.workflows.length >= 1);
    assert.ok(store.activeWorkflowId);
    assert.equal(store.isSidebarOpen, true);
  });

  it('should create a new workflow and set it as active', () => {
    const store = useProjectStore.getState();
    const initialCount = store.workflows.length;

    const newId = store.createWorkflow('My Custom Pipeline', 'default');
    const updated = useProjectStore.getState();

    assert.equal(updated.workflows.length, initialCount + 1);
    assert.equal(updated.activeWorkflowId, newId);

    const created = updated.workflows.find((w) => w.id === newId);
    assert.ok(created);
    assert.equal(created.name, 'My Custom Pipeline');
    assert.equal(created.folderId, 'default');
    assert.ok(created.nodes.length > 0);

    // Verify canvas store is synced with newly created workflow
    const canvasNodes = useWorkflowStore.getState().nodes;
    assert.equal(canvasNodes.length, created.nodes.length);
  });

  it('should rename a workflow', () => {
    const store = useProjectStore.getState();
    const wfId = store.workflows[0]!.id;

    store.renameWorkflow(wfId, 'Renamed Pipeline');
    const updated = useProjectStore.getState().workflows.find((w) => w.id === wfId);
    assert.equal(updated?.name, 'Renamed Pipeline');
  });

  it('should duplicate a workflow', () => {
    const store = useProjectStore.getState();
    const source = store.workflows[0]!;
    const initialCount = store.workflows.length;

    const dupId = store.duplicateWorkflow(source.id);
    const updated = useProjectStore.getState();

    assert.equal(updated.workflows.length, initialCount + 1);
    assert.equal(updated.activeWorkflowId, dupId);

    const dup = updated.workflows.find((w) => w.id === dupId);
    assert.ok(dup);
    assert.equal(dup.name, `${source.name} (Copy)`);
    assert.equal(dup.folderId, source.folderId);
  });

  it('should move a workflow to another folder', () => {
    const store = useProjectStore.getState();
    const wf = store.workflows[0]!;

    store.moveWorkflow(wf.id, 'presets');
    const updated = useProjectStore.getState().workflows.find((w) => w.id === wf.id);
    assert.equal(updated?.folderId, 'presets');
  });

  it('should delete a workflow and switch to next available', () => {
    const store = useProjectStore.getState();
    const wf1 = store.createWorkflow('Workflow 1');
    const wf2 = store.createWorkflow('Workflow 2');

    assert.equal(useProjectStore.getState().activeWorkflowId, wf2);

    store.deleteWorkflow(wf2);
    const updated = useProjectStore.getState();

    assert.ok(!updated.workflows.some((w) => w.id === wf2));
    assert.ok(updated.activeWorkflowId);
    assert.notEqual(updated.activeWorkflowId, wf2);
  });

  it('should create, rename, toggle, and delete custom folders', () => {
    const store = useProjectStore.getState();
    const initialFolderCount = store.folders.length;

    // Create
    const folderId = store.createFolder('AI Agents');
    let state = useProjectStore.getState();
    assert.equal(state.folders.length, initialFolderCount + 1);

    const folder = state.folders.find((f) => f.id === folderId);
    assert.ok(folder);
    assert.equal(folder.name, 'AI Agents');
    assert.equal(folder.isExpanded, true);

    // Rename
    store.renameFolder(folderId, 'Autonomous Agents');
    state = useProjectStore.getState();
    assert.equal(state.folders.find((f) => f.id === folderId)?.name, 'Autonomous Agents');

    // Toggle
    store.toggleFolder(folderId);
    state = useProjectStore.getState();
    assert.equal(state.folders.find((f) => f.id === folderId)?.isExpanded, false);

    // Delete
    store.deleteFolder(folderId);
    state = useProjectStore.getState();
    assert.equal(state.folders.length, initialFolderCount);
    assert.ok(!state.folders.some((f) => f.id === folderId));
  });

  it('should toggle sidebar and update search query', () => {
    const store = useProjectStore.getState();
    assert.equal(store.isSidebarOpen, true);

    store.toggleSidebar();
    assert.equal(useProjectStore.getState().isSidebarOpen, false);

    store.setSidebarOpen(true);
    assert.equal(useProjectStore.getState().isSidebarOpen, true);

    store.setSearchQuery('customer');
    assert.equal(useProjectStore.getState().searchQuery, 'customer');
  });
});
