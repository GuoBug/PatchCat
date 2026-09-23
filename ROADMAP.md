# 🗺️ PatchCat Product Roadmap

> **Current Stage**: `v0.4.10` (Released ✅)  
> **Last Updated**: 2026-09-23  
> **Positioning**: A local-first, zero-setup, visual high-performance AI prompt workflow orchestrator  

[English](#english) | [简体中文](#简体中文)

---

<a name="english"></a>
## English

### 🧭 Evolution Cadence & Philosophy

PatchCat adheres to a **Micro-Milestone cadence (~0.0.2 version increments)** and a **Local-First, Progressive Enhancement** architecture. Each micro-release focuses on a tightly scoped, fully verified feature slice with zero regressions, ironclad reliability watchdogs, and zero superficial testing theater.

```
v0.4.10 (Current) ──► v0.4.12 (Local BM25) ──► v0.4.14 (Reranker)
                                                      │
v0.6.0 (MCP & Docker) ◄── v0.5.8 (Snapshots) ◄── v0.5.6 (Rolling Summary) ◄───┘
        │
        └──► v1.0.0 (Enterprise Ready)
```


---

### 🔮 Future Micro-Milestone Details

| Version | Focus Theme | Key Deliverables |
|:---|:---|:---|
| **`v0.4.4`** | **Agent Hardening, Central Config & Reliability** | • Token budget limiter (0 = unlimited)<br>• Tool call deadlock breaker (prompt hint on 2nd, circuit break on 3rd)<br>• Optional tool execution timeout watchdog in Global Settings<br>• Central runtime defaults (`src/config/runtime-defaults.ts`) eliminating magic numbers<br>• 5-tab Settings redesign with Export/Import backup (sensitive & sanitized modes)<br>• Single-language Danger Zone secondary confirmation matching<br>• Dedicated configuration reference documentation (`docs/05-configuration/`) |
| **`v0.4.6`** | **Canvas Ergonomics & Productivity** | • Multi-node copy & paste (`Ctrl+C` / `Ctrl+V`)<br>• Canvas undo & redo history stack (`Ctrl+Z` / `Ctrl+Y`)<br>• In-place node local retry without full graph re-execution<br>• Node-level ErrorBoundary for visual fault isolation |
| **`v0.4.8`** | **Run Observability, Token Cost & OpenTelemetry Tracing** | • Recent 10 execution runs history panel with duration and token counters<br>• Node-level step input/output data snapshot inspector<br>• OpenTelemetry / OpenInference specification alignment (Span tree, TTFT, per-node latency & cost)<br>• One-click export to standard OTel JSON (ready for Langfuse / APM ingestion)<br>• Structured log search with keyword, level, and node ID filters |
| **`v0.4.10`** | **Immutable Checkpointing & Incremental Subgraph Resumption** | • IndexedDB immutable execution snapshot storage<br>• In-place node resumption (`resumeFrom(nodeId)`) reusing 100% upstream results<br>• Automated dirty state detection and incremental DAG pruning scheduler |
| **`v0.4.12`** | **Local Lightweight Hybrid Search (BM25 + Vectors)** | • Zero-dependency in-memory BM25 inverted index for browser Local BYOK mode<br>• Reciprocal Rank Fusion (RRF) algorithm combining lexical and semantic vectors<br>• Retrieval score visualization & keyword highlight chips |
| **`v0.4.14`** | **Reranker Cross-Encoder API Integration** | • Unified client for SiliconFlow, Cohere, and Jina Rerank APIs<br>• Top-N threshold and reranking toggle in Knowledge Retrieval Node<br>• Context noise reduction and token compression benchmark |
| **`v0.4.16`** | **Long-Term Memory & Rolling Summarizer** | • Background LLM rolling summarization for conversational memory pruning<br>• Conversation memory token cost breakdown & inspection<br>• Per-entry memory editing and manual pruning |
| **`v0.4.18`** | **Canvas Explicit Memory Node & Workflow Version Snapshots** | • Dedicated `MemoryNode` component wireable to multiple Agent/LLM nodes<br>• Local workflow version snapshots with visual JSON diff & rollback<br>• Portable `.patchcat` single-file archive bundle (graph + prompts + knowledge slice) |
| **`v0.6.0`** | **MCP Tool Export, Headless Runtime & Docker Deployment** | • 1-Click export visual workflow as a standard MCP (Model Context Protocol) Tool for Cursor / Claude<br>• Standalone zero-dependency TypeScript headless runner script export (run on Node.js / Cloudflare Workers)<br>• Production `docker-compose.yml` packaging Vite, FastAPI, and PostgreSQL `pgvector`<br>• Automated health probes, initialization scripts, and deployment verification |
| **`v1.0.0`** | **Enterprise Production Baseline** | • Core Graph Schema v1 frozen with backward compatibility guarantee<br>• Multi-user system & RBAC role-based access control (optional enterprise layer)<br>• Collaborative real-time workspace & encrypted shareable preview links |

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

---

---

<a name="简体中文"></a>
## 简体中文

### 🧭 演进节奏与设计哲学

PatchCat 坚守 **`0.0.2` 微步演进路线（Micro-Milestone Cadence）** 与 **Local-First 纯本地免配置渐进增强** 原则。每个微版本聚焦于一个定义明确、边界清晰且彻底验证的特性切片，坚决杜绝“大版本跳跃与功能堆叠”，淘汰形式主义测试，死守零崩溃、零死锁、零假死底线。

```
v0.4.10 (当前版本) ──► v0.4.12 (纯本地BM25) ──► v0.4.14 (Reranker重排)
                                                                  │
v0.6.0 (MCP与Docker大考) ◄── v0.5.8 (快照与归档) ◄── v0.5.6 (长效会话记忆) ◄───┘
        │
        └──► v1.0.0 (企业生产交付)
```

---

### 🔮 未来微步里程碑规划明细

| 版本号 | 核心主题 | 关键交付内容 |
|:---|:---|:---|
| **`v0.4.4`** | **Agent 运行时加固、配置规范化与可靠性基线** | • Token 消耗硬熔断（`0` 为不限，正数生效，拦截负数）<br>• 重复工具调用死锁打破器（连续 2 次纠偏，连续 3 次熔断保护）<br>• 全局可选工具单步执行超时看门狗（默认关闭，防范外部挂起）<br>• 集中运行时默认值中枢（`src/config/runtime-defaults.ts`），彻底消灭魔法数字<br>• 全局设置 5 栏重构与一键配置导出/导入备份（支持脱敏与完整模式）<br>• 危险区二次输入确认根据当前界面语言智能单语匹配（中文只输中文，英文只输英文）<br>• 建立官方配置参考文档目录（`docs/05-configuration/`） |
| **`v0.4.6`** | **画布高频交互生产力、空画布引导与节点工效** | • 节点多选与快捷复制粘贴（`Ctrl+C` / `Ctrl+V`）<br>• 画布级撤销与重做历史栈（`Ctrl+Z` / `Ctrl+Y`）<br>• 单节点就地重试（Local Retry）与 ErrorBoundary 局部错误隔离<br>• 双态空画布英雄卡（新用户灵感引导 / 资深用户快速起手）<br>• 8 大业务场景模板画廊一键装配与 `fitView` 居中<br>• 松手即建连（Drop-to-Add）与 AABB 空间防碰撞算法（$\ge 40px$）<br>• 渐进式节点套件（Code 片段卡折叠、Prompt 静态契约 `@` 补全、Condition 规则 ⇄ JS 表达式双模）<br>• 实时保存状态灯、`beforeunload` 离开拦截与影子草稿崩溃恢复 |
| **`v0.4.8`** | **运行可观测性、Token 成本审计与 OpenTelemetry 标准对齐** | • 最近 10 次画布执行历史面板，展示状态、总耗时与 Token 消耗估算<br>• 节点单步输入/输出真实数据快照检查器<br>• 对齐 OpenTelemetry / OpenInference 工业标准（Span 树、TTFT 首字延迟、单节点耗时与 Token 账单）<br>• 支持一键导出标准 OTel JSON（可直接接入 Langfuse / Datadog 等 APM 观测平台）<br>• 日志面板关键词、级别与节点 ID 结构化过滤 |
| **`v0.4.10`** | **端侧不可变 Checkpointing 与容错断点续跑** | • 基于浏览器 IndexedDB 的不可变执行状态快照存储（Execution Snapshot）<br>• 失败节点就地断点续跑（`resumeFrom(nodeId)`），上游绿色节点结果 100% 复用，零 Token 重复浪费<br>• 脏状态（Dirty State）自动检测与增量有向子图动态裁剪调度 |
| **`v0.4.12`** | **纯本地轻量混合检索 (BM25 + 稠密向量)** | • 纯前端轻量内存分词与倒排索引（Local 模式零依赖）<br>• RRF (Reciprocal Rank Fusion) 倒排与向量加权融合召回算法<br>• 检索结果匹配分值与命中关键词可视化高亮 |
| **`v0.4.14`** | **交叉重排 Reranker API 深度集成** | • 接入 SiliconFlow、Cohere、Jina 等主流轻量重排 API<br>• 知识库检索节点新增 Rerank 开关与 Top-N 最终阈值滑块<br>• 上下文去噪与压缩基准验证 |
| **`v0.4.16`** | **长效会话记忆与后台滚动摘要** | • 对话历史超出窗口时，轻量模型后台滚动生成浓缩摘要<br>• Chat 面板直观展示实时轮次与长效摘要 Token 开销构成<br>• 会话历史查看与单条记忆手动修正/清除 |
| **`v0.4.18`** | **画布显式 Memory 独立节点与版本快照** | • 新增 `MemoryNode` 实体节点，支持在画布上连线挂载至多个 Agent/LLM 节点<br>• 本地工作流版本快照（打标、JSON Diff 差异对比与一键回退）<br>• 一体化 `.patchcat` 绿色工程归档包（节点图 + 关联 Prompt + 本地知识库切片无损迁移） |
| **`v0.6.0`** | **MCP 协议 Tool 导出、无头运行时与 Docker 私有交付** | • 画布工作流一键导出为标准 MCP (Model Context Protocol) Tool（直接挂载至 Cursor / Claude Desktop）<br>• 独立无依赖 TypeScript 无头脚本导出（可在 Node.js / Cloudflare Workers 等 Edge 端直接执行）<br>• 生产级 `docker-compose.yml`（Vite 静态前端 + FastAPI 异步后端 + PostgreSQL pgvector）<br>• 全量自动化回归测试，严格守住前端内存红线 (<35MB) |
| **`v1.0.0`** | **企业级生产基线与正式交付** | • 核心 Graph Schema v1 规范冻结并提供向前兼容性保障<br>• 用户系统与 RBAC 角色权限控制（作为可选企业层接入）<br>• 多人实时协同编辑、只读预览分享链接与加密导出 |

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
