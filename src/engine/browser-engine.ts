/**
 * @file    src/engine/browser-engine.ts
 * @version 2.1.0
 * @description
 *   Pure-frontend workflow execution engine with real-time SSE streaming.
 *
 *   This adapter implements the complete DAG scheduling loop entirely inside the browser:
 *   - Real SSE streaming calls for Google Gemini, DeepSeek, OpenAI, SiliconFlow, Ollama.
 *   - Real-time NODE_CHUNK event distribution to drive typewriter UI updates.
 *   - Kahn's topological sort and layer-by-layer parallel wave concurrency.
 *   - Cooperative cancellation via AbortSignal.
 *   - Seamless graceful fallback to simulated mock responses when keys are absent.
 */

import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowRunOptions,
  ExecutionEvent,
  GraphValidationResult,
  EngineMode,
  NodeType,
} from './types';
import { topologicalSort, validateGraphTopology } from './topological-sort.ts';
import { resolveObjectVariables } from './variable-resolver.ts';
import { streamChatCompletion, type ChatMessage } from './llm-client.ts';
import { useSettingsStore } from '../stores/settings-store.ts';
import { logger } from './logger.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Internal Types
// ─────────────────────────────────────────────────────────────────────────────

interface InternalNodeResult {
  nodeId: string;
  status: 'success' | 'error';
  output: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

interface GraphInput {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

/**
 * Validates and maps a node's configured model to the active provider's capabilities.
 * If a preset template has a hardcoded model from a different vendor (e.g. 'gpt-4o-mini' when active provider is Google),
 * this falls back safely to the active provider's default model (e.g. 'gemini-2.5-flash').
 */
export function resolveTargetModel(
  configuredModel: string | undefined,
  providerId: string,
  availableModels: string[] = [],
  defaultModel: string,
): string {
  if (!configuredModel || configuredModel.trim() === '') {
    return defaultModel;
  }

  const clean = configuredModel.trim();
  // If explicitly listed in available models, it's valid
  if (availableModels.includes(clean)) {
    return clean;
  }

  // Cross-provider mismatch detection:
  // 1. Google Gemini requires gemini-* models
  if (providerId === 'google') {
    if (!clean.toLowerCase().includes('gemini')) {
      return defaultModel;
    }
  }
  // 2. DeepSeek requires deepseek-* models
  if (providerId === 'deepseek') {
    if (!clean.toLowerCase().includes('deepseek')) {
      return defaultModel;
    }
  }
  // 3. OpenAI requires gpt-*, o1-*, o3-*, text-* models
  if (providerId === 'openai') {
    if (clean.startsWith('gemini-') || clean.startsWith('claude-') || clean.startsWith('deepseek-')) {
      return defaultModel;
    }
  }

  return clean;
}

/**
 * Lightweight Async Event Queue for real-time streaming event delivery.
 */
class AsyncEventQueue<T> {
  private queue: T[] = [];
  private resolver: (() => void) | null = null;
  private isClosed = false;

  push(item: T): void {
    this.queue.push(item);
    if (this.resolver) {
      this.resolver();
      this.resolver = null;
    }
  }

