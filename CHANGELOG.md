# Changelog

All notable changes to the **PatchCat** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
