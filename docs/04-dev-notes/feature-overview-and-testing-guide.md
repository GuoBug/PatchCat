---
title: "Feature Overview and Testing Guide"
version: "1.0.0"
status: "Active"
author: "AI Orchestrator Architecture Team"
created: "2026-08-28"
updated: "2026-08-28"
---

# Feature Overview & Testing Guide / 功能综述与测试指南

[English Version](#english-version) | [中文版本](#中文版本)

---

<a name="english-version"></a>
## English Version

### 1. What Has Been Built

The **AI Prompt Flow Orchestrator** project foundation, core type system, execution engine, state management, and test suite have been fully developed to production-grade standards:

#### 1.1 Documentation & Specification Architecture (`docs/`)
- **PRD-001 (Canvas Specification)**: UI interactions (zoom, pan, mini-map, grid snapping), 6 node definitions (`input`, `prompt`, `llm`, `code`, `router`, `output`), and complete node lifecycle state machines.
- **PRD-002 (DAG Execution Specification)**: Kahn's topological sorting algorithm, dependency wave partitioning, cycle detection, and `{{nodeId.outputKey}}` variable interpolation.
- **PRD-003 (Dual-Mode Adapter Specification)**: Unified adapter contract supporting both **Client-Only** (static GitHub Pages, Mock/BYOK) and **Local-Server** (FastAPI, Python sandbox, SSE streaming).
- **Architecture & Schemas**: System architecture diagram, JSON Schema Draft-07 specification, Zustand state persistence design, and OpenAPI 3.1.0 contract.
- **Architecture Decision Records (ADRs)**: Documented rationale for selecting `@xyflow/react` (React Flow v12+) and the dual-engine strategy.

#### 1.2 Core Type System (`src/engine/types.ts`)
- **Strict, zero-`any` TypeScript types**:
  - `NodeType`, `NodeStatus`, `EngineMode` literal unions.
  - `WorkflowNodeData` extending `@xyflow/react` with index signatures for complete type safety.
  - `NodeExecutionResult` with `latencyMs`, `tokenUsage` breakdown, error captures, and timestamps.
  - `WorkflowGraph` envelope for lossless serialization, schema validation, and preset importing.
  - Factory helpers: `getDefaultNodeConfig()`, `getDefaultNodeLabel()`.

#### 1.3 Global State Management (`src/stores/workflow-store.ts`)
- **Zustand store** equipped with `immer` middleware for immutable updates.
- **React Flow Adapters**: `onNodesChange`, `onEdgesChange`, and `onConnect`.
- **Node CRUD**: `addNode` with sequential counter labels and unique IDs, `updateNodeData`, `updateNodeConfig`.
- **Execution State Controls**: `setNodeStatus`, `setSelectedNodeId`, `setEngineMode`, `loadPreset`, and `resetExecutionState`.

#### 1.4 Deterministic Execution Engine (`src/engine/`)
- `topological-sort.ts`: Kahn's algorithm that partitions nodes into parallel execution waves and detects dependency cycles.
- `variable-resolver.ts`: Dynamic slot resolver supporting deep object paths (e.g., `{{node.data.items[0].name}}`), fallback values (`{{node.val | "default"}}`), and prototype pollution security guards.
- `browser-engine.ts`: Browser-based asynchronous generator (`AsyncGenerator<ExecutionEvent>`) delivering real-time streaming lifecycle events.

#### 1.5 Industry Preset Scenarios (`src/presets/`)
- `customer-support-routing.json`: Intent classification & ticket routing DAG.
- `report-generation-critic.json`: Self-reflective research report generator with critic review.
- `model-arena-eval.json`: Multi-LLM parallel arena with neutral judge evaluation.

---

### 2. How to Test & Run

#### Prerequisites
- **Node.js**: v20.0.0 or higher (v24 recommended for zero-dependency native test running)
- **Git**: Installed and initialized

#### Command Matrix

| Command | Purpose | Expected Output |
| :--- | :--- | :--- |
| `npm test` | Runs unit test suite for topological sort and variable resolver | `8 passed, 0 failed` |
| `npm run demo` | Executes interactive terminal DAG execution simulation | Step-by-step layer logging and workflow completion |
| `npm run typecheck` | Strict TypeScript compilation check | Zero errors (`tsc --noEmit`) |

---

#### 2.1 Step 1: Unit Testing (`npm test`)

Runs 8 unit tests validating core mathematical and parsing algorithms:

```bash
npm test
```

**What is tested:**
- Linear chain sorting ($A \rightarrow B \rightarrow C$).
- Parallel wave partitioning ($A \rightarrow B, A \rightarrow C, B+C \rightarrow D$).
- Direct & indirect cycle detection with cyclic node reporting.
- Nested object property access & prototype pollution defense.
- Mustache template extraction and fallback value injection.

---

#### 2.2 Step 2: Interactive CLI Workflow Demo (`npm run demo`)

Simulates an end-to-end execution of a 4-node AI workflow directly in your terminal:

```bash
npm run demo
```

**Execution Pipeline:**
1. **Topological Sort**: Partitions nodes into `Layer 0 (Input) -> Layer 1 (Prompt) -> Layer 2 (LLM) -> Layer 3 (Output)`.
2. **Variable Resolution**: Resolves `{{input_1.user_query}}` into prompt templates.
3. **Execution Stream**: Simulates network latency, token generation, and node output streaming.

---

#### 2.3 Step 3: TypeScript Typecheck (`npm run typecheck`)

Verifies that the entire codebase adheres to strict TypeScript standards (`noUncheckedIndexedAccess`, zero `any`, strict null checks):

```bash
npm run typecheck
```

---

<a name="中文版本"></a>
## 中文版本

### 1. 已实现功能综述

**AI 提示流编排器 (AI Prompt Flow Orchestrator)** 已完成核心规范、类型体系、状态管理、执行引擎与测试体系的完整构建：

#### 1.1 文档体系与规范 (`docs/`)
- **PRD 需求规范**：涵盖画布交互与 6 大节点定义 (PRD-001)、Kahn 拓扑排序与插槽解析 (PRD-002)、纯前端与本地后端双模架构 (PRD-003)。
- **架构协议**：系统 4 层分层架构、Draft-07 JSON Schema、Zustand 状态机与 OpenAPI 3.1.0 契约。
- **技术选型决策 (ADR)**：包含 React Flow 画布选型与双引擎设计权衡。

#### 1.2 严格类型系统 (`src/engine/types.ts`)
- 严格遵循零 `any` 原则，提供 `NodeType`、`NodeStatus`、`EngineMode`、`NodeExecutionResult` 与 `WorkflowGraph` 等核心领域模型。

#### 1.3 全局状态管理 (`src/stores/workflow-store.ts`)
- 基于 Zustand + Immer，提供 React Flow 回调适配（`onNodesChange`/`onConnect`）、节点 CRUD 操作与执行状态控制。

#### 1.4 核心执行引擎 (`src/engine/`)
- **Kahn 拓扑排序**：自动划分并发执行层（Layers），支持循环依赖拦截。
- **变量解析器**：支持深层嵌套取值、默认值降级与原型链污染防护。
- **纯前端执行器**：基于 `AsyncGenerator` 提供 Token 级流式事件推送。

---

### 2. 测试与运行指南

```bash
# 1. 运行核心单元测试
npm test

# 2. 运行终端端到端工作流模拟演示
npm run demo

# 3. 运行严格 TypeScript 静态类型检查
npm run typecheck
```
