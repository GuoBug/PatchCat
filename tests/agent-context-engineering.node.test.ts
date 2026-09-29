/**
 * @file    tests/agent-context-engineering.node.test.ts
 * @description
 *   Unit test suite for PatchCat Module 2: Context Engineering (Layer 0 & Layer 1).
 *   Validates:
 *     1. Layer 0 Context Observability (BPE token estimation, role breakdowns, model context limits)
 *     2. Layer 1 Tool Result Clamping & Safe Offloading (Head-Tail preservation, omission banners)
 *     3. ContextTracker lifecycle (pre-call snapshots, post-call reconciliation, warning thresholds)
 *     4. BrowserWorkflowEngine Agent node E2E integration with context metrics output
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateTextTokens,
  estimateChatMessageTokens,
  estimateContextBreakdown,
  resolveModelContextLimit,
  clampToolResult,
  ContextTracker,
  extractAgentTurns,
  applySlidingWindowPruning,
} from '../src/engine/context-manager.ts';
import { BrowserWorkflowEngine } from '../src/engine/browser-engine.ts';
import { getDefaultNodeConfig } from '../src/engine/types.ts';
import type { WorkflowNode, ChatMessage, AgentNodeConfig, ExecutionEvent } from '../src/engine/types.ts';
import { RUNTIME_DEFAULTS } from '../src/config/runtime-defaults.ts';

async function collectEvents(generator: AsyncGenerator<ExecutionEvent>): Promise<ExecutionEvent[]> {
  const events: ExecutionEvent[] = [];
  for await (const ev of generator) {
    events.push(ev);
  }
  return events;
}

function makeAgentNode(
  id: string,
  inputs: Record<string, unknown> = {},
  config: Partial<AgentNodeConfig> = {},
): WorkflowNode {
  return {
    id,
    type: 'agent',
    position: { x: 0, y: 0 },
    data: {
      label: id,
      type: 'agent',
      status: 'idle',
      inputs,
      outputs: {},
      config: { ...getDefaultNodeConfig('agent'), ...config },
    },
  };
}

describe('Module 2: Context Engineering (Layer 0 Observability & Layer 1 Tool Clamping)', () => {
  describe('1. Layer 0: High-Precision Token Estimation & Role Breakdown', () => {
    it('estimates zero tokens for empty, null, or undefined strings', () => {
      assert.strictEqual(estimateTextTokens(''), 0);
      assert.strictEqual(estimateTextTokens(null), 0);
      assert.strictEqual(estimateTextTokens(undefined), 0);
    });

    it('estimates English ASCII text using ~3.7 chars/token heuristic', () => {
      const text = 'Hello world! This is a standard prompt engineering test sentence.';
      const tokens = estimateTextTokens(text);
      assert.ok(tokens > 10 && tokens < 25, `Expected 10-25 tokens, got ${tokens}`);
    });

    it('estimates CJK text using ~1.25 tokens/char heuristic', () => {
      const cjk = '这是一个针对大语言模型上下文工程的真实自动化测试用例'; // 25 CJK chars
      const tokens = estimateTextTokens(cjk);
      // 25 * 1.25 = ~32 tokens
      assert.ok(tokens >= 25 && tokens <= 40, `Expected 25-40 tokens for CJK, got ${tokens}`);
    });

    it('estimates mixed English, digits, and CJK text accurately', () => {
      const mixed = '订单号 ORD-998877 在 2026-09-29 遭遇物流延迟，请立即启动退款流程。';
      const tokens = estimateTextTokens(mixed);
      assert.ok(tokens >= 20 && tokens <= 45, `Expected 20-45 tokens, got ${tokens}`);
    });

    it('estimates structured ChatMessage with tool calls and role framing', () => {
      const msg: ChatMessage = {
        role: 'assistant',
        content: 'I will check order status now.',
        tool_calls: [
          {
            id: 'call_123',
            type: 'function',
            function: {
              name: 'query_order',
              arguments: JSON.stringify({ orderId: 'ORD-123456' }),
            },
          },
        ],
      };

      const tokens = estimateChatMessageTokens(msg);
      assert.ok(tokens > 15, `Expected frame + content + tool calls > 15 tokens, got ${tokens}`);
    });

    it('computes accurate role-by-role context breakdown for a multi-turn array', () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are an intelligent order assistant.' },
        { role: 'user', content: 'Check status for ORD-001 and ORD-002.' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'tc_1',
              type: 'function',
              function: { name: 'fetch_order', arguments: '{"id":"ORD-001"}' },
            },
          ],
        },
        { role: 'tool', tool_call_id: 'tc_1', content: '{"status":"shipped","carrier":"SF"}' },
      ];

      const breakdown = estimateContextBreakdown(messages);
      assert.strictEqual(breakdown.messageCount, 4);
      assert.strictEqual(breakdown.byRole.system.count, 1);
      assert.strictEqual(breakdown.byRole.user.count, 1);
      assert.strictEqual(breakdown.byRole.assistant.count, 1);
      assert.strictEqual(breakdown.byRole.tool.count, 1);

      assert.ok(breakdown.systemTokens > 0);
      assert.ok(breakdown.userTokens > 0);
      assert.ok(breakdown.assistantTokens > 0);
      assert.ok(breakdown.toolTokens > 0);
      assert.strictEqual(
        breakdown.totalEstimatedTokens,
        breakdown.systemTokens + breakdown.userTokens + breakdown.assistantTokens + breakdown.toolTokens,
      );
    });
  });

  describe('2. Layer 0: Model Context Window Capacity Resolution', () => {
    it('resolves exact context window limits for known model families', () => {
      assert.strictEqual(resolveModelContextLimit('gemini-2.5-flash'), 1048576);
      assert.strictEqual(resolveModelContextLimit('gemini-1.5-pro'), 1048576);
      assert.strictEqual(resolveModelContextLimit('gpt-4o'), 128000);
      assert.strictEqual(resolveModelContextLimit('gpt-4o-mini'), 128000);
      assert.strictEqual(resolveModelContextLimit('deepseek-chat'), 64000);
      assert.strictEqual(resolveModelContextLimit('deepseek-r1'), 64000);
      assert.strictEqual(resolveModelContextLimit('Qwen/Qwen2.5-7B-Instruct'), 32768);
      assert.strictEqual(resolveModelContextLimit('meta-llama/llama-3.1-70b-instruct'), 128000);
    });

    it('falls back to safe default limit for unrecognized or custom models', () => {
      assert.strictEqual(
        resolveModelContextLimit('custom-local-finetune-v1'),
        RUNTIME_DEFAULTS.DEFAULT_CONTEXT_WINDOW_LIMIT,
      );
      assert.strictEqual(
        resolveModelContextLimit(undefined),
        RUNTIME_DEFAULTS.DEFAULT_CONTEXT_WINDOW_LIMIT,
      );
    });
  });

  describe('3. Layer 1: Tool Result Clamping & Head-Tail Safe Offloading', () => {
    it('preserves exact byte fidelity when tool output is within maxChars limit', () => {
      const normalOutput = JSON.stringify({ status: 'ok', items: [1, 2, 3] });
      const result = clampToolResult(normalOutput, { maxChars: 1000 });

      assert.strictEqual(result.isClamped, false);
      assert.strictEqual(result.content, normalOutput);
      assert.strictEqual(result.originalChars, normalOutput.length);
      assert.strictEqual(result.clampedChars, normalOutput.length);
      assert.strictEqual(result.omittedChars, 0);
    });

    it('clamps huge tool output with Head-Tail preservation and sentinel banner', () => {
      const head = 'HEAD_DATA_START: ' + 'A'.repeat(500);
      const middle = 'MIDDLE_EXCESSIVE_BLOWOUT_DATA: ' + 'X'.repeat(8000);
      const tail = 'TAIL_DATA_END: conclusion_code_success_999';
      const hugeOutput = `${head}\n${middle}\n${tail}`;

      const result = clampToolResult(hugeOutput, {
        maxChars: 1000,
        headRatio: 0.6,
        tailRatio: 0.4,
        toolName: 'api_fetcher',
      });

      assert.strictEqual(result.isClamped, true);
      assert.ok(result.originalChars > 8000);
      assert.ok(result.clampedChars < result.originalChars);
      assert.ok(result.omittedChars > 7000);
      assert.ok(result.omittedTokensEstimated > 1000);

      // Verify head and tail preserved
      assert.ok(result.content.startsWith('HEAD_DATA_START:'));
      assert.ok(result.content.endsWith('conclusion_code_success_999'));

      // Verify sentinel banner injected
      assert.ok(result.content.includes('[... Truncated'));
      assert.ok(result.content.includes('PatchCat Context Guard'));
      assert.ok(result.content.includes('Tool: "api_fetcher"'));
      assert.ok(result.content.includes('Head (600 chars) and Tail (400 chars) preserved'));
    });

    it('safely handles empty or null tool outputs', () => {
      const emptyRes = clampToolResult('', { maxChars: 500 });
      assert.strictEqual(emptyRes.isClamped, false);
      assert.strictEqual(emptyRes.content, '');
    });
  });

  describe('4. Layer 0: ContextTracker Lifecycle & Utilization Warnings', () => {
    it('tracks per-iteration metrics and trips warning when utilization exceeds threshold', () => {
      // 1000 token limit with 75% warning threshold -> warning at >= 750 tokens
      const tracker = new ContextTracker(1000, 0.75);

      // Iteration 1: Small messages (~100 tokens)
      const iter1Messages: ChatMessage[] = [
        { role: 'system', content: 'Short system instructions.' },
        { role: 'user', content: 'First query.' },
      ];
      const m1 = tracker.recordPreCall(1, iter1Messages);
      assert.strictEqual(m1.iteration, 1);
      assert.strictEqual(m1.warning, false);

      // Iteration 2: Accumulated massive tool output (>750 tokens)
      const iter2Messages: ChatMessage[] = [
        ...iter1Messages,
        { role: 'assistant', content: 'Running tool query...' },
        { role: 'tool', tool_call_id: 't1', content: '长文本内容 '.repeat(200) }, // ~800 tokens
      ];
      const m2 = tracker.recordPreCall(2, iter2Messages);
      assert.strictEqual(m2.iteration, 2);
      assert.strictEqual(m2.warning, true);
      assert.ok(m2.warningReason?.includes('Context utilization reached'));

      // Post-call provider reconciliation
      tracker.recordPostCall(820);
      const metrics = tracker.getAllMetrics();
      assert.strictEqual(metrics[1].actualPromptTokens, 820);
      assert.strictEqual(tracker.getPeakEstimatedTokens(), m2.estimatedPromptTokens);
    });
  });

  describe('5. BrowserWorkflowEngine Agent Node Integration (E2E)', () => {
    it('outputs contextMetrics and context limits in validation mode', async () => {
      const agentNode = makeAgentNode('agent_ctx_1', {
        prompt: 'Analyze system telemetry logs.',
      }, {
        systemPrompt: 'You are a telemetry analyst.',
        maxIterations: 5,
        maxContextTokens: 16000,
        maxToolResultChars: 2000,
      });

      const engine = new BrowserWorkflowEngine();
      const events = await collectEvents(
        engine.executeWorkflow(
          { nodes: [agentNode], edges: [] },
          { skipLLM: true }
        )
      );

      const completeEv = events.find((e) => e.type === 'NODE_COMPLETE' && (e.payload as any).nodeId === 'agent_ctx_1');
      assert.ok(completeEv, 'Node complete event must exist');

      const output = (completeEv.payload as any).output;
      assert.ok(Array.isArray(output.contextMetrics), 'contextMetrics must be an array');
      assert.strictEqual(output.contextMetrics.length, 1);
      assert.strictEqual(output.maxContextTokens, 16000);
      assert.ok(typeof output.peakContextTokens === 'number');
      assert.strictEqual(output.clampedToolCallsCount, 0);

      const firstMetric = output.contextMetrics[0];
      assert.strictEqual(firstMetric.iteration, 1);
      assert.ok(firstMetric.breakdown.systemTokens > 0);
      assert.ok(firstMetric.breakdown.userTokens > 0);
      assert.strictEqual(firstMetric.contextLimit, 16000);
    });
  });

  describe('6. Layer 2: extractAgentTurns & Atomic Turn Integrity', () => {
    it('extracts immutable dual anchors (system + first user goal) at the prefix', () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'You are an intelligent order analyst.' },
        { role: 'user', content: 'Find order #1001 details.' },
        {
          role: 'assistant',
          content: 'Checking order status...',
          tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'fetch_order', arguments: '{"id":"1001"}' } }],
        },
        { role: 'tool', tool_call_id: 'call_1', content: '{"status":"shipped"}' },
        { role: 'assistant', content: 'Order #1001 is shipped.' },
      ];

      const { anchors, turns } = extractAgentTurns(messages);

      assert.strictEqual(anchors.length, 2);
      assert.strictEqual(anchors[0]?.role, 'system');
      assert.strictEqual(anchors[0]?.content, 'You are an intelligent order analyst.');
      assert.strictEqual(anchors[1]?.role, 'user');
      assert.strictEqual(anchors[1]?.content, 'Find order #1001 details.');

      assert.strictEqual(turns.length, 2);
      assert.strictEqual(turns[0]?.turnId, 1);
      assert.strictEqual(turns[0]?.messages.length, 2); // assistant + tool observation
      assert.strictEqual(turns[0]?.messages[0]?.role, 'assistant');
      assert.strictEqual(turns[0]?.messages[1]?.role, 'tool');

      assert.strictEqual(turns[1]?.turnId, 2);
      assert.strictEqual(turns[1]?.messages.length, 1);
      assert.strictEqual(turns[1]?.messages[0]?.role, 'assistant');
    });

    it('groups assistant message with multiple tool calls and multiple tool responses into a single atomic turn', () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'System instructions' },
        { role: 'user', content: 'Compare prices' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            { id: 'c1', type: 'function', function: { name: 'vendor_a', arguments: '{}' } },
            { id: 'c2', type: 'function', function: { name: 'vendor_b', arguments: '{}' } },
          ],
        },
        { role: 'tool', tool_call_id: 'c1', content: '{"price":100}' },
        { role: 'tool', tool_call_id: 'c2', content: '{"price":95}' },
      ];

      const { anchors, turns } = extractAgentTurns(messages);

      assert.strictEqual(anchors.length, 2);
      assert.strictEqual(turns.length, 1);
      assert.strictEqual(turns[0]?.turnId, 1);
      assert.strictEqual(turns[0]?.messages.length, 3);
      assert.strictEqual(turns[0]?.messages[0]?.role, 'assistant');
      assert.strictEqual(turns[0]?.messages[1]?.role, 'tool');
      assert.strictEqual(turns[0]?.messages[2]?.role, 'tool');
      assert.ok((turns[0]?.tokens ?? 0) > 0);
    });

    it('preserves atomic turn boundaries with conversational turns without tools', () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'System instructions' },
        { role: 'user', content: 'Initial user query' },
        { role: 'assistant', content: 'Please clarify parameter X' },
        { role: 'user', content: 'Parameter X is 42' },
        { role: 'assistant', content: 'Final resolution reached' },
      ];

      const { anchors, turns } = extractAgentTurns(messages);

      assert.strictEqual(anchors.length, 2);
      assert.strictEqual(turns.length, 3);
      assert.strictEqual(turns[0]?.turnId, 1);
      assert.strictEqual(turns[0]?.messages[0]?.content, 'Please clarify parameter X');
      assert.strictEqual(turns[1]?.turnId, 2);
      assert.strictEqual(turns[1]?.messages[0]?.content, 'Parameter X is 42');
      assert.strictEqual(turns[2]?.turnId, 3);
      assert.strictEqual(turns[2]?.messages[0]?.content, 'Final resolution reached');
    });

    it('handles boundary edge cases: empty array, only system, only user, no system anchor', () => {
      const emptyRes = extractAgentTurns([]);
      assert.deepStrictEqual(emptyRes.anchors, []);
      assert.deepStrictEqual(emptyRes.turns, []);

      const onlySys = extractAgentTurns([{ role: 'system', content: 'Sys' }]);
      assert.strictEqual(onlySys.anchors.length, 1);
      assert.strictEqual(onlySys.turns.length, 0);

      const onlyUser = extractAgentTurns([{ role: 'user', content: 'Goal' }]);
      assert.strictEqual(onlyUser.anchors.length, 1);
      assert.strictEqual(onlyUser.turns.length, 0);

      const noSys = extractAgentTurns([
        { role: 'user', content: 'Goal' },
        { role: 'assistant', content: 'Resp' },
      ]);
      assert.strictEqual(noSys.anchors.length, 1);
      assert.strictEqual(noSys.anchors[0]?.role, 'user');
      assert.strictEqual(noSys.turns.length, 1);
    });
  });

  describe('7. Layer 2: applySlidingWindowPruning & Dual Anchor Sliding Window', () => {
    it('returns untouched messages when turn count is <= maxTurns and tokens <= maxTokens', () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'System instructions' },
        { role: 'user', content: 'User goal' },
        { role: 'assistant', content: 'Turn 1 assistant' },
        { role: 'user', content: 'Turn 2 user feedback' },
      ];

      const result = applySlidingWindowPruning(messages, { maxTurns: 4 });

      assert.strictEqual(result.isPruned, false);
      assert.strictEqual(result.originalTurnCount, 2);
      assert.strictEqual(result.retainedTurnCount, 2);
      assert.strictEqual(result.prunedTurnCount, 0);
      assert.strictEqual(result.messages.length, messages.length);
    });

    it('prunes intermediate turns while strictly preserving dual anchors (system + user goal) at the prefix', () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'CRITICAL SYSTEM PROMPT' },
        { role: 'user', content: 'ORIGINAL USER GOAL' },
        // Turn 1
        {
          role: 'assistant',
          content: 'Step 1',
          tool_calls: [{ id: 'tc1', type: 'function', function: { name: 'f1', arguments: '{}' } }],
        },
        { role: 'tool', tool_call_id: 'tc1', content: 'r1' },
        // Turn 2
        {
          role: 'assistant',
          content: 'Step 2',
          tool_calls: [{ id: 'tc2', type: 'function', function: { name: 'f2', arguments: '{}' } }],
        },
        { role: 'tool', tool_call_id: 'tc2', content: 'r2' },
        // Turn 3
        {
          role: 'assistant',
          content: 'Step 3',
          tool_calls: [{ id: 'tc3', type: 'function', function: { name: 'f3', arguments: '{}' } }],
        },
        { role: 'tool', tool_call_id: 'tc3', content: 'r3' },
        // Turn 4
        {
          role: 'assistant',
          content: 'Step 4',
          tool_calls: [{ id: 'tc4', type: 'function', function: { name: 'f4', arguments: '{}' } }],
        },
        { role: 'tool', tool_call_id: 'tc4', content: 'r4' },
        // Turn 5
        { role: 'assistant', content: 'Final response ready.' },
      ];

      // Prune keeping max 2 turns
      const result = applySlidingWindowPruning(messages, { maxTurns: 2 });

      assert.strictEqual(result.isPruned, true);
      assert.strictEqual(result.originalTurnCount, 5);
      assert.strictEqual(result.retainedTurnCount, 2);
      assert.strictEqual(result.prunedTurnCount, 3);
      assert.ok(result.omittedTokensEstimated > 0);

      // Verify Dual Anchors strictly preserved at index 0 and 1
      assert.strictEqual(result.messages[0]?.role, 'system');
      assert.strictEqual(result.messages[0]?.content, 'CRITICAL SYSTEM PROMPT');
      assert.strictEqual(result.messages[1]?.role, 'user');
      assert.strictEqual(result.messages[1]?.content, 'ORIGINAL USER GOAL');

      // Verify Tombstone injected at index 2
      const tombstone = result.messages[2];
      assert.ok(tombstone, 'Tombstone message must exist at index 2');
      assert.strictEqual(tombstone.role, 'user');
      assert.ok(tombstone.content?.includes('Context Pruning Guard'));
      assert.ok(tombstone.content?.includes('Retained Initial System & Task Goal, plus the latest 2 interaction turns'));
      assert.ok(tombstone.content?.includes('Pruned 3 earlier intermediate turns'));

      // Verify Retained Turns (Turn 4 & Turn 5)
      assert.strictEqual(result.messages[3]?.role, 'assistant');
      assert.strictEqual(result.messages[3]?.content, 'Step 4');
      assert.strictEqual(result.messages[4]?.role, 'tool');
      assert.strictEqual(result.messages[4]?.tool_call_id, 'tc4');
      assert.strictEqual(result.messages[5]?.role, 'assistant');
      assert.strictEqual(result.messages[5]?.content, 'Final response ready.');
      assert.strictEqual(result.messages.length, 6);
    });

    it('never fragments assistant tool calls and observations when pruning', () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'System' },
        { role: 'user', content: 'Goal' },
        // Turn 1
        {
          role: 'assistant',
          content: null,
          tool_calls: [{ id: 'call_a', type: 'function', function: { name: 'tool_a', arguments: '{}' } }],
        },
        { role: 'tool', tool_call_id: 'call_a', content: 'Observation A' },
        // Turn 2
        {
          role: 'assistant',
          content: null,
          tool_calls: [{ id: 'call_b', type: 'function', function: { name: 'tool_b', arguments: '{}' } }],
        },
        { role: 'tool', tool_call_id: 'call_b', content: 'Observation B' },
        // Turn 3
        { role: 'assistant', content: 'Done.' },
      ];

      const result = applySlidingWindowPruning(messages, { maxTurns: 1 });

      assert.strictEqual(result.isPruned, true);
      assert.strictEqual(result.retainedTurnCount, 1);
      assert.strictEqual(result.prunedTurnCount, 2);

      // Verify no orphan tool messages exist in the pruned messages
      const remainingTools = result.messages.filter((m) => m.role === 'tool');
      assert.strictEqual(remainingTools.length, 0);

      // Only Turn 3 assistant message remains after anchors and tombstone
      assert.strictEqual(result.messages[3]?.role, 'assistant');
      assert.strictEqual(result.messages[3]?.content, 'Done.');
    });

    it('enforces token ceiling by dropping additional older turns beyond maxTurns', () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User goal' },
        // Turn 1 (~100 tokens)
        { role: 'assistant', content: 'Detailed analysis step 1 with lots of data points: ' + 'data_point_'.repeat(30) },
        // Turn 2 (~100 tokens)
        { role: 'assistant', content: 'Detailed analysis step 2 with lots of data points: ' + 'data_point_'.repeat(30) },
        // Turn 3 (~100 tokens)
        { role: 'assistant', content: 'Detailed analysis step 3 with lots of data points: ' + 'data_point_'.repeat(30) },
      ];

      // maxTurns is 3 (all 3 turns would fit turn window), but maxTokens ceiling is 180 tokens
      const result = applySlidingWindowPruning(messages, { maxTurns: 3, maxTokens: 180 });

      assert.strictEqual(result.isPruned, true);
      assert.ok(result.retainedTurnCount < 3);
      assert.ok(result.prunedTurnCount >= 1);
      assert.ok(result.retainedTokens < result.originalTokens);
    });

    it('preserves at least 1 recent turn even under extreme token pressure', () => {
      const messages: ChatMessage[] = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User goal' },
        { role: 'assistant', content: 'Long answer 1: ' + 'X'.repeat(500) },
        { role: 'assistant', content: 'Long answer 2: ' + 'Y'.repeat(500) },
      ];

      // Extreme token limit: 5 tokens
      const result = applySlidingWindowPruning(messages, { maxTurns: 2, maxTokens: 5 });

      assert.strictEqual(result.isPruned, true);
      assert.strictEqual(result.retainedTurnCount, 1);
      assert.strictEqual(result.messages[result.messages.length - 1]?.content, 'Long answer 2: ' + 'Y'.repeat(500));
    });
  });

  describe('8. Layer 2: ContextTracker Pruning Tracking & Token Savings Metrics', () => {
    it('tracks pruning events and calculates total tokens saved across multiple iterations', () => {
      const tracker = new ContextTracker(2000, 0.75);

      const msgs: ChatMessage[] = [
        { role: 'system', content: 'Sys' },
        { role: 'user', content: 'Goal' },
      ];

      tracker.recordPreCall(1, msgs);
      assert.strictEqual(tracker.getTotalTokensSavedByPruning(), 0);

      // Iteration 2: Pruning event of 2 turns saving 450 tokens
      tracker.recordPreCall(2, msgs);
      tracker.recordPrune(2, 450);

      // Iteration 3: Pruning event of 1 turn saving 220 tokens
      tracker.recordPreCall(3, msgs);
      tracker.recordPrune(1, 220);

      const all = tracker.getAllMetrics();
      assert.strictEqual(all.length, 3);
      assert.strictEqual(all[1]?.isPruned, true);
      assert.strictEqual(all[1]?.prunedTurnsCount, 2);
      assert.strictEqual(all[1]?.tokensSavedByPruning, 450);

      assert.strictEqual(all[2]?.isPruned, true);
      assert.strictEqual(all[2]?.prunedTurnsCount, 1);
      assert.strictEqual(all[2]?.tokensSavedByPruning, 220);

      assert.strictEqual(tracker.getTotalTokensSavedByPruning(), 670);
    });
  });

  describe('9. Layer 2: BrowserWorkflowEngine Agent Node Integration (E2E with sliding window pruning)', () => {
    it('verifies default agent configuration includes maxHistoryTurns and context defaults', () => {
      const cfg = getDefaultNodeConfig('agent') as AgentNodeConfig;
      assert.strictEqual(cfg.maxHistoryTurns, RUNTIME_DEFAULTS.AGENT_MAX_HISTORY_TURNS);
      assert.strictEqual(cfg.maxToolResultChars, RUNTIME_DEFAULTS.TOOL_RESULT_MAX_CHARS);
      assert.strictEqual(cfg.maxContextTokens, 0);
    });

    it('exposes totalTokensSavedByPruning in agent node completion output (validation mode)', async () => {
      const agentNode = makeAgentNode('agent_ctx_defaults', {
        prompt: 'Task description',
      });

      const engine = new BrowserWorkflowEngine();
      const events = await collectEvents(
        engine.executeWorkflow(
          { nodes: [agentNode], edges: [] },
          { skipLLM: true }
        )
      );

      const completeEv = events.find(
        (e) => e.type === 'NODE_COMPLETE' && (e.payload as any).nodeId === 'agent_ctx_defaults'
      );
      assert.ok(completeEv);
      const output = (completeEv.payload as any).output;
      assert.strictEqual(output.totalTokensSavedByPruning, 0);
    });

    it('simulates a 4-iteration ReAct loop in BrowserWorkflowEngine with maxHistoryTurns=2, proving messages array stays bounded at O(K) and totalTokensSavedByPruning > 0', async () => {
      const agentNode = makeAgentNode(
        'agent_react_prune',
        { prompt: 'Run multi-step computation pipeline' },
        {
          systemPrompt: 'You are a multi-step calculation agent.',
          maxIterations: 6,
          maxHistoryTurns: 2, // Retain max 2 turns in sliding window
          tools: [
            {
              id: 'tool_calc',
              name: 'calculate',
              description: 'Math tool',
              type: 'builtin_code',
              implementation: 'return { val: (args.n || 0) * 10 };',
              schema: {},
            },
          ],
        }
      );

      function makeToolCallSse(callId: string, fnName: string, fnArgs: string): string[] {
        return [
          `data: {"choices":[{"delta":{"role":"assistant","tool_calls":[{"index":0,"id":"${callId}","type":"function","function":{"name":"${fnName}","arguments":""}}]}}]}\n\n`,
          `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":${JSON.stringify(fnArgs)}}}]}}]}\n\n`,
          `data: {"choices":[{"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":120,"completion_tokens":25,"total_tokens":145}}\n\n`,
          'data: [DONE]\n\n',
        ];
      }

      function makeTextSse(text: string): string[] {
        return [
          `data: {"choices":[{"delta":{"role":"assistant","content":${JSON.stringify(text)}}}]}\n\n`,
          `data: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":150,"completion_tokens":15,"total_tokens":165}}\n\n`,
          'data: [DONE]\n\n',
        ];
      }

      function createSseStream(chunks: string[]): ReadableStream<Uint8Array> {
        const encoder = new TextEncoder();
        return new ReadableStream({
          start(controller) {
            for (const chunk of chunks) {
              controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
          },
        });
      }

      const originalFetch = globalThis.fetch;
      let callCount = 0;

      globalThis.fetch = async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
        callCount++;
        let chunks: string[];
        if (callCount === 1) {
          chunks = makeToolCallSse('call_1', 'calculate', '{"n":1}');
        } else if (callCount === 2) {
          chunks = makeToolCallSse('call_2', 'calculate', '{"n":2}');
        } else if (callCount === 3) {
          chunks = makeToolCallSse('call_3', 'calculate', '{"n":3}');
        } else {
          chunks = makeTextSse('Pipeline computation complete. All 3 steps executed.');
        }

        return new Response(createSseStream(chunks), {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      };

      try {
        const engine = new BrowserWorkflowEngine();
        const events = await collectEvents(
          engine.executeWorkflow(
            { nodes: [agentNode], edges: [] },
            {
              context: {
                settings: {
                  hasKey: true,
                  baseUrl: 'https://api.deepseek.com',
                  apiKey: 'sk-test-mock-key',
                  provider: 'deepseek',
                  model: 'deepseek-chat',
                  availableModels: ['deepseek-chat'],
                },
              },
            }
          )
        );

        const completeEv = events.find(
          (e) => e.type === 'NODE_COMPLETE' && (e.payload as any).nodeId === 'agent_react_prune'
        );
        assert.ok(completeEv, 'Node complete event must exist');

        const output = (completeEv.payload as any).output;
        assert.strictEqual(callCount, 4, 'LLM must be invoked 4 times across ReAct loop');
        assert.strictEqual(output.iterations, 4);
        assert.ok(output.response.includes('Pipeline computation complete'));

        // Verify Layer 2 Context Pruning metrics
        assert.ok(output.totalTokensSavedByPruning > 0, `Expected totalTokensSavedByPruning > 0, got ${output.totalTokensSavedByPruning}`);
        const prunedMetrics = output.contextMetrics.filter((m: any) => m.isPruned);
        assert.ok(prunedMetrics.length > 0, 'At least one iteration must record context pruning');

        // Verify Dual Anchors strictly preserved in output messages
        const messages = output.messages as ChatMessage[];
        assert.strictEqual(messages[0]?.role, 'system');
        assert.strictEqual(messages[0]?.content, 'You are a multi-step calculation agent.');
        assert.strictEqual(messages[1]?.role, 'user');
        assert.strictEqual(messages[1]?.content, 'Run multi-step computation pipeline');

        // Verify tombstone was injected
        const tombstone = messages.find((m) => m.content?.includes('Context Pruned') || m.content?.includes('Context Pruning Guard'));
        assert.ok(tombstone, 'Tombstone message must be present in messages array');

        // Verify messages array is strictly bounded (O(K)) and didn't grow monotonically to 10+ messages
        // Without pruning: 2 anchors + 3 tool turns (6 msgs) + 1 final assistant msg = 9 msgs
        // With pruning (K=2): 2 anchors + 1 tombstone + 2 retained tool turns (4 msgs) + 1 final assistant = 8 msgs
        assert.ok(messages.length <= 8, `Messages length must be <= 8, got ${messages.length}`);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
