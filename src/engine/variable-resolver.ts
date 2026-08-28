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

  let current: any = obj;
  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    // Prevent Prototype Pollution
    if (segment === '__proto__' || segment === 'constructor' || segment === 'prototype') {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

export interface VariableReference {
  raw: string;
  nodeId: string;
  propertyPath: string;
  defaultValue?: string;
}

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
  context: Record<string, Record<string, unknown>>
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
 */
export function resolveObjectVariables<T>(
  data: T,
  context: Record<string, Record<string, unknown>>
): T {
  if (typeof data === 'string') {
    return resolveTemplateVariables(data, context) as unknown as T;
  }

  if (Array.isArray(data)) {
    return data.map(item => resolveObjectVariables(item, context)) as unknown as T;
  }

  if (data !== null && typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data)) {
      result[key] = resolveObjectVariables(val, context);
    }
    return result as T;
  }

  return data;
}
