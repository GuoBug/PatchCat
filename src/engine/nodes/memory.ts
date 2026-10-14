/**
 * @file    src/engine/nodes/memory.ts
 * @version 1.0.0
 * @description
 *   MemoryNode executor (Phase 4.20 / PRD-020 Part A).
 *   Visual canvas memory primitive: strictly read-only retrieval from current session.
 *   Provides scoped rolling summary, recent dialog window, and pinned messages to downstream DAG nodes.
 */

import type { INodeExecutor, NodeExecContext } from './types.ts';
import type { MemoryNodeConfig, MemoryNodeOutput } from '../types.ts';
import {
  sessionStorageAdapter,
  formatMessagesToPlainText,
  estimateMessageTokens,
  type ISessionStorageAdapter,
  type MemoryMessage,
  type SessionData,
} from '../../services/storage/session-storage.ts';

export class MemoryNodeExecutor implements INodeExecutor {
  public readonly type = 'memory' as const;

  public async execute(ctx: NodeExecContext): Promise<Record<string, unknown>> {
    const config = (ctx.node.data?.config || {}) as Partial<MemoryNodeConfig>;

    const include = {
      summary: config.include?.summary ?? true,
      recentWindow: config.include?.recentWindow ?? true,
      pinned: config.include?.pinned ?? true,
    };

    const recentRounds =
      typeof config.recentRounds === 'number' && config.recentRounds > 0
        ? config.recentRounds
        : 5;
    const maxTokens =
      typeof config.maxTokens === 'number' && config.maxTokens > 0
        ? config.maxTokens
        : 0;
    const format = config.format === 'messages' ? 'messages' : 'text';

    // 1. Session Availability Guard (L4 Never-Throw Contract)
    // Canvas executions without session Key gracefully emit empty outputs and 'no_session' status.
    const rawSessionKey = ctx.options?.sessionKey?.trim();
    if (!rawSessionKey) {
      const output: MemoryNodeOutput = {
        summary: '',
        history: format === 'messages' ? [] : '',
        pinned: '',
        meta: {
          session_status: 'no_session',
          rounds: 0,
          tokens: 0,
          truncated: false,
        },
      };
      return output as unknown as Record<string, unknown>;
    }

    // 2. Resolve Session Storage Adapter (IoC Dependency Injection with default singleton fallback)
    const storage =
      (ctx.options?.context?.sessionStorage as ISessionStorageAdapter | undefined) ||
      sessionStorageAdapter;

    let wfId: string;
    let sessionId: string;
    if (rawSessionKey.includes('::')) {
      const parts = rawSessionKey.split('::');
      wfId = parts[0] || 'default';
      sessionId = parts[1] || 'default';
    } else {
      wfId = ctx.options?.workflowId || rawSessionKey;
      sessionId = 'default';
    }

    let sessionData: SessionData;
    try {
      sessionData = await storage.getSessionData(wfId, sessionId);
    } catch (err) {
      console.warn('[MemoryNodeExecutor] Error reading session storage:', err);
      const emptyOutput: MemoryNodeOutput = {
        summary: '',
        history: format === 'messages' ? [] : '',
        pinned: '',
        meta: {
          session_status: 'empty',
          rounds: 0,
          tokens: 0,
          truncated: false,
        },
      };
      return emptyOutput as unknown as Record<string, unknown>;
    }

    const allMessages: MemoryMessage[] = sessionData.messages || [];
    const hasSummaryText = Boolean(sessionData.summary?.text && sessionData.summary.text.trim().length > 0);

    // 3. Empty Session Guard
    if (allMessages.length === 0 && !hasSummaryText) {
      const emptyOutput: MemoryNodeOutput = {
        summary: '',
        history: format === 'messages' ? [] : '',
        pinned: '',
        meta: {
          session_status: 'empty',
          rounds: 0,
          tokens: 0,
          truncated: false,
        },
      };
      return emptyOutput as unknown as Record<string, unknown>;
    }

    // 4. Extract Summary
    const summaryText = include.summary && hasSummaryText ? sessionData.summary!.text.trim() : '';

    // 5. Extract Pinned Messages (Strictly independent and unclipped by window rounds)
    const pinnedMessages = allMessages.filter((m) => Boolean(m.isPinned));
    const pinnedText =
      include.pinned && pinnedMessages.length > 0 ? formatMessagesToPlainText(pinnedMessages) : '';

    // 6. Extract Recent Verbatim Window (Unpinned conversation messages)
    let windowMessages: MemoryMessage[] = [];
    let truncated = false;

    if (include.recentWindow) {
      const unpinnedMessages = allMessages.filter((m) => !m.isPinned);
      const maxMessages = Math.max(1, recentRounds * 2);

      if (unpinnedMessages.length > maxMessages) {
        truncated = true;
        windowMessages = unpinnedMessages.slice(unpinnedMessages.length - maxMessages);
      } else {
        windowMessages = [...unpinnedMessages];
      }

      // Token budget pruning (from oldest in window to newest)
      if (maxTokens > 0) {
        const summaryTokens = estimateMessageTokens(summaryText);
        const pinnedTokens = estimateMessageTokens(pinnedText);
        const overhead = summaryTokens + pinnedTokens;
        const availableBudget = Math.max(0, maxTokens - overhead);

        let curTokens = 0;
        const kept: MemoryMessage[] = [];

        for (let i = windowMessages.length - 1; i >= 0; i--) {
          const m = windowMessages[i];
          if (!m) continue;
          const mTok = m.metadata?.tokenCount ?? estimateMessageTokens(m.content);
          if (curTokens + mTok > availableBudget && kept.length > 0) {
            truncated = true;
            break;
          }
          kept.unshift(m);
          curTokens += mTok;
        }

        if (kept.length < windowMessages.length) {
          truncated = true;
        }
        windowMessages = kept;
      }
    }

    // 7. Format History (Text vs ChatML Messages)
    const history: string | MemoryMessage[] =
      format === 'messages' ? windowMessages : formatMessagesToPlainText(windowMessages);

    // 8. Compute Telemetry Meta
    const rounds = Math.ceil(windowMessages.length / 2);
    const historyTokens =
      format === 'messages'
        ? windowMessages.reduce(
            (sum, m) => sum + (m.metadata?.tokenCount ?? estimateMessageTokens(m.content)),
            0,
          )
        : estimateMessageTokens(history as string);
    const totalTokens = estimateMessageTokens(summaryText) + estimateMessageTokens(pinnedText) + historyTokens;

    const output: MemoryNodeOutput = {
      summary: summaryText,
      history,
      pinned: pinnedText,
      meta: {
        session_status: 'active',
        rounds,
        tokens: totalTokens,
        truncated,
      },
    };

    return output as unknown as Record<string, unknown>;
  }
}

export const memoryNodeExecutor = new MemoryNodeExecutor();
