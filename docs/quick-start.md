# 🚀 PatchCat Quick Start Guide

Welcome to **PatchCat**! In this guide, you will learn how to orchestrate your first multi-node AI workflow in **under 5 minutes**—from connecting an LLM provider to building, running, and inspecting an automated AI ticket routing pipeline.

---

<div align="center">
  <p>
    <strong><a href="quick-start.md">English</a></strong> | <strong><a href="quick-start-zh.md">简体中文</a></strong>
  </p>
</div>

---

## 📋 What You Will Learn

By the end of this quickstart tutorial, you will know how to:
1. **Launch PatchCat** in your local browser environment.
2. **Connect an LLM provider** (Google Gemini, DeepSeek, OpenAI, or local Ollama) using your own API Key (BYOK).
3. **Execute a pre-built industrial workflow** (Customer Support Intent Classification & VIP Logistics Routing).
4. **Inspect real-time token streams, DeepSeek reasoning chains, and 3-tier security execution logs**.
5. **Build and customize your own visual DAG workflow** from scratch.

---

## 🛠️ Prerequisites

Before you start, make sure you have:
- [Node.js](https://nodejs.org/) `>= 18.0.0`
- [npm](https://www.npmjs.com/) `>= 9.0.0` or [pnpm](https://pnpm.io/)
- A modern browser (Chrome, Edge, Firefox, Safari)
- An API Key from any supported provider:
  - 🔵 **Google Gemini** (Free tier available at [Google AI Studio](https://aistudio.google.com/app/apikey)) — *Recommended*
  - 🐳 **DeepSeek** ([DeepSeek Platform](https://platform.deepseek.com/api_keys))
  - 🟢 **OpenAI** ([OpenAI Platform](https://platform.openai.com/api-keys))
  - ⚡ **SiliconFlow** ([SiliconFlow Cloud](https://cloud.siliconflow.cn/))
  - 🦙 **Ollama** (Locally installed and running at `http://localhost:11434`)

---

## 📦 Step 1: Launch PatchCat

### 1. Clone the repository
```bash
git clone https://github.com/GuoBug/PatchCat.git
cd PatchCat
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the development server
```bash
npm run dev
```
Open your browser and navigate to **`http://localhost:5173`**. You will see the PatchCat Visual Workflow Canvas.

---

## 🔑 Step 2: Configure Your Model Provider (BYOK)

PatchCat operates with a **100% Client-Only Privacy Architecture**: your API Keys are stored exclusively in your browser's `LocalStorage` and connect directly to model providers. They are **never** transmitted to any intermediary backend.

```
       ┌────────────────────────┐
       │   Browser LocalStorage │ (Encrypted in browser session)
       └───────────┬────────────┘
                   │ Direct HTTPS Call (No middleman)
                   ▼
       ┌────────────────────────────────────────────────────────┐
       │  Google Gemini / DeepSeek / OpenAI / Ollama Endpoints   │
       └────────────────────────────────────────────────────────┘
```

1. In the top navigation bar, click the **`API Key`** button (or the key icon).
2. Select your preferred provider from the left sidebar (e.g., **Google Gemini**).
3. Paste your API Key into the input field.
4. Click **`测试连通性 (Test Connection)`**:
   - PatchCat automatically tests the endpoint and fetches all available chat models (e.g., `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`).
5. Close the Settings modal. Your provider is now active and marked with a green indicator in the header!

> [!TIP]
> **Recommended Model**: For Google Gemini, we recommend **`gemini-2.5-flash`** for instant response speeds and high availability on the free tier.

---

## 🎯 Step 3: Run Your First Workflow

PatchCat automatically loads the **`Customer Support Routing (智能客服工单路由)`** preset on initial launch.

### Understanding the Pipeline Topology
The workflow consists of 5 connected nodes:

```
┌────────────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
│    用户工单入参        │ ────> │   意图分析提示词       │ ────> │   意图识别大模型       │
│ (input_user_query)     │       │ (prompt_classification)│       │ (llm_classifier)       │
│ - user_message         │       │ - {{input.user_message}}│      │ - gemini-2.5-flash     │
│ - user_tier: VIP2      │       │ - JSON Schema template │       │ - Temperature: 0.2     │
└────────────────────────┘       └────────────────────────┘       └───────────┬────────────┘
                                                                              │
                                                                              ▼
┌────────────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
│   最终工单路由分派     │ <──── │   输出适配与渲染       │ <──── │   路由决策脚本沙箱     │
│ (output_dispatch)      │       │ (output_renderer)      │       │ (code_router_logic)    │
│ - Target: Logistics VIP│       │ - dispatch_result      │       │ - JS Rule Engine       │
│ - SLA: 15-min Urgent   │       │ - renderedAt Timestamp │       │ - Auto JSON parsing    │
└────────────────────────┘       └────────────────────────┘       └────────────────────────┘
```

### Executing the Workflow
1. Click the blue **`▶ Run Workflow`** button in the top right corner.
2. Watch the execution in real time:
   - Nodes transition from `idle` ➔ `running` (with live spinner) ➔ `success` (with latency badge).
   - The LLM node streams generated tokens live on the canvas.
   - The JavaScript Code node extracts the intent (`物流催单`), evaluates urgency (`4分`), and routes the ticket to the **`🚀 物流专线极速客服队列 (Logistics VIP)`**.
3. Click on any node to open the **Right Property Inspector Panel** and inspect its input parameters, prompt template, or formatted JSON output.

---

## 🔍 Step 4: Inspect Telemetry & 3-Tier Security Logs

PatchCat includes an enterprise-grade execution logging engine and bottom console drawer.

1. Click the **`日志 (Logs)`** button in the top navigation bar to open the **Log Console Drawer**.
2. Switch between the **3 Configurable Log Levels**:
   - **`概要 (Summary)`**: Macro workflow lifecycle, HTTP status codes, latency, and system alerts.
   - **`详细 (Detailed)`**: Node IDs, runtime parameters (`model`, `temperature`, `max_tokens`), and DAG layer wave scheduling.
   - **`开发 (Development)`**: Full Prompt inputs, variable resolution payloads, and LLM generated responses.
3. **Strict Zero-Leakage Guarantee**: Notice that even in `Development` mode, all API keys (`sk-***`, `AIzaSy***`), Bearer tokens, and passwords are automatically masked with `***[MASKED]***`.
4. **Tools in the Console**:
   - **Filter by Type**: `All`, `System`, `Request`, `Node`, `Error`.
   - **Search**: Filter logs in real time by keywords or Node IDs.
   - **Expand Payload**: Click `详情 Payload` to inspect formatted JSON trees and copy with one click.
   - **Export**: Click `导出` to download logs as `.json` or `.txt` reports.

---

## 🎨 Step 5: Build a Custom Workflow from Scratch

Ready to create your own pipeline? Follow these simple steps:

### 1. Add Nodes
Click the **`+ Add Node`** dropdown in the top header and add any of the standard nodes:
- **`Input`**: Define custom input variables and types (`string`, `number`, `boolean`, `json`).
- **`Prompt`**: Write prompt templates with dynamic variable slots using `{{nodeId.property}}`.
- **`LLM`**: Select models (Gemini, DeepSeek, OpenAI), configure temperature, and set system prompts.
- **`Code`**: Write custom JavaScript transformation scripts with `inputs` and `console.log` capture.
- **`Output`**: Format and present final workflow outputs.

### 2. Connect Edges
Click and drag from a source node's right handle (output port) to a target node's left handle (input port).

### 3. Dynamic Variable Resolution Syntax
PatchCat supports powerful Mustache-style variable interpolation:
```handlebars
// Simple variable reference
{{input_node.user_query}}

// Nested property and array access
{{llm_node.response.items[0].name}}

// Safe fallback default value (prevents runtime failure if empty)
{{input_node.optional_vip_tag | "STANDARD_USER"}}
```

### 4. Topology Validation & Safety
PatchCat's engine utilizes **Kahn's Topological Algorithm**:
- **Automatic Parallel Waves**: Nodes on the same dependency layer execute concurrently via `Promise.all`.
- **Cycle Detection**: If you accidentally connect a cyclic loop ($A \to B \to A$), PatchCat detects the cycle in milliseconds, highlights the affected nodes in red, and presents an alert banner to prevent infinite loops.

---

## ❓ Troubleshooting & FAQs

### Q1: I encounter `HTTP 503 (Model Overloaded)` with Google Gemini.
**Cause**: Google's free tier on preview or experimental models (e.g., `gemini-3.7-flash`) occasionally experiences global traffic spikes.  
**Solution**: Click the LLM node, open the Property Panel, and switch the model dropdown to **`gemini-2.5-flash`** or **`gemini-2.0-flash`**, which offer stable high throughput. PatchCat also includes a built-in 1.5s automatic retry mechanism.

### Q2: How does cross-vendor model compatibility work?
If a preset workflow was created with `gpt-4o-mini`, but your active provider is **Google Gemini**, PatchCat's `resolveTargetModel` engine automatically remaps the request to **`gemini-2.5-flash`**, eliminating cross-vendor 400/404 errors.

### Q3: How do I run unit tests?
PatchCat features 100% automated test coverage across DAG sorting, variable resolving, LLM client streaming, and logger sanitization:
```bash
npm test
```

---

## 📚 Next Steps

- 📖 Explore the [System Architecture Documentation](02-architecture/system-architecture.md)
- 📐 Review the [Graph Schema Specification](02-architecture/graph-schema-specification.json)
- 💡 Check out the [Development Notes & ADRs](04-dev-notes/adr-001-canvas-engine-selection.md)
- ⭐️ Star and contribute to [PatchCat on GitHub](https://github.com/GuoBug/PatchCat)
