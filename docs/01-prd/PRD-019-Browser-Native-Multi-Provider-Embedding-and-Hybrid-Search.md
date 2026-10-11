# PRD-019: 端侧多源向量嵌入与高工效三模混合检索

> **状态**：待最终确认 (Pending Final Sign-off)  
> **版本**：1.1.0 (评审修订版)  
> **负责人**：Guo Qiang (GuoBug)  
> **最后更新**：2026-10-11  
> **关联文档**：[PRD-006: 知识库与 RAG 检索体系](PRD-006-Knowledge-Base-and-RAG-Retrieval.md)、[PRD-017: 端侧数据主权与加密暗室](PRD-017-Local-Data-Sovereignty-and-Storage-Hardening.md)  
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

**铁律**：本阶段**不修改 CSP**、不引入额外 WASM 依赖、前端 Bundle 体积增量严格控制在纯 TypeScript 代码本身的轻量级别（< 10 kB 量级，零模型权重引入）。端侧本地量化 ONNX 离线推理作为独立的二期 RFC 进行安全基线评估。

### 2.2 Ollama CORS 前提与白盒诊断
浏览器直连 `http://localhost:11434` 受 Ollama 的 `OLLAMA_ORIGINS` 策略约束（CSP 放行不等于跨域请求能通）：
1. **安全配置引导**：严禁无保留地诱导用户设置通配符 `OLLAMA_ORIGINS="*"`（避免将本地模型暴露给恶意外部网页导致 SSRF）。优先引导用户指定安全源：
   - 研发环境：`OLLAMA_ORIGINS="http://localhost:5173"`
   - 预览/生产：`OLLAMA_ORIGINS="http://localhost:4173"`
   - Windows PowerShell 配置范式：`[System.Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', 'http://localhost:5173', 'User')`
   - macOS/Linux 配置范式：`OLLAMA_ORIGINS="http://localhost:5173" ollama serve`
   - 文档注明通配符 `"*"` 仅作为临时排障手段。
2. **白盒拦截与诊断**：客户端发起连接失败时，精准判定是否属于 CORS 拦截或端口不可达。严禁静默吞掉异常，界面必须弹出明确的操作指引卡片；
3. **优雅降级气囊**：Ollama 服务不可达或跨域失败时，自动优雅降级至 L2 启发式通道，确保画布流程绝对不卡死。

---

## 3. 存储契约：IndexedDB v6 `vector_embeddings`

### 3.1 数据库结构升级
将底座 IndexedDB 升级至 `DB_VERSION = 6`，新增 `vector_embeddings` 专用对象仓库（遵循既有的幂等 `if (!db.objectStoreNames.contains(...))` 扩展机制）：
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
  dimension: number;             // 768 | 1024 | 1536 | 3072
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
- **维度自动探测与预置映射**：
  - 常见模型预置映射：`siliconflow` 默认 `1024`（`BAAI/bge-m3`）、`openai` 默认 `1536`（`text-embedding-3-small`）或 `3072`（`large`）、`ollama` 默认 `768`（`nomic-embed-text`）或 `1024`（`bge-m3`）；
  - 若 `dimension` 未显式配置，首次 `embedQuery` 后自动从首个返回向量 `length` 推断并缓存回填。
- **`embedBatch` 顺序对齐硬约束**：
  - `embedBatch` 返回数组必须与入参 `texts` **严格等长且同序**；
  - 对 OpenAI-compatible `/embeddings` 响应，实现必须依据每项返回的 `item.index` 升序回排（`data.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))`，对齐后端 `server/app/services/rag/embedder.py`），杜绝因 API 乱序响应导致的不可逆 Chunk-向量错位；缺失 `index` 字段时按返回顺序处理，并在单测中锁定该断言。
- **暗室关联**：`apiKey` 优先复用全局 Provider 配置；暗室锁定时无法读取凭据，直接进入降级状态并在 UI 显式提示。

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
3. **阈值语义迁移告知**：在 UI 知识库配置面板切换至真向量时，显著提示：“*启用真向量后，相似度得分不再包含 0.45 垫底常数，原有相似度阈值（scoreThreshold）过滤效果会发生变化，建议重新校准阈值参数*”；并在 `CHANGELOG.md` 明确标注该语义变化。

