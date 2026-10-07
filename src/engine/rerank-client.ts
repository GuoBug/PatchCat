/**
 * @file    src/engine/rerank-client.ts
 * @version 1.0.0
 * @description
 *   Universal Cross-Encoder Rerank Client. Flattens the divergent rerank wire
 *   protocols of Cohere, Jina AI, HuggingFace TEI and OpenAI-compatible rerank
 *   endpoints (e.g. SiliconFlow) into a single request/response shape.
 *
 *   Transport only: this module knows how to talk to a rerank endpoint and how
 *   to normalise what comes back. It does NOT decide whether reranking should
 *   happen — that policy belongs to the retrieval layer.
 */

import { logger } from './logger.ts';
import { RUNTIME_DEFAULTS } from '../config/runtime-defaults.ts';

export type RerankProtocol = 'cohere' | 'jina' | 'tei' | 'openai';

export interface RerankDocument {
  id?: string;
  text: string;
}

export interface RerankRequest {
  query: string;
  documents: RerankDocument[];
  topN?: number;
  /** Overrides `RerankClientConfig.model` when provided. */
  model?: string;
  signal?: AbortSignal;
}

export interface RerankResultItem {
  /** Position of the document within the *input* array, not the reranked order. */
  index: number;
  /** Relevance score. Mapped into [0, 1] unless `normalizeScores: false`. */
  score: number;
  document?: RerankDocument;
}

export interface RerankResponse {
  results: RerankResultItem[];
  model: string;
  protocol: RerankProtocol;
  /** Whether raw provider scores were mapped into [0, 1] via a sigmoid. */
  normalized: boolean;
  latencyMs: number;
}

export interface RerankClientConfig {
  protocol: RerankProtocol;
  baseUrl: string;
  apiKey?: string;
  model: string;
  /** Watchdog budget in ms. Defaults to `RUNTIME_DEFAULTS.RERANK_TIMEOUT_MS`. */
  timeoutMs?: number;
  /**
   * Force sigmoid mapping of raw scores into [0, 1].
   * Defaults to `true` for `tei` (which returns raw logits) and `false` otherwise.
   */
  normalizeScores?: boolean;
}

export interface RerankErrorOptions {
  protocol: RerankProtocol;
  url: string;
  status?: number;
  /** Whether retrying the same request could plausibly succeed. */
  retriable: boolean;
  cause?: unknown;
}

/**
 * Raised for every rerank failure. Callers are expected to catch this and fall
 * back to the coarse-stage ordering — never let it escape into the DAG runner.
 */
export class RerankError extends Error {
  readonly protocol: RerankProtocol;
  readonly url: string;
  readonly status?: number;
  readonly retriable: boolean;

  constructor(message: string, options: RerankErrorOptions) {
    super(message);
    this.name = 'RerankError';
    this.protocol = options.protocol;
    this.url = options.url;
    this.status = options.status;
    this.retriable = options.retriable;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

/** Numerically stable logistic function. */
export function sigmoid(x: number): number {
  if (x >= 0) {
    return 1 / (1 + Math.exp(-x));
  }
  const exp = Math.exp(x);
  return exp / (1 + exp);
}

/**
 * Resolves the exact rerank endpoint for a protocol, tolerating a baseUrl that
 * already includes part or all of the path.
 */
export function getRerankUrl(protocol: RerankProtocol, baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, '');
  switch (protocol) {
    case 'cohere':
      if (clean.endsWith('/rerank')) return clean;
      if (clean.endsWith('/v1') || clean.endsWith('/v2')) return `${clean}/rerank`;
      return `${clean}/v2/rerank`;
    case 'jina':
      if (clean.endsWith('/rerank')) return clean;
      if (clean.endsWith('/v1')) return `${clean}/rerank`;
      return `${clean}/v1/rerank`;
    case 'tei':
      return clean.endsWith('/rerank') ? clean : `${clean}/rerank`;
    case 'openai':
      return clean.endsWith('/rerank') ? clean : `${clean}/v1/rerank`;
  }
}

/**
 * Builds the protocol-specific request body.
 *
 * `tei` takes `texts` and needs `raw_scores` so the score domain is predictable
 * (raw logits we normalise ourselves) rather than model-dependent.
 * Everything else takes `documents` as a plain string array.
 */
export function buildRerankBody(
  protocol: RerankProtocol,
  query: string,
  texts: string[],
  model: string,
  topN: number,
): Record<string, unknown> {
  if (protocol === 'tei') {
    return { query, texts, truncate: true, raw_scores: true };
  }
  const body: Record<string, unknown> = { model, query, documents: texts, top_n: topN };
  if (protocol === 'openai') {
    body['return_documents'] = false;
  }
  return body;
}

/**
 * Normalises both response shapes:
 *   - Cohere / Jina / OpenAI-compatible: `{ results: [{ index, relevance_score }] }`
 *   - HuggingFace TEI:                    `[{ index, score }]` (bare array)
 */
export function parseRerankResponse(
  json: unknown,
  documents: RerankDocument[],
): RerankResultItem[] {
  const rawList: unknown[] = Array.isArray(json)
    ? json
    : Array.isArray((json as { results?: unknown[] } | null)?.results)
      ? (json as { results: unknown[] }).results
      : [];

  const items: RerankResultItem[] = [];
  for (const entry of rawList) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const index = typeof record['index'] === 'number' ? record['index'] : Number.NaN;
    const score =
      typeof record['relevance_score'] === 'number'
        ? (record['relevance_score'] as number)
        : typeof record['score'] === 'number'
          ? (record['score'] as number)
          : Number.NaN;
    if (!Number.isFinite(index) || !Number.isFinite(score)) continue;
    items.push({ index, score, document: documents[index] });
  }
  return items;
}

