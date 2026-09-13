# 📚 PatchCat Documentation Index

> Welcome to the PatchCat developer documentation. This directory contains Product Requirements Documents (PRD), System Architecture designs, API Specifications, and Development Notes.

[English](#english) | [简体中文](#简体中文)

> ⚡ **Development Next Steps**: See [`NEXT_STEPS.md`](../NEXT_STEPS.md)  
> 🗺️ **Product Roadmap**: See [`ROADMAP.md`](../ROADMAP.md)  
> 📜 **Changelog**: See [`CHANGELOG.md`](../CHANGELOG.md)  
> 🤝 **Contributing**: See [`CONTRIBUTING.md`](../CONTRIBUTING.md) | [`CONTRIBUTING_CN.md`](../CONTRIBUTING_CN.md)

---

<a name="english"></a>
## English

### 01. Product Requirement Documents (PRD)

| PRD | Title | Phase | Status |
|:---|:---|:---:|:---:|
| [PRD-001](01-prd/PRD-001-Workflow-Canvas.md) | Visual Workflow Canvas & Node Components | Phase 0 | ✅ Done |
| [PRD-002](01-prd/PRD-002-DAG-Execution-Engine.md) | DAG Topological Scheduler & Multi-Level Logger | Phase 0 | ✅ Done |
| [PRD-003](01-prd/PRD-003-Dual-Mode-Adapter.md) | Dual-Mode Execution Engine Adapter | Phase 0.5 | ✅ Done |
| [PRD-004](01-prd/PRD-004-Workflow-Project-Directory-Management.md) | Workflow Project & Hierarchical Directory Management | Phase 1 | ✅ Done |
| [PRD-005](01-prd/PRD-005-Dual-Mode-Storage-and-FastAPI-Backend.md) | Dual-Mode Storage Adapter & FastAPI Backend | Phase 1 | ✅ Done |
| [PRD-006](01-prd/PRD-006-Knowledge-Base-and-RAG-Retrieval.md) | Knowledge Base Management & Canvas RAG Node | Phase 2 | ✅ Done |
| [PRD-007](01-prd/PRD-007-Conditional-Branch-and-Dynamic-Routing.md) | **IF/ELSE Conditional Branch & Variable Aggregator** | Phase 3 | ✅ Done |
| [PRD-008](01-prd/PRD-008-HTTP-Request-Node.md) | **HTTP Request Node** | Phase 3 | ✅ Done |
| [PRD-009](01-prd/PRD-009-Chat-Debug-Panel-and-Workflow-API.md) | **Chat Debug Panel & Workflow API Publishing** | Phase 3 | ✅ Done |
| [PRD-010](01-prd/PRD-010-Conversation-Memory-and-Storage-Architecture.md) | **Conversation Memory & Persistent Storage** | Phase 3.1 | ✅ Done |
| [PRD-011](01-prd/PRD-011-Agent-Capabilities-and-Tool-Use.md) | **AI Agent Capabilities, ReAct Autonomous Loop & Tool Calling** | Phase 4 | ✅ Done |

---

### 02. System Architecture & Evolution Design

- [System Architecture & Data Flow Overview](02-architecture/system-architecture.md)
- [Zustand & Immer Global State Management](02-architecture/state-management.md)
- [Graph Schema Specification (JSON)](02-architecture/graph-schema-specification.json)
- [PatchCat Architecture Technical Whitepaper (RFC-101)](02-architecture/patchcat-architecture-whitepaper.md)
- [Phase 1: FastAPI + PostgreSQL Backend & Dual-Mode Storage](02-architecture/phase-1-backend-and-dual-storage-architecture.md)
- [Phase 2: Knowledge Base (RAG) Vector Engine & Data Modeling](02-architecture/phase-2-knowledge-base-and-rag-architecture.md)
- [Phase 3: Conversation Memory & Dual-Tier Storage Architecture](02-architecture/phase-3-conversation-memory-and-storage-architecture.md)

---

### 03. API Specifications & Interface Contracts

- [Client Engine Interface (TypeScript)](03-api/client-engine-interface.ts)
- [OpenAPI 3.0 Specification (YAML)](03-api/openapi-spec.yaml)

---

### 04. Architecture Decision Records & Dev Notes

#### Decision Records (ADR)
- [ADR-001: Visual Canvas Engine Selection (XYFlow / React Flow v12)](04-dev-notes/adr-001-canvas-engine-selection.md)
- [ADR-002: Dual-Engine Architecture Strategy](04-dev-notes/adr-002-dual-engine-architecture.md)

#### Technical Deep Dives
- [i18n Architecture & Fullscreen Settings Page](04-dev-notes/i18n-and-settings-architecture.md)
- [Preflight Model Check & Flow Validation (Dry-Run)](04-dev-notes/preflight-model-check-and-flow-validation.md)
- [Engineering Test Coverage & Runtime Benchmarks](04-dev-notes/engineering-test-coverage-and-runtime-benchmarks.md)
- [Feature Overview & Testing Guide](04-dev-notes/feature-overview-and-testing-guide.md)
- [User Manual & Node Configuration Guide](04-dev-notes/user-manual-and-component-guide.md)

#### Development Evolution Logs
- [📖 Phase 0: Core DAG Scheduler & Visual Canvas](04-dev-notes/dev-log-phase-0-core-engine-and-visual-canvas.md)
- [📖 Phase 0.5: Multi-Model Ecosystem, Sanitized Logging & i18n](04-dev-notes/dev-log-phase-0-5-multi-model-logging-and-i18n.md)
- [📖 Phase 1: Drawer-Style Multi-Workflow Management & Dual-Mode Storage](04-dev-notes/dev-log-phase-1-drawer-management-and-dual-storage.md)
- [📖 Phase 2: RAG Knowledge Base & Canvas Retrieval Node](04-dev-notes/dev-log-phase-2-rag-knowledge-base-and-canvas-node.md)
- [📖 Phase 3: Conditional Routing, External Integration & Interactive Debugging](04-dev-notes/dev-log-phase-3-conditional-routing-and-graph-pruning.md)
- [📖 Phase 3: Chat Debug Panel & API Publishing](04-dev-notes/dev-log-phase-3-chat-debug-and-api-publishing.md)
- [📖 Phase 4: AI Agent Capabilities, ReAct Autonomous Loop & Multi-Modal Tool Calling](04-dev-notes/dev-log-phase-4-agent-capabilities-and-react-loop.md)
- [📝 Blog 07: Giving LLMs Hands and Feet! Agent Nodes & Tools Architecture Deep Dive](04-dev-notes/blog-07-agent-capabilities-and-tools-design.md)

---

### 05. Security & Quality Audits

- [安全审计与代码质量简报](安全TODO/安全审计与代码质量简报.md)

---

---

<a name="简体中文"></a>
## 简体中文

### 01. 产品需求文档 (PRD)

| PRD | 标题 | 阶段 | 状态 |
|:---|:---|:---:|:---:|
| [PRD-001](01-prd/PRD-001-Workflow-Canvas.md) | 可视化画布与节点组件规格说明 | Phase 0 | ✅ 已完成 |
| [PRD-002](01-prd/PRD-002-DAG-Execution-Engine.md) | DAG 拓扑调度器与多级日志系统 | Phase 0 | ✅ 已完成 |
| [PRD-003](01-prd/PRD-003-Dual-Mode-Adapter.md) | 双模执行引擎适配器规范 | Phase 0.5 | ✅ 已完成 |
| [PRD-004](01-prd/PRD-004-Workflow-Project-Directory-Management.md) | 工作流项目目录分层管理 | Phase 1 | ✅ 已完成 |
| [PRD-005](01-prd/PRD-005-Dual-Mode-Storage-and-FastAPI-Backend.md) | 双模存储适配器与 FastAPI 后端集成 | Phase 1 | ✅ 已完成 |
| [PRD-006](01-prd/PRD-006-Knowledge-Base-and-RAG-Retrieval.md) | 知识库管理与画布 RAG 检索节点 | Phase 2 | ✅ 已完成 |
| [PRD-007](01-prd/PRD-007-Conditional-Branch-and-Dynamic-Routing.md) | **IF/ELSE 条件分支与 Variable 聚合节点** | Phase 3 | ✅ 已完成 |
| [PRD-008](01-prd/PRD-008-HTTP-Request-Node.md) | **HTTP 请求节点** | Phase 3 | ✅ 已完成 |
| [PRD-009](01-prd/PRD-009-Chat-Debug-Panel-and-Workflow-API.md) | **Chat 调试面板与工作流 API 发布** | Phase 3 | ✅ 已完成 |
| [PRD-010](01-prd/PRD-010-Conversation-Memory-and-Storage-Architecture.md) | **多轮会话记忆与端侧持久化存储架构** | Phase 3.1 | ✅ 已完成 |
| [PRD-011](01-prd/PRD-011-Agent-Capabilities-and-Tool-Use.md) | **AI Agent 智能体能力层、ReAct 自主循环与多模态工具调用** | Phase 4 | ✅ 已完成 |

---

### 02. 系统架构与演进设计

- [全局系统架构与数据流总览](02-architecture/system-architecture.md)
- [Zustand & Immer 全局状态管理](02-architecture/state-management.md)
- [工作流图 JSON 格式强类型规范](02-architecture/graph-schema-specification.json)
- [PatchCat 架构技术白皮书 (RFC-101)](02-architecture/patchcat-architecture-whitepaper.md)
- [Phase 1: FastAPI + PostgreSQL 后端与双模存储设计](02-architecture/phase-1-backend-and-dual-storage-architecture.md)
- [Phase 2: 知识库（RAG）向量引擎与数据建模方案](02-architecture/phase-2-knowledge-base-and-rag-architecture.md)
- [Phase 3: 多轮会话记忆与底层存储持久化架构](02-architecture/phase-3-conversation-memory-and-storage-architecture.md)

---

### 03. API 契约与接口定义

- [前端引擎核心 TypeScript 接口](03-api/client-engine-interface.ts)
- [OpenAPI 3.0 后端接口契约](03-api/openapi-spec.yaml)

---

### 04. 架构决策记录与开发笔记

#### 架构决策记录 (ADR)
- [ADR-001: 画布技术选型决策 (XYFlow / React Flow v12)](04-dev-notes/adr-001-canvas-engine-selection.md)
- [ADR-002: 双引擎架构策略](04-dev-notes/adr-002-dual-engine-architecture.md)

#### 技术深入分析
- [国际化 (i18n) 体系与全屏设置页面架构](04-dev-notes/i18n-and-settings-architecture.md)
- [运行前模型校验与流程仿真验证 (Dry-Run)](04-dev-notes/preflight-model-check-and-flow-validation.md)
- [工程测试覆盖率与运行时基准测试](04-dev-notes/engineering-test-coverage-and-runtime-benchmarks.md)
- [功能特性总览与测试指南](04-dev-notes/feature-overview-and-testing-guide.md)
- [用户使用手册与节点配置指南](04-dev-notes/user-manual-and-component-guide.md)

#### 项目全周期研发演进日志
- [📖 Phase 0：核心拓扑调度引擎与可视化画布构建](04-dev-notes/dev-log-phase-0-core-engine-and-visual-canvas.md)
- [📖 Phase 0.5：多模型生态适配、三层脱敏日志与国际化](04-dev-notes/dev-log-phase-0-5-multi-model-logging-and-i18n.md)
- [📖 Phase 1：抽屉式多流程管理与双模存储架构](04-dev-notes/dev-log-phase-1-drawer-management-and-dual-storage.md)
- [📖 Phase 2：RAG 知识库体系与画布检索节点全链路闭环](04-dev-notes/dev-log-phase-2-rag-knowledge-base-and-canvas-node.md)
- [📖 Phase 3：条件路由、外部集成与交互式调试](04-dev-notes/dev-log-phase-3-conditional-routing-and-graph-pruning.md)
- [📖 Phase 3：Chat 调试抽屉与一键 API 发布](04-dev-notes/dev-log-phase-3-chat-debug-and-api-publishing.md)
- [📖 Phase 4：AI 智能体能力层、ReAct 自主循环与多模态工具调用](04-dev-notes/dev-log-phase-4-agent-capabilities-and-react-loop.md)
- [📝 开源系列 07：给大模型装上手和脚！Agent 节点与 Tools 工具调用体系设计与实战](04-dev-notes/blog-07-agent-capabilities-and-tools-design.md)

---

### 05. 快速上手指南

- [Quick Start Guide (English)](quick-start.md)
- [快速上手指南 (简体中文)](quick-start-zh.md)

---

### 06. 安全

- [安全审计与代码质量简报](安全TODO/安全审计与代码质量简报.md)
