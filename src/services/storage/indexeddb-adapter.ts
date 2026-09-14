/**
 * @file    src/services/storage/indexeddb-adapter.ts
 * @version 1.0.0
 * @description
 *   High-capacity, asynchronous IndexedDB storage layer for PatchCat.
 *   Provides zero-dependency persistence for large workflow topologies,
 *   knowledge base documents, and embedding chunks without the 5MB LocalStorage limit.
 */

const DB_NAME = 'PatchCatDB';
const DB_VERSION = 1;

export const STORES = {
  WORKFLOWS: 'workflows',
  FOLDERS: 'folders',
  KB_BASES: 'kb_bases',
  KB_DOCS: 'kb_docs',
  KB_CHUNKS: 'kb_chunks',
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
}

export const indexedDb = new IndexedDbAdapter();
export { IndexedDbAdapter as IndexedDBAdapter };
