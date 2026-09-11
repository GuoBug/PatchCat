# Phase 3 Architecture: Conversation Memory & Storage Subsystem

## 1. Architectural Blueprint & Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│                          User Interface                                │
│                                                                        │
│   ┌───────────────────────────┐       ┌───────────────────────────┐    │
│   │   SettingsPage            │       │   ChatDebugPanel          │    │
│   │   - Tier-1 Memory Config  │       │   - Per-workflow history  │    │
│   │   - Storage FAQ & Q&A     │       │   - Dynamic parameter bar │    │
│   └─────────────┬─────────────┘       └─────────────┬─────────────┘    │
└─────────────────┼───────────────────────────────────┼──────────────────┘
                  │                                   │
                  ▼                                   ▼
┌─────────────────────────────────┐   ┌──────────────────────────────────┐
│ settings-store.ts               │   │ sessionStorageAdapter            │
│ (Tier-1 Global Policy)          │   │ (IndexedDBSessionAdapter)        │
│                                 │   │                                  │
│ - enabled: boolean              │   │ Database: "patchcat_chat_db"     │
│ - maxHistoryRounds: 5           │   │ Store: "chat_sessions"           │
│ - maxTokenBudget: 3000          │   │ Scoped Key: "${wfId}::${sessId}" │
│ - pruningStrategy: "hybrid"     │   │ Node.js: in-memory fallback      │
└─────────────────┬───────────────┘   └───────────────┬──────────────────┘
                  │                                   │
                  └─────────────────┬─────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Context Pruning & Formatting Pipeline                │
│                                                                        │
│   Raw Messages ──► pruneConversationMessages() ──► Formatted Text      │
│                    1. Window Slicing (2 * K)                           │
│                    2. Reverse Token Budget Accumulation                │
│                    3. formatMessagesToPlainText()                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    Browser DAG Execution Engine                        │
│                                                                        │
│   inputsBag = {                                                        │
│     query: "...",                                                      │
│     chat_history: "User: ... \nAssistant: ...",                        │
│     conversation_history: "...",                                       │
│     history: "..."                                                     │
│   }                                                                    │
│                                                                        │
│   InputNode ──► PromptNode ({{chat_history}}) ──► LLMNode ──► Output   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Modules and Subsystem Breakdown

### 2.1 `src/services/storage/session-storage.ts`
- **IndexedDBSessionAdapter**: Implements `ISessionStorageAdapter`. Uses browser-native `window.indexedDB` to open `patchcat_chat_db` v1 and manage the `chat_sessions` object store.
- **In-Memory Fallback**: When `window.indexedDB` is absent (such as in headless Node.js test runners), a local `Map<string, MemoryMessage[]>` takes over silently, guaranteeing 100% testability without requiring JSDOM or polyfills.
- **`pruneConversationMessages(messages, options)`**:
  - Implements three algorithmic pruning strategies:
    1. `'window'`: Enforces an upper limit of $2 \times \text{maxHistoryRounds}$ messages.
    2. `'token_budget'`: Iterates from the newest message to the oldest, reverse-accumulating token consumption. Drops older messages as soon as adding the next message would break the threshold.
    3. `'hybrid'`: Sequentially applies the window truncation, then the token budget pruning.
- **`estimateMessageTokens(text)`**: Safe heuristics approximating tokens at roughly 4 characters per token.
- **`formatMessagesToPlainText(messages)`**: Formats message objects into `User: ...\nAssistant: ...` prompt-ready context blocks.

### 2.2 `src/stores/settings-store.ts`
- **`MemoryDefaults` Schema**:
  ```typescript
  export interface MemoryDefaults {
    enabled: boolean;
    maxHistoryRounds: number;
    maxTokenBudget: number;
    pruningStrategy: 'window' | 'token_budget' | 'hybrid';
  }
  ```
- **Sync & Reset**: Synchronized to `localStorage` under `patchcat-memory-defaults-v1` with complete fallback to `DEFAULT_MEMORY_SETTINGS`.

### 2.3 `src/components/panels/ChatDebugPanel.tsx`
- Replaced ephemeral, synchronous `sessionStorage` with asynchronous `sessionStorageAdapter`.
- Automatically namespaced under `activeWorkflowId || 'default'`.
- Injects `chat_history`, `conversation_history`, and `history` into `inputsBag` when `memoryDefaults.enabled` is active.

---

## 3. Storage Trade-offs & Architecture Decisions

1. **Why IndexedDB over sessionStorage?**
   - `sessionStorage` imposes a hard 5MB ceiling and is lost on tab closure.
   - `IndexedDB` offers hundreds of megabytes or gigabytes of capacity and survives tab closing.
   - IndexedDB runs asynchronously via non-blocking browser threads, preserving the main thread's 60 FPS canvas performance.

2. **Why not force File System Access API for local storage?**
   - The W3C File System Access API (`showDirectoryPicker`) requires the user to grant explicit permissions through a browser security dialog on **every page reload**.
   - For an iterative AI prompt development tool where users frequently refresh, this creates substantial friction.
   - For users needing permanent, unprompted local persistence, PatchCat provides the zero-config self-hosted SQLite backend (`patchcat.db`).
