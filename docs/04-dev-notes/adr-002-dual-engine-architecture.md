---
title: "ADR-002: Dual-Engine Architecture (Browser vs Server)"
version: "1.0.0"
status: "Accepted"
author: "AI Orchestrator Architecture Team"
created: "2026-08-28"
updated: "2026-08-28"
---

# ADR-002: Dual-Engine Architecture / 纯前端与本地后端双模架构决策

[English Version](#english-version) | [中文版本](#中文版本)

---

<a name="english-version"></a>
## English Version

### 1. Context & Problem Statement
Existing AI workflow platforms (e.g. Dify, Flowise, Langflow) typically require heavy backend infrastructure (Docker, Redis, PostgreSQL, Celery, Python runtime), creating high friction for quick trial and lightweight static demonstrations.

Conversely, purely browser-based solutions cannot safely execute Python scripts or bridge to local private LLM endpoints lacking CORS headers.

We need a design that provides **zero-setup static web preview** while retaining **full enterprise-grade local execution capabilities**.

### 2. Decision & Architecture
We adopt a **Unified Graph Schema with Dual-Engine Transparent Adapters**:
1. **Client-Only Mode**: Hosted statically on GitHub Pages with Mock fixtures and BYOK direct API calling.
2. **Local-Server Mode**: High-performance FastAPI server with Python sandboxes and Ollama bridges.

```mermaid
graph TD
    Client[Web UI / Zustand Store] --> Adapter[IWorkflowEngineAdapter Interface]
    Adapter -->|Local backend offline| BrowserEngine[BrowserEngineAdapter (Mock / Web Worker / BYOK)]
    Adapter -->|localhost:8000 online| ServerEngine[ServerEngineAdapter (FastAPI SSE Pipeline)]
```

### 3. Key Benefits
- **Zero-Friction Adoption**: Users can try complex workflows in seconds via GitHub Pages.
- **Progressive Upgrade Path**: Users start FastAPI whenever Python sandboxing or local Ollama models are needed.

---

<a name="中文版本"></a>
## 中文版本

### 1. 背景与问题陈述
传统 AI 编排系统依赖繁重后端，导致上手门槛高；而纯前端方案又受限于沙箱与私有模型访问。

### 2. 方案权衡与决策
采用“同一份图契约，双引擎透明适配 (Dual-Engine Architecture)”：
- 默认 Client-Only 模式静态部署于 GitHub Pages，支持 Mock 与 BYOK。
- Local-Server 模式提供本地 Python 沙箱与 Ollama 大模型接入。
- 前端自动嗅探本地服务，实现无缝平滑切换。
