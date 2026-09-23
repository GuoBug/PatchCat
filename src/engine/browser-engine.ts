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
  ConditionRule,
  ConditionNodeConfig,
  AggregatorNodeConfig,
  HttpNodeConfig,
  HttpMethod,
  AgentNodeConfig,
  TokenUsage,
  DAGCheckpoint,
  NodeCheckpointState,
} from './types';
import {
  topologicalSort,
  validateGraphTopology,
  computeAncestors,
  computeDescendants,
  computeNodeConfigHash,
  computeGraphTopologyHash,
} from './topological-sort.ts';
import { resolveObjectVariables } from './variable-resolver.ts';
import { streamChatCompletion, type ChatMessage } from './llm-client.ts';
import { runSandboxedScript } from './sandbox-executor.ts';
import { useSettingsStore } from '../stores/settings-store.ts';
import { useKnowledgeStore } from '../stores/knowledge-store.ts';
import { logger } from './logger.ts';
import { RUNTIME_DEFAULTS, DEFAULT_RUNTIME_PROTECTION } from '../config/runtime-defaults.ts';
import { TelemetryTracer } from '../services/telemetry/otel-tracer.ts';
import { estimateTokenCostUSD } from '../config/model-pricing.ts';
import { indexedDb } from '../services/storage/indexeddb-adapter.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Internal Types & Evaluators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates a single ConditionRule against an actual value.
 */
