# 🎯 Next Steps / 下次开发接续清单

> **Current Version**: `v0.3.1` (Completed & Verified ✅)  
> **Last Updated**: 2026-09-11  
> **Previous Milestone**: Phase 3 Storage & Multi-Turn Conversation Memory Architecture (Shipped ✅)  
> **Current Focus**: **Next Stage: Canvas Explicit Memory Node & Backend Multi-Turn REST Session Sync**

[English](#english) | [简体中文](#简体中文)

---

<a name="english"></a>
## English

### ⚡ Completed Milestone: P0-1 Multi-Turn Conversation Memory & Persistent Storage (v0.3.1)

- [x] **1. Storage Layer & Persistence Architecture ([PRD-010](docs/01-prd/PRD-010-Conversation-Memory-and-Storage-Architecture.md))**:
  - Implemented `IndexedDBSessionAdapter` in `src/services/storage/session-storage.ts` (database `patchcat_chat_db`, store `chat_sessions`), bypassing the 5MB quota and tab-closure data loss of `sessionStorage`.
  - Built zero-dependency in-memory fallback for headless Node.js test environments.
  - Transparently disclosed browser File System Access API sandboxing constraints (re-authorization on every reload) vs. self-hosted SQLite via interactive FAQ card in `SettingsPage.tsx`.
- [x] **2. Two-Tier Configuration Policy (Tier 1 Global Defaults)**:
  - Created `memoryDefaults` in `settings-store.ts` managing master toggle, sliding window rounds (1–20), token budget limit (500–16,000), and pruning strategies (`hybrid`, `window`, `token_budget`).
  - Added dedicated UI controls in `SettingsPage.tsx` with interactive sliders, strategy selectors, and reset to defaults action.
- [x] **3. Algorithmic Context Pruning & Dynamic Context Injection**:
  - Implemented pure algorithm `pruneConversationMessages` supporting sliding window rounds, reverse-accumulated token budgets, and hybrid mode.
  - Formatted messages via `formatMessagesToPlainText` and auto-injected history into `inputsBag` variables (`chat_history`, `conversation_history`, `history`) during execution.
- [x] **4. Workflow-Scoped Chat Session Isolation**:
  - Refactored `ChatDebugPanel.tsx` to key sessions by `${activeWorkflowId}::${sessionId}` via `sessionStorageAdapter`.
  - Added scoped session clearing and seamless historical message restoration.
- [x] **5. Verification & Test Suite Upgrades**:
  - Added `tests/session-storage.node.test.ts` (10 tests) and updated `tests/settings.node.test.ts` (173 total tests passing at 100%).

---

### 🔬 Future Development: Advanced Memory & Topology Capabilities

- [ ] **1. Canvas Explicit Memory Node (Option B)**:
  - Introduce dedicated `Memory` node on the canvas (`memory.buffer`, `memory.summary`) that can be explicitly wired to LLM nodes' context handles for complex branching topologies.
- [ ] **2. Rolling Background Summarization**:
  - Implement rolling LLM-powered background summarization of older conversation rounds to preserve critical intent with minimal token consumption.
- [ ] **3. REST API Multi-Turn Session Continuity**:
  - Support `session_id` parameter in `POST /api/v1/workflows/{id}/run` to persist and retrieve multi-turn conversation memory on the FastAPI server side.

### ⚡ Completed Action Plan for v0.3.0

#### 1. IF/ELSE Conditional Branch Node ([PRD-007](docs/01-prd/PRD-007-Conditional-Branch-and-Dynamic-Routing.md))
- [x] Add `condition` node type to `NodeType` union in `types.ts`
- [x] Implement `ConditionNode.tsx` component with orange/amber diamond styling
- [x] Build condition rule evaluator in `browser-engine.ts` (operators: equals, contains, greater_than, regex_match, etc.)
- [x] Implement branch skipping logic: only activated branch's downstream nodes execute, others emit `NODE_SKIPPED`
- [x] Build visual condition builder UI in `PropertyPanel.tsx` (add/remove rules, operator dropdown, variable reference input)
- [x] Add pre-flight validation: warn on unconnected condition branches

#### 2. Variable Aggregator Node ([PRD-007](docs/01-prd/PRD-007-Conditional-Branch-and-Dynamic-Routing.md))
- [x] Add `aggregator` node type to `NodeType` union in `types.ts`
- [x] Implement `AggregatorNode.tsx` component with purple/violet merge styling
- [x] Implement three aggregation modes in `browser-engine.ts`: `first_available`, `merge_all`, `wait_all`
- [x] Add multi-input handle support (multiple `in` handles on left side)

#### 3. HTTP Request Node ([PRD-008](docs/01-prd/PRD-008-HTTP-Request-Node.md))
- [x] Add `http` node type to `NodeType` union in `types.ts`
- [x] Implement `HttpNode.tsx` component with green/teal globe styling
- [x] Build HTTP executor in `browser-engine.ts` with method/headers/body/auth configuration
- [x] Implement retry logic with exponential backoff
- [x] Build tabbed property panel UI: Params | Headers | Body | Auth | Settings
- [x] Add URL validation (block `file://`, `javascript:` schemes)
- [x] Ensure credential sanitization in logs via existing `sanitizeData`

#### 4. Chat Debug Panel ([PRD-009](docs/01-prd/PRD-009-Chat-Debug-Panel-and-Workflow-API.md))
- [x] Create `ChatDebugPanel.tsx` slide-over component (right side, toggleable via Ctrl+Shift+D)
- [x] Implement chat message bubbles with user input → streaming LLM response flow
- [x] Reuse existing SSE streaming for real-time token rendering in chat bubbles
- [x] Add expandable execution trace within each chat message
- [x] Display token usage badge per message
- [x] Store chat history in session memory (optional localStorage persistence)

#### 5. Workflow → REST API Publishing ([PRD-009](docs/01-prd/PRD-009-Chat-Debug-Panel-and-Workflow-API.md))
- [x] Create `POST /api/v1/workflows/{workflow_id}/run` endpoint in FastAPI backend
- [x] Support both synchronous (JSON) and streaming (SSE) response modes
- [x] Implement simple API key authentication per workflow
- [x] Create 'Publish API' modal UI showing endpoint URL, curl/Python/JS code snippets
- [x] Add enable/disable API access toggle per workflow

#### 6. Testing & Verification
- [x] Add ≥15 unit tests for IF/ELSE condition evaluation and branch skipping
- [x] Add ≥10 unit tests for HTTP Request node
- [x] Add ≥12 unit tests for Chat Debug Panel and API endpoint
- [x] All existing 83+ tests continue passing (regression check: 94 frontend, 21 backend passing)
- [x] TypeScript strict type check passes: `npm run typecheck`
- [x] Production build succeeds: `npm run build`

#### 7. Built-in Presets
- [x] New preset: "Conditional Customer Routing" (Input → LLM Classifier → IF/ELSE → Branch A/B → Aggregator → Output)
- [x] New preset: "Weather API Integration" (Input → HTTP GET → LLM Summarizer → Output)

---

### 🤔 Resolved Design Decisions

- [x] **Branch skipping in topological sort**: Executed full Kahn layer-by-layer topology, using `nodeActiveBranch` and `incomingEdgesMap` to mark unselected branch descendants as `skipped` while allowing aggregator nodes to reconverge active branches safely.
- [x] **CORS for HTTP nodes**: Implemented client URL protocol validation with informative error messages, plus automated mock mode for tests and documentation for server-side proxy mode.
- [x] **Chat panel vs. Property panel coexistence**: Chat panel implemented as a right slide-over drawer triggered via toolbar icon or `Ctrl+Shift+D` shortcut without displacing canvas focus.
- [x] **API publishing security**: Workflow-scoped API Key authentication (`X-API-Key` or `Authorization: Bearer`) with toggleable active state.

---

### 🛠️ Common Verification Commands

```bash
# 1. Run all frontend unit tests
npm test

# 2. Run all backend tests
cd server && python -m pytest -v tests/ && cd ..

# 3. TypeScript strict type check
npm run typecheck

# 4. Production build
npm run build
```

---

---

<a name="简体中文"></a>
## 简体中文

### ⚡ 已交付里程碑：P0-1 多轮会话记忆与底层存储架构 (v0.3.1)

- [x] **1. 底层存储与端侧持久化架构 ([PRD-010](docs/01-prd/PRD-010-Conversation-Memory-and-Storage-Architecture.md))**：
  - 在 `src/services/storage/session-storage.ts` 实现 `IndexedDBSessionAdapter`（数据库 `patchcat_chat_db`，Store `chat_sessions`），解决 5MB 限额与关标签易失问题；
  - 打造零外部依赖的纯内存回退（In-Memory Fallback），保障 Node.js 测试环境 100% 稳定性；
  - 在 `SettingsPage.tsx` 中以内置可折叠 Q&A 卡片形式，深度披露浏览器 File System Access API 刷新频繁授权的沙箱限制，阐明端侧 IndexedDB 与自部署 SQLite 的选型优势。
- [x] **2. 两级配置管控模型 (Tier 1 全局默认偏好)**：
  - 在 `settings-store.ts` 实现 `memoryDefaults`，统一管理总开关、滑动窗口轮数（1~20 轮）、Token 预算上限（500~16,000）与裁剪策略（`hybrid` / `window` / `token_budget`）；
  - 在 `SettingsPage.tsx` 常规设置中构建全套可视化控件（动态滑块、策略药丸按钮与一键恢复默认）。
- [x] **3. 上下文纯策略裁剪算法与变量动态注入**：
  - 实现纯函数算法 `pruneConversationMessages`，支持滑动窗口轮数截断、倒序 Token 累加预算淘汰与双重约束；
  - 通过 `formatMessagesToPlainText` 格式化历史问答，并在运行时自动注入 `inputsBag` 的 `chat_history`、`conversation_history` 与 `history` 插槽。
- [x] **4. 基于工作流 ID 的会话独立隔离**：
  - 改造 `ChatDebugPanel.tsx`，采用 `${activeWorkflowId}::${sessionId}` 独立键值持久化，杜绝跨画布调试串话；
  - 支持工作流维度的会话一键清空与加载历史记忆。
- [x] **5. 全自动化测试与质量保障**：
  - 新增 `tests/session-storage.node.test.ts`（10 个测试）并更新 `tests/settings.node.test.ts`，全量测试达到 173 个用例全部 100% 通过。

---

### 🔬 后续演进路线：高级记忆与拓扑图能力

- [ ] **1. 画布显式 Memory 记忆节点 (方案 B)**：
  - 在画布中引入专门的 `Memory` 节点（`memory.buffer`、`memory.summary`），支持自由连线至各 LLM 节点的 context 端口，赋能复杂多分支拓扑。
- [ ] **2. 滚动后台摘要提炼 (Rolling Summarizer)**：
  - 引入后台轻量模型对淘汰的历史轮次进行滚动作语义摘要，以极低 Token 代价保持长效记忆。
- [ ] **3. REST API 多轮会话状态延续**：
  - 在 `POST /api/v1/workflows/{id}/run` 中增加 `session_id` 支持，实现 FastAPI 服务端跨 HTTP 请求的多轮对话记忆持久化。

### ⚡ v0.3.0 已交付行动清单

#### 1. IF/ELSE 条件分支节点 ([PRD-007](docs/01-prd/PRD-007-Conditional-Branch-and-Dynamic-Routing.md))
- [x] 在 `types.ts` 的 `NodeType` 联合类型中新增 `condition` 节点类型
- [x] 实现 `ConditionNode.tsx` 组件，采用橙色/琥珀色菱形样式
- [x] 在 `browser-engine.ts` 中构建条件规则求值器（运算符：equals、contains、greater_than、regex_match 等）
- [x] 实现分支跳过逻辑：仅被激活分支的下游节点执行，其余分支发射 `NODE_SKIPPED` 事件
- [x] 在 `PropertyPanel.tsx` 中构建可视化条件构建器 UI（增删规则行、运算符下拉、变量引用输入）
- [x] 增加运行前校验：对未连接的条件分支发出警告

#### 2. Variable 聚合节点 ([PRD-007](docs/01-prd/PRD-007-Conditional-Branch-and-Dynamic-Routing.md))
- [x] 在 `types.ts` 的 `NodeType` 联合类型中新增 `aggregator` 节点类型
- [x] 实现 `AggregatorNode.tsx` 组件，采用紫色/蓝紫色合并样式
- [x] 在 `browser-engine.ts` 中实现三种聚合模式：`first_available`、`merge_all`、`wait_all`
- [x] 支持多输入 handle（左侧多个 `in` 端口）

#### 3. HTTP 请求节点 ([PRD-008](docs/01-prd/PRD-008-HTTP-Request-Node.md))
- [x] 在 `types.ts` 的 `NodeType` 联合类型中新增 `http` 节点类型
- [x] 实现 `HttpNode.tsx` 组件，采用绿色/蓝绿色地球图标样式
- [x] 在 `browser-engine.ts` 中构建 HTTP 执行器（method/headers/body/auth 配置）
- [x] 实现指数退避重试逻辑
- [x] 构建多 Tab 属性面板 UI：Params | Headers | Body | Auth | Settings
- [x] 增加 URL 校验（拦截 `file://`、`javascript:` 协议）
- [x] 确保凭据在日志中通过现有 `sanitizeData` 脱敏

#### 4. Chat 调试面板 ([PRD-009](docs/01-prd/PRD-009-Chat-Debug-Panel-and-Workflow-API.md))
- [x] 创建 `ChatDebugPanel.tsx` 滑入式组件（右侧面板，Ctrl+Shift+D 切换）
- [x] 实现对话气泡消息 UI：用户输入 → 流式 LLM 响应
- [x] 复用现有 SSE 流式渲染，在对话气泡中实时显示 Token
- [x] 在每条对话消息中添加可展开的执行链路追踪
- [x] 显示每条消息的 Token 消耗徽章
- [x] 将对话历史存储在会话内存中（可选 localStorage 持久化）
- [x] 修复长文本与 JSON 溢出问题，增加代码卡片与一键复制
- [x] 自动发现 Input 节点多参数，增加动态参数调试表单与标签回显

#### 5. 工作流 → REST API 一键发布 ([PRD-009](docs/01-prd/PRD-009-Chat-Debug-Panel-and-Workflow-API.md))
- [x] 在 FastAPI 后端创建 `POST /api/v1/workflows/{workflow_id}/run` 端点
- [x] 支持同步（JSON 响应）和流式（SSE）两种响应模式
- [x] 实现简单的按工作流 API Key 鉴权
- [x] 创建「发布 API」弹窗 UI，展示端点 URL、curl/Python/JS 代码片段
- [x] 添加按工作流启用/禁用 API 访问开关

#### 6. 测试与验证
- [x] 为 IF/ELSE 条件求值与分支跳过新增 ≥15 个单元测试
- [x] 为 HTTP 请求节点新增 ≥10 个单元测试
- [x] 为 Chat 调试面板和 API 端点新增 ≥12 个单元测试
- [x] 为动态多参数注入与路由跳转新增针对性测试用例
- [x] 现有 162 项测试全部通过（通过率 100%）
- [x] TypeScript 严格类型检查通过：`npm run typecheck`
- [x] 生产构建成功：`npm run build`

#### 7. 内置预设工作流
- [x] 新增预设：「条件客服路由」（Input → LLM 分类器 → IF/ELSE → 分支 A/B → 聚合器 → Output）
- [x] 新增预设：「天气 API 集成」（Input → HTTP GET → LLM 摘要 → Output）

---

### 🤔 已解决的设计决策与技术落地

- [x] **拓扑排序中的分支跳过**：执行完整 Kahn 拓扑调度，基于 `nodeActiveBranch` 和 `incomingEdgesMap` 动态将未激活下游标记为 `skipped`，聚合节点支持按模式重聚。
- [x] **HTTP 节点的 CORS 与安全防护**：前端对 URL 协议进行严格白名单过滤，提示 CORS 原理，支持 Mock 模式并引导配合后端代理使用。
- [x] **Chat 调试面板与属性面板的优雅共存**：Chat 面板作为右侧轻量浮动滑层（支持 `Ctrl+Shift+D` 快捷键切换），不打乱画布焦点。
- [x] **API 发布与鉴权机制**：按工作流级别生成独立 API Key，支持 Bearer Token / X-API-Key 鉴权与一键启停。
- [x] **多参数动态注入与防溢出**：动态提取画布所有 Input 节点参数并提炼调试表单，气泡全面采用 `wrap-anywhere` 与代码卡片安全保护。

---

### 🛠️ 常用验证命令备忘

```bash
# 1. 运行前端全量单元测试
npm test

# 2. 运行后端全量自动化测试
cd server && python -m pytest -v tests/ && cd ..

# 3. 严格类型检查
npm run typecheck

# 4. 生产环境打包构建
npm run build
```
