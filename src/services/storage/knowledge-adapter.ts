/**
 * @file    src/services/storage/knowledge-adapter.ts
 * @version 1.0.0
 * @description
 *   Dual-Mode Knowledge Base & Document Chunks Storage Adapter.
 *   Supports both browser LocalStorage (Local BYOK Mode) and FastAPI Backend (Server Mode).
 */

import { nanoid } from 'nanoid';

export interface KnowledgeBaseSummary {
  id: string;
  name: string;
  description?: string | null;
  embedding_provider: string;
  embedding_model: string;
  embedding_dimension: number;
  document_count: number;
  total_chunks: number;
  created_at?: string | number;
  updated_at?: string | number;
}

export interface KnowledgeBaseCreate {
  name: string;
  description?: string;
  embedding_provider?: string;
  embedding_model?: string;
  embedding_dimension?: number;
}

export interface DocumentItem {
  id: string;
  kb_id: string;
  name: string;
  file_extension: string;
  file_size: number;
  char_count: number;
  chunk_count: number;
  status: string;
  chunk_size: number;
  chunk_overlap: number;
  created_at?: string | number;
}

export interface DocumentChunkItem {
  id: string;
  kb_id: string;
  doc_id: string;
  position: number;
  content: string;
  token_count: number;
  hit_count: number;
  is_active: boolean;
  created_at?: string | number;
}

export interface ChunkPreviewItem {
  position: number;
  content: string;
  char_count: number;
  token_count: number;
}

export interface ChunkPreviewResponse {
  total_characters: number;
  total_chunks: number;
  estimated_tokens: number;
  chunks: ChunkPreviewItem[];
}

export interface ChunkOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface IKnowledgeAdapter {
  getKnowledgeBases(search?: string): Promise<KnowledgeBaseSummary[]>;
  createKnowledgeBase(payload: KnowledgeBaseCreate): Promise<KnowledgeBaseSummary>;
  deleteKnowledgeBase(id: string): Promise<void>;
  getDocuments(kbId: string): Promise<DocumentItem[]>;
  uploadDocument(
    kbId: string,
    file: File | { name: string; content: string; extension?: string; size?: number },
    options?: ChunkOptions
  ): Promise<DocumentItem>;
  deleteDocument(docId: string): Promise<void>;
  getDocumentChunks(docId: string): Promise<DocumentChunkItem[]>;
  toggleChunkActive(chunkId: string, isActive?: boolean): Promise<DocumentChunkItem>;
  previewChunks(content: string, options?: ChunkOptions): Promise<ChunkPreviewResponse>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. LocalStorage Knowledge Adapter (Client-Side BYOK Mode)
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY_KBS = 'patchcat_kb_bases_v1';
const STORAGE_KEY_DOCS = 'patchcat_kb_docs_v1';
const STORAGE_KEY_CHUNKS = 'patchcat_kb_chunks_v1';

const SEED_KB_ID = 'kb_patchcat_arch';
const SEED_DOC_ID = 'doc_arch_whitepaper';

function getSeedData() {
  const seedKb: KnowledgeBaseSummary = {
    id: SEED_KB_ID,
    name: 'PatchCat Architecture Whitepaper',
    description: 'Core specifications, Kahn DAG scheduling, and RAG retrieval mechanisms.',
    embedding_provider: 'local',
    embedding_model: 'deterministic',
    embedding_dimension: 64,
    document_count: 1,
    total_chunks: 3,
    created_at: Date.now() - 86400000 * 2,
    updated_at: Date.now() - 86400000,
  };

  const seedDoc: DocumentItem = {
    id: SEED_DOC_ID,
    kb_id: SEED_KB_ID,
    name: 'patchcat-architecture.md',
    file_extension: 'md',
    file_size: 1024,
    char_count: 512,
    chunk_count: 3,
    status: 'completed',
    chunk_size: 300,
    chunk_overlap: 50,
    created_at: Date.now() - 86400000 * 2,
  };

  const seedChunks: DocumentChunkItem[] = [
    {
      id: 'chunk_arch_01',
      kb_id: SEED_KB_ID,
      doc_id: SEED_DOC_ID,
      position: 1,
      content:
        'PatchCat is an industrial-grade AI prompt orchestrator featuring Kahn topological scheduling and React Flow 12 visual canvas.',
      token_count: 38,
      hit_count: 15,
      is_active: true,
      created_at: Date.now() - 86400000 * 2,
    },
    {
      id: 'chunk_arch_02',
      kb_id: SEED_KB_ID,
      doc_id: SEED_DOC_ID,
      position: 2,
      content:
        'Dual-Mode Storage Architecture: Supports browser LocalStorage for client-side zero-key operation and FastAPI backend for persistent team collaboration.',
      token_count: 42,
      hit_count: 9,
      is_active: true,
      created_at: Date.now() - 86400000 * 2,
    },
    {
      id: 'chunk_arch_03',
      kb_id: SEED_KB_ID,
      doc_id: SEED_DOC_ID,
      position: 3,
      content:
        'Knowledge Retrieval Node: Retrieves top-K semantic chunks from private knowledge base collections and feeds citations to downstream LLM prompt contexts.',
      token_count: 46,
      hit_count: 21,
      is_active: true,
      created_at: Date.now() - 86400000 * 2,
    },
  ];

  return { seedKb, seedDoc, seedChunks };
}

export class LocalKnowledgeAdapter implements IKnowledgeAdapter {
  private memKBs: KnowledgeBaseSummary[] | null = null;
  private memDocs: DocumentItem[] | null = null;
  private memChunks: DocumentChunkItem[] | null = null;

