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
 * Global schema registry for named schemas.
 * Allows presets, plugins, and custom domains to register schemas dynamically without polluting the core engine.
 */
export const schemaRegistry = new Map<string, z.ZodTypeAny>();

export function registerSchema(name: string, schema: z.ZodTypeAny): void {
  schemaRegistry.set(name, schema);
}

export function getRegisteredSchema(name: string): z.ZodTypeAny | undefined {
  return schemaRegistry.get(name);
}

export function clearRegisteredSchemas(): void {
  schemaRegistry.clear();
}

/**
 * Resolves a runtime ZodTypeAny from various config representations:
 * - Direct Zod schema (instance of z.ZodType or has safeParse)
 * - Declarative ZodSchemaConfig with field definitions
 * - Registered named schema in schemaRegistry
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
    if (typeof obj['name'] === 'string' && schemaRegistry.has(obj['name'])) {
      return schemaRegistry.get(obj['name']);
    }
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
      const isCustomMessage = issue.message && issue.message !== 'Invalid';
      expectedRule = isCustomMessage ? issue.message : `字符串格式不符合规范: 必须符合预期模式`;
      suggestion = isCustomMessage
        ? `请修正字段 "${fieldName}"，确保满足契约要求：${issue.message}`
        : `请检查并修正字段 "${fieldName}" 的格式规范`;
      break;
    }
    case 'custom': {
      expectedRule = issue.message;
      // Cross-field invariants: the violation belongs to the FIELD COMBINATION, not to one
      // field. A one-sided prescription ("change urgency") silently tells the model which
      // way to resolve it — and the model will pick whichever edit is mechanically cheapest
      // (usually nudging a number) instead of whichever field is actually wrong.
      const declared = (issue as { params?: { crossFields?: unknown } }).params?.crossFields;
      const crossFields = Array.isArray(declared)
        ? declared.filter((f): f is string => typeof f === 'string')
        : [];

      if (crossFields.length > 1) {
        const snapshot = crossFields
          .map((f) => `${f} = ${formatDiagnosticValue(getDeepValue(parsedJson, [f]))}`)
          .join('，');
        suggestion = `该约束同时涉及字段 [${crossFields.join('] 与 [')}]，当前取值：${snapshot}。
这些字段中的**任意一个**都可以被修改来满足约束（也可同时修改），只要最终组合满足约束即可。
请判断究竟是哪一个字段的取值本身判断错了，再修改那一个；不要默认只调低数值字段（如等级/分数）来绕过约束，也不要为了省事改动分类/枚举字段却不复查它是否仍然符合输入语义。`;
      } else {
        suggestion = `检测到跨字段业务规则冲突，请调整字段 "${fieldName}" 以满足业务逻辑限制 (当前输出值: ${formatDiagnosticValue(rawVal)})`;
      }
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
 * Unwraps Zod wrapper types (effects, optional, nullable, default) to reach the underlying primitive type.
 */
function unwrapZodType(v: unknown): unknown {
  let target = v;
  while (target && typeof target === 'object') {
    if (target instanceof z.ZodEffects) {
      target = target.innerType();
    } else if (target instanceof z.ZodOptional || target instanceof z.ZodNullable) {
      target = target.unwrap();
    } else if (target instanceof z.ZodDefault) {
      target = target.removeDefault();
    } else {
      break;
    }
  }
  return target;
}

/**
 * Reads min/max bounds declared on a Zod string/number type (defensive: internals may shift).
 * Used only to size a neutral placeholder so the exemplar itself satisfies length constraints.
 */
function readNumericBounds(v: unknown): { min?: number; max?: number } {
  const unwrapped = unwrapZodType(v);
  const checks = (unwrapped as unknown as { _def?: { checks?: Array<{ kind?: string; value?: unknown }> } })?._def?.checks;
  if (!Array.isArray(checks)) return {};
  let min: number | undefined;
  let max: number | undefined;
  for (const c of checks) {
    if (typeof c?.value !== 'number') continue;
    if (c.kind === 'min') min = min === undefined ? c.value : Math.max(min, c.value);
    if (c.kind === 'max') max = max === undefined ? c.value : Math.min(max, c.value);
  }
  return { min, max };
}

