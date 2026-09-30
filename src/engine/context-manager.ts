/**
 * @file    src/engine/context-manager.ts
 * @version 1.0.0 (Module 2: Context Engineering - Layer 0 & Layer 1)
 * @description
 *   Core Context Engineering engine for Agent ReAct loops and multi-turn workflows.
 *
 *   - Layer 0: Context Observability & Breakdown (High-precision token estimation,
 *     role-based breakdown, utilization ratios, and warning triggers).
 *   - Layer 1: Tool Result Clamping & Safe Offloading (Head-Tail preservation,
 *     sentinel omission banners, and prevention of single-step context blowouts).
 */

import { RUNTIME_DEFAULTS } from '../config/runtime-defaults.ts';
import type { ChatMessage } from './llm-client.ts';

// ── 1. Token Estimation & Breakdown (Layer 0) ────────────────────────────────

/**
 * Fast, robust BPE-heuristic token estimation without external native bindings.
 * - CJK (Chinese, Japanese, Korean) characters: ~1.25 tokens per character
 * - Latin / ASCII words / punctuation / whitespace: ~0.27 tokens per char (~3.7 chars/token)
 * - Minimum 1 token for non-empty text.
 */
export function estimateTextTokens(text: string | null | undefined): number {
  if (!text || text.length === 0) return 0;
  let cjkCount = 0;
  let asciiCount = 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // CJK Unified Ideographs and common East Asian scripts
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x20000 && code <= 0x2a6df) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0x3040 && code <= 0x30ff)
    ) {
      cjkCount++;
    } else {
      asciiCount++;
    }
  }

  const estimated = Math.ceil(cjkCount * 1.25 + asciiCount * 0.27);
  return Math.max(1, estimated);
}

/**
 * Estimates token count for a single structured ChatMessage, including formatting overhead.
 */
export function estimateChatMessageTokens(msg: ChatMessage): number {
  if (!msg) return 0;
  // OpenAI / ChatML message frame overhead (<|im_start|>role\n ... <|im_end|>\n) is ~4 tokens
  let tokens = 4;

  if (msg.content) {
    tokens += estimateTextTokens(msg.content);
  }

  if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      tokens += 4; // Tool call container overhead
      if (tc.function?.name) {
        tokens += estimateTextTokens(tc.function.name);
      }
      if (tc.function?.arguments) {
        tokens += estimateTextTokens(tc.function.arguments);
      }
    }
  }

  if (msg.tool_call_id) {
    tokens += 2; // Tool call id reference
  }

  return tokens;
}

export interface RoleTokenStats {
  count: number;
  tokens: number;
}

export interface ContextBreakdown {
  totalEstimatedTokens: number;
  systemTokens: number;
  userTokens: number;
  assistantTokens: number;
  toolTokens: number;
  messageCount: number;
  byRole: Record<'system' | 'user' | 'assistant' | 'tool', RoleTokenStats>;
}

/**
 * Computes a detailed role-by-role token breakdown for an active messages array.
 */
export function estimateContextBreakdown(messages: ChatMessage[]): ContextBreakdown {
  const breakdown: ContextBreakdown = {
    totalEstimatedTokens: 0,
    systemTokens: 0,
    userTokens: 0,
    assistantTokens: 0,
    toolTokens: 0,
    messageCount: messages ? messages.length : 0,
    byRole: {
      system: { count: 0, tokens: 0 },
      user: { count: 0, tokens: 0 },
      assistant: { count: 0, tokens: 0 },
      tool: { count: 0, tokens: 0 },
    },
  };

  if (!messages || messages.length === 0) {
    return breakdown;
  }

  for (const msg of messages) {
    const tokens = estimateChatMessageTokens(msg);
    breakdown.totalEstimatedTokens += tokens;

    const role = msg.role;
    if (role in breakdown.byRole) {
      breakdown.byRole[role].count++;
      breakdown.byRole[role].tokens += tokens;
    }

    switch (role) {
      case 'system':
        breakdown.systemTokens += tokens;
        break;
      case 'user':
        breakdown.userTokens += tokens;
        break;
      case 'assistant':
        breakdown.assistantTokens += tokens;
        break;
      case 'tool':
        breakdown.toolTokens += tokens;
        break;
    }
  }

  return breakdown;
}

// ── 2. Model Context Window Resolution (Layer 0) ─────────────────────────────

/**
 * Known context window capacity limits for standard LLMs.
 */
