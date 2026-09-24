# 🗺️ PatchCat Product Roadmap

> **Current Stage**: `v0.4.12` (Released ✅)  
> **Last Updated**: 2026-09-24  
> **Positioning**: A production-grade, local-first deterministic AI workflow engine · interactive playground  

[English](#english) | [简体中文](#简体中文)

---

<a name="english"></a>
## English

### 🧭 Evolution Cadence & Philosophy

PatchCat adheres to a **Micro-Milestone cadence (~0.0.2 version increments)** and a **Local-First, Progressive Enhancement** architecture. Each micro-release focuses on a tightly scoped, fully verified feature slice with zero regressions, ironclad reliability watchdogs, and zero superficial testing theater.

```
v0.4.11 (Current) ──► v0.4.12 (Local BM25) ──► v0.4.14 (Reranker)
                                                      │
v0.6.0 (MCP & Docker) ◄── v0.5.8 (Snapshots) ◄── v0.5.6 (Rolling Summary) ◄───┘
        │
        └──► v1.0.0 (Enterprise Ready)
```


---

### 🔮 Future Micro-Milestone Details

| Version | Focus Theme | Specification & Architecture Docs | Key Deliverables |
|:---|:---|:---|:---|
| **`v0.4.4`** | **Agent Hardening & Config** | • [`PRD-011`](docs/01-prd/PRD-011-Agent-Capabilities-and-Tool-Use.md)<br>• [`Config Reference`](docs/05-configuration/runtime-parameters-reference.md) | • Token budget limiter (0 = unlimited)<br>• Tool call deadlock breaker<br>• Central runtime defaults (`src/config/runtime-defaults.ts`)<br>• 5-tab Settings redesign with Export/Import backup |
| **`v0.4.6`** | **Canvas Ergonomics & Low-Code** | • [`PRD-012`](docs/01-prd/PRD-012-Canvas-Ergonomics-and-Interactive-Productivity.md)<br>• [`PRD-013`](docs/01-prd/PRD-013-Empty-Canvas-Onboarding-Template-Gallery-and-Node-Ergonomics.md) | • Multi-node copy & paste (`Ctrl+C` / `Ctrl+V`)<br>• Canvas undo/redo stack (`Ctrl+Z` / `Ctrl+Y`)<br>• In-place node local retry<br>• 8 Template gallery & empty canvas cards |
| **`v0.4.8`** | **Run Observability & OTel Trace** | • [`PRD-015`](docs/01-prd/PRD-015-Run-Observability-Trace-Inspection-and-OTel-Alignment.md)<br>• [`Dev Log 4.8`](docs/04-dev-notes/dev-log-phase-4-8-run-observability-and-opentelemetry.md) | • Recent 10 execution runs history panel with duration & tokens<br>• Step data snapshot inspector<br>• OTel JSON export (Langfuse / APM ready)<br>• Structured log search with keyword, level, node filters |
| **`v0.4.10`** | **Immutable Checkpoint & Resumption** | • [`PRD-016`](docs/01-prd/PRD-016-Immutable-Checkpointing-and-Resumable-DAG-Execution.md)<br>• [`Dev Log 4.10`](docs/04-dev-notes/dev-log-phase-4-10-immutable-checkpointing-and-resumable-dag.md) | • IndexedDB immutable snapshot storage<br>• In-place node resumption (`resumeFrom(nodeId)`) reusing 100% upstream results<br>• Automated dirty state detection and incremental DAG pruning scheduler |
| **`v0.4.11`** | **Storage Hardening & Ephemeral Stream** | • [`PRD-017`](docs/01-prd/PRD-017-Local-Data-Sovereignty-and-Storage-Hardening.md)<br>• [`ADR-003`](docs/04-dev-notes/adr-003-event-sourcing-vs-checkpointing-and-local-first-lessons.md) | • Ephemeral channel isolation: LLM Streaming Tokens in-memory only (0 DB writes)<br>• Snapshot FIFO ring-buffer (max 5 checkpoints per workflow)<br>• Metadata-First catalog separation (`workflows_meta` vs lazy `workflows_payload`)<br>• Guardrails: No bespoke frameworks, no WASM SQLite, strict `IStorageAdapter` |
| **`v0.4.12`** | **Local Hybrid Search (BM25 + Vectors)** | • [`PRD-006`](docs/01-prd/PRD-006-Knowledge-Base-and-RAG-Retrieval.md)<br>• [`RAG Architecture`](docs/02-architecture/phase-2-knowledge-base-and-rag-architecture.md) | • Zero-dependency in-memory BM25 inverted index for browser Local BYOK mode<br>• Reciprocal Rank Fusion (RRF) algorithm combining lexical and semantic vectors<br>• Retrieval score visualization & keyword highlight chips |
| **`v0.4.13`** | **Local Data Sovereignty & Crypto Vault** | • [`PRD-017`](docs/01-prd/PRD-017-Local-Data-Sovereignty-and-Storage-Hardening.md)<br>• [`ADR-003`](docs/04-dev-notes/adr-003-event-sourcing-vs-checkpointing-and-local-first-lessons.md) | • Web Crypto API (`SubtleCrypto` AES-256-GCM) master-passphrase local encryption vault<br>• Zero plain-text API keys in LocalStorage/IndexedDB<br>• 1-Click Sanitized Workflow Export modal (stripping API keys & local paths)<br>• Storage adapter contract freezing & offline export verification |
| **`v0.4.14`** | **Reranker Cross-Encoder API** | • [`PRD-006`](docs/01-prd/PRD-006-Knowledge-Base-and-RAG-Retrieval.md) | • Unified client for SiliconFlow, Cohere, and Jina Rerank APIs<br>• Top-N threshold and reranking toggle in Knowledge Retrieval Node<br>• Context noise reduction and token compression benchmark |
| **`v0.4.16`** | **Long-Term Memory & Rolling Summary** | • [`PRD-010`](docs/01-prd/PRD-010-Conversation-Memory-and-Storage-Architecture.md) | • Background LLM rolling summarization for conversational memory pruning<br>• Conversation memory token cost breakdown & inspection<br>• Per-entry memory editing and manual pruning |
| **`v0.4.18`** | **Memory Node & Workflow Version Diff** | • [`PRD-010`](docs/01-prd/PRD-010-Conversation-Memory-and-Storage-Architecture.md)<br>• [`Local-First Strategy`](docs/02-architecture/local-first-architecture-and-evolution-strategy.md) | • Dedicated `MemoryNode` component wireable to multiple Agent/LLM nodes<br>• Local workflow version snapshots with visual JSON diff & rollback<br>• Portable `.patchcat` single-file archive bundle |
| **`v0.6.0`** | **MCP Tool Export & Docker Deployment** | • [`Whitepaper`](docs/02-architecture/patchcat-architecture-whitepaper.md) | • 1-Click export visual workflow as standard MCP (Model Context Protocol) Tool<br>• Standalone zero-dependency TypeScript headless runner script export<br>• Production `docker-compose.yml` packaging Vite, FastAPI, and PostgreSQL `pgvector` |
| **`v1.0.0`** | **Enterprise Production Baseline** | • [`Graph Schema Spec`](docs/02-architecture/graph-schema-specification.json) | • Core Graph Schema v1 frozen with backward compatibility guarantee<br>• Multi-user system & RBAC role-based access control<br>• Collaborative real-time workspace & encrypted shareable preview links |

---

### 📜 Completed Milestones

- [x] **Phase 0**: Core Topological Scheduler & Visual Canvas (2026-08-28 ~ 08-31)
- [x] **Phase 0.5**: Multi-Model Ecosystem, Sanitized Logging & i18n (2026-09-01 ~ 09-02 AM)
- [x] **Phase 1**: Drawer-Style Multi-Workflow Management & Dual-Mode Storage (2026-09-02 PM)
- [x] **Phase 2**: RAG Knowledge Base & Canvas Retrieval Node (2026-09-03)
- [x] **Phase 2.5**: Knowledge Base UX Polish, Document Parsers & Visualization (2026-09-04 ~ 09-08)
- [x] **Phase 3**: Conditional Routing, External Integration & Interactive Debugging (2026-09-09)
- [x] **Phase 3.1**: Multi-Turn Conversation Memory & Dual-Tier Storage Architecture (2026-09-11)
- [x] **Phase 4 (v0.4.2)**: Agent Capabilities, ReAct Autonomous Loop & Multi-Modal Tool Calling (2026-09-13)
- [x] **Phase 4.1 (v0.4.4)**: Agent Runtime Hardening, Global Settings Architecture & Reliability Baseline (2026-09-16)
- [x] **Phase 4.2 (v0.4.6)**: Canvas Ergonomics, Comprehensive Tooltip System, Pinpoint Error Diagnostics & Interactive Productivity (2026-09-17)
- [x] **Phase 4.3 (v0.4.6)**: Empty Canvas Guidance, Template Showcase Gallery, Progressive Low-Code Node Suite & Draft Recovery Safeguards (2026-09-17)
- [x] **Phase 4.7 (v0.4.7)**: Asuswrt-Merlin Router Plugin & Lightweight Go Gateway (2026-09-21)
- [x] **Phase 4.8 (v0.4.8)**: Run Observability, Step Snapshot Inspection & OpenTelemetry Tracing (2026-09-22)
- [x] **Phase 4.10 (v0.4.10)**: Immutable Checkpointing & Resumable DAG Execution (2026-09-23)
- [x] **Phase 4.11 (v0.4.11)**: Storage Hardening & Ephemeral Stream (2026-09-23)

---

---

<a name="简体中文"></a>
## 简体中文

> **当前阶段**：`v0.4.12` (已发布 ✅)  
> **最近更新**：2026-09-24  
> **定位**：生产级、本地优先的确定性 AI 工作流引擎 · 交互式实验工坊  

### 🧭 演进节奏与设计哲学

PatchCat 坚守 **`0.0.2` 微步演进路线（Micro-Milestone Cadence）** 与 **Local-First 纯本地免配置渐进增强** 原则。每个微版本聚焦于一个定义明确、边界清晰且彻底验证的特性切片，坚决杜绝“大版本跳跃与功能堆叠”，淘汰形式主义测试，死守零崩溃、零死锁、零假死底线。

```
v0.4.11 (当前版本) ──► v0.4.12 (纯本地BM25) ──► v0.4.14 (Reranker重排)
                                                                  │
v0.6.0 (MCP与Docker大考) ◄── v0.5.8 (快照与归档) ◄── v0.5.6 (长效会话记忆) ◄───┘
        │
        └──► v1.0.0 (企业生产交付)
```

---

### 🔮 未来微步里程碑规划明细

| 版本号 | 核心主题 | 核心设计文档与架构规约 | 关键交付内容 |
|:---|:---|:---|:---|
| **`v0.4.4`** | **Agent 运行时加固与配置规范** | • [`PRD-011`](docs/01-prd/PRD-011-Agent-Capabilities-and-Tool-Use.md)<br>• [`配置参考手册`](docs/05-configuration/runtime-parameters-reference.md) | • Token 消耗硬熔断（`0` 为不限）<br>• 工具调用死锁打破器<br>• 运行时默认值中枢（`src/config/runtime-defaults.ts`）<br>• 设置页 5 栏重构与配置备份导出 |
| **`v0.4.6`** | **画布高频交互生产力与工效** | • [`PRD-012`](docs/01-prd/PRD-012-Canvas-Ergonomics-and-Interactive-Productivity.md)<br>• [`PRD-013`](docs/01-prd/PRD-013-Empty-Canvas-Onboarding-Template-Gallery-and-Node-Ergonomics.md) | • 节点多选复制粘贴（`Ctrl+C/V`）<br>• 画布撤销重做（`Ctrl+Z/Y`）<br>• 单节点就地局部重试与 ErrorBoundary<br>• 8 大模板画廊与空画布引导卡片 |
| **`v0.4.8`** | **运行可观测性与 OTel 对齐** | • [`PRD-015`](docs/01-prd/PRD-015-Run-Observability-Trace-Inspection-and-OTel-Alignment.md)<br>• [`实战日志 4.8`](docs/04-dev-notes/dev-log-phase-4-8-run-observability-and-opentelemetry.md) | • 最近 10 次执行历史面板与 Token 统计<br>• 节点单步数据快照检查器<br>• OTel 标准 JSON 导出（对接 Langfuse 等 APM）<br>• 结构化日志关键词与级别过滤 |
| **`v0.4.10`** | **端侧不可变快照与断点续跑** | • [`PRD-016`](docs/01-prd/PRD-016-Immutable-Checkpointing-and-Resumable-DAG-Execution.md)<br>• [`实战日志 4.10`](docs/04-dev-notes/dev-log-phase-4-10-immutable-checkpointing-and-resumable-dag.md) | • IndexedDB 不可变快照存储（`checkpoints` 仓库）<br>• 失败节点就地续跑（`resumeFrom(nodeId)`），祖先 100% 缓存复用<br>• 脏状态自动感知与增量 DAG 动态裁剪 |
| **`v0.4.11`** | **底座存储防膨胀与时态隔离** | • [`PRD-017`](docs/01-prd/PRD-017-Local-Data-Sovereignty-and-Storage-Hardening.md)<br>• [`ADR-003`](docs/04-dev-notes/adr-003-event-sourcing-vs-checkpointing-and-local-first-lessons.md) | • 瞬态信道（Ephemeral）隔离：Streaming Token 仅驻留内存（0 磁盘写）<br>• 快照 FIFO 环形淘汰机制（单流程上限 5 个 Checkpoint 防膨胀）<br>• Metadata-First 目录分层（`workflows_meta` 与大图 Payload 懒加载）<br>• 架构红线：死守标准栈、杜绝 WASM SQLite、强隔离 `IStorageAdapter` |
| **`v0.4.12`** | **纯本地轻量混合检索 (BM25+向量)** | • [`PRD-006`](docs/01-prd/PRD-006-Knowledge-Base-and-RAG-Retrieval.md)<br>• [`RAG 架构白皮书`](docs/02-architecture/phase-2-knowledge-base-and-rag-architecture.md) | • 纯前端轻量内存分词与倒排索引（Local 模式零依赖）<br>• RRF (Reciprocal Rank Fusion) 倒排与向量加权融合召回算法<br>• 检索匹配分值与关键词可视化高亮 |
| **`v0.4.13`** | **本地数据主权暗室与资产脱敏** | • [`PRD-017`](docs/01-prd/PRD-017-Local-Data-Sovereignty-and-Storage-Hardening.md)<br>• [`ADR-003`](docs/04-dev-notes/adr-003-event-sourcing-vs-checkpointing-and-local-first-lessons.md) | • 浏览器原生 Web Crypto API (`SubtleCrypto` AES-256-GCM) 本地主口令暗室<br>• LocalStorage/IndexedDB 零明文存储 API Key（免疫插件窃密）<br>• 工作流资产「一键安全脱敏导出」弹窗（剥离 Key 与本地物理路径）<br>• 存储适配器契约封板，单机零信任离线导入验证 |
| **`v0.4.14`** | **交叉重排 Reranker API 集成** | • [`PRD-006`](docs/01-prd/PRD-006-Knowledge-Base-and-RAG-Retrieval.md) | • 接入 SiliconFlow、Cohere、Jina 等轻量重排 API<br>• 知识库检索节点新增 Rerank 开关与 Top-N 截断滑块<br>• 上下文去噪与压缩基准验证 |
| **`v0.4.16`** | **长效会话记忆与后台滚动摘要** | • [`PRD-010`](docs/01-prd/PRD-010-Conversation-Memory-and-Storage-Architecture.md) | • 对话历史超出窗口时，轻量模型后台滚动生成浓缩摘要<br>• Chat 面板直观展示实时轮次与长效摘要 Token 开销<br>• 会话历史查看与单条记忆手动修正/清除 |
| **`v0.4.18`** | **显式 Memory 节点与版本快照** | • [`PRD-010`](docs/01-prd/PRD-010-Conversation-Memory-and-Storage-Architecture.md)<br>• [`Local-First 演进白皮书`](docs/02-architecture/local-first-architecture-and-evolution-strategy.md) | • 画布新增 `MemoryNode` 实体节点，支持挂载至多个 Agent/LLM<br>• 本地工作流版本快照（打标、JSON Diff 差异对比与一键回退）<br>• 一体化 `.patchcat` 绿色工程归档包 |
| **`v0.6.0`** | **MCP Tool 导出与 Docker 交付** | • [`架构白皮书`](docs/02-architecture/patchcat-architecture-whitepaper.md) | • 画布工作流一键导出为标准 MCP Tool（直接挂载至 Cursor / Claude）<br>• 独立无依赖 TypeScript 无头脚本导出（支持 Edge / Node.js 运行）<br>• 生产级 `docker-compose.yml`（Vite + FastAPI + PostgreSQL pgvector） |
| **`v1.0.0`** | **企业级生产基线与正式交付** | • [`图 Schema 规范`](docs/02-architecture/graph-schema-specification.json) | • 核心 Graph Schema v1 规范冻结并提供向前兼容性保障<br>• 用户系统与 RBAC 角色权限控制（可选企业层）<br>• 多人实时协同编辑、只读预览分享链接与加密导出 |

---

### 📜 已交付历史里程碑

- [x] **Phase 0**：核心拓扑调度引擎与可视化画布构建 (2026-08-28 ~ 08-31)
- [x] **Phase 0.5**：多模型生态适配、三层脱敏日志与国际化 (2026-09-01 ~ 09-02 上午)
- [x] **Phase 1**：抽屉式多流程管理与双模存储架构 (2026-09-02 下午)
- [x] **Phase 2**：RAG 知识库体系与画布检索节点全链路闭环 (2026-09-03)
- [x] **Phase 2.5**：知识库可视化管理、文档解析器与体验增强 (2026-09-04 ~ 09-08)
- [x] **Phase 3**：条件路由、外部集成与交互式调试 (2026-09-09)
- [x] **Phase 3.1**：多轮会话记忆与底层存储持久化架构 (2026-09-11)
- [x] **Phase 4 (v0.4.2)**：AI 智能体能力层、ReAct 自主循环与多模态工具调用 (2026-09-13)
- [x] **Phase 4.1 (v0.4.4)**：Agent 运行时加固、配置规范化与可靠性基线 (2026-09-16)
- [x] **Phase 4.2 (v0.4.6)**：画布工效学、全节点 1 句话精准悬停说明、精准报错诊断定焦与高频交互生产力 (2026-09-17)
- [x] **Phase 4.3 (v0.4.6)**：空画布灵感引导、场景模板画廊、节点渐进式无代码与草稿安全体系 (2026-09-17)
- [x] **Phase 4.7 (v0.4.7)**：华硕 Merlin 路由器插件包与轻量网关服务 (2026-09-21)
- [x] **Phase 4.8 (v0.4.8)**：运行可观测性、节点单步数据快照与 OpenTelemetry 标准对齐 (2026-09-22)
- [x] **Phase 4.10 (v0.4.10)**：端侧不可变 Checkpointing 与容错断点续跑 (2026-09-23)
- [x] **Phase 4.11 (v0.4.11)**：底座存储防膨胀治理与时态数据物理隔离 (2026-09-23)
