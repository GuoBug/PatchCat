# 开发日志：第二阶段 RAG 知识库体系与画布节点全链路闭环

> **日期**: 2026-09-03  
> **记录人**: Guo Qiang (GuoBug) & Antigravity (AI Pair Programming)  
> **阶段**: 第二阶段（Phase 2: RAG Pipeline & Canvas Integration）  
> **关联 PRD**: [PRD-006: 知识库管理、文档切片与画布 RAG 检索节点规范](../01-prd/PRD-006-Knowledge-Base-and-RAG-Retrieval.md)  
> **关联架构**: [Phase 2: 知识库（RAG）向量引擎与数据建模技术方案](../02-architecture/phase-2-knowledge-base-and-rag-architecture.md)  

---

## 1. 阶段目标与背景 (Context & Goals)

自第三篇技术博客《从 0 到 1 打造 AI 编排器（三）：告别单画布，解锁多流程管理与双模存储》敲定发布后，项目正式由“基础底座与多流程管理”迈向“**检索增强生成（RAG）**”核心能力构建。

在这一阶段，我们旨在为 PatchCat 引入工业级私有文档检索能力，让人机协同的工作流不仅能处理纯 Prompt 逻辑，更能基于私有知识库进行精准溯源与问答。

---

## 2. 界面交互与细节体验打磨 (UI & Brand Polish)

在深入 RAG 编码前，针对前期反馈的交互与展示细节进行了专项优化：
1. **工作流抽屉拉手重构**：
   - 将原有位于顶栏的展开/折叠按钮移除，重构为**左侧贴边凸出的浮动标签拉手（`<<` / `>>` Tab Handle）**；
   - 保证了无论画布如何拖拽平移，拉手均始终固定在视口边缘，使得抽屉的呼出与收起更加自然直观。
2. **品牌矢量 Logo 响应式防形变**：
   - 修复了在窄屏或移动端分辨率下，PatchCat 矢量猫咪 Logo 因 flex 布局导致的偶发受挤压形变问题；
   - 集中规范化了项目中所有 GitHub 仓库与开源文档外链。

---

## 3. 核心研发过程（第二阶段 4 步全景落地）

本阶段严格对标开源标杆 **Dify** 的知识库底层设计，结合 PatchCat 画布流编排定位，分 4 步扎实落地：

### Step 1: 工业级三层数据建模与知识库 CRUD
- **三层递进关系模型**：`KnowledgeBaseORM` ➔ `DocumentORM` ➔ `DocumentChunkORM`；
  - 知识库层（`KnowledgeBase`）：维护服务商（OpenAI/硅基/Ollama）、模型维度（1536/1024/768）、检索策略及文档/切片计数缓存；
  - 文档层（`Document`）：记录原始文件名、文件大小、字符总数与状态流转机（`queuing ➔ indexing ➔ completed`）；
  - 切片层（`DocumentChunk`）：记录段落自然序号 `position`、纯文本 `content`、Token 估算数、稠密向量 `embedding`、命中热度 `hit_count` 及可用开关。
- **RESTful API 交付**：
  - `GET /api/v1/knowledge-bases`（支持模糊搜索与文档切片统计）；
  - `POST /api/v1/knowledge-bases`（新建知识库）；
  - `GET/PUT/DELETE /api/v1/knowledge-bases/{id}`（详情、重命名与安全级联删除）；
  - `GET /api/v1/knowledge-bases/{id}/documents`（文档子列表）。

### Step 2: ETL 文本清洗、滑动窗口分块器与预览接口
- **Dify 级预清洗引擎 (`server/app/services/rag/cleaner.py`)**：
  - 自动规约所有换行符（`\r\n`, `\r` ➔ `\n`）；
  - 连续 3 个及以上换行压缩为 2 个换行（`\n\n`）；
  - 转换制表符与 Unicode 不间断空格（`\u00a0`），压缩单行内连续多余空格。
- **带语义重叠的滑动窗口分块器 (`server/app/services/rag/chunker.py`)**：
  - 多级回退机制：自然段落（`\n\n`）优先 ➔ 单换行（`\n`）降级 ➔ 标点分句（`。！？.!?`）➔ 步长截断；
  - 边界重叠（`chunk_overlap`，默认 50 字符）：相邻切片间保留尾部重叠，彻底解决断章取义问题；
  - 轻量中英文混合 Token 估算器 `estimate_tokens`。
- **即时切片预览与入库**：
  - `POST /api/v1/preview-chunks`：无副作用即时返回清洗后字符数、切片列表与 Token 分布；
  - `POST /api/v1/knowledge-bases/{kb_id}/documents`：上传文档自动切片并批量入库，同步更新知识库统计指标。

