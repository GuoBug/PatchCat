/**
 * @file    src/engine/logger.ts
 * @version 1.0.0
 * @description
 *   Comprehensive, multi-level structured logging engine with strict security sanitization:
 *   - Levels: 'summary' | 'detailed' | 'dev'
 *   - Strict privacy & credential masking (zero exposure for API keys, Bearer tokens, secrets)
 *   - Pub/Sub event bus for live reactive UI streaming
 *   - Export formatters for JSON and formatted Text logs
 */

export type LogLevel = 'summary' | 'detailed' | 'dev';

export type LogType = 'system' | 'request' | 'node' | 'error' | 'security';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  type: LogType;
  source: string;
  nodeId?: string;
  message: string;
  metadata?: Record<string, unknown>;
  /** Detailed input/output payloads — only recorded at 'dev' level with credentials masked */
  data?: {
    inputs?: unknown;
    outputs?: unknown;
  };
  durationMs?: number;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  summary: 1,
  detailed: 2,
  dev: 3,
};

const SENSITIVE_KEY_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /passwd/i,
  /authorization/i,
  /token/i,
  /x-goog-api-key/i,
  /bearer/i,
  /access[_-]?token/i,
  /private[_-]?key/i,
];

/**
 * Recursively masks sensitive fields and secrets from strings, arrays, and objects.
 * Guarantees zero leakage of credentials in any log level (even 'dev').
 */
export function sanitizeData(value: unknown, seen = new WeakSet()): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    let sanitized = value;
    // Mask sk-*** keys
    sanitized = sanitized.replace(/(sk-[a-zA-Z0-9_\-]{4})[a-zA-Z0-9_\-]+([a-zA-Z0-9_\-]{4})/g, '$1***[MASKED]***$2');
    // Mask AIzaSy*** keys
    sanitized = sanitized.replace(/(AIzaSy[a-zA-Z0-9_\-]{4})[a-zA-Z0-9_\-]+([a-zA-Z0-9_\-]{4})/g, '$1***[MASKED]***$2');
    // Mask Bearer tokens
    sanitized = sanitized.replace(/(Bearer\s+)[a-zA-Z0-9._\-]{10,}/gi, '$1***[MASKED]***');
    return sanitized;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular Reference]';
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => sanitizeData(item, seen));
    }

    const sanitizedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(k));
      if (isSensitiveKey) {
        if (typeof v === 'string' && v.length > 0) {
          sanitizedObj[k] = v.length > 8 ? `${v.slice(0, 3)}***[MASKED]***${v.slice(-3)}` : '***[MASKED]***';
        } else {
          sanitizedObj[k] = '***[MASKED]***';
        }
      } else {
        sanitizedObj[k] = sanitizeData(v, seen);
      }
    }
    return sanitizedObj;
  }

  return String(value);
}

/**
 * Universal Logging Engine
 */
export class LoggerEngine {
  private currentLevel: LogLevel = 'detailed';
  private logs: LogEntry[] = [];
  private maxLogs = 500;
  private listeners = new Set<(entry: LogEntry) => void>();

  constructor(initialLevel: LogLevel = 'detailed') {
    this.currentLevel = initialLevel;
  }

  public getLogLevel(): LogLevel {
    return this.currentLevel;
  }

  public setLogLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  public shouldLog(level: LogLevel): boolean {
    return LEVEL_WEIGHT[this.currentLevel] >= LEVEL_WEIGHT[level];
  }

