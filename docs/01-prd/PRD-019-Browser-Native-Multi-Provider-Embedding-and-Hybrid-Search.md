# PRD-019: 端侧多源向量嵌入与高工效三模混合检索

> **状态**：已批准 (Approved)  
> **版本**：1.0.0  
> **负责人**：Guo Qiang (GuoBug)  
> **最后更新**：2026-10-11  
> **关联文档**：[PRD-006: 知识库与 RAG 检索体系](PRD-006-Knowledge-Base-and-RAG-Architecture.md)、[PRD-017: 端侧数据主权与加密暗室](PRD-017-Local-Data-Sovereignty-and-Storage-Hardening.md)  
> **源码对齐**：`src/services/storage/knowledge-adapter.ts`、`src/services/search/bm25-engine.ts`、`server/app/services/rag/embedder.py`

---

## 1. 背景与核心定位

### 1.1 现状与问题
当前 `LocalKnowledgeAdapter.retrieve()`（`src/services/storage/knowledge-adapter.ts:735-760`）的 dense 稠密通道并非真实的向量检索，而是基于滑窗字词重合度的字面启发式评估：
```typescript
const similarity =
  terms.size > 0
    ? Math.min(0.96, 0.45 + (termMatches / Math.max(1, terms.size)) * 0.35 + charOverlapRatio * 0.16)
    : 0.75;
```
这导致在同义表述与概念联想场景下存在明显的语义鸿沟（Semantic Gap）：
- 正例：用户查询「MacBook 崩溃卡死」，由于字面重合极低，无法召回内容为「苹果笔记本电脑系统故障与无响应处理」的目标知识分块。

### 1.2 核心定位与架构分工
本项目**绝非**从零引入向量基础设施，而是**实现 Local 纯端侧通道对 Server 服务端通道既有真实向量能力的追平**：
1. **服务端现状**：`server/app/services/rag/embedder.py` 已具备完整的 SiliconFlow / Ollama / OpenAI / 确定性哈希 Embedding 管道，配合 pgvector / SQLite 向量点积运行；
2. **端侧使命**：在保持纯前端零部署门槛的前提下，为 `LocalKnowledgeAdapter` 引入多源真向量能力；
3. **架构边界铁律**：改造**仅限 `LocalKnowledgeAdapter`**；`ServerKnowledgeAdapter`（`:1028`）行为 100% 保持不变，两者统一遵循 `IKnowledgeAdapter` 契约。

---

## 2. 前置安全与环境约束 (P0)

### 2.1 零 CSP 变更边界
`index.html` 现行 CSP `connect-src` 白名单已天然覆盖三大目标端点：
- `http://localhost:*`：用户本地运行的 Ollama；
- `https://api.siliconflow.cn`：硅基流动国内高速托管 API；
- `https://api.openai.com`：OpenAI 官方端点。

**铁律**：本阶段**不修改 CSP**、不引入额外 WASM 依赖、前端 Bundle 体积增量严格控制为 **0 kB**。端侧本地量化 ONNX 离线推理作为独立的二期 RFC 进行安全基线评估。

### 2.2 Ollama CORS 前提与白盒诊断
浏览器直连 `http://localhost:11434` 受 Ollama 的 `OLLAMA_ORIGINS` 策略约束：
1. 客户端发起连接失败时，精准判定是否属于 CORS 拦截或端口不可达；
2. 严禁静默吞掉异常，界面必须弹出明确的诊断引导信息（指导用户设置环境变量 `OLLAMA_ORIGINS="*"`）；
3. 提供优雅降级气囊，网络不可达时不卡死主画布。

---

## 3. 存储契约：IndexedDB v6 `vector_embeddings`

### 3.1 数据库结构升级
将底座 IndexedDB 升级至 `DB_VERSION = 6`，新增 `vector_embeddings` 专用对象仓库：
- `keyPath`: `chunkId`
- `indexes`: `by_kb`: `kbId`

### 3.2 向量记录与维度失效指纹
```typescript
export interface VectorEmbeddingRecord {
  chunkId: string;
  kbId: string;
  vector: Float32Array;          // 严格经 L2 归一化 (||v|| = 1)
  // ── 失效指纹 (Fingerprint)：任一要素变更判定该分块向量失效 ──
  provider: 'siliconflow' | 'openai' | 'ollama' | 'custom';
  model: string;                 // 如 'BAAI/bge-m3', 'text-embedding-3-small'
  dimension: number;             // 768 | 1024 | 1536
  createdAt: number;
}
```

### 3.3 失效与重建契约
1. **静默保护**：检索前校验当前知识库配置与记录的 `provider / model / dimension`。若指纹不一致，该分块视为未向量化，自动跳过向量通道，严防不同维度点积导致的数组越界或 NaN 计算；
2. **一键重建**：知识库配置面板提供「⚡ 重建向量索引」操作，清空旧向量并重新批处理生成。

---

## 4. 接口与核心组件契约

