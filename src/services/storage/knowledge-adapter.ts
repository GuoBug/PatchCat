/**
 * @file    src/services/storage/knowledge-adapter.ts
 * @version 1.0.0
 * @description
 *   Dual-Mode Knowledge Base & Document Chunks Storage Adapter.
 *   Supports both browser LocalStorage (Local BYOK Mode) and FastAPI Backend (Server Mode).
 */

import { nanoid } from 'nanoid';
import { parseDocumentFile } from '../document-parser.ts';

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

export interface KnowledgeRetrievalChunk {
  id: string;
  doc_id: string;
  doc_name: string;
  position: number;
  content: string;
  similarity: number;
  token_count: number;
}

export interface KnowledgeRetrievalResult {
  context: string;
  chunks: KnowledgeRetrievalChunk[];
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
  retrieve(
    kbId: string,
    query: string,
    topK?: number,
    scoreThreshold?: number
  ): Promise<KnowledgeRetrievalResult>;
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
    description: 'PatchCat 系统核心架构白皮书：涵盖 Kahn 算法拓扑调度、死锁检测机制、React Flow 性能优化规范及双模存储架构。',
    embedding_provider: 'local',
    embedding_model: 'deterministic',
    embedding_dimension: 64,
    document_count: 1,
    total_chunks: 5,
    created_at: Date.now() - 86400000 * 2,
    updated_at: Date.now() - 86400000,
  };

  const seedDoc: DocumentItem = {
    id: SEED_DOC_ID,
    kb_id: SEED_KB_ID,
    name: 'patchcat-architecture.md',
    file_extension: 'md',
    file_size: 3840,
    char_count: 1860,
    chunk_count: 5,
    status: 'completed',
    chunk_size: 500,
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
        '【第1章 核心调度算法与拓扑排序】：\nPatchCat 核心图调度引擎采用经典 Kahn 拓扑排序算法（Kahn\'s Algorithm）管理有向无环图（DAG）的执行流程。\n工作流启动时，调度引擎首先静态遍历图中的全部节点（Nodes）与边（Edges），构建出全局节点的入度映射表（In-Degree Map）。\n随后，引擎将所有入度为 0 的起始节点（如 Input 入参节点、Knowledge 知识检索等初始数据源）推进并发执行队列。\n在每个节点执行成功的回调中，调度器原子化移除该节点的所有出边，并对应递减其所有下游节点的入度计数；一旦下游节点的入度归零，即判定该节点所有前置依赖已就绪，立即将其投递至调度就绪队列，实现完全事件驱动的高性能拓扑排序调度。',
      token_count: 128,
      hit_count: 24,
      is_active: true,
      created_at: Date.now() - 86400000 * 2,
    },
    {
      id: 'chunk_arch_02',
      kb_id: SEED_KB_ID,
      doc_id: SEED_DOC_ID,
      position: 2,
      content:
        '【第2章 环路死锁实时检测与防御机制】：\n为了防止团队配置工作流时由于错误连线导致死循环死锁（Cycle Deadlock），PatchCat 在预检（Pre-flight）与运行时实施了双重阻断：\n1. Kahn 算法收敛性判定：当调度就绪队列为空时，引擎比对“已成功访问的节点总数”与“画布节点总数”。若二者不相等，在数学图论上严格证明图谱中存在闭合有向环；\n2. 环路节点精准定位：系统提取未完成收敛的所有节点集合（cycleNodes），准确定位构成循环的闭合回路；\n3. 画布联动告警：引擎在触发执行前立即拦截请求，对涉环节点标红高亮并抛出 NODE_ERROR 状态提示，彻底阻断死循环对浏览器主线程或服务器计算资源的无谓耗尽。',
      token_count: 142,
      hit_count: 31,
      is_active: true,
      created_at: Date.now() - 86400000 * 2,
    },
    {
      id: 'chunk_arch_03',
      kb_id: SEED_KB_ID,
      doc_id: SEED_DOC_ID,
      position: 3,
      content:
        '【第3章 异步分层并发与数据流穿透】：\nPatchCat 调度器将 DAG 结构自动划分为若干相互独立的拓扑分层（Topological Layers）。\n同一层级中互不依赖的多分支节点（例如平行的多模型盲测 LLM 节点或多源知识检索节点）由 Promise.all 真正并发调度，执行总耗时取决于最慢单节点的 max(T_i)，而非串行耗时的累加 sum(T_i)。\n在数据传递层面，系统内置安全的变量解析器（Variable Resolver），支持 {{nodeId.fieldName}} 表达式深度递归穿透，并全面实施原型污染防御（严格过滤 __proto__ 与 constructor 属性）。',
      token_count: 115,
      hit_count: 16,
      is_active: true,
      created_at: Date.now() - 86400000 * 2,
    },
    {
      id: 'chunk_arch_04',
      kb_id: SEED_KB_ID,
      doc_id: SEED_DOC_ID,
      position: 4,
      content:
        '【第4章 画布大批量节点拖拽性能优化与渲染防护】：\n针对 100+ 节点大型复杂工作流拖拽易卡顿、掉帧的工程痛点，PatchCat 基于 React Flow 12 与 Zustand 实现精细化状态切片（Fine-Grained State Slicing）：\n1. 单一节点局部重绘：每个节点组件仅订阅自身的位置、数据和执行状态切片，拖拽单个节点不会引发全局整画布的脏重绘；\n2. 视口裁剪（Viewport Culling）：视口外部不可见的复杂节点不参与高开销 DOM 树计算；\n3. 事件调度节流：对高频鼠标移动与连线吸附事件实施微任务节流，保障百级节点画布拖拽在各类显示设备上稳定维持 60 FPS 丝滑帧率。',
      token_count: 122,
      hit_count: 19,
      is_active: true,
      created_at: Date.now() - 86400000 * 2,
    },
    {
      id: 'chunk_arch_05',
      kb_id: SEED_KB_ID,
      doc_id: SEED_DOC_ID,
      position: 5,
      content:
        '【第5章 双模存储与 Web Worker 沙箱安全隔离】：\n1. 零门槛双模存储：系统默认采用浏览器纯本地 LocalStorage 存储（Local-First），无需配置服务端或外部数据库即可完整运行；需要团队协作时可平滑切换为 FastAPI + SQLite/PostgreSQL 服务端模式；\n2. Worker 沙箱与看门狗：代码执行节点（Code Node）在主线程外的独立 Web Worker 沙箱中运行，屏蔽 localStorage、cookies 及网络外联能力以防凭据失窃；同时配置 5 秒看门狗定时器，任何 while(true) 等死循环代码将在 5000ms 被强制销毁并优雅报错。',
      token_count: 130,
      hit_count: 14,
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
    const { seedKb } = getSeedData();
    if (typeof localStorage === 'undefined') {
      if (!this.memKBs) {
        this.memKBs = [seedKb];
      }
      return this.memKBs;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY_KBS);
      if (raw) {
        const parsed: KnowledgeBaseSummary[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const archKb = parsed.find((k) => k.id === SEED_KB_ID);
          if (archKb && archKb.total_chunks < seedKb.total_chunks) {
            archKb.total_chunks = seedKb.total_chunks;
            archKb.description = seedKb.description;
            this.setStoredKBs(parsed);
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[LocalKnowledgeAdapter] Failed to parse knowledge bases:', e);
    }
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
    const { seedDoc } = getSeedData();
    if (typeof localStorage === 'undefined') {
      if (!this.memDocs) {
        this.memDocs = [seedDoc];
      }
      return this.memDocs;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DOCS);
      if (raw) {
        const parsed: DocumentItem[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const archDoc = parsed.find((d) => d.id === SEED_DOC_ID);
          if (archDoc && archDoc.chunk_count < seedDoc.chunk_count) {
            archDoc.chunk_count = seedDoc.chunk_count;
            archDoc.char_count = seedDoc.char_count;
            this.setStoredDocs(parsed);
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[LocalKnowledgeAdapter] Failed to parse documents:', e);
    }
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
    const { seedChunks } = getSeedData();
    if (typeof localStorage === 'undefined') {
      if (!this.memChunks) {
        this.memChunks = [...seedChunks];
      }
      return this.memChunks;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CHUNKS);
      if (raw) {
        const parsed: DocumentChunkItem[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const arch01 = parsed.find((c) => c.id === 'chunk_arch_01');
          if (
            !arch01 ||
            arch01.content.length < 200 ||
            parsed.filter((c) => c.kb_id === SEED_KB_ID).length < seedChunks.length
          ) {
            const nonArchChunks = parsed.filter((c) => c.kb_id !== SEED_KB_ID);
            const upgraded = [...seedChunks, ...nonArchChunks];
            this.setStoredChunks(upgraded);
            return upgraded;
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[LocalKnowledgeAdapter] Failed to parse chunks:', e);
    }
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

      // Extract and clean text using document parser (supports PDF, MD, TXT with purity check)
      const parsed = await parseDocumentFile(fileInput);
      text = parsed.text;
    } else {
      const customFile = fileInput as { name: string; content: string; extension?: string; size?: number };
      filename = customFile.name;
      extension = customFile.extension || filename.split('.').pop()?.toLowerCase() || 'txt';
      size = customFile.size || customFile.content.length;

      const buffer = new TextEncoder().encode(customFile.content).buffer;
      const parsed = await parseDocumentFile({
        name: filename,
        buffer,
        extension,
      });
      text = parsed.text;
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

    const pushChunk = (content: string) => {
      const c = content.trim();
      if (!c) return;
      chunks.push({
        position: position++,
        content: c,
        char_count: c.length,
        token_count: Math.ceil(c.length / 3.2),
      });
    };

    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (!trimmed) continue;

      // If a single paragraph is longer than chunkSize, split it using a sliding window
      if (trimmed.length > chunkSize) {
        if (currentChunk) {
          pushChunk(currentChunk);
          currentChunk = '';
        }
        let start = 0;
        const step = Math.max(1, chunkSize - chunkOverlap);
        while (start < trimmed.length) {
          const end = Math.min(start + chunkSize, trimmed.length);
          pushChunk(trimmed.slice(start, end));
          if (end >= trimmed.length) break;
          start += step;
        }
        continue;
      }

      if (!currentChunk) {
        currentChunk = trimmed;
      } else if (currentChunk.length + trimmed.length + 2 <= chunkSize) {
        currentChunk += '\n\n' + trimmed;
      } else {
        pushChunk(currentChunk);
        const overlap = currentChunk.slice(-chunkOverlap);
        currentChunk = overlap + '\n\n' + trimmed;
      }
    }

    if (currentChunk.trim()) {
      pushChunk(currentChunk);
    }

    return {
      total_characters: normalized.length,
      total_chunks: chunks.length,
      estimated_tokens: chunks.reduce((acc, c) => acc + c.token_count, 0),
      chunks,
    };
  }

  async retrieve(
    kbId: string,
    query: string,
    topK = 3,
    scoreThreshold = 0.0
  ): Promise<KnowledgeRetrievalResult> {
    const docs = this.getStoredDocs().filter((d) => d.kb_id === kbId);
    const docMap = new Map<string, string>();
    docs.forEach((d) => docMap.set(d.id, d.name));

    const chunks = this.getStoredChunks().filter(
      (c) => c.kb_id === kbId && c.is_active !== false
    );

    if (chunks.length === 0) {
      return { context: '', chunks: [] };
    }

    const q = (query || '').toLowerCase().trim();
    const terms = new Set<string>();
    const engMatches = q.match(/[a-z0-9_-]+/g) || [];
    engMatches.forEach((w) => {
      if (w.length >= 2) terms.add(w);
    });

    const chineseChars = q.match(/[\u4e00-\u9fa5]/g) || [];
    const chineseWords = q.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
    chineseWords.forEach((w) => terms.add(w));

    const keyVocabulary = [
      '拓扑', '算法', '死锁', '死循环', 'kahn', 'dag', '调度',
      '并发', 'promise', '性能', '卡顿', 'react flow', '拖拽',
      '优化', '沙箱', 'worker', '看门狗', '存储', '双模', '白皮书',
      '重绘', '切片', '架构', '入度', '环路'
    ];
    keyVocabulary.forEach((kv) => {
      if (q.includes(kv)) terms.add(kv);
    });

    const scored = chunks.map((chunk) => {
      const contentLower = chunk.content.toLowerCase();
      let termMatches = 0;

      terms.forEach((term) => {
        if (contentLower.includes(term)) {
          termMatches++;
        }
      });

      let charOverlapCount = 0;
      chineseChars.forEach((ch) => {
        if (contentLower.includes(ch)) charOverlapCount++;
      });
      const charOverlapRatio = chineseChars.length > 0 ? charOverlapCount / chineseChars.length : 0;

      let similarity = 0.35;
      if (terms.size > 0) {
        const termRatio = termMatches / Math.max(1, terms.size);
        similarity = Math.min(0.96, 0.45 + termRatio * 0.35 + charOverlapRatio * 0.16);
      } else {
        similarity = 0.75;
      }

      return {
        chunk,
        similarity: parseFloat(similarity.toFixed(2)),
      };
    });

    const filtered = scored.filter((item) => item.similarity >= scoreThreshold);
    filtered.sort((a, b) => b.similarity - a.similarity);
    const selected = filtered.slice(0, topK);
    const finalSelection = selected.length > 0 ? selected : scored.slice(0, Math.min(2, topK));

    // Increment hit_count for recalled chunks
    const allStoredChunks = this.getStoredChunks();
    const recalledIds = new Set(finalSelection.map((s) => s.chunk.id));
    allStoredChunks.forEach((c) => {
      if (recalledIds.has(c.id)) {
        c.hit_count = (c.hit_count || 0) + 1;
      }
    });
    this.setStoredChunks(allStoredChunks);

    const formattedChunks = finalSelection.map((s) => ({
      id: s.chunk.id,
      doc_id: s.chunk.doc_id,
      doc_name: docMap.get(s.chunk.doc_id) || 'document.md',
      position: s.chunk.position,
      content: s.chunk.content,
      similarity: s.similarity,
      token_count: s.chunk.token_count,
    }));

    const contextParts = formattedChunks.map(
      (c) =>
        `### [Document: ${c.doc_name} (Position #${c.position} - Similarity: ${c.similarity.toFixed(2)})]\n${c.content}`
    );

    return {
      context: contextParts.join('\n\n'),
      chunks: formattedChunks,
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

  async retrieve(
    kbId: string,
    query: string,
    topK = 3,
    scoreThreshold = 0.0
  ): Promise<KnowledgeRetrievalResult> {
    const res = await fetch(`${this.baseUrl}/api/v1/knowledge-bases/${kbId}/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query || 'knowledge query',
        top_k: topK,
        score_threshold: scoreThreshold,
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to retrieve knowledge from server: ${res.status}`);
    }
    return res.json();
  }
}