/**
 * Calls a Cross-Encoder rerank endpoint.
 *
 * Always rejects with a `RerankError` (never a raw fetch/parse error) so callers
 * can implement graceful degradation with a single catch.
 */
export async function rerankDocuments(
  request: RerankRequest,
  config: RerankClientConfig,
): Promise<RerankResponse> {
  const documents = request.documents ?? [];
  const model = request.model ?? config.model;
  const url = getRerankUrl(config.protocol, config.baseUrl);
  const timeoutMs = config.timeoutMs ?? RUNTIME_DEFAULTS.RERANK_TIMEOUT_MS;
  const shouldNormalize = config.normalizeScores ?? config.protocol === 'tei';
  const startTime = Date.now();

  if (documents.length === 0) {
    return {
      results: [],
      model,
      protocol: config.protocol,
      normalized: false,
      latencyMs: 0,
    };
  }

  const topN = Math.max(
    1,
    Math.min(request.topN ?? documents.length, documents.length),
  );
  const texts = documents.map((doc) => doc.text);
  const body = buildRerankBody(config.protocol, request.query, texts, model, topN);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = config.apiKey?.trim();
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // Watchdog: abort the request when the budget is exhausted, and propagate any
  // caller-supplied abort signal so cancellation stays cooperative.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const externalSignal = request.signal;
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (timedOut) {
      throw new RerankError(`Rerank request timed out after ${timeoutMs}ms (${url})`, {
        protocol: config.protocol,
        url,
        retriable: true,
        cause: err,
      });
    }
    if (externalSignal?.aborted) {
      throw new RerankError(`Rerank request aborted by caller (${url})`, {
        protocol: config.protocol,
        url,
        retriable: false,
        cause: err,
      });
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new RerankError(`Failed to reach rerank endpoint (${url}): ${message}`, {
      protocol: config.protocol,
      url,
      retriable: true,
      cause: err,
    });
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new RerankError(
      `Rerank endpoint returned ${response.status} ${response.statusText}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
      {
        protocol: config.protocol,
        url,
        status: response.status,
        retriable: response.status === 429 || response.status >= 500,
      },
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (err) {
    throw new RerankError(`Rerank endpoint returned a non-JSON body (${url})`, {
      protocol: config.protocol,
      url,
      retriable: false,
      cause: err,
    });
  }

  const parsed = parseRerankResponse(json, documents);
  if (parsed.length === 0) {
    throw new RerankError(`Rerank endpoint returned no usable results (${url})`, {
      protocol: config.protocol,
      url,
      retriable: false,
    });
  }

  const results = parsed
    .map((item) => ({
      ...item,
      score: shouldNormalize ? sigmoid(item.score) : item.score,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  const latencyMs = Date.now() - startTime;

  logger.detailed(
    'RerankClient',
    `Cross-Encoder 精排完成 -> ${model} (${config.protocol})`,
    {
      url,
      documents: documents.length,
      returned: results.length,
      normalized: shouldNormalize,
      latencyMs,
    },
    undefined,
    'request',
    latencyMs,
  );

  return {
    results,
    model,
    protocol: config.protocol,
    normalized: shouldNormalize,
    latencyMs,
  };
}
