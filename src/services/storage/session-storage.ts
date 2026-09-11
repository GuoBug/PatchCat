/**
 * @file    src/services/storage/session-storage.ts
 * @version 1.0.0
 * @description
 *   Robust, asynchronous session message storage adapter using browser IndexedDB
 *   with fallback to in-memory/localStorage for Node.js test environments.
 *   Provides scoped multi-turn conversation persistence per workflow.
 */

export interface MemoryMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    nodeId?: string;
    tokenCount?: number;
    rawInputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    durationMs?: number;
    error?: string;
    trace?: unknown[];
    tokenUsage?: { prompt: number; completion: number; total: number };
    [key: string]: unknown;
  };
}

export interface ISessionStorageAdapter {
  getSessionMessages(workflowId: string, sessionId?: string): Promise<MemoryMessage[]>;
  saveSessionMessages(
    workflowId: string,
    messages: MemoryMessage[],
    sessionId?: string,
  ): Promise<void>;
  appendSessionMessage(
    workflowId: string,
    message: MemoryMessage,
    sessionId?: string,
  ): Promise<void>;
  clearSessionMessages(workflowId: string, sessionId?: string): Promise<void>;
}

const DB_NAME = 'patchcat_chat_db';
const DB_VERSION = 1;
const STORE_NAME = 'chat_sessions';

/**
 * IndexedDB-backed asynchronous storage for chat history.
 * Solves the 5MB quota limit and tab-closure data loss of sessionStorage.
 */
export class IndexedDBSessionAdapter implements ISessionStorageAdapter {
  private memoryFallback = new Map<string, MemoryMessage[]>();
  private dbPromise: Promise<IDBDatabase> | null = null;

  private isIndexedDBAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.indexedDB !== 'undefined' &&
      window.indexedDB !== null
    );
  }

  private getDB(): Promise<IDBDatabase> {
    if (!this.isIndexedDBAvailable()) {
      return Promise.reject(new Error('IndexedDB is not available in current environment.'));
    }

    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        try {
          const request = window.indexedDB.open(DB_NAME, DB_VERSION);

          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
              db.createObjectStore(STORE_NAME, { keyPath: 'sessionKey' });
            }
          };

          request.onsuccess = () => {
            resolve(request.result);
          };

          request.onerror = () => {
            reject(request.error || new Error('Failed to open IndexedDB'));
          };
        } catch (err) {
          reject(err);
        }
      });
    }

    return this.dbPromise;
  }

  private buildKey(workflowId: string, sessionId = 'default'): string {
    return `${workflowId}::${sessionId}`;
  }

  async getSessionMessages(workflowId: string, sessionId = 'default'): Promise<MemoryMessage[]> {
    const key = this.buildKey(workflowId, sessionId);

    if (!this.isIndexedDBAvailable()) {
      // Try reading from localStorage fallback
      if (typeof localStorage !== 'undefined') {
        try {
          const raw = localStorage.getItem(`pc_chat_${key}`);
          if (raw) return JSON.parse(raw);
        } catch {
          // ignore
        }
      }
      return this.memoryFallback.get(key) || [];
    }

    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);

        req.onsuccess = () => {
          if (req.result && Array.isArray(req.result.messages)) {
            resolve(req.result.messages);
          } else {
            resolve([]);
          }
        };

        req.onerror = () => {
          resolve(this.memoryFallback.get(key) || []);
        };
      });
    } catch {
      return this.memoryFallback.get(key) || [];
    }
  }

  async saveSessionMessages(
    workflowId: string,
    messages: MemoryMessage[],
    sessionId = 'default',
  ): Promise<void> {
    const key = this.buildKey(workflowId, sessionId);
    this.memoryFallback.set(key, messages);

    if (!this.isIndexedDBAvailable()) {
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(`pc_chat_${key}`, JSON.stringify(messages));
        } catch {
          // ignore quota error
        }
      }
      return;
    }

    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({ sessionKey: key, messages, updatedAt: Date.now() });

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error || new Error('Failed to save messages to IndexedDB'));
      });
    } catch (e) {
      // Fallback to memory
      console.warn('[IndexedDBSessionAdapter] Fallback to in-memory on error:', e);
    }
  }

  async appendSessionMessage(
    workflowId: string,
    message: MemoryMessage,
    sessionId = 'default',
  ): Promise<void> {
    const current = await this.getSessionMessages(workflowId, sessionId);
    await this.saveSessionMessages(workflowId, [...current, message], sessionId);
  }

  async clearSessionMessages(workflowId: string, sessionId = 'default'): Promise<void> {
    const key = this.buildKey(workflowId, sessionId);
    this.memoryFallback.delete(key);

    if (!this.isIndexedDBAvailable()) {
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem(`pc_chat_${key}`);
        } catch {
          // ignore
        }
      }
      return;
    }

    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error || new Error('Failed to delete session from IndexedDB'));
      });
    } catch (e) {
      console.warn('[IndexedDBSessionAdapter] Error clearing session:', e);
    }
  }
}

/**
 * Singleton instance of session storage adapter.
 */
export const sessionStorageAdapter = new IndexedDBSessionAdapter();

export interface MemoryPruningOptions {
  maxHistoryRounds?: number;
  maxTokenBudget?: number;
  pruningStrategy?: 'window' | 'token_budget' | 'hybrid' | 'none';
}

/**
 * Estimates token count from content string (average ~4 chars per token).
 */
export function estimateMessageTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Pure strategy function to prune conversation messages based on window and token budget.
 */
export function pruneConversationMessages(
  messages: MemoryMessage[],
  options: MemoryPruningOptions = {},
): MemoryMessage[] {
  if (!messages || messages.length === 0) return [];

  const maxRounds = options.maxHistoryRounds ?? 5;
  const maxBudget = options.maxTokenBudget ?? 3000;
  const strategy = options.pruningStrategy ?? 'hybrid';

  let filtered = [...messages];

  // 1. Sliding Window (Round-based)
  if (strategy === 'window' || strategy === 'hybrid') {
    const maxMessages = Math.max(1, maxRounds * 2);
    if (filtered.length > maxMessages) {
      filtered = filtered.slice(filtered.length - maxMessages);
    }
  }

  // 2. Token Budget Pruning (from newest to oldest)
  if (strategy === 'token_budget' || strategy === 'hybrid') {
    const result: MemoryMessage[] = [];
    let currentTokens = 0;

    for (let i = filtered.length - 1; i >= 0; i--) {
      const msg = filtered[i];
      if (!msg) continue;
      const msgTokens = msg.metadata?.tokenCount ?? estimateMessageTokens(msg.content);

      if (currentTokens + msgTokens > maxBudget && result.length > 0) {
        break; // Stop taking older messages when budget exceeded
      }

      result.unshift(msg);
      currentTokens += msgTokens;
    }

    filtered = result;
  }

  return filtered;
}

/**
 * Formats memory messages into a readable text block for Prompt insertion.
 */
export function formatMessagesToPlainText(messages: MemoryMessage[]): string {
  if (!messages || messages.length === 0) return '';
  return messages
    .map((m) => {
      const sender = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'System';
      return `${sender}: ${m.content}`;
    })
    .join('\n');
}

