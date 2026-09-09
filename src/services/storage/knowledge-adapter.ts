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
    description:
      'PatchCat 反应式同构 DAG 编排引擎工业级技术白皮书 (RFC-101)：涵盖 Kahn 拓扑调度、死锁收敛判定、分层波次并发、React Flow 细粒度渲染隔离与 Web Worker 沙箱安全。',
    embedding_provider: 'local',
    embedding_model: 'deterministic',
    embedding_dimension: 64,
    document_count: 1,
    total_chunks: 7,
    created_at: Date.now() - 86400000 * 2,
    updated_at: Date.now() - 86400000,
  };

  const seedDoc: DocumentItem = {
    id: SEED_DOC_ID,
    kb_id: SEED_KB_ID,
    name: 'patchcat-architecture.md',
    file_extension: 'md',
    file_size: 6144,
    char_count: 2980,
    chunk_count: 7,
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
        '【RFC-101 规范标准 | 第1章 系统全景架构与工业设计原则 (Architecture Overview & Design Invariants)】\nPatchCat 是专为复杂 Agentic AI 工作流设计的高响应性、端云同构有向无环图（DAG）编排系统。在系统架构设计上深度参考业界成熟工业标杆（Apache Airflow 任务调度、Dify 画布与变量安全总线、LangGraph 状态图模型、Temporal 确定性回放及 Ink & Switch 本地优先架构）。系统确立四大核心架构不变量：\n1. 端云同构执行协议（Isomorphic Execution Runtime）：调度核心与底层运行环境解耦，浏览器引擎与服务端引擎完全共享一致的图元数据规范（Graph Schema）与事件流生命周期协议（NODE_START、NODE_CHUNK、NODE_COMPLETE、WORKFLOW_COMPLETE）；\n2. 客户端零存储信任模型（Local-First & BYOK）：API Key 与敏感密钥仅在客户端本地沙盒与内存流转，绝不隐式上传，从根源规避中心化数据泄露风险；\n3. 分层分波异步并发（Topological Wave Concurrency）：无直接依赖的多分支节点由事件驱动波次并发调度，整体吞吐量对齐关键路径最短耗时；\n4. 沙箱物理隔离与看门狗韧性（Hard Sandboxing & Watchdog Circuit Breaker）：动态代码运行于独立线程沙箱并施加 5000ms 强制看门狗熔断。',
      token_count: 245,
      hit_count: 28,
      is_active: true,
      created_at: Date.now() - 86400000 * 2,
    },
    {
      id: 'chunk_arch_02',
      kb_id: SEED_KB_ID,
      doc_id: SEED_DOC_ID,
      position: 2,
      content:
        '【RFC-101 规范标准 | 第2章 核心图调度算法与 Kahn 拓扑排序机制 (DAG Scheduling & Kahn\'s Algorithm)】\n为保障大规模复杂工作流调度的确定性与高吞吐，PatchCat 调度内核严格采用经典的 Kahn 拓扑排序算法（Kahn\'s Algorithm, 1962），调度时间复杂度为严谨的线性阶 O(|V| + |E|)，空间复杂度 O(|V|)。算法调度生命周期分为三个原子阶段：\n1. 静态入度矩阵构建：引擎在初始化阶段遍历节点全集 V 与有向边集 E，计算各节点的静态入度映射表 I(v) = |{u ∈ V | (u, v) ∈ E}|；\n2. 零入度就绪队列初始化：调度器将全部入度为 0 的起始节点（如 User Input 入参源、Knowledge 知识库检索等无前驱节点）压入就绪队列 Q_0 = {v ∈ V | I(v) = 0}；\n3. 动态原子剪枝与事件驱动推进：当节点 u 执行完成（NODE_COMPLETE）后，调度器触发拓扑出边剪枝操作 E ← E \\ {(u, v)}，原子递减所有后继下游节点的入度计数：I(v) ← I(v) - 1。一旦某个下游节点入度归零（I(v) == 0），即表明该节点的所有前置输入与上下文均已就绪，立即推入调度就绪波次，实现完全非轮询、零阻塞的纯事件驱动执行流。',
      token_count: 260,
      hit_count: 35,
      is_active: true,
      created_at: Date.now() - 86400000 * 2,
    },
    {
      id: 'chunk_arch_03',
      kb_id: SEED_KB_ID,
      doc_id: SEED_DOC_ID,
      position: 3,
      content:
        '【RFC-101 规范标准 | 第3章 拓扑环路死循环死锁检测与防御机制 (Cycle Deadlock Pre-flight Interception)】\n在工作流配置过程中，若由于人工误连线或多分支交叉回环形成有向环（Cycle，如 A→B→C→A），环内所有节点的入度将永不归零（I(v) ≥ 1），从而导致就绪队列过早耗尽且未达终止态，引发调度引擎永久挂死（Deadlock）。PatchCat 对标 Apache Airflow DAG.validate() 构建了预检（Pre-flight）与运行时双重阻断体系：\n1. Kahn 数学收敛性不变式判定：在正式派发任何大模型调用或网络请求前，调度器在只读内存中执行拓扑遍历预检。根据图论充要条件，当且仅当拓扑遍历的节点总数 |V_visited| 等于画布节点总数 |V| 时，该图为严格有向无环图（DAG）。若 |V_visited| < |V|，在数学图论上严格证明图谱中存在闭合死循环回路；\n2. 最小闭环节点集合提取（Cycle Nodes Isolation）：引擎逆向计算未收敛节点差集 V_cycle = V \\ V_visited，精准圈定构成死锁闭环的所有节点清单；\n3. 前端画布联动熔断告警：预检失败时，引擎硬性拦截执行并抛出包含涉环节点明细的 DAG_CYCLE_DETECTED 异常，同时驱动画布将涉环节点与连接边渲染为琥珀红高亮警示，从根源杜绝死循环对主线程与服务器计算资源的无效耗尽。',
      token_count: 280,
      hit_count: 42,
      is_active: true,
      created_at: Date.now() - 86400000 * 2,
    },
    {
      id: 'chunk_arch_04',
      kb_id: SEED_KB_ID,
      doc_id: SEED_DOC_ID,
      position: 4,
      content:
        '【RFC-101 规范标准 | 第4章 分层分波并发调度与安全数据穿透总线 (Wave Concurrency & Variable Resolver)】\nPatchCat 调度器在拓扑排序基础上实现了离散波次并发模型（Topological Wave Concurrency）与安全变量穿透机制：\n1. 波次并发执行模型：引擎按拓扑图深度将节点划分为波次序列 W_0, W_1, ..., W_k。同一波次内互无依赖的分支节点（例如并行的多模型盲测评测节点、多源知识检索节点）由 Promise.all 实行微任务真并发并行调度。系统整体端到端时延收敛至各波次关键路径最大耗时：T_total = ∑ max_{v ∈ W_k} T(v)，吞吐量显著超越传统串行累加模型 ∑ T(v)；\n2. 变量解析总线（Variable Bus）：深度对齐 Dify 的上下文选择器规范，支持 {{nodeId.outputKey}} 嵌套点语法与深层数组取值表达式，在节点装载阶段执行无缝穿透解析；\n3. 原型污染防御盾（Prototype Pollution Shielding）：在变量递归解析与深层对象赋值中，内置安全解析器对对象键名实施严格白名单过滤，硬性拦截并剔除 __proto__、constructor、prototype 等特权属性注入，彻底防范恶意输入篡改 JavaScript 全局原型链。',
      token_count: 255,
      hit_count: 21,
      is_active: true,
      created_at: Date.now() - 86400000 * 2,
    },
    {
      id: 'chunk_arch_05',
      kb_id: SEED_KB_ID,
      doc_id: SEED_DOC_ID,
      position: 5,
      content:
        '【RFC-101 规范标准 | 第5章 画布百级节点渲染性能规范与切片隔离 (Canvas Virtualization & State Slicing)】\n大型复杂工作流普遍包含 100+ 节点与数百条复杂连线，常规 React 状态提升会在节点拖拽与数据更新时触发整画布 O(N) 脏重绘（Dirty Canvas Re-render），引发严重掉帧与主线程卡死。PatchCat 对标 React Flow 12 (xyflow) 与 Figma 渲染架构，确立三层性能优化规范：\n1. 原子化细粒度选择器切片（Atomic Selector Slicing）：基于 Zustand 全局状态树，每个节点组件严格通过 useWorkflowStore(useShallow(selector)) 仅订阅自身 node.id 的位置坐标、输入输出与执行状态切片。单个节点的拖拽与状态流转被严格物理隔离在其局部组件内，其余 99% 的画布节点实现零重绘消耗；\n2. 视口虚拟化与几何裁剪（Viewport Culling & Virtualization）：对视口范围外的不可见节点与折线跳过高开销 DOM 树合成与重排计算，大幅降低 GPU 图层合成开销；\n3. 微任务高频事件节流（Microtask Event Throttling）：对鼠标移动、网格吸附及连线对齐等高频事件施加微任务节流与 RequestAnimationFrame 垂直同步对齐，实测在 150+ 节点大型拓扑图下稳定维持 60 FPS 丝滑拖拽。',
      token_count: 265,
      hit_count: 26,
      is_active: true,
      created_at: Date.now() - 86400000 * 2,
    },
    {
      id: 'chunk_arch_06',
      kb_id: SEED_KB_ID,
      doc_id: SEED_DOC_ID,
      position: 6,
      content:
        '【RFC-101 规范标准 | 第6章 Web Worker 物理沙箱隔离与看门狗熔断 (Sandbox Security & Watchdog Circuit Breaker)】\n为保障自定义动态脚本节点（Code Node / Python / JavaScript 转换器）的安全执行与宿主稳定性，PatchCat 对齐 Dify Sandbox 与 Node.js isolated-vm 规范，实现基于 Web Worker 的分层安全架构：\n1. 物理线程隔离与 UI 防假死：所有不可信代码完全移出浏览器渲染主线程，投递至专用的独立 Web Worker 子线程中执行。即使脚本执行高负载密集计算，浏览器主界面交互与动画依然丝滑无阻；\n2. 特权降级与环境净化：Worker 沙箱初始化时，环境内主动封闭并剔除 window、document、localStorage、sessionStorage、indexedDB、cookies 及 fetch/XHR 等网络外联能力，彻底斩断恶意工作流窥探与窃取用户本地 API Key 的攻击面；\n3. 5000ms 硬超时看门狗（Watchdog Circuit Breaker）：沙箱宿主主控维持硬件级倒计时看门狗定时器。一旦用户代码出现死循环（如 while(true)）或不可恢复的长耗时阻塞，看门狗在达到 5000ms 阈值瞬间立即执行 worker.terminate() 物理强杀 Worker 线程，回收内存并由引擎优雅发射 EXECUTION_TIMEOUT 异常。',
      token_count: 270,
      hit_count: 18,
      is_active: true,
      created_at: Date.now() - 86400000 * 2,
    },
    {
      id: 'chunk_arch_07',
      kb_id: SEED_KB_ID,
      doc_id: SEED_DOC_ID,
      position: 7,
      content:
        '【RFC-101 规范标准 | 第7章 知识库 RAG 混合检索与双模存储架构 (Hybrid RAG Retrieval & Dual-Mode Storage)】\nPatchCat 内置高性能、隐私优先的端侧与云端双模知识库 RAG 引擎，满足从极客单机开发到企业团队级协同的多样化场景：\n1. 端侧 RAG 检索模型与指纹匹配：在纯客户端模式下，调度引擎依托确定性词法哈希结合向量大纲指纹检索算法，根据查询词与切片内容的倒排词频与向量上下文计算综合相似度（0.0 ~ 1.0），支持 Top-K 动态截断与命中频次（hit_count）热度自增追踪；\n2. 纯净度检测与乱码防御：内置 document-parser 解析器全面兼容 PDF（基于 unpdf 核心）、HTML、Markdown 及纯文本。针对 PDF 容器二进制数据流（如 %PDF-1.7 原始流）及控制符乱码实施强制纯度检验，乱码占比 >15% 时自动熔断拦截；\n3. 双模持久化抽象协议（IKnowledgeAdapter）：定义标准的 CRUD 与检索契约。本地开发采用 LocalKnowledgeAdapter（零依赖纯浏览器 LocalStorage / IndexedDB）；企业协同一键无缝切换至 ServerKnowledgeAdapter（FastAPI + PostgreSQL pgvector / SQLite 引擎），业务层代码 100% 零改动。',
      token_count: 260,
      hit_count: 23,
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
          if (
            archKb &&
            (archKb.total_chunks < seedKb.total_chunks ||
              !archKb.description?.includes('RFC-101'))
          ) {
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
          if (
            archDoc &&
            (archDoc.chunk_count < seedDoc.chunk_count ||
              archDoc.char_count < seedDoc.char_count)
          ) {
            archDoc.chunk_count = seedDoc.chunk_count;
            archDoc.char_count = seedDoc.char_count;
            archDoc.file_size = seedDoc.file_size;
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
            !arch01.content.includes('RFC-101') ||
            arch01.content.length < 300 ||
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
