---
title: "ADR-001: Canvas Engine Selection - React Flow (@xyflow/react)"
version: "1.0.0"
status: "Accepted"
author: "AI Orchestrator Architecture Team"
created: "2026-08-28"
updated: "2026-08-28"
---

# ADR-001: Canvas Engine Selection / 画布引擎选型评估

[English Version](#english-version) | [中文版本](#中文版本)

---

<a name="english-version"></a>
## English Version

### 1. Context & Problem Statement
The AI Prompt Flow Orchestrator requires a high-performance, developer-friendly graph editing library tailored for modern React ecosystems. Requirements include:
- Deep React integration with custom nodes rendering complex forms and streaming token outputs.
- Smooth viewport interactions (Zoom, Pan, MiniMap, Marquee Selection, Grid Snapping).
- Native TypeScript support, decoupled state management, and an active open-source community.

### 2. Comparison Matrix

| Evaluation Criteria | React Flow (@xyflow/react) | AntV X6 | Rete.js v2 | Custom Canvas/SVG |
| :--- | :--- | :--- | :--- | :--- |
| **React Integration** | ★★★★★ (Native React components) | ★★★☆☆ (DOM portal wrapper) | ★★★☆☆ (Framework plugin) | ★★☆☆☆ (Manual hooks) |
| **Custom Node DX** | ★★★★★ (Direct JSX/TSX) | ★★★☆☆ (Complex lifecycle) | ★★★☆☆ (Heavy plugin overhead) | ★☆☆☆☆ (High cost) |
| **Community Maturity** | ★★★★★ (Global industry benchmark) | ★★★★☆ (Alibaba ecosystem) | ★★★☆☆ (Smaller ecosystem) | ★☆☆☆☆ (Zero ecosystem) |
| **State Decoupling** | ★★★★★ (Fully controllable) | ★★★★☆ (Built-in graph model) | ★★★☆☆ (Tightly coupled) | ★★★★★ (Full control) |

### 3. Decision
**We select `@xyflow/react` (React Flow v12+) as the core canvas engine.**
- Direct TSX node development with Tailwind CSS.
- Clean separation between visual canvas rendering and our custom Kahn DAG scheduling engine.

---

<a name="中文版本"></a>
## 中文版本

### 1. 背景与问题陈述
需要选定一款能够深度集成 React、支持复杂自定义节点渲染与流畅视口交互的图编辑基础库。

### 2. 决策结果
选定 `@xyflow/react` (React Flow v12+) 作为项目唯一的画布核心基础库。具备组件即节点（JSX/TSX 直接开发）、轻量解耦与丰富辅助插件（Background/MiniMap/Controls）等核心优势。
