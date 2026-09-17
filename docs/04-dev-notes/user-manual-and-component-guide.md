---
title: "Visual Canvas & Component User Manual"
version: "0.4.6"
status: "Active"
author: "AI Orchestrator Product & Engineering Team"
created: "2026-08-28"
updated: "2026-09-17"
---

# Visual Canvas & Component User Manual / 可视化画布与组件功能说明手册

[English Version](#english-version) | [中文版本](#中文版本)

---

<a name="english-version"></a>
## English Version

### 1. System Overview & Interface Layout

The **AI Prompt Flow Orchestrator** web interface is built with a modern dark-slate aesthetic, powered by `@xyflow/react` (React Flow v12), Tailwind CSS, Lucide icons, and Zustand with Immer.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  [Logo] PATCHCAT v0.4.4  |  Nodes: 8  Edges: 7  [+ Add Node]  |  Preset: [Dropdown]    │ [Time: 120ms] [↺] [▶ Run] │
├───────────────────────────────────────────────────────────────────┬────────────────────┤
│                                                                   │                    │
│   [Input] ──▶ [Knowledge] ──▶ [Prompt] ──▶ [LLM] ──▶ [Output]    │   Property Panel   │
│                 │                                                 │   (Inspector)      │
│                 └──▶ [Condition] ──▶ [Agent] ──▶ [Aggregator]     │   • Parameters     │
│                                                                   │   • LLM Configs    │
│   • Background Grid Dots (gap 18px)                               │   • Agent Tools    │
│   • Zoom / Pan Controls & MiniMap                                 │   • Output Copier  │
└───────────────────────────────────────────────────────────────────┴────────────────────┘
```

---

### 2. Node Components Matrix (12 Built-in Node Types)

Every node is rendered as a responsive, hardware-accelerated SVG/DOM card with dynamic border states and telemetry badges:

| Node Type | Icon & Theme | Input Port (Left) | Output Port (Right) | Dedicated Features & Preview |
| :--- | :--- | :--- | :--- | :--- |
| **Input Node** | 🟢 Emerald / `PlayCircle` | *None* | `output` | Live parameter dictionary (Key-Value editor), custom types, default values. |
| **Prompt Node** | 🟣 Purple / `FileText` | `inputs` | `promptText` | Multi-line template editor with automatic detection and purple badges for `{{nodeId.var}}`. |
| **LLM Node** | 🔵 Sky / `Bot` | `prompt` | `response` | Multi-provider selector (Gemini, DeepSeek, OpenAI, Ollama), streaming tokens, reasoning chain preview. |
| **Code Node** | 🟡 Amber / `Code2` | `inputs` | `result` | Monospace code block preview supporting safe JS sandbox execution for data transformation. |
| **Output Node** | 🌸 Pink / `CheckCircle2` | `final` | *None* | Formatted multi-line output display with Markdown preview and one-click JSON/text copy. |
| **Condition Node** | 🟠 Orange / `GitFork` | `input` | `true` / `false` | Rule-based branch evaluator supporting comparison expressions and downstream branch pruning. |
| **Aggregator Node** | 🔷 Cyan / `GitMerge` | `branch_a`, `branch_b` | `merged` | Multi-path synchronizer merging parallel or conditional branches with fallback resolution. |
| **HTTP Node** | 🌐 Indigo / `Globe` | `inputs` | `response` | REST API caller supporting GET/POST/PUT/DELETE, custom headers, query params, and JSON body. |
| **Knowledge (RAG)**| 🪸 Teal / `Database` | `query` | `chunks` | Local/server vector database retrieval with cosine similarity scoring and top-K chunk ranking. |
| **Agent Node** | 🔮 Violet / `Sparkles` | `goal` | `result` | Autonomous ReAct loop with dynamic tool discovery, step watchdog, and loop deadlock detector. |
| **Loop Node** | 🔄 Blue / `Repeat` | `items` | `aggregated` | Iterative execution over arrays or condition-based repetition with max iteration bounds. |
| **Sub-Workflow** | 🌺 Rose / `Workflow` | `inputs` | `outputs` | Nested DAG composition with independent scope isolation and sub-canvas navigation. |

#### Node Lifecycle Visual States
- `idle`: Slate border (`border-slate-800`), node is ready for execution.
- `queued`: Amber dashed border (`border-amber-500/50 border-dashed`), node is scheduled in the execution queue.
- `running`: Pulsing cyan glow (`border-sky-500 animate-pulse shadow-lg shadow-sky-500/20`), node is actively executing.
- `success`: Emerald solid border (`border-emerald-500/80`), node completed successfully with latency (`ms`) and token counters (`tok`) in the footer.
- `error`: Rose alert border (`border-rose-500 shadow-md shadow-rose-500/20`), execution halted with error message.


---

### 3. Canvas Interactions & Controls

- **Pan & Zoom**: Drag with left mouse button or touchpad to pan; scroll wheel to zoom (0.2x ~ 2.5x).
- **Node Selection**: Click any node to highlight it with a sky-blue ring and open its property inspector in the right drawer. Click empty canvas to deselect.
- **Edge Routing & Connection**: Click and drag from any right Handle (`source`) to a compatible left Handle (`target`) to create a directed DAG dependency.
- **Navigation Controls**:
  - `+` / `-`: Zoom in / Zoom out.
  - `[Fit View]`: Automatically frame all nodes in the center of the viewport with optimal padding.
  - `[Lock/Unlock]`: Toggle canvas panning lock.
- **MiniMap**: Live visual overview with node-type specific color coding across all 12 node types:
  - 🟢 Green = Input (`#10B981`) | 🟣 Purple = Prompt (`#8B5CF6`) | 🔵 Sky = LLM (`#3B82F6`) | 🟡 Amber = Code (`#F59E0B`)
  - 🌸 Pink = Output (`#F43F5E`) | 🪸 Cyan = Knowledge (`#06B6D4`) | 🟠 Orange = Condition (`#F97316`) | 🔮 Violet = Aggregator (`#A855F7`)
  - 🌐 Teal = HTTP (`#14B8A6`) | 🤖 Indigo = Agent (`#6366F1`) | 🔄 Blue = Loop (`#0EA5E9`) | 🌺 Rose = SubWorkflow (`#EC4899`)

---

### 4. Right Property Drawer (Inspector)

The fixed 380px inspector provides live reactive controls:

1. **Common Section**: Real-time editable Node Label and Node ID metadata.
2. **Input Parameters Editor**: Add, modify, or delete custom key-value pairs.
3. **Prompt Template Editor**:
   - Multi-line textarea for template text.
   - Real-time syntax extraction displaying detected variable slots (e.g. `{{in_1.output}}`) and default fallback values.
4. **LLM Provider Configuration**:
   - Model dropdown (`gpt-4o-mini`, `gpt-4o`, `claude-3-5-sonnet`, `deepseek-r1`, `gemini-1.5-pro`, `ollama/llama3`).
   - Temperature range slider ($0.0 \sim 2.0$ with $0.1$ step precision).
   - System Prompt textarea.
5. **Code Sandbox Editor**: Script editing with automatic syntax-safe wrapping.
6. **Output Inspector**: Scrollable formatted JSON preview and quick copy-to-clipboard button.
7. **In-Place Local Retry**: Re-run the active node directly using cached upstream parameters without re-executing previous nodes.
8. **Delete Node Button**: Safely removes the active node and cascades edge cleanup.

---

### 5. Control Header & Execution Engine

- **Preset Switcher**: Instantly switch between 3 pre-built industrial DAGs:
  1. *Customer Support Routing* (Intent classification & ticket dispatch).
  2. *Report Generator with Critic* (Self-reflective research generator with expert critique loop).
  3. *Multi-LLM Arena & Judge* (Side-by-side multi-model benchmark with neutral judge scoring).
- **Add Node Menu**: Quick dropdown to inject any of the 12 node types with hover tooltips and automatic staggered coordinates.
- **Execution Controls**:
  - `▶ Run Workflow`: Executes Kahn topological layering and consumes the asynchronous event stream (`AsyncGenerator<ExecutionEvent>`), updating node states and telemetry frame-by-frame.
  - `⏹ Stop`: Triggers W3C `AbortSignal` cooperative cancellation to instantly abort all in-flight promises and timers.
  - `↺ Reset`: Reverts all node statuses to `idle` and clears cached outputs while strictly preserving the graph topology.
  - `↺ Retry All Failed`: Appears when $\ge 2$ nodes have failed, allowing one-click concurrent/sequential recovery.
- **Live Clock**: Precision milliseconds ticker tracking total workflow execution time.

---

### 6. Canvas Ergonomics & High-Frequency Productivity (v0.4.6)

PatchCat v0.4.6 introduces a full suite of productivity tools for high-frequency canvas operations:

- **Bounded Undo / Redo History Stack (`Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z`)**:
  - Automatically captures snapshots on node creation, deletion, edge reconnection, and node drag stops.
  - Bounded to 25 history steps using deep clone snapshots to prevent memory leaks.
  - Input field guard: Safely suppressed when typing inside inputs, textareas, contentEditable fields, or Monaco editors.
- **Multi-Node Clipboard (`Ctrl+C` / `Ctrl+V`)**:
  - Box-select or multi-select nodes and press `Ctrl+C`.
  - Press `Ctrl+V` to duplicate selected nodes with new unique IDs, preserved internal edge connections, and cascading diagonal offsets (`+50px, +50px`).
- **Pinpoint Error Diagnostics & Visual Pop Focus**:
  - Click `[🔍 Locate Node]` in alert notifications to smoothly pan and zoom (`setCenter(x, y, { zoom: 1.1 })`) directly to the offending node.
  - Offending node emits a 1600ms high-visibility pulse ring (`ring-4 ring-rose-500/80 scale-103`).
  - Interactive cycle chips in deadlock alerts allow clicking any node ID in the cycle loop to locate it instantly.
- **In-Place Node Local Retry & Parallel Failure Recovery**:
  - Click `↺` on any failed or completed node card or in the Property Drawer to re-run only that node using cached upstream outputs (`node.data.outputs`).
  - Saves LLM tokens and avoids temperature drift from upstream nodes.
  - When upstream retries succeed, downstream waiting nodes (such as Aggregators) automatically unblock and resume.
- **Node-Level React Error Boundary (`NodeErrorBoundary`)**:
  - Wraps each node's body content in an isolated Error Boundary. If malformed data causes a rendering crash, only the specific card displays a fallback recovery box, preventing canvas-wide whiteouts.
- **Multi-Format Delivery Copier**:
  - Quick-copy toolbar on Output Node cards and Property Drawer: `[📋 MD]` (Markdown), `[💾 TXT]` (Plain text stripped of Markdown syntax), and `[{ } JSON]` (Raw structured data).

---

<a name="中文版本"></a>
## 中文版本

### PATCHCAT v0.4.6 — AI 提示流编排器 用户手册与组件说明指南

**AI 提示流编排器 (AI Prompt Flow Orchestrator)** 采用现代暗黑工业风（Dark Slate）设计，基于 `@xyflow/react` (React Flow v12)、Tailwind CSS、Lucide 图标库与 Zustand + Immer 打造全响应式交互。

---

### 2. 节点组件矩阵与生命周期 (内置 12 类核心节点)

| 节点类型 | 图标与主题色 | 输入端点 (左) | 输出端点 (右) | 专属功能与预览特性 |
| :--- | :--- | :--- | :--- | :--- |
| **Input (输入节点)** | 🟢 翡翠绿 / `PlayCircle` | *无* | `output` | 动态参数字典预览（Key-Value 列表），支持随时追加自定义字段与默认值。 |
| **Prompt (提示词节点)** | 🟣 紫罗兰 / `FileText` | `inputs` | `promptText` | 多行模板片段预览，自动对 `{{nodeId.outputKey}}` 插槽赋予紫色徽章高亮。 |
| **LLM (大模型节点)** | 🔵 天空蓝 / `Bot` | `prompt` | `response` | 模型名称徽章（Gemini / DeepSeek / OpenAI / Ollama 等）、实时流式吐字与思考链折叠展示。 |
| **Code (代码节点)** | 🟡 琥珀黄 / `Code2` | `inputs` | `result` | 等宽代码块预览，支持轻量级 JS 沙箱安全数据清洗脚本与超时控制。 |
| **Output (输出节点)** | 🌸 樱花粉 / `CheckCircle2` | `final` | *无* | 结构化最终产物展示框，支持 Markdown 实时渲染与一键剪贴板复制。 |
| **Condition (条件分支)** | 🟠 珊瑚橙 / `GitFork` | `input` | `true` / `false` | 支持 If/Else 规则表达式比较，自动进行下游无效拓扑分支死路剪枝。 |
| **Aggregator (变量聚合)**| 🔷 荧光青 / `GitMerge` | `branch_a`, `branch_b` | `merged` | 多分支汇聚合并节点，等待并行或条件路径就绪并执行降级合并。 |
| **HTTP (外部接口请求)** | 🌐 靛青蓝 / `Globe` | `inputs` | `response` | 标准 REST API 调用（GET/POST/PUT/DELETE），支持自定义 Header、Query 与 JSON Payload。 |
| **Knowledge (知识库RAG)**| 🪸 蓝绿色 / `Database` | `query` | `chunks` | 本地与服务端双模向量检索，支持 Cosine 余弦相似度打分与 Top-K 切片召回。 |
| **Agent (智能体 ReAct)** | 🔮 幻彩紫 / `Sparkles` | `goal` | `result` | 自主目标规划 ReAct 循环，搭载死锁打破器、看门狗超时监控与动态工具集调用。 |
| **Loop (循环控制)** | 🔄 科技蓝 / `Repeat` | `items` | `aggregated` | 数组批处理迭代或条件轮询，内置最大迭代安全边界保护。 |
| **Sub-Workflow (子工作流)**| 🌺 蔷薇红 / `Workflow` | `inputs` | `outputs` | 独立拓扑子画布嵌套与作用域隔离，支持复杂巨型工作流模块化解耦。 |

#### 节点生命周期状态视觉流转
- `idle (就绪)`：板岩灰边框，节点待命中。
- `queued (排队)`：琥珀黄虚线边框，已纳入拓扑调度队列。
- `running (执行中)`：天空蓝发光呼吸动效（`animate-pulse`），正在发起模型调用或计算。
- `success (成功)`：翡翠绿常亮边框，底部脚标附带执行耗时（`ms`）与 Token 消耗统计。
- `error (异常)`：玫瑰红警示边框，附带错误详细信息。


---

### 3. 画布交互与操作

- **平移与缩放**：按住鼠标左键或触控板拖拽画布平移；鼠标滚轮缩放画布（0.2x ~ 2.5x）。
- **节点选中联动**：点击任意节点触发高亮光圈，并在右侧滑出该节点的属性配置抽屉；点击空白处关闭抽屉。
- **连线与依赖构建**：从节点右侧输出端点（`source`）拖拽连线至目标节点的左侧输入端点（`target`）。
- **全景小地图 (MiniMap)**：右下角提供按节点类型专属配色的微缩全局视图。

---

### 4. 右侧属性配置抽屉

- **基础信息**：修改节点展示名称（Label）与 ID 识别。
- **Input 参数编辑**：支持动态追加、编辑与删除键值对。
- **Prompt 模板编辑**：支持多行编写，实时词法分析并列出捕获到的变量依赖与 Fallback 默认值。
- **LLM 模型配置**：支持切换 GPT-4o-mini、Claude 3.5 Sonnet、DeepSeek-R1 等模型，支持 0.0 ~ 2.0 精度滑块调节 Temperature 与 System Prompt 设置。
- **Code 脚本编辑**：提供安全沙箱代码输入区。
- **一键删除**：支持安全移除节点并自动级联清理关联连线。

---

### 5. 顶部控制栏与执行流

1. **场景预设一键加载**：
   - 智能客服意图识别与工单派发 (`customer-support-routing`)
   - 自反思研报生成与专家 Review 闭环 (`report-generation-critic`)
   - 多模型横向盲测与裁判打分 Arena (`model-arena-eval`)
2. **执行控制**：
   - `▶ Run Workflow`：触发 Kahn 拓扑排序并逐帧流式驱动节点光效与数据填充。
   - `⏹ Stop`：触发 AbortSignal 秒级强行终止等待中的任务。
   - `↺ Reset`：一键重置节点状态为 `idle`。
   - `↺ 重试所有失败节点`：当检测到存在 $\ge 2$ 个错误节点时自动浮现，支持一键批量就地并发重试。

---

### 6. 画布工效学与高频生产力交互 (v0.4.6)

PatchCat v0.4.6 为高频画布搭建场景引入了完备的工效学与生产力工具体系：

- **撤销与重做历史管理器 (`Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z`)**：
  - 自动记录节点增删、连线增删、连线拖拽构建与节点拖拽位移（`onNodeDragStop`）；
  - 队列深度严格限制 25 步上限并基于深拷贝快照，彻底阻断内存无限泄露风险；
  - 表单输入防护：在 input、textarea、contentEditable 或 Monaco 代码编辑器中输入时自动屏蔽画布快捷键，杜绝打字被误判为撤销。
- **多节点框选复制与粘贴 (`Ctrl+C` / `Ctrl+V`)**：
  - 框选或多选节点并按 `Ctrl+C`；
  - 按 `Ctrl+V` 粘贴时自动生成全新唯一 UUID，并智能保留选中节点之间的内部连线（Internal Edges），滤除与未选中外部节点的连线；
  - 粘贴卡片自动呈对角线级联递增偏移（`+50px, +50px`），多次粘贴不叠放遮挡。
- **节点精准报错诊断与视口一键定焦 (Pinpoint Diagnostics & Visual Pop Focus)**：
  - 顶部报错通知条直出 `[🔍 定位节点 (nodeId)]` 按钮；拓扑环路死锁警告中的循环节点 Chip 亦支持一键点击定焦；
  - 视口平滑居中飞渡（`setCenter` 居中并缩放至 1.1x），并在目标节点卡片触发 1600ms 高亮呼吸光环动效（`ring-4 ring-rose-500/80 scale-103`）。
- **单节点就地重试与并行故障恢复**：
  - 点击节点卡片右上角或属性抽屉底部的 `↺` 按钮即可就地重跑该节点，直接复用父节点已缓存的入参输出数据（`node.data.outputs`），无需全盘重跑整条工作流，杜绝昂贵前序 Token 浪费与温度采样发散；
  - 并行分支多节点报错时相互隔离；当失败节点 $\ge 2$ 时，顶部控制栏显性显示 `[ {count} 个节点执行失败 | ↺ 重试所有失败节点 ]`；
  - 重试成功后，汇聚节点与下游等待节点自动解除等待继续向后执行。
- **节点级渲染异常隔离保护 (`NodeErrorBoundary`)**：
  - 封装独立 React Error Boundary 包裹自定义节点内容，单节点因数据脏污导致 React 崩溃时仅在卡片内部显示局部降级重置卡片，彻底避免整画布白屏（Whiteout）。
- **多格式一键交付复制栏**：
  - Output 节点卡片与属性抽屉输出区提供快速复制工具栏：`[📋 MD]`（Markdown）、`[💾 TXT]`（纯文本自动剥离标签）、`[{ } JSON]`（原始数据结构）。

---

### 7. 本地运行与验证指令

```bash
# 1. 启动前端 Vite 本地可视化开发服务器 (http://localhost:5173)
npm run dev

# 2. 运行 223+ 项前端单元与工程基准测试 (涵盖拓扑调度、Agent安全看门狗、死锁检测、配置备份迁移)
npm test

# 3. 运行严格静态类型检查 (零 any 校验)
npm run typecheck

# 4. 执行生产环境打包构建 (生成 dist/ 静态产物)
npm run build

# 5. (可选) 启动 Python FastAPI 后端服务并运行 21 项后端集成测试
uvicorn server.main:app --reload --port 8000
pytest server/tests/
```

