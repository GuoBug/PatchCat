/**
 * @file src/engine/variable-resolver.ts
 * @description Dynamic Template Variable Slot Resolver ({{nodeId.keyPath}})
 */

const VARIABLE_REGEX = /\{\{\s*([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_.[\]-]+)(?:\s*\|\s*([^}]+))?\s*\}\}/g;

/**
 * Safely resolves a nested property path from an object (e.g. "result.items[0].name").
 */
export function getNestedProperty(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) {
    return undefined;
  }

  // Normalize array access like a[0] -> a.0
  const normalizedPath = path.replace(/\[(\w+)\]/g, '.$1');
  const segments = normalizedPath.split('.').filter(Boolean);

  let current: unknown = obj;
  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    // Prevent Prototype Pollution
    if (segment === '__proto__' || segment === 'constructor' || segment === 'prototype') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

export interface VariableReference {
  raw: string;
  nodeId: string;
  propertyPath: string;
  defaultValue?: string;
}

const SINGLE_EXACT_VARIABLE_REGEX = /^\s*\{\{\s*([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_.[\]-]+)(?:\s*\|\s*([^}]+))?\s*\}\}\s*$/;

/**
 * Extracts all variable references from a template string.
 */
export function extractVariableReferences(template: string): VariableReference[] {
  const references: VariableReference[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(VARIABLE_REGEX);

  while ((match = regex.exec(template)) !== null) {
    const raw = match[0] ?? '';
    const nodeId = match[1] ?? '';
    const propertyPath = match[2] ?? '';
    const fallbackRaw = match[3];
    references.push({
      raw,
      nodeId,
      propertyPath,
      defaultValue: fallbackRaw?.trim().replace(/^['"]|['"]$/g, ''),
    });
  }

  return references;
}

/**
 * Resolves a template string by replacing all {{nodeId.path}} with values from execution context.
 */
export function resolveTemplateVariables(
  template: string,
  context: Record<string, Record<string, unknown>>,
): string {
  if (!template || typeof template !== 'string') {
    return template;
  }

  return template.replace(VARIABLE_REGEX, (match, nodeId, path, fallback) => {
    const nodeOutput = context[nodeId];
    if (!nodeOutput) {
      if (fallback !== undefined) {
        return fallback.trim().replace(/^['"]|['"]$/g, '');
      }
      return match; // Keep unresolved placeholder if no fallback
    }

    const value = getNestedProperty(nodeOutput, path);
    if (value === undefined || value === null) {
      if (fallback !== undefined) {
        return fallback.trim().replace(/^['"]|['"]$/g, '');
      }
      return '';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  });
}

/**
 * Recursively resolves all variable slots within an arbitrary object or array.
 * If a string is EXACTLY a single variable slot like "{{nodeId.field}}",
 * its original native type (Object, Array, Number, Boolean) is preserved.
 */
export function resolveObjectVariables<T>(
  data: T,
  context: Record<string, Record<string, unknown>>,
): T {
  if (typeof data === 'string') {
    const exactMatch = SINGLE_EXACT_VARIABLE_REGEX.exec(data);
    if (exactMatch) {
      const nodeId = exactMatch[1] ?? '';
      const propertyPath = exactMatch[2] ?? '';
      const fallbackRaw = exactMatch[3];

      const nodeOutput = context[nodeId];
      if (nodeOutput) {
        const value = getNestedProperty(nodeOutput, propertyPath);
        if (value !== undefined && value !== null) {
          return value as unknown as T;
        }
      }

      if (fallbackRaw !== undefined) {
        const trimmed = fallbackRaw.trim().replace(/^['"]|['"]$/g, '');
        try {
          return JSON.parse(trimmed) as unknown as T;
        } catch {
          return trimmed as unknown as T;
        }
      }

      if (!nodeOutput) {
        return data; // Keep placeholder if node not in context
      }

      return '' as unknown as T;
    }

    return resolveTemplateVariables(data, context) as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map((item) => resolveObjectVariables(item, context)) as unknown as T;
  }

  if (data !== null && typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      result[key] = resolveObjectVariables(val, context);
    }
    return result as T;
  }

  return data;
}

export { resolveObjectVariables as resolveVariables };
export { resolveObjectVariables as resolveNodeInputs };
