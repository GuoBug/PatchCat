/**
 * @file    src/services/storage/indexeddb-adapter.ts
 * @version 1.0.0
 * @description
 *   High-capacity, asynchronous IndexedDB storage layer for PatchCat.
 *   Provides zero-dependency persistence for large workflow topologies,
 *   knowledge base documents, and embedding chunks without the 5MB LocalStorage limit.
 */

import type { RunHistoryRecord } from '../../engine/types.ts';

const DB_NAME = 'PatchCatDB';
const DB_VERSION = 2;

export const STORES = {
  WORKFLOWS: 'workflows',
  FOLDERS: 'folders',
  KB_BASES: 'kb_bases',
  KB_DOCS: 'kb_docs',
  KB_CHUNKS: 'kb_chunks',
  RUN_HISTORY: 'run_history',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

export class IndexedDbAdapter {
  private dbPromise: Promise<IDBDatabase> | null = null;

  public isSupported(): boolean {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
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
        const db = await this.getDB();
        const tx = db.transaction(STORES.RUN_HISTORY, 'readwrite');
        const store = tx.objectStore(STORES.RUN_HISTORY);
        for (const r of toDelete) {
          store.delete(r.id);
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
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.RUN_HISTORY, 'readwrite');
      const store = tx.objectStore(STORES.RUN_HISTORY);
      for (const r of runs) {
        store.delete(r.id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const indexedDb = new IndexedDbAdapter();
export { IndexedDbAdapter as IndexedDBAdapter };