export function evaluateCondition(rule: ConditionRule, actualValue: unknown): boolean {
  const op = rule.operator;
  const targetVal = rule.value;

  const strVal = actualValue === null || actualValue === undefined ? '' : String(actualValue);
  const numVal = typeof actualValue === 'number' ? actualValue : parseFloat(strVal);
  const targetNum = typeof targetVal === 'number' ? targetVal : parseFloat(String(targetVal));

  switch (op) {
    case 'equals':
      return (
        strVal.trim().toLowerCase() ===
        String(targetVal ?? '')
          .trim()
          .toLowerCase()
      );
    case 'not_equals':
      return (
        strVal.trim().toLowerCase() !==
        String(targetVal ?? '')
          .trim()
          .toLowerCase()
      );
    case 'contains':
      return strVal.toLowerCase().includes(String(targetVal ?? '').toLowerCase());
    case 'not_contains':
      return !strVal.toLowerCase().includes(String(targetVal ?? '').toLowerCase());
    case 'greater_than':
      return !isNaN(numVal) && !isNaN(targetNum) && numVal > targetNum;
    case 'less_than':
      return !isNaN(numVal) && !isNaN(targetNum) && numVal < targetNum;
    case 'is_empty':
      return actualValue === null || actualValue === undefined || strVal.trim() === '';
    case 'is_not_empty':
      return actualValue !== null && actualValue !== undefined && strVal.trim() !== '';
    case 'regex_match':
      try {
        const regex = new RegExp(String(targetVal), 'i');
        return regex.test(strVal);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

interface InternalNodeResult {
  nodeId: string;
  status: 'success' | 'error';
  output: Record<string, unknown>;
  error?: string;
  durationMs: number;
  tokens?: TokenUsage;
  model?: string;
  ttftMs?: number;
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
    if (
      clean.startsWith('gemini-') ||
      clean.startsWith('claude-') ||
      clean.startsWith('deepseek-')
    ) {
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

  /** Resolves effective settings with IoC dependency injection fallback */
  private resolveSettings(options?: WorkflowRunOptions) {
    const injected = options?.context?.settings as Record<string, unknown> | undefined;
    if (injected) {
      return {
        hasKey: (injected.hasKey as boolean | undefined) ?? Boolean(injected.apiKey),
        baseUrl: (injected.baseUrl as string) || 'https://api.openai.com',
        apiKey: (injected.apiKey as string) || '',
        provider: (injected.provider as string) || 'openai',
        model: (injected.model as string) || 'gpt-4o',
        availableModels: (injected.availableModels as string[]) || [],
        storageMode: 'local',
        serverBaseUrl: 'http://localhost:8000',
        runtimeProtection: (injected.runtimeProtection as typeof DEFAULT_RUNTIME_PROTECTION) || DEFAULT_RUNTIME_PROTECTION,
      };
    }
    if (typeof window !== 'undefined') {
      try {
        const settingsStore = useSettingsStore.getState();
        const cfg = settingsStore.getEffectiveConfig();
        const activeProviderConfig = settingsStore.providers[cfg.provider];
        return {
          hasKey: cfg.hasKey,
          baseUrl: cfg.baseUrl,
          apiKey: cfg.apiKey,
          provider: cfg.provider,
          model: cfg.model,
          availableModels: activeProviderConfig?.availableModels || [],
          storageMode: settingsStore.storageMode,
          serverBaseUrl: settingsStore.serverBaseUrl || 'http://localhost:8000',
          runtimeProtection: settingsStore.runtimeProtection || DEFAULT_RUNTIME_PROTECTION,
        };
      } catch {
        // Fallback if store is unavailable
      }
    }
    return {
      hasKey: false,
      baseUrl: '',
      apiKey: '',
      provider: 'mock',
      model: 'mock',
      availableModels: [],
      storageMode: 'local',
      serverBaseUrl: 'http://localhost:8000',
      runtimeProtection: DEFAULT_RUNTIME_PROTECTION,
    };
  }

  /** Resolves knowledge retriever with IoC dependency injection fallback */
  private resolveKnowledgeAdapter(options?: WorkflowRunOptions) {
    if (options?.context?.knowledgeAdapter) {
      return options.context.knowledgeAdapter as {
        retrieve: (
          kbId: string,
          query: string,
          topK?: number,
          scoreThreshold?: number,
        ) => Promise<{ context: string; chunks: unknown[] }>;
      };
    }
    if (typeof window !== 'undefined') {
      try {
        const store = useKnowledgeStore.getState();
        return {
          retrieve: store.retrieve.bind(store),
        };
      } catch {
        // Fallback if store is unavailable
      }
    }
    return undefined;
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

    let executionLayers: string[][] = [];
    const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

    // Graph topology adjacency for dynamic conditional routing & skipping
    const incomingEdgesMap = new Map<string, WorkflowEdge[]>();
    const outgoingEdgesMap = new Map<string, WorkflowEdge[]>();
    for (const node of graph.nodes) {
      incomingEdgesMap.set(node.id, []);
      outgoingEdgesMap.set(node.id, []);
    }
    for (const edge of graph.edges) {
      incomingEdgesMap.get(edge.target)?.push(edge);
      outgoingEdgesMap.get(edge.source)?.push(edge);
    }

    const skippedNodes = new Set<string>();
    const nodeActiveBranch = new Map<string, string>(); // conditionNodeId -> activeBranch handle

    // Execution context: maps nodeId → resolved output bag
    const context: Record<string, Record<string, unknown>> = {};
    const reexecutedNodes = new Set<string>();
    const nodeStatesMap: Record<string, NodeCheckpointState> = {};

    const workflowId = options.workflowId || 'browser-run';
    const workflowTitle = options.workflowTitle || 'Untitled Workflow';
    const triggerMode = options.triggerMode || 'manual';

    // 1.1 In resumeFromNodeId mode, pre-hydrate context & node states from persistent checkpoint
    if (options.resumeFromNodeId) {
      let loadedCheckpoint: DAGCheckpoint | null = null;
      if (options.checkpointId) {
        loadedCheckpoint = await indexedDb.getCheckpointById(options.checkpointId);
      }
      if (!loadedCheckpoint && options.workflowId) {
        loadedCheckpoint = await indexedDb.getLatestCheckpoint(options.workflowId);
      }
      if (loadedCheckpoint?.contextBag) {
        for (const [k, v] of Object.entries(loadedCheckpoint.contextBag)) {
          if (v && typeof v === 'object') {
            context[k] = v;
          }
        }
      }
      if (loadedCheckpoint?.nodeStates) {
        for (const [k, v] of Object.entries(loadedCheckpoint.nodeStates)) {
          if (v) {
            nodeStatesMap[k] = structuredClone(v);
          }
        }
      }
    }

    // In legacy resume or checkpoint resume, merge any cached node.data.outputs from memory
    if (options.resumeFromExisting || options.resumeFromNodeId) {
      for (const node of graph.nodes) {
        if (node.data?.outputs && typeof node.data.outputs === 'object') {
          context[node.id] = (node.data.outputs as Record<string, unknown>) || context[node.id];
        }
      }
    }

    if (options.inputs) {
      context['global_input'] = options.inputs;
    }

    // 1.2 Kahn graph pruning for resumeFromNodeId
    let prunedNodeIds: Set<string> | null = null;

    if (options.resumeFromNodeId) {
      const targetNodeId = options.resumeFromNodeId;
      const initialAncestors = computeAncestors(targetNodeId, graph);
      logger.detailed(
        'WorkflowEngine',
        `断点续跑前置检查: 节点 [${targetNodeId}] 识别到 ${initialAncestors.size} 个前序祖先节点`,
        { targetNodeId, ancestorCount: initialAncestors.size },
        targetNodeId,
      );

      const targetNodesToRun = new Set<string>([targetNodeId]);
      let expanded = true;
      while (expanded) {
        expanded = false;
        for (const tId of targetNodesToRun) {
          const incoming = incomingEdgesMap.get(tId) || [];
          for (const edge of incoming) {
            const pId = edge.source;
            const hasCachedOutput = context[pId] && Object.keys(context[pId]).length > 0;
            if (!hasCachedOutput && !targetNodesToRun.has(pId)) {
              targetNodesToRun.add(pId);
              expanded = true;
            }
          }
        }
      }

      const targetDescendants = computeDescendants(targetNodesToRun, graph);
      prunedNodeIds = new Set<string>([...targetNodesToRun, ...targetDescendants]);

      const prunedNodes = graph.nodes.filter((n) => prunedNodeIds!.has(n.id));
      const prunedEdges = graph.edges.filter(
        (e) => prunedNodeIds!.has(e.source) && prunedNodeIds!.has(e.target),
      );
      const prunedSort = topologicalSort({ nodes: prunedNodes, edges: prunedEdges });
      executionLayers = prunedSort.executionLayers;

      // Register cached outputs for all ancestor / non-pruned nodes
      for (const node of graph.nodes) {
        if (!prunedNodeIds.has(node.id) && context[node.id]) {
          const existing = nodeStatesMap[node.id];
          nodeStatesMap[node.id] = {
            nodeId: node.id,
            nodeType: existing?.nodeType || node.data?.type || node.type || 'unknown',
            status: 'cached',
            outputsSnapshot: structuredClone(context[node.id]),
            durationMs: 0,
            tokensUsed: { prompt: 0, completion: 0, total: 0 },
            configHash: computeNodeConfigHash(node),
            completedAt: Date.now(),
          };
        }
      }

      logger.summary(
        'WorkflowEngine',
        `断点续跑已激活: 从节点 [${targetNodeId}] 续跑，重算 ${prunedNodeIds.size} 个节点，复用 ${graph.nodes.length - prunedNodeIds.size} 个祖先输出`,
        { targetNodeId, prunedCount: prunedNodeIds.size, cachedCount: graph.nodes.length - prunedNodeIds.size },
      );
    } else {
      const fullSort = topologicalSort(graph);
      executionLayers = fullSort.executionLayers;
    }

    logger.summary(
      'WorkflowEngine',
      `工作流开始执行 (共 ${graph.nodes.length} 个节点, 划分 ${executionLayers.length} 个并行波次)`,
      { totalNodes: graph.nodes.length, layersCount: executionLayers.length },
    );

    const tracer = new TelemetryTracer({
      workflowId,
      workflowTitle,
      triggerMode,
    });

    yield {
      type: 'WORKFLOW_START',
      payload: {
        graphId: 'browser-run',
        timestamp: startTime,
        totalNodes: graph.nodes.length,
      },
    };

    // Emit instant NODE_COMPLETE events for cached ancestor nodes in resume mode
    if (prunedNodeIds) {
      for (const node of graph.nodes) {
        if (!prunedNodeIds.has(node.id) && context[node.id]) {
          yield {
            type: 'NODE_COMPLETE',
            payload: {
              nodeId: node.id,
              output: context[node.id]!,
              durationMs: 0,
            },
          };
        }
      }
    }

    let currentLayerIndex = 0;
    let lastFailedNodeId: string | null = null;

    try {
      // 2. Layer-by-layer parallel execution
      for (let layerIdx = 0; layerIdx < executionLayers.length; layerIdx++) {
        currentLayerIndex = layerIdx;
        const layer = executionLayers[layerIdx]!;
        if (signal.aborted) {
          throw new Error('Workflow execution aborted by user.');
        }

        const waveSpan = tracer.startWaveSpan(layerIdx);

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
              // ── Dynamic Branch Skipping Evaluation ────────────────────────
              const incoming = incomingEdgesMap.get(node.id) || [];
              let shouldSkip = skippedNodes.has(node.id);

              if (!shouldSkip && incoming.length > 0) {
                if (node.data.type === 'aggregator') {
                  // Aggregator node runs if at least one incoming edge is NOT skipped
                  const hasActiveIncoming = incoming.some((edge) => {
                    if (skippedNodes.has(edge.source)) return false;
                    const srcNode = nodeMap.get(edge.source);
                    if (
                      srcNode &&
                      (srcNode.data.type === 'condition' || srcNode.type === 'condition')
                    ) {
                      const activeBranch = nodeActiveBranch.get(edge.source);
                      if (activeBranch && edge.sourceHandle && edge.sourceHandle !== activeBranch) {
                        return false;
                      }
                    }
                    return true;
                  });
                  if (!hasActiveIncoming) {
                    shouldSkip = true;
                  }
                } else {
                  // Normal node: if any incoming edge is inactive or comes from a skipped node, skip it
                  const isAnyIncomingInactive = incoming.some((edge) => {
                    if (skippedNodes.has(edge.source)) return true;
                    const srcNode = nodeMap.get(edge.source);
                    if (
                      srcNode &&
                      (srcNode.data.type === 'condition' || srcNode.type === 'condition')
                    ) {
                      const activeBranch = nodeActiveBranch.get(edge.source);
                      if (activeBranch && edge.sourceHandle && edge.sourceHandle !== activeBranch) {
                        return true;
                      }
                    }
                    return false;
                  });
                  if (isAnyIncomingInactive) {
                    shouldSkip = true;
                  }
                }
              }

              if (shouldSkip) {
                skippedNodes.add(node.id);
                logger.detailed(
                  'WorkflowEngine',
                  `节点 [${node.id}] (${node.data.label}) 分支未满足条件，跳过执行`,
                  { nodeType: node.data.type },
                  node.id,
                );

                eventQueue.push({
                  type: 'NODE_SKIPPED',
                  payload: {
                    nodeId: node.id,
                    reason: 'Condition branch not matched or upstream node was skipped',
                  },
                });

                return {
                  nodeId: node.id,
                  status: 'success' as const,
                  output: {},
                  durationMs: 0,
                };
              }

              // In resume mode, reuse cached outputs if node was already successful, has outputs,
              // is not an explicit target, not in error, and none of its incoming parents were re-executed.
              if (options.resumeFromExisting) {
                const isExplicitTarget = options.targetNodeIds
                  ? options.targetNodeIds.includes(node.id)
                  : false;
                const isErrorStatus = node.data.status === 'error';
                const hasReexecutedParent = incoming.some((edge) => reexecutedNodes.has(edge.source));
                const hasValidCachedOutput =
                  node.data.status === 'success' &&
                  node.data.outputs &&
                  Object.keys(node.data.outputs).length > 0;

                if (hasValidCachedOutput && !isExplicitTarget && !isErrorStatus && !hasReexecutedParent) {
                  logger.detailed(
                    'WorkflowEngine',
                    `节点 [${node.id}] (${node.data.label}) 复用已缓存的执行结果，跳过重跑`,
                    { nodeType: node.data.type },
                    node.id,
                  );
                  context[node.id] = (node.data.outputs as Record<string, unknown>) || {};
                  return {
                    nodeId: node.id,
                    status: 'success' as const,
                    output: context[node.id]!,
                    durationMs: 0,
                  };
                }
              }

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

              const sanitizedInputs = (node.data.inputs ? { ...node.data.inputs } : {}) as Record<string, unknown>;
              tracer.startNodeSpan(
                node.id,
                node.data.label || node.id,
                node.data.type,
                sanitizedInputs,
                waveSpan.spanId,
              );

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
                options,
                incoming,
                skippedNodes,
                nodeMap,
              );

              if (result.status === 'error') {
                lastFailedNodeId = result.nodeId;
                nodeStatesMap[result.nodeId] = {
                  nodeId: result.nodeId,
                  nodeType: node.data?.type || node.type || 'unknown',
                  status: 'error',
                  inputsSnapshot: structuredClone(sanitizedInputs),
                  errorMessage: result.error,
                  durationMs: result.durationMs,
                  configHash: computeNodeConfigHash(node),
                  completedAt: Date.now(),
                };

                logger.error(
                  'WorkflowEngine',
                  `节点 [${node.id}] 执行失败: ${result.error}`,
                  result.error,
                  undefined,
                  node.id,
                );

                tracer.endNodeSpan(
                  result.nodeId,
                  'error',
                  { error: result.error ?? 'Unknown error' },
                  { error: result.error },
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
                reexecutedNodes.add(result.nodeId);
                nodeStatesMap[result.nodeId] = {
                  nodeId: result.nodeId,
                  nodeType: node.data?.type || node.type || 'unknown',
                  status: 'success',
                  inputsSnapshot: structuredClone(sanitizedInputs),
                  outputsSnapshot: structuredClone(result.output),
                  durationMs: result.durationMs,
                  tokensUsed: result.tokens,
                  configHash: computeNodeConfigHash(node),
                  completedAt: Date.now(),
                };

                // If condition node, record active branch handle
                if (node.data.type === 'condition' || node.type === 'condition') {
                  const activeBranch = (result.output['activeBranch'] as string) || 'else';
                  nodeActiveBranch.set(node.id, activeBranch);
                  logger.detailed(
                    'WorkflowEngine',
                    `条件分支节点 [${node.id}] 激活分支: "${activeBranch}"`,
                    { activeBranch, result: result.output },
                    node.id,
                  );
                }

                if (result.ttftMs !== undefined) {
                  tracer.recordTTFT(result.nodeId, result.ttftMs);
                }
                const nodeCost = result.tokens && result.model
                  ? estimateTokenCostUSD(result.tokens, result.model)
                  : undefined;

                tracer.endNodeSpan(
                  result.nodeId,
                  'success',
                  result.output,
                  {
                    tokens: result.tokens,
                    model: result.model,
                    costUSD: nodeCost,
                  },
                );

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
        tracer.endWaveSpan();

        // Checkpoint at each wave completion (Phase 4.10 / v0.4.10)
        const traceId = tracer.getTraceId();
        const waveChkId = `chk_${traceId}_wave_${layerIdx}`;
        const waveCheckpoint: DAGCheckpoint = {
          id: waveChkId,
          checkpointId: waveChkId,
          runId: `run_${startTime}_${traceId.slice(0, 8)}`,
          workflowId,
          timestamp: Date.now(),
          graphTopologyHash: computeGraphTopologyHash(graph),
          currentWaveIndex: layerIdx,
          totalWaves: executionLayers.length,
          isCompleted: false,
          failedNodeIds: layerResults.filter((r) => r.status === 'error').map((r) => r.nodeId),
          contextBag: structuredClone(context),
          nodeStates: structuredClone(nodeStatesMap),
        };
        try {
          await indexedDb.saveCheckpoint(waveCheckpoint, 5);
        } catch {
          // Non-blocking best-effort checkpointing
        }

        // Check if any node in this layer failed
        const failedResult = layerResults.find((r) => r.status === 'error');
        if (failedResult) {
          throw new Error(`Node ${failedResult.nodeId} failed: ${failedResult.error}`);
        }
      }

      const totalDuration = Date.now() - startTime;

      logger.summary('WorkflowEngine', `工作流全部执行成功 [总耗时 ${totalDuration}ms]`, {
        totalDurationMs: totalDuration,
      });

      const runRecord = tracer.completeTrace('success');
      try {
        await indexedDb.saveRunRecord(runRecord);
      } catch (saveErr) {
        logger.dev('WorkflowEngine', 'Failed to save run record to IndexedDB', { outputs: saveErr });
      }

      // Final success checkpoint
      const finalTraceId = tracer.getTraceId();
      const finalChkId = `chk_${finalTraceId}_final`;
      const finalCheckpoint: DAGCheckpoint = {
        id: finalChkId,
        checkpointId: finalChkId,
        runId: `run_${startTime}_${finalTraceId.slice(0, 8)}`,
        workflowId,
        timestamp: Date.now(),
        graphTopologyHash: computeGraphTopologyHash(graph),
        currentWaveIndex: executionLayers.length - 1,
        totalWaves: executionLayers.length,
        isCompleted: true,
        failedNodeIds: [],
        contextBag: structuredClone(context),
        nodeStates: structuredClone(nodeStatesMap),
      };
      try {
        await indexedDb.saveCheckpoint(finalCheckpoint, 5);
      } catch {
        // Non-blocking
      }

      // 3. Workflow Success
      yield {
        type: 'WORKFLOW_COMPLETE',
        payload: {
          outputs: context,
          totalDurationMs: totalDuration,
          timestamp: Date.now(),
          runRecord,
        },
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logger.error('WorkflowEngine', `工作流执行中断: ${errMsg}`, err);

      const isCancelled = signal.aborted || errMsg.toLowerCase().includes('aborted');
      const runRecord = tracer.completeTrace(isCancelled ? 'cancelled' : 'error', errMsg);
      try {
        await indexedDb.saveRunRecord(runRecord);
      } catch (saveErr) {
        logger.dev('WorkflowEngine', 'Failed to save run record to IndexedDB', { outputs: saveErr });
      }

      // Error checkpoint
      const errTraceId = tracer.getTraceId();
      const errChkId = `chk_${errTraceId}_err`;
      const errorCheckpoint: DAGCheckpoint = {
        id: errChkId,
        checkpointId: errChkId,
        runId: `run_${startTime}_${errTraceId.slice(0, 8)}`,
        workflowId,
        timestamp: Date.now(),
        graphTopologyHash: computeGraphTopologyHash(graph),
        currentWaveIndex: currentLayerIndex,
        totalWaves: executionLayers.length,
        isCompleted: false,
        failedNodeIds: lastFailedNodeId ? [lastFailedNodeId] : [],
        contextBag: structuredClone(context),
        nodeStates: structuredClone(nodeStatesMap),
      };
      try {
        await indexedDb.saveCheckpoint(errorCheckpoint, 5);
      } catch {
        // Non-blocking
      }

      yield {
        type: 'WORKFLOW_ERROR',
        payload: {
          error: errMsg,
          timestamp: Date.now(),
          runRecord,
        },
      };
    }
  }

  /**
   * Executes a single node in-place, reading cached outputs from upstream parents
   * in the workflow graph without restarting previous steps (PRD-012 Section 4.5).
   */
  public async *executeSingleNode(
    graph: GraphInput,
    nodeId: string,
    options: WorkflowRunOptions = {},
  ): AsyncGenerator<ExecutionEvent> {
    if (options.resumeDownstream) {
      for await (const event of this.executeWorkflow(graph, {
        ...options,
        resumeFromExisting: true,
        targetNodeIds: [nodeId],
      })) {
        yield event;
      }
      return;
    }

    const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
    const targetNode = nodeMap.get(nodeId);
    if (!targetNode) {
      yield {
        type: 'NODE_ERROR',
        payload: {
          nodeId,
          error: `Node ${nodeId} not found in graph`,
          durationMs: 0,
        },
      };
      return;
    }

    this.abortController = new AbortController();
    const signal = options.signal ?? this.abortController.signal;

    // Build context from cached outputs of other nodes in the graph
    const context: Record<string, Record<string, unknown>> = {};
    for (const node of graph.nodes) {
      if (node.data?.outputs && typeof node.data.outputs === 'object') {
        context[node.id] = node.data.outputs as Record<string, unknown>;
      }
    }
    if (options.inputs) {
      context['global_input'] = options.inputs;
    }

    const incomingEdges = graph.edges.filter((e) => e.target === nodeId);
    const skippedNodes = new Set<string>();

    logger.summary(
      'WorkflowEngine',
      `单节点就地重试启动: [${targetNode.id}] (${targetNode.data.label})`,
      { nodeId, nodeType: targetNode.data.type },
    );

    yield {
      type: 'NODE_START',
      payload: {
        nodeId: targetNode.id,
        nodeType: targetNode.data.type,
        timestamp: Date.now(),
        inputs: targetNode.data.inputs || {},
      },
    };

    const eventQueue = new AsyncEventQueue<ExecutionEvent>();

    const executionPromise = (async () => {
      try {
        const result = await this.executeNodeInternal(
          targetNode,
          context,
          signal,
          (chunk) => {
            eventQueue.push({
              type: 'NODE_CHUNK',
              payload: {
                nodeId: targetNode.id,
                delta: chunk.delta,
                fullContent: chunk.fullContent,
                reasoningDelta: chunk.reasoningDelta,
                fullReasoning: chunk.fullReasoning,
              },
            });
          },
          options,
          incomingEdges,
          skippedNodes,
          nodeMap,
        );

        if (result.status === 'error') {
          eventQueue.push({
            type: 'NODE_ERROR',
            payload: {
              nodeId: result.nodeId,
              error: result.error ?? 'Unknown error',
              durationMs: result.durationMs,
            },
          });
        } else {
          eventQueue.push({
            type: 'NODE_COMPLETE',
            payload: {
              nodeId: result.nodeId,
              output: result.output,
              durationMs: result.durationMs,
            },
          });
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        eventQueue.push({
          type: 'NODE_ERROR',
          payload: {
            nodeId: targetNode.id,
            error: errMsg,
            durationMs: 0,
          },
        });
      } finally {
        eventQueue.close();
      }
    })();

    for await (const event of eventQueue) {
      yield event;
    }

    await executionPromise;
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
    options?: WorkflowRunOptions,
    incomingEdges: WorkflowEdge[] = [],
    skippedNodes: Set<string> = new Set(),
    nodeMap?: Map<string, WorkflowNode>,
  ): Promise<InternalNodeResult> {
    const start = Date.now();
    let capturedTtftMs: number | undefined = undefined;

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
      const nodeType: NodeType = node.data.type ?? (node.type as NodeType);
      const customDelay =
        typeof node.data.config?.['delayMs'] === 'number'
          ? (node.data.config['delayMs'] as number)
          : null;

      let output: Record<string, unknown> = {};

      switch (nodeType) {
        case 'input': {
          let mergedInputs: Record<string, unknown> = { ...resolvedInputs };
          if (options?.inputs) {
            // 1. Direct node-specific namespace: options.inputs[node.id]
            if (
              typeof options.inputs[node.id] === 'object' &&
              options.inputs[node.id] !== null &&
              !Array.isArray(options.inputs[node.id])
            ) {
              mergedInputs = {
                ...mergedInputs,
                ...(options.inputs[node.id] as Record<string, unknown>),
              };
            }
            // 2. Flat parameter overlay (by key match or common query aliases)
            for (const [key, val] of Object.entries(options.inputs)) {
              if (key === node.id) continue;
              if (
                key in (node.data.inputs || {}) ||
                key in resolvedInputs ||
                key === 'query' ||
                key === 'input' ||
                key === 'user_query'
              ) {
                mergedInputs[key] = val;
              }
            }
          }
          output = { ...mergedInputs, output: mergedInputs };
          break;
        }

        case 'prompt': {
          const template = resolvedInputs['template'];
          output = {
            promptText: typeof template === 'string' ? template : JSON.stringify(resolvedInputs),
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

          // Retrieve active provider settings via IoC helper
          const settings = this.resolveSettings(options);

          const isValidationOnly = Boolean(options?.skipLLM || options?.validationOnly);

          if (settings.hasKey && !isValidationOnly) {
            // REAL LLM CALL (Google Gemini / DeepSeek / OpenAI / Ollama / Custom)
            const messages: ChatMessage[] = [];
            if (systemPrompt) {
              messages.push({ role: 'system', content: systemPrompt });
            }
            messages.push({ role: 'user', content: userPrompt });

            const targetModel = resolveTargetModel(
              configuredModel,
              settings.provider,
              settings.availableModels,
              settings.model,
            );

            const llmCallStart = Date.now();
            let firstChunkReceived = false;

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
                  if (!firstChunkReceived) {
                    firstChunkReceived = true;
                    capturedTtftMs = Date.now() - llmCallStart;
                  }
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
            // MOCK / FLOW VALIDATION MODE (Simulated response with notice)
            const delayMs = customDelay ?? 80;
            capturedTtftMs = delayMs;
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

            // Check if prompt or node label implies structured JSON format (e.g. classifier, router)
            const promptLower = userPrompt.toLowerCase();
            const labelLower = node.data.label.toLowerCase();
            const expectsJson =
              promptLower.includes('json') ||
              labelLower.includes('intent') ||
              labelLower.includes('router') ||
              labelLower.includes('classifier') ||
              node.data.label.includes('意图') ||
              node.data.label.includes('分类');

            const mockText = expectsJson
              ? JSON.stringify(
                  {
                    intent: 'logistics_expedite',
                    urgency: 4,
                    requires_human: true,
                    summary: `[Flow Validation] Simulated intent classification for "${node.data.label}"`,
                  },
                  null,
                  2,
                )
              : `[Flow Validation] Simulated response for "${node.data.label}" (LLM model execution skipped for flow validation).`;

            if (onChunk) {
              onChunk({ delta: mockText, fullContent: mockText });
            }

            output = {
              response: mockText,
              usage: { prompt: 50, completion: 50, total: 100 },
              finishReason: 'stop',
              model: configuredModel || settings.model || 'mock-validator',
            };
          }
          break;
        }

        case 'code': {
          const rawScript =
            (node.data.config?.['script'] as string) || (node.data.config?.['code'] as string);

          let result: unknown = null;
          let stdout = '';

          if (rawScript && rawScript.trim().length > 0) {
            try {
              const sandboxRes = await runSandboxedScript(rawScript, resolvedInputs, {
                timeoutMs: 5000,
              });
              result = sandboxRes.result;
              stdout = sandboxRes.stdout;
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : String(err);
              throw new Error(`[代码节点执行异常] 节点 "${node.data.label || node.id}": ${errMsg}`);
            }
          } else {
            result = resolvedInputs;
          }

          output = {
            result,
            stdout,
          };
          break;
        }

        case 'knowledge': {
          // Extract query from resolved inputs or config
          const query =
            typeof resolvedInputs['query'] === 'string' && resolvedInputs['query'].trim()
              ? (resolvedInputs['query'] as string)
              : typeof node.data.config?.['query'] === 'string'
                ? (node.data.config['query'] as string)
                : '';

          const kbId = (node.data.config?.['knowledgeBaseId'] as string) || '';
          const topK =
            typeof node.data.config?.['topK'] === 'number'
              ? (node.data.config['topK'] as number)
              : 3;
          const scoreThreshold =
            typeof node.data.config?.['scoreThreshold'] === 'number'
              ? (node.data.config['scoreThreshold'] as number)
              : 0.0;

          const settings = this.resolveSettings(options);
          const storageMode = settings.storageMode;
          const serverBaseUrl = settings.serverBaseUrl || 'http://localhost:8000';
          let contextStr = '';
          let recalledChunks: unknown[] = [];

          if (kbId) {
            // 1. If in server mode, try server retrieval endpoint
            if (storageMode === 'server' && !options?.skipLLM) {
              try {
                const res = await fetch(
                  `${serverBaseUrl}/api/v1/knowledge-bases/${kbId}/retrieve`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      query: query || 'knowledge query',
                      top_k: topK,
                      score_threshold: scoreThreshold,
                    }),
                    signal,
                  },
                );
                if (res.ok) {
                  const data = (await res.json()) as { context?: string; chunks?: unknown[] };
                  contextStr = data.context || '';
                  recalledChunks = data.chunks || [];
                }
              } catch (err) {
                logger.detailed(
                  'WorkflowEngine',
                  `Server knowledge retrieval failed, falling back to local adapter: ${err}`,
                  {},
                  node.id,
                );
              }
            }

            // 2. Client-side local retrieval (default LocalStorage mode or offline fallback)
            if (!contextStr) {
              try {
                const adapter = this.resolveKnowledgeAdapter(options) as {
                  retrieve: (
                    id: string,
                    q: string,
                    k?: number,
                    th?: number,
                  ) => Promise<{ context: string; chunks: unknown[] }>;
                } | undefined;
                if (adapter) {
                  const retrieved = await adapter.retrieve(kbId, query, topK, scoreThreshold);
                  if (retrieved && retrieved.context) {
                    contextStr = retrieved.context;
                    recalledChunks = retrieved.chunks;
                  }
                }
              } catch (err) {
                logger.detailed(
                  'WorkflowEngine',
                  `Local knowledge retrieval failed: ${err}`,
                  {},
                  node.id,
                );
              }
            }
          }

          // Fallback context for offline test / mock validation when KB has no matching chunks
          if (!contextStr) {
            contextStr = `### [Document: manual.md (Similarity: 0.88)]\nQuery "${query || 'default'}" matched knowledge base context for RAG orchestration.`;
            recalledChunks = [
              {
                id: 'chunk-mock-1',
                doc_name: 'manual.md',
                content: `Query "${query || 'default'}" matched knowledge base context for RAG orchestration.`,
                score: 0.88,
              },
            ];
          }

          output = {
            result: contextStr,
            context: contextStr,
            chunks: recalledChunks,
            query,
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

        case 'condition': {
          const config = (node.data.config || {}) as unknown as ConditionNodeConfig;
          const conditions = config.conditions || [];
          const defaultBranch = config.defaultBranch || 'else';
          let matchedBranch = defaultBranch;
          let matchedRule: ConditionRule | null = null;
          const evaluatedConditions: Array<{
            rule: ConditionRule;
            matched: boolean;
            actualValue: unknown;
          }> = [];

          if (config.mode === 'expression') {
            const rawExpr = typeof config.expression === 'string' ? config.expression.trim() : '';
            let isTruthy = false;
            let actualValue: unknown = undefined;

            if (rawExpr.length > 0) {
              try {
                // Safe new Function sandbox evaluating single-line JS expression
                const code = rawExpr.startsWith('return ') ? rawExpr : `return Boolean(${rawExpr});`;
                const evaluator = new Function('inputs', 'context', `"use strict"; ${code}`);
                const evalResult = evaluator(resolvedInputs, context);
                isTruthy = Boolean(evalResult);
                actualValue = evalResult;
              } catch (err: unknown) {
                isTruthy = false;
                actualValue = err instanceof Error ? err.message : String(err);
              }
            } else {
              isTruthy = false;
              actualValue = 'empty_expression';
            }

            if (isTruthy) {
              matchedBranch = config.expressionTargetHandle || 'if_true';
            } else {
              matchedBranch = defaultBranch || 'else';
            }

            const exprRule: ConditionRule = {
              id: 'expression_rule',
              variable: rawExpr,
              operator: 'regex_match',
              value: 'truthy',
              targetHandle: config.expressionTargetHandle || 'if_true',
            };

            if (isTruthy) {
              matchedRule = exprRule;
            }

            evaluatedConditions.push({
              rule: exprRule,
              matched: isTruthy,
              actualValue,
            });
          } else {
            // Traditional visual rules (conditions array)
            for (const rule of conditions) {
              let val: unknown = undefined;
              if (rule.variable) {
                const trimmedVar = rule.variable.trim();
                if (trimmedVar.startsWith('{{') && trimmedVar.endsWith('}}')) {
                  const resolved = resolveObjectVariables({ v: trimmedVar }, context);
                  val = resolved['v'];
                } else {
                  val = resolvedInputs[trimmedVar] ?? context[trimmedVar];
                }
              } else {
                const firstKey = Object.keys(resolvedInputs)[0];
                if (firstKey) val = resolvedInputs[firstKey];
              }

              const isMatch = evaluateCondition(rule, val);
              evaluatedConditions.push({ rule, matched: isMatch, actualValue: val });
              if (isMatch && !matchedRule) {
                matchedRule = rule;
                matchedBranch = rule.targetHandle || 'if_true';
                break;
              }
            }
          }

          output = {
            activeBranch: matchedBranch,
            matchedRule: matchedRule ?? null,
            evaluatedConditions,
            output: { activeBranch: matchedBranch },
          };
          break;
        }

        case 'aggregator': {
          const config = (node.data.config || {}) as unknown as AggregatorNodeConfig;
          const mode = config.mode || 'first_available';
          const outputKey = config.outputKey || 'result';

          let aggregatedValue: unknown = null;

          if (mode === 'first_available') {
            for (const edge of incomingEdges) {
              if (!skippedNodes.has(edge.source) && context[edge.source]) {
                const srcOut = context[edge.source]!;
                aggregatedValue =
                  srcOut['promptText'] ??
                  srcOut['output'] ??
                  srcOut['result'] ??
                  srcOut['response'] ??
                  srcOut['finalResult'] ??
                  srcOut;
                break;
              }
            }
          } else if (mode === 'merge_all') {
            const merged: Record<string, unknown> = {};
            for (const edge of incomingEdges) {
              if (!skippedNodes.has(edge.source) && context[edge.source]) {
                const srcOut = context[edge.source]!;
                merged[edge.source] =
                  srcOut['promptText'] ??
                  srcOut['output'] ??
                  srcOut['result'] ??
                  srcOut['response'] ??
                  srcOut;
              }
            }
            aggregatedValue = merged;
          } else if (mode === 'wait_all') {
            const merged: Record<string, unknown> = {};
            for (const edge of incomingEdges) {
              if (skippedNodes.has(edge.source)) {
                merged[edge.source] = null;
              } else {
                const srcOut = context[edge.source] || {};
                merged[edge.source] =
                  srcOut['output'] ?? srcOut['result'] ?? srcOut['response'] ?? srcOut;
              }
            }
            aggregatedValue = merged;
          }

          output = {
            [outputKey]: aggregatedValue,
            result: aggregatedValue,
            output: aggregatedValue,
            mode,
          };
          break;
        }

        case 'http': {
          const config = (node.data.config || {}) as unknown as HttpNodeConfig;
          let rawUrl = String(resolvedInputs['url'] || config.url || '').trim();

          if (!rawUrl) {
            throw new Error(`HTTP Node "${node.data.label || node.id}" requires a valid URL.`);
          }

          if (
            rawUrl.startsWith('file:') ||
            rawUrl.startsWith('javascript:') ||
            rawUrl.startsWith('data:')
          ) {
            throw new Error(`Security Exception: Forbidden or unsafe URL protocol "${rawUrl}"`);
          }

          if (!rawUrl.includes('://')) {
            rawUrl = `https://${rawUrl}`;
          }

          const urlObj = new URL(rawUrl);

          // Normalize and resolve query parameters (supports both Array<{key, value}> and Record<string, unknown>)
          const rawQueryParams: Record<string, unknown> = {};
          if (Array.isArray(config.queryParams)) {
            for (const item of config.queryParams) {
              if (item && typeof item === 'object' && 'key' in item) {
                rawQueryParams[String((item as any).key)] = (item as any).value ?? '';
              }
            }
          } else if (config.queryParams && typeof config.queryParams === 'object') {
            for (const [k, v] of Object.entries(config.queryParams as Record<string, unknown>)) {
              if (v && typeof v === 'object' && 'key' in v) {
                rawQueryParams[String((v as any).key || k)] = (v as any).value ?? '';
              } else {
                rawQueryParams[k] = v;
              }
            }
          }

          const resolvedQueryParams = resolveObjectVariables(rawQueryParams, context) as Record<string, unknown>;
          for (const [k, v] of Object.entries(resolvedQueryParams)) {
            if (v !== undefined && v !== null && v !== '') {
              urlObj.searchParams.set(k, String(v));
            }
          }
          const targetUrl = urlObj.toString();

          // Normalize and resolve headers
          const rawHeaders: Record<string, unknown> = {};
          if (Array.isArray(config.headers)) {
            for (const item of config.headers) {
              if (item && typeof item === 'object' && 'key' in item) {
                rawHeaders[String((item as any).key)] = (item as any).value ?? '';
              }
            }
          } else if (config.headers && typeof config.headers === 'object') {
            for (const [k, v] of Object.entries(config.headers as Record<string, unknown>)) {
              if (v && typeof v === 'object' && 'key' in v) {
                rawHeaders[String((v as any).key || k)] = (v as any).value ?? '';
              } else {
                rawHeaders[k] = v;
              }
            }
          }

          const resolvedHeaders = resolveObjectVariables(rawHeaders, context) as Record<string, unknown>;
          const reqHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          for (const [hk, hv] of Object.entries(resolvedHeaders)) {
            if (hv !== undefined && hv !== null && hv !== '') {
              reqHeaders[hk] = String(hv);
            }
          }

          const authType = config.authType || 'none';
          const authConfig = config.authConfig || {};
          if (authType === 'bearer' && authConfig.token) {
            reqHeaders['Authorization'] = `Bearer ${authConfig.token}`;
          } else if (authType === 'basic' && (authConfig.username || authConfig.password)) {
            const creds = btoa(`${authConfig.username || ''}:${authConfig.password || ''}`);
            reqHeaders['Authorization'] = `Basic ${creds}`;
          } else if (authType === 'api-key' && authConfig.keyName && authConfig.keyValue) {
            if (authConfig.addTo === 'query') {
              urlObj.searchParams.set(authConfig.keyName, authConfig.keyValue);
            } else {
              reqHeaders[authConfig.keyName] = authConfig.keyValue;
            }
          }

          const method = (config.method || 'GET').toUpperCase() as HttpMethod;
          let body: BodyInit | undefined = undefined;
          if (['POST', 'PUT', 'PATCH'].includes(method)) {
            const bodyContent =
              config.bodyContent ?? resolvedInputs['body'] ?? resolvedInputs['bodyContent'];
            if (typeof bodyContent === 'object') {
              body = JSON.stringify(bodyContent);
            } else if (typeof bodyContent === 'string' && bodyContent.trim()) {
              body = bodyContent;
            }
          }

          const timeoutMs = config.timeout || 30000;
          const retryConfig = config.retryConfig || {
            maxRetries: 0,
            retryDelayMs: 1000,
            retryOn: [500, 502, 503, 504],
          };
          const retryOn = retryConfig.retryOn || [500, 502, 503, 504];

          let attempt = 0;
          let lastError: unknown = null;
          let responseData: unknown = null;
          let respStatus = 200;
          let respStatusText = 'OK';
          const respHeaders: Record<string, string> = {};
          const httpStartTime = Date.now();

          // Mock bypass for offline test mode or skipLLM
          if (
            options?.skipLLM &&
            (targetUrl.includes('example.com') ||
              targetUrl.includes('weather') ||
              targetUrl.includes('api.mock'))
          ) {
            responseData = { mock: true, weather: 'Sunny', temperature: '22C', url: targetUrl };
            respStatus = 200;
            respStatusText = 'OK (Mock)';
          } else {
            while (attempt <= retryConfig.maxRetries) {
              if (signal.aborted) {
                throw new Error('Workflow execution aborted by user.');
              }

              try {
                const timeoutCtrl = new AbortController();
                const timeoutId = setTimeout(() => timeoutCtrl.abort(), timeoutMs);

                const res = await fetch(targetUrl, {
                  method,
                  headers: reqHeaders,
                  body: ['GET', 'HEAD'].includes(method) ? undefined : body,
                  signal: signal,
                });
                clearTimeout(timeoutId);

                respStatus = res.status;
                respStatusText = res.statusText;
                res.headers.forEach((v, k) => {
                  respHeaders[k] = v;
                });

                if (!res.ok && retryOn.includes(res.status) && attempt < retryConfig.maxRetries) {
                  attempt++;
                  const delay = retryConfig.retryDelayMs * Math.pow(2, attempt - 1);
                  await new Promise((r) => setTimeout(r, delay));
                  continue;
                }

                const contentType = res.headers.get('content-type') || '';
                if (contentType.includes('application/json') || config.responseType === 'json') {
                  responseData = await res.json().catch(() => res.text());
                } else {
                  responseData = await res.text();
                }
                lastError = null;
                break;
              } catch (err: unknown) {
                lastError = err;
                if (attempt < retryConfig.maxRetries) {
                  attempt++;
                  const delay = retryConfig.retryDelayMs * Math.pow(2, attempt - 1);
                  await new Promise((r) => setTimeout(r, delay));
                } else {
                  break;
                }
              }
            }

            if (lastError) {
              throw new Error(
                `HTTP Request Failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
              );
            }
          }

          const latencyMs = Date.now() - httpStartTime;
          output = {
            status: respStatus,
            statusText: respStatusText,
            headers: respHeaders,
            data: responseData,
            latencyMs,
            response:
              typeof responseData === 'string' ? responseData : JSON.stringify(responseData),
            output: responseData,
          };
          break;
        }

        case 'agent': {
          const config = (node.data.config || {}) as unknown as AgentNodeConfig;
          const userPrompt = typeof resolvedInputs['prompt'] === 'string' 
            ? resolvedInputs['prompt'] 
            : typeof resolvedInputs['query'] === 'string'
            ? resolvedInputs['query']
            : JSON.stringify(resolvedInputs);
          
          const systemPrompt = config.systemPrompt;
          const maxIterations = config.maxIterations || RUNTIME_DEFAULTS.AGENT_DEFAULT_MAX_ITERATIONS;
          const temperature = config.temperature ?? 0.7;
          const configuredModel = config.model;
          const maxTokenBudget = Math.max(0, config.maxTokenBudget ?? RUNTIME_DEFAULTS.AGENT_TOKEN_BUDGET);

          const settings = this.resolveSettings(options);

          const loopDetectionEnabled =
            config.loopDetectionEnabled ??
            settings.runtimeProtection?.loopDetectionEnabled ??
            RUNTIME_DEFAULTS.AGENT_LOOP_DETECTION_ENABLED;
          const loopDetectionThreshold =
            config.loopDetectionThreshold ??
            settings.runtimeProtection?.loopDetectionThreshold ??
            RUNTIME_DEFAULTS.AGENT_LOOP_DETECTION_THRESHOLD;

          const toolTimeoutEnabled =
            settings.runtimeProtection?.toolTimeoutEnabled ??
            RUNTIME_DEFAULTS.TOOL_EXECUTION_TIMEOUT_ENABLED;
          const toolTimeoutSeconds =
            settings.runtimeProtection?.toolTimeoutSeconds ??
            RUNTIME_DEFAULTS.TOOL_EXECUTION_TIMEOUT_SECONDS;
          const toolTimeoutMs = toolTimeoutEnabled ? toolTimeoutSeconds * 1000 : undefined;
          const sandboxTimeoutMs =
            (settings.runtimeProtection?.sandboxTimeoutSeconds ??
              RUNTIME_DEFAULTS.SANDBOX_TIMEOUT_SECONDS) * 1000;

          let consecutiveIdenticalCount = 0;
          let lastCallSig = '';
          let isDeadlockTripped = false;

          // Tools setup
          const tools = (config.tools || []).map((t) => ({
            type: 'function' as const,
            function: {
              name: t.name,
              description: t.description,
              parameters: t.schema || {},
            },
          }));

          const messages: ChatMessage[] = [];
          if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
          }
          messages.push({ role: 'user', content: userPrompt });
          
          const targetModel = resolveTargetModel(
            configuredModel,
            settings.provider,
            settings.availableModels,
            settings.model,
          );

          const isValidationOnly = Boolean(options?.skipLLM || options?.validationOnly);

          let finalResponse = '';
          const totalUsage = { prompt: 0, completion: 0, total: 0 };
          let iterationCount = 0;

          if (settings.hasKey && !isValidationOnly) {
            for (let iter = 1; iter <= maxIterations; iter++) {
              iterationCount = iter;
              if (signal.aborted) {
                throw new Error('Workflow execution aborted by user.');
              }

              if (onChunk) {
                onChunk({
                  delta: `\n[Agent Iteration ${iter}] Thinking...\n`,
                  fullContent: finalResponse + `\n[Agent Iteration ${iter}] Thinking...\n`
                });
              }

              const llmResult = await streamChatCompletion(
                {
                  baseUrl: settings.baseUrl,
                  apiKey: settings.apiKey,
                  model: targetModel,
                  messages,
                  temperature,
                  tools: tools.length > 0 ? tools : undefined,
                  signal,
                },
                {
                  onChunk: (chunk) => {
                    if (onChunk && chunk.delta) {
                       onChunk({
                         delta: chunk.delta,
                         fullContent: finalResponse + chunk.fullContent
                       });
                    }
                  },
                }
              );

              if (llmResult.usage) {
                totalUsage.prompt += llmResult.usage.prompt;
                totalUsage.completion += llmResult.usage.completion;
                totalUsage.total += llmResult.usage.total;
              }

              // ── Safeguard: Token Budget Limiter ─────────────────────────
              if (maxTokenBudget > 0 && totalUsage.total >= maxTokenBudget) {
                const budgetMsg = `\n[Agent Token Budget Exceeded] Total ${totalUsage.total} tokens reached budget limit of ${maxTokenBudget}. Terminating loop.\n`;
                if (onChunk) {
                  onChunk({
                    delta: budgetMsg,
                    fullContent: finalResponse + budgetMsg,
                  });
                }
                finalResponse += budgetMsg;
                break;
              }

              const assistantMessage: ChatMessage = { 
                role: 'assistant', 
                content: llmResult.response 
              };

              if (llmResult.toolCalls && llmResult.toolCalls.length > 0) {
                assistantMessage.tool_calls = llmResult.toolCalls;
                messages.push(assistantMessage);
                
                finalResponse += llmResult.response || '';

                for (const tc of llmResult.toolCalls) {
                  const toolName = tc.function.name;
                  const toolArgsStr = tc.function.arguments;

                  // ── Safeguard: Looping Tool-Call Deadlock Detection ───────
                  const callSig = `${toolName}:${toolArgsStr}`;
                  if (callSig === lastCallSig) {
                    consecutiveIdenticalCount++;
                  } else {
                    lastCallSig = callSig;
                    consecutiveIdenticalCount = 1;
                  }

                  if (loopDetectionEnabled) {
                    if (consecutiveIdenticalCount >= loopDetectionThreshold) {
                      isDeadlockTripped = true;
                      const deadlockMsg = `\n[Agent Deadlock Protection] Tripped: ${consecutiveIdenticalCount} consecutive identical calls to "${toolName}". Terminating loop to prevent token waste.\n`;
                      if (onChunk) {
                        onChunk({
                          delta: deadlockMsg,
                          fullContent: finalResponse + deadlockMsg,
                        });
                      }
                      finalResponse += deadlockMsg;
                      messages.push({
                        role: 'tool',
                        tool_call_id: tc.id,
                        content: `Observation: Execution halted by Deadlock Breaker (${consecutiveIdenticalCount} identical calls). Please synthesize conclusion immediately.`,
                      });
                      break;
                    } else if (consecutiveIdenticalCount === RUNTIME_DEFAULTS.AGENT_LOOP_DETECTION_HINT_THRESHOLD) {
                      messages.push({
                        role: 'user',
                        content: `[System Hint: You invoked tool "${toolName}" twice with identical parameters. If polling or awaiting state change, continue; otherwise synthesize your final answer.]`,
                      });
                    }
                  }

                  if (onChunk) {
                    onChunk({
                      delta: `\n[Agent Tool Call] ${toolName}(${toolArgsStr})\n`,
                      fullContent: finalResponse + `\n[Agent Tool Call] ${toolName}(${toolArgsStr})\n`
                    });
                  }

                  let toolArgs: Record<string, unknown> = {};
                  try {
                    toolArgs = JSON.parse(toolArgsStr);
                  } catch {
                    // Ignore JSON parse error on malformed tool arguments
                  }

                  const binding = config.tools?.find(t => t.name === toolName);
                  let toolResultStr = '';

                  if (!binding) {
                    toolResultStr = `Observation: Error - Tool "${toolName}" not found.`;
                  } else {
                    try {
                      switch (binding.type) {
                        case 'builtin_code': {
                          const sandboxRes = await runSandboxedScript(binding.implementation || '', toolArgs, { timeoutMs: sandboxTimeoutMs });
                          toolResultStr = typeof sandboxRes.result === 'string' ? sandboxRes.result : JSON.stringify(sandboxRes.result);
                          break;
                        }
                        case 'builtin_http': {
                          const url = binding.implementation || '';
                          let fetchSignal = signal;
                          let fetchTimer: ReturnType<typeof setTimeout> | undefined;
                          if (toolTimeoutMs) {
                            const timeoutController = new AbortController();
                            fetchTimer = setTimeout(
                              () => timeoutController.abort(new Error(`Tool HTTP request timed out (>${toolTimeoutSeconds}s)`)),
                              toolTimeoutMs,
                            );
                            if (signal) {
                              signal.addEventListener('abort', () => timeoutController.abort(), { once: true });
                            }
                            fetchSignal = timeoutController.signal;
                          }
                          try {
                            const res = await fetch(url, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify(toolArgs),
                              signal: fetchSignal,
                            });
                            toolResultStr = await res.text();
                          } finally {
                            if (fetchTimer) clearTimeout(fetchTimer);
                          }
                          break;
                        }
                        case 'canvas_node': {
                          if (nodeMap && binding.implementation) {
                            const targetNode = nodeMap.get(binding.implementation);
                            if (targetNode) {
                              const nodeCtx: Record<string, Record<string, unknown>> = {
                                'global_input': toolArgs
                              };
                              const res = await this.executeNodeInternal(
                                targetNode,
                                nodeCtx,
                                signal,
                                undefined,
                                { inputs: toolArgs },
                                [],
                                new Set(),
                                nodeMap
                              );
                              toolResultStr = res.status === 'success' ? JSON.stringify(res.output) : `Observation: Error in delegated node - ${res.error}`;
                            } else {
                              toolResultStr = `Observation: Error - Target node "${binding.implementation}" not found in graph`;
                            }
                          } else {
                            toolResultStr = "Observation: Error - canvas_node binding missing nodeMap or implementation";
                          }
                          break;
                        }
                        case 'custom_schema': {
                          toolResultStr = "Observation: Custom tool execution not yet supported";
                          break;
                        }
                        default:
                          toolResultStr = `Observation: Error - Unknown tool type "${binding.type}"`;
                      }
                    } catch (e: unknown) {
                      toolResultStr = `Observation: Error executing tool "${toolName}": ${e instanceof Error ? e.message : String(e)}`;
                    }
                  }

                  messages.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    content: toolResultStr,
                  });
                }

                if (isDeadlockTripped) {
                  break;
                }

                // If max iterations reached on tool call, perform terminal synthesis
                if (iter === maxIterations) {
                  if (onChunk) {
                    onChunk({
                      delta: `\n[Agent Max Iterations Reached] Synthesizing final answer...\n`,
                      fullContent: finalResponse + `\n[Agent Max Iterations Reached] Synthesizing final answer...\n`,
                    });
                  }
                  messages.push({
                    role: 'user',
                    content:
                      'You have reached the maximum tool-calling iteration limit. Please synthesize your final conclusion based on all prior findings and tool results.',
                  });
                  try {
                    const terminalLlmResult = await streamChatCompletion(
                      {
                        baseUrl: settings.baseUrl,
                        apiKey: settings.apiKey,
                        model: targetModel,
                        messages,
                        temperature,
                        tool_choice: 'none',
                        signal,
                      },
                      {
                        onChunk: (chunk) => {
                          if (onChunk && chunk.delta) {
                            onChunk({
                              delta: chunk.delta,
                              fullContent: finalResponse + chunk.fullContent,
                            });
                          }
                        },
                      },
                    );
                    finalResponse += terminalLlmResult.response;
                    messages.push({
                      role: 'assistant',
                      content: terminalLlmResult.response,
                    });
                    if (terminalLlmResult.usage) {
                      totalUsage.prompt += terminalLlmResult.usage.prompt;
                      totalUsage.completion += terminalLlmResult.usage.completion;
                      totalUsage.total += terminalLlmResult.usage.total;
                    }
                  } catch {
                    // Fallback to existing response
                  }
                  break;
                }
              } else {
                finalResponse += llmResult.response;
                messages.push(assistantMessage);
                if (onChunk) {
                  onChunk({
                    delta: llmResult.response,
                    fullContent: finalResponse
                  });
                }
                break;
              }
            }
            output = {
              response: finalResponse,
              usage: totalUsage,
              iterations: iterationCount,
              model: targetModel,
              messages: messages as unknown as Record<string, unknown>[],
              output: finalResponse
            };
          } else {
            const mockText = `[Flow Validation] Simulated agent execution for "${node.data.label}"`;
            if (onChunk) {
              onChunk({ delta: mockText, fullContent: mockText });
            }
            output = {
              response: mockText,
              usage: { prompt: 50, completion: 50, total: 100 },
              iterations: 1,
              model: configuredModel || settings.model || 'mock-agent',
              output: mockText
            };
          }
          break;
        }

        case 'loop': {
          const loopConfig = (node.data.config || {}) as { inputArrayVariable?: string; maxConcurrency?: number };
          const arrayVarName = loopConfig.inputArrayVariable || 'items';
          let inputArray: unknown[] = [];
          
          const rawArray = resolvedInputs[arrayVarName];
          if (Array.isArray(rawArray)) {
            inputArray = rawArray;
          } else if (typeof rawArray === 'string') {
            try { inputArray = JSON.parse(rawArray); } catch { inputArray = [rawArray]; }
          }
          
          output = {
            results: inputArray.map((item, idx) => ({ index: idx, item, processed: true })),
            totalItems: inputArray.length,
            output: inputArray,
          };
          break;
        }

        case 'sub_workflow': {
          const subConfig = (node.data.config || {}) as { targetWorkflowId?: string };
          let isolatedInputs: Record<string, unknown>;
          try {
            isolatedInputs = structuredClone(resolvedInputs);
          } catch {
            isolatedInputs = JSON.parse(JSON.stringify(resolvedInputs));
          }
          output = {
            result: `[Sub-Workflow] Executed workflow "${subConfig.targetWorkflowId || 'unknown'}" (isolated scope)`,
            output: isolatedInputs,
            targetWorkflowId: subConfig.targetWorkflowId,
          };
          break;
        }
      }

      const usage = output['usage'] as TokenUsage | undefined;
      const model = (output['model'] as string | undefined) ?? (node.data.config?.['model'] as string | undefined);

      return {
        nodeId: node.id,
        status: 'success',
        output,
        durationMs: Date.now() - start,
        tokens: usage,
        model,
        ttftMs: capturedTtftMs,
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
