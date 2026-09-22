/**
 * @file    tests/otel-exporter.node.test.ts
 * @description
 *   Unit test suite for PatchCat v0.4.8 TelemetryTracer, OpenInference semantic mapping,
 *   and OpenTelemetry JSON export formatting.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TelemetryTracer,
  generateTraceId,
  generateSpanId,
  mapNodeToOpenInferenceKind,
} from '../src/services/telemetry/otel-tracer.ts';
import { exportOTelTraceToJson } from '../src/services/telemetry/otel-exporter.ts';

describe('v0.4.8 TelemetryTracer & OTel Export Suite', () => {
  it('should generate valid W3C trace-id and span-id formats', () => {
    const traceId = generateTraceId();
    assert.equal(traceId.length, 32);
    assert.match(traceId, /^[0-9a-f]{32}$/);

    const spanId = generateSpanId();
    assert.equal(spanId.length, 16);
    assert.match(spanId, /^[0-9a-f]{16}$/);
  });

  it('should accurately map PatchCat node types to OpenInference kinds', () => {
    assert.equal(mapNodeToOpenInferenceKind('llm'), 'LLM');
    assert.equal(mapNodeToOpenInferenceKind('agent'), 'AGENT');
    assert.equal(mapNodeToOpenInferenceKind('knowledge'), 'RETRIEVER');
    assert.equal(mapNodeToOpenInferenceKind('prompt'), 'CHAIN');
    assert.equal(mapNodeToOpenInferenceKind('code'), 'CHAIN');
    assert.equal(mapNodeToOpenInferenceKind('http'), 'CHAIN');
  });

  it('should record complete lifecycle trace with waves, nodes, and TTFT metrics', () => {
    const tracer = new TelemetryTracer();
    const traceId = tracer.startTrace('wf_test_1', 'Test Customer Workflow', 'manual');
    assert.equal(traceId.length, 32);

    // Wave 0
    tracer.startWaveSpan(0);
    tracer.startNodeSpan('node_input', 'Input Query', 'input', 0, { query: 'hello' });
    tracer.endNodeSpan('node_input', 'completed', { query: 'hello' }, undefined, 0);
    tracer.endWaveSpan();

    // Wave 1 with LLM
    tracer.startWaveSpan(1);
    tracer.startNodeSpan(
      'node_llm',
      'Classifier LLM',
      'llm',
      1,
      { prompt: 'Classify hello' },
      'gemini-2.5-flash'
    );
    tracer.recordNodeTTFT('node_llm', 240);
    const snap = tracer.endNodeSpan(
      'node_llm',
      'completed',
      { intent: 'greeting' },
      { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
      0.000015
    );

    assert.equal(snap.nodeId, 'node_llm');
    assert.equal(snap.ttftMs, 240);
    assert.equal(snap.estimatedCostUSD, 0.000015);
    tracer.endWaveSpan();

    // Complete trace
    const record = tracer.completeTrace('completed');
    assert.equal(record.id, traceId);
    assert.equal(record.workflowId, 'wf_test_1');
    assert.equal(record.status, 'completed');
    assert.equal(record.totalTokens.totalTokens, 120);
    assert.equal(record.estimatedCostUSD, 0.000015);
    assert.ok(record.otelTrace);

    // Test JSON export
    const jsonStr = exportOTelTraceToJson(record);
    const parsed = JSON.parse(jsonStr);
    assert.ok(parsed.resourceSpans);
    assert.equal(parsed.resourceSpans[0].resource.attributes['service.name'], 'patchcat');
    const spans = parsed.resourceSpans[0].scopeSpans[0].spans;
    assert.ok(spans.length >= 3); // root + 2 waves + 2 nodes
  });
});
