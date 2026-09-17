# Changelog

All notable changes to the **PatchCat** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.4.6] - 2026-09-17

### Added
- **Canvas Ergonomics & Bounded History Management (`HistoryManager`, `workflow-store.ts`)**:
  - Implemented 25-step bounded Undo / Redo history ring buffer (`Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`) with deep cloning and action deduplication.
  - Automatic suppression of undo/redo capture during active form input editing to prevent keyboard collision.
- **Multi-Node Clipboard & Subgraph Duplication (`workflow-store.ts`)**:
  - Clipboard copy/paste (`Ctrl+C`, `Ctrl+V`) supporting single and multiple node selections.
  - Subgraph preservation: internal connecting edges between copied nodes are duplicated and remapped to new node IDs with a cascading `(+50px, +50px)` positional offset.
- **Pinpoint Error Focus & Canvas Visual Pop (`WorkflowCanvas.tsx`, `ControlHeader.tsx`)**:
  - Auto-scrolling and smooth viewport centering (`zoom: 1.1x`) to the first failed node upon execution failure.
  - CSS keyframe pulse highlight ring (`node-error-pulse`) drawing immediate user attention to error origins.
  - Clickable cycle node badges in DAG error alerts for instantaneous canvas navigation to offending nodes.
- **In-Place Node Local Retry & Parallel Failure Recovery (`browser-engine.ts`, `workflow-store.ts`)**:
  - Isolated single-node execution (`executeSingleNode`) directly from node property panel without restarting the entire workflow.
  - Upstream dependency resolution and context synthesis for accurate isolated re-runs.
  - Smart global retry (`resumeFromExisting`) to rerun only failed nodes while preserving outputs of successfully executed upstream nodes.
- **Node-Level React Error Boundary (`NodeErrorBoundary.tsx`)**:
  - Isolated component crash protection wrapping every canvas node, rendering a compact recovery fallback badge and preventing canvas whiteout.
- **Universal Bilingual Node Tooltip System (`BaseNode.tsx`, `translations.ts`)**:
  - High-precision 1-2 sentence hover tooltips across all 12 canvas node types in English and Simplified Chinese, explaining function, inputs, and outputs.
- **Multi-Format Delivery Copier (`OutputNode.tsx`)**:
  - Quick export buttons on Output nodes for 1-click clipboard copying in Markdown (`📋 MD`), Plain Text (`💾 TXT`), and Structured JSON (`{ } JSON`).
- **Targeted UX & Ergonomic Refinements**:
  - **Quick Add Palette Outside Click Dismissal**: Integrated capture-phase pointerdown listener and Escape key dismiss in `ControlHeader.tsx`, bypassing canvas pane event stopping.
  - **Precise Numerical Inputs in Settings**: Replaced imprecise range sliders with direct numerical input boxes (`<input type="number">`) for auto-save debounce, watchdog timeout, sandbox timeout, and agent max iterations.
  - **Property Drawer Live Error Inspection**: Error banners with detailed error trace and `[复制报错]` (Copy Error) button now display directly in `ExecutionResultViewer.tsx`.
  - **HTTP Query Parameters Normalization**: Added support for both key-value records and `[{key, value}]` arrays in HTTP nodes, eliminating `[object Object]` formatting distortion.
  - **Permanent Node & Drawer Model Synchronization**: Fixed desync between canvas node model tags and property panel model select dropdowns across LLM and Agent nodes, auto-injecting configured models into options and inheriting active provider defaults on creation.
- **Comprehensive Ergonomics Automated Test Suite**:
  - Added `tests/canvas-ergonomics.node.test.ts` (14 new tests covering history stack, form suppression, clipboard subgraph duplication, and in-place retry), bringing total tests to 229 passing 100%.

## [0.4.4] - 2026-09-16

### Added
- **Centralized Runtime Defaults (`src/config/runtime-defaults.ts`)**:
  - Eliminated magic numbers across the entire platform, consolidating auto-save debounce, sandbox timeouts, tool watchdogs, LLM retries, and deadlock thresholds into a single source of truth.
- **Hardened ReAct Agent Runtime Protection (`src/engine/browser-engine.ts`)**:
  - **Token Budget Limiter (`maxTokenBudget`)**: Hard ceiling for token consumption per agent node (`0` = unlimited), auto-interrupting the loop when exceeded.
  - **Tool Deadlock Breaker (`loopDetectionEnabled`)**: Detects repeated identical tool calls, injecting corrective hints at 2 calls and tripping a hard circuit breaker at 3 calls.
  - **Tool Execution Timeout Watchdog**: Configurable tool execution timeout linked to Global Settings, equipping `builtin_http` with `AbortSignal.timeout`.
  - **Tool Error Observation Feedback**: Unified try/catch returning structured observations allowing LLM self-correction.
  - **Sub-Workflow Variable Scope Isolation**: Context cloned with `structuredClone` to prevent parent graph variable pollution.
