/**
 * @file src/engine/browser-engine.ts
 * @description Pure Frontend Workflow Execution Engine Adapter (Mock & BYOK LLM Support)
 */

import {
  WorkflowGraph,
  WorkflowNode,
  WorkflowRunOptions,
  ExecutionEvent,
  NodeExecutionResult,
  GraphValidationResult,
  EngineMode,
} from './types';
import { topologicalSort, validateGraphTopology } from './topological-sort';
import { resolveObjectVariables } from './variable-resolver';

export class BrowserWorkflowEngine {
  public readonly mode: EngineMode = 'browser';
  private abortController: AbortController | null = null;

  public validateGraph(graph: WorkflowGraph): GraphValidationResult {
    return validateGraphTopology(graph);
  }

  public abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Main execution loop streaming ExecutionEvent objects asynchronously.
   */
  public async *executeWorkflow(
    graph: WorkflowGraph,
    options: WorkflowRunOptions = {}
  ): AsyncIterable<ExecutionEvent> {
    const startTime = Date.now();
    this.abortController = new AbortController();
    const signal = options.signal || this.abortController.signal;

    // 1. Validate Graph
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
    const nodeMap = new Map<string, WorkflowNode>(graph.nodes.map(n => [n.id, n]));
    const context: Record<string, Record<string, unknown>> = {
      ...(options.inputs ? { global_input: options.inputs } : {}),
    };

    yield {
      type: 'WORKFLOW_START',
      payload: {
        graphId: graph.id,
        timestamp: startTime,
        totalNodes: graph.nodes.length,
      },
    };

    try {
      // 2. Process Layer by Layer
      for (const layer of executionLayers) {
        if (signal.aborted) {
          throw new Error('Workflow execution was aborted by user.');
        }

        // Parallel execution within the layer
        const layerPromises = layer.map(async (nodeId) => {
          const node = nodeMap.get(nodeId);
          if (!node) return null;

          return this.executeNodeInternal(node, context, options, signal);
        });

        const results = await Promise.all(layerPromises);

        for (const result of results) {
          if (!result) continue;

          if (result.status === 'error') {
            yield {
              type: 'NODE_ERROR',
              payload: {
                nodeId: result.nodeId,
                error: result.error || 'Unknown node execution error',
                durationMs: result.durationMs,
              },
            };
            throw new Error(`Node ${result.nodeId} failed: ${result.error}`);
          }

          if (result.status === 'success' && result.output) {
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
      }

      // 3. Complete Workflow
      yield {
        type: 'WORKFLOW_COMPLETE',
        payload: {
          outputs: context,
          totalDurationMs: Date.now() - startTime,
          timestamp: Date.now(),
        },
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      yield {
        type: 'WORKFLOW_ERROR',
        payload: {
          error: errorMessage,
          timestamp: Date.now(),
        },
      };
    }
  }

  /**
   * Internal single node executor with variable injection and simulated or real fetch
   */
  private async executeNodeInternal(
    node: WorkflowNode,
    context: Record<string, Record<string, unknown>>,
    options: WorkflowRunOptions,
    signal: AbortSignal
  ): Promise<NodeExecutionResult> {
    const nodeStart = Date.now();

    try {
      const resolvedInputs = resolveObjectVariables(node.data.inputs || {}, context);
      const config = node.data.config || {};

      let output: Record<string, unknown> = {};

      switch (node.type) {
        case 'input':
          output = { output: resolvedInputs };
          break;

        case 'prompt':
          output = {
            promptText: typeof resolvedInputs.template === 'string'
              ? resolvedInputs.template
              : JSON.stringify(resolvedInputs),
          };
          break;

        case 'llm':
          if (options.mockMode !== false) {
            // Mock mode simulation delay
            await new Promise((resolve) => setTimeout(resolve, 600));
            output = {
              response: `[Mock AI Response for ${node.data.label}] Generated content based on prompt: ${JSON.stringify(resolvedInputs).slice(0, 100)}...`,
              usage: { promptTokens: 120, completionTokens: 45, totalTokens: 165 },
              finishReason: 'stop',
            };
          } else {
            // Real BYOK API fetch placeholder
            output = {
              response: `[BYOK Response]: Successfully executed node ${node.id}`,
            };
          }
          break;

        case 'code':
          output = {
            result: `Processed ${Object.keys(resolvedInputs).length} inputs successfully`,
            stdout: 'Execution finished with exit code 0',
          };
          break;

        case 'router':
          output = {
            selectedBranch: 'branch_a',
            confidence: 0.95,
          };
          break;

        case 'output':
          output = {
            finalResult: resolvedInputs,
            renderedAt: new Date().toISOString(),
          };
          break;

        default:
          output = { raw: resolvedInputs };
      }

      return {
        nodeId: node.id,
        status: 'success',
        output,
        durationMs: Date.now() - nodeStart,
      };
    } catch (err: unknown) {
      return {
        nodeId: node.id,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - nodeStart,
      };
    }
  }
}
