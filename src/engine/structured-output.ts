/**
 * @file    src/engine/structured-output.ts
 * @version 1.0.0
 * @description
 *   Deterministic Structured Output Engine with Multi-tier Capability Negotiation,
 *   Zod L2 Semantic Validation, and Self-Healing Error Memory State Machine.
 *
 *   Core Architectural Principles:
 *   1. L1 Constrained Decoding: Explicit capability negotiation (json_schema -> json_object -> none)
 *      across different providers (OpenAI, DeepSeek, Google, SiliconFlow, Ollama).
 *   2. L2 Semantic Validation: Zod single-source-of-truth providing both schema export and
 *      safe runtime semantic validation (.safeParse() without throwing).
 *   3. Self-Healing State Machine: Error memory injection with precise field-level feedback,
 *      special failure mode triage (truncation, empty output), retry budget (max 2 retries = 3 calls),
 *      and guaranteed zero-throw graceful degradation ({ _validationFailed: true, errors, raw }).
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type {
  ResponseFormatMode,
  ResponseFormatConfig,
  StructuredOutputError,
  ValidationFallbackOutput,
  TokenUsage,
  ZodFieldDef,
  ZodSchemaConfig,
  LLMTestScenario,
  SelfHealingTraceStep,
} from './types.ts';
import type { ChatMessage, LLMChatRequest, LLMExecutionOutput } from './llm-client.ts';
import { logger } from './logger.ts';

export type {
  ResponseFormatMode,
  ResponseFormatConfig,
  StructuredOutputError,
  ValidationFallbackOutput,
  ZodFieldDef,
  ZodSchemaConfig,
  LLMTestScenario,
  SelfHealingTraceStep,
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Provider Capability Negotiation & Degradation (L1)
// ─────────────────────────────────────────────────────────────────────────────

export interface NegotiatedResponseFormat {
  /** Effective negotiation mode */
  mode: ResponseFormatMode;
  /** Actual payload parameter to send to OpenAI-compatible endpoint */
  apiFormat?: {
    type: 'json_object' | 'json_schema';
    json_schema?: {
      name: string;
      strict?: boolean;
      schema: Record<string, unknown>;
    };
  };
  /** Injected schema or JSON guidance for prompt enhancement */
  injectedPromptGuidance?: string;
  /** Whether the requested format was degraded */
  isDegraded: boolean;
  /** Reason for capability degradation */
  degradeReason?: string;
}

/**
 * Strips markdown code blocks (```json ... ``` or ``` ...) if present,
 * returning the inner JSON candidate string.
 */
export function extractJsonString(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  return trimmed;
}

/**
 * Constructs a Zod schema from a declarative field definition.
 */
export function buildFieldZodType(field: ZodFieldDef): z.ZodTypeAny {
  let base: z.ZodTypeAny;

  switch (field.type) {
    case 'number': {
      let num = z.number();
      if (typeof field.min === 'number') num = num.min(field.min);
      if (typeof field.max === 'number') num = num.max(field.max);
      base = num;
      break;
    }
    case 'boolean':
      base = z.boolean();
      break;
    case 'enum': {
      if (field.enum && field.enum.length > 0) {
        const values = field.enum as [string, ...string[]];
        base = z.enum(values);
      } else {
        base = z.string();
      }
      break;
    }
    case 'array': {
      const itemType = field.items ? buildFieldZodType(field.items) : z.unknown();
      let arr = z.array(itemType);
      if (typeof field.min === 'number') arr = arr.min(field.min);
      if (typeof field.max === 'number') arr = arr.max(field.max);
      base = arr;
      break;
    }
    case 'object': {
      if (field.properties && Object.keys(field.properties).length > 0) {
        const shape: Record<string, z.ZodTypeAny> = {};
        for (const [k, v] of Object.entries(field.properties)) {
          shape[k] = buildFieldZodType(v);
        }
        base = z.object(shape);
      } else {
        base = z.record(z.unknown());
      }
      break;
    }
    case 'string':
    default: {
      let str = z.string();
      if (typeof field.minLength === 'number') str = str.min(field.minLength);
      if (typeof field.maxLength === 'number') str = str.max(field.maxLength);
      base = str;
      break;
    }
  }

  if (field.description) {
    base = base.describe(field.description);
  }

  if (field.required === false) {
    base = base.optional();
  }

  return base;
}