const KNOWN_MODEL_CONTEXT_LIMITS: Array<{ pattern: RegExp; limit: number }> = [
  // Gemini Models (1M ~ 2M)
  { pattern: /gemini-2/i, limit: 1048576 },
  { pattern: /gemini-1\.5/i, limit: 1048576 },
  // OpenAI Models (128k)
  { pattern: /gpt-4o/i, limit: 128000 },
  { pattern: /gpt-4-turbo/i, limit: 128000 },
  { pattern: /o1|o3/i, limit: 128000 },
  { pattern: /gpt-3\.5-turbo/i, limit: 16385 },
  // DeepSeek Models (64k ~ 128k)
  { pattern: /deepseek-(?:chat|v3|reasoner|r1)/i, limit: 64000 },
  // Qwen Models (32k ~ 128k)
  { pattern: /qwen2\.5/i, limit: 32768 },
  { pattern: /qwen/i, limit: 32768 },
  // LLaMA 3.1+ Models (128k)
  { pattern: /llama-3\.[123]/i, limit: 128000 },
  { pattern: /llama-3/i, limit: 8192 },
];

/**
 * Resolves the operational context window limit for a given model string.
 * Falls back to RUNTIME_DEFAULTS.DEFAULT_CONTEXT_WINDOW_LIMIT (8,192).
 */
export function resolveModelContextLimit(modelName?: string): number {
  if (!modelName) return RUNTIME_DEFAULTS.DEFAULT_CONTEXT_WINDOW_LIMIT;

  const trimmed = modelName.trim();
  for (const entry of KNOWN_MODEL_CONTEXT_LIMITS) {
    if (entry.pattern.test(trimmed)) {
      return entry.limit;
    }
  }

  return RUNTIME_DEFAULTS.DEFAULT_CONTEXT_WINDOW_LIMIT;
}

// ── 3. Tool Result Clamping & Safe Offloading (Layer 1) ──────────────────────

export interface ClampToolResultOptions {
  maxChars?: number;
  headRatio?: number;
  tailRatio?: number;
  toolName?: string;
}

export interface ClampResult {
  content: string;
  isClamped: boolean;
  originalChars: number;
  clampedChars: number;
  originalTokensEstimated: number;
  clampedTokensEstimated: number;
  omittedChars: number;
  omittedTokensEstimated: number;
}

/**
 * Performs Head-Tail Preserving Clamping on a tool result string.
 *
 * If content length exceeds maxChars:
 *   - Keeps headChars = maxChars * headRatio (metadata, schema, context start)
 *   - Keeps tailChars = maxChars * tailRatio (status, conclusions, closing data)
 *   - Injects a clear, deterministic omission banner explaining the truncation to the LLM.
 *
 * If content length is within limits:
 *   - Returns exact original string with 0 overhead and 100% byte fidelity.
 */
export function clampToolResult(
  content: string,
  options: ClampToolResultOptions = {},
): ClampResult {
  const originalChars = content ? content.length : 0;
  const originalTokens = estimateTextTokens(content);

  const maxChars = options.maxChars !== undefined ? options.maxChars : RUNTIME_DEFAULTS.TOOL_RESULT_MAX_CHARS;
  const headRatio = options.headRatio ?? RUNTIME_DEFAULTS.TOOL_RESULT_HEAD_RATIO;
  const tailRatio = options.tailRatio ?? RUNTIME_DEFAULTS.TOOL_RESULT_TAIL_RATIO;
  const toolName = options.toolName || 'tool';

  if (!content || maxChars <= 0 || originalChars <= maxChars) {
    return {
      content: content ?? '',
      isClamped: false,
      originalChars,
      clampedChars: originalChars,
      originalTokensEstimated: originalTokens,
      clampedTokensEstimated: originalTokens,
      omittedChars: 0,
      omittedTokensEstimated: 0,
    };
  }

  const headLen = Math.max(50, Math.floor(maxChars * headRatio));
  const tailLen = Math.max(50, Math.floor(maxChars * tailRatio));

  // If head + tail exceeds original, no truncation is actually possible
  if (headLen + tailLen >= originalChars) {
    return {
      content,
      isClamped: false,
      originalChars,
      clampedChars: originalChars,
      originalTokensEstimated: originalTokens,
      clampedTokensEstimated: originalTokens,
      omittedChars: 0,
      omittedTokensEstimated: 0,
    };
  }

  const headText = content.slice(0, headLen);
  const tailText = content.slice(originalChars - tailLen);
  const omittedChars = originalChars - (headLen + tailLen);
  const omittedTokens = Math.max(1, estimateTextTokens(content.slice(headLen, originalChars - tailLen)));

  const banner =
    `\n\n[... Truncated ${omittedChars.toLocaleString()} characters (approx. ${omittedTokens.toLocaleString()} tokens) ` +
    `by PatchCat Context Guard to protect context window. Head (${headLen.toLocaleString()} chars) and Tail (${tailLen.toLocaleString()} chars) preserved. ` +
    `Original size: ${originalChars.toLocaleString()} chars. Tool: "${toolName}". ` +
    `Hint: Apply filters or pagination parameters to retrieve smaller targeted result sets ...] \n\n`;

  const clampedContent = headText + banner + tailText;
  const clampedChars = clampedContent.length;
  const clampedTokens = estimateTextTokens(clampedContent);

  return {
    content: clampedContent,
    isClamped: true,
    originalChars,
    clampedChars,
    originalTokensEstimated: originalTokens,
    clampedTokensEstimated: clampedTokens,
    omittedChars,
    omittedTokensEstimated: omittedTokens,
  };
}

