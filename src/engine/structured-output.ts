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
  SelfHealingEscalationLevel,
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
  SelfHealingEscalationLevel,
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

    // Map Zod issues to high-density field errors with Prescriptive Triad
    const errors: StructuredOutputError[] = zodResult.error.issues.map((issue) => {
      const triad = deriveDiagnosticTriad(parsedJson, issue);
      return {
        path: issue.path.join('.') || 'root',
        message: issue.message,
        code: issue.code,
        receivedValue: triad.receivedValue,
        expectedRule: triad.expectedRule,
        suggestion: triad.suggestion,
      };
    });

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

/**
 * Safely extracts a deeply nested value from an object given an array path.
 */
export function getDeepValue(obj: unknown, path: (string | number)[]): unknown {
  if (path.length === 0) return obj;
  let curr: unknown = obj;
  for (const seg of path) {
    if (curr === null || curr === undefined || typeof curr !== 'object') {
      return undefined;
    }
    curr = (curr as Record<string | number, unknown>)[seg];
  }
  return curr;
}

/**
 * Derives the Prescriptive Diagnostic Triad:
 * 1. Violating Value (实际输出值 / Current Actual)
 * 2. Constraint Rule (合法约束/区间 / Allowed Range)
 * 3. Prescriptive Fix (期望示例/修正式 / Actionable Example)
 */
export function deriveDiagnosticTriad(
  parsedJson: unknown,
  issue: z.ZodIssue,
): {
  receivedValue: unknown;
  expectedRule: string;
  suggestion: string;
} {
  const path = issue.path;
  const rawVal = getDeepValue(parsedJson, path);
  const isMissing = rawVal === undefined;
  const fieldName = path.join('.') || 'root';

  if (isMissing) {
    return {
      receivedValue: '[缺失未提供 / Missing]',
      expectedRule: `必填字段，且不可为空 (${issue.message})`,
      suggestion: `必须在 JSON 中提供字段 "${fieldName}"，请参考业务定义补齐`,
    };
  }

  const receivedValue = rawVal;
  let expectedRule = issue.message;
  let suggestion = `请修正字段 [${fieldName}] 使其符合要求`;

  switch (issue.code) {
    case 'too_big': {
      const bound = issue.maximum;
      const inclusive = issue.inclusive;
      if (issue.type === 'number') {
        expectedRule = `数值必须 ${inclusive ? '<=' : '<'} ${bound}`;
        suggestion = `请将数值纠偏至合法区间内，例如 "${fieldName}": ${bound}`;
      } else if (issue.type === 'string') {
        expectedRule = `字符串长度必须 ${inclusive ? '<=' : '<'} ${bound} 字符`;
        suggestion = `当前文本超长，请将文字精炼在 ${bound} 字符以内`;
      } else if (issue.type === 'array') {
        expectedRule = `数组项数必须 ${inclusive ? '<=' : '<'} ${bound} 项`;
        suggestion = `请将数组缩减至 ${bound} 项以内`;
      }
      break;
    }
    case 'too_small': {
      const bound = issue.minimum;
      const inclusive = issue.inclusive;
      if (issue.type === 'number') {
        expectedRule = `数值必须 ${inclusive ? '>=' : '>'} ${bound}`;
        suggestion = `请将数值纠偏至合法区间内，例如 "${fieldName}": ${bound}`;
      } else if (issue.type === 'string') {
        expectedRule = `字符串长度必须 ${inclusive ? '>=' : '>'} ${bound} 字符`;
        suggestion = `当前内容过短，请充实文字内容至至少 ${bound} 字符`;
      } else if (issue.type === 'array') {
        expectedRule = `数组项数必须 ${inclusive ? '>=' : '>'} ${bound} 项`;
        suggestion = `请补充数组元素至至少 ${bound} 项`;
      }
      break;
    }
    case 'invalid_enum_value': {
      const allowed = (issue as { options?: string[] }).options || [];
      expectedRule = `必须为指定枚举之一: [${allowed.map((o) => `"${o}"`).join(', ')}]`;
      suggestion = `当前输出值 "${String(rawVal)}" 非法，请选择最接近的合法值，例如 "${fieldName}": "${allowed[0] ?? ''}"`;
      break;
    }
    case 'invalid_type': {
      const expected = (issue as { expected?: string }).expected;
      const received = (issue as { received?: string }).received;
      expectedRule = `字段数据类型必须为 ${expected} (当前为 ${received})`;
      suggestion = `请将字段 "${fieldName}" 转换为标准的 ${expected} 类型`;
      break;
    }
    case 'invalid_string': {
      expectedRule = `字符串格式不符合规范: ${issue.message}`;
      suggestion = `请修正字段 "${fieldName}" 的格式`;
      break;
    }
    default: {
      expectedRule = issue.message;
      suggestion = `请根据契约规则修正字段 "${fieldName}"`;
      break;
    }
  }

  return { receivedValue, expectedRule, suggestion };
}