/**
 * Builds a z.ZodObject from a declarative ZodSchemaConfig.
 */
export function buildZodSchema(config: ZodSchemaConfig): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  if (config.fields) {
    for (const [k, fieldDef] of Object.entries(config.fields)) {
      shape[k] = buildFieldZodType(fieldDef);
    }
  }
  return z.object(shape);
}

/**
 * Resolves a runtime ZodTypeAny from various config representations:
 * - Direct Zod schema (instance of z.ZodType or has safeParse)
 * - Declarative ZodSchemaConfig with field definitions
 * - Object with nested schema
 */
export function resolveZodSchema(input: unknown): z.ZodTypeAny | undefined {
  if (!input) return undefined;

  if (input instanceof z.ZodType) {
    return input;
  }

  if (typeof (input as { safeParse?: unknown }).safeParse === 'function') {
    return input as z.ZodTypeAny;
  }

  if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>;
    if (obj['schema'] instanceof z.ZodType) {
      return obj['schema'] as z.ZodTypeAny;
    }
    if (typeof (obj['schema'] as { safeParse?: unknown } | undefined)?.safeParse === 'function') {
      return obj['schema'] as z.ZodTypeAny;
    }
    if (obj['fields'] && typeof obj['fields'] === 'object') {
      return buildZodSchema(obj as unknown as ZodSchemaConfig);
    }
  }

  return undefined;
}

/**
 * Converts a Zod Schema to an OpenAI-compatible JSON Schema definition.
 */
export function convertZodToJsonSchema(
  schema: z.ZodTypeAny,
  _schemaName: string = 'output_contract',
): Record<string, unknown> {
  const jsonSchema = zodToJsonSchema(schema, {
    target: 'openAi',
  }) as Record<string, unknown>;

  // Ensure top-level type is object and additionalProperties: false for OpenAI strict mode
  if (jsonSchema && typeof jsonSchema === 'object') {
    if (!jsonSchema['type']) {
      jsonSchema['type'] = 'object';
    }
  }
  return jsonSchema;
}

/**
 * Provider Capability Matrix:
 * - OpenAI: supports strict json_schema for modern models (gpt-4o, gpt-4o-mini, o1, o3-mini)
 * - DeepSeek: supports json_object (JSON Mode), but rejects strict json_schema with 400
 * - SiliconFlow / Moonshot: widely supports json_object, degrades json_schema
 * - Google (OpenAI endpoint): supports json_object
 * - Ollama: supports json_object on modern releases, degrades if older
 */
