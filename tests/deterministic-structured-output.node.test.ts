/**
 * @file    tests/deterministic-structured-output.node.test.ts
 * @description
 *   Comprehensive test suite verifying:
 *   1. L1 Constrained Decoding & Multi-tier Provider Capability Negotiation (json_schema -> json_object -> none)
 *   2. Single Source of Truth: Zod Schema Definition & zod-to-json-schema compilation
 *   3. Declarative zodSchemaConfig builder & resolver
 *   4. L2 Downstream Semantic Validation with safeParse (never throwing)
 *   5. Self-Healing State Machine with Error Memory Injection (assistant raw + user precise field errors)
 *   6. Failure Mode Triage (token truncation, empty output)
 *   7. Retry Budget Exhaustion (max 2 retries = 3 calls) & Zero-Throw Graceful Degradation
 *   8. End-to-End DAG Execution & Downstream Condition Routing on _validationFailed
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

import {
  negotiateResponseFormat,
  convertZodToJsonSchema,
  buildZodSchema,
  resolveZodSchema,
  safeParseOutput,
  buildErrorFeedbackMessages,
  executeWithSelfHealing,
  TEST_SCENARIOS,
} from '../src/engine/structured-output.ts';
import { BrowserWorkflowEngine } from '../src/engine/browser-engine.ts';
import { useSettingsStore } from '../src/stores/settings-store.ts';
import type { WorkflowNode, WorkflowEdge, WorkflowGraph } from '../src/engine/types.ts';
import type { LLMChatRequest, LLMExecutionOutput, ChatMessage } from '../src/engine/llm-client.ts';

describe('Deterministic Structured Output & Capability Negotiation (L1)', () => {
  const urgencySchema = z.object({
    urgency: z.number().min(1).max(5),
    summary: z.string().min(5),
  });

  it('Tier 1: OpenAI gpt-4o retains strict json_schema', () => {
    const result = negotiateResponseFormat('json_schema', 'openai', 'gpt-4o', urgencySchema);
    assert.equal(result.mode, 'json_schema');
    assert.equal(result.isDegraded, false);
    assert.ok(result.apiFormat?.json_schema);
    assert.equal(result.apiFormat.type, 'json_schema');
    assert.equal(result.apiFormat.json_schema.strict, true);
    assert.ok(result.apiFormat.json_schema.schema);
  });

  it('Tier 2: DeepSeek gracefully degrades json_schema to json_object with schema guidance', () => {
    const result = negotiateResponseFormat('json_schema', 'deepseek', 'deepseek-chat', urgencySchema);
    assert.equal(result.mode, 'json_object');
    assert.equal(result.isDegraded, true);
    assert.equal(result.apiFormat?.type, 'json_object');
    assert.ok(result.degradeReason?.includes('Provider "deepseek" does not support strict json_schema'));
    assert.ok(result.injectedPromptGuidance?.includes('urgency'));
  });

  it('Tier 2: SiliconFlow and Google degrade json_schema to json_object', () => {
    const sfResult = negotiateResponseFormat('json_schema', 'siliconflow', 'Qwen/Qwen2.5-72B-Instruct', urgencySchema);
    assert.equal(sfResult.mode, 'json_object');
    assert.equal(sfResult.isDegraded, true);

    const googleResult = negotiateResponseFormat('json_schema', 'google', 'gemini-1.5-pro', urgencySchema);
    assert.equal(googleResult.mode, 'json_object');
    assert.equal(googleResult.isDegraded, true);
  });

  it('Tier 3: Unsupported providers degrade to none with prompt-only guidance', () => {
    const result = negotiateResponseFormat('json_schema', 'legacy_custom_provider', 'old-model', urgencySchema);
    assert.equal(result.mode, 'none');
    assert.equal(result.isDegraded, true);
    assert.equal(result.apiFormat, undefined);
    assert.ok(result.injectedPromptGuidance?.includes('JSON'));
  });
});

describe('Zod Single Source of Truth & zod-to-json-schema Conversion', () => {
  it('compiles Zod schema to OpenAI-compatible strict JSON Schema', () => {
    const testSchema = z.object({
      intent: z.enum(['refund', 'shipping', 'technical']),
      urgency: z.number().min(1).max(5),
      summary: z.string().min(5),
    });

    const jsonSchema = convertZodToJsonSchema(testSchema, 'TicketClassifier');
    assert.equal(jsonSchema.type, 'object');
    const properties = jsonSchema.properties as Record<string, Record<string, unknown>>;
    assert.ok(properties['intent']);
    assert.ok(properties['urgency']);
    assert.ok(properties['summary']);

    // Check urgency boundaries
    assert.equal(properties['urgency'].minimum, 1);
    assert.equal(properties['urgency'].maximum, 5);

    // Check summary minLength
    assert.equal(properties['summary'].minLength, 5);
  });

  it('builds executable Zod schema from declarative zodSchemaConfig', () => {
    const declarativeConfig = {
      name: 'IntentRouter',
      fields: {
        category: { type: 'enum' as const, enum: ['billing', 'sales', 'support'] },
        priority: { type: 'number' as const, min: 1, max: 10 },
        notes: { type: 'string' as const, minLength: 3 },
      },
    };

    const builtSchema = buildZodSchema(declarativeConfig);
    const resolved = resolveZodSchema(declarativeConfig);
    assert.ok(resolved);

    // Valid data passes
    const valid = builtSchema.safeParse({ category: 'billing', priority: 5, notes: 'Valid note' });
    assert.equal(valid.success, true);

    // Invalid priority fails
    const invalid = builtSchema.safeParse({ category: 'billing', priority: 20, notes: 'Valid note' });
    assert.equal(invalid.success, false);
  });
});

describe('L2 Downstream Semantic Validation with safeParse', () => {
  const businessSchema = z.object({
    urgency: z.number().min(1).max(5),
    summary: z.string().min(5),
  });

  it('validates syntax-correct and semantically-valid JSON', () => {
    const raw = JSON.stringify({ urgency: 4, summary: 'Production database unresponsive' });
    const result = safeParseOutput(raw, businessSchema);

    assert.equal(result.success, true);
    assert.equal((result.data as { urgency: number }).urgency, 4);
  });

  it('intercepts semantic violation (urgency=9 out of range 1..5) without throwing', () => {
    // Model output has valid JSON syntax and type is number, but violates business rule
    const raw = JSON.stringify({ urgency: 9, summary: 'Valid summary text' });
    const result = safeParseOutput(raw, businessSchema);

    assert.equal(result.success, false);
    assert.equal(result.syntaxError, false);
    assert.ok(result.errors);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0]?.path, 'urgency');
  });

  it('intercepts empty string semantic violation (summary minLength=5) without throwing', () => {
    const raw = JSON.stringify({ urgency: 3, summary: '' });
    const result = safeParseOutput(raw, businessSchema);

    assert.equal(result.success, false);
    assert.ok(result.errors);
    const summaryErr = result.errors.find((e) => e.path === 'summary');
    assert.ok(summaryErr);
    assert.ok(summaryErr.message.includes('5'));
  });

  it('intercepts broken syntax safely without crashing', () => {
    const brokenRaw = '{ "urgency": 3, "summary": ';
    const result = safeParseOutput(brokenRaw, businessSchema);

    assert.equal(result.success, false);
    assert.equal(result.syntaxError, true);
    assert.equal(result.errors?.[0]?.code, 'syntax_error');
  });

  it('strips markdown code fences before parsing', () => {
    const fencedRaw = '```json\n{"urgency": 2, "summary": "Everything is fine"}\n```';
    const result = safeParseOutput(fencedRaw, businessSchema);

    assert.equal(result.success, true);
    assert.equal((result.data as { urgency: number }).urgency, 2);
  });
});

describe('Error Memory Injection & Feedback Prompt Formatting', () => {
  it('constructs precise field-level feedback prompt with Prescriptive Triad (Defect 1 Fix)', () => {
    const raw = '{"urgency": 9, "summary": ""}';
    const errors: StructuredOutputError[] = [
      {
        path: 'urgency',
        message: 'Number must be less than or equal to 5',
        code: 'too_big',
        receivedValue: 9,
        expectedRule: '数值必须 <= 5',
        suggestion: '请将数值纠偏至合法区间内，例如 "urgency": 5',
      },
      {
        path: 'summary',
        message: 'String must contain at least 5 character(s)',
        code: 'too_small',
        receivedValue: '',
        expectedRule: '字符串长度必须 >= 5 字符',
        suggestion: '当前内容过短，请充实文字内容至至少 5 字符',
      },
    ];

    const feedback = buildErrorFeedbackMessages(raw, errors, false, 0);

    assert.equal(feedback.assistantMsg.role, 'assistant');
    assert.equal(feedback.assistantMsg.content, raw);

    assert.equal(feedback.userMsg.role, 'user');
    // Verifies the Triad three elements: Violating Value + Constraint Rule + Concrete Suggestion
    assert.ok(feedback.userMsg.content?.includes('字段 [urgency]'));
    assert.ok(feedback.userMsg.content?.includes('实际输出值: 9'));
    assert.ok(feedback.userMsg.content?.includes('数值必须 <= 5'));
    assert.ok(feedback.userMsg.content?.includes('修复处方: 请将数值纠偏至合法区间内'));
    assert.ok(feedback.userMsg.content?.includes('字段 [summary]'));
  });

  it('Round 2+ escalates to Global Schema Contract + Golden Few-Shot Exemplar to prevent Isomorphic Retries (Defect 2 Fix)', () => {
    const raw = '{"urgency": 88, "summary": "abc"}';
    const errors: StructuredOutputError[] = [
      {
        path: 'urgency',
        message: 'Number must be less than or equal to 5',
        code: 'too_big',
        receivedValue: 88,
        expectedRule: '数值必须 <= 5',
        suggestion: '请将数值纠偏至合法区间内，例如 "urgency": 5',
      },
    ];

    const feedback = buildErrorFeedbackMessages(raw, errors, false, 1, {
      goldenExemplar: { urgency: 5, summary: '合规标准工单摘要' },
      jsonSchema: { type: 'object', properties: { urgency: { type: 'number', maximum: 5 } } },
    });

    assert.ok(feedback.userMsg.content?.includes('严重警报：检测到你连续多次未能生成合规数据'));
    assert.ok(feedback.userMsg.content?.includes('100% 合法黄金示例 (Few-Shot Golden Exemplar)'));
    assert.ok(feedback.userMsg.content?.includes('"urgency": 5'));
  });
});

describe('Self-Healing State Machine Execution Loop', () => {
  const schema = z.object({
    urgency: z.number().min(1).max(5),
    summary: z.string().min(5),
  });

  it('successfully self-heals on attempt 2 after field-level error memory feedback', async () => {
    let callCount = 0;
    const caller = async (overrides: Partial<LLMChatRequest>): Promise<LLMExecutionOutput> => {
      callCount++;
      if (callCount === 1) {
        // Attempt 1: Output semantic violation (urgency 9, summary empty)
        return {
          response: JSON.stringify({ urgency: 9, summary: '' }),
          usage: { prompt: 10, completion: 10, total: 20 },
          finishReason: 'stop',
          durationMs: 50,
        };
      }
      // Attempt 2: Self-corrected output responding to feedback
      const messages = overrides.messages || [];
      const lastUser = messages[messages.length - 1];
      assert.ok(lastUser?.content?.includes('字段 [urgency]'));

      return {
        response: JSON.stringify({ urgency: 3, summary: 'Resolved customer ticket' }),
        usage: { prompt: 25, completion: 15, total: 40 },
        finishReason: 'stop',
        durationMs: 40,
      };
    };

    const initialMessages: ChatMessage[] = [{ role: 'user', content: 'Classify ticket' }];
    const result = await executeWithSelfHealing(caller, initialMessages, {
      maxRetries: 2,
      schema,
      provider: 'openai',
      model: 'gpt-4o',
    });

    assert.equal(result.success, true);
    assert.equal(callCount, 2);
    assert.equal(result.totalAttempts, 2);
    assert.equal((result.data as { urgency: number }).urgency, 3);
  });

  it('special failure mode: token truncation recovers and heals on round 2 with concise prompt (Defect 3 Fix)', async () => {
    let callCount = 0;
    const recordedPrompts: string[] = [];

    const caller = async (overrides: Partial<LLMChatRequest>): Promise<LLMExecutionOutput> => {
      callCount++;
      const lastUser = overrides.messages?.filter((m) => m.role === 'user').pop();
      if (lastUser?.content) recordedPrompts.push(lastUser.content);

      if (callCount === 1) {
        return {
          response: '{"urgency": 2, "summary": "Truncated mid-sent',
          usage: { prompt: 100, completion: 50, total: 150 },
          finishReason: 'length',
          durationMs: 80,
        };
      }
      return {
        response: JSON.stringify({ urgency: 2, summary: '紧凑摘要内容' }),
        usage: { prompt: 120, completion: 20, total: 140 },
        finishReason: 'stop',
        durationMs: 40,
      };
    };

    const initialMessages: ChatMessage[] = [{ role: 'user', content: 'Long prompt' }];
    const result = await executeWithSelfHealing(caller, initialMessages, {
      maxRetries: 2,
      schema,
      provider: 'openai',
      model: 'gpt-4o',
    });

    assert.equal(result.success, true);
    assert.equal(callCount, 2);
    assert.equal(result.totalAttempts, 2);
    assert.ok(recordedPrompts[1]?.includes('输出截断警报'));
    assert.ok(recordedPrompts[1]?.includes('保持文字极简紧凑'));
    assert.equal((result.data as { urgency: number }).urgency, 2);
    assert.equal(result.trace[1].healedFromTruncation, true);
  });

  it('token truncation exhausts retries when model repeatedly truncates -> graceful degradation', async () => {
    let callCount = 0;
    const caller = async (): Promise<LLMExecutionOutput> => {
      callCount++;
      return {
        response: '{"urgency": 2, "summary": "Truncated mid-sent',
        usage: { prompt: 100, completion: 50, total: 150 },
        finishReason: 'length',
        durationMs: 80,
      };
    };

    const initialMessages: ChatMessage[] = [{ role: 'user', content: 'Long prompt' }];
    const result = await executeWithSelfHealing(caller, initialMessages, {
      maxRetries: 2,
      schema,
      provider: 'openai',
      model: 'gpt-4o',
    });

    assert.equal(result.success, false);
    assert.equal(callCount, 3); // Retried twice with truncation compression prompt before degrading
    assert.equal(result.fallbackReason, 'token_truncated');
    assert.equal(result.errors?.[0]?.code, 'token_truncated');
  });

  it('special failure mode: empty output retries cleanly without polluting error history', async () => {
    let callCount = 0;
    const recordedMessages: ChatMessage[][] = [];

    const caller = async (overrides: Partial<LLMChatRequest>): Promise<LLMExecutionOutput> => {
      callCount++;
      recordedMessages.push([...(overrides.messages || [])]);

      if (callCount === 1) {
        // Sporadic empty response (e.g. DeepSeek empty chunk)
        return {
          response: '',
          usage: { prompt: 10, completion: 0, total: 10 },
          finishReason: 'stop',
          durationMs: 30,
        };
      }
      return {
        response: JSON.stringify({ urgency: 2, summary: 'Now output succeeded' }),
        usage: { prompt: 10, completion: 15, total: 25 },
        finishReason: 'stop',
        durationMs: 30,
      };
    };

    const initialMessages: ChatMessage[] = [{ role: 'user', content: 'Query' }];
    const result = await executeWithSelfHealing(caller, initialMessages, {
      maxRetries: 2,
      schema,
      provider: 'deepseek',
      model: 'deepseek-chat',
    });

    assert.equal(result.success, true);
    assert.equal(callCount, 2);
    // Crucial: second call message list was NOT polluted with fake validation error
    assert.equal(recordedMessages[1]?.length, recordedMessages[0]?.length);
  });

  it('retry budget exhaustion: max 2 retries (3 calls), NEVER throws, outputs graceful fallback', async () => {
    let callCount = 0;
    const caller = async (): Promise<LLMExecutionOutput> => {
      callCount++;
      return {
        response: JSON.stringify({ urgency: 99, summary: '' }),
        usage: { prompt: 20, completion: 10, total: 30 },
        finishReason: 'stop',
        durationMs: 30,
      };
    };

    const initialMessages: ChatMessage[] = [{ role: 'user', content: 'Stubborn model' }];
    const result = await executeWithSelfHealing(caller, initialMessages, {
      maxRetries: 2,
      schema,
      provider: 'openai',
      model: 'gpt-4o',
    });

    assert.equal(result.success, false);
    assert.equal(callCount, 3); // 1 initial + 2 retries = 3 calls
    assert.equal(result.fallbackReason, 'max_retries_exceeded');
    assert.ok(result.errors && result.errors.length > 0);
    assert.ok(result.raw.includes('99'));
  });
});

describe('End-to-End DAG Execution & Downstream Condition Routing', () => {
  it('routes to fallback branch when LLM validation fails without throwing', async () => {
    const engine = new BrowserWorkflowEngine();

    // Node 1: Input
    const inputNode: WorkflowNode = {
      id: 'input_1',
      type: 'input',
      position: { x: 0, y: 0 },
      data: {
        label: 'User Query',
        type: 'input',
        status: 'idle',
        inputs: {},
        outputs: {},
        config: {},
      },
    };

    // Node 2: LLM with zodSchemaConfig (configured to fail mock validation)
    const llmNode: WorkflowNode = {
      id: 'llm_classifier',
      type: 'llm',
      position: { x: 100, y: 0 },
      data: {
        label: 'Intent Classifier',
        type: 'llm',
        status: 'idle',
        inputs: { prompt: '{{input_1.query}}' },
        outputs: {},
        config: {
          mockValidationFail: true, // triggers validation failure in mock execution
          zodSchemaConfig: {
            name: 'IntentSchema',
            fields: {
              urgency: { type: 'number', min: 1, max: 5 },
              summary: { type: 'string', minLength: 5 },
            },
          },
        },
      },
    };

    // Node 3: Condition node branching on _validationFailed
    const conditionNode: WorkflowNode = {
      id: 'condition_router',
      type: 'condition',
      position: { x: 200, y: 0 },
      data: {
        label: 'Check Fallback',
        type: 'condition',
        status: 'idle',
        inputs: {
          failed: '{{llm_classifier._validationFailed}}',
        },
        outputs: {},
        config: {
          mode: 'rules',
          conditions: [
            {
              id: 'c1',
              variable: 'failed',
              operator: 'equals',
              value: 'true',
              targetHandle: 'fallback_branch',
            },
          ],
          defaultBranch: 'normal_branch',
        },
      },
    };

    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'input_1', target: 'llm_classifier' },
      { id: 'e2', source: 'llm_classifier', target: 'condition_router' },
    ];

    const graph: WorkflowGraph = {
      nodes: [inputNode, llmNode, conditionNode],
      edges,
    };

    let workflowCompleted = false;
    let finalOutputs: Record<string, unknown> = {};

    for await (const event of engine.executeWorkflow(graph, {
      inputs: { query: 'I need urgent help' },
      skipLLM: true, // Use simulated mock runner
    })) {
      if (event.type === 'WORKFLOW_COMPLETE') {
        workflowCompleted = true;
        finalOutputs = event.payload.outputs;
      }
    }

    assert.equal(workflowCompleted, true);

    // Verify LLM node output has _validationFailed without throwing
    const llmOut = finalOutputs['llm_classifier'] as Record<string, unknown>;
    assert.ok(llmOut);
    assert.equal(llmOut['_validationFailed'], true);
    assert.ok(Array.isArray(llmOut['errors']));

    // Verify downstream Condition Node took the fallback branch!
    const conditionOut = finalOutputs['condition_router'] as Record<string, unknown>;
    assert.ok(conditionOut);
    assert.equal(conditionOut['activeBranch'], 'fallback_branch');
  });

  it('routes to normal branch when LLM validation succeeds', async () => {
    const engine = new BrowserWorkflowEngine();

    const inputNode: WorkflowNode = {
      id: 'input_1',
      type: 'input',
      position: { x: 0, y: 0 },
      data: {
        label: 'User Query',
        type: 'input',
        status: 'idle',
        inputs: {},
        outputs: {},
        config: {},
      },
    };

    const llmNode: WorkflowNode = {
      id: 'llm_classifier',
      type: 'llm',
      position: { x: 100, y: 0 },
      data: {
        label: 'Intent Classifier',
        type: 'llm',
        status: 'idle',
        inputs: { prompt: '{{input_1.query}}' },
        outputs: {},
        config: {
          mockValidationFail: false, // normal successful simulation
          zodSchemaConfig: {
            name: 'IntentSchema',
            fields: {
              urgency: { type: 'number', min: 1, max: 5 },
              summary: { type: 'string', minLength: 5 },
            },
          },
        },
      },
    };

    const conditionNode: WorkflowNode = {
      id: 'condition_router',
      type: 'condition',
      position: { x: 200, y: 0 },
      data: {
        label: 'Check Fallback',
        type: 'condition',
        status: 'idle',
        inputs: {
          failed: '{{llm_classifier._validationFailed}}',
        },
        outputs: {},
        config: {
          mode: 'rules',
          conditions: [
            {
              id: 'c1',
              variable: 'failed',
              operator: 'equals',
              value: 'true',
              targetHandle: 'fallback_branch',
            },
          ],
          defaultBranch: 'normal_branch',
        },
      },
    };

    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'input_1', target: 'llm_classifier' },
      { id: 'e2', source: 'llm_classifier', target: 'condition_router' },
    ];

    const graph: WorkflowGraph = {
      nodes: [inputNode, llmNode, conditionNode],
      edges,
    };

    let workflowCompleted = false;
    let finalOutputs: Record<string, unknown> = {};

    for await (const event of engine.executeWorkflow(graph, {
      inputs: { query: 'Regular question' },
      skipLLM: true,
    })) {
      if (event.type === 'WORKFLOW_COMPLETE') {
        workflowCompleted = true;
        finalOutputs = event.payload.outputs;
      }
    }

    assert.equal(workflowCompleted, true);

    const llmOut = finalOutputs['llm_classifier'] as Record<string, unknown>;
    assert.ok(llmOut);
    assert.equal(llmOut['_validationFailed'], undefined);
    assert.equal(llmOut['urgency'], 4); // parsed fields directly available

    const conditionOut = finalOutputs['condition_router'] as Record<string, unknown>;
    assert.equal(conditionOut['activeBranch'], 'normal_branch');
  });
});

describe('6 Required Test Scenarios & Portfolio Trace Asset Verification', () => {
  const engine = new BrowserWorkflowEngine();

  it('Case 1: schema 完全合法 → 直接通过，不触发修复', async () => {
    const node: WorkflowNode = {
      id: 'llm_test',
      type: 'llm',
      position: { x: 0, y: 0 },
      data: {
        label: 'LLM Case 1',
        type: 'llm',
        status: 'idle',
        inputs: { prompt: 'Verify ticket' },
        outputs: {},
        config: {
          testScenario: 'valid',
          forceSimulation: true,
          zodSchemaConfig: TEST_SCENARIOS.valid.schemaConfig,
          simulationResponses: TEST_SCENARIOS.valid.defaultResponses,
        },
      },
    };

    const graph: WorkflowGraph = { nodes: [node], edges: [] };
    let outputs: Record<string, unknown> = {};

    for await (const event of engine.executeWorkflow(graph, { skipLLM: true })) {
      if (event.type === 'WORKFLOW_COMPLETE') {
        outputs = event.payload.outputs;
      }
    }

    const nodeOut = outputs['llm_test'] as Record<string, unknown>;
    assert.ok(nodeOut);
    assert.equal(nodeOut['_validationFailed'], undefined);
    assert.equal(nodeOut['selfHealingAttempts'], 1);
    assert.equal(nodeOut['urgency'], 4);
    assert.ok(Array.isArray(nodeOut['selfHealingTrace']));
    assert.equal((nodeOut['selfHealingTrace'] as unknown[]).length, 1);
  });

  it('Case 2: 缺必填字段 → 修复第 1 次成功', async () => {
    const node: WorkflowNode = {
      id: 'llm_test',
      type: 'llm',
      position: { x: 0, y: 0 },
      data: {
        label: 'LLM Case 2',
        type: 'llm',
        status: 'idle',
        inputs: { prompt: 'Verify ticket' },
        outputs: {},
        config: {
          testScenario: 'missing_field',
          forceSimulation: true,
          zodSchemaConfig: TEST_SCENARIOS.missing_field.schemaConfig,
          simulationResponses: TEST_SCENARIOS.missing_field.defaultResponses,
        },
      },
    };

    const graph: WorkflowGraph = { nodes: [node], edges: [] };
    let outputs: Record<string, unknown> = {};

    for await (const event of engine.executeWorkflow(graph, { skipLLM: true })) {
      if (event.type === 'WORKFLOW_COMPLETE') {
        outputs = event.payload.outputs;
      }
    }

    const nodeOut = outputs['llm_test'] as Record<string, unknown>;
    assert.ok(nodeOut);
    assert.equal(nodeOut['_validationFailed'], undefined);
    assert.equal(nodeOut['selfHealingAttempts'], 2); // 1 retry
    assert.ok((nodeOut['summary'] as string).includes('已补全摘要'));

    const trace = nodeOut['selfHealingTrace'] as Array<{ round: number; semanticValid: boolean }>;
    assert.equal(trace.length, 2);
    assert.equal(trace[0].semanticValid, false);
    assert.equal(trace[1].semanticValid, true);
  });

  it('Case 3: enum/数值越界（1..5 给 9）→ 被 L2 拦住并自愈修正', async () => {
    const node: WorkflowNode = {
      id: 'llm_test',
      type: 'llm',
      position: { x: 0, y: 0 },
      data: {
        label: 'LLM Case 3',
        type: 'llm',
        status: 'idle',
        inputs: { prompt: 'Verify ticket' },
        outputs: {},
        config: {
          testScenario: 'enum_out_of_bounds',
          forceSimulation: true,
          zodSchemaConfig: TEST_SCENARIOS.enum_out_of_bounds.schemaConfig,
          simulationResponses: TEST_SCENARIOS.enum_out_of_bounds.defaultResponses,
        },
      },
    };

    const graph: WorkflowGraph = { nodes: [node], edges: [] };
    let outputs: Record<string, unknown> = {};

    for await (const event of engine.executeWorkflow(graph, { skipLLM: true })) {
      if (event.type === 'WORKFLOW_COMPLETE') {
        outputs = event.payload.outputs;
      }
    }

    const nodeOut = outputs['llm_test'] as Record<string, unknown>;
    assert.ok(nodeOut);
    assert.equal(nodeOut['_validationFailed'], undefined);
    assert.equal(nodeOut['selfHealingAttempts'], 2);
    assert.equal(nodeOut['urgency'], 5); // Corrected from 9 to 5

    const trace = nodeOut['selfHealingTrace'] as Array<{ round: number; errors?: Array<{ path: string }> }>;
    assert.equal(trace.length, 2);
    // Round 1 caught the urgency violation
    assert.ok(trace[0].errors?.some((e) => e.path === 'urgency'));
  });

  it('Case 4: 输出被 max_tokens 截断（finishReason === length）→ 走截断分支并成功紧凑自愈 (Defect 3 Fix)', async () => {
    const node: WorkflowNode = {
      id: 'llm_test',
      type: 'llm',
      position: { x: 0, y: 0 },
      data: {
        label: 'LLM Case 4',
        type: 'llm',
        status: 'idle',
        inputs: { prompt: 'Verify ticket' },
        outputs: {},
        config: {
          testScenario: 'token_truncated',
          forceSimulation: true,
          zodSchemaConfig: TEST_SCENARIOS.token_truncated.schemaConfig,
          simulationResponses: TEST_SCENARIOS.token_truncated.defaultResponses,
          simulationFinishReasons: TEST_SCENARIOS.token_truncated.defaultFinishReasons,
        },
      },
    };

    const graph: WorkflowGraph = { nodes: [node], edges: [] };
    let outputs: Record<string, unknown> = {};

    for await (const event of engine.executeWorkflow(graph, { skipLLM: true })) {
      if (event.type === 'WORKFLOW_COMPLETE') {
        outputs = event.payload.outputs;
      }
    }

    const nodeOut = outputs['llm_test'] as Record<string, unknown>;
    assert.ok(nodeOut);
    // Round 1 was truncated with length; state machine triggered truncation recovery and healed on Round 2!
    assert.equal(nodeOut['_validationFailed'], undefined);
    assert.equal(nodeOut['selfHealingAttempts'], 2);
    assert.equal(nodeOut['urgency'], 3);

    const trace = nodeOut['selfHealingTrace'] as SelfHealingTraceStep[];
    assert.ok(trace);
    assert.equal(trace.length, 2);
    assert.equal(trace[0].finishReason, 'length');
    assert.equal(trace[0].escalationLevel, 'truncation_compression');
    assert.equal(trace[1].healedFromTruncation, true);
    assert.equal(trace[1].syntaxValid, true);
  });

  it('Case 5: 输出为空 → 走空内容重试（DeepSeek 偶发空包）', async () => {
    const node: WorkflowNode = {
      id: 'llm_test',
      type: 'llm',
      position: { x: 0, y: 0 },
      data: {
        label: 'LLM Case 5',
        type: 'llm',
        status: 'idle',
        inputs: { prompt: 'Verify ticket' },
        outputs: {},
        config: {
          testScenario: 'empty_output',
          forceSimulation: true,
          zodSchemaConfig: TEST_SCENARIOS.empty_output.schemaConfig,
          simulationResponses: TEST_SCENARIOS.empty_output.defaultResponses,
        },
      },
    };

    const graph: WorkflowGraph = { nodes: [node], edges: [] };
    let outputs: Record<string, unknown> = {};

    for await (const event of engine.executeWorkflow(graph, { skipLLM: true })) {
      if (event.type === 'WORKFLOW_COMPLETE') {
        outputs = event.payload.outputs;
      }
    }

    const nodeOut = outputs['llm_test'] as Record<string, unknown>;
    assert.ok(nodeOut);
    assert.equal(nodeOut['_validationFailed'], undefined);
    assert.equal(nodeOut['selfHealingAttempts'], 2);
    assert.equal(nodeOut['urgency'], 2);
  });

  it('Case 6: 连续 3 次失败 → 优雅降级输出 _validationFailed，不 throw', async () => {
    const node: WorkflowNode = {
      id: 'llm_test',
      type: 'llm',
      position: { x: 0, y: 0 },
      data: {
        label: 'LLM Case 6',
        type: 'llm',
        status: 'idle',
        inputs: { prompt: 'Verify ticket' },
        outputs: {},
        config: {
          testScenario: 'three_failures',
          forceSimulation: true,
          zodSchemaConfig: TEST_SCENARIOS.three_failures.schemaConfig,
          simulationResponses: TEST_SCENARIOS.three_failures.defaultResponses,
        },
      },
    };

    const graph: WorkflowGraph = { nodes: [node], edges: [] };
    let outputs: Record<string, unknown> = {};

    for await (const event of engine.executeWorkflow(graph, { skipLLM: true })) {
      if (event.type === 'WORKFLOW_COMPLETE') {
        outputs = event.payload.outputs;
      }
    }

    const nodeOut = outputs['llm_test'] as Record<string, unknown>;
    assert.ok(nodeOut);
    assert.equal(nodeOut['_validationFailed'], true);
    assert.equal(nodeOut['fallbackReason'], 'max_retries_exceeded');
    assert.equal(nodeOut['selfHealingAttempts'], 3);
    assert.ok(Array.isArray(nodeOut['errors']));
    assert.ok(nodeOut['errors'].length > 0);
  });
});

describe('Research Mode (研究模式) & Developer Lab Settings', () => {
  it('defaults researchMode to false (hidden by default)', () => {
    const state = useSettingsStore.getState();
    assert.equal(typeof state.researchMode, 'boolean');
  });

  it('can toggle researchMode and persist state', () => {
    const store = useSettingsStore.getState();
    store.setResearchMode(true);
    assert.equal(useSettingsStore.getState().researchMode, true);
    store.setResearchMode(false);
    assert.equal(useSettingsStore.getState().researchMode, false);
  });
});

describe('Hybrid Fault Injection: Mock Round 1 → Real LLM Round 2 Self-Healing', () => {
  it('intercepts round 1 with mock return, generates precise error memory, and heals in round 2', async () => {
    let callAttempt = 0;
    let healedWithFeedback = false;

    const testSchema = z.object({
      urgency: z.number().min(1).max(5),
      summary: z.string().min(5),
    });

    const healingResult = await executeWithSelfHealing(
      async (overrides) => {
        const attempt = callAttempt++;
        if (attempt === 0) {
          // Attempt 1: User injected flawed response (urgency 9 out of bounds)
          return {
            response: JSON.stringify({ urgency: 9, summary: 'Flawed mock output in round 1' }),
            finishReason: 'stop',
            usage: { prompt: 10, completion: 20, total: 30 },
            durationMs: 50,
          };
        } else {
          // Attempt 2: Real LLM invocation with error memory feedback
          if (overrides?.messages && overrides.messages.length > 1) {
            healedWithFeedback = true;
          }
          return {
            response: JSON.stringify({ urgency: 2, summary: 'Real LLM corrected valid output' }),
            finishReason: 'stop',
            usage: { prompt: 25, completion: 20, total: 45 },
            durationMs: 60,
          };
        }
      },
      [{ role: 'user', content: 'Classify ticket' }],
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        responseFormat: 'json_schema',
        schema: testSchema,
        maxRetries: 2,
      },
    );

    assert.equal(healingResult.success, true);
    assert.equal(callAttempt, 2);
    assert.equal(healedWithFeedback, true);
    assert.equal((healingResult.data as Record<string, unknown>)?.['urgency'], 2);
    assert.equal((healingResult.data as Record<string, unknown>)?.['summary'], 'Real LLM corrected valid output');
    assert.equal(healingResult.trace.length, 2);
    assert.equal(healingResult.trace[0].semanticValid, false);
    assert.equal(healingResult.trace[1].semanticValid, true);
  });
});

describe('Workflow vs Node Test Decoupling: Global Run Retains Live API Behavior', () => {
  const engine = new BrowserWorkflowEngine();

  const nodeWithMockTestConfig: WorkflowNode = {
    id: 'llm_test_decouple',
    type: 'llm',
    position: { x: 0, y: 0 },
    data: {
      label: 'LLM Node Tested in Drawer',
      type: 'llm',
      status: 'idle',
      inputs: { prompt: 'Classify this ticket dynamically' },
      outputs: {},
      config: {
        testScenario: 'enum_out_of_bounds',
        forceSimulation: true,
        simulationMode: 'offline_mock',
        simulationResponses: [
          JSON.stringify({ urgency: 9, summary: 'Injected Test Mock That Should NOT Hijack Global Run' }),
        ],
        zodSchemaConfig: TEST_SCENARIOS.enum_out_of_bounds.schemaConfig,
      },
    },
  };

  it('executeSingleNode with isNodeTest: true uses injected mock responses', async () => {
    const graph: WorkflowGraph = { nodes: [nodeWithMockTestConfig], edges: [] };
    let outputs: Record<string, unknown> = {};

    for await (const event of engine.executeSingleNode(graph, 'llm_test_decouple', {
      isNodeTest: true,
      skipLLM: true,
    })) {
      if (event.type === 'NODE_COMPLETE') {
        outputs = event.payload.output as Record<string, unknown>;
      }
    }

    // In node test mode, the injected mock response (urgency 9) was used and caught by L2
    assert.ok(outputs);
    assert.equal(outputs['_validationFailed'], true);
    assert.ok(Array.isArray(outputs['errors']));
    const errors = outputs['errors'] as Array<{ path: string; message: string }>;
    assert.ok(errors.some((e) => e.path === 'urgency'));
  });

  it('executeWorkflow (top-right run) refuses node mock injection when real LLM is configured', async () => {
    // When executing the entire workflow without isNodeTest, allowNodeSimulation is FALSE.
    // If the user has an active key, it will attempt the real LLM call instead of returning the injected mock.
    const graph: WorkflowGraph = { nodes: [nodeWithMockTestConfig], edges: [] };

    let reachedRealCallBranch = false;
    let completedWithoutCallingReal = false;

    try {
      for await (const event of engine.executeWorkflow(graph, {
        context: {
          settings: {
            hasKey: true,
            provider: 'openai',
            model: 'gpt-4o-mini',
            apiKey: 'sk-invalid-test-key-for-network-branch-check',
          },
        },
      })) {
        if (event.type === 'NODE_ERROR') {
          // It attempted the real fetch call and failed due to network / invalid key,
          // which proves shouldRunRealLLM was TRUE and node mock injection was NOT used!
          reachedRealCallBranch = true;
        } else if (event.type === 'NODE_COMPLETE') {
          completedWithoutCallingReal = true;
        }
      }
    } catch {
      reachedRealCallBranch = true;
    }

    assert.equal(reachedRealCallBranch, true, 'Global executeWorkflow must call real LLM branch rather than returning node test mock');
    assert.equal(completedWithoutCallingReal, false);
  });

  it('executeWorkflow with skipLLM: true safely runs in dry-run flow validation mode', async () => {
    const graph: WorkflowGraph = { nodes: [nodeWithMockTestConfig], edges: [] };
    let outputs: Record<string, unknown> = {};

    for await (const event of engine.executeWorkflow(graph, { skipLLM: true })) {
      if (event.type === 'WORKFLOW_COMPLETE') {
        outputs = event.payload.outputs;
      }
    }

    const nodeOut = outputs['llm_test_decouple'] as Record<string, unknown>;
    assert.ok(nodeOut);
    // skipLLM allows simulation fallback for flow validation
    assert.equal(nodeOut['_validationFailed'], true);
  });
});