  close(): void {
    this.isClosed = true;
    if (this.resolver) {
      this.resolver();
      this.resolver = null;
    }
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    while (true) {
      while (this.queue.length > 0) {
        yield this.queue.shift()!;
      }
      if (this.isClosed) break;
      await new Promise<void>((resolve) => {
        this.resolver = resolve;
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine Implementation
// ─────────────────────────────────────────────────────────────────────────────

export class BrowserWorkflowEngine {
  public readonly mode: EngineMode = 'mock';
  private abortController: AbortController | null = null;

  /** Run the topology validator without executing anything. */
  public validateGraph(graph: GraphInput): GraphValidationResult {
    return validateGraphTopology(graph);
  }

  /** Cooperatively cancel the current run. */
  public abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  /**
   * Main execution loop — yields a typed event stream with real-time token chunks.
   */
  public async *executeWorkflow(
    graph: GraphInput,
    options: WorkflowRunOptions = {},
  ): AsyncGenerator<ExecutionEvent> {
    const startTime = Date.now();
    this.abortController = new AbortController();
    const signal = options.signal ?? this.abortController.signal;

    // 1. Pre-flight topology validation
    const validation = this.validateGraph(graph);
    if (!validation.valid) {
      yield {
        type: 'WORKFLOW_ERROR',
        payload: {
          error: `Graph validation failed: ${validation.errors.join('; ')}`,
          timestamp: Date.now(),
        },
      };
      return;
    }

    const { executionLayers } = topologicalSort(graph);
    const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

    // Execution context: maps nodeId → resolved output bag
    const context: Record<string, Record<string, unknown>> = {};
    if (options.inputs) {
      context['global_input'] = options.inputs;
    }

    logger.summary(
      'WorkflowEngine',
      `工作流开始执行 (共 ${graph.nodes.length} 个节点, 划分 ${executionLayers.length} 个并行波次)`,
      { totalNodes: graph.nodes.length, layersCount: executionLayers.length },
    );

    yield {
      type: 'WORKFLOW_START',
      payload: {
        graphId: 'browser-run',
        timestamp: startTime,
        totalNodes: graph.nodes.length,
      },
    };

    try {
      // 2. Layer-by-layer parallel execution
      for (let layerIdx = 0; layerIdx < executionLayers.length; layerIdx++) {
        const layer = executionLayers[layerIdx]!;
        if (signal.aborted) {
          throw new Error('Workflow execution aborted by user.');
        }

        logger.detailed(
          'WorkflowEngine',
          `执行第 ${layerIdx + 1}/${executionLayers.length} 波次并行节点: [${layer.join(', ')}]`,
          { layerIndex: layerIdx, nodes: layer },
        );

        const eventQueue = new AsyncEventQueue<ExecutionEvent>();

        // Start executing all nodes in current layer
        const layerExecutionPromise = Promise.all(
          layer
            .map((nodeId) => nodeMap.get(nodeId))
            .filter((n): n is WorkflowNode => n !== undefined)
            .map(async (node) => {
              logger.detailed(
                'WorkflowEngine',
                `节点 [${node.id}] (${node.data.label}) 开始运行`,
                { nodeType: node.data.type, inputsKeys: Object.keys(node.data.inputs || {}) },
                node.id,
              );

              logger.dev(
                'WorkflowEngine',
                `节点 [${node.id}] 原始输入入参`,
                { inputs: node.data.inputs },
                undefined,
                node.id,
              );

              eventQueue.push({
                type: 'NODE_START',
                payload: {
                  nodeId: node.id,
                  nodeType: node.data.type,
                  timestamp: Date.now(),
                  inputs: node.data.inputs || {},
                },
              });

              const result = await this.executeNodeInternal(
                node,
                context,
                signal,
                (chunk) => {
                  eventQueue.push({
                    type: 'NODE_CHUNK',
                    payload: {
                      nodeId: node.id,
                      delta: chunk.delta,
                      fullContent: chunk.fullContent,
                      reasoningDelta: chunk.reasoningDelta,
                      fullReasoning: chunk.fullReasoning,
                    },
                  });
                },
              );

              if (result.status === 'error') {
                logger.error(
                  'WorkflowEngine',
                  `节点 [${node.id}] 执行失败: ${result.error}`,
                  result.error,
                  undefined,
                  node.id,
                );

                eventQueue.push({
                  type: 'NODE_ERROR',
                  payload: {
                    nodeId: result.nodeId,
                    error: result.error ?? 'Unknown error',
                    durationMs: result.durationMs,
                  },
                });
              } else {
                context[result.nodeId] = result.output;

                logger.summary(
                  'WorkflowEngine',
                  `节点 [${node.id}] 执行成功 [${result.durationMs}ms]`,
                  { durationMs: result.durationMs },
                  node.id,
                  'node',
                  result.durationMs,
                );

                logger.dev(
                  'WorkflowEngine',
                  `节点 [${node.id}] 产出结果`,
                  { outputs: result.output },
                  undefined,
                  node.id,
                  'node',
                  result.durationMs,
                );

                eventQueue.push({
                  type: 'NODE_COMPLETE',
                  payload: {
                    nodeId: result.nodeId,
                    output: result.output,
                    durationMs: result.durationMs,
                  },
                });
              }

              return result;
            }),
        )
          .then((results) => {
            eventQueue.close();
            return results;
          })
          .catch((err) => {
            eventQueue.close();
            throw err;
          });

        // Yield events in real time as chunks and status updates arrive
        for await (const event of eventQueue) {
          yield event;
        }

        const layerResults = await layerExecutionPromise;

        // Check if any node in this layer failed
        const failedResult = layerResults.find((r) => r.status === 'error');
        if (failedResult) {
          throw new Error(`Node ${failedResult.nodeId} failed: ${failedResult.error}`);
        }
      }

      const totalDuration = Date.now() - startTime;

      logger.summary(
        'WorkflowEngine',
        `工作流全部执行成功 [总耗时 ${totalDuration}ms]`,
        { totalDurationMs: totalDuration },
      );

      // 3. Workflow Success
      yield {
        type: 'WORKFLOW_COMPLETE',
        payload: {
          outputs: context,
          totalDurationMs: totalDuration,
          timestamp: Date.now(),
        },
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error('WorkflowEngine', `工作流执行中断: ${errMsg}`, err);

      yield {
        type: 'WORKFLOW_ERROR',
        payload: {
          error: errMsg,
          timestamp: Date.now(),
        },
      };
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Single-node executor (Real LLM / Code / Prompt / Input / Output)
  // ───────────────────────────────────────────────────────────────────────

  private async executeNodeInternal(
    node: WorkflowNode,
    context: Record<string, Record<string, unknown>>,
    signal: AbortSignal,
    onChunk?: (chunk: {
      delta: string;
      fullContent: string;
      reasoningDelta?: string;
      fullReasoning?: string;
    }) => void,
  ): Promise<InternalNodeResult> {
    const start = Date.now();

    try {
      if (signal.aborted) {
        throw new Error('Workflow execution aborted by user.');
      }

      // Explicitly simulated node failure for error bubbling tests
      if (node.data.config?.['simulateError'] || node.data.config?.['throwError']) {
        const errorMsg = String(
          node.data.config?.['errorMessage'] ?? `Node ${node.id} execution failed intentionally.`,
        );
        throw new Error(errorMsg);
      }

      const resolvedInputs = resolveObjectVariables(
        node.data.inputs as Record<string, string>,
        context,
      );
      const nodeType: NodeType = node.data.type;
      const customDelay =
        typeof node.data.config?.['delayMs'] === 'number'
          ? (node.data.config['delayMs'] as number)
          : null;

      let output: Record<string, unknown> = {};

      switch (nodeType) {
        case 'input': {
          output = { ...resolvedInputs, output: resolvedInputs };
          break;
        }

        case 'prompt': {
          const template = resolvedInputs['template'];
          output = {
            promptText:
              typeof template === 'string'
                ? template
                : JSON.stringify(resolvedInputs),
          };
          break;
        }

        case 'llm': {
          // Extract prompt content from resolved inputs
          const userPrompt =
            typeof resolvedInputs['prompt'] === 'string'
              ? (resolvedInputs['prompt'] as string)
              : typeof resolvedInputs['promptText'] === 'string'
              ? (resolvedInputs['promptText'] as string)
              : typeof resolvedInputs['template'] === 'string'
              ? (resolvedInputs['template'] as string)
              : JSON.stringify(resolvedInputs);

          const systemPrompt =
            typeof node.data.config?.['systemPrompt'] === 'string' &&
            node.data.config['systemPrompt'].trim().length > 0
              ? (node.data.config['systemPrompt'] as string)
              : undefined;

          const configuredModel = node.data.config?.['model'] as string | undefined;
          const temperature =
            typeof node.data.config?.['temperature'] === 'number'
              ? (node.data.config['temperature'] as number)
              : 0.7;

          // Retrieve active provider settings from settings store
          const settingsStore = useSettingsStore.getState();
          const settings = settingsStore.getEffectiveConfig();
          const activeProviderConfig = settingsStore.providers[settings.provider];

          if (settings.hasKey) {
            // REAL LLM CALL (Google Gemini / DeepSeek / OpenAI / Ollama / Custom)
            const messages: ChatMessage[] = [];
            if (systemPrompt) {
              messages.push({ role: 'system', content: systemPrompt });
            }
            messages.push({ role: 'user', content: userPrompt });

            const targetModel = resolveTargetModel(
              configuredModel,
              settings.provider,
              activeProviderConfig?.availableModels || [],
              settings.model,
            );

            const llmResult = await streamChatCompletion(
              {
                baseUrl: settings.baseUrl,
                apiKey: settings.apiKey,
                model: targetModel,
                messages,
                temperature,
                signal,
              },
              {
                onChunk: (chunk) => {
                  if (onChunk) {
                    onChunk(chunk);
                  }
                },
              },
            );

            output = {
              response: llmResult.response,
              ...(llmResult.reasoning ? { reasoning: llmResult.reasoning } : {}),
              usage: llmResult.usage,
              model: targetModel,
              finishReason: llmResult.finishReason,
            };
          } else {
            // MOCK MODE FALLBACK (Simulated response with notice)
            const delayMs = customDelay ?? 100;
            if (delayMs > 0) {
              await new Promise<void>((resolve, reject) => {
                if (signal.aborted) {
                  return reject(new Error('Workflow execution aborted by user.'));
                }
                const timer = setTimeout(() => resolve(), delayMs);
                const onAbort = () => {
                  clearTimeout(timer);
                  reject(new Error('Workflow execution aborted by user.'));
                };
                signal.addEventListener('abort', onAbort, { once: true });
              });
            }

            const mockText = `[Mock] Response for "${node.data.label}" — prompt: ${userPrompt.slice(0, 80)}… (提示: 点击顶部 API Key 配置 Google Gemini 或 DeepSeek 以启用真实大模型)`;
            if (onChunk) {
              onChunk({ delta: mockText, fullContent: mockText });
            }

            output = {
              response: mockText,
              usage: { prompt: 60, completion: 60, total: 120 },
              finishReason: 'stop',
            };
          }
          break;
        }

        case 'code': {
          const rawScript =
            (node.data.config?.['script'] as string) ||
            (node.data.config?.['code'] as string);

          let result: unknown = null;
          let stdout = '';
          const logs: string[] = [];

          const customConsole = {
            log: (...args: unknown[]) => {
              logs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
            },
            error: (...args: unknown[]) => {
              logs.push('[Error] ' + args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
            },
          };

          if (rawScript && rawScript.trim().length > 0) {
            try {
              const fn = new Function(
                'inputs',
                'console',
                `"use strict";\n${rawScript.includes('return') ? rawScript : `return (${rawScript});`}`,
              );
              result = fn(resolvedInputs, customConsole);
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : String(err);
              throw new Error(`[代码节点执行异常] 节点 "${node.data.label || node.id}": ${errMsg}`);
            }
          } else {
            result = resolvedInputs;
          }

          stdout = logs.join('\n');
          output = {
            result,
            stdout,
          };
          break;
        }

        case 'output': {
          output = {
            finalResult: resolvedInputs,
            renderedAt: new Date().toISOString(),
          };
          break;
        }
      }

      return {
        nodeId: node.id,
        status: 'success',
        output,
        durationMs: Date.now() - start,
      };
    } catch (err: unknown) {
      return {
        nodeId: node.id,
        status: 'error',
        output: {},
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
    }
  }
}
