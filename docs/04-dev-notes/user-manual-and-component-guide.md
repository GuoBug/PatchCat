---
title: "Visual Canvas & Component User Manual"
version: "1.0.0"
status: "Active"
author: "AI Orchestrator Product & Engineering Team"
created: "2026-08-28"
updated: "2026-08-28"
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
│  [Logo] AI Prompt Flow v2.0  |  Nodes: 4  Edges: 3  [+ Add Node]  |  Preset: [Dropdown] │ [Time: 120ms] [↺] [▶ Run] │
├───────────────────────────────────────────────────────────────────┬────────────────────┤
│                                                                   │                    │
│   [Input Node] ────▶ [Prompt Node] ────▶ [LLM Node] ────▶ [Output] │   Property Panel   │
│                                                                   │   (Inspector)      │
│   • Background Grid Dots (gap 18px)                               │   • Node Labels    │
│   • Zoom / Pan Controls                                           │   • Template Form  │
│   • Multi-color MiniMap                                           │   • Model Configs  │
│                                                                   │   • Output Copier  │
└───────────────────────────────────────────────────────────────────┴────────────────────┘
```

---

### 2. Node Components Matrix

Every node is rendered as a responsive, hardware-accelerated SVG/DOM card with dynamic border states and telemetry badges:

| Node Type | Icon & Theme | Input Port (Left) | Output Port (Right) | Dedicated Features & Preview |
| :--- | :--- | :--- | :--- | :--- |
| **Input Node** | 🟢 Emerald / `PlayCircle` | *None* | `output` | Live parameter list (key-value dictionary preview), customizable default values. |
| **Prompt Node** | 🟣 Purple / `FileText` | `inputs` | `promptText` | Template text preview with automatic detection and purple badge highlighting for `{{nodeId.outputKey}}` slots. |
| **LLM Node** | 🔵 Sky / `Bot` | `prompt` | `response` | Model provider tag (GPT-4o, Claude 3.5, DeepSeek-R1), temperature badge ($T: 0.7$), and real-time streaming response box. |
| **Code Node** | 🟡 Amber / `Code2` | `inputs` | `result` | Monospace code block preview supporting lightweight JS / Python transformation sandbox scripts. |
| **Output Node** | 🌸 Pink / `CheckCircle2` | `final` | *None* | Formatted multi-line output display with one-click JSON / text clipboard copy button. |

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
- **MiniMap**: Live visual overview with node-type specific color coding:
  - 🟢 Green = Input | 🟣 Purple = Prompt | 🔵 Blue = LLM | 🟡 Amber = Code | 🌸 Pink = Output

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
7. **Delete Node Button**: Safely removes the active node and cascades edge cleanup.

---

### 5. Control Header & Execution Engine

- **Preset Switcher**: Instantly switch between 3 pre-built industrial DAGs:
  1. *Customer Support Routing* (Intent classification & ticket dispatch).
  2. *Report Generator with Critic* (Self-reflective research generator with expert critique loop).
  3. *Multi-LLM Arena & Judge* (Side-by-side multi-model benchmark with neutral judge scoring).
- **Add Node Menu**: Quick dropdown to inject new `Input`, `Prompt`, `LLM`, `Code`, or `Output` nodes with automatic staggered coordinates.
- **Execution Controls**:
  - `▶ Run Workflow`: Executes Kahn topological layering and consumes the asynchronous event stream (`AsyncGenerator<ExecutionEvent>`), updating node states and telemetry frame-by-frame.
  - `⏹ Stop`: Triggers W3C `AbortSignal` cooperative cancellation to instantly abort all in-flight promises and timers.
  - `↺ Reset`: Reverts all node statuses to `idle` and clears cached outputs while strictly preserving the graph topology.
- **Live Clock**: Precision milliseconds ticker tracking total workflow execution time.

---

<a name="中文版本"></a>
## 中文版本

### PATCHCAT v0.1 — AI 提示流编排器 用户手册与组件说明指南

**AI 提示流编排器 (AI Prompt Flow Orchestrator)** 采用现代暗黑工业风（Dark Slate）设计，基于 `@xyflow/react` (React Flow v12)、Tailwind CSS、Lucide 图标库与 Zustand + Immer 打造全响应式交互。

---

### 2. 节点组件矩阵与生命周期

| 节点类型 | 图标与主题色 | 输入端点 (左) | 输出端点 (右) | 专属功能与预览特性 |
| :--- | :--- | :--- | :--- | :--- |
| **Input (输入节点)** | 🟢 翡翠绿 / `PlayCircle` | *无* | `output` | 动态参数字典预览（Key-Value 列表），支持随时追加自定义字段。 |
| **Prompt (提示词节点)** | 🟣 紫罗兰 / `FileText` | `inputs` | `promptText` | 多行模板片段预览，自动对 `{{nodeId.outputKey}}` 插槽赋予紫色徽章高亮。 |
| **LLM (大模型节点)** | 🔵 天空蓝 / `Bot` | `prompt` | `response` | 模型名称徽章（GPT-4o / DeepSeek-R1 等）、温度标签 ($T: 0.7$) 与响应文本预览。 |
| **Code (代码节点)** | 🟡 琥珀黄 / `Code2` | `inputs` | `result` | 等宽代码块预览，支持轻量级 JS / Python 数据清洗脚本。 |
| **Output (输出节点)** | 🌸 樱花粉 / `CheckCircle2` | `final` | *无* | 结构化最终产物展示框，支持 Markdown 渲染与一键剪贴板复制。 |

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

---

### 6. 本地运行与验证指令

```bash
# 1. 启动前端 Vite 本地可视化开发服务器 (http://localhost:5173)
npm run dev

# 2. 运行 18 项全量单元与工程基准测试 (全部秒级通过)
npm test

# 3. 运行严格静态类型检查 (零 any 校验)
npm run typecheck

# 4. 执行生产环境打包构建 (生成 dist/ 静态产物)
npm run build
```