  private getStoredKBs(): KnowledgeBaseSummary[] {
    if (typeof localStorage === 'undefined') {
      if (!this.memKBs) {
        this.memKBs = [getSeedData().seedKb];
      }
      return this.memKBs;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY_KBS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('[LocalKnowledgeAdapter] Failed to parse knowledge bases:', e);
    }
    const { seedKb } = getSeedData();
    this.setStoredKBs([seedKb]);
    return [seedKb];
  }

  private setStoredKBs(kbs: KnowledgeBaseSummary[]): void {
    if (typeof localStorage === 'undefined') {
      this.memKBs = kbs;
      return;
    }
    localStorage.setItem(STORAGE_KEY_KBS, JSON.stringify(kbs));
  }

  private getStoredDocs(): DocumentItem[] {
    if (typeof localStorage === 'undefined') {
      if (!this.memDocs) {
        this.memDocs = [getSeedData().seedDoc];
      }
      return this.memDocs;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DOCS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('[LocalKnowledgeAdapter] Failed to parse documents:', e);
    }
    const { seedDoc } = getSeedData();
    this.setStoredDocs([seedDoc]);
    return [seedDoc];
  }

  private setStoredDocs(docs: DocumentItem[]): void {
    if (typeof localStorage === 'undefined') {
      this.memDocs = docs;
      return;
    }
    localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(docs));
  }

  private getStoredChunks(): DocumentChunkItem[] {
    if (typeof localStorage === 'undefined') {
      if (!this.memChunks) {
        this.memChunks = [...getSeedData().seedChunks];
      }
      return this.memChunks;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CHUNKS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('[LocalKnowledgeAdapter] Failed to parse chunks:', e);
    }
    const { seedChunks } = getSeedData();
    this.setStoredChunks(seedChunks);
    return seedChunks;
  }

  private setStoredChunks(chunks: DocumentChunkItem[]): void {
    if (typeof localStorage === 'undefined') {
      this.memChunks = chunks;
      return;
    }
    localStorage.setItem(STORAGE_KEY_CHUNKS, JSON.stringify(chunks));
  }

