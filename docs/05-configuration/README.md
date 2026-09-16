# ⚙️ PatchCat Configuration & System Settings Architecture

> This document defines the configuration model, cascading hierarchy, persistence lifecycle, and backup/migration procedures for the PatchCat DAG Workflow Orchestration Platform.

---

## 1. Cascading Configuration Hierarchy

PatchCat implements a **3-tier cascading configuration model** ensuring that global policies provide safe, resilient system baselines while allowing individual nodes and workflows granular override controls.

```
┌────────────────────────────────────────────────────────┐
│  Tier 1: Code Baseline Defaults                        │
│  src/config/runtime-defaults.ts                        │
│  (Compile-time constants, safe boundaries, fallbacks)  │
└─────────────────────────┬──────────────────────────────┘
                          ▼
┌────────────────────────────────────────────────────────┐
│  Tier 2: Global System Settings                        │
│  src/stores/settings-store.ts (localStorage / Server)  │
│  - Editor Preferences (Auto-save debounce)             │
│  - Execution Watchdogs (Tool & Sandbox timeouts)       │
│  - Agent Circuit Breakers & Default Iterations         │
│  - Network Resiliency (LLM Retries & Delay)            │
│  - Global Conversation Memory Policy                   │
└─────────────────────────┬──────────────────────────────┘
                          ▼
┌────────────────────────────────────────────────────────┐
│  Tier 3: Node-Level Instance Overrides                 │
│  node.data.config (Workflow Graph Payload)             │
│  - Agent: maxTokenBudget, loopDetectionThreshold       │
│  - HTTP: timeout, maxRetries                           │
│  - Loop: itemTimeout, concurrency                      │
└────────────────────────────────────────────────────────┘
```

### Resolution Rules
1. **Fallback**: If a node does not specify an explicit override, it inherits the global setting configured in `settings-store`.
2. **Hard Ceiling**: If neither the node nor global settings configure a parameter, the engine falls back to `RUNTIME_DEFAULTS`.
3. **Validation & Clamping**: Values are checked against safety ranges (e.g. negative token budgets are clamped to `0`, retry counts cannot exceed bounds).

---

## 2. Settings Reorganization (5-Tab Structure)

The PatchCat fullscreen Settings UI (`SettingsPage.tsx`) organizes configuration into 5 functional panels:

| Tab | Key | Scope |
|:---|:---|:---|
| **1. General** | `tabGeneral` | System appearance, language (`en`/`zh`), auto-save debounce slider, configuration backup & migration, and destructive Danger Zone actions. |
| **2. Execution** | `tabExecution` | Engine runtime safeguards: Tool Execution Watchdog, Code Sandbox Timeout, Looping Call Deadlock Breaker, Agent Default Max Iterations. |
| **3. Providers** | `tabProviders` | Multi-LLM provider endpoints, API credentials, active model selection, and Network Resiliency retry policies. |
| **4. Memory** | `tabMemory` | Conversation memory policies (Window Size, Token Budget, Summarizer Model, Strategy selector), plus Local vs Server storage backend mode. |
| **5. Logs** | `tabLogs` | Real-time structured execution telemetry, level filtering (`summary`/`detailed`/`dev`), search query, and JSON/CSV export. |

---

## 3. Configuration Backup & Migration (Export / Import)

To ensure operational safety, disaster recovery, and cross-machine portability, PatchCat supports two-mode configuration backup:

### 3.1 Export Modes
- **Sanitized Export (Recommended for sharing / team templates)**:
  - All sensitive fields (`apiKey`) are masked as `""`.
  - Safe for public GitHub issues, forum discussions, and shared documentation.
- **Full Export (For personal device migration)**:
  - Preserves exact plaintext API keys alongside all engine thresholds.
  - Accompanied by UI safety alerts warning against sharing unencrypted credentials.

### 3.2 Import Schema Validation
When importing a JSON configuration backup:
1. The engine checks schema version and required sections (`providers`, `runtimeProtection`, `editorPreferences`, etc.).
2. Invalid JSON or malformed structures trigger clear inline validation errors without corrupting active memory state.
3. Successfully imported configurations immediately synchronize to `localStorage` and notify the reactive DAG runtime.

---

## 4. Single-Language Danger Zone Confirmations

Destructive operations (Clear All Cache, Delete All Workflows) utilize a strict GitHub-style typed phrase modal (`DangerConfirmModal.tsx`):
- **English UI (`en`)**: Strictly displays and requires typing uppercase `CLEAR CACHE` or `DELETE ALL WORKFLOWS`.
- **Chinese UI (`zh`)**: Strictly displays and requires typing Chinese `清空缓存` or `删除所有工作流`.
- Mixed-language or dual "or" prompts have been eliminated to prevent operational confusion and maintain localization fidelity.

---

## 5. Detailed Parameter Dictionary

For complete specifications of every runtime parameter, permitted ranges, and default values, see:
👉 [Runtime Parameters Reference](runtime-parameters-reference.md)