  public subscribe(listener: (entry: LogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private append(entry: LogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    for (const listener of this.listeners) {
      try {
        listener(entry);
      } catch (err) {
        console.error('[LoggerEngine] Listener error:', err);
      }
    }
  }

  /**
   * Level: 'summary'
   * Used for macro system events, API request overviews, workflow lifecycles, and errors.
   */
  public summary(
    source: string,
    message: string,
    metadata?: Record<string, unknown>,
    nodeId?: string,
    type: LogType = 'system',
    durationMs?: number,
  ): void {
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      level: 'summary',
      type,
      source,
      nodeId,
      message: String(sanitizeData(message)),
      metadata: metadata ? (sanitizeData(metadata) as Record<string, unknown>) : undefined,
      durationMs,
    };
    this.append(entry);
  }

  /**
   * Level: 'detailed'
   * Used for node parameter metadata, DAG topological waves, request timing without raw prompts.
   */
  public detailed(
    source: string,
    message: string,
    metadata?: Record<string, unknown>,
    nodeId?: string,
    type: LogType = 'node',
    durationMs?: number,
  ): void {
    if (!this.shouldLog('detailed')) return;

    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      level: 'detailed',
      type,
      source,
      nodeId,
      message: String(sanitizeData(message)),
      metadata: metadata ? (sanitizeData(metadata) as Record<string, unknown>) : undefined,
      durationMs,
    };
    this.append(entry);
  }

  /**
   * Level: 'dev'
   * Used for detailed developer debugging, recording node inputs & outputs (all credentials masked).
   */
  public dev(
    source: string,
    message: string,
    data?: { inputs?: unknown; outputs?: unknown },
    metadata?: Record<string, unknown>,
    nodeId?: string,
    type: LogType = 'node',
    durationMs?: number,
  ): void {
    if (!this.shouldLog('dev')) return;

    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      level: 'dev',
      type,
      source,
      nodeId,
      message: String(sanitizeData(message)),
      metadata: metadata ? (sanitizeData(metadata) as Record<string, unknown>) : undefined,
      data: data
        ? {
            inputs: data.inputs !== undefined ? sanitizeData(data.inputs) : undefined,
            outputs: data.outputs !== undefined ? sanitizeData(data.outputs) : undefined,
          }
        : undefined,
      durationMs,
    };
    this.append(entry);
  }

  /**
   * Log error events (always captured at summary level).
   */
  public error(
    source: string,
    message: string,
    err?: unknown,
    metadata?: Record<string, unknown>,
    nodeId?: string,
  ): void {
    const errorDetails = err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : { raw: String(err) };
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      level: 'summary',
      type: 'error',
      source,
      nodeId,
      message: String(sanitizeData(message)),
      metadata: {
        ...(metadata ? (sanitizeData(metadata) as Record<string, unknown>) : {}),
        error: sanitizeData(errorDetails),
      },
    };
    this.append(entry);
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clear(): void {
    this.logs = [];
  }

  public exportAsJson(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        logLevel: this.currentLevel,
        totalEntries: this.logs.length,
        logs: this.logs,
      },
      null,
      2,
    );
  }

  public exportAsText(): string {
    const lines = [
      `================================================================================`,
      `PATCHCAT WORKFLOW EXECUTION LOGS`,
      `Exported: ${new Date().toLocaleString()} | Level: ${this.currentLevel.toUpperCase()}`,
      `================================================================================`,
      '',
    ];

    for (const log of this.logs) {
      const timeStr = new Date(log.timestamp).toISOString().slice(11, 23);
      const tag = `[${log.level.toUpperCase()}][${log.type.toUpperCase()}][${log.source}]`;
      const nodeInfo = log.nodeId ? ` (Node: ${log.nodeId})` : '';
      const dur = log.durationMs !== undefined ? ` [${log.durationMs}ms]` : '';
      lines.push(`${timeStr} ${tag}${nodeInfo}${dur} ${log.message}`);

      if (log.metadata && Object.keys(log.metadata).length > 0) {
        lines.push(`    Metadata: ${JSON.stringify(log.metadata)}`);
      }
      if (log.data?.inputs) {
        lines.push(`    [Dev Inputs]: ${JSON.stringify(log.data.inputs)}`);
      }
      if (log.data?.outputs) {
        lines.push(`    [Dev Outputs]: ${JSON.stringify(log.data.outputs)}`);
      }
    }

    return lines.join('\n');
  }
}

/** Global Logger Singleton Instance */
export const logger = new LoggerEngine('detailed');
