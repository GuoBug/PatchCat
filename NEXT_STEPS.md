# 🎯 Next Steps / 接续开发清单

> **Current Version**: `v0.4.10` (Completed & Verified ✅)  
> **Last Updated**: 2026-09-23  
> **Previous Milestone**: Phase 4.10 Immutable Checkpointing & Resumable DAG Execution (`v0.4.10` Shipped ✅)  
> **Current Target Milestone**: **`v0.4.12` Local Lightweight Hybrid Search (BM25 + Vectors) (纯本地轻量混合检索)**  

[English](#english) | [简体中文](#简体中文)

---

<a name="english"></a>
## English

### ⚡ Completed Milestone: Phase 4.1 Agent Hardening, Global Settings Architecture & Reliability Baseline (v0.4.4)

#### 1. Central Runtime Defaults Module (`src/config/runtime-defaults.ts`)
- [x] Create `src/config/runtime-defaults.ts` as the central source of truth for runtime constants.
- [x] Eliminate all scattered magic numbers:
  - Sandbox watchdog timeout (replace hardcoded `5000ms`).
  - LLM client network retries (replace hardcoded `1` retry and `1500ms` delay).
  - Canvas auto-save debounce (replace hardcoded `800ms`).
  - HTTP node and Loop node default timeouts.

#### 2. ReAct Agent Loop Safeguards & Watchdogs
- [x] **Token Budget Limiter (`maxTokenBudget`)**:
  - Added `maxTokenBudget` property to `AgentNodeConfig` (0 = unlimited / off, positive integer = limit, clamp negative numbers to 0).
  - Accumulate prompt and completion tokens per ReAct iteration; instantly trip loop and return partial synthesis when budget is exceeded.
- [x] **Looping Tool-Call Detector (`loopDetectionEnabled`)**:
  - Added optional toggle `loopDetectionEnabled` (default: ON) and threshold `loopDetectionThreshold` (default: 3).
  - When 2 consecutive identical calls are detected, inject a corrective system hint.
  - When reaching 3 consecutive identical calls, trip the circuit breaker with a clear diagnostic explanation.
- [x] **Step Tool Execution Timeout Watchdog**:
  - Linked with Global Settings `toolTimeoutEnabled` and `toolTimeoutSeconds`.
  - Equip `builtin_http` with `AbortSignal.timeout(timeoutMs)` to prevent external hanging requests from blocking the canvas.
- [x] **Tool Error Observation Feedback & Self-Healing**:
  - Wrapped tool executions with unified try/catch, returning `Observation: Error - <reason>` to allow LLM self-correction instead of throwing unhandled exceptions.
- [x] **Sub-Workflow (`SubWorkflowNode`) Scope Isolation**:
  - Deep clone variable context via `structuredClone` to prevent parent/child variable pollution.

#### 3. Global Settings 5-Tab Redesign & Backup/Restore
- [x] Restructured `SettingsPage.tsx` into 5 clean tabs:
  - 🌐 **General & Backup**: Language, Theme, Auto-save Debounce slider, Storage Mode, Settings Export/Import, Danger Zone.
  - 🛡️ **Execution & Safety**: Tool timeout watchdog toggle & seconds, Code sandbox timeout, Agent deadlock detection toggle & threshold, Default max iterations.
  - 🤖 **Model Providers & Network**: Provider credentials, BaseURL, LLM network max retries (`0` ~ `3`), Retry delay (`0.5s` ~ `5.0s`).
  - 🧠 **Conversation Memory**: Tier 1 global conversation memory defaults.
  - 📋 **Execution Logs**: Sanitized multi-level logs, filter, search, and export.
- [x] **System Settings Export & Import Backup**:
  - `exportSettings(includeSensitiveKeys: boolean)`: Supports sanitized mode (no API keys) and full backup mode (with keys & prominent warning modal).
  - `importSettings(jsonString: string)`: Version validation, schema integrity checks, and clean store hydration.

#### 4. Language-Aware Danger Zone Secondary Confirmation
- [x] Optimized `DangerConfirmModal.tsx` and `SettingsPage.tsx`:
  - When user language is Chinese (`zh`), **only display and require the Chinese confirmation phrase** (`清空缓存` / `删除所有工作流`).
  - When user language is English (`en`), **only display and require the English confirmation phrase** (`CLEAR CACHE` / `DELETE ALL WORKFLOWS`).
  - Eliminated confusing dual "or" prompt display.

#### 5. Configuration Documentation Directory (`docs/05-configuration/`)
- [x] Created `docs/05-configuration/README.md` explaining configuration architecture, cascading priority (Default → Global → Node Override), and backup/migration guide.
- [x] Created `docs/05-configuration/runtime-parameters-reference.md` providing a comprehensive dictionary of all runtime parameters, scopes, types, default values, and operational guidelines.
- [x] Updated `docs/README.md` and root `README.md` with links to the configuration documentation.

#### 6. Essential Frontend Contracts & Testing
- [x] Created `tests/agent-runtime-guard.node.test.ts` (12 tests covering runtime constants, settings export/import, danger single-language match, sub-workflow scope isolation).
- [x] 223 frontend unit tests & 21 backend pytest tests passing 100%.
- [x] TypeScript strict check (`npm run typecheck`) and production build (`npm run build`) passed with zero errors.

---

### ⚡ Completed Milestone: Phase 4.2 Canvas Ergonomics, Pinpoint Diagnostics & Productivity (v0.4.6)

- [x] **1. Comprehensive Tooltip Guidance System**:
  - Concise 1-sentence (max 2 for complex) technical descriptions for all 12 nodes in both English and Chinese.
  - Engineering conceptual tooltips for DAG, Topological Scheduling, Vector RAG, Token Budget Limiter, and Sampling Temperature.
- [x] **2. Pinpoint Error Diagnostics & Visual Pop Focus**:
  - Direct technical messages (e.g. `参数未就绪: {{var}} 未定义`) replacing low-information metaphors.
  - `[🔍 Locate Node]` button in error notifications triggering smooth viewport centering (`setCenter(x, y, { zoom: 1.1 })`) and 1600ms visual pop pulse ring (`ring-4 ring-rose-500/80 scale-103`).
  - Interactive cycle node chips in deadlock warnings to locate cyclic nodes with one click.
- [x] **3. Bounded Canvas History Manager (`Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z`)**:
  - 25-depth snapshot queue using deep cloning to prevent memory leaks and infinite growth.
  - Automatically records node add/delete, edge connect/delete, and node drag stops (`onNodeDragStop`).
  - Safe suppression when typing in input, textarea, contentEditable, or Monaco editors.
- [x] **4. Multi-Node Clipboard (`Ctrl+C` / `Ctrl+V`)**:
  - Box select multiple nodes to copy, generating new unique IDs upon paste.
  - Preserves internal connections between selected nodes while filtering out external connections.
  - Cascades paste coordinates diagonally by `(+50px, +50px)`.
- [x] **5. In-Place Node Local Retry & Parallel Recovery**:
  - Re-run individual failed node using cached upstream outputs (`node.data.outputs`) without restarting the full workflow.
  - Parallel failure resolution: multiple failed nodes remain isolated; top header offers `[ {count} Nodes Failed | ↺ Retry All Failed ]`.
  - Downstream waiting nodes (like Aggregators) automatically unblock upon upstream success.
- [x] **6. Node-Level React Error Boundary (`NodeErrorBoundary`)**:
  - Wraps custom node children to isolate render exceptions, preventing canvas whiteout.
- [x] **7. Flow Telemetry & Multi-Format Delivery**:
  - GPU-accelerated animated running edge pulse (`react-flow-dash`).
  - Quick multi-format copy toolbar: `[📋 MD]`, `[💾 TXT]`, and `[{ } JSON]`.
- [x] **8. Verification**: 223/223 tests passing across 49 test suites, 0 typecheck errors, production build verified.

---

### ⚡ Completed Milestone: Phase 4.3 Empty Canvas Guidance, Scenario Template Gallery, Progressive Low-Code & Draft Recovery Safeguards (v0.4.6)

- [x] **1. Adaptive Empty Canvas Hero Inspiration Card (`EmptyCanvasHero.tsx`)**:
  - Automatically activates when canvas has 0 nodes, distinguishing first-time explorers from returning users.
  - Newcomer State: Visual scenario templates entry and guidance for understanding node topologies.
  - Returning User State: 1-click starter pipeline (`Input ➔ Prompt ➔ LLM`), JSON import, and 300ms smooth fade-out.
- [x] **2. Categorized Scenario Template Showcase Gallery (`TemplateShowcaseModal.tsx` & `preset-meta.ts`)**:
  - Curated 8 production scenarios across RAG, routing, arena eval, API, and agent tools.
  - Visual pipeline capsules (e.g. `Input ➔ Knowledge ➔ Draft ➔ Auditor ➔ Output`), category chips, and search.
  - One-click full graph population with `fitView` viewport centering.
- [x] **3. Drop-to-Add Connection & AABB Collision Avoidance Algorithm (`DropToAddMenu.tsx` & `workflow-store.ts`)**:
  - Releasing in-flight connection on empty canvas brings up an in-place micro-palette.
  - AABB bounding box collision avoidance guarantees $\ge 40px$ spacing along the DAG vector with boundary wrapping.
- [x] **4. Progressive Low-Code Node Suite**:
  - **Code Node (`CodeNodeProperties.tsx`)**: 4 curated production snippets (`markdown_json`, `line_split`, `strip_whitespace`, `merge_dicts`). Folds raw editor by default into a clean card with `[ 🛠️ 高级编辑 ]` toggle for engineers.
  - **Prompt Node (`PromptNodeProperties.tsx`)**: Static output schema contract derivation at design time without pre-run dependency, `@` popover autocomplete, and fallback syntax (`{{var | 'default'}}`).
  - **Condition Node (`ConditionNode.tsx`, `ConditionNodeProperties.tsx`, `browser-engine.ts`)**: Dual-mode toggle between Visual Rules Builder and Single-Line JS Expression sandbox with fallback routing.
- [x] **5. Draft Safety, Save Status & Shadow Recovery Guard (`shadow-draft-manager.ts`, `SaveStatusBadge.tsx`, `ShadowDraftRecoveryBanner.tsx`, `App.tsx`)**:
  - Real-time save status badge (`🟢 Saved / 🟡 Syncing...`).
  - Browser `beforeunload` guard during active workflow execution.
  - Scheme B Shadow Draft time-delta diffing on mount/refresh to restore uncommitted edits with zero data loss.
- [x] **6. Verification & Automated Test Suite**:
  - 245 frontend unit tests passing 100% across 57 test suites with 0 typecheck errors and production build verified.
  - Strictly enforced respectful professional copy across all UI and docs (zero occurrences of '小白').

---

### ⚡ Completed Milestone: Phase 4.8 Run Observability, Step Snapshots & OpenTelemetry Tracing (v0.4.8)

- [x] **1. Run Observability & 10-Run History Timeline (`RunHistoryDrawer.tsx`, `workflow-store.ts`)**:
  - Slide-over drawer displaying the recent 10 workflow execution runs with timestamps, trigger mode (Manual / Chat / Scheduled), run status, and total duration.
  - Aggregate KPI cards summarizing overall execution latency, Prompt/Completion token breakdown, and estimated USD cost.
  - Interactive execution waterfall timeline (Gantt chart) visualizing each wave and node's relative start offset and duration ratio.
- [x] **2. Node Step Data Freeze-Frame Inspector (`StepDataInspector.tsx`)**:
  - Precision modal for inspecting immutable historical step data across 3 tabs:
    1. **Inputs**: Exact upstream data payload received at execution time.
    2. **Outputs**: Node execution products, LLM outputs, or error details with one-click JSON/formatted copy.
    3. **Telemetry & OTel**: Node-level OpenInference attributes, Trace ID, Span ID, TTFT, and token usage breakdown.
- [x] **3. OpenTelemetry & OpenInference Standard Alignment (`otel-tracer.ts`, `otel-exporter.ts`)**:
  - Pure-frontend W3C Trace Context generation: 128-bit hex `TraceId` and 64-bit hex `SpanId`.
  - OpenInference semantic attributes: `openinference.span.kind`, `llm.model_name`, `llm.token_count`, `llm.ttft_ms` (Time-to-First-Token).
  - Hierarchical tree span arrangement: Root Span (`workflow.run`) ➔ Wave Spans (`wave.X`) ➔ Node Spans (`node.<type>.<id>`).
  - Standard OTel ResourceSpans JSON export with 1-click file download (`patchcat-trace-{traceId}.json`) and clipboard copying, directly ingestible by APM platforms (Langfuse, Datadog, Jaeger).
- [x] **4. Multi-Model Token Pricing & Dynamic Cost Engine (`model-pricing.ts`)**:
  - Built-in pricing rules per 1M tokens for Google Gemini, DeepSeek, OpenAI, SiliconFlow, and free tier for local Ollama models.
  - Polymorphic `estimateTokenCostUSD` supporting both camelCase (`promptTokens`/`completionTokens`) and snake/flat (`prompt`/`completion`) token counts.
- [x] **5. Client-Side IndexedDB Storage Upgrade (`indexeddb-adapter.ts`)**:
  - Upgraded schema to `DB_VERSION = 2` with dedicated `run_history` object store and `by_workflow` index.
  - Enforced 10-record FIFO ring-buffer eviction per workflow to maintain bounded browser storage footprint.
- [x] **6. Browser Engine Observability Instrumentation (`browser-engine.ts`)**:
  - End-to-end tracing and immutable step snapshot capture via `structuredClone` across wave scheduling and node execution.
  - Automated cost aggregation and background persistence upon workflow completion.
- [x] **7. Entrypoints & Ergonomics (`ControlHeader.tsx`, `Footer.tsx`, `App.tsx`)**:
  - Added 「🕒 运行历史」 triggers to Header toolbar and Footer status bar.
  - Global keyboard shortcut `Ctrl+Shift+H` for instant drawer toggle.
- [x] **8. Verification**: 261/261 unit tests passing across 60 test suites, 0 typecheck errors, production build verified.

---

### ⚡ Completed Milestone: Phase 4.10 Immutable Checkpointing & Resumable DAG Execution (v0.4.10)

- [x] **0. Architectural Specification & Product Definition ([PRD-016](docs/01-prd/PRD-016-Immutable-Checkpointing-and-Resumable-DAG-Execution.md))**:
  - Published comprehensive PRD defining DAG Checkpointing schema, reverse-adjacency ancestor traversal, dirty state cascading, and UI ergonomics.
- [x] **1. Immutable Execution Snapshots Storage (`indexeddb-adapter.ts`)**:
  - Upgraded schema to `DB_VERSION = 3` with dedicated `checkpoints` object store and indexes (`by_workflow`, `by_timestamp`, `by_checkpoint_id`).
  - Strict 5-record FIFO ring-buffer eviction per workflow to maintain bounded storage footprint (<20MB).
  - In-memory fallback map for high-speed automated Node.js testing environments.
- [x] **2. In-Place Node Resumption & Subgraph Pruning (`browser-engine.ts`, `topological-sort.ts`)**:
  - `resumeFromNodeId` executes in-place resumption starting from target failed node, walking ancestor dependencies and scheduling only the pruned downstream subgraph $\{target\} \cup Descendants(target)$ via Kahn's algorithm.
  - Zero token recomputation guarantee: ancestor outputs are 100% reused (0 token spend, 0 duration, zero re-fetching) with status marked as `'cached'`.
  - Upward dependency expansion: if any ancestor output is unfulfilled or missing, automatically expands execution wave upstream.
- [x] **3. Topology & Node Config Fingerprinting (`topological-sort.ts`)**:
  - Deterministic MD5/Murmur-style structural hashing (`computeGraphTopologyHash`, `computeNodeConfigHash`) to guard against graph mutations.
- [x] **4. Canvas Ergonomics & React Flow UI Integration (`BaseNode.tsx`, `PropertyPanel.tsx`, `ControlHeader.tsx`, `RunHistoryDrawer.tsx`)**:
  - Added `[ ⏯️ Resume Downstream ]` action in `BaseNode` headers, `PropertyPanel` footer, and `ControlHeader` error banner.
  - Added `[ ⤺ Restore to Canvas ]` in `RunHistoryDrawer` to hydrate historical run snapshots directly onto active canvas.
  - Added dedicated `'cached'` node status styling with sky-blue border, lock icon, and `Cached (0 Token)` badges.
- [x] **5. Verification & Testing**:
  - Added `tests/checkpoint-resumption.node.test.ts` (8 suites) and expanded `tests/canvas-ergonomics.node.test.ts` (3 new suites).
  - 272/272 automated unit tests passing across 65 suites with 100% green rate.

---

### 🚀 Active Milestone: v0.4.12 Local Lightweight Hybrid Search (BM25 + Vectors)

- [ ] **1. Pure-Frontend In-Memory BM25 Lexical Inverted Index Engine**:
  - Zero-dependency in-memory inverted index for browser Local BYOK mode with CJK n-gram & whitespace tokenization.
- [ ] **2. Reciprocal Rank Fusion (RRF) Hybrid Scoring**:
  - Weighted fusion algorithm combining lexical keyword scores and dense vector cosine similarity.
- [ ] **3. Retrieval Scoring Visualization & Keyword Highlights**:
  - Visualization of BM25 vs Dense vector contributions and highlight chips in Knowledge node preview.

---

### 🔮 Upcoming Milestone: v0.4.14 Reranker Cross-Encoder API Integration

- [ ] **1. Multi-Provider Reranker Client (`reranker-client.ts`)**:
  - Direct integration with SiliconFlow (`BAAI/bge-reranker-v2-m3`), Cohere, and Jina Rerank endpoints.
- [ ] **2. Knowledge Node Re-ranking Pipeline & Token Compression**:
  - Top-N reranking cutoff and relevance filtering before prompt synthesis.

---

### 🛠️ Common Verification Commands

```bash
# 1. Run all frontend unit & contract tests
npm test

# 2. Run all backend tests
pytest server/tests/

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
  - 在 `src/engine/browser-engine.ts` 中实现完整的 ReAct 闭环循环，内置 `maxIterations` 熔断防止死循环；
  - 支持多模态工具路由执行：Web Worker 沙箱安全执行 JavaScript（`builtin_code`）、外部 REST API 动态请求（`builtin_http`）、画布已有节点委托（`canvas_node`）以及标准工具 Schema（`custom_schema`）。
- [x] **2. 通用 Tool Calling 客户端增强 (`src/engine/llm-client.ts`)**：
  - 规范化扩展 OpenAI / Google Gemini / DeepSeek 的标准 `tools`（JSON Schema）与 `tool_choice` 参数；
  - 打造高可靠 SSE 流式累加器，无缝拼接分片传输的 `delta.tool_calls`。
- [x] **3. 批量循环与子流程嵌套原语**：
  - 新增 `LoopNode.tsx` 列表批量并发迭代节点，具备完善的非数组/空数据容错；
  - 新增 `SubWorkflowNode.tsx` 子工作流组件，实现已有工作流的组件化嵌套复用。
- [x] **4. 可视化交互面板与官方双语预设**：
  - 在 `PropertyPanel.tsx` 中打造系统提示词编辑区、可折叠动态增删的工具列表卡片管理器、最大轮数与温度调节滑块；
  - 打造官方中英双语「自主工具调用 Agent」预设（`agent-tool-calling`）；
  - 测试套件扩充至 211 项前端单元/契约测试及 21 项后端自动化测试，通过率 100%。

---

### ⚡ 已交付里程碑：Phase 4.1 智能体运行时加固、全局设置规范化与可靠性基线 (v0.4.4)

#### 1. 运行时集中默认值中枢 (`src/config/runtime-defaults.ts`)
- [x] 创建 `src/config/runtime-defaults.ts` 作为全系统运行时常量的唯一事实源（Single Source of Truth）。
- [x] 全面消除散落各处的魔法数字：
  - 脚本沙箱看门狗超时（替换硬编码 `5000ms`）。
  - LLM 客户端网络重试次数与等待时长（替换硬编码 `1` 次与 `1500ms`）。
  - 画布自动保存防抖延迟（替换硬编码 `800ms`）。
  - HTTP 请求节点与 Loop 循环迭代节点默认超时时长。

#### 2. ReAct 智能体循环安全防护网
- [x] **Token 消耗硬熔断 (`maxTokenBudget`)**：
  - 在 `AgentNodeConfig` 中新增 `maxTokenBudget` 字段（`0` = 不限制/关闭；正整数 = 开启熔断；自动截断拦截负数）。
  - 循环中累加 Prompt 与 Completion Token，超出预算立即截断迭代并触发阶段性总结退出。
- [x] **重复调用死锁打破器 (`loopDetectionEnabled`)**：
  - 新增可选开关 `loopDetectionEnabled`（默认开启）与判定阈值 `loopDetectionThreshold`（默认 3 次）。
  - 连续 2 次完全相同调用注入系统纠偏提示词，连续 3 次相同调用强行熔断并给出明确诊断。
- [x] **单步工具执行超时看门狗**：
  - 联动全局设置中的 `toolTimeoutEnabled` 与 `toolTimeoutSeconds`。
  - 为 `builtin_http` 等外部工具赋予 `AbortSignal.timeout(timeoutMs)`，杜绝外部服务卡死整图。
- [x] **工具执行异常 Observation 格式化自愈**：
  - 统一捕获工具报错，转换为标准 `Observation: Error - <reason>` 优雅喂回 LLM 思考，杜绝未捕获异常崩溃。
- [x] **子工作流 (`SubWorkflowNode`) 上下文作用域隔离**：
  - 通过 `structuredClone` 深度隔离父子流程变量上下文，消除深层嵌套下的变量污染。

#### 3. 全局设置 5 栏规范重构与一键备份/还原
- [x] 将 `SettingsPage.tsx` 升级重构为职责清晰的 5 大核心标签页：
  - 🌐 **常规与备份 (General & Backup)**：语言、外观主题、画布自动保存防抖滑块（`500ms` ~ `5000ms`）、存储模式、**系统配置导入/导出**、危险区域。
  - 🛡️ **运行与防护 (Execution & Safety)**【新增专区】：工具超时看门狗开关及秒数、JS 沙箱最大执行时间、Agent 死锁检测开关及阈值、Agent 默认最大迭代轮数。
  - 🤖 **模型与网络 (Model Providers & Network)**：模型商配置、BaseURL、**偶发网络故障最大重试次数 (0~10)**、**重试退避时长 (1~30s)**。
  - 🧠 **对话记忆 (Conversation Memory)**：维持多轮记忆全局默认策略。
  - 📋 **审计日志 (Execution Logs)**：三层脱敏日志、级别过滤、实时搜索、一键导出。
- [x] **系统配置一键导出与导入备份 (Settings Export/Import)**：
  - `exportSettings(includeSensitiveKeys: boolean)`：支持脱敏导出（无 Key）与全量备份导出（含 Key 并弹窗强警告）。
  - `importSettings(jsonString: string)`：支持 JSON 导入校验、版本匹配检查与 Store 动态刷新。

#### 4. 危险区二次输入确认单语智能匹配
- [x] 优化 `DangerConfirmModal.tsx` 与 `SettingsPage.tsx`：
  - 当前语言为中文（`zh`）时：**仅显示且仅要求输入中文确认短语**（`清空缓存` / `删除所有工作流`）。
  - 当前语言为英文（`en`）时：**仅显示且仅要求输入英文确认短语**（`CLEAR CACHE` / `DELETE ALL WORKFLOWS`）。
  - 彻底去除原有中英混杂的 `A or B` 提示。

#### 5. 官方系统配置参考文档目录 (`docs/05-configuration/`)
- [x] 创建 `docs/05-configuration/README.md`：说明配置架构、分层优先级（代码内置默认 → 全局设置 → 节点覆盖）与备份迁移指南。
- [x] 创建 `docs/05-configuration/runtime-parameters-reference.md`：建立全量参数大字典，逐一记录参数名、所属层级、类型、取值范围、默认值与场景指南。
- [x] 在 `docs/README.md` 与根目录 `README.md` 增加一级索引跳转。

#### 6. 核心契约测试与质量验收
- [x] 编写 `tests/agent-runtime-guard.node.test.ts`（12 项新增单元与契约测试）。
- [x] 全量 223 项前端测试与 21 项后端测试 100% 绿灯。
- [x] 严格类型检查 `npm run typecheck` 与生产打包 `npm run build` 100% 绿灯。

---

### ⚡ 已交付里程碑：Phase 4.2 画布工效学、精准报错诊断与高频交互生产力 (v0.4.6)

- [x] **1. 全节点与核心工程概念 1 句话精准悬停说明 ([PRD-012](docs/01-prd/PRD-012-Canvas-Ergonomics-and-Interactive-Productivity.md))**：
  - 12 类全部节点中英文严格遵循一句话（复杂节点最多两句）标准说明，涵盖卡片标题、图标与添加菜单；
  - 核心工程概念悬停说明：DAG（有向无环图）、拓扑调度排序、语义向量检索、Token 限额保护、模型采样温度。
- [x] **2. 节点精准报错诊断与视口一键定焦**：
  - 客观技术化报错信息（如 `参数未就绪: {{var}} 未定义`），杜绝低幼化比喻；
  - 顶部通知直出 `[🔍 定位节点 (nodeId)]` 按钮，死锁警告中环路节点标签均支持点击定焦；
  - 平滑视口飞渡居中（`setCenter`，缩放 1.1x，时长 600ms），并在目标节点触发 1600ms 强视觉光环呼吸动效（`ring-4 ring-rose-500/80 scale-103`）。
- [x] **3. 画布撤销与重做历史栈 (`Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z`)**：
  - 25 步深拷贝快照历史栈，杜绝内存无限泄露；
  - 自动捕获节点增删、连线增删以及拖拽移动完成（`onNodeDragStop`）；
  - 输入框保护机制：在 input、textarea、contentEditable 或 Monaco 代码编辑器打字时自动屏蔽快捷键。
- [x] **4. 多节点框选复制与粘贴 (`Ctrl+C` / `Ctrl+V`)**：
  - 框选多节点按 `Ctrl+C` 复制，粘贴时自动赋予全新 UUID；
  - 智能保留选中节点之间的内部连线（Internal Edges），过滤外部关联连线；
  - 坐标对角线递增偏移（`+50px, +50px`），多次粘贴不叠放遮挡。
- [x] **5. 单节点就地重试与并行故障恢复**：
  - 单节点就地重试（`executeSingleNode`）：复用上游已缓存输出（`node.data.outputs`），不重新触发前序昂贵 LLM 调用，节省 Token 且避免结果发散；
  - 并行故障隔离：多节点报错时相互独立；当失败节点 $\ge 2$ 时，顶部控制栏显性显示 `[ {count} 个节点执行失败 | ↺ 重试所有失败节点 ]`；
  - 汇聚节点与下游等待节点在上游成功后自动解除等待继续向后执行。
- [x] **6. 节点级渲染异常隔离保护 (`NodeErrorBoundary`)**：
  - 封装独立 React Error Boundary，单节点异常时仅卡片内部降级提示，杜绝整画布白屏。
- [x] **7. 运行流转动效与多格式交付**：
  - GPU 硬件加速连线流动光效（`react-flow-dash`）；
  - Output 节点卡片与属性抽屉输出区提供快速复制工具栏：`[📋 MD]`、`[💾 TXT]`、`[{ } JSON]`。
- [x] **8. 质量验收**：223 项前端测试全部通过，0 类型错误，生产打包顺利完成。

---

### ⚡ 已交付里程碑：Phase 4.3 空画布灵感引导、场景模板画廊、节点渐进式无代码与草稿安全体系 (v0.4.6)

- [x] **1. 双态自适应空画布英雄卡 (`EmptyCanvasHero.tsx`)**：
  - 0 节点空画布时中央常驻，智能感知用户类型：
    - 初次探索者状态：场景化模板画廊入口与认知引导，快速理解节点拓扑；
    - 资深构建者状态：1 键极速起手常用脚手架（`Input ➔ Prompt ➔ LLM`）、本地 JSON 一键导入、300ms 平滑淡出。
- [x] **2. 场景化工作流模板画廊 (`TemplateShowcaseModal.tsx` & `preset-meta.ts`)**：
  - 收录 RAG 事实质检、智能客服分流、模型竞技场、三方 API、智能体工具调用等 8 大精选生产场景；
  - 胶囊拓扑徽章直观呈现流转管道，支持场景搜索与分类过滤，一键全图装配并自动 `fitView` 聚焦居中。
- [x] **3. 拖拽松手即建连与 AABB 空间防碰撞算法 (`DropToAddMenu.tsx` & `workflow-store.ts`)**：
  - 拖拽手柄在空白画布松手弹出就地微型节点选单；
  - 空间 AABB 碰撞检测与躲避算法，沿 DAG 流向平移并保证 $\ge 40px$ 安全间距，画布右边界智能换行。
- [x] **4. 节点渐进式低代码套件**：
  - **Code 节点 (`CodeNodeProperties.tsx`)**：内置 Markdown JSON 提取、单行切分等 4 大生产代码片段，默认折叠为友好状态卡，提供 `[ 🛠️ 高级编辑 ]` 展开 Monaco 原生代码编辑器；
  - **Prompt 节点 (`PromptNodeProperties.tsx`)**：设计期静态契约推导（无需运行即可感知上游输入字段），光标处 `@` 触发智能候选补全，支持 `{{var | 'fallback'}}` 管道符优雅降级；
  - **Condition 节点 (`ConditionNode.tsx`, `ConditionNodeProperties.tsx`, `browser-engine.ts`)**：可视规则表单 ⇄ 单行 JS 表达式安全沙箱双模一键切换，错误自动兜底至 fallback 分支。
- [x] **5. 草稿安全、离开拦截与影子草稿崩溃恢复 (`shadow-draft-manager.ts`, `SaveStatusBadge.tsx`, `ShadowDraftRecoveryBanner.tsx`, `App.tsx`)**：
  - 顶栏实时保存状态呼吸灯（🟢 已保存 / 🟡 正在同步）；
  - 画布执行期间原生 `beforeunload` 退出挽留拦截；
  - 方案 B 影子草稿时序比对，检测到非正常退出时顶部滑出恢复浮条，死守数据 0 丢失。
- [x] **6. 质量验收与测试体系**：
  - 全量 245 项前端测试通过率 100%，57 个测试套件，0 类型错误，生产打包顺利完成；
  - 严格遵循平权叙事规范，全代码库与文档零“小白”字样。

---

### ⚡ 已交付里程碑：Phase 4.8 运行可观测性、单步快照与 OpenTelemetry 标准对齐 (v0.4.8)

- [x] **1. 最近运行历史抽屉 (`RunHistoryDrawer.tsx`, `workflow-store.ts`)**：
  - 侧滑抽屉展示最近 10 次画布执行历史，含时间戳、触发模式（手动/Chat/定时）、状态及执行总耗时；
  - 顶部指标卡：总耗时、Prompt / Completion Token 详细开销、主流模型阶梯动态美元（USD）成本估算；
  - 节点执行瀑布流（Waterfall Timeline Bar Chart）：直观呈现各波次及单节点的相对起始偏移与百分比耗时进度条。
- [x] **2. 节点单步数据冻结快照查看器 (`StepDataInspector.tsx`)**：
  - 冻结快照模态框，提供 Inputs / Outputs / Telemetry 三标签切换；
  - 查看执行当刻的真实入参快照、输出成果物或错误堆栈，支持一键格式化复制。
- [x] **3. OpenTelemetry & OpenInference 工业标准对齐 (`otel-tracer.ts`, `otel-exporter.ts`)**：
  - 纯前端 W3C Trace Context 生成：128 位 `TraceId` 与 64 位 `SpanId` 强随机生成；
  - 对齐 OpenInference 语义契约（`openinference.span.kind`、`llm.model_name`、`llm.token_count`、首字延迟 `llm.ttft_ms`）；
  - 树状 Span 结构：Root Span (`workflow.run`) ➔ Wave Spans (`wave.X`) ➔ Node Spans (`node.<type>.<id>`)；
  - 支持一键下载标准 OTel JSON（`patchcat-trace-{traceId}.json`）及复制剪贴板，无缝对接 Langfuse、Datadog 等 APM 平台。
- [x] **4. 多厂商 Token 计费与成本核算引擎 (`model-pricing.ts`)**：
  - 内置 Google Gemini、DeepSeek、OpenAI、SiliconFlow 及 Ollama 本地模型的百万 Token 计费阶梯；
  - 多态 `estimateTokenCostUSD` 算法，兼容各类模型字段命名差异。
- [x] **5. 端侧持久化与 FIFO 环形淘汰策略 (`indexeddb-adapter.ts`)**：
  - IndexedDB 数据库升级至 `DB_VERSION = 2`，新增 `run_history` 对象仓库与 `by_workflow` 索引；
  - 严格落实单工作流 10 条 FIFO 自动淘汰机制，死守 Local-First 轻量运行。
- [x] **6. 执行引擎全链路埋点与深度拷贝 (`browser-engine.ts`)**：
  - 工作流启动、波次调度与节点执行全链路记录毫秒耗时与输入输出深拷贝快照；
  - 执行完毕自动聚合 Token 账单与成本，异步入库 IndexedDB。
- [x] **7. 交互体验与全局快捷键 (`ControlHeader.tsx`, `Footer.tsx`, `App.tsx`)**：
  - 顶部控制栏与底部状态栏新增「🕒 运行历史」呼出按钮；
  - 全局快捷键 `Ctrl+Shift+H` 瞬时呼出抽屉。
- [x] **8. 质量验收与自动化测试**：
  - 新增 `tests/model-pricing.node.test.ts`、`tests/otel-exporter.node.test.ts`、`tests/observability-engine.node.test.ts`；
  - 全量 261 项前端单元与契约测试通过率 100%，60 个测试套件，0 类型错误，生产打包顺利完成。

---

### ⚡ 已交付里程碑：Phase 4.10 端侧不可变 Checkpointing 与容错断点续跑 (v0.4.10)

- [x] **0. 架构规范与需求定义 ([PRD-016](docs/01-prd/PRD-016-Immutable-Checkpointing-and-Resumable-DAG-Execution.md))**：
  - 发布完整中英双语 PRD 规范，确立 DAG 状态机快照 Schema、逆邻接祖先遍历、脏状态级联算法与画布工效交互设计。
- [x] **1. 端侧不可变执行快照存储 (`indexeddb-adapter.ts`)**：
  - IndexedDB 数据库结构升级至 `DB_VERSION = 3`，新增 `checkpoints` 对象仓库与多维索引（`by_workflow`、`by_timestamp`、`by_checkpoint_id`）；
  - 严格落实单工作流 5 条快照 FIFO 环形自动淘汰机制，死守浏览器本地轻量存储红线 (<20MB)；
  - 针对 Node.js 自动化测试环境实现全内存 Fallback 适配，兼顾高频测试吞吐。
- [x] **2. 失败节点就地断点续跑与增量拓扑子图裁剪 (`browser-engine.ts`, `topological-sort.ts`)**：
  - 实现基于 Kahn 拓扑排序的精准下游子图裁剪调度器：以此节点为起点，仅重新调度 $\{target\} \cup Descendants(target)$；
  - 零 Token 浪费保障：100% 复用祖先已就绪的执行输出（0 Token 消耗、0ms 耗时、零网络请求），节点状态标记为 `'cached'`；
  - 自适应向上逆向依赖扩充：当菱形图或多分支中存在未完成的前置祖先时，自动触发向上扩充分支，确保数据流确定性闭环。
- [x] **3. 拓扑结构与节点配置指纹哈希计算 (`topological-sort.ts`)**：
  - 基于确定性哈希算法（`computeGraphTopologyHash`, `computeNodeConfigHash`）对全图拓扑与单节点参数进行指纹验签，严防快照间跨图结构污染。
- [x] **4. 画布工效学与 React Flow 深度整合 (`BaseNode.tsx`, `PropertyPanel.tsx`, `ControlHeader.tsx`, `RunHistoryDrawer.tsx`)**：
  - 节点卡片头部、属性侧边栏底部及顶部失败警告横幅中一键提供 `[ ⏯️ 从此处断点续跑 ]` 快捷动作；
  - 运行历史抽屉（`RunHistoryDrawer`）支持 `[ ⤺ 恢复快照至画布 ]`，一键还原任意历史轮次的节点输出与执行状态；
  - 新增专用 `'cached'` 节点状态，搭配天青色渐变边框、加锁图标及「缓存已复用 (0 Token)」高辨识度徽章。
- [x] **5. 自动化测试套件扩充与质量验收**：
  - 新增 `tests/checkpoint-resumption.node.test.ts`（8 个测试套件）并扩充 `tests/canvas-ergonomics.node.test.ts`（3 个测试用例）；
  - 全量 272 项自动化测试 100% 绿灯通过，65 个测试套件，0 类型报错，生产打包顺利完成。

---

### 🚀 当前推进里程碑：v0.4.12 纯本地轻量混合检索 (BM25 + 稠密向量)

- [ ] **1. 纯前端内存倒排索引分词引擎 (In-Memory BM25)**：
  - 零后端依赖的纯前端轻量倒排索引，支持 CJK 字符双元分词（Bi-gram）与空格分词，实现精准关键词与字面匹配。
- [ ] **2. 倒排与向量倒数排序融合 (Reciprocal Rank Fusion - RRF)**：
  - 实现工业级 RRF 加权融合算法，自适应平衡 BM25 词法分值与高维语义向量余弦相似度。
- [ ] **3. 检索分值可视化与命中关键词高亮**：
  - 在知识库切片预览与画布节点中直观展现 BM25 vs Vector 贡献比，命中文本片段高亮渲染。

---

### 🔮 后续接续里程碑：v0.4.14 交叉重排 Reranker API 深度集成

- [ ] **1. 多厂商轻量重排客户端适配 (`reranker-client.ts`)**：
  - 接入 SiliconFlow（`BAAI/bge-reranker-v2-m3`）、Cohere 与 Jina Rerank 接口规范。
- [ ] **2. 知识库检索节点重排过滤与上下文压缩**：
  - 设定 Top-N 截断阈值，在 Prompt 注入前对冗余切片进行深度压缩去噪。

---

### 🛠️ 常用验证命令备忘

```bash
# 1. 运行全量前端单元测试与契约测试
npm test

# 2. 运行后端全量自动化测试
pytest server/tests/

# 3. 严格类型检查
npm run typecheck

# 4. 生产环境打包构建
npm run build
```
