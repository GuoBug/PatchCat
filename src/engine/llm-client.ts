/**
 * @file    src/engine/llm-client.ts
 * @version 1.0.0
 * @description
 *   Universal Streaming LLM Client supporting Google Gemini, DeepSeek,
 *   OpenAI, SiliconFlow, and Ollama over standard Server-Sent Events (SSE).
 */

import type { TokenUsage } from './types';
import { logger } from './logger.ts';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMChatRequest {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LLMStreamChunk {
  delta: string;
  fullContent: string;
  reasoningDelta?: string;
  fullReasoning?: string;
}

export interface LLMStreamCallbacks {
  onChunk?: (chunk: LLMStreamChunk) => void;
}

export interface LLMExecutionOutput {
  response: string;
  reasoning?: string;
  usage: TokenUsage;
  finishReason: string;
  durationMs: number;
}

/**
 * Normalizes provider baseUrl to point to the exact chat completions endpoint.
 */
export function getChatCompletionsUrl(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, '');
  if (clean.endsWith('/chat/completions')) {
    return clean;
  }
  if (clean.endsWith('/v1') || clean.endsWith('/v1beta/openai')) {
    return `${clean}/chat/completions`;
  }
  return `${clean}/v1/chat/completions`;
}

/**
 * Estimates token counts when provider doesn't report exact usage in stream.
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  // Approximation: ~1 token per 3.5 chars in English/Code or ~1.5 chars in CJK
  return Math.max(1, Math.ceil(text.length / 3));
}

/**
 * Calls OpenAI-compatible /v1/chat/completions with SSE token streaming.
 */
