/**
 * @file    src/services/telemetry/otel-tracer.ts
 * @version 1.0.0
 * @description
 *   In-memory OpenTelemetry / OpenInference-compliant TelemetryTracer for PatchCat.
 *   Instruments Kahn topological wave scheduling, node execution lifecycles,
 *   time-to-first-token (TTFT) metrics, and inputs/outputs freeze-frame snapshots.
 */

import type {
  NodeType,
  NodeStatus,
  TokenUsage,
  WorkflowRunStatus,
  WorkflowTriggerMode,
  NodeRunSnapshot,
  RunHistoryRecord,
  OTelSpan,
  OTelExportTrace,
} from '../../engine/types.ts';

/**
 * Generates a random 32-character hexadecimal string conforming to W3C Trace Context trace-id.
 */
export function generateTraceId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a random 16-character hexadecimal string conforming to W3C Trace Context span-id.
 */
export function generateSpanId(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Maps PatchCat node types to OpenInference semantic span kinds.
 */
export function mapNodeToOpenInferenceKind(
  nodeType: NodeType
): 'LLM' | 'AGENT' | 'RETRIEVER' | 'CHAIN' {
  switch (nodeType) {
    case 'llm':
      return 'LLM';
    case 'agent':
      return 'AGENT';
    case 'knowledge':
      return 'RETRIEVER';
    default:
      return 'CHAIN';
  }
}

interface InFlightNodeSpan {
  spanId: string;
  parentSpanId: string;
  nodeId: string;
  nodeLabel: string;
  nodeType: NodeType;
  waveIndex: number;
  startedAt: number;
  startPerfNow: number;
  ttftMs?: number;
  inputsSnapshot: Record<string, unknown>;
  modelName?: string;
}

export class TelemetryTracer {
  private traceId = '';
  private rootSpanId = '';
  private workflowId = '';
  private workflowTitle = '';
  private triggerMode: WorkflowTriggerMode = 'manual';
  private startedAt = 0;
  private startPerfNow = 0;

  private currentWaveSpanId: string | null = null;
  private currentWaveIndex = 0;
  private currentWaveStartPerf = 0;

  private inFlightNodes = new Map<string, InFlightNodeSpan>();
  private completedNodeSnapshots = new Map<string, NodeRunSnapshot>();
  private spans: OTelSpan[] = [];

  constructor(init?: {
    workflowId: string;
    workflowTitle?: string;
    triggerMode?: WorkflowTriggerMode;
  }) {
    if (init) {
      this.startTrace(init.workflowId, init.workflowTitle, init.triggerMode);
    }
  }

  /**
   * Initializes a new trace context for a workflow run.
   */
  public startTrace(
    workflowId: string,
    workflowTitle = 'Untitled Workflow',
    triggerMode: WorkflowTriggerMode = 'manual'
  ): string {
    this.traceId = generateTraceId();
    this.rootSpanId = generateSpanId();
    this.workflowId = workflowId;
    this.workflowTitle = workflowTitle;
    this.triggerMode = triggerMode;
    this.startedAt = Date.now();
    this.startPerfNow = typeof performance !== 'undefined' ? performance.now() : Date.now();

    this.inFlightNodes.clear();
    this.completedNodeSnapshots.clear();
    this.spans = [];
    this.currentWaveSpanId = null;

    return this.traceId;
  }

  /**
   * Starts a span representing a topological wave (concurrent wave of nodes).
   */
  public startWaveSpan(waveIndex: number): { spanId: string; toString(): string } {
    this.currentWaveIndex = waveIndex;
    this.currentWaveSpanId = generateSpanId();
    this.currentWaveStartPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const id = this.currentWaveSpanId;
    return {
      spanId: id,
      toString() {
        return id;
      },
    };
  }

  /**
   * Closes the active wave span.
   */
  public endWaveSpan(): void {
    if (!this.currentWaveSpanId) return;
    const nowPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const durationMs = Math.max(0, Math.round(nowPerf - this.currentWaveStartPerf));

    const startNano = (BigInt(this.startedAt) * 1_000_000n).toString();
    const endNano = ((BigInt(this.startedAt) + BigInt(durationMs)) * 1_000_000n).toString();

    this.spans.push({
      traceId: this.traceId,
      spanId: this.currentWaveSpanId,
      parentSpanId: this.rootSpanId,
      name: `workflow.wave.${this.currentWaveIndex}`,
      kind: 'INTERNAL',
      startTimeUnixNano: startNano,
      endTimeUnixNano: endNano,
      status: { code: 'OK' },
      attributes: {
        'workflow.wave.index': this.currentWaveIndex,
        'workflow.wave.duration_ms': durationMs,
      },
    });

    this.currentWaveSpanId = null;
  }

  /**
   * Starts tracking execution for a specific node.
   */
  public startNodeSpan(
    nodeId: string,
    nodeLabel: string,
    nodeType: NodeType,
    arg4?: number | Record<string, unknown>,
    arg5?: Record<string, unknown> | string,
    arg6?: string
  ): { spanId: string; parentSpanId?: string; toString(): string } {
    let waveIndex = this.currentWaveIndex;
    let inputsSnapshot: Record<string, unknown> = {};
    let parentSpanId = this.currentWaveSpanId || this.rootSpanId;
    let modelName: string | undefined = undefined;

    if (typeof arg4 === 'number') {
      waveIndex = arg4;
      if (arg5 && typeof arg5 === 'object') {
        inputsSnapshot = arg5 as Record<string, unknown>;
      }
      if (typeof arg6 === 'string') {
        modelName = arg6;
      }
    } else if (arg4 && typeof arg4 === 'object') {
      inputsSnapshot = arg4 as Record<string, unknown>;
      if (typeof arg5 === 'string') {
        parentSpanId = arg5;
      }
      if (typeof arg6 === 'string') {
        modelName = arg6;
      }
    }

    const spanId = generateSpanId();
    const startPerfNow = typeof performance !== 'undefined' ? performance.now() : Date.now();

    this.inFlightNodes.set(nodeId, {
      spanId,
      parentSpanId,
      nodeId,
      nodeLabel,
      nodeType,
      waveIndex,
      startedAt: Date.now(),
      startPerfNow,
      inputsSnapshot,
      modelName,
    });

    return {
      spanId,
      parentSpanId,
      toString() {
        return spanId;
      },
    };
  }

  /**
   * Records Time-to-First-Token (TTFT) latency for an in-flight LLM node.
   */
  public recordNodeTTFT(nodeId: string, ttftMs: number): void {
    const inFlight = this.inFlightNodes.get(nodeId);
    if (inFlight) {
      inFlight.ttftMs = Math.round(ttftMs);
    }
  }

  public recordTTFT(nodeId: string, ttftMs: number): void {
    this.recordNodeTTFT(nodeId, ttftMs);
  }

  /**
   * Completes the execution span for a node and returns its frozen snapshot.
   */
  public endNodeSpan(
    nodeId: string,
    status: NodeStatus,
    outputsSnapshot: Record<string, unknown>,
    arg4?: TokenUsage | { tokens?: TokenUsage; costUSD?: number; error?: string; model?: string },
    estimatedCostUSD?: number,
    error?: string,
    toolCalls?: Array<{
      tool: string;
      args: unknown;
      result: unknown;
      durationMs: number;
    }>
  ): NodeRunSnapshot {
    const inFlight = this.inFlightNodes.get(nodeId);
    const nowMs = Date.now();
    const nowPerf = typeof performance !== 'undefined' ? performance.now() : nowMs;

    const startedAt = inFlight?.startedAt ?? nowMs;
    const durationMs = inFlight
      ? Math.max(0, Math.round(nowPerf - inFlight.startPerfNow))
      : 0;

    let tokenUsage: TokenUsage | undefined = undefined;
    let costUSD = estimatedCostUSD;
    let err = error;

    if (arg4) {
      if ('tokens' in arg4 || 'costUSD' in arg4 || 'model' in arg4) {
        const meta = arg4 as { tokens?: TokenUsage; costUSD?: number; error?: string; model?: string };
        tokenUsage = meta.tokens;
        costUSD = meta.costUSD ?? costUSD;
        err = meta.error ?? err;
        if (meta.model && inFlight) {
          inFlight.modelName = meta.model;
        }
      } else if (
        'total' in arg4 ||
        'prompt' in arg4 ||
        'totalTokens' in arg4 ||
        'promptTokens' in arg4
      ) {
        const raw = arg4 as Record<string, number>;
        const p = raw.prompt ?? raw.promptTokens ?? 0;
        const c = raw.completion ?? raw.completionTokens ?? 0;
        const tot = raw.total ?? raw.totalTokens ?? p + c;
        tokenUsage = {
          prompt: p,
          completion: c,
          total: tot,
          promptTokens: p,
          completionTokens: c,
          totalTokens: tot,
        } as unknown as TokenUsage;
      }
    }

    const snapshot: NodeRunSnapshot = {
      nodeId,
      nodeName: inFlight?.nodeLabel ?? nodeId,
      nodeLabel: inFlight?.nodeLabel ?? nodeId,
      nodeType: inFlight?.nodeType ?? 'prompt',
      status,
      waveIndex: inFlight?.waveIndex ?? 0,
      startedAt,
      completedAt: nowMs,
      durationMs,
      ttftMs: inFlight?.ttftMs,
      inputsSnapshot: inFlight?.inputsSnapshot ?? {},
      outputsSnapshot,
      inputs: inFlight?.inputsSnapshot ?? {},
      outputs: outputsSnapshot,
      tokens: tokenUsage,
      tokenUsage,
      costUSD,
      estimatedCostUSD: costUSD,
      model: inFlight?.modelName,
      spanId: inFlight?.spanId,
      parentSpanId: inFlight?.parentSpanId,
      error: err,
      toolCalls,
    };

    this.completedNodeSnapshots.set(nodeId, snapshot);

    // Build OTel Span
    if (inFlight) {
      const startNano = (BigInt(startedAt) * 1_000_000n).toString();
      const endNano = (BigInt(nowMs) * 1_000_000n).toString();
      const oiKind = mapNodeToOpenInferenceKind(inFlight.nodeType);
      const isOk = status === 'success' || (status as string) === 'completed';

      const promptTokens = tokenUsage?.prompt ?? (tokenUsage as unknown as { promptTokens?: number })?.promptTokens;
      const completionTokens = tokenUsage?.completion ?? (tokenUsage as unknown as { completionTokens?: number })?.completionTokens;
      const totalTokens = tokenUsage?.total ?? (tokenUsage as unknown as { totalTokens?: number })?.totalTokens;

      this.spans.push({
        traceId: this.traceId,
        spanId: inFlight.spanId,
        parentSpanId: inFlight.parentSpanId,
        name: `node.${nodeId} (${inFlight.nodeLabel})`,
        kind: inFlight.nodeType === 'llm' || inFlight.nodeType === 'http' ? 'CLIENT' : 'INTERNAL',
        startTimeUnixNano: startNano,
        endTimeUnixNano: endNano,
        status: {
          code: isOk ? 'OK' : 'ERROR',
          message: err,
        },
        attributes: {
          'openinference.span.kind': oiKind,
          'node.id': nodeId,
          'node.type': inFlight.nodeType,
          'node.label': inFlight.nodeLabel,
          'llm.model_name': inFlight.modelName,
          'llm.time_to_first_token_ms': inFlight.ttftMs,
          'llm.ttft_ms': inFlight.ttftMs,
          'llm.token_count.prompt': promptTokens,
          'llm.token_count.completion': completionTokens,
          'llm.token_count.total': totalTokens,
          'cost.estimated_usd': costUSD,
          'gen_ai.usage.cost_usd': costUSD,
          'error.message': err,
        },
      });

      this.inFlightNodes.delete(nodeId);
    }

    return snapshot;
  }

  /**
   * Finalizes the trace, builds the root span, and packages the complete RunHistoryRecord.
   */
  public completeTrace(status: WorkflowRunStatus, error?: string): RunHistoryRecord {
    const completedAt = Date.now();
    const nowPerf = typeof performance !== 'undefined' ? performance.now() : completedAt;
    const durationMs = Math.max(0, Math.round(nowPerf - this.startPerfNow));

    // Ensure active wave span is closed if still open
    if (this.currentWaveSpanId) {
      this.endWaveSpan();
    }

    // Accumulate total tokens and cost
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let totalCostUSD = 0;

    const nodeSnapshots: Record<string, NodeRunSnapshot> = {};
    for (const [nodeId, snap] of this.completedNodeSnapshots.entries()) {
      nodeSnapshots[nodeId] = snap;
      const tokens = snap.tokens || snap.tokenUsage;
      if (tokens) {
        promptTokens += tokens.prompt ?? (tokens as unknown as { promptTokens?: number }).promptTokens ?? 0;
        completionTokens += tokens.completion ?? (tokens as unknown as { completionTokens?: number }).completionTokens ?? 0;
        totalTokens += tokens.total ?? (tokens as unknown as { totalTokens?: number }).totalTokens ?? 0;
      }
      const cost = snap.costUSD ?? snap.estimatedCostUSD;
      if (cost) {
        totalCostUSD += cost;
      }
    }

    totalCostUSD = Math.round(totalCostUSD * 1_000_000) / 1_000_000;

    // Build root span
    const startNano = (BigInt(this.startedAt) * 1_000_000n).toString();
    const endNano = (BigInt(completedAt) * 1_000_000n).toString();
    const isOk = status === 'success' || status === 'completed';

    const rootSpan: OTelSpan = {
      traceId: this.traceId,
      spanId: this.rootSpanId,
      name: `workflow.run (${this.workflowTitle})`,
      kind: 'SERVER',
      startTimeUnixNano: startNano,
      endTimeUnixNano: endNano,
      status: {
        code: isOk ? 'OK' : 'ERROR',
        message: error,
      },
      attributes: {
        'workflow.id': this.workflowId,
        'workflow.title': this.workflowTitle,
        'workflow.trigger_mode': this.triggerMode,
        'workflow.status': status,
        'workflow.duration_ms': durationMs,
        'workflow.total_tokens': totalTokens,
        'workflow.estimated_cost_usd': totalCostUSD,
      },
    };

    const allSpans = [rootSpan, ...this.spans];

    const otelTrace: OTelExportTrace = {
      resourceSpans: [
        {
          resource: {
            attributes: {
              'service.name': 'patchcat',
              'service.version': 'v0.4.8',
              'telemetry.sdk.name': 'patchcat-telemetry',
              'telemetry.sdk.language': 'typescript',
            },
          },
          scopeSpans: [
            {
              scope: {
                name: 'patchcat.dag.tracer',
                version: '1.0.0',
              },
              spans: allSpans,
            },
          ],
        },
      ],
    };

    return {
      id: this.traceId,
      runId: this.traceId,
      traceId: this.traceId,
      workflowId: this.workflowId,
      workflowTitle: this.workflowTitle,
      startedAt: this.startedAt,
      completedAt,
      durationMs,
      totalDurationMs: durationMs,
      status,
      triggerMode: this.triggerMode,
      totalTokens: {
        prompt: promptTokens,
        completion: completionTokens,
        total: totalTokens || promptTokens + completionTokens,
        promptTokens,
        completionTokens,
        totalTokens: totalTokens || promptTokens + completionTokens,
      } as unknown as TokenUsage,
      estimatedCostUSD: totalCostUSD,
      totalCostUSD,
      nodeSnapshots,
      stepSnapshots: Object.values(nodeSnapshots),
      spans: allSpans,
      otelTrace,
      error,
    };
  }

  public getTraceId(): string {
    return this.traceId;
  }
}
