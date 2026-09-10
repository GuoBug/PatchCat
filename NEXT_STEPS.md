# 🎯 Next Steps / 下次开发接续清单

> **Current Version**: `v0.3.0` (Completed & Verified ✅)  
> **Last Updated**: 2026-09-11  
> **Previous Milestone**: Phase 3 Conditional Routing, External Integration & Interactive Debugging (Shipped ✅)  
> **Current Focus**: **Research & Architectural Design for P0-1: Multi-Turn Conversation Memory**

[English](#english) | [简体中文](#简体中文)

---

<a name="english"></a>
## English

### 🔬 Current In-Depth Research: P0-1 Multi-Turn Conversation Memory in DAG Workflows

- [ ] **1. Architecture & Injection Strategy (Node-based vs. Engine-level)**:
  - **Option A (Engine-level Implicit Context)**: Add an `Enable Conversation Memory` toggle (`maxHistoryRounds: number`) to the LLM Node configuration. When enabled, the DAG scheduler automatically injects sliding-window messages from the current conversation session into the LLM payload before invoking the model.
  - **Option B (Node-based Explicit Graph Wire)**: Introduce a dedicated `Memory` node on the canvas (`memory.buffer` or `memory.summary`) that connects directly to the LLM node's context handle.
  - *Trade-off analysis required*: Ease-of-use for prompt builders (Option A) vs. explicit topology and multi-branch isolation (Option B).
- [ ] **2. Memory Truncation & Budgeting Strategies**:
  - **Buffer Window Memory**: Retain the latest $K$ rounds of dialogue (low overhead, easy to reason about).
  - **Token-Budgeted Memory**: Dynamically prune older messages according to model context limits (`maxTokenLimit`).
  - **Summarized Memory**: Rolling LLM-powered background summarization of older dialogue rounds to preserve critical intent with minimal token consumption.
- [ ] **3. Session & Multi-LLM Disambiguation**:
  - **Multi-LLM scoping**: Clarify memory assignment when a workflow contains multiple LLM nodes (e.g., intent classifier LLM vs. answer responder LLM).
  - **Client-side session isolation**: Namespace memory by `workflowId` with clear/reset controls in `ChatDebugPanel`.
  - **REST API session continuity**: Support a `session_id` parameter in `POST /api/v1/workflows/{id}/run` to maintain multi-turn memory on the server side.

---

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

### 🔬 当前重点研究专题：P0-1 DAG 工作流中的多轮会话记忆 (Conversation Memory)

- [ ] **1. 记忆架构与注入机制方案权衡 (节点显式连线 vs. 引擎隐式上下文)**：
  - **方案 A（引擎隐式上下文 / 配置开关）**：在 LLM 节点的属性面板中提供「开启会话记忆」开关（可配置 `保留历史轮数 maxHistoryRounds`）。开启后，调度引擎在调用模型前，自动将当前 Session 中滑动窗口内的历史对话合并进 `messages` 数组。
  - **方案 B（画布显式节点连线）**：在画布中引入专门的 `Memory`（记忆）节点（如 `memory.buffer` 或 `memory.summary`），将其输出端连线至 LLM 节点的上下文端口。
  - *需重点权衡*：Prompt 编排者的开箱即用体验（方案 A）对比多分支复杂隔离场景下的拓扑自由度（方案 B）。
- [ ] **2. 记忆窗口裁剪与 Token 预算策略**：
  - **滑动窗口记忆 (Buffer Window Memory)**：保留最近 $K$ 轮会话，实现轻量、易于排查和预测。
  - **Token 预算裁剪 (Token-Budgeted Memory)**：根据目标模型的上下文上限（`maxTokenLimit`）动态倒序淘汰最久远的历史消息。
  - **滚动摘要记忆 (Summarized Memory)**：利用后台 LLM 对超出轮数的历史对话进行滚动作摘要提炼，以最少 Token 消耗保留核心上下文语义。
- [ ] **3. 会话隔离与多模型归属裁决**：
  - **多 LLM 节点歧义**：明确当单一工作流中包含多个 LLM 节点（如意图分类模型 + 客服解答模型）时，记忆应精准绑定给哪个节点，避免无关上下文污染。
  - **前端会话隔离**：基于 `workflowId` 在浏览器端划分独立存储命名空间，并在 `ChatDebugPanel` 提供一键清空/重置。
  - **REST API 会话连贯性**：在 `POST /api/v1/workflows/{id}/run` 接口中支持透传 `session_id`，实现服务端跨请求的多轮记忆持久化与复用。

---

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