// ── 4. Observability Iteration Tracker ───────────────────────────────────────

export interface ClampedToolMetric {
  toolName: string;
  originalChars: number;
  clampedChars: number;
  originalTokensEstimated: number;
  clampedTokensEstimated: number;
}

export interface ContextIterationMetric {
  iteration: number;
  messageCount: number;
  estimatedPromptTokens: number;
  actualPromptTokens?: number;
  breakdown: ContextBreakdown;
  contextLimit: number;
  utilizationRatio: number; // estimatedPromptTokens / contextLimit
  warning: boolean;
  warningReason?: string;
  clampedTools: ClampedToolMetric[];
  isPruned?: boolean;
  prunedTurnsCount?: number;
  tokensSavedByPruning?: number;
}

/**
 * State tracker maintaining per-iteration context metrics for an Agent ReAct execution.
 */
export class ContextTracker {
  private metrics: ContextIterationMetric[] = [];
  private contextLimit: number;
  private warningRatio: number;

  constructor(
    contextLimit: number = RUNTIME_DEFAULTS.DEFAULT_CONTEXT_WINDOW_LIMIT,
    warningRatio: number = RUNTIME_DEFAULTS.CONTEXT_WARNING_THRESHOLD_RATIO,
  ) {
    this.contextLimit = Math.max(500, contextLimit);
    this.warningRatio = warningRatio;
  }

  /**
   * Records a snapshot of the context right before an LLM completion call.
   */
  recordPreCall(
    iteration: number,
    messages: ChatMessage[],
    clampedToolsThisIteration: ClampedToolMetric[] = [],
  ): ContextIterationMetric {
    const breakdown = estimateContextBreakdown(messages);
    const estimatedTokens = breakdown.totalEstimatedTokens;
    const utilization = estimatedTokens / this.contextLimit;
    const isWarning = utilization >= this.warningRatio;

    const metric: ContextIterationMetric = {
      iteration,
      messageCount: messages.length,
      estimatedPromptTokens: estimatedTokens,
      breakdown,
      contextLimit: this.contextLimit,
      utilizationRatio: Math.round(utilization * 1000) / 1000,
      warning: isWarning,
      warningReason: isWarning
        ? `Context utilization reached ${(utilization * 100).toFixed(1)}% (${estimatedTokens} / ${this.contextLimit} tokens)`
        : undefined,
      clampedTools: [...clampedToolsThisIteration],
    };

    this.metrics.push(metric);
    return metric;
  }

  /**
   * Records a pruning event on the current iteration metric.
   */
  recordPrune(prunedTurnsCount: number, tokensSaved: number): void {
    if (this.metrics.length === 0) return;
    const latest = this.metrics[this.metrics.length - 1];
    if (!latest) return;
    latest.isPruned = true;
    latest.prunedTurnsCount = (latest.prunedTurnsCount || 0) + prunedTurnsCount;
    latest.tokensSavedByPruning = (latest.tokensSavedByPruning || 0) + tokensSaved;
  }

