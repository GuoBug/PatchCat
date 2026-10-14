/**
 * @file    src/services/embedding/browser-embedding-client.ts
 * @version 1.0.0
 * @description
 *   Pure-frontend multi-provider embedding client for browser-native RAG.
 *   Directly connects to SiliconFlow, local Ollama (localhost:11434), and OpenAI endpoints.
 *   Enforces strict index-based sorting (P1-A), L2 pre-normalization, dimension auto-detection,
 *   and actionable Ollama CORS error diagnostics. Conforms to PRD-019 §4.1.
 */

import { l2Normalize } from '../search/flat-vector-index.ts';

export interface EmbeddingConfig {
  provider: 'siliconflow' | 'openai' | 'ollama' | 'custom' | string;
  model: string;
  dimension?: number;
  baseUrl?: string;
  apiKey?: string;
  batchSize?: number;
  timeoutMs?: number;
}

export type EmbeddingErrorType =
  | 'OLLAMA_CORS_BLOCKED'
  | 'OLLAMA_UNREACHABLE'
  | 'AUTH_ERROR'
  | 'RATE_LIMITED'
  | 'DIMENSION_MISMATCH'
  | 'NETWORK_ERROR'
  | 'PROVIDER_ERROR';

export class EmbeddingError extends Error {
  public type: EmbeddingErrorType;
  public status?: number;
  public provider: string;
  public remediation?: string;

  constructor(options: {
    message: string;
    type: EmbeddingErrorType;
    status?: number;
    provider: string;
    remediation?: string;
  }) {
    super(options.message);
    this.name = 'EmbeddingError';
    this.type = options.type;
    this.status = options.status;
    this.provider = options.provider;
    this.remediation = options.remediation;
  }
}

/**
 * Standard preset dimension dictionary for popular embedding models.
 */
export const KNOWN_EMBEDDING_DIMENSIONS: Record<string, number> = {
  // SiliconFlow / BAAI
  'BAAI/bge-m3': 1024,
  'BAAI/bge-large-zh-v1.5': 1024,
  'BAAI/bge-small-zh-v1.5': 512,
  'netease-youdao/bce-embedding-base_v1': 768,
  // OpenAI
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
  // Ollama
  'nomic-embed-text': 768,
  'bge-m3': 1024,
  'bge-large': 1024,
  'mxbai-embed-large': 1024,
  'all-minilm': 384,
};

/**
 * Resolves the embedding dimension for a given model, or returns undefined if unknown.
 */
export function resolveModelDimension(
  provider: string,
  model: string,
  configuredDimension?: number,
): number | undefined {
  if (typeof configuredDimension === 'number' && configuredDimension > 0) {
    return configuredDimension;
  }
  const cleanModel = (model || '').trim();
  if (KNOWN_EMBEDDING_DIMENSIONS[cleanModel]) {
    return KNOWN_EMBEDDING_DIMENSIONS[cleanModel];
  }
  // Try lowercase lookup
  const lower = cleanModel.toLowerCase();
  for (const [k, dim] of Object.entries(KNOWN_EMBEDDING_DIMENSIONS)) {
    if (k.toLowerCase() === lower || lower.endsWith(k.toLowerCase())) {
      return dim;
    }
  }
  // Provider-level defaults
  if (provider === 'openai') return 1536;
  if (provider === 'siliconflow') return 1024;
  if (provider === 'ollama') return 768;
  return undefined;
}

export interface IBrowserEmbeddingClient {
  detectDimension(config: EmbeddingConfig): Promise<number>;
  embedQuery(text: string, config: EmbeddingConfig): Promise<Float32Array>;
  embedBatch(
    texts: string[],
    config: EmbeddingConfig,
    onProgress?: (done: number, total: number) => void,
  ): Promise<Float32Array[]>;
}

export class BrowserEmbeddingClient implements IBrowserEmbeddingClient {
  private timeoutMs: number;