### Step 3: Embedding 向量化引擎与余弦相似度检索
- **统一向量化客户端 (`server/app/services/rag/embedder.py`)**：
  - 接入主流模型：OpenAI `text-embedding-3-small`、硅基流动 BGE、本地 Ollama；
  - **确定性离线特征向量生成器 (`generate_deterministic_embedding`)**：基于文本 Hash 与 Bigram 特征投影为单位向量（模长 1.0），词汇重叠的文本相似度天然更高。**确保在无网络、无 API Key 的环境下，单元测试与本地开发 100% 毫秒级闭环**。
- **余弦相似度检索器 (`server/app/services/rag/retriever.py`)**：
  - 严谨的余弦相似度计算与极值防御；
  - 支持 Top-K 截断与 `score_threshold` 相似度阈值过滤；
  - 自动组装带引文来源与分数的 Markdown Context（`### [Document: manual.md (Similarity: 0.88)]`）；
  - 自动累加命中切片的 `hit_count` 热度指标。
- **接口集成**：提供 `POST /api/v1/knowledge-bases/{id}/retrieve` 语义检索端点。

### Step 4: 画布原生【知识库检索节点 (Knowledge Node)】与端到端编排
- **高质感青蓝画布节点 (`KnowledgeNode.tsx`)**：
  - 采用 Cyan 科技青色主题、Database 图标与实时动态状态显示；
  - 具备左侧输入桩（`in`）与右侧引文输出桩（`context`）；
  - 卡片实时显示绑定的目标知识库名称、当前引用的 `query` 变量及 `Top-K` 标签。
- **属性配置面板集成 (`PropertyPanel.tsx`)**：
  - 知识库选择/输入；
  - 查询语句配置（支持插值变量语法，如 `{{input_1.user_question}}`）；
  - `Top-K`（1~10）与 `Score Threshold`（0.0~1.0）实时滑块；
  - 结果格式与引文溯源友好提示。
- **调度引擎双模自适应 (`browser-engine.ts`)**：
  - 扩展 `case 'knowledge'`：连后台时自动向服务端请求真实向量语义召回，离线时自动启用高保真切片模拟；
  - 输出 `result`、`context`、`chunks`，供下游 `Prompt` 模板（如 `{{knowledge_1.result}}`）和 `LLM` 节点直接消费。
- **全套中英文国际化与词典映射**。

---

## 4. 质量保障与自动化测试成果

| 测试层级 | 测试命令 | 用例数 / 套件数 | 耗时 | 覆盖范围 |
| :--- | :--- | :---: | :---: | :--- |
| **后端 API & RAG 引擎** | `python -m pytest -v tests/` | **12 / 12 (100% 通过)** | 0.73s | 数据库 CRUD、ETL 清洗规约、分块重叠滑动窗口、向量模长归一化、余弦相似度极值、Top-K 语义召回与命中热度递增。 |
| **前端调度引擎 & UI** | `npm test` | **64 / 64 (100% 通过)** | 1.76s | Kahn 拓扑排序、变量插值、双模调度、安全脱敏、抽屉项目管理、知识库节点独立执行及 4 节点完整 RAG 流水线。 |
| **静态类型检查** | `npm run typecheck` | **0 错误** | 3.5s | 全局严格 TypeScript 类型安全（`tsc --noEmit`）。 |
| **生产构建** | `npm run build` | **0 错误** | 5.40s | Vite 生产 Bundle 编译成功，无任何打包异常。 |

---

## 5. 阶段性反思与下阶段规划

### 💡 人机协同心得 (Pair Programming Insights)
- **技术选型的克制与渐进**：在实现 RAG 时，没有盲目引入重型第三方全家桶或强行依赖 Docker pgvector，而是通过抽象 `embedder` 与 `retriever`，让 SQLite 本地模式在单机 Python 内存中直接做余弦相似度运算，既保证了零门槛离线开发体验，又保留了未来接入 pgvector 生产环境的无缝扩展性。
- **真实全链路闭环**：通过编写 4 节点的完整端到端测试（`Input` ➔ `Knowledge` ➔ `Prompt` ➔ `Output`），确保知识库检索不仅存在于后端 API，而是能在画布上真实流动、产生引文并喂给大模型。

### 🎯 下一步规划
- 增加预设工作流模版：【RAG 知识库增强问答】标准拓扑模版；
- 扩展文档解析能力：引入 PDF / DOCX 本地解析适配；
- 前端知识库管理抽屉/页面：支持在 UI 上可视化上传文档并查看切片分布。
