/**
 * @file    src/config/runtime-defaults.ts
 * @version 1.0.0
 * @description
 *   Centralized runtime defaults, system constants, and validation thresholds
 *   for the PatchCat DAG workflow execution engine and global settings.
 *
 *   Eliminates hardcoded magic numbers across the client-side orchestrator.
 */

export const RUNTIME_DEFAULTS = {
  // ── 1. Editor & Auto-Save Preferences ──────────────────────────────────────
  AUTOSAVE_DEBOUNCE_MS: 800,
  AUTOSAVE_DEBOUNCE_MIN_MS: 200,
  AUTOSAVE_DEBOUNCE_MAX_MS: 3000,

  // ── 2. Script Sandbox Execution Guard (Code Nodes) ─────────────────────────
  SANDBOX_TIMEOUT_SECONDS: 5,
  SANDBOX_TIMEOUT_MIN_SECONDS: 1,
  SANDBOX_TIMEOUT_MAX_SECONDS: 60,

  // ── 3. Step Tool Execution Timeout Watchdog ────────────────────────────────
  TOOL_EXECUTION_TIMEOUT_ENABLED: false,
  TOOL_EXECUTION_TIMEOUT_SECONDS: 30,
  TOOL_EXECUTION_TIMEOUT_MIN_SECONDS: 5,
  TOOL_EXECUTION_TIMEOUT_MAX_SECONDS: 300,

  // ── 4. Network Resiliency & LLM Client Retries ─────────────────────────────
  LLM_MAX_RETRIES: 1,
  LLM_MAX_RETRIES_MIN: 0,
  LLM_MAX_RETRIES_MAX: 3,
  LLM_RETRY_DELAY_SECONDS: 1.5,
  LLM_RETRY_DELAY_MIN_SECONDS: 0.5,
  LLM_RETRY_DELAY_MAX_SECONDS: 5.0,

  // ── 5. Agent ReAct Loop Safeguards ─────────────────────────────────────────
  AGENT_LOOP_DETECTION_ENABLED: true,
  AGENT_LOOP_DETECTION_THRESHOLD: 3, // Consecutive identical calls to trip circuit breaker
  AGENT_LOOP_DETECTION_HINT_THRESHOLD: 2, // Consecutive identical calls to inject corrective hint
  AGENT_DEFAULT_MAX_ITERATIONS: 10,
  AGENT_MAX_ITERATIONS_MIN: 1,
  AGENT_MAX_ITERATIONS_MAX: 30,
  AGENT_TOKEN_BUDGET: 0, // 0 = unlimited / disabled

  // ── 6. Node Execution Defaults ─────────────────────────────────────────────
  HTTP_NODE_TIMEOUT_MS: 30000,
  LOOP_NODE_ITEM_TIMEOUT_MS: 30000,
  MAX_LAYER_CONCURRENCY: 10,
  MAX_DELEGATION_DEPTH: 5,

  // ── 7. Context Engineering & Safeguards (Module 2) ──────────────────────────
  CONTEXT_WARNING_THRESHOLD_RATIO: 0.75, // Trigger warning if active context > 75% of model limit
  DEFAULT_CONTEXT_WINDOW_LIMIT: 8192, // Safe fallback context limit when model specs unstated
  TOOL_RESULT_MAX_CHARS: 4000, // Safe default clamp for single tool output (~1000 tokens)
  TOOL_RESULT_HEAD_RATIO: 0.6, // Keep first 60% of allowed budget on clamp
  TOOL_RESULT_TAIL_RATIO: 0.4, // Keep last 40% of allowed budget on clamp
  AGENT_MAX_HISTORY_TURNS: 4, // Default sliding window retained turns (K=4 turns)

  // ── 8. Model Routing & Cascading Safeguards (Module 3) ─────────────────────
  ROUTING_PRIMARY_MODEL: 'Qwen/Qwen2.5-7B-Instruct',
  ROUTING_FALLBACK_MODEL: 'deepseek-ai/DeepSeek-V3',
  ROUTING_MAX_CHEAP_RETRIES: 2, // Allow cheap model to self-heal up to 2 times before escalating
  ROUTING_ENABLE_SEMANTIC_GATE: true, // Enable heuristic F7 description-action conflict detection

  // ── 9. Cross-Encoder Rerank Client ─────────────────────────────────────────
  RERANK_TIMEOUT_MS: 8000,
  RERANK_TIMEOUT_MIN_MS: 1000,
  RERANK_TIMEOUT_MAX_MS: 60000,
  // Rerank scores live on a sigmoid scale with no floor, while coarse similarity
  // is floored around 0.45. A single numeric threshold is therefore NOT portable
  // between the two stages — the rerank stage keeps its own, permissive default.
  RERANK_SCORE_THRESHOLD: 0.0,
} as const;

export interface RuntimeProtectionSettings {
  toolTimeoutEnabled: boolean;
  toolTimeoutSeconds: number;
  sandboxTimeoutSeconds: number;
  loopDetectionEnabled: boolean;
  loopDetectionThreshold: number;
  defaultMaxIterations: number;
}

export interface EditorPreferences {
  autoSaveDebounceMs: number;
}

export interface NetworkSettings {
  llmMaxRetries: number;
  llmRetryDelaySeconds: number;
}

export const DEFAULT_RUNTIME_PROTECTION: RuntimeProtectionSettings = {
  toolTimeoutEnabled: RUNTIME_DEFAULTS.TOOL_EXECUTION_TIMEOUT_ENABLED,
  toolTimeoutSeconds: RUNTIME_DEFAULTS.TOOL_EXECUTION_TIMEOUT_SECONDS,
  sandboxTimeoutSeconds: RUNTIME_DEFAULTS.SANDBOX_TIMEOUT_SECONDS,
  loopDetectionEnabled: RUNTIME_DEFAULTS.AGENT_LOOP_DETECTION_ENABLED,
  loopDetectionThreshold: RUNTIME_DEFAULTS.AGENT_LOOP_DETECTION_THRESHOLD,
  defaultMaxIterations: RUNTIME_DEFAULTS.AGENT_DEFAULT_MAX_ITERATIONS,
};

export const DEFAULT_EDITOR_PREFERENCES: EditorPreferences = {
  autoSaveDebounceMs: RUNTIME_DEFAULTS.AUTOSAVE_DEBOUNCE_MS,
};

export const DEFAULT_NETWORK_SETTINGS: NetworkSettings = {
  llmMaxRetries: RUNTIME_DEFAULTS.LLM_MAX_RETRIES,
  llmRetryDelaySeconds: RUNTIME_DEFAULTS.LLM_RETRY_DELAY_SECONDS,
};
