/**
 * @file    tests/rolling-summarizer.node.test.ts
 * @version 1.0.0
 * @description
 *   Unit and Contract test suite for Long-Term Conversation Memory & Dual-Anchor Rolling Summary (Phase 4.18):
 *   1. Summarization partitioning and trigger thresholds.
 *   2. Deterministic rule-based fallback summarization.
 *   3. End-to-end rolling summary synthesis with LLM mock & fallback.
 *   4. Memory telemetry accounting and progress statuses.
 *   5. Context injection bag generation.
 *   6. Pinned message locks across sliding window and token budget constraints.
 *   7. Session storage adapter item-level update, delete, summary persistence & backward compatibility.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  IndexedDBSessionAdapter,
  pruneConversationMessages,
  formatDualAnchorConversation,
  type MemoryMessage,
  type SessionSummary,
} from '../src/services/storage/session-storage.ts';
import {
  partitionMessagesForSummarization,
  generateDeterministicSummaryFallback,
  synthesizeRollingSummary,
  computeMemoryTelemetry,
  buildContextInjectionBag,
} from '../src/services/memory/rolling-summarizer.ts';

describe('Phase 4.18: Summarization Partitioning & Trigger Logic', () => {
  it('should return empty partition for empty message list', () => {
    const partition = partitionMessagesForSummarization([]);
    assert.deepEqual(partition.alreadySummarizedMessages, []);
    assert.deepEqual(partition.messagesToSummarize, []);
    assert.deepEqual(partition.recentWindowMessages, []);
    assert.equal(partition.hasTriggerThreshold, false);
  });

  it('should keep all messages in recent window when count is below recent window size', () => {
    const messages: MemoryMessage[] = [
      { id: '1', role: 'user', content: 'Q1', timestamp: 10 },
      { id: '2', role: 'assistant', content: 'A1', timestamp: 20 },
      { id: '3', role: 'user', content: 'Q2', timestamp: 30 },
      { id: '4', role: 'assistant', content: 'A2', timestamp: 40 },
    ];

    // Recent window default is 3 rounds = 6 messages. 4 messages is <= 6.
    const partition = partitionMessagesForSummarization(messages, undefined, {
      recentWindowRounds: 3,
      thresholdRounds: 4,
    });

    assert.equal(partition.alreadySummarizedMessages.length, 0);
    assert.equal(partition.messagesToSummarize.length, 0);
    assert.equal(partition.recentWindowMessages.length, 4);
    assert.equal(partition.hasTriggerThreshold, false);
  });

  it('should partition older messages into compression candidates and keep recent window verbatim', () => {
    // 8 rounds = 16 messages
    const messages: MemoryMessage[] = [];
    for (let i = 1; i <= 8; i++) {
      messages.push({ id: `u-${i}`, role: 'user', content: `Question ${i}`, timestamp: i * 10 });
      messages.push({ id: `a-${i}`, role: 'assistant', content: `Answer ${i}`, timestamp: i * 10 + 5 });
    }

    // Recent window: 2 rounds = 4 messages (u-7, a-7, u-8, a-8).
    // Candidates to summarize: 16 - 4 = 12 messages (u-1..a-6 = 6 rounds).
    // Threshold: 5 rounds = 10 messages. Since 12 >= 10, hasTriggerThreshold should be true!
    const partition = partitionMessagesForSummarization(messages, undefined, {
      recentWindowRounds: 2,
      thresholdRounds: 5,
    });

    assert.equal(partition.messagesToSummarize.length, 12);
    assert.equal(partition.recentWindowMessages.length, 4);
    assert.equal(partition.hasTriggerThreshold, true);
    assert.equal(partition.messagesToSummarize[0].id, 'u-1');
    assert.equal(partition.messagesToSummarize[11].id, 'a-6');
    assert.equal(partition.recentWindowMessages[0].id, 'u-7');
    assert.equal(partition.recentWindowMessages[3].id, 'a-8');
  });

  it('should exclude already summarized messages based on lastSummarizedMessageId', () => {
    const messages: MemoryMessage[] = [];
    for (let i = 1; i <= 10; i++) {
      messages.push({ id: `m-${i}`, role: 'user', content: `Message ${i}`, timestamp: i * 10 });
    }

    const currentSummary: SessionSummary = {
      text: 'Summary up to m-4',
      lastSummarizedMessageId: 'm-4',
      summarizedCount: 4,
      tokenCount: 20,
      updatedAt: 100,
    };

    // Messages m-1 to m-4 are already summarized.
    // Unsummarized: m-5 to m-10 (6 messages).
    // Recent window: 2 rounds = 4 messages (m-7 to m-10).
    // Candidates to summarize: m-5, m-6 (2 messages).
    const partition = partitionMessagesForSummarization(messages, currentSummary, {
      recentWindowRounds: 2,
      thresholdRounds: 3,
    });

    assert.equal(partition.alreadySummarizedMessages.length, 4);
    assert.equal(partition.messagesToSummarize.length, 2);
    assert.equal(partition.messagesToSummarize[0].id, 'm-5');
    assert.equal(partition.messagesToSummarize[1].id, 'm-6');
    assert.equal(partition.recentWindowMessages.length, 4);
    assert.equal(partition.hasTriggerThreshold, false); // 2 messages < 3 rounds * 2 = 6
  });
});

describe('Phase 4.18: Deterministic Rule-Based Fallback Summarization', () => {
  it('should extract structured bullets from user questions and assistant answers', () => {
    const messages: MemoryMessage[] = [
      { id: '1', role: 'user', content: 'How do I deploy with Docker?', timestamp: 10 },
      { id: '2', role: 'assistant', content: 'Run docker-compose up -d in the root folder.', timestamp: 20 },
      {
        id: '3',
        role: 'assistant',
        content: 'Failed to connect to database.',
        timestamp: 30,
        metadata: { error: 'ECONNREFUSED' },
      },
    ];

    const fallback = generateDeterministicSummaryFallback(messages);
    assert.match(fallback, /### Executive Context Summary/);
    assert.match(fallback, /\[User Query\]: How do I deploy with Docker\?/);
    assert.match(fallback, /\[Assistant Response\]: Run docker-compose up -d/);
    assert.match(fallback, /\[Assistant Error\]: Encountered ECONNREFUSED/);
  });

  it('should preserve and merge with previous summary text', () => {
    const prev = '### Prior Summary\n- User wants React Flow.';
    const messages: MemoryMessage[] = [
      { id: '1', role: 'user', content: 'Next question on DAG scheduling.', timestamp: 10 },
    ];

    const merged = generateDeterministicSummaryFallback(messages, prev);
    assert.match(merged, /User wants React Flow/);
    assert.match(merged, /Next question on DAG scheduling/);
  });
});

describe('Phase 4.18: Rolling Summary Synthesis Engine', () => {
  it('should use LLM caller when provided and return synthesized summary', async () => {
    const messages: MemoryMessage[] = [
      { id: '1', role: 'user', content: 'Project name is PatchCat.', timestamp: 10 },
      { id: '2', role: 'assistant', content: 'Acknowledged PatchCat.', timestamp: 20 },
      { id: '3', role: 'user', content: 'Add auth module.', timestamp: 30 },
      { id: '4', role: 'assistant', content: 'Auth module added.', timestamp: 40 },
      { id: '5', role: 'user', content: 'Recent Q1', timestamp: 50 },
      { id: '6', role: 'assistant', content: 'Recent A1', timestamp: 60 },
    ];

    let promptCaptured = '';
    const mockLlmCaller = async (prompt: string) => {
      promptCaptured = prompt;
      return '- Project: PatchCat\n- Auth: Module added';
    };

    const summary = await synthesizeRollingSummary({
      messages,
      options: { recentWindowRounds: 1 }, // Keep last 2 messages (5, 6) in recent window; compress 1..4
      llmCaller: mockLlmCaller,
    });

    assert.match(promptCaptured, /Project name is PatchCat/);
    assert.equal(summary.text, '- Project: PatchCat\n- Auth: Module added');
    assert.equal(summary.lastSummarizedMessageId, '4');
    assert.equal(summary.summarizedCount, 4);
    assert.ok(summary.tokenCount > 0);
  });

  it('should fall back gracefully to deterministic summary when LLM caller throws', async () => {
    const messages: MemoryMessage[] = [
      { id: '1', role: 'user', content: 'Critical system specification A', timestamp: 10 },
      { id: '2', role: 'assistant', content: 'Confirmed specification A', timestamp: 20 },
      { id: '3', role: 'user', content: 'Keep in recent window', timestamp: 30 },
      { id: '4', role: 'assistant', content: 'Recent response', timestamp: 40 },
    ];

    const failingCaller = async () => {
      throw new Error('503 Service Unavailable');
    };

    const summary = await synthesizeRollingSummary({
      messages,
      options: { recentWindowRounds: 1 },
      llmCaller: failingCaller,
    });

    assert.match(summary.text, /Critical system specification A/);
    assert.equal(summary.lastSummarizedMessageId, '2');
    assert.equal(summary.summarizedCount, 2);
  });
});

describe('Phase 4.18: Memory Telemetry Accounting', () => {
  it('should report correct breakdown and status for conversation states', () => {
    const emptyTelemetry = computeMemoryTelemetry({ messages: [] });
    assert.equal(emptyTelemetry.status, 'empty');
    assert.equal(emptyTelemetry.totalMessagesCount, 0);

    const messages: MemoryMessage[] = [
      { id: '1', role: 'user', content: 'Pinned constraint', timestamp: 10, isPinned: true },
      { id: '2', role: 'assistant', content: 'Acknowledged constraint', timestamp: 20 },
      { id: '3', role: 'user', content: 'Active query', timestamp: 30 },
      { id: '4', role: 'assistant', content: 'Active response', timestamp: 40 },
    ];

    const summary: SessionSummary = {
      text: 'Executive Summary',
      lastSummarizedMessageId: 'old',
      summarizedCount: 6,
      tokenCount: 150,
      updatedAt: 100,
    };

    const telemetry = computeMemoryTelemetry({
      messages,
      summary,
      budgetLimit: 3000,
      recentWindowRounds: 2,
    });

    assert.equal(telemetry.totalMessagesCount, 4);
    assert.equal(telemetry.pinnedMessagesCount, 1);
    assert.equal(telemetry.summarizedMessagesCount, 6);
    assert.equal(telemetry.summaryTokens, 150);
    assert.ok(telemetry.pinnedTokens > 0);
    assert.ok(telemetry.activeTokens > 0);
    assert.equal(telemetry.isSummarized, true);
    assert.equal(telemetry.status, 'summarized');
  });

  it('should flag warning_near_budget and budget_exceeded correctly', () => {
    const heavyMessages: MemoryMessage[] = [
      { id: '1', role: 'user', content: 'X'.repeat(4000), timestamp: 10 }, // ~1000 tokens
    ];

    const nearBudget = computeMemoryTelemetry({
      messages: heavyMessages,
      budgetLimit: 1200,
    });
    assert.equal(nearBudget.status, 'warning_near_budget');

    const exceeded = computeMemoryTelemetry({
      messages: heavyMessages,
      budgetLimit: 800,
    });
    assert.equal(exceeded.status, 'budget_exceeded');
  });
});

describe('Phase 4.18: Context Injection Bag & Dual-Anchor Formatter', () => {
  it('should format dual-anchor prompt cleanly with clear boundaries', () => {
    const summaryText = '- User requested Kahn topological sort.\n- Deadlock detector active.';
    const recent: MemoryMessage[] = [
      { id: '1', role: 'user', content: 'Show cycle detector test.', timestamp: 10 },
      { id: '2', role: 'assistant', content: 'Here is the test.', timestamp: 20 },
    ];

    const formatted = formatDualAnchorConversation(summaryText, recent);
    assert.match(formatted, /\[Previous Conversation Summary\]/);
    assert.match(formatted, /User requested Kahn topological sort/);
    assert.match(formatted, /\[Recent Conversation\]/);
    assert.match(formatted, /User: Show cycle detector test\./);
  });

  it('should build complete context injection bag for workflow variables', () => {
    const messages: MemoryMessage[] = [
      { id: '1', role: 'user', content: 'Hello', timestamp: 10 },
      { id: '2', role: 'assistant', content: 'Hi there', timestamp: 20 },
    ];
    const summary: SessionSummary = {
      text: 'Summary of past discussion',
      lastSummarizedMessageId: '0',
      summarizedCount: 2,
      tokenCount: 25,
      updatedAt: 10,
    };

    const bag = buildContextInjectionBag({
      messages,
      summary,
    });

    assert.equal(bag.chat_summary, 'Summary of past discussion');
    assert.match(bag.chat_history, /User: Hello/);
    assert.match(bag.conversation_history, /\[Previous Conversation Summary\]/);
    assert.match(bag.history, /\[Recent Conversation\]/);
    assert.equal(bag.telemetry.totalMessagesCount, 2);
  });
});

describe('Phase 4.18: Pinned Message Locks Across Pruning Constraints', () => {
  it('should preserve pinned messages even when sliding window drops unpinned messages', () => {
    const messages: MemoryMessage[] = [
      { id: 'p1', role: 'user', content: 'Crucial System Constraint', timestamp: 10, isPinned: true },
      { id: 'm1', role: 'user', content: 'Casual chat 1', timestamp: 20 },
      { id: 'm2', role: 'assistant', content: 'Casual chat 2', timestamp: 30 },
      { id: 'm3', role: 'user', content: 'Casual chat 3', timestamp: 40 },
      { id: 'm4', role: 'assistant', content: 'Casual chat 4', timestamp: 50 },
    ];

    // maxHistoryRounds: 1 = only keep latest 2 unpinned messages (m3, m4).
    // But p1 is pinned! It must remain in the output!
    const pruned = pruneConversationMessages(messages, {
      maxHistoryRounds: 1,
      pruningStrategy: 'window',
      preservePinned: true,
    });

    assert.equal(pruned.length, 3);
    assert.equal(pruned[0].id, 'p1');
    assert.equal(pruned[0].isPinned, true);
    assert.equal(pruned[1].id, 'm3');
    assert.equal(pruned[2].id, 'm4');
  });

  it('should preserve pinned messages even under aggressive token budget cutoff', () => {
    const messages: MemoryMessage[] = [
      {
        id: 'p1',
        role: 'user',
        content: 'Pinned Prompt Directive',
        timestamp: 10,
        isPinned: true,
        metadata: { tokenCount: 50 },
      },
      {
        id: 'm1',
        role: 'user',
        content: 'Heavy message 1',
        timestamp: 20,
        metadata: { tokenCount: 400 },
      },
      {
        id: 'm2',
        role: 'assistant',
        content: 'Heavy message 2',
        timestamp: 30,
        metadata: { tokenCount: 400 },
      },
      {
        id: 'm3',
        role: 'user',
        content: 'Recent small query',
        timestamp: 40,
        metadata: { tokenCount: 60 },
      },
    ];

    // Total budget: 150 tokens.
    // Pinned p1 consumes 50 tokens. Remaining budget for unpinned: 100 tokens.
    // Iterating backwards from newest unpinned:
    // m3 (60 <= 100) -> kept.
    // m2 (400 + 60 = 460 > 100) -> dropped.
    // m1 -> dropped.
    // Final result: p1 (pinned) and m3 (recent unpinned). Total: 2 messages.
    const pruned = pruneConversationMessages(messages, {
      maxTokenBudget: 150,
      pruningStrategy: 'token_budget',
      preservePinned: true,
    });

    assert.equal(pruned.length, 2);
    assert.equal(pruned[0].id, 'p1');
    assert.equal(pruned[1].id, 'm3');
  });
});

describe('Phase 4.18: Session Storage Adapter Item-Level Mutation & Summary Persistence', () => {
  let adapter: IndexedDBSessionAdapter;

  beforeEach(() => {
    adapter = new IndexedDBSessionAdapter();
  });

  it('should save and retrieve session summary alongside messages', async () => {
    const summary: SessionSummary = {
      text: 'Summary of sprint 1',
      lastSummarizedMessageId: 'msg-1',
      summarizedCount: 2,
      tokenCount: 45,
      updatedAt: 12345,
    };

    const messages: MemoryMessage[] = [
      { id: 'msg-1', role: 'user', content: 'Hello', timestamp: 1 },
      { id: 'msg-2', role: 'assistant', content: 'World', timestamp: 2 },
    ];

    await adapter.saveSessionMessages('wf-summary-test', messages);
    await adapter.saveSessionSummary('wf-summary-test', summary);

    const sessionData = await adapter.getSessionData('wf-summary-test');
    assert.equal(sessionData.messages.length, 2);
    assert.deepEqual(sessionData.summary, summary);

    // Existing getSessionMessages contract should continue to return messages array
    const retrievedMessages = await adapter.getSessionMessages('wf-summary-test');
    assert.equal(retrievedMessages.length, 2);
  });

  it('should update single message content and track isEdited / originalContent', async () => {
    const messages: MemoryMessage[] = [
      { id: 'm-1', role: 'user', content: 'Original typo content', timestamp: 1 },
    ];
    await adapter.saveSessionMessages('wf-edit-test', messages);

    await adapter.updateSessionMessage('wf-edit-test', 'm-1', {
      content: 'Corrected typo content',
    });

    const updated = await adapter.getSessionMessages('wf-edit-test');
    assert.equal(updated.length, 1);
    assert.equal(updated[0].content, 'Corrected typo content');
    assert.equal(updated[0].isEdited, true);
    assert.equal(updated[0].originalContent, 'Original typo content');
  });

  it('should delete a single message without clearing the whole session', async () => {
    const messages: MemoryMessage[] = [
      { id: 'del-1', role: 'user', content: 'Keep me', timestamp: 1 },
      { id: 'del-2', role: 'assistant', content: 'Delete me', timestamp: 2 },
      { id: 'del-3', role: 'user', content: 'Keep me too', timestamp: 3 },
    ];
    await adapter.saveSessionMessages('wf-delete-test', messages);

    await adapter.deleteSessionMessage('wf-delete-test', 'del-2');

    const remaining = await adapter.getSessionMessages('wf-delete-test');
    assert.equal(remaining.length, 2);
    assert.equal(remaining[0].id, 'del-1');
    assert.equal(remaining[1].id, 'del-3');
  });

  it('should handle clearing summary cleanly', async () => {
    const summary: SessionSummary = {
      text: 'To be cleared',
      lastSummarizedMessageId: '1',
      summarizedCount: 1,
      tokenCount: 10,
      updatedAt: 1,
    };
    await adapter.saveSessionSummary('wf-clear-summary', summary);
    assert.ok((await adapter.getSessionData('wf-clear-summary')).summary);

    await adapter.saveSessionSummary('wf-clear-summary', undefined);
    assert.equal((await adapter.getSessionData('wf-clear-summary')).summary, undefined);
  });
});