- **Global Settings 5-Tab Architecture (`SettingsPage.tsx`)**:
  - Reorganized into 5 dedicated tabs: General & Backup, Execution & Safety, Model Providers & Network, Conversation Memory, and Execution Logs.
  - Added user-facing controls for Auto-save debounce slider, tool timeout watchdog toggle & duration, code sandbox timeout slider, agent deadlock detection, and network retry/delay sliders.
- **Configuration Backup & Migration (Export / Import)**:
  - Added sanitized export (strips API keys for safe public sharing) and full export (includes credentials for device migration).
  - Schema-validated configuration import with instant store hydration and `localStorage` synchronization.
- **Single-Language Danger Zone Confirmations (`DangerConfirmModal.tsx`)**:
  - Strictly requires language-specific confirmation phrases (`清空缓存` / `删除所有工作流` for Chinese, `CLEAR CACHE` / `DELETE ALL WORKFLOWS` for English).
- **Official Configuration Reference Documentation**:
  - Added `docs/05-configuration/README.md` and `docs/05-configuration/runtime-parameters-reference.md`.
- **Automated Test Expansion**:
  - Added `tests/agent-runtime-guard.node.test.ts` (12 new tests), expanding test suite to 223 frontend unit/contract tests passing 100%.

## [0.4.2] - 2026-09-13

### Added
- **AI Agent Capabilities & ReAct Autonomous Loop (`PRD-011`)**:
  - **Native Agent Node (`AgentNode.tsx`, `browser-engine.ts`)**: Built-in ReAct (Reason + Act) autonomous execution loop allowing LLMs to alternate between reasoning and invoking tools up to `maxIterations` with cycle protection.
  - **Universal Tool Calling Client (`llm-client.ts`)**: Extended OpenAI/Gemini/DeepSeek chat completion requests to declare `tools` JSON Schema, streaming and accumulating `delta.tool_calls` over Server-Sent Events (SSE).
  - **Multi-Type Tool Execution Router**: Built-in routing for sandboxed JavaScript execution (`builtin_code`), external HTTP REST endpoints (`builtin_http`), canvas node invocation (`canvas_node`), and declarative custom tool schemas (`custom_schema`).
  - **Batch Loop Iterator Node (`LoopNode.tsx`)**: Sequential & concurrent iteration node executing child mappings over dynamic array variables with robust fallback for non-array inputs.
  - **Sub-Workflow Composite Node (`SubWorkflowNode.tsx`)**: Reusable workflow nesting primitive referencing existing project workflows.
  - **Interactive Agent Property Panel (`PropertyPanel.tsx`)**: Full configuration interface for System Prompt, collapsible Registered Tool list editor, max iterations slider, and temperature tuning.
  - **Bilingual Autonomous Agent Official Preset**: Added "Autonomous Agent with Tool Calling" (`agent-tool-calling`) in English and Chinese, combining exchange rate lookups with precision code calculations.
  - **Comprehensive Automated Test Expansion**: Added `tests/agent-node.node.test.ts` (16 new tests), expanding the test suite to 195 automated tests passing with 100% green rate.

## [0.4.0] - 2026-09-11

### Added
- **Project-Level Conversation Memory Settings (`WorkflowSidebar.tsx`, `project-store.ts`)**:
  - Replaced global runtime parameters in the project settings modal with dedicated project-level memory limit parameters (`maxHistoryRounds` and `maxTokenBudget`).
  - Stored `memoryConfig` per `SavedWorkflow`, allowing fine-grained context window pruning policies per workflow.
  - Connected `ChatDebugPanel` execution to resolve effective memory constraints hierarchically (workflow-level override -> global fallback).
- **Dedicated Presets Directory & Unified Folder Architecture**:
  - Reorganized all official preset templates under a dedicated `presets` folder (`预设模版` in Chinese, `Preset Templates` in English).
  - Added self-healing preset reconciliation and deletion protection for official templates.
- **Settings Danger Zone with Typed Phrase Verification**:
  - Added secure cache clearing and workflow deletion requiring explicit typed confirmation strings in both English and Chinese.

## [0.3.1] - 2026-09-11

