# Changelog

All notable changes to the **PatchCat** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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
