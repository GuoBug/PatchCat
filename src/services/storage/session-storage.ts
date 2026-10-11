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
  isPinned?: boolean;
  isEdited?: boolean;
  originalContent?: string;
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

export interface SessionSummary {
  text: string;
  lastSummarizedMessageId: string;
  summarizedCount: number;
  tokenCount: number;
  updatedAt: number;
}

export interface SessionData {
  sessionKey: string;
  messages: MemoryMessage[];
  summary?: SessionSummary;
  updatedAt: number;
}

export interface ISessionStorageAdapter {
  getSessionMessages(workflowId: string, sessionId?: string): Promise<MemoryMessage[]>;
  getSessionData(workflowId: string, sessionId?: string): Promise<SessionData>;
  saveSessionMessages(
    workflowId: string,
    messages: MemoryMessage[],
    sessionId?: string,
  ): Promise<void>;
  saveSessionSummary(
    workflowId: string,
    summary: SessionSummary | undefined,
    sessionId?: string,
  ): Promise<void>;
  updateSessionMessage(
    workflowId: string,
    messageId: string,
    updates: Partial<MemoryMessage>,
    sessionId?: string,
  ): Promise<void>;
  deleteSessionMessage(
    workflowId: string,
    messageId: string,
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
  private memoryFallback = new Map<string, SessionData>();
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

  async getSessionData(workflowId: string, sessionId = 'default'): Promise<SessionData> {
    const key = this.buildKey(workflowId, sessionId);

    if (!this.isIndexedDBAvailable()) {
      if (typeof localStorage !== 'undefined') {
        try {
          const raw = localStorage.getItem(`pc_chat_${key}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              return { sessionKey: key, messages: parsed, updatedAt: Date.now() };
            }
            if (parsed && Array.isArray(parsed.messages)) {
              return {
                sessionKey: key,
                messages: parsed.messages,
                summary: parsed.summary,
                updatedAt: parsed.updatedAt || Date.now(),
              };
            }
          }
        } catch {
          // ignore
        }
      }
      return this.memoryFallback.get(key) || { sessionKey: key, messages: [], updatedAt: Date.now() };
    }

    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);

        req.onsuccess = () => {
          if (req.result) {
            if (Array.isArray(req.result.messages)) {
              resolve({
                sessionKey: key,
                messages: req.result.messages,
                summary: req.result.summary,
                updatedAt: req.result.updatedAt || Date.now(),
              });
              return;
            }
            if (Array.isArray(req.result)) {
              resolve({ sessionKey: key, messages: req.result, updatedAt: Date.now() });
              return;
            }
          }
          resolve(this.memoryFallback.get(key) || { sessionKey: key, messages: [], updatedAt: Date.now() });
        };

        req.onerror = () => {
          resolve(this.memoryFallback.get(key) || { sessionKey: key, messages: [], updatedAt: Date.now() });
        };
      });
    } catch {
      return this.memoryFallback.get(key) || { sessionKey: key, messages: [], updatedAt: Date.now() };
    }
  }

  async getSessionMessages(workflowId: string, sessionId = 'default'): Promise<MemoryMessage[]> {
    const data = await this.getSessionData(workflowId, sessionId);
    return data.messages;
  }

  async saveSessionMessages(
    workflowId: string,
    messages: MemoryMessage[],
    sessionId = 'default',
  ): Promise<void> {
    const key = this.buildKey(workflowId, sessionId);
    const existing = await this.getSessionData(workflowId, sessionId);
    const updatedData: SessionData = {
      sessionKey: key,
      messages,
      summary: existing.summary,
      updatedAt: Date.now(),
    };
    this.memoryFallback.set(key, updatedData);

    if (!this.isIndexedDBAvailable()) {
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(`pc_chat_${key}`, JSON.stringify(updatedData));
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
        const req = store.put(updatedData);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error || new Error('Failed to save messages to IndexedDB'));
      });
    } catch (e) {
      console.warn('[IndexedDBSessionAdapter] Fallback to in-memory on error:', e);
    }
  }

  async saveSessionSummary(
    workflowId: string,
    summary: SessionSummary | undefined,
    sessionId = 'default',
  ): Promise<void> {
    const key = this.buildKey(workflowId, sessionId);
    const existing = await this.getSessionData(workflowId, sessionId);
    const updatedData: SessionData = {
      sessionKey: key,
      messages: existing.messages,
      summary,
      updatedAt: Date.now(),
    };
    this.memoryFallback.set(key, updatedData);

    if (!this.isIndexedDBAvailable()) {
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(`pc_chat_${key}`, JSON.stringify(updatedData));
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
        const req = store.put(updatedData);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error || new Error('Failed to save summary to IndexedDB'));
      });
    } catch (e) {
      console.warn('[IndexedDBSessionAdapter] Fallback to in-memory on error:', e);
    }
  }

  async updateSessionMessage(
    workflowId: string,
    messageId: string,
    updates: Partial<MemoryMessage>,
    sessionId = 'default',
  ): Promise<void> {
    const existing = await this.getSessionData(workflowId, sessionId);
    let matched = false;
    const updatedMessages = existing.messages.map((m) => {
      if (m.id === messageId) {
        matched = true;
        const isContentChanged = updates.content !== undefined && updates.content !== m.content;
        return {
          ...m,
          ...updates,
          isEdited: isContentChanged || updates.isEdited || m.isEdited,
          originalContent:
            isContentChanged && !m.originalContent
              ? m.content
              : (updates.originalContent ?? m.originalContent),
        };
      }
      return m;
    });

    if (matched) {
      await this.saveSessionMessages(workflowId, updatedMessages, sessionId);
    }
  }

  async deleteSessionMessage(
    workflowId: string,
    messageId: string,
    sessionId = 'default',
  ): Promise<void> {
    const existing = await this.getSessionData(workflowId, sessionId);
    const filtered = existing.messages.filter((m) => m.id !== messageId);
    await this.saveSessionMessages(workflowId, filtered, sessionId);
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
  preservePinned?: boolean;
}

/**
 * Estimates token count from content string (average ~4 chars per token).
 */
export function estimateMessageTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Pure strategy function to prune conversation messages based on window, token budget, and pinned locks.
 */
export function pruneConversationMessages(
  messages: MemoryMessage[],
  options: MemoryPruningOptions = {},
): MemoryMessage[] {
  if (!messages || messages.length === 0) return [];

  const maxRounds = options.maxHistoryRounds ?? 5;
  const maxBudget = options.maxTokenBudget ?? 3000;
  const strategy = options.pruningStrategy ?? 'hybrid';
  const preservePinned = options.preservePinned ?? true;

  if (strategy === 'none') {
    return [...messages];
  }

  // Separate pinned messages from unpinned candidates
  const pinnedMessages: MemoryMessage[] = [];
  const unpinnedMessages: MemoryMessage[] = [];

  for (const msg of messages) {
    if (preservePinned && msg.isPinned) {
      pinnedMessages.push(msg);
    } else {
      unpinnedMessages.push(msg);
    }
  }

  let filtered = [...unpinnedMessages];

  // 1. Sliding Window (Round-based) applied to unpinned messages
  if (strategy === 'window' || strategy === 'hybrid') {
    const maxMessages = Math.max(1, maxRounds * 2);
    if (filtered.length > maxMessages) {
      filtered = filtered.slice(filtered.length - maxMessages);
    }
  }

  // 2. Token Budget Pruning (from newest to oldest)
  if (strategy === 'token_budget' || strategy === 'hybrid') {
    const pinnedTokens = pinnedMessages.reduce(
      (sum, m) => sum + (m.metadata?.tokenCount ?? estimateMessageTokens(m.content)),
      0,
    );
    const availableBudget = Math.max(0, maxBudget - pinnedTokens);

    const result: MemoryMessage[] = [];
    let currentTokens = 0;

    for (let i = filtered.length - 1; i >= 0; i--) {
      const msg = filtered[i];
      if (!msg) continue;
      const msgTokens = msg.metadata?.tokenCount ?? estimateMessageTokens(msg.content);

      if (currentTokens + msgTokens > availableBudget && result.length > 0) {
        break; // Stop taking older messages when budget exceeded
      }

      result.unshift(msg);
      currentTokens += msgTokens;
    }

    filtered = result;
  }

  // Re-merge pinned messages with remaining unpinned messages, preserving chronological ordering
  const merged = [...pinnedMessages, ...filtered];
  merged.sort((a, b) => a.timestamp - b.timestamp);

  return merged;
}

/**
 * Formats memory messages into a readable text block for Prompt insertion.
 */
export function formatMessagesToPlainText(messages: MemoryMessage[]): string {
  if (!messages || messages.length === 0) return '';
  return messages
    .map((m) => {
      const sender = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'System';
      const pinTag = m.isPinned ? ' [Pinned]' : '';
      return `${sender}${pinTag}: ${m.content}`;
    })
    .join('\n');
}

/**
 * Dual-Anchor Conversation Formatter: combines long-term executive summary with recent verbatim history.
 */
export function formatDualAnchorConversation(
  summaryText?: string,
  messages: MemoryMessage[] = [],
): string {
  const parts: string[] = [];
  if (summaryText && summaryText.trim()) {
    parts.push(`[Previous Conversation Summary]\n${summaryText.trim()}`);
  }
  const messagesText = formatMessagesToPlainText(messages);
  if (messagesText) {
    if (parts.length > 0) {
      parts.push(`[Recent Conversation]\n${messagesText}`);
    } else {
      parts.push(messagesText);
    }
  }
  return parts.join('\n\n');
}

