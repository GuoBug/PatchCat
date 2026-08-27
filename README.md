# 🚀 AI Prompt Flow Orchestrator

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React Flow](https://img.shields.io/badge/React_Flow-v12%2B-ff0072?logo=react)](https://reactflow.dev/)
[![GitHub Actions](https://img.shields.io/badge/CI%2FCD-GitHub_Pages-green?logo=githubactions)](https://github.com/)

[English](#english) | [中文说明](#中文说明)

---

<a name="english"></a>
## 📖 English Overview

**AI Prompt Flow Orchestrator** is an industrial-grade, highly extensible visual DAG (Directed Acyclic Graph) workflow orchestration system designed for LLM applications. It features a seamless dual-engine architecture:
1. **Client-Only Mode**: Zero-backend static web application deployable directly on GitHub Pages with BYOK (Bring Your Own Key) and built-in Mock engine.
2. **Local-Server Mode**: High-performance local FastAPI backend with Python execution sandboxing, Ollama/vLLM local model bridge, and SSE streaming pipeline.

### 🌟 Key Features
- **Visual DAG Canvas**: Built on `@xyflow/react` (React Flow v12+) with rich node types (`Input`, `Prompt`, `LLM`, `Code`, `Router`, `Output`).
- **Kahn's Topological Engine**: Automatic dependency resolution, cycle detection, and parallel layer wave execution.
- **Dynamic Variable Slots**: Mustache-style `{{nodeId.outputKey}}` variable resolution supporting nested property access and fallback defaults.
- **Dual-Engine Architecture**: Single graph schema compatible with both pure browser execution and local FastAPI streaming server.
- **Pre-built Enterprise Presets**:
  - Customer Support Routing (Intent Classification & Ticket Dispatch)
  - Self-Reflective Research Report Generator with Critic
  - Multi-LLM Arena & Neutral Judge Benchmark

### 📂 Directory Structure
```
├── .github/workflows/deploy.yml          # GitHub Actions static deployment to GitHub Pages
├── docs/
│   ├── 01-prd/                           # Product Requirement Documents (Canvas, DAG, Dual-Engine)
│   ├── 02-architecture/                  # Architecture & JSON Schema Draft-07 specs
│   ├── 03-api/                           # OpenAPI 3.1.0 specification & TypeScript interfaces
│   └── 04-dev-notes/                     # Architecture Decision Records (ADR)
├── src/
│   ├── components/                       # Canvas, custom nodes, and control panels
│   ├── engine/                           # Kahn's sort, variable resolver, and browser engine
│   ├── stores/                           # Global Zustand state management
│   └── presets/                          # Ready-to-run workflow JSON presets
```

---

<a name="中文说明"></a>
## 🇨🇳 中文说明

**AI 提示流编排器 (AI Prompt Flow Orchestrator)** 是一款面向大语言模型应用的高标准、可扩展的可视化 DAG 工作流编排系统。系统具备独特的双引擎架构：
1. **纯前端模式 (Client-Only)**：零后端依赖，直接静态部署于 GitHub Pages，支持 BYOK (自带 Key) 与内置 Mock 离线体验。
2. **本地后端模式 (Local-Server)**：基于 FastAPI 的高性能本地引擎，提供 Python 代码沙箱、Ollama 本地大模型桥接与 SSE 流式事件推送。

### 🌟 核心特性
- **可视化 DAG 画布**：基于 `@xyflow/react` 构建，内置 6 大标准节点体系（`Input`, `Prompt`, `LLM`, `Code`, `Router`, `Output`）。
- **Kahn 拓扑排序调度**：自动计算节点依赖层级，支持循环依赖拦截与同层并行批次加速。
- **动态插槽变量解析**：Mustache 风格语法 `{{nodeId.outputKey}}`，支持深层嵌套对象安全访问与降级默认值。
- **双引擎透明适配**：同一套工作流 Graph JSON 协议，在纯前端与本地 Python 服务间无缝切换。
- **预置工业级场景模板**：
  - 智能客服意图分类与工单路由
  - 自反思研报生成与 Critic 专家审核链
  - 多大模型并发横向盲测与裁判打分 Arena

---

## 📄 License
MIT License. Open source and free for commercial and academic use.