/**
 * Generates a 100% compliant sample JSON object (Golden Exemplar)
 * to ground the model during escalated self-healing retries.
 */
export function generateGoldenExemplar(
  schema?: z.ZodTypeAny | Record<string, unknown>,
): Record<string, unknown> {
  if (!schema) {
    return { urgency: 5, summary: '合规的标准工单摘要内容（符合长度约束）' };
  }

  // If declarative config with fields
  if (typeof schema === 'object' && schema !== null && 'fields' in schema) {
    const fields = (schema as { fields?: Record<string, ZodFieldDef> }).fields;
    if (fields) {
      const exemplar: Record<string, unknown> = {};
      for (const [k, f] of Object.entries(fields)) {
        if (f.type === 'number') {
          exemplar[k] = f.max ?? f.min ?? 5;
        } else if (f.type === 'string') {
          exemplar[k] = f.description ? `合规${f.description}` : '合规标准业务文本内容';
        } else if (f.type === 'enum' && f.enum && f.enum.length > 0) {
          exemplar[k] = f.enum[0];
        } else if (f.type === 'boolean') {
          exemplar[k] = true;
        } else if (f.type === 'array') {
          exemplar[k] = [];
        } else if (f.type === 'object') {
          exemplar[k] = {};
        }
      }
      return exemplar;
    }
  }

  // If Zod schema instance
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const exemplar: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(shape)) {
      if (v instanceof z.ZodNumber) {
        exemplar[k] = 5;
      } else if (v instanceof z.ZodString) {
        exemplar[k] = '合规示例摘要内容（不少于5字符）';
      } else if (v instanceof z.ZodEnum) {
        exemplar[k] = (v as unknown as { options: string[] }).options[0] ?? 'default';
      } else if (v instanceof z.ZodBoolean) {
        exemplar[k] = true;
      } else if (v instanceof z.ZodArray) {
        exemplar[k] = [];
      } else {
        exemplar[k] = '合规值';
      }
    }
    return exemplar;
  }

  return { urgency: 5, summary: '合规的标准工单摘要内容（符合长度约束）' };
}

/**
 * Formats a raw value safely for display inside error diagnostics.
 */