  /**
   * Updates the latest metric with actual prompt tokens reported by the provider.
   */
  recordPostCall(actualPromptTokens?: number): void {
    if (this.metrics.length === 0 || typeof actualPromptTokens !== 'number') return;
    const latest = this.metrics[this.metrics.length - 1];
    if (!latest) return;
    latest.actualPromptTokens = actualPromptTokens;
    // Re-evaluate utilization with actual provider usage if available
    const actualUtilization = actualPromptTokens / this.contextLimit;
    if (actualUtilization >= this.warningRatio && !latest.warning) {
      latest.warning = true;
      latest.warningReason = `Actual context utilization reached ${(actualUtilization * 100).toFixed(1)}% (${actualPromptTokens} / ${this.contextLimit} tokens)`;
    }
  }

  getAllMetrics(): ContextIterationMetric[] {
    return [...this.metrics];
  }

  getPeakEstimatedTokens(): number {
    return this.metrics.reduce((max, m) => Math.max(max, m.estimatedPromptTokens), 0);
  }

  getClampedToolCount(): number {
    return this.metrics.reduce((acc, m) => acc + m.clampedTools.length, 0);
  }

  getTotalTokensSavedByPruning(): number {
    return this.metrics.reduce((acc, m) => acc + (m.tokensSavedByPruning || 0), 0);
  }
}

// ── 5. Layer 2: Dual Anchor + Atomic Turn Sliding Window Pruning ────────────

export interface AgentInteractionTurn {
  turnId: number;
  messages: ChatMessage[];
  tokens: number;
}

/**
 * Extracts immutable prefix anchors and atomic interaction turns from an active ChatMessage array.
 *
 * Invariant 1 (Prompt Caching / Lost in the Middle):
 *   Anchors consist of:
 *   - Initial System Message (if present at index 0)
 *   - Initial User Request / Objective (first user message at index 0 or 1)
 *   These are 100% immutable and never pruned or reordered, guaranteeing prompt prefix cache hits.
 *
 * Invariant 2 (Atomic Tool Transaction Integrity):
 *   An assistant message with tool_calls and all its following matching tool observations
 *   MUST stay together. Slicing never tears apart an assistant tool call from its tool responses.
 */
export function extractAgentTurns(messages: ChatMessage[]): {
  anchors: ChatMessage[];
  turns: AgentInteractionTurn[];
} {
  if (!messages || messages.length === 0) {
    return { anchors: [], turns: [] };
  }

  const anchors: ChatMessage[] = [];
  let turnStartIndex = 0;

  // 1. Identify System Anchor
  const firstMsg = messages[0];
  if (firstMsg?.role === 'system') {
    anchors.push(firstMsg);
    turnStartIndex = 1;
  }

  // 2. Identify Initial User Goal Anchor
  const userGoalMsg = messages[turnStartIndex];
  if (userGoalMsg?.role === 'user') {
    anchors.push(userGoalMsg);
    turnStartIndex++;
  }

  // 3. Parse remaining messages into atomic turns
  const turns: AgentInteractionTurn[] = [];
  let currentTurnId = 1;
  let i = turnStartIndex;

  while (i < messages.length) {
    const msg = messages[i];
    if (!msg) {
      i++;
      continue;
    }

    if (msg.role === 'assistant') {
      const turnMessages: ChatMessage[] = [msg];
      i++;

      // If assistant initiated tool calls, absorb all subsequent tool messages belonging to this turn
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        while (i < messages.length) {
          const nextMsg = messages[i];
          if (!nextMsg) break;
          if (nextMsg.role === 'tool') {
            turnMessages.push(nextMsg);
            i++;
          } else {
            break;
          }
        }
      }

      const turnTokens = turnMessages.reduce((sum, m) => sum + estimateChatMessageTokens(m), 0);
      turns.push({
        turnId: currentTurnId++,
        messages: turnMessages,
        tokens: turnTokens,
      });
    } else {
      // Standalone user hints, feedback, or custom messages
      const turnTokens = estimateChatMessageTokens(msg);
      turns.push({
        turnId: currentTurnId++,
        messages: [msg],
        tokens: turnTokens,
      });
      i++;
    }
  }

  return { anchors, turns };
}

export interface SlidingWindowOptions {
  maxTurns?: number; // Maximum atomic turns to retain in sliding window (default: 4)
  maxTokens?: number; // Optional maximum total token ceiling
  preserveAnchors?: boolean; // Default true: immutable system + user goal
}

export interface PruningResult {
  messages: ChatMessage[];
  isPruned: boolean;
  originalTurnCount: number;
  retainedTurnCount: number;
  prunedTurnCount: number;
  originalTokens: number;
  retainedTokens: number;
  omittedTokensEstimated: number;
}

