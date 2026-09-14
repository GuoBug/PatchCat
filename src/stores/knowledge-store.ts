/**
 * @file    src/stores/knowledge-store.ts
 * @version 1.0.0
 * @description
 *   Zustand state store for Knowledge Base Management, Document Chunks, and Dual-Mode sync.
 */

import { create } from 'zustand';
import {
  type IKnowledgeAdapter,
  type KnowledgeBaseSummary,
  type KnowledgeBaseCreate,
  type DocumentItem,
  type DocumentChunkItem,
  type ChunkOptions,
  type ChunkPreviewResponse,
  type KnowledgeRetrievalResult,
  LocalKnowledgeAdapter,
  ServerKnowledgeAdapter,
} from '../services/storage/knowledge-adapter.ts';

interface KnowledgeState {
  // Data
  knowledgeBases: KnowledgeBaseSummary[];
  activeKbId: string | null;
  documents: DocumentItem[];
  activeDocId: string | null;
  chunks: DocumentChunkItem[];

  // UI state
  isLoading: boolean;
  isUploading: boolean;
  searchQuery: string;
  isDetailOpen: boolean;
  error: string | null;

  // Actions
  init: () => Promise<void>;
  syncStorageMode: (mode: 'local' | 'server', serverBaseUrl?: string) => void;
  loadKnowledgeBases: () => Promise<void>;
  selectKnowledgeBase: (kbId: string | null) => Promise<void>;
  createKnowledgeBase: (payload: KnowledgeBaseCreate) => Promise<KnowledgeBaseSummary>;
  deleteKnowledgeBase: (kbId: string) => Promise<void>;
  selectDocument: (docId: string | null) => Promise<void>;
  uploadDocument: (
    kbId: string,
    file: File | { name: string; content: string; extension?: string; size?: number },
    options?: ChunkOptions,
  ) => Promise<DocumentItem>;
  deleteDocument: (docId: string) => Promise<void>;
  toggleChunk: (chunkId: string, isActive?: boolean) => Promise<void>;
  previewChunks: (content: string, options?: ChunkOptions) => Promise<ChunkPreviewResponse>;
  retrieve: (
    kbId: string,
    query: string,
    topK?: number,
    scoreThreshold?: number,
  ) => Promise<KnowledgeRetrievalResult>;
  setSearchQuery: (query: string) => void;
  openDetail: (kbId?: string) => void;
  closeDetail: () => void;
}

const getErrorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