  constructor(timeoutMs = 30000) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Resolves or auto-detects embedding dimension.
   * If not explicitly specified or in the known presets, probes with a single dummy call and caches it.
   */
  public async detectDimension(config: EmbeddingConfig): Promise<number> {
    const resolved = resolveModelDimension(config.provider, config.model, config.dimension);
    if (resolved) {
      return resolved;
    }
    // Probe dimension via a lightweight query embedding
    const probeVec = await this.embedQuery('probe', config);
    const dim = probeVec.length;
    if (dim > 0 && config.model) {
      KNOWN_EMBEDDING_DIMENSIONS[config.model.trim()] = dim;
    }
    return dim;
  }

  /**
   * Generates a single normalized Float32Array embedding vector for a query string.
   */
  public async embedQuery(text: string, config: EmbeddingConfig): Promise<Float32Array> {
    const cleanText = text.trim();
    if (!cleanText) {
      // Deterministic zero vector fallback for empty query
      const dim = config.dimension || resolveModelDimension(config.provider, config.model) || 1024;
      const zero = new Float32Array(dim);
      zero[0] = 1.0;
      return zero;
    }

    const results = await this.embedBatchInternal([cleanText], config);
    if (!results[0]) {
      throw new EmbeddingError({
        message: `No embedding vector returned by provider "${config.provider}"`,
        type: 'PROVIDER_ERROR',
        provider: config.provider,
      });
    }
    return results[0];
  }

  /**
   * Generates normalized Float32Array embedding vectors for an array of text chunks.
   * Chunks large requests into sub-batches and guarantees strict index-based ordering (P1-A).
   */
  public async embedBatch(
    texts: string[],
    config: EmbeddingConfig,
    onProgress?: (done: number, total: number) => void,
  ): Promise<Float32Array[]> {
    if (texts.length === 0) {
      return [];
    }

    const batchSize = Math.max(1, Math.min(64, config.batchSize || 16));
    const allResults: Float32Array[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const slice = texts.slice(i, i + batchSize);
      const subResults = await this.embedBatchInternal(slice, config);
      allResults.push(...subResults);
      if (onProgress) {
        onProgress(Math.min(i + slice.length, texts.length), texts.length);
      }
    }

    return allResults;
  }

  private async embedBatchInternal(
    texts: string[],
    config: EmbeddingConfig,
  ): Promise<Float32Array[]> {
    const provider = (config.provider || 'siliconflow').toLowerCase();
    const endpoint = this.resolveEndpoint(provider, config.baseUrl);
    const timeout = config.timeoutMs || this.timeoutMs;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey && config.apiKey.trim()) {
      headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
    }

    // Format request payload based on endpoint type
    const isOllamaNative = provider === 'ollama' && endpoint.includes('/api/');
    let body: string;