### 4.1 纯前端多源 Embedding 客户端 (`BrowserEmbeddingClient`)
```typescript
export interface EmbeddingConfig {
  provider: 'siliconflow' | 'openai' | 'ollama' | 'custom';
  model: string;
  dimension?: number;
  baseUrl?: string;
  apiKey?: string;
}

export interface IBrowserEmbeddingClient {
  embedQuery(text: string, config: EmbeddingConfig): Promise<Float32Array>;
  embedBatch(
    texts: string[],
    config: EmbeddingConfig,
    onProgress?: (done: number, total: number) => void,
  ): Promise<Float32Array[]>;
}
```
- **L2 预归一化保证**：所有向量在客户端输出前完成 L2 归一化，使得余弦相似度计算退化为极速的一维数组点积。
- **暗室关联**：`apiKey` 优先复用全局 Provider 配置；暗室锁定时无法读取凭据，直接返回降级标识。

### 4.2 全内存线性扫描向量索引 (`FlatVectorIndex`)
```typescript
export class FlatVectorIndex {
  constructor(dimension: number);
  add(chunkId: string, vector: Float32Array): void;
  search(queryVec: Float32Array, topK: number): Array<{ chunkId: string; score: number }>;
  size(): number;
}
```
- 内部采用连续单一大块 `Float32Array`（`capacity * dimension`）存储，彻底杜绝对象碎片；
- 针对 1,000 ~ 5,000 分块规模，线性点积扫描相比 HNSW 具备更低的内存消耗与零冷启动延迟。

---

## 5. 分数与三模融合契约

### 5.1 分数体系显式分工
| 分数字段 | 计算方式 | 取值范围 | 职能 |
| :--- | :--- | :--- | :--- |
| `dense_score` | $\max(0, \vec{u} \cdot \vec{v})$ | $[0, 1]$ | 语义相似度展示与加权计算 |
| `bm25_score` | BM25 词频公式 | $[0, +\infty)$ | 稀疏检索分 |
| `rrf_score` | $\sum \frac{w_i}{k + \text{rank}_i}$ | $(0, +\infty)$ | **核心排序依据** (决定候选顺序) |
| `similarity` | $\min(0.98, \max(0.1, \alpha \cdot \text{bm25Norm} + \beta \cdot \text{denseScore}))$ | $[0.1, 0.98]$ | **对外兼容字段**，用于 `scoreThreshold` 过滤 |

### 5.2 降级策略与垫底偏置契约
1. **L1 满血真向量通道**：使用真实余弦分 $[0, 1]$，**不包含 0.45 垫底**；
2. **L2 启发式降级通道**：当未配置 Embedding、网络超时或 CORS 拦截时，**完整保留原有的 0.45 垫底启发式公式**，确保已有测试与既有阈值设定零破坏；
3. **降级可见性铁律**：检索结果元数据透出 `search_mode` 与 `is_degraded` 标识，UI 明确指示当前检索级别，彻底消灭静默降级盲区。

---

## 6. 交互流水线与工效设计

1. **配置显式开启 (Opt-in)**：
   - 知识库默认保持基础模式（L2 降级通道），用户零门槛开箱即用；
   - 知识库面板提供明确选项切换至真向量模式。
2. **弹窗进度流水线**：
   - 文档上传并分块确认后，在弹窗内直接以批次（`batchSize = 16`）执行 `embedBatch`，展示实时百分比进度条；
   - 向量化完成与分块数据原子写入 IndexedDB，规避后台异步队列导致的未决状态。

---

## 7. 验收标准与基线实验

### 7.1 自动化契约工程测试
- [ ] `tests/vector-search-engine.node.test.ts` 接入 `package.json` 显式测试清单；
- [ ] 覆盖维度失效校验、L2 归一化点积精度、mock HTTP 跨协议解析；
- [ ] 覆盖 CORS 报错捕获与降级路径；
- [ ] 验证 `ServerKnowledgeAdapter` 行为 100% 保持不变（零回归）。

### 7.2 真实基线对照实验 (Ground Truth Benchmark)
| 测试用例 | 查询 Query | 目标分块 Chunk 内容 | L1 向量期望 | L2 启发式期望 |
| :--- | :--- | :--- | :--- | :--- |
| **同义语义泛化** | 「MacBook 崩溃卡死」 | 「苹果笔记本电脑系统故障与无响应处理」 | **Top-1 召回 (成功)** | 无法命中 (预期失分) |
| **精准专有名词** | 「DAG_CYCLE_DETECTED」 | 「Kahn 拓扑排序环路死锁判定机制」 | **Top-1 召回 (成功)** | Top-1 召回 (成功) |

---

## 8. 实施路径规划

```
[Phase 4.19 Milestone 交付计划]
  ├── Step 1: 存储升级与索引核心 (FlatVectorIndex & IndexedDB v6)
  ├── Step 2: 纯前端多源 Embedding 客户端 (BrowserEmbeddingClient)
  ├── Step 3: LocalKnowledgeAdapter 端侧三模重构与降级指示
  ├── Step 4: 知识库上传分块向量化进度条与失效重建 UI
  └── Step 5: 契约测试挂载、基线实验验证与版本对齐
```