### Added
- **Multi-Turn Conversation Memory & Dual-Tier Storage Architecture (`PRD-010`)**:
  - **IndexedDB Asynchronous Storage Adapter (`session-storage.ts`)**: Replaced 5MB ephemeral `sessionStorage` with high-capacity, non-blocking `IndexedDBSessionAdapter` (database: `patchcat_chat_db`, store: `chat_sessions`) with seamless in-memory fallback for Node.js test runners.
  - **Tier-1 Global Configuration Policy (`settings-store.ts`)**: Added `memoryDefaults` supporting master toggle, sliding window rounds (1–20), token budget limit (500–16,000), and pruning strategies (`hybrid`, `window`, `token_budget`) with reset to default capabilities.
  - **Interactive Storage FAQ & Memory Preferences UI (`SettingsPage.tsx`)**:
    - Embedded Conversation Memory Defaults control card in General settings with sliders, strategy buttons, and instant reset.
    - Embedded expandable Storage Architecture & FAQ card explaining client-side IndexedDB benefits, self-hosted SQLite advantages, and browser sandbox File System Access API re-authorization trade-offs.
  - **Workflow-Scoped Session Isolation (`ChatDebugPanel.tsx`)**: Namespaced chat histories by `${workflowId}::${sessionId}`, preventing cross-canvas message contamination.
  - **Algorithmic Context Pruning & Dynamic Context Injection**: Implemented `pruneConversationMessages` (sliding window, reverse token accumulation, hybrid) and automated injection into `inputsBag` slots (`chat_history`, `conversation_history`, `history`).
  - **Automated Test Suite Expansion**: Added `tests/session-storage.node.test.ts` (10 tests) and updated `tests/settings.node.test.ts` (173 total tests passing at 100%).

## [0.3.0] - 2026-09-09

### Added
- **IF/ELSE Conditional Branch Node (`ConditionNode.tsx`, PRD-007)**:
  - Multi-branch condition evaluation with 9 operators: `equals`, `not_equals`, `contains`, `not_contains`, `greater_than`, `less_than`, `is_empty`, `is_not_empty`, and `regex_match`.
  - Dynamic branch skipping: unactivated branch descendants are marked as `skipped` with `NODE_SKIPPED` events without disrupting topological Kahn scheduling.
  - Visual condition rule builder in `PropertyPanel.tsx` with dynamic add/remove cases and pre-flight unconnected branch validation warnings.
- **Variable Aggregator Node (`AggregatorNode.tsx`, PRD-007)**:
  - Variable reconvergence across multiple upstream branches with 3 modes: `first_available` (extracts first non-skipped output), `merge_all` (combines active outputs into an object), and `wait_all`.