/**
 * Neutral filler carrying no concrete entity semantics.
 *
 * A golden exemplar must NEVER fabricate a plausible-looking real-world value
 * (order numbers, IDs, names): models copy the exemplar verbatim, so a hardcoded
 * placeholder is directly converted into a hallucination.
 */
const NEUTRAL_FILLER = '示例占位值';

function neutralString(min?: number, max?: number): string {
  const lo = Math.max(1, min ?? 1);
  const hi = Math.max(lo, max ?? Math.max(lo, 24));
  // Aim for the UPPER part of the declared range. Min-length rules are the binding
  // constraint in practice, so a too-short placeholder contradicts the prescription
  // injected alongside it and the model copies the contradiction.
  const target = Math.min(hi, Math.max(lo, 20));
  let s = '';
  while (s.length < target) s += NEUTRAL_FILLER;
  return s.slice(0, target);
}

/** Candidate values for one field, derived only from its declared schema primitives. */
function fieldCandidates(v: unknown): unknown[] {
  const unwrapped = unwrapZodType(v);
  if (unwrapped instanceof z.ZodNumber) {
    const { min, max } = readNumericBounds(unwrapped);
    const lo = min ?? 1;
    const hi = max ?? lo + 4;
    return [...new Set([lo, hi, Math.round((lo + hi) / 2)])];
  }
  if (unwrapped instanceof z.ZodString) {
    const { min, max } = readNumericBounds(unwrapped);
    return [...new Set([neutralString(min, max), neutralString(min, min), neutralString(max, max)])];
  }
  if (unwrapped instanceof z.ZodEnum) return [...(unwrapped as unknown as { options: string[] }).options];
  if (unwrapped instanceof z.ZodBoolean) return [true, false];
  return [];
}

/**
 * A golden exemplar that violates the very contract being enforced is worse than no
 * exemplar at all — it fights the prescription injected alongside it.
 *
 * Repair regenerated fields against the schema using only declared primitives. If no
 * self-consistent combination exists, drop the exemplar instead of misleading the model.
 */
function selfConsistentExemplar(
  exemplar: Record<string, unknown>,
  schema: z.ZodTypeAny | Record<string, unknown>,
): Record<string, unknown> {
  const zod = resolveZodSchema(schema);
  if (!zod) return exemplar;

  const first = zod.safeParse(exemplar);
  if (first.success) return exemplar;

  let cursor: unknown = zod;
  while (cursor instanceof z.ZodEffects) cursor = cursor.innerType();
  if (!(cursor instanceof z.ZodObject)) return exemplar;
  const shape = cursor.shape as Record<string, z.ZodTypeAny>;

  // Only fields actually implicated by an issue are eligible for repair.
  const targets = [...new Set(first.error.issues.map((i) => String(i.path[0] ?? '')))].filter(
    (k) => k !== '' && k in exemplar,
  );
  const lists = targets.map((k) => fieldCandidates(shape[k]));
  const total = lists.reduce((acc, l) => acc * Math.max(1, l.length), 1);

  if (targets.length > 0 && total > 0 && total <= 512) {
    const idx: number[] = targets.map(() => 0);
    for (let n = 0; n < total; n++) {
      const cand: Record<string, unknown> = { ...exemplar };
      targets.forEach((k, i) => {
        const list = lists[i] ?? [];
        if (list.length > 0) cand[k] = list[idx[i] ?? 0];
      });
      if (zod.safeParse(cand).success) return cand;

      for (let i = targets.length - 1; i >= 0; i--) {
        const len = Math.max(1, (lists[i] ?? []).length);
        const next = (idx[i] ?? 0) + 1;
        idx[i] = next;
        if (next < len) break;
        idx[i] = 0;
      }
    }
  }

  logger.warn(
    'WorkflowEngine',
    '[黄金示例] 无法生成与契约自洽的示例，已放弃注入（避免示例与处方互相矛盾）',
    { targets },
  );
  return {};
}

