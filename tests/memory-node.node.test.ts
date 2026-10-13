/**
 * @file    tests/memory-node.node.test.ts
 * @version 1.0.0
 * @description
 *   Unit and integration tests for Phase 4.20 Part A:
 *   MemoryNode Visual Canvas Memory Primitive & Resumption Contracts.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BrowserWorkflowEngine } from '../src/engine/browser-engine.ts';
import { validateGraphTopology } from '../src/engine/topological-sort.ts';
import { getDefaultNodeConfig, getDefaultNodeLabel } from '../src/engine/types.ts';
import type {
  WorkflowNode,
  WorkflowEdge,
  MemoryNodeConfig,
  MemoryNodeOutput,
} from '../src/engine/types.ts';
import type {
  ISessionStorageAdapter,
  SessionData,
  MemoryMessage,
} from '../src/services/storage/session-storage.ts';

/**
 * In-memory mock session storage adapter for isolated testbench assertions.
 */
class MockSessionStorageAdapter implements ISessionStorageAdapter {
  private store = new Map<string, SessionData>();

  private buildKey(workflowId: string, sessionId = 'default'): string {
    return `${workflowId}::${sessionId}`;
  }

  public setDirectData(workflowId: string, sessionId: string, data: SessionData): void {
    this.store.set(this.buildKey(workflowId, sessionId), data);
  }

  async getSessionData(workflowId: string, sessionId = 'default'): Promise<SessionData> {
    const key = this.buildKey(workflowId, sessionId);
    return (
      this.store.get(key) || {
        sessionKey: key,
        messages: [],
        updatedAt: Date.now(),
      }
    );
  }

  async getSessionMessages(workflowId: string, sessionId = 'default'): Promise<MemoryMessage[]> {
    const data = await this.getSessionData(workflowId, sessionId);
    return data.messages;
  }

  async saveSessionMessages(
    workflowId: string,
    messages: MemoryMessage[],
    sessionId = 'default',
  ): Promise<void> {
    const key = this.buildKey(workflowId, sessionId);
    const existing = await this.getSessionData(workflowId, sessionId);
    this.store.set(key, { ...existing, messages, updatedAt: Date.now() });
  }

  async saveSessionSummary(
    workflowId: string,
    summary: SessionData['summary'],
    sessionId = 'default',
  ): Promise<void> {
    const key = this.buildKey(workflowId, sessionId);
    const existing = await this.getSessionData(workflowId, sessionId);
    this.store.set(key, { ...existing, summary, updatedAt: Date.now() });
  }

  async updateSessionMessage(): Promise<void> {}
  async deleteSessionMessage(): Promise<void> {}
  async appendSessionMessage(): Promise<void> {}
  async clearSessionMessages(): Promise<void> {}
}