    if (isOllamaNative) {
      // Ollama /api/embed (batch) or /api/embeddings (single)
      if (endpoint.endsWith('/api/embed')) {
        body = JSON.stringify({
          model: config.model || 'nomic-embed-text',
          input: texts,
        });
      } else {
        // Fallback for single /api/embeddings if legacy
        body = JSON.stringify({
          model: config.model || 'nomic-embed-text',
          prompt: texts[0] || '',
        });
      }
    } else {
      // Standard OpenAI-compatible /v1/embeddings format
      body = JSON.stringify({
        model: config.model || (provider === 'siliconflow' ? 'BAAI/bge-m3' : 'text-embedding-3-small'),
        input: texts,
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      this.handleFetchError(err, provider, endpoint);
      throw err; // unreachable, handleFetchError throws
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      let errDetail: string;
      try {
        const errJson = await res.json();
        errDetail = errJson.error?.message || errJson.message || JSON.stringify(errJson);
      } catch {
        errDetail = await res.text().catch(() => '');
      }

      if (res.status === 401 || res.status === 403) {
        throw new EmbeddingError({
          message: `Authentication failed for provider "${provider}" (${res.status}): ${errDetail}`,
          type: 'AUTH_ERROR',
          status: res.status,
          provider,
          remediation: '请检查设置中配置的 API Key 是否有效。',
        });
      }

      if (res.status === 429) {
        throw new EmbeddingError({
          message: `Rate limit exceeded for provider "${provider}" (429): ${errDetail}`,
          type: 'RATE_LIMITED',
          status: 429,
          provider,
          remediation: '请求过于频繁或配额不足，请稍后重试或切换服务商。',
        });
      }

      throw new EmbeddingError({
        message: `Embedding request failed (${res.status}): ${errDetail || res.statusText}`,
        type: 'PROVIDER_ERROR',
        status: res.status,
        provider,
      });
    }

    const json = await res.json();
    return this.parseAndNormalizeEmbeddings(json, texts.length, provider);
  }

  /**
   * Parses JSON response, sorts items strictly by index, and returns L2-normalized Float32Arrays.
   * Conforms to P1-A hard contract.
   */
  private parseAndNormalizeEmbeddings(
    json: unknown,
    _expectedCount: number,
    provider: string,
  ): Float32Array[] {
    const raw = (json && typeof json === 'object' ? json : null) as Record<string, unknown> | null;

    // Case 1: Standard OpenAI-compatible format { data: [{ embedding: number[], index: number }] }
    if (raw && Array.isArray(raw.data)) {
      const items = raw.data as Array<{ embedding: number[]; index?: number }>;
      // Sort strictly by index to prevent chunk-vector misplacement (P1-A)
      items.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

      return items.map((item) => l2Normalize(item.embedding));
    }

    // Case 2: Ollama /api/embed format { embeddings: number[][] }
    if (raw && Array.isArray(raw.embeddings)) {
      return (raw.embeddings as number[][]).map((emb: number[]) => l2Normalize(emb));
    }

    // Case 3: Ollama legacy /api/embeddings format { embedding: number[] }
    if (raw && Array.isArray(raw.embedding)) {
      return [l2Normalize(raw.embedding as number[])];
    }

    throw new EmbeddingError({
      message: `Invalid embedding response payload from "${provider}": missing "data" or "embeddings" array`,
      type: 'PROVIDER_ERROR',
      provider,
    });
  }

  private resolveEndpoint(provider: string, customBaseUrl?: string): string {
    if (customBaseUrl && customBaseUrl.trim()) {
      const clean = customBaseUrl.trim().replace(/\/+$/, '');
      if (clean.endsWith('/embeddings') || clean.endsWith('/embed')) {
        return clean;
      }
      return `${clean}/embeddings`;
    }

    if (provider === 'siliconflow') {
      return 'https://api.siliconflow.cn/v1/embeddings';
    }
    if (provider === 'openai') {
      return 'https://api.openai.com/v1/embeddings';
    }
    if (provider === 'ollama') {
      // Connect to Ollama's OpenAI-compatible endpoint by default, allowing standard batching
      return 'http://localhost:11434/v1/embeddings';
    }

    // Default to OpenAI compatible
    return 'https://api.openai.com/v1/embeddings';
  }

  private handleFetchError(err: unknown, provider: string, endpoint: string): never {
    const errorStr = String(err);
    const isLocalhost = endpoint.includes('localhost') || endpoint.includes('127.0.0.1');

    if (isLocalhost) {
      throw new EmbeddingError({
        message: `无法连接到本地 Ollama 服务 (${endpoint})。可能是服务未启动或被浏览器的跨域策略 (CORS) 拦截。`,
        type: 'OLLAMA_CORS_BLOCKED',
        provider,
        remediation:
          '1. 请确认本地 Ollama 已启动 (ollama serve)；\n' +
          '2. 请配置允许跨域环境变量：\n' +
          '   • Windows PowerShell: [System.Environment]::SetEnvironmentVariable(\'OLLAMA_ORIGINS\', \'http://localhost:5173\', \'User\')\n' +
          '   • macOS / Linux: OLLAMA_ORIGINS="http://localhost:5173" ollama serve\n' +
          '3. 重启 Ollama 服务后重试。',
      });
    }

    throw new EmbeddingError({
      message: `网络请求失败 (${provider}): ${errorStr}`,
      type: 'NETWORK_ERROR',
      provider,
      remediation: '请检查网络连接、跨域设置或代理服务。',
    });
  }
}

export const browserEmbeddingClient = new BrowserEmbeddingClient();
