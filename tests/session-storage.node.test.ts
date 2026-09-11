/**
 * @file    tests/session-storage.node.test.ts
 * @description
 *   Unit test suite for Session Storage Adapter and Conversation Memory Pruning:
 *   1. IndexedDBSessionAdapter fallback in Node.js / headless environments (CRUD).
 *   2. Multi-workflow session isolation.
 *   3. Token estimation and plain text formatting utilities.
 *   4. Pruning strategies: Sliding window rounds, token budget limit, and hybrid mode.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  IndexedDBSessionAdapter,
  estimateMessageTokens,
  pruneConversationMessages,
  formatMessagesToPlainText,
  type MemoryMessage,
} from '../src/services/storage/session-storage.ts';

describe('IndexedDBSessionAdapter & Storage Fallback', () => {
  let adapter: IndexedDBSessionAdapter;

  beforeEach(() => {
    adapter = new IndexedDBSessionAdapter();
  });

  it('should return empty array for non-existent session in in-memory fallback', async () => {
    const messages = await adapter.getSessionMessages('wf-non-existent');
    assert.deepEqual(messages, []);
  });

  it('should save and retrieve session messages correctly in in-memory fallback', async () => {
    const mockMessages: MemoryMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello, what is PatchCat?',
        timestamp: 1000,
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'PatchCat is a visual AI workflow orchestrator.',
        timestamp: 1005,
      },
    ];

    await adapter.saveSessionMessages('wf-1', mockMessages);
    const retrieved = await adapter.getSessionMessages('wf-1');
    assert.equal(retrieved.length, 2);
    assert.equal(retrieved[0].content, 'Hello, what is PatchCat?');
    assert.equal(retrieved[1].role, 'assistant');
  });

  it('should append session messages incrementally', async () => {
    const msg1: MemoryMessage = {
      id: 'm1',
      role: 'user',
      content: 'First question',
      timestamp: 100,
    };
    const msg2: MemoryMessage = {
      id: 'm2',
      role: 'assistant',
      content: 'First answer',
      timestamp: 200,
    };

    await adapter.saveSessionMessages('wf-append', [msg1]);
    await adapter.appendSessionMessage('wf-append', msg2);

    const messages = await adapter.getSessionMessages('wf-append');
    assert.equal(messages.length, 2);
    assert.equal(messages[1].id, 'm2');
  });

  it('should isolate sessions by workflowId and sessionId', async () => {
    const msgA: MemoryMessage = { id: 'a', role: 'user', content: 'Workflow A', timestamp: 1 };
    const msgB: MemoryMessage = { id: 'b', role: 'user', content: 'Workflow B', timestamp: 2 };

    await adapter.saveSessionMessages('wf-A', [msgA]);
    await adapter.saveSessionMessages('wf-B', [msgB]);

    const resA = await adapter.getSessionMessages('wf-A');
    const resB = await adapter.getSessionMessages('wf-B');

    assert.equal(resA.length, 1);
    assert.equal(resA[0].content, 'Workflow A');
    assert.equal(resB.length, 1);
    assert.equal(resB[0].content, 'Workflow B');
  });

  it('should clear session messages for specified workflow', async () => {
    const msg: MemoryMessage = { id: 'c1', role: 'user', content: 'To be cleared', timestamp: 10 };
    await adapter.saveSessionMessages('wf-clear', [msg]);
    assert.equal((await adapter.getSessionMessages('wf-clear')).length, 1);

    await adapter.clearSessionMessages('wf-clear');
    assert.equal((await adapter.getSessionMessages('wf-clear')).length, 0);
  });
});

describe('Conversation Memory Utilities & Pruning Strategies', () => {
  it('should estimate token counts accurately (~4 chars per token)', () => {
    assert.equal(estimateMessageTokens(''), 0);
    assert.equal(estimateMessageTokens('abcd'), 1);
    assert.equal(estimateMessageTokens('abcdefgh'), 2);
    assert.equal(estimateMessageTokens('1234567890'), 3);
  });

  it('should format messages to human-readable plain text', () => {
    const emptyResult = formatMessagesToPlainText([]);
    assert.equal(emptyResult, '');

    const messages: MemoryMessage[] = [
      { id: '1', role: 'user', content: 'Hi there', timestamp: 1 },
      { id: '2', role: 'assistant', content: 'Hello! How can I help?', timestamp: 2 },
    ];

    const formatted = formatMessagesToPlainText(messages);
    assert.equal(formatted, 'User: Hi there\nAssistant: Hello! How can I help?');
  });

  it('should prune messages using sliding window rounds (strategy: window)', () => {
    // 5 rounds = 10 messages
    const messages: MemoryMessage[] = [];
    for (let i = 1; i <= 5; i++) {
      messages.push({
        id: `u-${i}`,
        role: 'user',
        content: `Question ${i}`,
        timestamp: i * 10,
      });
      messages.push({
        id: `a-${i}`,
        role: 'assistant',
        content: `Answer ${i}`,
        timestamp: i * 10 + 5,
      });
    }

    // Limit to 2 rounds = 4 messages (Question 4, Answer 4, Question 5, Answer 5)
    const pruned = pruneConversationMessages(messages, {
      maxHistoryRounds: 2,
      pruningStrategy: 'window',
    });

    assert.equal(pruned.length, 4);
    assert.equal(pruned[0].content, 'Question 4');
    assert.equal(pruned[1].content, 'Answer 4');
    assert.equal(pruned[2].content, 'Question 5');
    assert.equal(pruned[3].content, 'Answer 5');
  });

  it('should prune messages using reverse token budget limit (strategy: token_budget)', () => {
    // Message 1: 100 tokens
    // Message 2: 200 tokens
    // Message 3: 300 tokens
    const messages: MemoryMessage[] = [
      {
        id: 'm1',
        role: 'user',
        content: 'A'.repeat(400), // 100 tokens
        timestamp: 1,
        metadata: { tokenCount: 100 },
      },
      {
        id: 'm2',
        role: 'assistant',
        content: 'B'.repeat(800), // 200 tokens
        timestamp: 2,
        metadata: { tokenCount: 200 },
      },
      {
        id: 'm3',
        role: 'user',
        content: 'C'.repeat(1200), // 300 tokens
        timestamp: 3,
        metadata: { tokenCount: 300 },
      },
    ];

    // Budget: 450 tokens.
    // Iterating backwards:
    // m3 (300 tokens, total: 300 <= 450) -> kept
    // m2 (200 tokens, total: 500 > 450) -> budget exceeded, stop!
    // Result should only contain [m3]
    const pruned = pruneConversationMessages(messages, {
      maxTokenBudget: 450,
      pruningStrategy: 'token_budget',
    });

    assert.equal(pruned.length, 1);
    assert.equal(pruned[0].id, 'm3');

    // Budget: 550 tokens.
    // m3 (300) + m2 (200) = 500 <= 550 -> kept
    // m1 (100) + 500 = 600 > 550 -> break
    // Result should contain [m2, m3]
    const pruned2 = pruneConversationMessages(messages, {
      maxTokenBudget: 550,
      pruningStrategy: 'token_budget',
    });

    assert.equal(pruned2.length, 2);
    assert.equal(pruned2[0].id, 'm2');
    assert.equal(pruned2[1].id, 'm3');
  });

  it('should prune messages using hybrid constraint (strategy: hybrid)', () => {
    // 4 rounds (8 messages), each 50 tokens
    const messages: MemoryMessage[] = [];
    for (let i = 1; i <= 4; i++) {
      messages.push({
        id: `u-${i}`,
        role: 'user',
        content: `Question ${i}`,
        timestamp: i * 10,
        metadata: { tokenCount: 50 },
      });
      messages.push({
        id: `a-${i}`,
        role: 'assistant',
        content: `Answer ${i}`,
        timestamp: i * 10 + 5,
        metadata: { tokenCount: 50 },
      });
    }

    // Step 1 window limit: 2 rounds = 4 messages (u-3, a-3, u-4, a-4), total tokens = 200
    // Step 2 token budget: 120 tokens.
    // Backwards: a-4 (50) + u-4 (50) = 100 <= 120. a-3 (50) -> 150 > 120 -> break.
    // Final result: [u-4, a-4]
    const pruned = pruneConversationMessages(messages, {
      maxHistoryRounds: 2,
      maxTokenBudget: 120,
      pruningStrategy: 'hybrid',
    });

    assert.equal(pruned.length, 2);
    assert.equal(pruned[0].id, 'u-4');
    assert.equal(pruned[1].id, 'a-4');
  });
});
