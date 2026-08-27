---
title: "System Architecture Specification"
version: "1.0.0"
status: "Draft"
author: "AI Orchestrator Architecture Team"
created: "2026-08-28"
updated: "2026-08-28"
---

# System Architecture Specification / 系统总体架构与数据流设计

[English Version](#english-version) | [中文版本](#中文版本)

---

<a name="english-version"></a>
## English Version

### 1. Architectural Goals & Core Principles
AI Prompt Flow Orchestrator decouples visual presentation, graph scheduling, and the underlying execution runtime. Key design principles:
1. **Separation of Concerns**: Canvas UI handles rendering & interaction; independent engines handle graph computation.
2. **Isomorphic Execution**: Graph schema and execution events are 100% isomorphic across browser and server runtimes.
3. **Streaming First**: Full-pipeline support for token-level streaming and real-time event distribution.

### 2. Layered Architecture

```mermaid
flowchart TB
    subgraph UI_Layer["1. UI / Canvas Layer"]
        CanvasView["React Flow Canvas (@xyflow/react)"]
        NodeComponents["Custom Node Renderers (Input, Prompt, LLM, Code, Output)"]
        SidePanels["Property Config Panels / Logs Drawer"]
        ControlToolbar["Run Controls / Preset Selector"]
    end

    subgraph State_Layer["2. State & Orchestration Layer"]
        ZustandStore["Zustand Global Store (Canvas / Execution / History Slices)"]
        DAGScheduler["DAG Topology Engine (Kahn's Sort & Cycle Check)"]
        VarResolver["Variable Resolver ({{node.output}} Engine)"]
    end

    subgraph Adapter_Layer["3. Engine Adapter Layer"]
        AdapterInterface["IWorkflowEngineAdapter Interface"]
        BrowserAdapter["BrowserEngineAdapter (Web Worker / BYOK / Mock)"]
        ServerAdapter["ServerEngineAdapter (FastAPI SSE Client)"]
    end

    subgraph Execution_Layer["4. Execution Runtime Layer"]
        subgraph Client_Runtime["Client-Only Mode"]
            BrowserFetch["Browser Fetch API (OpenAI/Anthropic/Gemini)"]
            JSWorker["Web Worker JS Sandbox"]
        end
        subgraph Server_Runtime["Local-Server Mode (FastAPI)"]
            FastAPIServer["FastAPI ASGI Server"]
            PythonSandbox["Python Execution Sandbox"]
            LocalLLM["Ollama / vLLM Local Bridge"]
        end
    end

    UI_Layer --> State_Layer
    State_Layer --> Adapter_Layer
    AdapterInterface --> BrowserAdapter
    AdapterInterface --> ServerAdapter
    BrowserAdapter --> Client_Runtime
    ServerAdapter --> Server_Runtime
```

### 3. Data & Event Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant UI as Canvas UI
    participant Store as Zustand Store
    participant Engine as DAG Engine
    participant LLM as LLM / Sandbox

    User->>UI: Click "Run Workflow"
    UI->>Store: dispatch(startExecution)
    Store->>Engine: execute(graphSchema, inputs)
    Engine->>Engine: Topological Sort & Layer Batching
    loop Process Layers in Parallel Waves
        Engine->>Store: emit(NODE_START, nodeId)
        Engine->>LLM: Call Model / Sandbox
        loop Token Stream
            LLM-->>Engine: Stream Chunk
            Engine-->>Store: emit(NODE_CHUNK, delta)
            Store-->>UI: Realtime UI update
        end
        LLM-->>Engine: Complete Response
        Engine->>Store: emit(NODE_COMPLETE, output)
    end
    Engine->>Store: emit(WORKFLOW_COMPLETE)
    Store->>UI: Render Final Output
```

---

<a name="中文版本"></a>
## 中文版本

### 1. 架构目标与核心原则
系统遵循关注点分离、环境同构（Isomorphic Execution）与流式优先（Streaming First）原则，解耦画布表现层与计算执行层。

### 2. 总体分层架构
分为 4 大层级：可视化表现层 (UI Layer)、状态与编排层 (State Layer)、引擎适配抽象层 (Adapter Layer) 以及底层执行运行时 (Execution Runtime)。

### 3. 核心数据与事件流
用户触发执行后，Zustand 分发图数据至调度引擎，按 Kahn 分层批次并发调用模型并实时回传 Token 流事件。
