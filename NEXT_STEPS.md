# 🎯 Next Steps / 接续开发清单

> **Current Version**: `v0.4.4` (Completed & Verified ✅)  
> **Last Updated**: 2026-09-16  
> **Previous Milestone**: Phase 4.1 Agent Runtime Hardening, Global Settings Architecture & Reliability Baseline (`v0.4.4` Shipped ✅)  
> **Current Target Milestone**: **`v0.4.6` Canvas Ergonomics & High-Frequency Productivity**  

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

### 🚀 Upcoming Milestone: v0.4.6 Canvas Ergonomics & High-Frequency Productivity

- [ ] **1. Multi-Node Copy & Paste (`Ctrl+C` / `Ctrl+V`)**:
  - Box select multiple nodes on canvas and copy them with newly generated node IDs and preserved relative offsets.
- [ ] **2. Canvas Undo & Redo History Stack (`Ctrl+Z` / `Ctrl+Y`)**:
  - Implement temporal undo/redo state history for node add/delete and edge connection changes.
- [ ] **3. In-Place Node Local Retry**:
  - Allow re-executing an individual failed node using cached upstream outputs without re-running the entire graph.
- [ ] **4. Node-Level ErrorBoundary Visual Isolation**:
  - Prevent unexpected rendering errors in custom node cards from crashing the entire XYFlow canvas.

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

### 🚀 即将推进里程碑：v0.4.6 画布高频交互生产力

- [ ] **1. 节点批量复制与粘贴 (`Ctrl+C` / `Ctrl+V`)**：
  - 支持画布框选多节点，快速复制并自动生成新 Node ID 与带偏移坐标粘贴。
- [ ] **2. 画布撤销重做历史栈 (`Ctrl+Z` / `Ctrl+Y`)**：
  - 实现节点增删、移动与连线动作的历史回退与重做。
- [ ] **3. 单节点就地重新运行 (Local Retry)**：
  - 允许只重跑某个报错节点，复用上游输出缓存，免去整画布从头调度的开销。
- [ ] **4. 节点级 ErrorBoundary 局部错误隔离**：
  - 单个自定义节点内部渲染异常时呈现优雅占位报错卡片，彻底避免整画布白屏。

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
