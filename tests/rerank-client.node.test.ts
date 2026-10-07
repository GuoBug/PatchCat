/**
 * @file tests/rerank-client.node.test.ts
 * @description Offline contract tests for the Cross-Encoder rerank client.
 *              Every provider is stubbed — no network, no API keys, deterministic.
 */

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  RerankError,
  buildRerankBody,
  getRerankUrl,
  parseRerankResponse,
  rerankDocuments,
  sigmoid,
  type RerankClientConfig,
  type RerankDocument,
} from '../src/engine/rerank-client.ts';

const originalFetch = globalThis.fetch;

interface FetchCall {
  url: string;
  init: RequestInit;
}

function stubFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>): FetchCall[] {
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const safeInit = init ?? {};
    calls.push({ url, init: safeInit });
    return handler(url, safeInit);
  }) as typeof globalThis.fetch;
  return calls;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const DOCS: RerankDocument[] = [
  { id: 'a', text: 'alpha' },
  { id: 'b', text: 'beta' },
  { id: 'c', text: 'gamma' },
];

const BASE_CONFIG: RerankClientConfig = {
  protocol: 'cohere',
  baseUrl: 'https://api.cohere.com',
  model: 'rerank-v3.5',
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('Rerank Client — protocol normalisation', () => {
  it('should resolve the correct endpoint for every protocol', () => {
    assert.equal(getRerankUrl('cohere', 'https://api.cohere.com'), 'https://api.cohere.com/v2/rerank');
    assert.equal(getRerankUrl('jina', 'https://api.jina.ai'), 'https://api.jina.ai/v1/rerank');
    assert.equal(getRerankUrl('openai', 'https://api.siliconflow.cn'), 'https://api.siliconflow.cn/v1/rerank');
    assert.equal(getRerankUrl('tei', 'http://localhost:8080'), 'http://localhost:8080/rerank');
  });

  it('should not double-append the path when baseUrl already contains it', () => {
    assert.equal(getRerankUrl('cohere', 'https://api.cohere.com/v2/rerank'), 'https://api.cohere.com/v2/rerank');
    assert.equal(getRerankUrl('jina', 'https://api.jina.ai/v1/rerank'), 'https://api.jina.ai/v1/rerank');
    assert.equal(getRerankUrl('tei', 'http://localhost:8080/rerank/'), 'http://localhost:8080/rerank');
    assert.equal(getRerankUrl('cohere', 'https://api.cohere.com/v2/'), 'https://api.cohere.com/v2/rerank');
  });

  it('should tolerate a baseUrl that already carries the /v1 version prefix', () => {
    // The settings store persists `https://api.siliconflow.cn/v1`, so the
    // OpenAI-compatible branch must not resolve to `/v1/v1/rerank`.
    assert.equal(
      getRerankUrl('openai', 'https://api.siliconflow.cn/v1'),
      'https://api.siliconflow.cn/v1/rerank',
    );
    assert.equal(
      getRerankUrl('openai', 'https://api.siliconflow.cn/v1/'),
      'https://api.siliconflow.cn/v1/rerank',
    );
    assert.equal(
      getRerankUrl('openai', 'https://api.siliconflow.cn/v1/rerank'),
      'https://api.siliconflow.cn/v1/rerank',
    );
    assert.equal(
      getRerankUrl('openai', 'https://api.siliconflow.cn'),
      'https://api.siliconflow.cn/v1/rerank',
    );
  });

  it('should reject an unrecognised protocol instead of resolving to fetch("undefined")', () => {
    assert.throws(
      () => getRerankUrl('gemini-rerank' as never, 'https://example.com'),
      (err: unknown) => {
        assert.ok(err instanceof RerankError, 'must be a RerankError');
        assert.equal(err.retriable, false);
        assert.match(err.message, /Unsupported rerank protocol/);
        assert.match(err.message, /gemini-rerank/);
        return true;
      },
    );
  });

  it('should build a texts/raw_scores body for TEI and a documents/top_n body for the rest', () => {
    const tei = buildRerankBody('tei', 'q', ['x', 'y'], 'bge-reranker', 2);
    assert.deepEqual(tei, { query: 'q', texts: ['x', 'y'], truncate: true, raw_scores: true });
    assert.equal('model' in tei, false, 'TEI has no model field in the rerank body');

    const cohere = buildRerankBody('cohere', 'q', ['x', 'y'], 'rerank-v3.5', 2);
    assert.deepEqual(cohere, { model: 'rerank-v3.5', query: 'q', documents: ['x', 'y'], top_n: 2 });

    const openai = buildRerankBody('openai', 'q', ['x'], 'bge-reranker-v2-m3', 1);
    assert.equal(openai['return_documents'], false);
  });

  it('should parse a Cohere/Jina/OpenAI style { results: [{ relevance_score }] } body', () => {
    const items = parseRerankResponse(
      { results: [{ index: 2, relevance_score: 0.91 }, { index: 0, relevance_score: 0.12 }] },
      DOCS,
    );
    assert.equal(items.length, 2);
    assert.deepEqual(
      items.map((i) => [i.index, i.score]),
      [[2, 0.91], [0, 0.12]],
    );
    assert.equal(items[0].document?.id, 'c', 'index must map back to the original input document');
  });

  it('should parse a bare TEI array [{ index, score }]', () => {
    const items = parseRerankResponse([{ index: 1, score: 2.0 }, { index: 0, score: -3.42 }], DOCS);
    assert.equal(items.length, 2);
    assert.equal(items[0].score, 2.0);
    assert.equal(items[1].score, -3.42);
  });

  it('should drop malformed entries instead of producing NaN scores', () => {
    const items = parseRerankResponse(
      { results: [{ index: 0, relevance_score: 0.5 }, { index: 'nope' }, null, { relevance_score: 0.9 }] },
      DOCS,
    );
    assert.equal(items.length, 1);
    assert.equal(items[0].index, 0);
  });

  it('should map raw logits into [0, 1] with a numerically stable sigmoid', () => {
    assert.ok(Math.abs(sigmoid(0) - 0.5) < 1e-9);
    assert.ok(Math.abs(sigmoid(2) - 0.880797) < 1e-5);
    assert.ok(Math.abs(sigmoid(-3.42) - 0.031668) < 1e-5);
    assert.equal(sigmoid(1000), 1, 'must not overflow to NaN on large positive logits');
    assert.ok(sigmoid(-1000) >= 0 && sigmoid(-1000) < 1e-9, 'must not underflow to NaN');
  });
});

describe('Rerank Client — request execution', () => {
  it('should send an Authorization header only when an apiKey is present', async () => {
    const calls = stubFetch(() => jsonResponse({ results: [{ index: 0, relevance_score: 0.5 }] }));

    await rerankDocuments({ query: 'q', documents: DOCS }, BASE_CONFIG);
    const withKey = await rerankDocuments(
      { query: 'q', documents: DOCS },
      { ...BASE_CONFIG, apiKey: '  secret-key  ' },
    );
    assert.equal(withKey.results.length, 1);

    const headersWithout = calls[0].init.headers as Record<string, string>;
    const headersWith = calls[1].init.headers as Record<string, string>;
    assert.equal(headersWithout['Authorization'], undefined);
    assert.equal(headersWith['Authorization'], 'Bearer secret-key', 'apiKey must be trimmed');
  });

  it('should sort by score descending and truncate to topN', async () => {
    stubFetch(() =>
      jsonResponse({
        results: [
          { index: 0, relevance_score: 0.2 },
          { index: 1, relevance_score: 0.95 },
          { index: 2, relevance_score: 0.6 },
        ],
      }),
    );

    const response = await rerankDocuments({ query: 'q', documents: DOCS, topN: 2 }, BASE_CONFIG);
    assert.deepEqual(
      response.results.map((r) => r.index),
      [1, 2],
    );
    assert.equal(response.results.length, 2);
    assert.equal(response.protocol, 'cohere');
    assert.equal(response.normalized, false);
  });

  it('should normalise TEI logits by default and keep them raw when opted out', async () => {
    stubFetch(() =>
      jsonResponse([
        { index: 0, score: -3.42 },
        { index: 1, score: 2.0 },
      ]),
    );

    const normalised = await rerankDocuments(
      { query: 'q', documents: DOCS },
      { ...BASE_CONFIG, protocol: 'tei', baseUrl: 'http://localhost:8080', model: 'bge-reranker-v2-m3' },
    );
    assert.equal(normalised.normalized, true);
    assert.equal(normalised.results[0].index, 1, 'logit 2.0 must outrank logit -3.42');
    assert.ok(
      normalised.results.every((r) => r.score >= 0 && r.score <= 1),
      'normalised scores must live in [0, 1]',
    );

    const raw = await rerankDocuments(
      { query: 'q', documents: DOCS },
      {
        ...BASE_CONFIG,
        protocol: 'tei',
        baseUrl: 'http://localhost:8080',
        model: 'bge-reranker-v2-m3',
        normalizeScores: false,
      },
    );
    assert.equal(raw.normalized, false);
    assert.equal(raw.results[0].score, 2.0, 'raw logits must pass through untouched');
  });

  it('should short-circuit on an empty candidate list without calling the endpoint', async () => {
    const calls = stubFetch(() => jsonResponse({ results: [] }));

    const response = await rerankDocuments({ query: 'q', documents: [] }, BASE_CONFIG);
    assert.equal(calls.length, 0, 'no network call for zero candidates');
    assert.deepEqual(response.results, []);
    assert.equal(response.latencyMs, 0);
  });
});

describe('Rerank Client — failure containment', () => {
  it('should reject with a retriable RerankError when the watchdog fires', async () => {
    globalThis.fetch = ((_input: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted by watchdog')));
      })) as typeof globalThis.fetch;

    await assert.rejects(
      () => rerankDocuments({ query: 'q', documents: DOCS }, { ...BASE_CONFIG, timeoutMs: 25 }),
      (err: unknown) => {
        assert.ok(err instanceof RerankError, 'must be a RerankError, not a raw fetch error');
        assert.equal(err.retriable, true);
        assert.match(err.message, /timed out after 25ms/);
        return true;
      },
    );
  });

  it('should classify 429 as retriable and 401 as non-retriable', async () => {
    stubFetch(() => new Response('rate limited', { status: 429 }));
    await assert.rejects(
      () => rerankDocuments({ query: 'q', documents: DOCS }, BASE_CONFIG),
      (err: unknown) => {
        assert.ok(err instanceof RerankError);
        assert.equal(err.status, 429);
        assert.equal(err.retriable, true);
        return true;
      },
    );

    stubFetch(() => new Response('unauthorized', { status: 401 }));
    await assert.rejects(
      () => rerankDocuments({ query: 'q', documents: DOCS }, BASE_CONFIG),
      (err: unknown) => {
        assert.ok(err instanceof RerankError);
        assert.equal(err.status, 401);
        assert.equal(err.retriable, false);
        return true;
      },
    );
  });

  it('should reject with RerankError when the body is not JSON', async () => {
    stubFetch(() => new Response('<html>gateway error</html>', { status: 200 }));
    await assert.rejects(
      () => rerankDocuments({ query: 'q', documents: DOCS }, BASE_CONFIG),
      (err: unknown) => err instanceof RerankError && /non-JSON/.test(err.message),
    );
  });

  it('should reject with RerankError when the provider returns zero usable results', async () => {
    stubFetch(() => jsonResponse({ results: [] }));
    await assert.rejects(
      () => rerankDocuments({ query: 'q', documents: DOCS }, BASE_CONFIG),
      (err: unknown) => err instanceof RerankError && /no usable results/.test(err.message),
    );
  });

  it('should propagate a caller abort signal and classify it as non-retriable', async () => {
    globalThis.fetch = ((_input: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as typeof globalThis.fetch;

    const controller = new AbortController();
    const pending = rerankDocuments(
      { query: 'q', documents: DOCS, signal: controller.signal },
      BASE_CONFIG,
    );
    controller.abort();

    await assert.rejects(
      () => pending,
      (err: unknown) => {
        assert.ok(err instanceof RerankError);
        assert.equal(err.retriable, false);
        assert.match(err.message, /aborted by caller/);
        return true;
      },
    );
  });

  it('should reject with a retriable RerankError on transport failure', async () => {
    stubFetch(() => {
      throw new Error('ECONNREFUSED');
    });
    await assert.rejects(
      () => rerankDocuments({ query: 'q', documents: DOCS }, BASE_CONFIG),
      (err: unknown) => {
        assert.ok(err instanceof RerankError);
        assert.equal(err.retriable, true);
        assert.match(err.message, /Failed to reach rerank endpoint/);
        return true;
      },
    );
  });
});