/**
 * Applies Layer 2 Sliding Window & Anchor Pruning to the messages array.
 *
 * Guaranteed Properties:
 * 1. Immutability: anchors (System Prompt + Initial User Goal) are strictly preserved at prefix.
 * 2. Atomic Integrity: Never tears an assistant tool call from its tool observation.
 * 3. Bounded Context: Messages count and tokens are strictly bounded by O(K) where K = maxTurns.
 * 4. Model Clarity: Injects a lightweight tombstone message notifying the LLM of pruned earlier turns.
 */
export function applySlidingWindowPruning(
  messages: ChatMessage[],
  options: SlidingWindowOptions = {},
): PruningResult {
  const maxTurns = options.maxTurns ?? RUNTIME_DEFAULTS.AGENT_MAX_HISTORY_TURNS;
  const maxTokens = options.maxTokens;
  const originalTokens = messages.reduce((sum, m) => sum + estimateChatMessageTokens(m), 0);

  if (!messages || messages.length === 0 || maxTurns <= 0) {
    return {
      messages: [...messages],
      isPruned: false,
      originalTurnCount: 0,
      retainedTurnCount: 0,
      prunedTurnCount: 0,
      originalTokens,
      retainedTokens: originalTokens,
      omittedTokensEstimated: 0,
    };
  }

  const { anchors, turns } = extractAgentTurns(messages);
  const totalTurns = turns.length;

  // If turns are within maxTurns and within maxTokens, no pruning needed
  if (totalTurns <= maxTurns) {
    if (!maxTokens || originalTokens <= maxTokens) {
      return {
        messages: [...messages],
        isPruned: false,
        originalTurnCount: totalTurns,
        retainedTurnCount: totalTurns,
        prunedTurnCount: 0,
        originalTokens,
        retainedTokens: originalTokens,
        omittedTokensEstimated: 0,
      };
    }
  }

  // 1. Initial slice to retain latest maxTurns
  const retainedTurns = turns.slice(Math.max(0, totalTurns - maxTurns));
  const prunedTurns = turns.slice(0, Math.max(0, totalTurns - maxTurns));

  // 2. If token ceiling specified and still exceeded, drop additional older turns (keep at least 1 turn)
  if (maxTokens && maxTokens > 0) {
    const anchorTokens = anchors.reduce((sum, m) => sum + estimateChatMessageTokens(m), 0);
    while (retainedTurns.length > 1) {
      const retainedTurnTokens = retainedTurns.reduce((sum, t) => sum + t.tokens, 0);
      if (anchorTokens + retainedTurnTokens <= maxTokens) {
        break;
      }
      const dropped = retainedTurns.shift();
      if (dropped) {
        prunedTurns.push(dropped);
      }
    }
  }

  const prunedTurnCount = prunedTurns.length;
  if (prunedTurnCount === 0) {
    return {
      messages: [...messages],
      isPruned: false,
      originalTurnCount: totalTurns,
      retainedTurnCount: retainedTurns.length,
      prunedTurnCount: 0,
      originalTokens,
      retainedTokens: originalTokens,
      omittedTokensEstimated: 0,
    };
  }

  const omittedTokensEstimated = prunedTurns.reduce((sum, t) => sum + t.tokens, 0);

  // 3. Inject deterministic prompt-caching friendly tombstone
  const tombstoneText =
    `[Context Pruning Guard: Retained Initial System & Task Goal, plus the latest ${retainedTurns.length} interaction turns. ` +
    `Pruned ${prunedTurnCount} earlier intermediate turns (approx. ${omittedTokensEstimated.toLocaleString()} tokens) ` +
    `to maintain focus and prevent context window blowout. All critical prior findings are reflected in the latest state.]`;

  const tombstoneMessage: ChatMessage = {
    role: 'user',
    content: tombstoneText,
  };

  const prunedMessages: ChatMessage[] = [
    ...anchors,
    tombstoneMessage,
    ...retainedTurns.flatMap((t) => t.messages),
  ];

  const retainedTokens = prunedMessages.reduce((sum, m) => sum + estimateChatMessageTokens(m), 0);

  return {
    messages: prunedMessages,
    isPruned: true,
    originalTurnCount: totalTurns,
    retainedTurnCount: retainedTurns.length,
    prunedTurnCount,
    originalTokens,
    retainedTokens,
    omittedTokensEstimated,
  };
}
