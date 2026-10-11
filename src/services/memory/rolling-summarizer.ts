/**
 * @file    src/services/memory/rolling-summarizer.ts
 * @version 1.0.0
 * @description
 *   Dual-Anchor Rolling Summary Engine for PatchCat Long-Term Conversation Memory (PRD-010 Phase 4.18).
 *   Combines background incremental summarization of older dialogue turns with verbatim sliding-window retention.
 *   Provides zero-throw deterministic fallbacks, token telemetry tracking, and context injection helpers.
 */

import {
  type MemoryMessage,
  type SessionSummary,
  type MemoryPruningOptions,
  estimateMessageTokens,
  formatMessagesToPlainText,
  formatDualAnchorConversation,
  pruneConversationMessages,
} from '../storage/session-storage.ts';

export interface RollingSummaryOptions {
  enabled?: boolean;
  /**
   * Number of unsummarized dialogue rounds that trigger background summarization.
   * Default: 5 rounds (10 messages).
   */
  thresholdRounds?: number;
  /**
   * Maximum target token budget for the generated summary.
   * Default: 500 tokens.
   */
  maxSummaryTokens?: number;
  /**
   * Recent uncompressed window to keep verbatim (in rounds).
   * Default: 3 rounds (6 messages). Older messages beyond this window get rolled into summary.
   */
  recentWindowRounds?: number;
}

export interface SummarizationPartition {
  alreadySummarizedMessages: MemoryMessage[];
  messagesToSummarize: MemoryMessage[];
  recentWindowMessages: MemoryMessage[];
  hasTriggerThreshold: boolean;
}

export interface MemoryTelemetry {
  totalMessagesCount: number;
  pinnedMessagesCount: number;
  summarizedMessagesCount: number;
  activeWindowMessagesCount: number;
  summaryTokens: number;
  pinnedTokens: number;
  activeTokens: number;
  totalTokens: number;
  budgetLimit: number;
  budgetUsageRatio: number;
  isSummarized: boolean;
  status: 'empty' | 'active' | 'summarized' | 'warning_near_budget' | 'budget_exceeded';
}

export const DEFAULT_ROLLING_SUMMARY_OPTIONS: Required<RollingSummaryOptions> = {
  enabled: true,
  thresholdRounds: 5,
  maxSummaryTokens: 500,
  recentWindowRounds: 3,
};

/**
 * Partitions dialogue messages into:
 * 1. alreadySummarized: Messages prior to or including current summary's lastSummarizedMessageId.
 * 2. messagesToSummarize: Unsummarized messages older than the recent verbatim window.
 * 3. recentWindowMessages: Messages within the recent window (kept verbatim in prompt).
 */
export function partitionMessagesForSummarization(
  messages: MemoryMessage[],
  summary?: SessionSummary,
  options: RollingSummaryOptions = {},
): SummarizationPartition {
  if (!messages || messages.length === 0) {
    return {
      alreadySummarizedMessages: [],
      messagesToSummarize: [],
      recentWindowMessages: [],
      hasTriggerThreshold: false,
    };
  }

  const thresholdRounds = options.thresholdRounds ?? DEFAULT_ROLLING_SUMMARY_OPTIONS.thresholdRounds;
  const recentWindowRounds =
    options.recentWindowRounds ?? DEFAULT_ROLLING_SUMMARY_OPTIONS.recentWindowRounds;
  const recentWindowMessagesCount = Math.max(2, recentWindowRounds * 2);

  let unsummarizedMessages = [...messages];
  const alreadySummarizedMessages: MemoryMessage[] = [];

  if (summary && summary.lastSummarizedMessageId) {
    const lastIndex = messages.findIndex((m) => m.id === summary.lastSummarizedMessageId);
    if (lastIndex !== -1) {
      alreadySummarizedMessages.push(...messages.slice(0, lastIndex + 1));
      unsummarizedMessages = messages.slice(lastIndex + 1);
    }
  }

  // If unsummarized count is within the recent window, no candidates need compression yet
  if (unsummarizedMessages.length <= recentWindowMessagesCount) {
    return {
      alreadySummarizedMessages,
      messagesToSummarize: [],
      recentWindowMessages: unsummarizedMessages,
      hasTriggerThreshold: false,
    };
  }

  // The newest recentWindowMessagesCount messages stay in recent window
  const splitPoint = unsummarizedMessages.length - recentWindowMessagesCount;
  const messagesToSummarize = unsummarizedMessages.slice(0, splitPoint);
  const recentWindowMessages = unsummarizedMessages.slice(splitPoint);

  // Trigger threshold is met when candidates reach or exceed threshold rounds (2 messages per round)
  const hasTriggerThreshold = messagesToSummarize.length >= thresholdRounds * 2;

  return {
    alreadySummarizedMessages,
    messagesToSummarize,
    recentWindowMessages,
    hasTriggerThreshold,
  };
}