// Global active adapter instance
let activeAdapter: IKnowledgeAdapter = new LocalKnowledgeAdapter();

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  knowledgeBases: [],
  activeKbId: null,
  documents: [],
  activeDocId: null,
  chunks: [],

  isLoading: false,
  isUploading: false,
  searchQuery: '',
  isDetailOpen: false,
  error: null,

  syncStorageMode: (mode: 'local' | 'server', serverBaseUrl?: string) => {
    if (mode === 'server') {
      activeAdapter = new ServerKnowledgeAdapter(serverBaseUrl || 'http://127.0.0.1:8000');
    } else {
      activeAdapter = new LocalKnowledgeAdapter();
    }
    get().loadKnowledgeBases();
  },

  init: async () => {
    await get().loadKnowledgeBases();
  },

  loadKnowledgeBases: async () => {
    set({ isLoading: true, error: null });
    try {
      const search = get().searchQuery;
      const kbs = await activeAdapter.getKnowledgeBases(search);
      set({ knowledgeBases: kbs, isLoading: false });

      // Auto-select first KB if none selected
      const currentActive = get().activeKbId;
      if (!currentActive && kbs.length > 0 && kbs[0]) {
        await get().selectKnowledgeBase(kbs[0].id);
      } else if (currentActive && !kbs.some((k) => k.id === currentActive)) {
        await get().selectKnowledgeBase(kbs[0]?.id || null);
      }
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, 'Failed to load knowledge bases'), isLoading: false });
    }
  },

  selectKnowledgeBase: async (kbId: string | null) => {
    set({ activeKbId: kbId, activeDocId: null, chunks: [], error: null });
    if (!kbId) {
      set({ documents: [] });
      return;
    }

    set({ isLoading: true });
    try {
      const docs = await activeAdapter.getDocuments(kbId);
      set({ documents: docs, isLoading: false });

      if (docs.length > 0 && docs[0]) {
        await get().selectDocument(docs[0].id);
      }
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, 'Failed to load documents'), isLoading: false });
    }
  },

  createKnowledgeBase: async (payload: KnowledgeBaseCreate) => {
    set({ isLoading: true, error: null });
    try {
      const newKb = await activeAdapter.createKnowledgeBase(payload);
      await get().loadKnowledgeBases();
      await get().selectKnowledgeBase(newKb.id);
      set({ isLoading: false });
      return newKb;
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, 'Failed to create knowledge base'), isLoading: false });
      throw err;
    }
  },

  deleteKnowledgeBase: async (kbId: string) => {
    set({ isLoading: true, error: null });
    try {
      await activeAdapter.deleteKnowledgeBase(kbId);
      await get().loadKnowledgeBases();
      set({ isLoading: false });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, 'Failed to delete knowledge base'), isLoading: false });
      throw err;
    }
  },

  selectDocument: async (docId: string | null) => {
    set({ activeDocId: docId, error: null });
    if (!docId) {
      set({ chunks: [] });
      return;
    }

    try {
      const chunks = await activeAdapter.getDocumentChunks(docId);
      set({ chunks });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, 'Failed to load document chunks') });
    }
  },

  uploadDocument: async (kbId, file, options) => {
    set({ isUploading: true, error: null });
    try {
      const newDoc = await activeAdapter.uploadDocument(kbId, file, options);
      // Reload documents and update active KB count
      const docs = await activeAdapter.getDocuments(kbId);
      const kbs = await activeAdapter.getKnowledgeBases(get().searchQuery);
      set({
        documents: docs,
        knowledgeBases: kbs,
        activeDocId: newDoc.id,
        isUploading: false,
      });
      await get().selectDocument(newDoc.id);
      return newDoc;
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, 'Failed to upload document'), isUploading: false });
      throw err;
    }
  },

  deleteDocument: async (docId: string) => {
    set({ isLoading: true, error: null });
    try {
      const kbId = get().activeKbId;
      await activeAdapter.deleteDocument(docId);
      if (kbId) {
        const docs = await activeAdapter.getDocuments(kbId);
        const kbs = await activeAdapter.getKnowledgeBases(get().searchQuery);
        set({ documents: docs, knowledgeBases: kbs });
        const remainingDoc = docs[0]?.id || null;
        await get().selectDocument(remainingDoc);
      }
      set({ isLoading: false });
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, 'Failed to delete document'), isLoading: false });
      throw err;
    }
  },

  toggleChunk: async (chunkId: string, isActive?: boolean) => {
    try {
      const updated = await activeAdapter.toggleChunkActive(chunkId, isActive);
      set((state) => ({
        chunks: state.chunks.map((c) => (c.id === chunkId ? updated : c)),
      }));
    } catch (err: unknown) {
      set({ error: getErrorMessage(err, 'Failed to toggle chunk state') });
      throw err;
    }
  },

  previewChunks: async (content: string, options?: ChunkOptions) => {
    return activeAdapter.previewChunks(content, options);
  },

  retrieve: async (kbId: string, query: string, topK?: number, scoreThreshold?: number) => {
    return activeAdapter.retrieve(kbId, query, topK, scoreThreshold);
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
    get().loadKnowledgeBases();
  },

  openDetail: (kbId?: string) => {
    if (kbId) {
      get().selectKnowledgeBase(kbId);
    }
    set({ isDetailOpen: true });
  },

  closeDetail: () => {
    set({ isDetailOpen: false });
  },
}));