function formatDiagnosticValue(val: unknown): string {
  if (val === undefined) return '[缺失未提供 / Missing]';
  if (val === null) return 'null';
  if (typeof val === 'string') return `"${val}"`;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Error Memory Injection & Progressive Escalation Feedback
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds the error memory context for LLM self-healing using a Progressive Escalation Ladder:
 * - Round 1 (attemptIndex === 0): Targeted Surgical Prescription (Violating Value + Rule + Fix Suggestion)
 * - Round 2+ (attemptIndex >= 1): Escalated Global Schema Definition + Golden Few-Shot Exemplar Grounding
 *
 * Avoids identical isomorphic retries that cause token waste with zero information gain.
 */
export function buildErrorFeedbackMessages(
  rawText: string,
  errors: StructuredOutputError[],
  syntaxError?: boolean,
  attemptIndex: number = 0,
  schemaContext?: {
    jsonSchema?: Record<string, unknown>;
    goldenExemplar?: Record<string, unknown>;
  },
): { assistantMsg: ChatMessage; userMsg: ChatMessage } {
  let promptDetails: string;

  if (syntaxError) {
    promptDetails = `[JSON 语法解析失败 / JSON Syntax Error]
你上一轮输出的内容未能通过 JSON 语法解析，具体报错如下：
${errors.map((e) => `- ${e.message}`).join('\n')}

请输出且仅输出一个纯净、合法的 JSON 对象，不要包含 markdown 标记或任何前置解释。`;
  } else if (attemptIndex === 0) {
    // ── R1: Targeted Surgical Prescription (三要素：违规值 + 合法区间/约束 + 修复处方) ────
    const triadLines = errors
      .map((e) => {
        const valStr = formatDiagnosticValue(e.receivedValue);
        const ruleStr = e.expectedRule || e.message;
        const fixStr = e.suggestion || '请修正此字段';
        return `- 字段 [${e.path}]:
    * 实际输出值: ${valStr}
    * 约束规则: ${ruleStr}
    * 修复处方: ${fixStr}`;
      })
      .join('\n');

    promptDetails = `[业务语义校验失败 / Semantic Validation Failed (R1 手术刀诊断)]
你上一轮输出的 JSON 未能通过下游业务契约校验。请保持其他合法字段不变，严格按照下列三要素（违规值、约束规则、修复处方）针对性纠偏：

${triadLines}

请直接输出修正后的完整合法 JSON 对象，不要输出除合法 JSON 以外的任何文本或解释。`;
  } else {
    // ── R2+: Escalated Global Grounding (全量 Schema 契约 + Few-Shot 黄金示例灌顶) ──────
    const triadLines = errors
      .map((e) => {
        const valStr = formatDiagnosticValue(e.receivedValue);
        const fixStr = e.suggestion || '请对照示例纠偏';
        return `- 字段 [${e.path}]: 上一轮仍输出了 ${valStr}，请强制修正 (${fixStr})`;
      })
      .join('\n');

    const exemplar = schemaContext?.goldenExemplar || { urgency: 5, summary: '合规标准业务工单摘要' };

    promptDetails = `【严重警报：检测到你连续多次未能生成合规数据，请停止局部微调！】
系统已为你升级为全量模式约束与黄金示例对齐模式：

【1. 100% 合法黄金示例 (Few-Shot Golden Exemplar)】:
\`\`\`json
${JSON.stringify(exemplar, null, 2)}
\`\`\`

${
  schemaContext?.jsonSchema
    ? `【2. 完整 JSON Schema 契约定义】:\n\`\`\`json\n${JSON.stringify(schemaContext.jsonSchema, null, 2)}\n\`\`\`\n`
    : ''
}【3. 本轮残余违规处方】:
${triadLines}

【最终生成指令】:
请严格对照上述黄金示例的每个字段名称与数据类型，逐一核验后重新生成完整、闭合的 JSON 对象！`;
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

/**
 * Builds feedback instructions specifically for Output Truncation (finish_reason === 'length').
 * Commands the model to perform aggressive conciseness and character compression.
 */
export function buildTruncationFeedbackMessages(
  rawText: string,
  _attemptIndex: number = 0,
): { assistantMsg: ChatMessage; userMsg: ChatMessage } {
  return {
    assistantMsg: {
      role: 'assistant',
      content: rawText,
    },
    userMsg: {
      role: 'user',
      content: `[输出截断警报 / Output Truncated due to Length Limit]
你上一轮的输出因达到 Token 长度限制 (finish_reason: length) 被物理截断，导致 JSON 数据结构未能闭合。

【自愈恢复处方】：
1. 保持文字极简紧凑：请大幅精简文字表达，将所有文本字段（如 summary、description 等）严格压缩在 30 个字以内！
2. 零冗余输出：严禁输出任何引言、开场白或解释性文本，必须直接输出完整、闭合的紧凑 JSON 对象！`,
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
    name: '4. 输出被 max_tokens 截断 ➔ 紧凑自愈重试成功',
    description: '第 1 轮输出因达到 Token 长度被物理截断；状态机特异性走截断分支，注入紧凑压缩处方，第 2 轮紧凑输出自愈成功',
    schemaConfig: {
      name: 'TicketVerification',
      fields: {
        urgency: { type: 'number', min: 1, max: 5 },
        summary: { type: 'string', minLength: 5 },
      },
    },
    defaultResponses: [
      '{"urgency": 3, "summary": "由于系统内存溢出，节点正在发生阶段性',
      JSON.stringify({ urgency: 3, summary: '内存溢出排查已完成，已恢复正常' }),
    ],
    defaultFinishReasons: ['length', 'stop'],
    expectedOutcome: '走截断特异性分支 -> 注入紧凑压缩处方 -> 第 2 轮修正成功 (healedFromTruncation: true)',
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
    name: '6. 连续 3 次失败 → 阶梯递进升级并优雅降级',
    description: 'R1 给出字段级手术刀处方；R2 识别同构微调并升级为全量 Schema 与黄金示例灌顶；3 次耗尽后优雅降级不抛错',
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
    expectedOutcome: '三轮反馈逐级升级 (R1手术刀->R2黄金示例)，预算耗尽后优雅降级输出 _validationFailed',
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
        `[失败形态特异性诊断] 识别到 max_tokens 物理截断 (finishReason === 'length')。启动截断紧凑自愈重试 (attempt ${attempt + 1}/${maxCalls})...`,
      );

      // If we still have retry budget, attempt truncation recovery!
      if (attempt < maxCalls - 1) {
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
              suggestion: '将长文本压缩至30字以内并闭合JSON',
            },
          ],
          feedbackPrompt: '[截断自愈启动 / Truncation Self-Healing Triggered]',
          escalationLevel: 'truncation_compression',
          timestamp: Date.now(),
        });

        const { assistantMsg, userMsg } = buildTruncationFeedbackMessages(lastRaw, attempt);
        currentMessages = [...currentMessages, assistantMsg, userMsg];
        attempt++;
        continue;
      }

      // Retry budget exhausted on repeated truncation
      trace.push({
        round: attempt + 1,
        rawOutput: lastRaw,
        syntaxValid: false,
        semanticValid: false,
        finishReason: 'length',
        errors: [
          {
            path: 'root',
            message: 'Model output was truncated because max_tokens limit was reached after retries.',
            code: 'token_truncated',
          },
        ],
        feedbackPrompt: '[截断重试耗尽 / Truncation Budget Exhausted]',
        escalationLevel: 'truncation_compression',
        timestamp: Date.now(),
      });

      return {
        success: false,
        raw: lastRaw,
        fallbackReason: 'token_truncated',
        errors: [
          {
            path: 'root',
            message: 'Model output was truncated because max_tokens limit was reached after retries.',
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
      const healedFromTruncation = trace.some((t) => t.finishReason === 'length');
      logger.summary(
        'WorkflowEngine',
        `[L2 业务语义防御] 第 ${attempt + 1} 轮校验通过！${
          healedFromTruncation
            ? '(经历 Token 截断紧凑压缩后自愈成功)'
            : attempt > 0
              ? `(经历 ${attempt} 次错误回喂纠偏后自愈修复成功)`
              : '(一次性直接通过，未触发自愈)'
        }`,
      );

      trace.push({
        round: attempt + 1,
        rawOutput: lastRaw,
        syntaxValid: true,
        semanticValid: true,
        finishReason: lastFinishReason,
        feedbackPrompt: healedFromTruncation
          ? '[截断自愈成功 / Truncation Healed]'
          : '[校验通过 / Validation Passed]',
        healedFromTruncation,
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

    const escalationLevel: SelfHealingEscalationLevel =
      attempt === 1 ? 'surgical_prescription' : 'golden_exemplar';

    const goldenExemplar = generateGoldenExemplar(options.schema);

    logger.warn(
      'WorkflowEngine',
      `[L2 业务语义防御] 第 ${attempt} 轮输出未通过校验 (${lastErrors.length} 处违规, 自愈策略等级: ${escalationLevel}): ${lastErrors
        .map((e) => `[${e.path}]: ${e.message}`)
        .join('; ')}`,
      { errorCount: lastErrors.length, escalationLevel },
    );

    // Inject Error Memory:
    // If attempt === 1 (first retry): Round 1 targeted surgical prescription (三要素)
    // If attempt >= 2 (subsequent retries): Round 2 escalated global schema + golden few-shot exemplar grounding
    const { assistantMsg, userMsg } = buildErrorFeedbackMessages(
      lastRaw,
      lastErrors,
      parseResult.syntaxError,
      attempt - 1,
      {
        jsonSchema: negotiated.apiFormat?.json_schema?.schema as Record<string, unknown> | undefined,
        goldenExemplar,
      },
    );

    trace.push({
      round: attempt,
      rawOutput: lastRaw,
      syntaxValid: !parseResult.syntaxError,
      semanticValid: false,
      errors: lastErrors,
      finishReason: lastFinishReason,
      feedbackPrompt: userMsg.content || '',
      escalationLevel,
      timestamp: Date.now(),
    });

    // If retry budget exhausted -> Graceful degradation (NEVER throw)
    if (attempt >= maxCalls) {
      break;
    }

    logger.detailed(
      'WorkflowEngine',
      `[自愈错误记忆回喂] 注入 Assistant 现场 + User ${
        escalationLevel === 'surgical_prescription' ? '精准手术刀处方' : '全量Schema与黄金示例灌顶'
      }，驱动大模型进入第 ${attempt + 1} 次再生成...`,
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