### 5.3 显式三态状态元数据
检索结果元数据透出 `vector_status` 与 `search_mode`，彻底消灭静默降级盲区：
- `vector_status: 'disabled'`：用户未启用真向量（默认，中性灰色标识）；
- `vector_status: 'active'`：L1 真向量正常生效（绿色标识）；
- `vector_status: 'degraded'`：用户已开启真向量，但运行时失败（CORS/网络超时/Key 缺失）并降级至 L2 启发式（琥珀色醒目警示，附错误诊断）。

### 5.4 `searchMode: 'vector'` 在 L1/L2 下的映射行为
- 当 `searchMode === 'vector'` 且 L1 真向量生效时：直接以纯余弦点积 `dense_score` 降序截断 Top-K；
- 当 `searchMode === 'vector'` 处于 L2 降级态时：直接以启发式 `denseScore` 截断 Top-K。

### 5.5 Rerank 阶段契约
Rerank 两阶段解耦契约（PRD-006 / v0.4.15）继续有效：Cross-Encoder 的 `rerank.scoreThreshold` 作用于 Sigmoid 重排分，与粗排加权分完全解耦，互不干扰。

---

## 6. 交互流水线与存储契约

### 6.1 配置显式开启 (Opt-in)
- 知识库默认保持基础模式（L2 降级通道），用户零门槛开箱即用；
- 知识库面板提供明确选项切换至真向量模式。

### 6.2 存储契约与顺序写兜底
**分块与向量顺序写入，检索期以 chunkId 一致性校验兜底**：
1. 分块数据优先持久化至 LocalStorage（保持现有 `patchcat_kb_chunks_v1` 兼容）；
2. 随后批处理生成的向量单事务批量写入 IndexedDB `vector_embeddings`；
3. 检索执行时，以当前分块的 `chunkId` 集合进行匹配比对；若检测到部分分块缺少对应向量（如上传中途中断或部分批次失败），自动对缺失分块走 L2 启发式兜底，杜绝悬挂数据破坏整体检索。

---

## 7. 验收标准与基线实验

### 7.1 自动化契约工程测试
- [ ] `tests/vector-search-engine.node.test.ts` 接入 `package.json` 显式测试清单；
- [ ] `embedBatch` 顺序对齐测试：mock HTTP 乱序返回，断言按 `index` 回排后顺序 100% 正确；
- [ ] 维度失效校验：provider/model/dimension 变更后，旧向量被判定为 stale 并跳过；
- [ ] L2 降级通道 0.45 垫底守卫与 L1 真向量 [0, 1] 点积精度验证；
- [ ] CORS 报错拦截与 `vector_status: 'degraded'` 状态流转测试；
- [ ] 验证 `ServerKnowledgeAdapter` 行为 100% 保持不变（零回归）。

### 7.2 真实基线对照实验 (Ground Truth Benchmark)
| 测试用例 | 查询 Query | 目标分块 Chunk ID | L1 向量期望 | L2 启发式期望 |
| :--- | :--- | :--- | :--- | :--- |
| **同义语义泛化** | 「MacBook 崩溃卡死」 | 苹果笔记本电脑系统故障处理分块 | **Top-1 召回 (成功)** | 无法命中 (预期失分) |
| **精准专有名词** | 「DAG_CYCLE_DETECTED」 | `chunk_arch_03` (含异常抛出明文) | **Top-1 召回 (成功)** | Top-1 召回 (成功) |

---

## 8. 实施路径规划与版本口径

> **版本节奏声明**：本 PRD 对应 **`v0.4.19` (Phase 4.19)**，插队至既定 `v0.4.20` 之前。工程落地时同步更新 `ROADMAP.md` 的 Current Stage 图与里程碑表、`NEXT_STEPS.md` 的 Upcoming Milestone 段落。

```
[Phase 4.19 Milestone 交付计划]
  ├── Step 1: 存储升级与索引核心 (FlatVectorIndex & IndexedDB v6)
  ├── Step 2: 纯前端多源 Embedding 客户端 (BrowserEmbeddingClient，含 index 排序)
  ├── Step 3: LocalKnowledgeAdapter 端侧三模重构与三态降级指示 (vector_status)
  ├── Step 4: 知识库上传分块向量化进度条与失效重建 UI
  └── Step 5: 契约测试挂载、基线实验验证与版本对齐
```
