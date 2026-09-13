---
title: "PRD-011: AI Agent Capabilities, ReAct Autonomous Loop & Multi-Modal Tool Calling"
version: "1.0.0"
status: "Completed & Verified"
author: "PatchCat Architecture Team"
created: "2026-09-13"
updated: "2026-09-13"
milestone: "Phase 4 (v0.4.2)"
---

# PRD-011: AI Agent 能力层、ReAct 自主循环与工具调用规范

[English](#english-version) | [中文版本](#中文版本)

---

<a name="english-version"></a>
## English Version

### 1. Overview & Business Objectives
In previous versions (v0.1.0 – v0.4.0), PatchCat operated strictly under a forward-directed DAG execution paradigm without autonomous loops. PRD-011 upgrades PatchCat from a "Prompt Workflow Orchestrator" to an "Agentic Workflow Orchestrator" by introducing:
1. **Universal LLM Tool Calling**: Declare structured function schemas (`tools`) with SSE incremental parsing.
2. **Autonomous ReAct Loop**: An enclosed iterative engine cycle (`Think -> Act -> Observe -> Think`) with bounded iteration limits.
3. **Multi-Type Tool Dispatcher**: Seamless routing to code sandboxes, external HTTP APIs, and canvas sub-nodes.
4. **Batch Loop & Sub-Workflow Primitives**: Iterative array processing and workflow encapsulation.

### 2. Core Architecture
- **Agent Node (`AgentNode.tsx`)**: Renders tool counts, execution step badges, and model tags.
- **Engine Execution (`browser-engine.ts`)**: Implements bounded iteration loop (default max 10 steps), dispatching `AGENT_ITERATION` and `AGENT_TOOL_CALL` telemetry.
- **Tool Protocol**: Conforms to standard OpenAI/Gemini/DeepSeek `tools` schema with robust JSON arguments assembly.

---

<a name="中文版本"></a>
## 中文版本

### 1. 业务目标与背景
PatchCat 此前版本基于 Kahn 拓扑排序调度单向 DAG。PRD-011 正式引入 Agent 智能体范式，支持多轮自主推理与工具调用闭环。

### 2. 关键能力
1. **ReAct 自主推理循环**：在 Agent 节点内部封装自治循环，由模型自主判断是否调用工具或给出最终结论。
2. **多工具路由执行器**：
   - `builtin_code`: 安全 Web Worker 沙箱环境执行 JS 计算；
   - `builtin_http`: 动态构建请求参数调用外部 REST API；
   - `canvas_node`: 递归调度当前画布上的特定节点。
3. **循环与子工作流原语**：提供 `LoopNode` 列表批量并发与 `SubWorkflowNode` 流程复用能力。