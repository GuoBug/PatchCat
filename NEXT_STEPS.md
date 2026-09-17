# 🎯 Next Steps / 接续开发清单

> **Current Version**: `v0.4.6` (Completed & Verified ✅)  
> **Last Updated**: 2026-09-17  
> **Previous Milestone**: Phase 4.2 Canvas Ergonomics, Pinpoint Diagnostics & Productivity (`v0.4.6` Shipped ✅)  
> **Current Target Milestone**: **`v0.4.8` Run Observability & Trace Inspection**  

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

### 🚀 Upcoming Milestone: v0.4.8 Run Observability & Trace Inspection

- [ ] **1. Run History Timeline Drawer**:
  - Retain the most recent 10 workflow execution runs with timestamp, duration, status, and token expenditure.
- [ ] **2. Step-by-Step Data Snapshot Inspector**:
  - View exact inputs, outputs, and intermediate states for each node in a historical run.
- [ ] **3. Structured Log Search & Filtering**:
  - Real-time search by keyword, log level (Summary, Detailed, Dev), and node ID.

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

### 🚀 即将推进里程碑：v0.4.8 运行可观测性与执行回溯

- [ ] **1. 最近运行历史抽屉 (Run History Timeline)**：
  - 保留最近 10 次画布执行历史快照，展示状态、触发时间、总耗时与 Token 消耗估算。
- [ ] **2. 节点单步数据检查器 (Step Data Inspector)**：
  - 查看历史运行中各节点的入参快照、实际产出与中间状态。
- [ ] **3. 结构化日志搜索与多维过滤**：
  - 支持按关键字、日志级别（Summary、Detailed、Dev）及关联节点 ID 快速过滤定位。

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