describe('Phase 4.20 Part A: MemoryNode Visual Canvas Memory Primitive', () => {
  it('1. Default Node Config and Label Factory contracts', () => {
    const config = getDefaultNodeConfig('memory') as MemoryNodeConfig;
    assert.deepStrictEqual(config.include, {
      summary: true,
      recentWindow: true,
      pinned: true,
    });
    assert.strictEqual(config.recentRounds, 5);
    assert.strictEqual(config.maxTokens, 0);
    assert.strictEqual(config.format, 'text');

    const label = getDefaultNodeLabel('memory');
    assert.strictEqual(label, 'Conversation Memory');
  });

  it('2. L4 Never-Throw & Fallback: execution without sessionKey outputs no_session', async () => {
    const engine = new BrowserWorkflowEngine();

    const memoryNode: WorkflowNode = {
      id: 'mem_1',
      type: 'memory',
      position: { x: 0, y: 0 },
      data: {
        label: 'Memory',
        type: 'memory',
        config: {
          include: { summary: true, recentWindow: true, pinned: true },
          recentRounds: 5,
          maxTokens: 0,
          format: 'text',
        },
      },
    };

    const promptNode: WorkflowNode = {
      id: 'prompt_1',
      type: 'prompt',
      position: { x: 200, y: 0 },
      data: {
        label: 'Prompt',
        type: 'prompt',
        inputs: {
          template: 'History: [{{mem_1.history}}] Status: [{{mem_1.meta.session_status}}]',
        },
      },
    };

    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'mem_1', target: 'prompt_1', sourceHandle: 'output', targetHandle: 'input' },
    ];

    const outputs: Record<string, unknown> = {};
    for await (const evt of engine.executeWorkflow(
      { nodes: [memoryNode, promptNode], edges },
      {
        skipLLM: true,
        // Notice: sessionKey is NOT provided (canvas run)
      },
    )) {
      if (evt.type === 'NODE_COMPLETE') {
        outputs[evt.payload.nodeId] = evt.payload.output;
      }
    }

    const memOutput = outputs['mem_1'] as MemoryNodeOutput;
    assert.ok(memOutput, 'Memory node should complete successfully');
    assert.strictEqual(memOutput.summary, '');
    assert.strictEqual(memOutput.history, '');
    assert.strictEqual(memOutput.pinned, '');
    assert.deepStrictEqual(memOutput.meta, {
      session_status: 'no_session',
      rounds: 0,
      tokens: 0,
      truncated: false,
    });

    const promptOutput = outputs['prompt_1'] as { promptText: string };
    assert.ok(promptOutput.promptText.includes('History: [] Status: [no_session]'));
  });

  it('3. Empty session: outputs empty status when session has 0 messages and no summary', async () => {
    const mockStorage = new MockSessionStorageAdapter();
    const engine = new BrowserWorkflowEngine();

    const memoryNode: WorkflowNode = {
      id: 'mem_1',
      type: 'memory',
      position: { x: 0, y: 0 },
      data: {
        label: 'Memory',
        type: 'memory',
        config: {
          include: { summary: true, recentWindow: true, pinned: true },
          recentRounds: 5,
          maxTokens: 0,
          format: 'text',
        },
      },
    };

    const outputs: Record<string, unknown> = {};
    for await (const evt of engine.executeWorkflow(
      { nodes: [memoryNode], edges: [] },
      {
        sessionKey: 'wf-empty::default',
        workflowId: 'wf-empty',
        context: {
          sessionStorage: mockStorage,
        },
      },
    )) {
      if (evt.type === 'NODE_COMPLETE') {
        outputs[evt.payload.nodeId] = evt.payload.output;
      }
    }

    const memOutput = outputs['mem_1'] as MemoryNodeOutput;
    assert.ok(memOutput);
    assert.strictEqual(memOutput.meta.session_status, 'empty');
    assert.strictEqual(memOutput.summary, '');
    assert.strictEqual(memOutput.history, '');
    assert.strictEqual(memOutput.pinned, '');
    assert.strictEqual(memOutput.meta.rounds, 0);
  });

  it('4. Active session: extracts summary, recent window, and pinned messages correctly in text format', async () => {
    const mockStorage = new MockSessionStorageAdapter();
    const engine = new BrowserWorkflowEngine();

    const testMessages: MemoryMessage[] = [
      { id: 'm1', role: 'user', content: 'What is PatchCat?', timestamp: 1000 },
      { id: 'm2', role: 'assistant', content: 'PatchCat is a deterministic AI workflow engine.', timestamp: 1001 },
      { id: 'm3', role: 'user', content: 'Remember this pinned rule: keep code clean.', timestamp: 1002, isPinned: true },
      { id: 'm4', role: 'user', content: 'Can we run local embeddings?', timestamp: 1003 },
      { id: 'm5', role: 'assistant', content: 'Yes, via SiliconFlow and Ollama.', timestamp: 1004 },
    ];

    mockStorage.setDirectData('wf-active', 'default', {
      sessionKey: 'wf-active::default',
      messages: testMessages,
      summary: {
        text: 'The user is building a deterministic AI workflow engine called PatchCat.',
        lastSummarizedMessageId: 'm2',
        summarizedCount: 2,
        tokenCount: 15,
        updatedAt: 1002,
      },
      updatedAt: 1005,
    });

    const memoryNode: WorkflowNode = {
      id: 'mem_1',
      type: 'memory',
      position: { x: 0, y: 0 },
      data: {
        label: 'Memory',
        type: 'memory',
        config: {
          include: { summary: true, recentWindow: true, pinned: true },
          recentRounds: 5,
          maxTokens: 0,
          format: 'text',
        },
      },
    };

    const outputs: Record<string, unknown> = {};
    for await (const evt of engine.executeWorkflow(
      { nodes: [memoryNode], edges: [] },
      {
        sessionKey: 'wf-active',
        workflowId: 'wf-active',
        context: {
          sessionStorage: mockStorage,
        },
      },
    )) {
      if (evt.type === 'NODE_COMPLETE') {
        outputs[evt.payload.nodeId] = evt.payload.output;
      }
    }

    const memOutput = outputs['mem_1'] as MemoryNodeOutput;
    assert.ok(memOutput);
    assert.strictEqual(memOutput.meta.session_status, 'active');
    assert.strictEqual(
      memOutput.summary,
      'The user is building a deterministic AI workflow engine called PatchCat.',
    );
    assert.ok(typeof memOutput.history === 'string');
    assert.ok(memOutput.history.includes('What is PatchCat?'));
    assert.ok(memOutput.history.includes('Can we run local embeddings?'));
    assert.ok(memOutput.pinned.includes('keep code clean'));
    assert.strictEqual(memOutput.meta.truncated, false);
    assert.ok(memOutput.meta.tokens > 0);
  });

  it('5. Messages format: emits ChatML message array when format is messages', async () => {
    const mockStorage = new MockSessionStorageAdapter();
    const engine = new BrowserWorkflowEngine();

    const testMessages: MemoryMessage[] = [
      { id: 'm1', role: 'user', content: 'Turn 1', timestamp: 1000 },
      { id: 'm2', role: 'assistant', content: 'Reply 1', timestamp: 1001 },
    ];

    mockStorage.setDirectData('wf-chatml', 'default', {
      sessionKey: 'wf-chatml::default',
      messages: testMessages,
      updatedAt: 1002,
    });

    const memoryNode: WorkflowNode = {
      id: 'mem_1',
      type: 'memory',
      position: { x: 0, y: 0 },
      data: {
        label: 'Memory',
        type: 'memory',
        config: {
          include: { summary: false, recentWindow: true, pinned: false },
          recentRounds: 5,
          maxTokens: 0,
          format: 'messages',
        },
      },
    };

    const outputs: Record<string, unknown> = {};
    for await (const evt of engine.executeWorkflow(
      { nodes: [memoryNode], edges: [] },
      {
        sessionKey: 'wf-chatml',
        context: { sessionStorage: mockStorage },
      },
    )) {
      if (evt.type === 'NODE_COMPLETE') {
        outputs[evt.payload.nodeId] = evt.payload.output;
      }
    }

    const memOutput = outputs['mem_1'] as MemoryNodeOutput;
    assert.ok(Array.isArray(memOutput.history));
    assert.strictEqual(memOutput.history.length, 2);
    assert.strictEqual((memOutput.history[0] as MemoryMessage).content, 'Turn 1');
  });

  it('6. Truncation and window bounds: recentRounds trims older unpinned turns and sets truncated flag', async () => {
    const mockStorage = new MockSessionStorageAdapter();
    const engine = new BrowserWorkflowEngine();

    // 4 rounds of conversation = 8 unpinned messages
    const testMessages: MemoryMessage[] = [
      { id: 'm1', role: 'user', content: 'Round 1 Q', timestamp: 1000 },
      { id: 'm2', role: 'assistant', content: 'Round 1 A', timestamp: 1001 },
      { id: 'm3', role: 'user', content: 'Round 2 Q', timestamp: 1002 },
      { id: 'm4', role: 'assistant', content: 'Round 2 A', timestamp: 1003 },
      { id: 'm5', role: 'user', content: 'Round 3 Q', timestamp: 1004 },
      { id: 'm6', role: 'assistant', content: 'Round 3 A', timestamp: 1005 },
      { id: 'm7', role: 'user', content: 'Round 4 Q', timestamp: 1006 },
      { id: 'm8', role: 'assistant', content: 'Round 4 A', timestamp: 1007 },
    ];

    mockStorage.setDirectData('wf-rounds', 'default', {
      sessionKey: 'wf-rounds::default',
      messages: testMessages,
      updatedAt: 1008,
    });

    // Request only recent 2 rounds (4 messages)
    const memoryNode: WorkflowNode = {
      id: 'mem_1',
      type: 'memory',
      position: { x: 0, y: 0 },
      data: {
        label: 'Memory',
        type: 'memory',
        config: {
          include: { summary: false, recentWindow: true, pinned: false },
          recentRounds: 2,
          maxTokens: 0,
          format: 'text',
        },
      },
    };

    const outputs: Record<string, unknown> = {};
    for await (const evt of engine.executeWorkflow(
      { nodes: [memoryNode], edges: [] },
      {
        sessionKey: 'wf-rounds',
        context: { sessionStorage: mockStorage },
      },
    )) {
      if (evt.type === 'NODE_COMPLETE') {
        outputs[evt.payload.nodeId] = evt.payload.output;
      }
    }

    const memOutput = outputs['mem_1'] as MemoryNodeOutput;
    assert.strictEqual(memOutput.meta.truncated, true);
    assert.strictEqual(memOutput.meta.rounds, 2);
    // Should contain Round 3 and Round 4, but not Round 1
    assert.ok(!String(memOutput.history).includes('Round 1 Q'));
    assert.ok(String(memOutput.history).includes('Round 3 Q'));
    assert.ok(String(memOutput.history).includes('Round 4 Q'));
  });

  it('7. SubWorkflow scope isolation: MemoryNode inside sub-workflow evaluates to no_session', async () => {
    const mockStorage = new MockSessionStorageAdapter();
    const engine = new BrowserWorkflowEngine();

    // Session exists for parent workflow
    mockStorage.setDirectData('wf-parent', 'default', {
      sessionKey: 'wf-parent::default',
      messages: [
        { id: 'm1', role: 'user', content: 'Parent secret', timestamp: 1000 },
      ],
      updatedAt: 1001,
    });

    // Sub-graph with a MemoryNode and an OutputNode
    const subMemoryNode: WorkflowNode = {
      id: 'sub_mem',
      type: 'memory',
      position: { x: 0, y: 0 },
      data: {
        label: 'Sub Memory',
        type: 'memory',
        config: {
          include: { summary: true, recentWindow: true, pinned: true },
          recentRounds: 5,
          maxTokens: 0,
          format: 'text',
        },
      },
    };

    const subOutputNode: WorkflowNode = {
      id: 'sub_out',
      type: 'output',
      position: { x: 200, y: 0 },
      data: {
        label: 'Sub Out',
        type: 'output',
        config: { format: 'markdown' },
        inputs: {
          result: '{{sub_mem.meta.session_status}}',
        },
      },
    };

    const subEdges: WorkflowEdge[] = [
      { id: 'sub_e1', source: 'sub_mem', target: 'sub_out', sourceHandle: 'output', targetHandle: 'input' },
    ];

    const parentSubWorkflowNode: WorkflowNode = {
      id: 'subwf_1',
      type: 'sub_workflow',
      position: { x: 100, y: 0 },
      data: {
        label: 'Sub Workflow Node',
        type: 'sub_workflow',
        config: {
          targetWorkflowId: 'child_wf',
        },
      },
    };

    const outputs: Record<string, unknown> = {};
    for await (const evt of engine.executeWorkflow(
      { nodes: [parentSubWorkflowNode], edges: [] },
      {
        sessionKey: 'wf-parent',
        workflowId: 'wf-parent',
        context: {
          sessionStorage: mockStorage,
          subWorkflows: {
            child_wf: {
              nodes: [subMemoryNode, subOutputNode],
              edges: subEdges,
            },
          },
        },
      },
    )) {
      if (evt.type === 'NODE_COMPLETE') {
        outputs[evt.payload.nodeId] = evt.payload.output;
      }
    }

    const subWfOutput = outputs['subwf_1'] as Record<string, unknown>;
    assert.ok(subWfOutput);
    // Sub-workflow MemoryNode had no sessionKey passed and must evaluate strictly to no_session
    const subMemOutput = subWfOutput['sub_mem'] as MemoryNodeOutput | undefined;
    assert.ok(subMemOutput, 'sub_mem output should be present in sub-workflow outputs');
    assert.strictEqual(subMemOutput.meta.session_status, 'no_session');
  });

  it('8. Resumption non-cacheable contract: MemoryNode re-executes upon resumeFromExisting instead of reusing cache', async () => {
    const mockStorage = new MockSessionStorageAdapter();
    const engine = new BrowserWorkflowEngine();

    // Initial session with Turn 1
    mockStorage.setDirectData('wf-resume', 'default', {
      sessionKey: 'wf-resume::default',
      messages: [{ id: 'm1', role: 'user', content: 'Turn 1 initial', timestamp: 1000 }],
      updatedAt: 1000,
    });

    const memoryNode: WorkflowNode = {
      id: 'mem_1',
      type: 'memory',
      position: { x: 0, y: 0 },
      data: {
        label: 'Memory',
        type: 'memory',
        status: 'success', // Simulates previously cached success status on canvas
        outputs: {
          history: 'Old stale cached turn',
          meta: { session_status: 'active', rounds: 1, tokens: 10, truncated: false },
        },
        config: {
          include: { summary: false, recentWindow: true, pinned: false },
          recentRounds: 5,
          maxTokens: 0,
          format: 'text',
        },
      },
    };

    // Update storage with newer turn before resume
    mockStorage.setDirectData('wf-resume', 'default', {
      sessionKey: 'wf-resume::default',
      messages: [{ id: 'm2', role: 'user', content: 'Turn 2 updated live', timestamp: 2000 }],
      updatedAt: 2000,
    });

    const outputs: Record<string, unknown> = {};
    for await (const evt of engine.executeWorkflow(
      { nodes: [memoryNode], edges: [] },
      {
        sessionKey: 'wf-resume',
        resumeFromExisting: true, // Resume mode enabled!
        context: { sessionStorage: mockStorage },
      },
    )) {
      if (evt.type === 'NODE_COMPLETE') {
        outputs[evt.payload.nodeId] = evt.payload.output;
      }
    }

    const memOutput = outputs['mem_1'] as MemoryNodeOutput;
    // Must NOT reuse 'Old stale cached turn'
    assert.ok(!String(memOutput.history).includes('Old stale cached turn'));
    assert.ok(String(memOutput.history).includes('Turn 2 updated live'));
  });

  it('9. Preflight topological validation: warns when all retrieval channels are disabled', () => {
    const invalidMemoryNode: WorkflowNode = {
      id: 'mem_disabled',
      type: 'memory',
      position: { x: 0, y: 0 },
      data: {
        label: 'Disabled Memory',
        type: 'memory',
        config: {
          include: { summary: false, recentWindow: false, pinned: false },
          recentRounds: 5,
          maxTokens: 0,
          format: 'text',
        },
      },
    };

    const result = validateGraphTopology({
      nodes: [invalidMemoryNode],
      edges: [],
    });

    assert.strictEqual(result.valid, true);
    assert.ok(
      result.warnings &&
        result.warnings.some((w) =>
          w.includes('has all retrieval sources disabled (summary, recentWindow, pinned)'),
        ),
      `Expected preflight warning for all-disabled memory node, got warnings: ${JSON.stringify(result.warnings)}`,
    );
  });
});