- **HTTP Request Node (`HttpNode.tsx`, PRD-008)**:
  - Supports all HTTP methods (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`), custom headers, query parameters, body payloads, and auth (`bearer`, `basic`, `api-key`).
  - Robust exponential backoff retries on transient 5xx server errors (500, 502, 503, 504).
  - Security validation blocking dangerous URL protocols (`file://`, `javascript:`, `data:`).
  - Five-tab configuration inspector (Params | Headers | Body | Auth | Settings).
- **Interactive Chat Debug Drawer (`ChatDebugPanel.tsx`, PRD-009)**:
  - Slide-over drawer accessible via header or global `Ctrl+Shift+D` shortcut.
  - Live SSE streaming with typewriter bubble rendering, per-node trace latency breakdowns, and token badges.
  - Conversation session management with Markdown/JSON trace export.
- **Workflow → REST API One-Click Publishing (`PublishApiModal.tsx`, PRD-009)**:
  - Backend execution endpoint `POST /api/v1/workflows/{workflow_id}/run` supporting both synchronous JSON response and streaming SSE.
  - Workflow API Key authentication with enable/disable switch, key regeneration, and ready-to-run curl, Python, and JavaScript snippets.
- **Built-in Official Presets (EN & ZH)**:
  - Added "Conditional Customer Routing" (`conditional-routing`) and "Weather API Integration" (`weather-api`).
- **Comprehensive Test Suite Upgrades**:
  - Reached 94 frontend automated unit tests and 21 backend pytest integration tests (115 total tests passing at 100%).

---

## [0.2.0] - 2026-09-03

### Added
- **RAG Knowledge Base & Vector Retrieval Engine (Phase 2)**:
  - Dify-style three-tier relational data models: `KnowledgeBase` ➔ `Document` ➔ `DocumentChunk` with cascading foreign keys and cached metric counters.
  - Intelligent sliding window text chunker with multi-tier boundary fallback (paragraph `\n\n` ➔ single line `\n` ➔ sentence punctuation ➔ character stride) and semantic overlap (50 chars) to prevent context fragmentation.
  - Industrial-grade ETL text cleaner with line ending normalization (`\r\n` ➔ `\n`) and whitespace/newline compression.
  - Boundary-safe vector cosine similarity retriever supporting Top-K truncation, score threshold filtering, and structured Markdown context generation (`### [Document: name (Similarity: 0.88)]`).
  - Unified multi-provider embedding client supporting OpenAI (`text-embedding-3-small`), SiliconFlow (BGE), and Ollama.
  - Deterministic offline embedding generator enabling fast, keyless, zero-cost CI and local development.
  - RESTful API endpoints for knowledge base CRUD, document upload, chunk preview (`POST /preview-chunks`), and semantic retrieval (`POST /retrieve`).
- **Canvas Knowledge Retrieval Node (`KnowledgeNode.tsx`)**:
  - Native canvas node with cyan styling, database icon, and dynamic badges for target KB, query slot, and Top-K recall.
  - Left `in` handle (receives query/variables) and right `context` handle (outputs structured citation context).
  - Extended property panel with KB selector, query textarea supporting upstream variables (`{{input_1.query}}`), Top-K slider (1–10), and similarity threshold slider (0.0–1.0).
  - Dual-mode execution in `browser-engine.ts`: real vector search when connected to server, high-fidelity mock chunks when offline.
- **Built-in Official RAG Preset Workflow**:
  - Added "RAG Grounded Q&A" (`rag-qa`) preset scenario in both English and Chinese: `Input` ➔ `Knowledge` ➔ `Prompt` ➔ `LLM` ➔ `Output`.
- **FastAPI + SQLAlchemy 2.0 Async Backend (Phase 1)**:
  - Dual-mode database support: single-file zero-Docker SQLite (local development) and PostgreSQL with `pgvector` (production).
  - RESTful API for folders, workflows, health check (`GET /api/v1/health`), and auto-seeding for clean initial databases.
- **Drawer-Style Multi-Workflow Management (`project-store.ts`)**:
  - Hierarchical directory tree management with folder CRUD, workflow creation, renaming, duplication, and cross-folder movement.
  - Decoupled `StorageAdapter` pattern (`LocalStorageAdapter` vs `ApiServerAdapter`) allowing seamless switching between local browser storage and team server backend.
- **Settings Center & Developer Experience**:
  - Fullscreen `SettingsPage.tsx` with real-time backend health latency ping test.
  - Pre-flight model check with friendly dialog and Dry-Run flow validation mode (`skipLLM: true`).
  - 3-tier sanitized logging engine (Summary, Detailed, Dev) with recursive sensitive key masking (`sk-...`, `AIza...`, Bearer tokens).
  - Strongly-typed bilingual internationalization (i18n) for English and Simplified Chinese.

### Changed
- Relocated workflow drawer toggle to a protruding floating tab handle (`<<` / `>>`) on the canvas edge for improved focus.
- Upgraded comprehensive test suite from 50 to 77 automated test cases (65 frontend unit tests + 12 backend pytest tests) passing at 100%.
- Centralized all repository URLs and author metadata to `GuoBug/PatchCat`.

### Fixed
- Fixed SVG vector deformation of the PatchCat logo on narrow mobile viewports.
- Fixed SQLAlchemy 2.0 cascading delete orphan warning (`confirm_deleted_rows=False`) by declaring `passive_deletes=True`.
- Fixed missing connection lines in preset workflows by eliminating restrictive node handle ID mismatches.

---

## [0.1.0] - 2026-08-31

### Added
- **Core DAG Topological Scheduler**:
  - Kahn's algorithm-based asynchronous layered scheduler supporting parallel execution waves.
  - Real-time pre-flight cycle detection with cyclic node highlighting and alert banner.
- **Variable Interpolation Engine (`variable-resolver.ts`)**:
  - Dynamic slot syntax `{{nodeId.property}}` with fallback value support and security defense against prototype pollution (`__proto__`, `constructor`).
- **Visual Canvas & Core Nodes**:
  - XYFlow (React Flow v12) infinite canvas with custom dark slate styling.
  - 5 core workflow nodes: `InputNode`, `PromptNode`, `LLMNode`, `CodeNode`, `OutputNode`.
  - Right-side slide-over property drawer for node inspection and execution telemetry viewer.
  - Quick-add node dropdown palette and hover-to-delete connection line cutter.
- **Multi-Provider LLM Integration**:
  - Unified client supporting OpenAI, DeepSeek, and Google Gemini with endpoint normalization.
  - Streaming SSE parser with DeepSeek R1 reasoning chain (`<think>`) collapsible visualization.
- **Dual Themes**:
  - Seamless toggle between Modern Slate (Light Mode) and Cyberpunk Dark Slate (Dark Mode).
- **Engineering Chaos Benchmarks**:
  - 4 advanced engineering benchmarks: concurrency timing, in-flight cancellation via `AbortSignal`, error bubbling, and dangling edge assertion.
  - 6-node e-commerce multi-agent refund arbitrator end-to-end scenario test.
