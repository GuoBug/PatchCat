/**
 * @file    tests/llm-client.node.test.ts
 * @description
 *   Unit test suite for LLM Client & SSE Streaming:
 *   1. Endpoint URL normalization (Google Gemini, OpenAI, DeepSeek, custom).
 *   2. SSE token chunk streaming parser.
 *   3. DeepSeek R1 reasoning_content separation.
 *   4. AbortSignal mid-stream cooperative cancellation.
 *   5. HTTP error diagnostics and friendly error messages.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getChatCompletionsUrl,
  streamChatCompletion,
  type LLMStreamChunk,
} from '../src/engine/llm-client.ts';

describe('LLM Client & Endpoint Normalization', () => {
  it('should correctly normalize Google Gemini OpenAI endpoint', () => {
    const googleUrl = getChatCompletionsUrl('https://generativelanguage.googleapis.com/v1beta/openai');
    assert.equal(
      googleUrl,
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    );
  });

  it('should correctly normalize standard /v1 endpoints', () => {
    const openaiUrl = getChatCompletionsUrl('https://api.openai.com/v1');
    assert.equal(openaiUrl, 'https://api.openai.com/v1/chat/completions');

    const deepseekUrl = getChatCompletionsUrl('https://api.deepseek.com');
    assert.equal(deepseekUrl, 'https://api.deepseek.com/v1/chat/completions');

    const anthropicUrl = getChatCompletionsUrl('https://api.anthropic.com/v1');
    assert.equal(anthropicUrl, 'https://api.anthropic.com/v1/messages');
  });

  it('should leave already complete chat/completions URLs intact', () => {
    const fullUrl = 'https://custom.endpoint.com/v1/chat/completions';
    assert.equal(getChatCompletionsUrl(fullUrl), fullUrl);
  });
});

describe('LLM SSE Stream Parsing', () => {
  it('should parse streaming SSE chunks and emit onChunk callbacks', async () => {
    const ssePayload = [
      'data: {"id":"1","choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"id":"2","choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: {"id":"3","choices":[{"delta":{"content":"!"}}],"usage":{"prompt_tokens":10,"completion_tokens":3,"total_tokens":13}}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(ssePayload));
        controller.close();
      },
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });

    try {
      const chunks: LLMStreamChunk[] = [];
      const result = await streamChatCompletion(
        {
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
          apiKey: 'test-key',
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Say hello' }],
        },
        {
          onChunk: (c) => chunks.push({ ...c }),
        }
      );

      assert.equal(result.response, 'Hello world!');
      assert.equal(chunks.length, 3);
      assert.equal(chunks[0].delta, 'Hello');
      assert.equal(chunks[1].delta, ' world');
      assert.equal(chunks[2].delta, '!');
      assert.equal(chunks[2].fullContent, 'Hello world!');
      assert.equal(result.usage.total, 13);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should extract DeepSeek R1 reasoning_content alongside standard content', async () => {
    const ssePayload = [
      'data: {"choices":[{"delta":{"reasoning_content":"Let me think."}}]}\n\n',
      'data: {"choices":[{"delta":{"reasoning_content":" The answer is 42."}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"The final answer is 42."}}]}\n\n',
      'data: [DONE]\n\n',
    ].join('');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(ssePayload));
        controller.close();
      },
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });

    try {
      const chunks: LLMStreamChunk[] = [];
      const result = await streamChatCompletion(
        {
          baseUrl: 'https://api.deepseek.com',
          apiKey: 'test-key',
          model: 'deepseek-reasoner',
          messages: [{ role: 'user', content: 'Explain 42' }],
        },
        {
          onChunk: (c) => chunks.push({ ...c }),
        }
      );

      assert.equal(result.reasoning, 'Let me think. The answer is 42.');
      assert.equal(result.response, 'The final answer is 42.');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should parse Anthropic Claude streaming SSE events with thinking and usage', async () => {
    const anthropicSse = [
      'event: message_start\n',
      'data: {"type":"message_start","message":{"id":"msg_123","type":"message","role":"assistant","content":[],"model":"claude-3-7-sonnet-latest","usage":{"input_tokens":25,"output_tokens":1}}}\n\n',
      'event: content_block_delta\n',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Let me analyze this."}}\n\n',
      'event: content_block_delta\n',
      'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Hello Claude!"}}\n\n',
      'event: message_delta\n',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":18}}\n\n',
      'event: message_stop\n',
      'data: {"type":"message_stop"}\n\n',
    ].join('');

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(anthropicSse));
        controller.close();
      },
    });

    const originalFetch = globalThis.fetch;
    let capturedHeaders: HeadersInit | undefined;
    let capturedBody: string | undefined;

    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = init?.headers;
      capturedBody = init?.body as string;
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    };

    try {
      const chunks: LLMStreamChunk[] = [];
      const result = await streamChatCompletion(
        {
          baseUrl: 'https://api.anthropic.com/v1',
          apiKey: 'sk-ant-api03-test-token',
          model: 'claude-3-7-sonnet-latest',
          messages: [
            { role: 'system', content: 'You are Claude.' },
            { role: 'user', content: 'Hi' },
          ],
        },
        {
          onChunk: (c) => chunks.push({ ...c }),
        }
      );

      assert.equal(result.response, 'Hello Claude!');
      assert.equal(result.reasoning, 'Let me analyze this.');
      assert.equal(result.finishReason, 'end_turn');
      assert.equal(result.usage.prompt, 25);
      assert.equal(result.usage.completion, 18);
      assert.equal(result.usage.total, 43);

      // Verify Anthropic-specific direct headers and payload format
      assert.ok(capturedHeaders);
      const headersRecord = capturedHeaders as Record<string, string>;
      assert.equal(headersRecord['x-api-key'], 'sk-ant-api03-test-token');
      assert.equal(headersRecord['anthropic-version'], '2023-06-01');
      assert.equal(headersRecord['anthropic-dangerous-direct-browser-access'], 'true');

      assert.ok(capturedBody);
      const bodyObj = JSON.parse(capturedBody);
      assert.equal(bodyObj.system, 'You are Claude.');
      assert.equal(bodyObj.messages.length, 1);
      assert.equal(bodyObj.messages[0].role, 'user');
      assert.equal(bodyObj.messages[0].content, 'Hi');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should handle fragmented SSE lines split across network chunk packets', async () => {
    // Split "data: {"id":"1","choices":[{"delta":{"content":"Hi"..." into 2 binary packets
    const part1 = 'data: {"choices":[{"delta":{"co';
    const part2 = 'ntent":"Fragmented Hi"}}]}\n\ndata: [DONE]\n\n';

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(part1));
        await new Promise((r) => setTimeout(r, 10));
        controller.enqueue(encoder.encode(part2));
        controller.close();
      },
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });

    try {
      const result = await streamChatCompletion({
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      assert.equal(result.response, 'Fragmented Hi');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should abort cleanly when AbortSignal triggers mid-stream', async () => {
    const controller = new AbortController();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(ctrl) {
        ctrl.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"First"}}]}\n\n'));
      },
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });

    try {
      setTimeout(() => controller.abort(), 10);
      await assert.rejects(
        streamChatCompletion({
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Test' }],
          signal: controller.signal,
        }),
        /aborted/i
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should throw clear error on HTTP 401 Unauthorized', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { message: 'Incorrect API key provided' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });

    try {
      await assert.rejects(
        streamChatCompletion({
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
          apiKey: 'invalid-key',
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Hi' }],
        }),
        /401/i
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should throw actionable error on HTTP 503 Service Overloaded', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: { message: 'The model is overloaded' } }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });

    try {
      await assert.rejects(
        streamChatCompletion({
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
          apiKey: 'test-key',
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: 'Hi' }],
        }),
        /503/i
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
