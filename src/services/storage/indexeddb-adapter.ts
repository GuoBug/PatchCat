/**
 * @file    src/services/storage/indexeddb-adapter.ts
 * @version 1.1.0
 * @description
 *   High-capacity, asynchronous IndexedDB storage layer for PatchCat.
 *   Provides zero-dependency persistence for large workflow topologies,
 *   knowledge base documents, and embedding chunks without the 5MB LocalStorage limit.
 *   v0.4.11: Added Metadata-First catalog separation (workflows_meta vs workflows_payload)
 *   and strict atomic FIFO ring-buffer eviction for execution checkpoints.
 */

import type {
  RunHistoryRecord,
  DAGCheckpoint,
  WorkflowNode,
  WorkflowEdge,
} from '../../engine/types.ts';
import type { SavedWorkflow, WorkflowMemoryConfig } from '../../stores/project-store.ts';

const DB_NAME = 'PatchCatDB';
const DB_VERSION = 4;

export const STORES = {
  WORKFLOWS: 'workflows', // Legacy monolithic store preserved for backward compatibility
  WORKFLOWS_META: 'workflows_meta', // v0.4.11: Lightweight catalog metadata (<5ms cold start)
  WORKFLOWS_PAYLOAD: 'workflows_payload', // v0.4.11: Heavy topology graph & configs (lazy loaded)
  FOLDERS: 'folders',
  KB_BASES: 'kb_bases',
  KB_DOCS: 'kb_docs',
  KB_CHUNKS: 'kb_chunks',
  RUN_HISTORY: 'run_history',
  CHECKPOINTS: 'checkpoints',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

/**
 * Lightweight workflow catalog metadata stored in `workflows_meta`.
 * Allows high-speed sidebar rendering without parsing heavy nodes/edges.
 */
export interface WorkflowMetadata {
  id: string;
  name: string;
  folderId: string;
  description?: string;
  tags?: string[];
  nodeCount: number;
  createdAt: number;
  updatedAt: number;
  isPreset?: boolean;
  isLocked?: boolean;
  api_enabled?: boolean;
  api_key?: string;
  version?: number;
}

/**
 * Heavy workflow topology graph stored in `workflows_payload`.
 * Lazy-loaded only when the user opens or executes the workflow.
 */
export interface WorkflowPayload {
  id: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  globalInputs: Record<string, unknown>;
  memoryConfig?: WorkflowMemoryConfig;
  viewport?: { x: number; y: number; zoom: number };
}

export class IndexedDbAdapter {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryFallback = new Map<string, Map<string, unknown>>();

  // Telemetry & audit counters for testing zero disk writes during streaming
  private writeCounts = {
    put: 0,
    delete: 0,
    clear: 0,
  };

  public isSupported(): boolean {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
  }

  /**
   * Returns total write operations (put + delete + clear) performed by the adapter.
   */
  public getWriteCount(): number {
    return this.writeCounts.put + this.writeCounts.delete + this.writeCounts.clear;
  }

  /**
   * Resets write audit counter.
   */
  public resetWriteCount(): void {
    this.writeCounts = { put: 0, delete: 0, clear: 0 };
  }

  private getMemoryStore(storeName: string): Map<string, unknown> {
    let store = this.memoryFallback.get(storeName);
    if (!store) {
      store = new Map<string, unknown>();
      this.memoryFallback.set(storeName, store);
    }
    return store;
  }

  private async getDB(): Promise<IDBDatabase> {
    if (!this.isSupported()) {
      throw new Error('IndexedDB is not supported in the current environment.');
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORES.WORKFLOWS)) {
          db.createObjectStore(STORES.WORKFLOWS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.WORKFLOWS_META)) {
          const metaStore = db.createObjectStore(STORES.WORKFLOWS_META, { keyPath: 'id' });
          metaStore.createIndex('folderId', 'folderId', { unique: false });
          metaStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.WORKFLOWS_PAYLOAD)) {
          db.createObjectStore(STORES.WORKFLOWS_PAYLOAD, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.FOLDERS)) {
          db.createObjectStore(STORES.FOLDERS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.KB_BASES)) {
          db.createObjectStore(STORES.KB_BASES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.KB_DOCS)) {
          const docStore = db.createObjectStore(STORES.KB_DOCS, { keyPath: 'id' });
          docStore.createIndex('kb_id', 'kb_id', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.KB_CHUNKS)) {
          const chunkStore = db.createObjectStore(STORES.KB_CHUNKS, { keyPath: 'id' });
          chunkStore.createIndex('kb_id', 'kb_id', { unique: false });
          chunkStore.createIndex('doc_id', 'doc_id', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.RUN_HISTORY)) {
          const runStore = db.createObjectStore(STORES.RUN_HISTORY, { keyPath: 'id' });
          runStore.createIndex('workflowId', 'workflowId', { unique: false });
          runStore.createIndex('startedAt', 'startedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.CHECKPOINTS)) {
          const chkStore = db.createObjectStore(STORES.CHECKPOINTS, { keyPath: 'id' });
          chkStore.createIndex('workflowId', 'workflowId', { unique: false });
          chkStore.createIndex('timestamp', 'timestamp', { unique: false });
          chkStore.createIndex('checkpointId', 'checkpointId', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        this.dbPromise = null;
        reject(new Error(`Failed to open IndexedDB "${DB_NAME}": ${request.error?.message}`));
      };
    });

    return this.dbPromise;
  }

  public async get<T>(storeName: StoreName, key: string): Promise<T | null> {
    if (!this.isSupported()) {
      const store = this.getMemoryStore(storeName);
      return (store.get(key) as T) ?? null;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);

      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  public async getAll<T>(storeName: StoreName): Promise<T[]> {
    if (!this.isSupported()) {
      const store = this.getMemoryStore(storeName);
      return Array.from(store.values()) as T[];
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();

      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => reject(req.error);
    });
  }

  public async put<T>(storeName: StoreName, value: T): Promise<void> {
    this.writeCounts.put++;
    if (!this.isSupported()) {
      const store = this.getMemoryStore(storeName);
      const key =
        (value as { id?: string; key?: string })?.id ||
        (value as { id?: string; key?: string })?.key ||
        String(Date.now());
      store.set(key, value);
      return;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async delete(storeName: StoreName, key: string): Promise<void> {
    this.writeCounts.delete++;
    if (!this.isSupported()) {
      const store = this.getMemoryStore(storeName);
      store.delete(key);
      return;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async clear(storeName: StoreName): Promise<void> {
    this.writeCounts.clear++;
    if (!this.isSupported()) {
      const store = this.getMemoryStore(storeName);
      store.clear();
      return;
    }
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ── Metadata-First Workflow Catalog API (Phase 4.11 / v0.4.11) ───────────

  /**
   * Saves both workflow metadata and topology payload.
   * Uses an atomic multi-store readwrite transaction in browser IndexedDB,
   * or synchronous atomic Map writes in memory fallback.
   */
  public async saveWorkflowMetaAndPayload(
    meta: WorkflowMetadata,
    payload: WorkflowPayload,
  ): Promise<void> {
    if (!this.isSupported()) {
      const metaStore = this.getMemoryStore(STORES.WORKFLOWS_META);
      const payloadStore = this.getMemoryStore(STORES.WORKFLOWS_PAYLOAD);
      metaStore.set(meta.id, meta);
      payloadStore.set(payload.id, payload);
      this.writeCounts.put += 2;
      return;
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.WORKFLOWS_META, STORES.WORKFLOWS_PAYLOAD], 'readwrite');
      const metaStore = tx.objectStore(STORES.WORKFLOWS_META);
      const payloadStore = tx.objectStore(STORES.WORKFLOWS_PAYLOAD);

      metaStore.put(meta);
      payloadStore.put(payload);
      this.writeCounts.put += 2;

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Retrieves lightweight metadata for a single workflow.
   */
  public async getWorkflowMeta(id: string): Promise<WorkflowMetadata | null> {
    return this.get<WorkflowMetadata>(STORES.WORKFLOWS_META, id);
  }

  /**
   * Retrieves lightweight metadata for all workflows, optionally filtered by folderId.
   * Sorted by updatedAt descending.
   */
  public async getAllWorkflowMetas(folderId?: string): Promise<WorkflowMetadata[]> {
    const all = await this.getAll<WorkflowMetadata>(STORES.WORKFLOWS_META);
    let filtered = all;
    if (folderId) {
      filtered = filtered.filter((m) => m.folderId === folderId);
    }
    return filtered.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Retrieves only the heavy topology payload (nodes, edges, inputs) for a workflow.
   */
  public async getWorkflowPayload(id: string): Promise<WorkflowPayload | null> {
    return this.get<WorkflowPayload>(STORES.WORKFLOWS_PAYLOAD, id);
  }

  /**
   * Reconstitutes a complete SavedWorkflow by joining metadata and topology payload.
   */
  public async getCompleteWorkflow(id: string): Promise<SavedWorkflow | null> {
    const meta = await this.getWorkflowMeta(id);
    if (!meta) return null;

    const payload = await this.getWorkflowPayload(id);
    return {
      id: meta.id,
      name: meta.name,
      folderId: meta.folderId,
      nodes: payload?.nodes || [],
      edges: payload?.edges || [],
      globalInputs: payload?.globalInputs || {},
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      isPreset: meta.isPreset,
      isLocked: meta.isLocked,
      api_enabled: meta.api_enabled,
      api_key: meta.api_key,
      memoryConfig: payload?.memoryConfig,
      nodeCount: meta.nodeCount,
      description: meta.description,
      tags: meta.tags,
    };
  }

  /**
   * Atomically deletes both metadata and payload for a workflow.
   */
  public async deleteWorkflowFromDb(id: string): Promise<void> {
    if (!this.isSupported()) {
      const metaStore = this.getMemoryStore(STORES.WORKFLOWS_META);
      const payloadStore = this.getMemoryStore(STORES.WORKFLOWS_PAYLOAD);
      metaStore.delete(id);
      payloadStore.delete(id);
      this.writeCounts.delete += 2;
      return;
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORES.WORKFLOWS_META, STORES.WORKFLOWS_PAYLOAD], 'readwrite');
      tx.objectStore(STORES.WORKFLOWS_META).delete(id);
      tx.objectStore(STORES.WORKFLOWS_PAYLOAD).delete(id);
      this.writeCounts.delete += 2;

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ── Run History & Observability API (Phase 4.8 / v0.4.8) ─────────────────

  /**
   * Saves an execution run record with FIFO ring-buffer eviction.
   * Keeps at most `maxPerWorkflow` (default 10) records per workflow.
   */
  public async saveRunRecord(record: RunHistoryRecord, maxPerWorkflow = 10): Promise<void> {
    await this.put<RunHistoryRecord>(STORES.RUN_HISTORY, record);

    // Evict oldest records exceeding maxPerWorkflow
    try {
      const allRuns = await this.getRecentRuns(record.workflowId, 50);
      if (allRuns.length > maxPerWorkflow) {
        const toDelete = allRuns.slice(maxPerWorkflow);
        for (const r of toDelete) {
          await this.delete(STORES.RUN_HISTORY, r.id);
        }
      }
    } catch {
      // Non-blocking best-effort eviction
    }
  }

  /**
   * Retrieves the most recent execution records for a workflow, sorted by startedAt descending.
   */
  public async getRecentRuns(workflowId: string, limit = 10): Promise<RunHistoryRecord[]> {
    const all = await this.getAll<RunHistoryRecord>(STORES.RUN_HISTORY);
    return all
      .filter((r) => r.workflowId === workflowId)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  }

  /**
   * Deletes a specific run history record by ID.
   */
  public async deleteRunRecord(id: string): Promise<void> {
    return this.delete(STORES.RUN_HISTORY, id);
  }

  /**
   * Clears all run history records for a given workflow.
   */
  public async clearRunsForWorkflow(workflowId: string): Promise<void> {
    const runs = await this.getRecentRuns(workflowId, 100);
    for (const r of runs) {
      await this.delete(STORES.RUN_HISTORY, r.id);
    }
  }

  // ── DAG Checkpointing & Resumption API (Phase 4.10 / v0.4.10) ────────────

  /**
   * Saves an immutable DAG execution checkpoint with strict FIFO ring-buffer eviction.
   * Retains at most `maxPerWorkflow` (default 5) checkpoints per workflow to guard browser storage quotas.
   * Atomically prunes excess records immediately.
   */
  public async saveCheckpoint(checkpoint: DAGCheckpoint, maxPerWorkflow = 5): Promise<void> {
    if (!this.isSupported()) {
      const store = this.getMemoryStore(STORES.CHECKPOINTS);
      this.writeCounts.put++;
      store.set(checkpoint.id, checkpoint);

      // In-memory atomic FIFO ring-buffer eviction
      const wfCheckpoints: DAGCheckpoint[] = [];
      for (const item of store.values()) {
        const cp = item as DAGCheckpoint;
        if (cp.workflowId === checkpoint.workflowId) {
          wfCheckpoints.push(cp);
        }
      }

      if (wfCheckpoints.length > maxPerWorkflow) {
        wfCheckpoints.sort((a, b) => {
          if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
          if (b.isCompleted !== a.isCompleted) return b.isCompleted ? 1 : -1;
          return b.currentWaveIndex - a.currentWaveIndex;
        });
        const toDelete = wfCheckpoints.slice(maxPerWorkflow);
        for (const c of toDelete) {
          store.delete(c.id);
          this.writeCounts.delete++;
        }
      }
      return;
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.CHECKPOINTS, 'readwrite');
      const store = tx.objectStore(STORES.CHECKPOINTS);

      // 1. Put the new checkpoint
      store.put(checkpoint);
      this.writeCounts.put++;

      // 2. Query all checkpoints for this workflow using index
      const index = store.index('workflowId');
      const req = index.getAll(checkpoint.workflowId);

      req.onsuccess = () => {
        const records = (req.result as DAGCheckpoint[]) || [];
        if (records.length > maxPerWorkflow) {
          records.sort((a, b) => {
            if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
            if (b.isCompleted !== a.isCompleted) return b.isCompleted ? 1 : -1;
            return b.currentWaveIndex - a.currentWaveIndex;
          });
          const toDelete = records.slice(maxPerWorkflow);
          for (const item of toDelete) {
            store.delete(item.id);
            this.writeCounts.delete++;
          }
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Explicitly evicts older checkpoints for a workflow, ensuring no more than `maxLimit` remain.
   * Returns the count of deleted records.
   */
  public async evictCheckpoints(workflowId: string, maxLimit = 5): Promise<number> {
    const list = await this.getCheckpointsForWorkflow(workflowId, 100);
    if (list.length <= maxLimit) return 0;

    const toDelete = list.slice(maxLimit);
    for (const c of toDelete) {
      await this.delete(STORES.CHECKPOINTS, c.id);
    }
    return toDelete.length;
  }

  /**
   * Retrieves the latest checkpoint for a workflow, sorted by timestamp descending.
   */
  public async getLatestCheckpoint(workflowId: string): Promise<DAGCheckpoint | null> {
    const list = await this.getCheckpointsForWorkflow(workflowId, 1);
    return list.length > 0 && list[0] ? list[0] : null;
  }

  /**
   * Retrieves a specific checkpoint by its checkpointId or id.
   */
  public async getCheckpointById(checkpointId: string): Promise<DAGCheckpoint | null> {
    const all = await this.getAll<DAGCheckpoint>(STORES.CHECKPOINTS);
    return all.find((c) => c.checkpointId === checkpointId || c.id === checkpointId) ?? null;
  }

  /**
   * Retrieves all checkpoints for a workflow, ordered newest to oldest.
   */
  public async getCheckpointsForWorkflow(workflowId: string, limit = 5): Promise<DAGCheckpoint[]> {
    const all = await this.getAll<DAGCheckpoint>(STORES.CHECKPOINTS);
    return all
      .filter((c) => c.workflowId === workflowId)
      .sort((a, b) => {
        if (b.timestamp !== a.timestamp) {
          return b.timestamp - a.timestamp;
        }
        if (b.isCompleted !== a.isCompleted) {
          return b.isCompleted ? 1 : -1;
        }
        return b.currentWaveIndex - a.currentWaveIndex;
      })
      .slice(0, limit);
  }

  /**
   * Deletes a specific checkpoint by its ID.
   */
  public async deleteCheckpoint(id: string): Promise<void> {
    return this.delete(STORES.CHECKPOINTS, id);
  }

  /**
   * Clears all checkpoints for a given workflow.
   */
  public async clearCheckpointsForWorkflow(workflowId: string): Promise<void> {
    const checkpoints = await this.getCheckpointsForWorkflow(workflowId, 100);
    for (const c of checkpoints) {
      await this.delete(STORES.CHECKPOINTS, c.id);
    }
  }
}

export const indexedDb = new IndexedDbAdapter();
export { IndexedDbAdapter as IndexedDBAdapter };
