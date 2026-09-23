/**
 * @file    src/services/storage/indexeddb-adapter.ts
 * @version 1.0.0
 * @description
 *   High-capacity, asynchronous IndexedDB storage layer for PatchCat.
 *   Provides zero-dependency persistence for large workflow topologies,
 *   knowledge base documents, and embedding chunks without the 5MB LocalStorage limit.
 */

import type { RunHistoryRecord, DAGCheckpoint } from '../../engine/types.ts';

const DB_NAME = 'PatchCatDB';
const DB_VERSION = 3;

export const STORES = {
  WORKFLOWS: 'workflows',
  FOLDERS: 'folders',
  KB_BASES: 'kb_bases',
  KB_DOCS: 'kb_docs',
  KB_CHUNKS: 'kb_chunks',
  RUN_HISTORY: 'run_history',
  CHECKPOINTS: 'checkpoints',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

export class IndexedDbAdapter {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private memoryFallback = new Map<string, Map<string, unknown>>();

  public isSupported(): boolean {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
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
   */
  public async saveCheckpoint(checkpoint: DAGCheckpoint, maxPerWorkflow = 5): Promise<void> {
    await this.put<DAGCheckpoint>(STORES.CHECKPOINTS, checkpoint);

    try {
      const allCheckpoints = await this.getCheckpointsForWorkflow(checkpoint.workflowId, 50);
      if (allCheckpoints.length > maxPerWorkflow) {
        const toDelete = allCheckpoints.slice(maxPerWorkflow);
        for (const c of toDelete) {
          await this.delete(STORES.CHECKPOINTS, c.id);
        }
      }
    } catch {
      // Non-blocking best-effort eviction
    }
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
