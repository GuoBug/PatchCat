# 📋 Runtime Parameters Reference Dictionary

> Complete reference manual for all runtime constants, configuration options, default values, and safety boundaries in PatchCat.

---

## 1. Editor & Persistence Preferences

| Parameter | Type | Default | Min / Max | Description & Rationale |
|:---|:---|:---:|:---:|:---|
| `editorPreferences.autoSaveDebounceMs` | `number` | `800` ms | `200` - `3000` ms | Debounce window before persisting canvas node and edge mutations to local storage or backend API. Prevents write thrashing during rapid node dragging. |

---

## 2. Runtime Protection & Watchdogs (`runtimeProtection`)

| Parameter | Type | Default | Valid Range | Scope | Description & Rationale |
|:---|:---|:---:|:---:|:---:|:---|
| `toolTimeoutEnabled` | `boolean` | `false` | `true` / `false` | Global Setting | Master toggle for step-level tool execution watchdog. When enabled, wraps external tool executions in an `AbortSignal.timeout`. |
| `toolTimeoutSeconds` | `number` | `30` s | `5` - `300` s | Global Setting | Hard timeout ceiling for tool calls (HTTP fetch, API calls). If exceeded, triggers graceful cancellation and observation error feedback. |
| `sandboxTimeoutSeconds` | `number` | `5` s | `1` - `60` s | Global Setting | Timeout ceiling for inline JavaScript/TypeScript code execution in web workers / sandboxes. Prevents infinite CPU loops from freezing the browser UI. |
| `loopDetectionEnabled` | `boolean` | `true` | `true` / `false` | Global / Node | Autonomous ReAct loop deadlock detector. Monitors consecutive identical tool calls with identical arguments. |
| `loopDetectionThreshold` | `number` | `3` | `2` - `5` | Global / Node | Trip threshold. At 2 identical consecutive calls, injects corrective prompt guidance. At 3, trips hard circuit breaker and terminates Agent execution cleanly. |
| `defaultMaxIterations` | `number` | `10` | `1` - `30` | Global Setting | Default iteration budget for newly instantiated Agent nodes before auto-terminating loop execution. |

---

## 3. Agent Node Instance Overrides (`node.data.config`)

| Parameter | Type | Default | Valid Range | Description & Rationale |
|:---|:---|:---:|:---:|:---|
| `maxTokenBudget` | `number` | `0` (Unlimited) | `0` - `1,000,000` | Optional hard cumulative token consumption limiter. `0` disables budget limiter; values `> 0` interrupt the ReAct loop once total tokens consumed exceeds the threshold. Clamped at `>= 0`. |
| `loopDetectionEnabled` | `boolean` | Inherited (`true`) | `true` / `false` | Overrides global deadlock loop detection for specific high-iteration workflows. |
| `loopDetectionThreshold` | `number` | Inherited (`3`) | `2` - `5` | Overrides circuit breaker trip threshold for specific complex tool tasks. |
| `maxIterations` | `number` | `10` | `1` - `30` | Maximum number of ReAct reasoning-action steps permitted for this specific Agent node. |
| `temperature` | `number` | `0.7` | `0.0` - `1.0` | Sampling temperature controlling Agent reasoning entropy. |

---

## 4. Network Resiliency & LLM Client (`networkSettings`)

| Parameter | Type | Default | Valid Range | Description & Rationale |
|:---|:---|:---:|:---:|:---|
| `llmMaxRetries` | `number` | `1` | `0` - `3` | Maximum automatic retries for failed LLM network requests (429 Rate Limit, 5xx Gateway errors). Set to `0` for fast failure in offline/local environments. |
| `llmRetryDelaySeconds` | `number` | `1.5` s | `0.5` - `5.0` s | Base exponential backoff delay before re-attempting failed LLM network calls. |

---

## 5. Other Node Execution Defaults

| Constant Name | Value | Unit | Description |
|:---|:---:|:---:|:---|
| `HTTP_NODE_TIMEOUT_MS` | `30000` | ms | Default HTTP request node timeout when no explicit timeout is configured in node properties. |
| `LOOP_NODE_ITEM_TIMEOUT_MS` | `30000` | ms | Default item execution timeout ceiling for each item processed inside a Loop iterator node. |

---

## 6. Global Memory Defaults (`memoryDefaults`)

| Parameter | Type | Default | Description |
|:---|:---|:---:|:---|
| `strategy` | `string` | `'hybrid'` | Default conversation memory strategy: `'window'`, `'budget'`, or `'hybrid'`. |
| `windowSize` | `number` | `10` | Number of recent dialogue rounds retained in sliding window. |
| `tokenBudget` | `number` | `4000` | Maximum token ceiling allocated for dialogue context. |
| `summaryTriggerRatio` | `number` | `0.8` | Threshold ratio of token budget at which automatic background conversation summarization begins. |

---

## 7. Storage Mode Options (`storageMode`)

| Mode | Key | Persistence Target | Description |
|:---|:---|:---|:---|
| **Local Storage (Default)** | `'local'` | Browser `localStorage` & IndexedDB | 100% client-side, zero network dependencies, privacy-first, zero-config. |
| **Server Storage** | `'server'` | FastAPI + PostgreSQL Backend | Synchronized across sessions and devices via REST endpoints (`/api/v1/workflows`). |