/**
 * Deterministic offline rule-based summarizer fallback.
 * Guarantees zero runtime throws, offline compliance, and stable fact extraction
 * without external network dependency or LLM API key requirement.
 */
export function generateDeterministicSummaryFallback(
  messages: MemoryMessage[],
  previousSummaryText?: string,
): string {
  if (!messages || messages.length === 0) {
    return previousSummaryText?.trim() || '';
  }

  const extractedPoints: string[] = [];

  for (const msg of messages) {
    const content = msg.content.trim();
    if (!content) continue;

    const lines = content.split('\n');
    const firstLine = (lines[0] || '').trim();
    const cleanSnippet = firstLine.length > 90 ? `${firstLine.slice(0, 87)}...` : firstLine;

    if (msg.role === 'user') {
      extractedPoints.push(`- [User Query]: ${cleanSnippet}`);
    } else if (msg.role === 'assistant') {
      if (msg.metadata?.error) {
        extractedPoints.push(`- [Assistant Error]: Encountered ${msg.metadata.error}`);
      } else {
        extractedPoints.push(`- [Assistant Response]: ${cleanSnippet}`);
      }
    }
  }

  const newPointsText = extractedPoints.join('\n');

  if (previousSummaryText && previousSummaryText.trim()) {
    return `${previousSummaryText.trim()}\n${newPointsText}`;
  }

  return `### Executive Context Summary\n${newPointsText}`;
}

export interface RollingSummarySynthesisParams {
  messages: MemoryMessage[];
  currentSummary?: SessionSummary;
  options?: RollingSummaryOptions;
  llmCaller?: (prompt: string) => Promise<string>;
}

/**
 * Synthesizes an updated SessionSummary from conversation history.
 * Seamlessly leverages LLM completion when provided, with instant zero-throw
 * fallback to deterministic heuristics.
 */
export async function synthesizeRollingSummary(
  params: RollingSummarySynthesisParams,
): Promise<SessionSummary> {
  const { messages, currentSummary, options = {}, llmCaller } = params;
  const partition = partitionMessagesForSummarization(messages, currentSummary, options);

  const messagesToCompress = partition.messagesToSummarize;

  if (messagesToCompress.length === 0) {
    if (currentSummary) return currentSummary;
    return {
      text: '',
      lastSummarizedMessageId: '',
      summarizedCount: 0,
      tokenCount: 0,
      updatedAt: Date.now(),
    };
  }

  const lastMsg = messagesToCompress[messagesToCompress.length - 1];
  const lastSummarizedMessageId = lastMsg?.id || '';
  const totalSummarizedCount =
    (currentSummary?.summarizedCount ?? 0) + messagesToCompress.length;

  let summaryText = '';

  if (llmCaller) {
    try {
      const turnsText = formatMessagesToPlainText(messagesToCompress);
      const prompt = `You are a conversation memory summarizer for PatchCat DAG Engine.
Synthesize an updated, concise, factual Executive Summary combining the [Existing Summary] and [New Conversation Turns].

[Existing Summary]
${currentSummary?.text?.trim() || 'None.'}

[New Conversation Turns to Integrate]
${turnsText}

Guidelines:
- Output a structured markdown bulleted summary.
- Retain all core user instructions, requirements, key decisions, variable configurations, and results.
- Eliminate conversational filler and greetings.`;

      const response = await llmCaller(prompt);
      if (response && response.trim()) {
        summaryText = response.trim();
      }
    } catch (err) {
      console.warn('[RollingSummarizer] LLM summarization call failed, using fallback:', err);
    }
  }

  if (!summaryText) {
    summaryText = generateDeterministicSummaryFallback(messagesToCompress, currentSummary?.text);
  }

  const tokenCount = estimateMessageTokens(summaryText);

  return {
    text: summaryText,
    lastSummarizedMessageId,
    summarizedCount: totalSummarizedCount,
    tokenCount,
    updatedAt: Date.now(),
  };
}

