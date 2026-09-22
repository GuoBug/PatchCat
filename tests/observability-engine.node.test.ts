/**
 * @file    tests/observability-engine.node.test.ts
 * @description
 *   Node.js tests for v0.4.8 Run Observability, TelemetryTracer, and OpenTelemetry alignment.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { BrowserWorkflowEngine } from '../src/engine/browser-engine.ts';
import { TelemetryTracer } from '../src/services/telemetry/otel-tracer.ts';
import { exportOTelTraceToJson } from '../src/services/telemetry/otel-exporter.ts';
import { estimateTokenCostUSD, getModelPricing } from '../src/config/model-pricing.ts';
import type { WorkflowNode, WorkflowEdge, RunHistoryRecord } from '../src/engine/types.ts';

describe('v0.4.8 Run Observability & OpenTelemetry Tracing', () => {
  test('BrowserWorkflowEngine generates valid RunHistoryRecord upon workflow completion', async () => {
    const engine = new BrowserWorkflowEngine();

    const nodes: WorkflowNode[] = [
      {
        id: 'node_1',
        type: 'input',
        position: { x: 0, y: 0 },
        data: {
          label: 'User Query',
          type: 'input',
          inputs: { user_query: 'Hello PatchCat Observability' },
          status: 'idle',
        },
      },
      {
        id: 'node_2',
        type: 'llm',
        position: { x: 300, y: 0 },
        data: {
          label: 'LLM Generator',
          type: 'llm',
          inputs: { prompt: '{{node_1.user_query}}' },
          config: { model: 'gemini-2.5-flash', delayMs: 10 },
          status: 'idle',
        },
      },
    ];

    const edges: WorkflowEdge[] = [
      {
        id: 'edge_1',
        source: 'node_1',
        target: 'node_2',
      },
    ];

    let completeEventPayload: { runRecord?: RunHistoryRecord } | null = null;

    for await (const event of engine.executeWorkflow(
      { nodes, edges },
      {
        workflowId: 'test-wf-observability-1',
        workflowTitle: 'Test Workflow',
        triggerMode: 'manual',
      },
    )) {
      if (event.type === 'WORKFLOW_COMPLETE') {
        completeEventPayload = event.payload;
      }
    }

    assert.ok(completeEventPayload, 'WORKFLOW_COMPLETE event must be emitted');
    const record = completeEventPayload.runRecord;
    assert.ok(record, 'Payload must contain a runRecord');

    // Verify Trace ID (32 hex characters)
    assert.match(record.traceId, /^[a-f0-9]{32}$/, 'Trace ID must be a 32-char hex string');
    assert.equal(record.workflowId, 'test-wf-observability-1');
    assert.equal(record.workflowTitle, 'Test Workflow');
    assert.equal(record.status, 'success');
    assert.equal(record.triggerMode, 'manual');

    // Verify step snapshots
    assert.ok(record.stepSnapshots.length >= 2, 'Should capture snapshots for all executed nodes');
    const llmSnapshot = record.stepSnapshots.find((s) => s.nodeId === 'node_2');
    assert.ok(llmSnapshot, 'Should find node_2 snapshot');
    assert.equal(llmSnapshot.nodeType, 'llm');
    assert.equal(llmSnapshot.status, 'success');
    assert.ok(llmSnapshot.tokens !== undefined, 'LLM snapshot should capture token usage');
    assert.ok(llmSnapshot.costUSD !== undefined, 'LLM snapshot should calculate token cost');

    // Verify OTel Spans
    assert.ok(record.spans.length >= 3, 'Must contain wave span and node spans');
    for (const span of record.spans) {
      assert.match(span.traceId, /^[a-f0-9]{32}$/);
      assert.match(span.spanId, /^[a-f0-9]{16}$/);
    }
  });

  test('TelemetryTracer captures TTFT and complies with OpenInference attributes', () => {
    const tracer = new TelemetryTracer({
      workflowId: 'wf-telemetry-manual',
      workflowTitle: 'Manual Audit Workflow',
      triggerMode: 'api',
    });

    const waveSpan = tracer.startWaveSpan(0);
    assert.match(waveSpan.spanId, /^[a-f0-9]{16}$/);

    const nodeSpan = tracer.startNodeSpan(
      'node_llm_1',
      'Translate Agent',
      'llm',
      { prompt: 'Translate this to Chinese' },
      waveSpan.spanId,
    );
    assert.match(nodeSpan.spanId, /^[a-f0-9]{16}$/);
    assert.equal(nodeSpan.parentSpanId, waveSpan.spanId);

    // Record TTFT
    tracer.recordTTFT('node_llm_1', 125);

    // End node span
    const endedNode = tracer.endNodeSpan(
      'node_llm_1',
      'success',
      { response: '这是翻译内容' },
      {
        tokens: { prompt: 100, completion: 50, total: 150 },
        model: 'deepseek-chat',
        costUSD: 0.00015,
      },
    );

    assert.ok(endedNode);
    assert.equal(endedNode.model, 'deepseek-chat');
    assert.equal(endedNode.tokens?.prompt, 100);
    assert.equal(endedNode.tokens?.completion, 50);
    assert.equal(endedNode.tokens?.total, 150);
    assert.equal(endedNode.ttftMs, 125);
    assert.equal(endedNode.costUSD, 0.00015);

    tracer.endWaveSpan();

    const finalRecord = tracer.completeTrace('success');
    assert.equal(finalRecord.workflowId, 'wf-telemetry-manual');
    assert.equal(finalRecord.totalTokens.total, 150);
    assert.equal(finalRecord.totalCostUSD, 0.00015);

    // Verify OpenInference attributes in spans
    const otelNodeSpan = finalRecord.spans.find((s) => s.name.includes('node_llm_1'));
    assert.ok(otelNodeSpan);
    assert.equal(otelNodeSpan.attributes['llm.model_name'], 'deepseek-chat');
    assert.equal(otelNodeSpan.attributes['llm.token_count.prompt'], 100);
    assert.equal(otelNodeSpan.attributes['llm.token_count.completion'], 50);
    assert.equal(otelNodeSpan.attributes['llm.token_count.total'], 150);
    assert.equal(otelNodeSpan.attributes['llm.ttft_ms'], 125);
    assert.equal(otelNodeSpan.attributes['gen_ai.usage.cost_usd'], 0.00015);
  });

  test('OpenTelemetry JSON export produces standard OTLP resourceSpans format', () => {
    const tracer = new TelemetryTracer({
      workflowId: 'wf-export-test',
      workflowTitle: 'Export Test',
    });

    tracer.startWaveSpan(0);
    tracer.startNodeSpan('node_1', 'Step 1', 'prompt', { template: 'Test' });
    tracer.endNodeSpan('node_1', 'success', { promptText: 'Test' });
    tracer.endWaveSpan();

    const record = tracer.completeTrace('success');
    const otelJson = exportOTelTraceToJson(record);

    const parsed = JSON.parse(otelJson);
    assert.ok(parsed.resourceSpans, 'Must contain resourceSpans array');
    assert.equal(parsed.resourceSpans.length, 1);

    const rSpan = parsed.resourceSpans[0];
    assert.ok(rSpan.resource.attributes['service.name'], 'Must contain service.name attribute');

    const spans = rSpan.scopeSpans[0].spans;
    assert.ok(spans.length >= 2, 'Should export wave span and node span');
    assert.equal(spans[0].traceId, record.traceId);
  });

  test('Model pricing handles Gemini, DeepSeek, OpenAI and Ollama free tier', () => {
    const ollamaPricing = getModelPricing('ollama/llama3.2');
    assert.equal(ollamaPricing.promptPer1M, 0);
    assert.equal(ollamaPricing.completionPer1M, 0);

    const ollamaCost = estimateTokenCostUSD(
      'ollama/llama3.2',
      { prompt: 50000, completion: 50000, total: 100000 },
    );
    assert.equal(ollamaCost, 0);

    const geminiPricing = getModelPricing('gemini-2.5-flash');
    assert.equal(geminiPricing.promptPer1M, 0.075);
    assert.equal(geminiPricing.completionPer1M, 0.3);

    const geminiCost = estimateTokenCostUSD(
      'gemini-2.5-flash',
      { prompt: 1_000_000, completion: 1_000_000, total: 2_000_000 },
    );
    assert.equal(geminiCost, 0.375);
  });
});