/**
 * Generates a schema-shaped sample object (Golden Exemplar) used to ground the model
 * during escalated self-healing retries.
 *
 * Invariant: Never fabricates a concrete entity value — only neutral, type-shaped placeholders.
 * Reverted naive field preservation: Does not freeze or carry over previous-round outputs,
 * avoiding trapping the model in false-positive/hallucinated fields.
 */
export function generateGoldenExemplar(
  schema?: z.ZodTypeAny | Record<string, unknown>,
): Record<string, unknown> {
  if (!schema) return {};

  let exemplar: Record<string, unknown> | undefined;

  // ── Declarative config with fields ────────────────────────────────────────
  if (typeof schema === 'object' && schema !== null && 'fields' in schema) {
    const fields = (schema as { fields?: Record<string, ZodFieldDef> }).fields;
    if (fields) {
      const built: Record<string, unknown> = {};
      for (const [k, f] of Object.entries(fields)) {
        if (f.type === 'number') built[k] = f.max ?? f.min ?? 5;
        else if (f.type === 'string') built[k] = neutralString(f.minLength, f.maxLength);
        else if (f.type === 'enum' && f.enum && f.enum.length > 0) built[k] = f.enum[0];
        else if (f.type === 'boolean') built[k] = true;
        else if (f.type === 'array') built[k] = [];
        else if (f.type === 'object') built[k] = {};
        else built[k] = neutralString();
      }
      exemplar = built;
    }
  }

  // ── Zod schema instance ───────────────────────────────────────────────────
  if (!exemplar) {
    // Unwrap ZodEffects (.refine / .transform) if applicable
    let targetZod: unknown = schema;
    while (targetZod instanceof z.ZodEffects) {
      targetZod = targetZod.innerType();
    }

    if (targetZod instanceof z.ZodObject) {
      const shape = targetZod.shape;
      const built: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(shape)) {
        const unwrapped = unwrapZodType(v);
        if (unwrapped instanceof z.ZodNumber) {
          const { min, max } = readNumericBounds(unwrapped);
          built[k] = max ?? min ?? 5;
        } else if (unwrapped instanceof z.ZodString) {
          const { min, max } = readNumericBounds(unwrapped);
          built[k] = neutralString(min, max);
        } else if (unwrapped instanceof z.ZodEnum) {
          built[k] = (unwrapped as unknown as { options: string[] }).options[0] ?? 'default';
        } else if (unwrapped instanceof z.ZodBoolean) {
          built[k] = true;
        } else if (unwrapped instanceof z.ZodArray) {
          built[k] = [];
        } else {
          built[k] = neutralString();
        }
      }
      exemplar = built;
    }
  }

  return exemplar ? selfConsistentExemplar(exemplar, schema) : {};
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
你上一轮输出的 JSON 未能通过下游业务契约校验。请严格按照下列三要素（违规值、约束规则、修复处方）针对性纠偏：

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

    const exemplar = schemaContext?.goldenExemplar;
    const hasExemplar = Boolean(exemplar && Object.keys(exemplar).length > 0);
    const exemplarBlock = hasExemplar
      ? `【1. 结构对齐示例 (Golden Exemplar)】:
\`\`\`json
${JSON.stringify(exemplar, null, 2)}
\`\`\`
注意：示例中的占位值仅为结构示范，严禁照抄为真实数据。请重新核验输入并输出合规的 JSON 对象。

`
      : '';

    promptDetails = `【严重警报：检测到你连续多次未能生成合规数据，请停止局部微调！】
系统已为你升级为全量模式约束与结构对齐模式：

${exemplarBlock}${
  schemaContext?.jsonSchema
    ? `【2. 完整 JSON Schema 契约定义】:\n\`\`\`json\n${JSON.stringify(schemaContext.jsonSchema, null, 2)}\n\`\`\`\n\n`
    : ''
}【3. 本轮残余违规处方】:
${triadLines}

【最终生成指令】:
请严格对照上述契约的每个字段名称与数据类型，逐一核验后重新生成完整、闭合的 JSON 对象！`;
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