export async function streamChatCompletion(
  request: LLMChatRequest,
  callbacks?: LLMStreamCallbacks,
): Promise<LLMExecutionOutput> {
  const startTime = Date.now();
  const url = getChatCompletionsUrl(request.baseUrl);
  const apiKey = request.apiKey.trim();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream, application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    // Also include Google AI Studio header if needed
    if (request.baseUrl.includes('googleapis.com')) {
      headers['x-goog-api-key'] = apiKey;
    }
  }

  const payload = {
    model: request.model,
    messages: request.messages,
    temperature: request.temperature ?? 0.7,
    max_tokens: request.maxTokens ?? 2048,
    stream: true,
    stream_options: {
      include_usage: true,
    },
  };

  logger.detailed(
    'LLMClient',
    `发起模型推理请求 -> ${request.model} (${url})`,
    { model: request.model, temperature: request.temperature, messagesCount: request.messages.length },
    undefined,
    'request',
  );

  logger.dev(
    'LLMClient',
    `[请求入参 Payload] 模型: ${request.model}`,
    { inputs: { messages: request.messages, temperature: request.temperature, maxTokens: request.maxTokens } },
    { url, model: request.model },
    undefined,
    'request',
  );

  let response: Response | null = null;
  const maxRetries = 1;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: request.signal,
      });

      if (response.status === 503 && attempt < maxRetries) {
        // Transient 503/overload spike: wait 1.5s then retry once
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      break;
    } catch (err: unknown) {
      if (request.signal?.aborted) {
        throw new Error('LLM call aborted by user.');
      }
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to connect to LLM provider (${url}): ${msg}`);
    }
  }

  if (!response) {
    throw new Error(`Failed to connect to LLM provider (${url}).`);
  }

  const safeResponse: Response = response;

  if (!safeResponse.ok) {
    const errorBody = await safeResponse.text().catch(() => '');
    let detail = '';
    try {
      const parsed = JSON.parse(errorBody);
      if (parsed?.error?.message) {
        detail = parsed.error.message;
      } else if (Array.isArray(parsed) && parsed[0]?.error?.message) {
        detail = parsed[0].error.message;
      } else if (parsed?.message) {
        detail = parsed.message;
      } else if (typeof parsed === 'object') {
        detail = JSON.stringify(parsed);
      }
    } catch {
      detail = errorBody.slice(0, 200) || safeResponse.statusText || '';
    }

    if (safeResponse.status === 401) {
      throw new Error(`[HTTP 401 鉴权失败] 提供的 API Key 无效或过期 (请求模型: "${request.model}"): ${detail || 'Unauthorized'}`);
    }
    if (safeResponse.status === 404) {
      throw new Error(`[HTTP 404 模型未找到] 模型 "${request.model}" 在服务商端点 (${url}) 中未找到。提示: 请在右侧属性面板选择当前服务商支持的模型 (如 Google 推荐 gemini-2.5-flash / gemini-2.0-flash)。(${detail})`);
    }
    if (safeResponse.status === 429) {
      throw new Error(`[HTTP 429 配额/频率受限] 当前模型 "${request.model}" 请求过于频繁或免费额度已用尽: ${detail || 'Rate limit exceeded'}`);
    }
    if (safeResponse.status === 503) {
      throw new Error(`[HTTP 503 服务繁忙/模型过载] 服务商当前模型负载过高或临时不可用 (Model "${request.model}" overloaded): ${detail || 'The model is overloaded. Please try again later.'}。建议稍后重试，或在右侧属性面板切换为其他模型 (例如 gemini-2.5-flash)。`);
    }
    if (safeResponse.status >= 500) {
      throw new Error(`[HTTP ${safeResponse.status} 服务端异常] 服务商网关返回错误 (请求模型: "${request.model}"): ${detail || safeResponse.statusText}`);
    }

    throw new Error(`[HTTP ${safeResponse.status}] LLM API 异常 (模型: "${request.model}"): ${detail || safeResponse.statusText}`);
  }

  // Handle SSE streaming response
  const body = safeResponse.body;
  if (!body) {
    throw new Error('Response body is empty or stream not supported by runtime.');
  }

  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');

  let fullContent = '';
  let fullReasoning = '';
  let finishReason = 'stop';
  let reportedUsage: TokenUsage | undefined;
  let buffer = '';

  const onAbort = () => {
    reader.cancel().catch(() => {});
  };
  if (request.signal) {
    if (request.signal.aborted) {
      reader.cancel().catch(() => {});
      throw new Error('LLM call aborted by user.');
    }
    request.signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    while (true) {
      if (request.signal?.aborted) {
        throw new Error('LLM call aborted by user.');
      }

      const { done, value } = await reader.read();
      if (done) {
        if (request.signal?.aborted) {
          throw new Error('LLM call aborted by user.');
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // keep incomplete trailing fragment in buffer

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith(':')) {
          continue; // SSE comment / keep-alive
        }

        if (line.startsWith('data:')) {
          const dataStr = line.slice(5).trim();
          if (dataStr === '[DONE]') {
            continue;
          }

          try {
            const parsed = JSON.parse(dataStr);
            const choice = parsed.choices?.[0];

            if (choice) {
              if (choice.finish_reason) {
                finishReason = choice.finish_reason;
              }

              const delta = choice.delta || {};
              let hasNewToken = false;
              let contentDelta = '';
              let reasoningDelta = '';

              // Standard content token
              if (typeof delta.content === 'string' && delta.content.length > 0) {
                contentDelta = delta.content;
                fullContent += contentDelta;
                hasNewToken = true;
              }

              // DeepSeek R1 reasoning token
              if (typeof delta.reasoning_content === 'string' && delta.reasoning_content.length > 0) {
                reasoningDelta = delta.reasoning_content;
                fullReasoning += reasoningDelta;
                hasNewToken = true;
              }

              if (hasNewToken && callbacks?.onChunk) {
                callbacks.onChunk({
                  delta: contentDelta,
                  fullContent,
                  reasoningDelta: reasoningDelta || undefined,
                  fullReasoning: fullReasoning || undefined,
                });
              }
            }

            // Usage reporting if present in chunk
            if (parsed.usage) {
              reportedUsage = {
                prompt: parsed.usage.prompt_tokens ?? 0,
                completion: parsed.usage.completion_tokens ?? 0,
                total: parsed.usage.total_tokens ?? 0,
              };
            }
          } catch {
            // Ignore non-JSON SSE payload chunks
          }
        }
      }
    }
  } finally {
    if (request.signal) {
      request.signal.removeEventListener('abort', onAbort);
    }
    reader.releaseLock();
  }

  const promptText = request.messages.map((m) => m.content).join(' ');
  const promptTokens = reportedUsage?.prompt ?? estimateTokens(promptText);
  const completionTokens = reportedUsage?.completion ?? estimateTokens(fullContent + fullReasoning);

  const usage: TokenUsage = {
    prompt: promptTokens,
    completion: completionTokens,
    total: reportedUsage?.total ?? (promptTokens + completionTokens),
  };

  const durationMs = Date.now() - startTime;

  logger.summary(
    'LLMClient',
    `模型推理完成: ${request.model} [${durationMs}ms] (消耗 ${usage.total} tokens)`,
    { model: request.model, durationMs, usage, finishReason },
    undefined,
    'request',
    durationMs,
  );

  logger.dev(
    'LLMClient',
    `[响应输出 Payload] 模型: ${request.model}`,
    { outputs: { response: fullContent, reasoning: fullReasoning || undefined, usage } },
    { durationMs, finishReason },
    undefined,
    'request',
    durationMs,
  );

  return {
    response: fullContent,
    reasoning: fullReasoning || undefined,
    usage,
    finishReason,
    durationMs,
  };
}