/**
 * Computes fine-grained conversation memory telemetry for inspection and progress bars.
 */
export function computeMemoryTelemetry(params: {
  messages: MemoryMessage[];
  summary?: SessionSummary;
  budgetLimit?: number;
  recentWindowRounds?: number;
}): MemoryTelemetry {
  const { messages = [], summary, budgetLimit = 3000, recentWindowRounds = 3 } = params;

  const totalMessagesCount = messages.length;
  let pinnedMessagesCount = 0;
  let pinnedTokens = 0;

  for (const m of messages) {
    if (m.isPinned) {
      pinnedMessagesCount++;
      pinnedTokens += m.metadata?.tokenCount ?? estimateMessageTokens(m.content);
    }
  }

  const partition = partitionMessagesForSummarization(messages, summary, { recentWindowRounds });
  const activeWindowMessagesCount = partition.recentWindowMessages.length;
  const activeTokens = partition.recentWindowMessages.reduce(
    (acc, m) => acc + (m.metadata?.tokenCount ?? estimateMessageTokens(m.content)),
    0,
  );

  const summaryTokens = summary ? summary.tokenCount : 0;
  const totalTokens = summaryTokens + pinnedTokens + activeTokens;
  const budgetUsageRatio = budgetLimit > 0 ? Math.min(1, totalTokens / budgetLimit) : 0;
  const isSummarized = Boolean(summary && summary.text && summary.summarizedCount > 0);

  let status: MemoryTelemetry['status'] = 'active';
  if (totalMessagesCount === 0) {
    status = 'empty';
  } else if (budgetLimit > 0 && totalTokens > budgetLimit) {
    status = 'budget_exceeded';
  } else if (budgetLimit > 0 && budgetUsageRatio >= 0.8) {
    status = 'warning_near_budget';
  } else if (isSummarized) {
    status = 'summarized';
  }

  return {
    totalMessagesCount,
    pinnedMessagesCount,
    summarizedMessagesCount: summary?.summarizedCount ?? 0,
    activeWindowMessagesCount,
    summaryTokens,
    pinnedTokens,
    activeTokens,
    totalTokens,
    budgetLimit,
    budgetUsageRatio,
    isSummarized,
    status,
  };
}

/**
 * Builds runtime variable injection bags for DAG workflows:
 * - chat_summary: high-density executive summary
 * - chat_history: verbatim recent conversation turns
 * - conversation_history / history: dual-anchor combined view
 */
export function buildContextInjectionBag(params: {
  messages: MemoryMessage[];
  summary?: SessionSummary;
  options?: MemoryPruningOptions & RollingSummaryOptions;
}): {
  chat_summary: string;
  chat_history: string;
  conversation_history: string;
  history: string;
  telemetry: MemoryTelemetry;
} {
  const { messages = [], summary, options = {} } = params;

  const budgetLimit = options.maxTokenBudget ?? 3000;
  const recentWindowRounds = options.recentWindowRounds ?? 3;

  // Prune recent window if needed
  const prunedRecent = pruneConversationMessages(messages, {
    maxHistoryRounds: options.maxHistoryRounds ?? 5,
    maxTokenBudget: budgetLimit,
    pruningStrategy: options.pruningStrategy ?? 'hybrid',
    preservePinned: options.preservePinned ?? true,
  });

  const chat_summary = summary?.text?.trim() || '';
  const chat_history = formatMessagesToPlainText(prunedRecent);
  const dualAnchorFull = formatDualAnchorConversation(chat_summary, prunedRecent);

  const telemetry = computeMemoryTelemetry({
    messages,
    summary,
    budgetLimit,
    recentWindowRounds,
  });

  return {
    chat_summary,
    chat_history,
    conversation_history: dualAnchorFull,
    history: dualAnchorFull,
    telemetry,
  };
}