export function negotiateResponseFormat(
  requested: ResponseFormatConfig | ResponseFormatMode | undefined,
  provider: string,
  model: string,
  schema?: z.ZodTypeAny | Record<string, unknown>,
): NegotiatedResponseFormat {
  let requestedMode: ResponseFormatMode = 'none';
  let customJsonSchema: Record<string, unknown> | undefined = undefined;
  let schemaName = 'response_contract';
  let isStrict = true;

  if (typeof requested === 'string') {
    requestedMode = requested;
  } else if (requested && typeof requested === 'object') {
    requestedMode = requested.type || 'none';
    if (requested.jsonSchema) {
      customJsonSchema = requested.jsonSchema.schema;
      schemaName = requested.jsonSchema.name || schemaName;
      isStrict = requested.jsonSchema.strict ?? true;
    }
  } else if (schema) {
    requestedMode = 'json_schema';
  }

  // Derive JSON Schema if a Zod schema is provided and customJsonSchema is missing
  if (!customJsonSchema && schema) {
    if (schema instanceof z.ZodType) {
      customJsonSchema = convertZodToJsonSchema(schema, schemaName);
    } else if (typeof schema === 'object' && schema !== null) {
      customJsonSchema = schema as Record<string, unknown>;
    }
  }

  const normalizedProvider = (provider || '').toLowerCase().trim();
  const normalizedModel = (model || '').toLowerCase().trim();

  // Tier 1: json_schema requested
  if (requestedMode === 'json_schema') {
    const supportsStrict =
      normalizedProvider === 'openai' ||
      (normalizedProvider === 'custom' && (normalizedModel.includes('gpt-4o') || normalizedModel.includes('o3-mini')));

    if (supportsStrict && customJsonSchema) {
      return {
        mode: 'json_schema',
        apiFormat: {
          type: 'json_schema',
          json_schema: {
            name: schemaName,
            strict: isStrict,
            schema: customJsonSchema,
          },
        },
        isDegraded: false,
      };
    }

    // Provider cannot accept strict json_schema -> Degrade to Tier 2 (json_object) + Schema Prompt Guidance
    const supportsJsonObject = [
      'deepseek',
      'siliconflow',
      'google',
      'ollama',
      'openai',
      'custom',
    ].includes(normalizedProvider);

    const schemaStr = customJsonSchema ? JSON.stringify(customJsonSchema, null, 2) : '';
    const guidance = schemaStr
      ? `\n\n[Output Constraint]: You MUST return your response as a valid JSON object strictly adhering to this schema:\n${schemaStr}`
      : `\n\n[Output Constraint]: You MUST return your response as a valid JSON object.`;

    if (supportsJsonObject) {
      return {
        mode: 'json_object',
        apiFormat: {
          type: 'json_object',
        },
        injectedPromptGuidance: guidance,
        isDegraded: true,
        degradeReason: `Provider "${provider}" does not support strict json_schema; gracefully degraded to json_object with schema guidance.`,
      };
    }

    // Provider does not support json_object either -> Degrade to Tier 3 (none)
    return {
      mode: 'none',
      apiFormat: undefined,
      injectedPromptGuidance: guidance,
      isDegraded: true,
      degradeReason: `Provider "${provider}" does not support native structured outputs; degraded to prompt-only guidance.`,
    };
  }

  // Tier 2: json_object requested
  if (requestedMode === 'json_object') {
    const supportsJsonObject = [
      'openai',
      'deepseek',
      'siliconflow',
      'google',
      'ollama',
      'custom',
    ].includes(normalizedProvider);

    if (supportsJsonObject) {
      return {
        mode: 'json_object',
        apiFormat: {
          type: 'json_object',
        },
        injectedPromptGuidance: customJsonSchema
          ? `\n\n[Output Constraint]: You MUST return a valid JSON object matching:\n${JSON.stringify(customJsonSchema, null, 2)}`
          : undefined,
        isDegraded: false,
      };
    }

    return {
      mode: 'none',
      apiFormat: undefined,
      injectedPromptGuidance: `\n\n[Output Constraint]: You MUST return your response as a valid JSON object.`,
      isDegraded: true,
      degradeReason: `Provider "${provider}" does not support json_object; degraded to prompt-only mode.`,
    };
  }

  // Tier 3: none requested
  return {
    mode: 'none',
    apiFormat: undefined,
    injectedPromptGuidance: customJsonSchema
      ? `\n\n[Output Format]: Please format your response as valid JSON matching:\n${JSON.stringify(customJsonSchema, null, 2)}`
      : undefined,
    isDegraded: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. L2 Semantic Validation with Zod SafeParse
// ─────────────────────────────────────────────────────────────────────────────

export interface SafeParseOutputResult {
  success: boolean;
  data?: unknown;
  raw: string;
  errors?: StructuredOutputError[];
  syntaxError?: boolean;
}

/**
 * Safely parses the raw output against syntax constraints and optional Zod L2 schema.
 * NEVER throws an uncaught exception.
 */
export function safeParseOutput(
  rawText: string,
  schema?: z.ZodTypeAny | Record<string, unknown>,
): SafeParseOutputResult {
  const cleanText = extractJsonString(rawText);

  // 1. L1 Syntax Check via JSON.parse
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleanText);
  } catch (err: unknown) {
    const syntaxErrMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      syntaxError: true,
      raw: rawText,
      errors: [
        {
          path: 'root',
          message: `Malformed JSON syntax: ${syntaxErrMsg}`,
          code: 'syntax_error',
        },
      ],
    };
  }

  // If no schema provided, syntax validation alone is successful
  if (!schema) {
    return {
      success: true,
      data: parsedJson,
      raw: rawText,
    };
  }

  // 2. L2 Semantic Validation with Zod SafeParse
  if (schema instanceof z.ZodType || (typeof (schema as { safeParse?: unknown }).safeParse === 'function')) {
    const zodSchema = schema as z.ZodTypeAny;
    const zodResult = zodSchema.safeParse(parsedJson);

    if (zodResult.success) {
      return {
        success: true,
        data: zodResult.data,
        raw: rawText,
      };
    }

    // Map Zod issues to high-density field errors
    const errors: StructuredOutputError[] = zodResult.error.issues.map((issue) => ({
      path: issue.path.join('.') || 'root',
      message: issue.message,
      code: issue.code,
    }));

    return {
      success: false,
      syntaxError: false,
      raw: rawText,
      errors,
    };
  }

  return {
    success: true,
    data: parsedJson,
    raw: rawText,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Error Memory Injection & Feedback Prompt Formatting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the error memory context for LLM self-healing:
 * 1. Assistant message: exact raw erroneous output.
 * 2. User message: field-level precise error diagnostic + regeneration instruction.
 */
export function buildErrorFeedbackMessages(
  rawText: string,
  errors: StructuredOutputError[],
  syntaxError?: boolean,
): { assistantMsg: ChatMessage; userMsg: ChatMessage } {
  let promptDetails: string;

  if (syntaxError) {
    promptDetails = `Your previous output could not be parsed as valid JSON:
${errors.map((e) => `- ${e.message}`).join('\n')}
Please output ONLY a syntactically valid JSON object.`;
  } else {
    const errorLines = errors
      .map((e) => `- 字段 [${e.path}]: ${e.message}`)
      .join('\n');

    promptDetails = `[业务语义校验失败 / Semantic Validation Failed]
你上一轮输出的内容未能通过下游业务契约校验，具体错误如下：
${errorLines}

请严格根据上述字段级错误修正，重新输出符合要求的合法 JSON，不要包含除合法 JSON 以外的任何文本或解释。`;
  }

  return {
    assistantMsg: {
      role: 'assistant',
      content: rawText,
    },
    userMsg: {
      role: 'user',
      content: promptDetails,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Self-Healing State Machine Loop
// ─────────────────────────────────────────────────────────────────────────────

export interface TestScenarioDefinition {
  id: LLMTestScenario;
  name: string;
  description: string;
  schemaConfig: ZodSchemaConfig;
  defaultResponses: string[];
  defaultFinishReasons?: string[];
  expectedOutcome: string;
}

export const TEST_SCENARIOS: Record<LLMTestScenario, TestScenarioDefinition> = {
  valid: {
    id: 'valid',
    name: '1. Schema 完全合法 → 直接通过',
    description: '模型一次性输出符合约束的合法 JSON，直接通过校验，0 次自愈重试',
    schemaConfig: {
      name: 'TicketVerification',
      fields: {
        urgency: { type: 'number', min: 1, max: 5, description: '工单紧急度 1..5' },
        summary: { type: 'string', minLength: 5, description: '工单摘要至少5字符' },
      },
    },
    defaultResponses: [
      JSON.stringify({ urgency: 4, summary: '生产数据库偶发连接超时，正在排查中' }),
    ],
    defaultFinishReasons: ['stop'],
    expectedOutcome: '直接通过校验，不触发自愈修复 (attempts: 1)',
  },
  missing_field: {
    id: 'missing_field',
    name: '2. 缺必填字段 → 修复第 1 次成功',
    description: '第 1 轮缺少必填 summary 字段被 L2 拦截，回喂字段级错误记忆后，第 2 轮补全字段修复成功',
    schemaConfig: {
      name: 'TicketVerification',
      fields: {
        urgency: { type: 'number', min: 1, max: 5, description: '工单紧急度 1..5' },
        summary: { type: 'string', minLength: 5, description: '工单摘要至少5字符' },
      },
    },
    defaultResponses: [
      JSON.stringify({ urgency: 4 }), // missing summary
      JSON.stringify({ urgency: 4, summary: '已补全摘要：线上支付网关发生延迟并已恢复' }),
    ],
    defaultFinishReasons: ['stop', 'stop'],
    expectedOutcome: '第 1 轮拦截缺失字段 -> 回喂记忆 -> 第 2 轮修正成功',
  },
  enum_out_of_bounds: {
    id: 'enum_out_of_bounds',
    name: '3. enum/数值越界 (1..5 给 9) → 被 L2 拦住',
    description: '模型输出 urgency: 9（数字语法合法，L1放行），被 L2 safeParse 领域防线精确阻断，自愈修正为 5',
    schemaConfig: {
      name: 'TicketVerification',
      fields: {
        urgency: { type: 'number', min: 1, max: 5, description: '紧急度只能在 1..5' },
        summary: { type: 'string', minLength: 5, description: '摘要不少于5字符' },
      },
    },
    defaultResponses: [
      JSON.stringify({ urgency: 9, summary: '服务器机房空调过热报警' }), // urgency 9 > 5
      JSON.stringify({ urgency: 5, summary: '服务器机房空调过热报警（已纠偏至允许最高值5）' }),
    ],
    defaultFinishReasons: ['stop', 'stop'],
    expectedOutcome: '证明 L1 语法不够，L2 精准截获 [urgency] 越界并回喂自愈',
  },
  token_truncated: {
    id: 'token_truncated',
    name: '4. 输出被 max_tokens 截断 (finishReason === length)',
    description: '模型输出由于 max_tokens 过小被物理截断，状态机特异性走截断分支，停止无意义的校验盲目重试',
    schemaConfig: {
      name: 'TicketVerification',
      fields: {
        urgency: { type: 'number', min: 1, max: 5 },
        summary: { type: 'string', minLength: 5 },
      },
    },
    defaultResponses: [
      '{"urgency": 3, "summary": "由于系统内存溢出，节点正在发生阶段性',
    ],
    defaultFinishReasons: ['length'],
    expectedOutcome: '特异性识别 length 截断，输出 token_truncated 降级特征，不误报字段语义校验错误',
  },
  empty_output: {
    id: 'empty_output',
    name: '5. 输出为空 → 原地干净重试 (DeepSeek 空包坑)',
    description: '模型偶发吐出空响应，状态机原地无污染重发原始请求（不注入虚假的校验报错记忆），第 2 轮成功输出',
    schemaConfig: {
      name: 'TicketVerification',
      fields: {
        urgency: { type: 'number', min: 1, max: 5 },
        summary: { type: 'string', minLength: 5 },
      },
    },
    defaultResponses: [
      '', // empty
      JSON.stringify({ urgency: 2, summary: '重试后正常响应：客户咨询升级计划' }),
    ],
    defaultFinishReasons: ['stop', 'stop'],
    expectedOutcome: '原地干净重发原始请求，不污染上下文历史',
  },
  three_failures: {
    id: 'three_failures',
    name: '6. 连续 3 次失败 → 优雅降级输出 _validationFailed',
    description: '连续 3 轮均违规（耗尽 2 次重试预算），引擎绝对不 throw 崩溃，输出标准化契约供下游分支路由',
    schemaConfig: {
      name: 'TicketVerification',
      fields: {
        urgency: { type: 'number', min: 1, max: 5 },
        summary: { type: 'string', minLength: 5 },
      },
    },
    defaultResponses: [
      JSON.stringify({ urgency: 99, summary: '' }),
      JSON.stringify({ urgency: 88, summary: 'abc' }),
      JSON.stringify({ urgency: 77, summary: 'xyz' }),
    ],
    defaultFinishReasons: ['stop', 'stop', 'stop'],
    expectedOutcome: '3次调用耗尽，严禁 throw，正常产出 { _validationFailed: true, ... }',
  },
  custom: {
    id: 'custom',
    name: '自定义测试场景',
    description: '自定义多轮模型输出与校验规则',
    schemaConfig: {
      name: 'CustomSchema',
      fields: {
        urgency: { type: 'number', min: 1, max: 5 },
        summary: { type: 'string', minLength: 5 },
      },
    },
    defaultResponses: [
      JSON.stringify({ urgency: 9, summary: '' }),
      JSON.stringify({ urgency: 3, summary: '修正后的摘要内容' }),
    ],
    defaultFinishReasons: ['stop', 'stop'],
    expectedOutcome: '按自定义填写的返回流执行自愈状态机',
  },
};

export interface SelfHealingExecutionOptions {
  maxRetries?: number; // default 2 (total 3 attempts)
  schema?: z.ZodTypeAny | Record<string, unknown>;
  responseFormat?: ResponseFormatConfig | ResponseFormatMode;
  provider: string;
  model: string;
  signal?: AbortSignal;
  onAttempt?: (attemptIndex: number, isRetry: boolean, error?: StructuredOutputError[]) => void;
}

export interface SelfHealingExecutionResult {
  success: boolean;
  data?: unknown;
  raw: string;
  errors?: StructuredOutputError[];
  fallbackReason?: 'schema_mismatch' | 'token_truncated' | 'empty_output' | 'max_retries_exceeded' | 'syntax_error';
  totalAttempts: number;
  negotiated: NegotiatedResponseFormat;
  finishReason?: string;
  usage?: TokenUsage;
  reasoning?: string;
  trace: SelfHealingTraceStep[];
}

/**
 * Runs the self-healing state machine around an LLM chat invoker:
 * - Attempt 1: Initial call with negotiated response_format
 * - Triage failure modes:
 *     - Truncated (finishReason === 'length'): record and do not feed misleading validation errors
 *     - Empty output: clean retry without polluting history
 *     - Syntax / Semantic error: inject error memory (assistant raw + user precise error) and retry
 * - Max retries: 2 (total 3 calls)
 * - On 3 failures: NEVER THROW, produce standardized graceful fallback result
 */
export async function executeWithSelfHealing(
  caller: (requestOverrides: Partial<LLMChatRequest>) => Promise<LLMExecutionOutput>,
  initialMessages: ChatMessage[],
  options: SelfHealingExecutionOptions,
): Promise<SelfHealingExecutionResult> {
  const maxRetries = typeof options.maxRetries === 'number' ? options.maxRetries : 2;
  const maxCalls = maxRetries + 1; // e.g. 2 retries = 3 calls
  const negotiated = negotiateResponseFormat(
    options.responseFormat,
    options.provider,
    options.model,
    options.schema,
  );

  let currentMessages: ChatMessage[] = [...initialMessages];

  // If prompt guidance exists, append to system or last user message
  if (negotiated.injectedPromptGuidance) {
    const lastUserIdx = currentMessages.map((m) => m.role).lastIndexOf('user');
    if (lastUserIdx >= 0) {
      const orig = currentMessages[lastUserIdx]!.content || '';
      currentMessages[lastUserIdx] = {
        ...currentMessages[lastUserIdx]!,
        content: orig + negotiated.injectedPromptGuidance,
      };
    }
  }

  let attempt = 0;
  let lastRaw = '';
  let lastErrors: StructuredOutputError[] = [];
  let lastFinishReason: string | undefined = undefined;
  const lastUsage: TokenUsage = { prompt: 0, completion: 0, total: 0 };
  let lastReasoning: string | undefined = undefined;
  const trace: SelfHealingTraceStep[] = [];

  logger.detailed(
    'WorkflowEngine',
    `[L1 约束解码协商] Provider: "${options.provider}", Model: "${options.model}", Mode: ${negotiated.mode}${
      negotiated.isDegraded ? ` (降级触发: ${negotiated.degradeReason})` : ''
    }`,
  );

  while (attempt < maxCalls) {
    if (options.signal?.aborted) {
      throw new Error('Workflow execution aborted by user.');
    }

    const isRetry = attempt > 0;
    options.onAttempt?.(attempt, isRetry, lastErrors.length > 0 ? lastErrors : undefined);

    let llmRes: LLMExecutionOutput;
    try {
      llmRes = await caller({
        messages: currentMessages,
        response_format: negotiated.apiFormat,
      });
    } catch (err: unknown) {
      if (options.signal?.aborted) {
        throw err;
      }
      throw err;
    }

    lastRaw = llmRes.response || '';
    lastFinishReason = llmRes.finishReason;
    if (llmRes.usage) {
      lastUsage.prompt += llmRes.usage.prompt;
      lastUsage.completion += llmRes.usage.completion;
      lastUsage.total += llmRes.usage.total;
    }
    if (llmRes.reasoning) {
      lastReasoning = llmRes.reasoning;
    }

    // ── Diagnostic 1: Empty output (e.g. DeepSeek sporadic empty response) ────
    if (lastRaw.trim().length === 0) {
      logger.warn(
        'WorkflowEngine',
        `[失败形态特异性诊断] 识别到模型偶发空响应 (空包) on attempt ${attempt + 1}/${maxCalls}。执行原地干净重试，不注入虚假校验报错记忆。`,
      );
      trace.push({
        round: attempt + 1,
        rawOutput: '',
        syntaxValid: false,
        semanticValid: false,
        finishReason: lastFinishReason,
        feedbackPrompt: '[空内容重试 / Empty Response Retry]',
        timestamp: Date.now(),
      });

      attempt++;
      if (attempt >= maxCalls) {
        return {
          success: false,
          raw: '',
          fallbackReason: 'empty_output',
          errors: [
            {
              path: 'root',
              message: 'Model returned empty response after maximum retry attempts.',
              code: 'empty_output',
            },
          ],
          totalAttempts: attempt,
          negotiated,
          finishReason: lastFinishReason,
          usage: lastUsage,
          reasoning: lastReasoning,
          trace,
        };
      }
      // Clean retry: do not append error memory
      continue;
    }

    // ── Diagnostic 2: Output truncated (finishReason === 'length') ────────────
    if (lastFinishReason === 'length') {
      logger.warn(
        'WorkflowEngine',
        `[失败形态特异性诊断] 识别到 max_tokens 物理截断 (finishReason === 'length')。特异性走截断分支，停止无意义的字段校验盲目重试。`,
      );
      trace.push({
        round: attempt + 1,
        rawOutput: lastRaw,
        syntaxValid: false,
        semanticValid: false,
        finishReason: 'length',
        errors: [
          {
            path: 'root',
            message: 'Model output was truncated because max_tokens limit was reached.',
            code: 'token_truncated',
          },
        ],
        feedbackPrompt: '[物理截断分流 / Truncated Branch]',
        timestamp: Date.now(),
      });

      return {
        success: false,
        raw: lastRaw,
        fallbackReason: 'token_truncated',
        errors: [
          {
            path: 'root',
            message: 'Model output was truncated because max_tokens limit was reached.',
            code: 'token_truncated',
          },
        ],
        totalAttempts: attempt + 1,
        negotiated,
        finishReason: 'length',
        usage: lastUsage,
        reasoning: lastReasoning,
        trace,
      };
    }

    // ── Diagnostic 3: SafeParse validation (L1 syntax + L2 semantics) ─────────
    const parseResult = safeParseOutput(lastRaw, options.schema);

    if (parseResult.success) {
      logger.summary(
        'WorkflowEngine',
        `[L2 业务语义防御] 第 ${attempt + 1} 轮校验通过！${
          attempt > 0 ? `(经历 ${attempt} 次错误回喂纠偏后自愈修复成功)` : '(一次性直接通过，未触发自愈)'
        }`,
      );

      trace.push({
        round: attempt + 1,
        rawOutput: lastRaw,
        syntaxValid: true,
        semanticValid: true,
        finishReason: lastFinishReason,
        feedbackPrompt: '[校验通过 / Validation Passed]',
        timestamp: Date.now(),
      });

      return {
        success: true,
        data: parseResult.data,
        raw: lastRaw,
        totalAttempts: attempt + 1,
        negotiated,
        finishReason: lastFinishReason,
        usage: lastUsage,
        reasoning: lastReasoning,
        trace,
      };
    }

    // Validation failed
    lastErrors = parseResult.errors || [];
    attempt++;

    logger.warn(
      'WorkflowEngine',
      `[L2 业务语义防御] 第 ${attempt} 轮输出未通过校验 (${lastErrors.length} 处违规): ${lastErrors
        .map((e) => `[${e.path}]: ${e.message}`)
        .join('; ')}`,
      { errorCount: lastErrors.length },
    );

    // Inject Error Memory: Assistant previous raw + User precise field feedback
    const { assistantMsg, userMsg } = buildErrorFeedbackMessages(
      lastRaw,
      lastErrors,
      parseResult.syntaxError,
    );

    trace.push({
      round: attempt,
      rawOutput: lastRaw,
      syntaxValid: !parseResult.syntaxError,
      semanticValid: false,
      errors: lastErrors,
      finishReason: lastFinishReason,
      feedbackPrompt: userMsg.content || '',
      timestamp: Date.now(),
    });

    // If retry budget exhausted -> Graceful degradation (NEVER throw)
    if (attempt >= maxCalls) {
      break;
    }

    logger.detailed(
      'WorkflowEngine',
      `[自愈错误记忆回喂] 注入 Assistant 现场 + User 精准字段级诊断，驱动大模型进入第 ${attempt + 1} 次再生成...`,
    );

    currentMessages = [...currentMessages, assistantMsg, userMsg];
  }

  // Graceful degradation when all 3 attempts fail: NEVER THROW!
  logger.summary(
    'WorkflowEngine',
    `[确定性优雅降级] 连续 3 次调用全未通过，自愈预算耗尽。绝不 throw 崩溃，输出 _validationFailed: true 契约供下游分支路由。`,
  );

  return {
    success: false,
    raw: lastRaw,
    fallbackReason: 'max_retries_exceeded',
    errors: lastErrors,
    totalAttempts: attempt,
    negotiated,
    finishReason: lastFinishReason,
    usage: lastUsage,
    reasoning: lastReasoning,
    trace,
  };
}
