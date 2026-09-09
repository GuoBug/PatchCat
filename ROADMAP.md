# 🗺️ PatchCat Product Roadmap

> **Current Stage**: `v0.2.0` (Released ✅)  
> **Last Updated**: 2026-09-09  
> **Positioning**: A local-first, zero-setup, visual high-performance AI prompt workflow orchestrator  

[English](#english) | [简体中文](#简体中文)

---

<a name="english"></a>
## English

### 🧭 Version Evolution Overview

```
v0.1.0 (Done ✅)              v0.2.0 (Done ✅)                 v0.3.0 (Released ✅)            v1.0.0 (Production Ready)
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│ • Kahn DAG Engine│  ───▶  │ • Dual-Mode Store│  ───▶  │ • IF/ELSE Branch │  ───▶  │ • Docker Deploy  │
│ • React Flow 12  │        │ • RAG Knowledge  │        │ • HTTP Request   │        │ • Team Collab    │
│ • Dark Canvas    │        │ • Canvas RAG Node│        │ • Chat Debug     │        │ • RBAC & Auth    │
│ • 5 Core Nodes   │        │ • FastAPI Backend│        │ • API Publishing │        │ • LangFuse Trace │
└──────────────────┘        └──────────────────┘        └──────────────────┘        └──────────────────┘
```

---

### 🔮 Future Milestone Details

#### Phase 4 — v0.4.0: Agent Capabilities & Advanced RAG

| Feature | Description |
|:---|:---|
| **Function Calling / Tool Use** | LLM nodes can declare tool schemas and auto-route tool_calls responses |
| **Agent ReAct Loop** | LLM → Decide → Tool → Feedback → Loop until complete |
| **Conversation Memory** | Buffer Memory, Summary Memory, Vector Memory strategies |
| **Hybrid Search (BM25 + Dense)** | RRF weighted fusion for improved retrieval accuracy |
| **Reranker Integration** | Cohere / BGE reranker for knowledge retrieval refinement |
| **Sub-workflow Node** | Package existing workflows as reusable composite nodes |

#### Phase 5 — v1.0.0: Production & Enterprise Delivery

| Feature | Description |
|:---|:---|
| **Docker Private Deployment** | Standard `docker-compose.yml` with frontend + backend + PostgreSQL pgvector |
| **User System & RBAC** | Registration, login, role-based access control |
| **Workflow Version Control** | Git-style versioning with diff and rollback |
| **LangFuse / OpenTelemetry Tracing** | Full execution trace integration for observability |
| **Execution History Dashboard** | Persistent run history with token usage analytics |
| **Team Workspace & Sharing** | Collaborative editing, read-only preview links, encrypted export |

---

### 📜 Completed Milestones

- [x] **Phase 0**: Core Topological Scheduler & Visual Canvas (2026-08-28 ~ 08-31)
- [x] **Phase 0.5**: Multi-Model Ecosystem, Sanitized Logging & i18n (2026-09-01 ~ 09-02 AM)
- [x] **Phase 1**: Drawer-Style Multi-Workflow Management & Dual-Mode Storage (2026-09-02 PM)
- [x] **Phase 2**: RAG Knowledge Base & Canvas Retrieval Node (2026-09-03)
- [x] **Phase 2.5**: Knowledge Base UX Polish, Document Parsers & Visualization (2026-09-04 ~ 09-08)
- [x] **Phase 3**: Conditional Routing, External Integration & Interactive Debugging (2026-09-09)

---

---

<a name="简体中文"></a>
## 简体中文

### 🧭 版本演进路线总览

```
v0.1.0 (已达成 ✅)            v0.2.0 (已达成 ✅)               v0.3.0 (当前发版 ✅)            v1.0.0 (生产就绪)
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│ • Kahn DAG 调度  │  ───▶  │ • 双模存储与后端  │  ───▶  │ • IF/ELSE 条件分支│  ───▶  │ • Docker 交付    │
│ • React Flow 12  │        │ • RAG 知识库体系  │        │ • HTTP 请求节点   │        │ • 团队协同分享   │
│ • 暗黑画布       │        │ • 画布检索节点    │        │ • Chat 调试面板   │        │ • 权限与认证     │
│ • 5 种核心节点   │        │ • FastAPI 后端    │        │ • API 一键发布    │        │ • LangFuse 链路  │
└──────────────────┘        └──────────────────┘        └──────────────────┘        └──────────────────┘
```

---

### 🔮 未来里程碑详细规划

#### Phase 4 — v0.4.0：Agent 能力与高级 RAG

| 功能 | 描述 |
|:---|:---|
| **Function Calling / 工具调用** | LLM 节点可声明工具 Schema 并自动路由 tool_calls 响应 |
| **Agent ReAct 循环** | LLM → 判断 → 工具 → 反馈 → 循环直至完成 |
| **对话记忆 (Memory)** | Buffer Memory、Summary Memory、Vector Memory 多种记忆策略 |
| **混合检索 (BM25 + 稠密向量)** | RRF 加权融合，提升检索准确率 |
| **Reranker 重排序** | Cohere / BGE 重排序器增强知识库检索精度 |
| **子工作流节点** | 将已有工作流打包为可复用的复合节点 |

#### Phase 5 — v1.0.0：生产交付与企业级功能

| 功能 | 描述 |
|:---|:---|
| **Docker 私有化部署** | 标准 `docker-compose.yml`（前后端 + PostgreSQL pgvector） |
| **用户系统 & RBAC** | 注册、登录、基于角色的访问控制 |
| **工作流版本控制** | Git 风格版本管理，支持 diff 与回滚 |
| **LangFuse / OpenTelemetry 链路追踪** | 全链路执行追踪，提供可观测性 |
| **执行历史仪表盘** | 持久化运行记录与 Token 消耗分析 |
| **团队工作空间与分享** | 协同编辑、只读预览链接、加密导出包 |

---

### 📜 已交付历史里程碑

- [x] **Phase 0**：核心拓扑调度引擎与可视化画布构建 (2026-08-28 ~ 08-31)
- [x] **Phase 0.5**：多模型生态适配、三层脱敏日志与国际化 (2026-09-01 ~ 09-02 上午)
- [x] **Phase 1**：抽屉式多流程管理与双模存储架构 (2026-09-02 下午)
- [x] **Phase 2**：RAG 知识库体系与画布检索节点全链路闭环 (2026-09-03)
- [x] **Phase 2.5**：知识库可视化管理、文档解析器与体验增强 (2026-09-04 ~ 09-08)
- [x] **Phase 3**：条件路由、外部集成与交互式调试 (2026-09-09)