  async getKnowledgeBases(search?: string): Promise<KnowledgeBaseSummary[]> {
    let kbs = this.getStoredKBs();
    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      kbs = kbs.filter(
        (kb) =>
          kb.name.toLowerCase().includes(s) ||
          (kb.description && kb.description.toLowerCase().includes(s))
      );
    }
    return kbs;
  }

  async createKnowledgeBase(payload: KnowledgeBaseCreate): Promise<KnowledgeBaseSummary> {
    const kbs = this.getStoredKBs();
    const newKb: KnowledgeBaseSummary = {
      id: `kb_${nanoid(8)}`,
      name: payload.name.trim(),
      description: payload.description || '',
      embedding_provider: payload.embedding_provider || 'local',
      embedding_model: payload.embedding_model || 'deterministic',
      embedding_dimension: payload.embedding_dimension || 64,
      document_count: 0,
      total_chunks: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    kbs.unshift(newKb);
    this.setStoredKBs(kbs);
    return newKb;
  }

  async deleteKnowledgeBase(id: string): Promise<void> {
    let kbs = this.getStoredKBs();
    kbs = kbs.filter((k) => k.id !== id);
    this.setStoredKBs(kbs);

    // Cascade delete documents and chunks
    let docs = this.getStoredDocs();
    const docsToDelete = new Set(docs.filter((d) => d.kb_id === id).map((d) => d.id));
    docs = docs.filter((d) => d.kb_id !== id);
    this.setStoredDocs(docs);

    let chunks = this.getStoredChunks();
    chunks = chunks.filter((c) => !docsToDelete.has(c.doc_id) && c.kb_id !== id);
    this.setStoredChunks(chunks);
  }

  async getDocuments(kbId: string): Promise<DocumentItem[]> {
    const docs = this.getStoredDocs();
    return docs.filter((d) => d.kb_id === kbId);
  }

  async uploadDocument(
    kbId: string,
    fileInput: File | { name: string; content: string; extension?: string; size?: number },
    options?: ChunkOptions
  ): Promise<DocumentItem> {
    let filename = '';
    let text = '';
    let extension = 'txt';
    let size = 0;

    if (typeof File !== 'undefined' && fileInput instanceof File) {
      filename = fileInput.name;
      const parts = filename.split('.');
      extension = parts.length > 1 ? parts.pop()!.toLowerCase() : 'txt';
      size = fileInput.size;
      text = await fileInput.text();
    } else {
      const customFile = fileInput as { name: string; content: string; extension?: string; size?: number };
      filename = customFile.name;
      text = customFile.content;
      extension = customFile.extension || 'txt';
      size = customFile.size || text.length;
    }

    const chunkSize = options?.chunkSize || 500;
    const chunkOverlap = options?.chunkOverlap || 50;

    // Simple chunking for local mode
    const preview = await this.previewChunks(text, { chunkSize, chunkOverlap });
    const docId = `doc_${nanoid(8)}`;

    const newDoc: DocumentItem = {
      id: docId,
      kb_id: kbId,
      name: filename,
      file_extension: extension,
      file_size: size,
      char_count: preview.total_characters,
      chunk_count: preview.total_chunks,
      status: 'completed',
      chunk_size: chunkSize,
      chunk_overlap: chunkOverlap,
      created_at: Date.now(),
    };

    const newChunks: DocumentChunkItem[] = preview.chunks.map((item) => ({
      id: `chunk_${nanoid(8)}`,
      kb_id: kbId,
      doc_id: docId,
      position: item.position,
      content: item.content,
      token_count: item.token_count,
      hit_count: 0,
      is_active: true,
      created_at: Date.now(),
    }));

    const docs = this.getStoredDocs();
    docs.unshift(newDoc);
    this.setStoredDocs(docs);

    const allChunks = this.getStoredChunks();
    this.setStoredChunks([...allChunks, ...newChunks]);

    // Update KB stats
    const kbs = this.getStoredKBs();
    const kb = kbs.find((k) => k.id === kbId);
    if (kb) {
      kb.document_count += 1;
      kb.total_chunks += newChunks.length;
      kb.updated_at = Date.now();
      this.setStoredKBs(kbs);
    }

    return newDoc;
  }

  async deleteDocument(docId: string): Promise<void> {
    const docs = this.getStoredDocs();
    const doc = docs.find((d) => d.id === docId);
    if (!doc) return;

    this.setStoredDocs(docs.filter((d) => d.id !== docId));

    const chunks = this.getStoredChunks();
    const deletedCount = chunks.filter((c) => c.doc_id === docId).length;
    this.setStoredChunks(chunks.filter((c) => c.doc_id !== docId));

    // Decrement KB counts
    const kbs = this.getStoredKBs();
    const kb = kbs.find((k) => k.id === doc.kb_id);
    if (kb) {
      kb.document_count = Math.max(0, kb.document_count - 1);
      kb.total_chunks = Math.max(0, kb.total_chunks - deletedCount);
      kb.updated_at = Date.now();
      this.setStoredKBs(kbs);
    }
  }

  async getDocumentChunks(docId: string): Promise<DocumentChunkItem[]> {
    const chunks = this.getStoredChunks();
    return chunks.filter((c) => c.doc_id === docId).sort((a, b) => a.position - b.position);
  }

  async toggleChunkActive(chunkId: string, isActive?: boolean): Promise<DocumentChunkItem> {
    const chunks = this.getStoredChunks();
    const chunk = chunks.find((c) => c.id === chunkId);
    if (!chunk) {
      throw new Error(`Chunk '${chunkId}' not found`);
    }
    chunk.is_active = isActive !== undefined ? isActive : !chunk.is_active;
    this.setStoredChunks(chunks);
    return chunk;
  }

  async previewChunks(content: string, options?: ChunkOptions): Promise<ChunkPreviewResponse> {
    const chunkSize = options?.chunkSize || 500;
    const chunkOverlap = options?.chunkOverlap || 50;

    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!normalized) {
      return {
        total_characters: 0,
        total_chunks: 0,
        estimated_tokens: 0,
        chunks: [],
      };
    }

    // Paragraph-based splitting with sliding window fallback
    const paragraphs = normalized.split(/\n\n+/);
    const chunks: ChunkPreviewItem[] = [];
    let currentChunk = '';
    let position = 1;

    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (!trimmed) continue;

      if (!currentChunk) {
        currentChunk = trimmed;
      } else if (currentChunk.length + trimmed.length + 2 <= chunkSize) {
        currentChunk += '\n\n' + trimmed;
      } else {
        // Push current chunk
        chunks.push({
          position: position++,
          content: currentChunk,
          char_count: currentChunk.length,
          token_count: Math.ceil(currentChunk.length / 3.2),
        });

        // Compute overlap
        const overlap = currentChunk.slice(-chunkOverlap);
        currentChunk = overlap + '\n\n' + trimmed;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        position: position++,
        content: currentChunk.trim(),
        char_count: currentChunk.trim().length,
        token_count: Math.ceil(currentChunk.trim().length / 3.2),
      });
    }

    return {
      total_characters: normalized.length,
      total_chunks: chunks.length,
      estimated_tokens: chunks.reduce((acc, c) => acc + c.token_count, 0),
      chunks,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FastAPI Backend Knowledge Adapter (Server Mode)
// ─────────────────────────────────────────────────────────────────────────────

export class ServerKnowledgeAdapter implements IKnowledgeAdapter {
  private baseUrl: string;

  constructor(baseUrl = 'http://127.0.0.1:8000') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  async getKnowledgeBases(search?: string): Promise<KnowledgeBaseSummary[]> {
    const url = new URL(`${this.baseUrl}/api/v1/knowledge-bases`);
    if (search && search.trim()) {
      url.searchParams.set('search', search.trim());
    }
    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`Failed to list knowledge bases: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  async createKnowledgeBase(payload: KnowledgeBaseCreate): Promise<KnowledgeBaseSummary> {
    const res = await fetch(`${this.baseUrl}/api/v1/knowledge-bases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: payload.name,
        description: payload.description || '',
        embedding_provider: payload.embedding_provider || 'local',
        embedding_model: payload.embedding_model || 'deterministic',
        embedding_dimension: payload.embedding_dimension || 64,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Failed to create knowledge base: ${res.status}`);
    }
    return res.json();
  }

  async deleteKnowledgeBase(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v1/knowledge-bases/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Failed to delete knowledge base: ${res.status}`);
    }
  }

  async getDocuments(kbId: string): Promise<DocumentItem[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/knowledge-bases/${kbId}/documents`);
    if (!res.ok) {
      throw new Error(`Failed to list documents: ${res.status}`);
    }
    return res.json();
  }

  async uploadDocument(
    kbId: string,
    fileInput: File | { name: string; content: string; extension?: string; size?: number },
    options?: ChunkOptions
  ): Promise<DocumentItem> {
    const chunkSize = options?.chunkSize || 500;
    const chunkOverlap = options?.chunkOverlap || 50;

    if (typeof File !== 'undefined' && fileInput instanceof File) {
      const formData = new FormData();
      formData.append('file', fileInput);
      formData.append('chunk_size', String(chunkSize));
      formData.append('chunk_overlap', String(chunkOverlap));

      const res = await fetch(`${this.baseUrl}/api/v1/knowledge-bases/${kbId}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to upload document file: ${res.status}`);
      }
      return res.json();
    } else {
      // JSON content creation
      const customFile = fileInput as { name: string; content: string; extension?: string; size?: number };
      const res = await fetch(`${this.baseUrl}/api/v1/knowledge-bases/${kbId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customFile.name,
          content: customFile.content,
          file_extension: customFile.extension || 'txt',
          chunk_size: chunkSize,
          chunk_overlap: chunkOverlap,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to create document: ${res.status}`);
      }
      return res.json();
    }
  }

  async deleteDocument(docId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v1/documents/${docId}`, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Failed to delete document: ${res.status}`);
    }
  }

  async getDocumentChunks(docId: string): Promise<DocumentChunkItem[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/documents/${docId}/chunks`);
    if (!res.ok) {
      throw new Error(`Failed to fetch chunks: ${res.status}`);
    }
    return res.json();
  }

  async toggleChunkActive(chunkId: string, isActive?: boolean): Promise<DocumentChunkItem> {
    let url = `${this.baseUrl}/api/v1/chunks/${chunkId}/toggle`;
    if (isActive !== undefined) {
      url += `?is_active=${isActive}`;
    }
    const res = await fetch(url, { method: 'PATCH' });
    if (!res.ok) {
      throw new Error(`Failed to toggle chunk active state: ${res.status}`);
    }
    return res.json();
  }

  async previewChunks(content: string, options?: ChunkOptions): Promise<ChunkPreviewResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/preview-chunks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        chunk_size: options?.chunkSize || 500,
        chunk_overlap: options?.chunkOverlap || 50,
        clean_whitespace: true,
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to preview chunks: ${res.status}`);
    }
    return res.json();
  }
}
