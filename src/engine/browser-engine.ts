/**
 * @file    src/engine/browser-engine.ts
 * @version 2.0.0
 * @description
 *   Pure-frontend workflow execution engine.
 *
 *   This adapter implements the complete DAG scheduling loop **entirely
 *   inside the browser** — no backend required. It supports two sub-modes:
 *
 *   - **Mock** — instant fixture responses with configurable latency.
 *   - **BYOK (Bring Your Own Key)** — real `fetch()` calls to OpenAI-
 *     compatible endpoints using the user's own API key.
 *
 *   The engine emits a typed `AsyncIterable<ExecutionEvent>` stream that
 *   the Zustand store consumes to drive real-time UI updates.
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

// ─────────────────────────────────────────────────────────────────────────────
// Internal result type (engine-private, not exported)
// ─────────────────────────────────────────────────────────────────────────────

interface InternalNodeResult {
  nodeId: string;
  status: 'success' | 'error';
  output: Record<string, unknown>;
  error?: string;
  durationMs: number;
}

/** Minimal graph shape for the sorting/validation helpers. */
interface GraphInput {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
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

  // ───────────────────────────────────────────────────────────────────────
  // Main execution loop — yields a typed event stream
  // ───────────────────────────────────────────────────────────────────────

  public async *executeWorkflow(
    graph: GraphInput,
    options: WorkflowRunOptions = {},
  ): AsyncGenerator<ExecutionEvent> {
    const startTime = Date.now();
    this.abortController = new AbortController();
    const signal = options.signal ?? this.abortController.signal;

    // 1. Pre-flight validation
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
      for (const layer of executionLayers) {
        if (signal.aborted) {
          throw new Error('Workflow execution aborted by user.');
        }

        // Execute all nodes within the current layer in parallel
        const layerResults = await Promise.all(
          layer
            .map((nodeId) => nodeMap.get(nodeId))
            .filter((n): n is WorkflowNode => n !== undefined)
            .map((node) => this.executeNodeInternal(node, context, signal)),
        );

        // Emit events for each completed node
        for (const result of layerResults) {
          if (result.status === 'error') {
            yield {
              type: 'NODE_ERROR',
              payload: {
                nodeId: result.nodeId,
                error: result.error ?? 'Unknown error',
                durationMs: result.durationMs,
              },
            };
            throw new Error(`Node ${result.nodeId} failed: ${result.error}`);
          }

          // Successful node — store output in context for downstream nodes
          context[result.nodeId] = result.output;
          yield {
            type: 'NODE_COMPLETE',
            payload: {
              nodeId: result.nodeId,
              output: result.output,
              durationMs: result.durationMs,
            },
          };
        }
      }

      // 3. Success
      yield {
        type: 'WORKFLOW_COMPLETE',
        payload: {
          outputs: context,
          totalDurationMs: Date.now() - startTime,
          timestamp: Date.now(),
        },
      };
    } catch (err: unknown) {
      yield {
        type: 'WORKFLOW_ERROR',
        payload: {
          error: err instanceof Error ? err.message : String(err),
          timestamp: Date.now(),
        },
      };
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Single-node executor (mock / BYOK placeholder)
  // ───────────────────────────────────────────────────────────────────────

  private async executeNodeInternal(
    node: WorkflowNode,
    context: Record<string, Record<string, unknown>>,
    signal: AbortSignal,
  ): Promise<InternalNodeResult> {
    const start = Date.now();

    try {
      if (signal.aborted) {
        throw new Error('Workflow execution aborted by user.');
      }

      // Check for explicitly simulated node failure for error bubbling tests
      if (node.data.config?.['simulateError'] || node.data.config?.['throwError']) {
        const errorMsg = String(node.data.config?.['errorMessage'] ?? `Node ${node.id} execution failed intentionally.`);
        throw new Error(errorMsg);
      }

      const resolvedInputs = resolveObjectVariables(
        node.data.inputs as Record<string, string>,
        context,
      );
      const nodeType: NodeType = node.data.type;
      const customDelay = typeof node.data.config?.['delayMs'] === 'number'
        ? (node.data.config['delayMs'] as number)
        : null;

      let output: Record<string, unknown> = {};

      switch (nodeType) {
        case 'input':
          output = { ...resolvedInputs, output: resolvedInputs };
          break;

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
          const delayMs = customDelay ?? (100 + Math.random() * 50);
          // In-flight abortable sleep
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

          output = {
            response: `[Mock] Response for "${node.data.label}" — prompt: ${
              JSON.stringify(resolvedInputs).slice(0, 80)
            }…`,
            usage: { promptTokens: 120, completionTokens: 45, totalTokens: 165 },
            finishReason: 'stop',
          };
          break;
        }

        case 'code': {
          if (customDelay) {
            await new Promise<void>((resolve, reject) => {
              if (signal.aborted) return reject(new Error('Workflow execution aborted by user.'));
              const timer = setTimeout(() => resolve(), customDelay);
              signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Workflow execution aborted by user.')); }, { once: true });
            });
          }
          output = {
            result: `Processed ${Object.keys(resolvedInputs).length} input(s)`,
            stdout: '',
          };
          break;
        }

        case 'output':
          output = {
            finalResult: resolvedInputs,
            renderedAt: new Date().toISOString(),
          };
          break;
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
