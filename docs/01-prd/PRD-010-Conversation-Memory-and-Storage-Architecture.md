---
title: "PRD-010: Conversation Memory & Persistent Storage Architecture"
version: 0.3.1
status: "Approved (Implemented)"
author: "PatchCat Core Team"
created: "2026-09-11"
updated: "2026-09-11"
---

[English Version](#english-version) | [中文版本](#中文版本)

---

<a id="english-version"></a>
# PRD-010: Conversation Memory & Persistent Storage Architecture (English Version)

## 1. Executive Summary & Problem Statement

### 1.1 Context
In PatchCat v0.3.0, the interactive **Chat Debug Panel** (`ChatDebugPanel.tsx`) stored chat dialogue in browser `sessionStorage` under a single global key (`patchcat_chat_history`). While effective for initial single-session checks, this approach presented several critical production limitations:
1. **Quota & Data Loss**: `sessionStorage` is strictly constrained by a 5MB quota and is automatically wiped whenever the user closes the browser tab.
2. **Cross-Workflow Pollution**: Since the session key was global, switching between different canvas workflows resulted in dialogue leakage and confused state.
3. **Absence of Context Memory**: Executing multiple rounds in the chat panel executed each query in isolation; downstream LLM nodes had no automated mechanism to consume historical dialogue rounds.
4. **Local Storage Friction**: Users frequently request saving workflows and chat sessions to arbitrary local directories. However, modern browser sandboxing (File System Access API) enforces interactive permission re-authorization on *every single page reload*, creating severe friction for day-to-day prompt engineering.

### 1.2 Target Objectives
- Provide a robust, asynchronous **IndexedDB** session storage adapter (`IndexedDBSessionAdapter`) with automatic in-memory fallback for Node.js test environments.
- Establish a **Two-Tier Configuration Policy**:
  - **Tier 1 (Global Policy)**: Configured in `SettingsPage` (`memoryDefaults` in `settings-store.ts`), setting default memory toggle, sliding window rounds (1–20), token budget limit (500–16,000), and pruning strategies (`hybrid`, `window`, `token_budget`).
  - **Tier 2 (Workflow & Node Override)**: Individual workflows and nodes inherit global defaults and can override them locally.
- Implement workflow-scoped isolation (`${workflowId}::${sessionId}`) ensuring distinct canvas workflows never cross-pollute chat logs.
- Deliver algorithmic memory pruning (`pruneConversationMessages`) that dynamically truncates older messages by round count and reverse token accumulation before injecting formatted history (`chat_history`, `conversation_history`, `history`) into the workflow execution context.
- Embed a comprehensive **Storage Architecture FAQ & Q&A** in `SettingsPage` explaining why IndexedDB and SQLite are defaults, and detailing modern browser sandbox constraints.

---

## 2. Architecture & Design Specifications

### 2.1 Storage Layer Abstraction (`ISessionStorageAdapter`)
```typescript
export interface MemoryMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    nodeId?: string;
    tokenCount?: number;
    rawInputs?: Record<string, unknown>;
    outputs?: Record<string, unknown>;
    durationMs?: number;
    error?: string;
    trace?: unknown[];
    tokenUsage?: { prompt: number; completion: number; total: number };
    [key: string]: unknown;
  };
}

export interface ISessionStorageAdapter {
  getSessionMessages(workflowId: string, sessionId?: string): Promise<MemoryMessage[]>;
  saveSessionMessages(workflowId: string, messages: MemoryMessage[], sessionId?: string): Promise<void>;
  appendSessionMessage(workflowId: string, message: MemoryMessage, sessionId?: string): Promise<void>;
  clearSessionMessages(workflowId: string, sessionId?: string): Promise<void>;
}
```

### 2.2 Storage Engine Trade-Offs

| Storage Option | Capacity | Persistence | UI Blocking Risk | Reload Friction | Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`sessionStorage`** | ~5 MB | Cleared on tab close | Low (sync) | None | Deprecated |
| **`IndexedDB`** | 100+ MB / GBs | Survives tab & browser close | Zero (asynchronous transactions) | None | **Default for Client-Side BYOK** |
| **File System Access API** | Local Disk | Permanent | Low | **Requires user prompt on every page reload** | Optional/Advanced only |
| **Self-Hosted SQLite** | Local Disk | Permanent & ACID | Zero (offloaded to FastAPI) | Zero | **Default for Self-Hosted Mode** |

### 2.3 Pruning Strategies & Algorithms
- **Sliding Window Only (`window`)**: Retains the latest $K$ rounds ($2K$ messages).
- **Token Budget Only (`token_budget`)**: Accumulates token counts backwards from newest to oldest; drops older messages once the cumulative budget threshold is exceeded.
- **Hybrid Constraint (`hybrid`, Default)**: Applies sliding window limit first, then enforces token budget cap.

---

## 3. UI & Interaction Flow

1. **Settings > General**:
   - Master toggle: Enable/disable conversation context memory.
   - Interactive slider for Sliding Window (1 to 20 rounds).
   - Interactive slider for Token Budget (500 to 16,000 tokens).
   - Pruning strategy selector (`Hybrid`, `Window`, `Token Budget`).
   - "Reset to Defaults" button.
2. **Settings > Storage**:
   - Expandable "Storage Architecture & FAQ" card detailing IndexedDB benefits, SQLite advantages, and browser sandbox authorization caveats.
3. **Chat Debug Panel**:
   - Automatically loads and scopes chat history to `activeWorkflowId`.
   - On message send: pruned history is seamlessly formatted into `User: ...\nAssistant: ...` and injected into `inputsBag['chat_history']`.
   - Clear history button clears only the current workflow's scoped session store.

---

<a id="中文版本"></a>
# PRD-010: 多轮会话记忆与持久化存储架构 (中文版本)

## 1. 业务背景与问题分析

### 1.1 现状与痛点
在 PatchCat v0.3.0 中，交互式**调试对话面板**（`ChatDebugPanel.tsx`）将调试对话历史存储于浏览器 `sessionStorage` 的单一全局键值（`patchcat_chat_history`）中。虽然满足了初期的单次验证需求，但在生产与深度调试中暴露了诸多缺陷：
1. **容量限制与数据易失**：`sessionStorage` 仅有 5MB 配额上限，且一旦关闭标签页数据立刻永久丢失；
2. **工作流串话污染**：全局存储导致用户在侧边栏切换不同项目或画布时，对话记录互相交织、状态错乱；
3. **缺乏多轮上下文拼接**：在调试面板连续提问时，底层 DAG 引擎每次均作为全新孤立请求执行，下游 LLM 节点无法自动获取前序问答轮次；
4. **自定义本地文件夹存储的工程壁垒**：许多用户希望直接指定本地文件夹存盘。然而现代浏览器出于安全沙箱策略（File System Access API），每次页面刷新或重载都必须重新弹窗手动授权，日常高频调试体验割裂。

### 1.2 目标定位
- 实现健壮的异步 **IndexedDB** 会话存储适配器（`IndexedDBSessionAdapter`），并在 Node.js 测试与无头环境下自动无缝降级为内存回退（In-Memory Fallback）；
- 确立**两级配置管控模型 (Two-Tier Configuration Policy)**：
  - **一级策略 (Tier 1 全局默认)**：在设置中心（`SettingsPage`）统一配置会话记忆启闭、滑动窗口轮数（1~20 轮）、Token 预算上限（500~16000 Tokens）以及裁剪策略（`hybrid` / `window` / `token_budget`）；
  - **二级策略 (Tier 2 节点级覆盖)**：新建工作流及大模型节点默认继承全局偏好，同时保留局部覆盖能力；
- 实现基于工作流 ID 的会话独立隔离（`${workflowId}::${sessionId}`），杜绝项目间数据串扰；
- 实现纯策略裁剪算法（`pruneConversationMessages`），动态进行滑动窗口截断与倒序 Token 预算累加裁剪，自动将上下文注入 `inputsBag` 的 `chat_history`、`conversation_history` 与 `history` 变量插槽；
- 在设置中心内置权威的**存储架构说明与 Q&A**，详尽解释纯前端端侧 IndexedDB 与自部署 SQLite 的选型权衡及浏览器沙箱权限边界。

---

## 2. 核心架构设计

### 2.1 存储适配器抽象
- **数据库名**：`patchcat_chat_db`，**对象存储 (Object Store)**：`chat_sessions`
- **索引主键**：`sessionKey = ${workflowId}::${sessionId}`
- **非阻塞事务**：全异步读写，零主线程卡顿，确保 React Flow 画布 60 FPS 丝滑交互。

### 2.2 存储方案综合选型权衡表

| 存储媒介 | 理论容量 | 持久性保障 | 掉帧风险 | 刷新重载体验 | 官方定位 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`sessionStorage`** | ~5 MB | 关标签即清除 | 低 (同步阻塞) | 免授权 | 已淘汰 |
| **`IndexedDB`** | 数百 MB 至数 GB | 永久持久化 | **零 (异步事务)** | **免授权，即开即用** | **纯前端端侧默认推荐** |
| **File System API** | 本地全盘 | 永久持久化 | 低 | **每次页面重载均需弹窗手动授权** | 实验/高级选项 |
| **本地 SQLite** | 本地单文件 | 严格 ACID 事务 | **零 (FastAPI 独立进程)** | **零弹窗、自动化无感保存** | **自部署模式默认推荐** |

### 2.3 上下文裁剪算法规则
1. **纯轮数滑动窗口 (`window`)**：保留最近 $K$ 轮（$2K$ 条消息）。
2. **纯 Token 预算上限 (`token_budget`)**：从最新一条消息开始倒序向前累加 Token，遇到预算超标时截断更早消息。
3. **双重约束 (`hybrid`)**：先执行滑动窗口轮数截断，若剩余 Token 仍超标，再执行 Token 预算裁剪。

---

## 3. 验证与测试标准
- `tests/session-storage.node.test.ts` 覆盖率 100%（适配器 CRUD、环境回退、作用域隔离、三大裁剪算法）。
- `tests/settings.node.test.ts` 覆盖全局设置读取、修改与恢复默认值。
- 全量单元测试 `npm test` 173/173 全部通过。
