# 📚 PatchCat 开发者与架构文档全景索引 (Documentation Index)

> **欢迎查阅 PatchCat 开发文档库**。本目录包含了系统的产品需求规范 (PRD)、系统架构设计 (Architecture)、API 契约 (API Specifications)、决策记录与开发笔记 (Dev Notes)。

---

## 📑 文档结构目录

### 01. 产品需求文档 (Product Requirement Documents)
- [PRD-001: Visual Workflow Canvas & Node Components](01-prd/PRD-001-Workflow-Canvas.md)
  - 可视化画布与自定义节点（Input, Prompt, LLM, Code, Output）规格说明。
- [PRD-002: DAG Topological Scheduler & Multi-Level Logger](01-prd/PRD-002-DAG-Execution-Engine.md)
  - 基于 Kahn 拓扑排序的波次并发调度器与脱敏日志系统。
- [PRD-003: Dual-Mode Execution Engine Adapter](01-prd/PRD-003-Dual-Mode-Adapter.md)
  - 浏览器端与服务端双引擎架构规范。
- [PRD-004: Workflow Project & Hierarchical Directory Management](01-prd/PRD-004-Workflow-Project-Directory-Management.md)
  - Antigravity 风格左侧抽屉、目录树管理、多工作流分类与本地持久化规范。

---

### 02. 系统架构与演进设计 (System Architecture)
- [System Architecture & Data Flow Overview](02-architecture/system-architecture.md)
  - 全局系统架构、数据流与组件交互总览。
- [Zustand & Immer Global State Management](02-architecture/state-management.md)
  - 前端状态机与持久化策略设计。
- [Graph Schema Specification](02-architecture/graph-schema-specification.json)
  - 工作流图 JSON 格式强类型规范定义。
- [🌟 Phase 1: FastAPI + PostgreSQL (pgvector) 后端架构与双模存储设计](02-architecture/phase-1-backend-and-dual-storage-architecture.md)
  - 服务端底座、pgvector 向量库与双模存储适配器设计。

---

### 03. API 契约与接口定义 (API Specifications)
- [Client Engine Interface](03-api/client-engine-interface.ts)
  - 前端引擎核心 TypeScript 接口定义。
- [OpenAPI 3.0 Specification](03-api/openapi-spec.yaml)
  - 标准 OpenAPI 格式的后端接口契约。

---

### 04. 架构决策记录与开发笔记 (ADR & Dev Notes)
- [ADR-001: Visual Canvas Engine Selection (XYFlow / React Flow v12)](04-dev-notes/adr-001-canvas-engine-selection.md)
  - 画布技术选型决策。
- [ADR-002: Dual-Engine Architecture Strategy](04-dev-notes/adr-002-dual-engine-architecture.md)
  - 双引擎架构决策背景与权衡。
- [国际化 (i18n) 体系与全屏设置页面架构设计](04-dev-notes/i18n-and-settings-architecture.md)
  - 轻量强类型多语言架构、双语预设与全屏 SettingsPage 设计。
- [运行前模型校验与流程仿真验证 (Preflight & Dry-Run)](04-dev-notes/preflight-model-check-and-flow-validation.md)
  - 前置拦截弹窗、未配置 Key 处理与智能 Mock 仿真验证。
- [Engineering Test Coverage & Runtime Benchmarks](04-dev-notes/engineering-test-coverage-and-runtime-benchmarks.md)
  - 单元测试覆盖率与并发性能基准测试记录。
- [Feature Overview & Testing Guide](04-dev-notes/feature-overview-and-testing-guide.md)
  - 功能特性总览与测试指南。
- [User Manual & Component Guide](04-dev-notes/user-manual-and-component-guide.md)
  - 最终用户使用手册与节点配置指南。

---

### 05. 快速上手指南 (Quick Start)
- [快速上手指南 (简体中文)](quick-start-zh.md)
- [Quick Start Guide (English)](quick-start.md)
