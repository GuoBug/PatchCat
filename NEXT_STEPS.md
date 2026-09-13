# 🎯 Next Steps / 下次开发接续清单

> **Current Version**: `v0.4.2` (Completed & Verified ✅)  
> **Last Updated**: 2026-09-13  
> **Previous Milestone**: Phase 4 Agent Capabilities & ReAct Autonomous Loop (Shipped ✅)  
> **Current Focus**: **Phase 5: Hybrid Retrieval (BM25 + Dense), Reranker Integration & Docker Deployment**

[English](#english) | [简体中文](#简体中文)

---

<a name="english"></a>
## English

### ⚡ Completed Milestone: Phase 4 Agent Capabilities & Autonomous ReAct Loop (v0.4.2)

- [x] **1. Agent Execution Engine & ReAct Loop ([PRD-011](docs/01-prd/PRD-011-Agent-Capabilities-and-Tool-Use.md))**:
  - Implemented `AgentNode.tsx` with blue-purple gradient, dynamic tool count badges, and real-time iteration counters.
  - Implemented autonomous ReAct loop inside `BrowserWorkflowEngine` (`browser-engine.ts`) with cycle control, maxIterations bounds, and `AGENT_ITERATION` / `AGENT_TOOL_CALL` real-time event streaming.
  - Supported multi-type tool execution: sandboxed JavaScript (`builtin_code`), external HTTP REST (`builtin_http`), canvas node delegation (`canvas_node`), and declarative schema definitions (`custom_schema`).
- [x] **2. Universal Tool Calling Extension (`llm-client.ts`)**:
  - Extended OpenAI / Google Gemini / DeepSeek client with `tools` JSON Schema declaration and `tool_choice` options.
  - Built streaming accumulator reconstructing `delta.tool_calls` fragments across SSE chunks into structured function invocations.
- [x] **3. Loop & Sub-Workflow Primitives**:
  - Added `LoopNode.tsx` for batch processing of dynamic array variables with concurrent slicing.
  - Added `SubWorkflowNode.tsx` for reusable nesting of existing project workflows.
- [x] **4. Visual Configuration & Presets**:
  - Built Property Panel UI for System Prompt, collapsible Registered Tool list editor, and iteration sliders.
  - Created official bilingual preset "Autonomous Agent with Tool Calling" (`agent-tool-calling`) in English and Chinese.
  - Expanded automated test suite with `tests/agent-node.node.test.ts` (195 tests total, 100% green pass rate).

---

### 🔬 Next Stage: Phase 5 Advanced RAG & Docker Production Delivery (v0.6.0)

- [ ] **1. Hybrid Search (BM25 + Dense Vector)**:
  - Implement Reciprocal Rank Fusion (RRF) combining keyword inverted index with cosine similarity.
- [ ] **2. Reranker Cross-Encoder Integration**:
  - Integrate Cohere / BGE / Jina reranker models to improve Top-K context recall precision.
- [ ] **3. Docker Compose Private Deployment**:
  - Deliver standardized `docker-compose.yml` packaging Vite static frontend, FastAPI async backend, and PostgreSQL `pgvector`.
- [ ] **4. Rolling Background Summarization**:
  - Implement rolling LLM background summarization of pruned conversational memory rounds.

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

### ⚡ 已交付里程碑：Phase 4 AI 智能体能力层与 ReAct 自主循环架构 (v0.4.2)

- [x] **1. Agent 执行引擎与 ReAct 循环 ([PRD-011](docs/01-prd/PRD-011-Agent-Capabilities-and-Tool-Use.md))**：
  - 在 `src/components/nodes/AgentNode.tsx` 打造蓝紫色科技风智能体卡片，提供已注册工具数、模型标记与实时迭代步数脉冲徽章；
  - 在 `src/engine/browser-engine.ts` 中实现完整的 ReAct（`思考 ➔ 调工具 ➔ 观察 ➔ 思考`）闭环循环，内置 `maxIterations` 熔断防止死循环；
  - 支持多模态工具路由执行：Web Worker 沙箱安全执行 JavaScript（`builtin_code`）、外部 REST API 动态请求（`builtin_http`）、画布已有节点委托（`canvas_node`）以及标准工具 Schema（`custom_schema`）。
- [x] **2. 通用 Tool Calling 客户端增强 (`src/engine/llm-client.ts`)**：
  - 规范化扩展 OpenAI / Google Gemini / DeepSeek 的标准 `tools`（JSON Schema）与 `tool_choice` 参数；
  - 打造高可靠 SSE 流式累加器，无缝拼接分片传输的 `delta.tool_calls`。
- [x] **3. 批量循环与子流程嵌套原语**：
  - 新增 `LoopNode.tsx` 列表批量并发迭代节点，具备完善的非数组/空数据容错；
  - 新增 `SubWorkflowNode.tsx` 子工作流组件，实现已有工作流的组件化嵌套复用。
- [x] **4. 可视化交互面板与官方双语预设**：
  - 在 `PropertyPanel.tsx` 中打造系统提示词编辑区、可折叠动态增删的工具列表卡片管理器、最大轮数与温度调节滑块；
  - 打造官方中英双语「自主工具调用 Agent」预设（`agent-tool-calling`），演示外汇汇率查询与交易扣费高精度计算的协同链路；
  - 新增 `tests/agent-node.node.test.ts`（16 个新用例），自动化测试套件扩充至 195 项用例 100% 绿灯全通。

---

### 🔬 下一阶段攻坚：Phase 5 高级 RAG 混合检索与 Docker 私有化交付 (v0.6.0)

- [ ] **1. 混合检索体系 (BM25 倒排 + 稠密向量)**：
  - 引入 Reciprocal Rank Fusion (RRF) 倒排索引与向量相似度加权融合召回算法，解决专业术语与生僻词漏检痛点。
- [ ] **2. 交叉编码器 Reranker 重排序集成**：
  - 深度接入 Cohere / BGE / Jina 交叉重排模型，大幅压缩上下文冗余噪声。
- [ ] **3. Docker Compose 标准化私有部署包**：
  - 编写生产级 `docker-compose.yml`，打包 Vite 静态前端、FastAPI 异步网关与 PostgreSQL `pgvector`。
- [ ] **4. 滚动后台长效摘要记忆 (Rolling Summarizer)**：
  - 引入后台轻量模型对淘汰的历史轮次进行滚动作语义摘要，以极低 Token 代价保持长效记忆。

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
