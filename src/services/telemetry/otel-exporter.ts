/**
 * @file    src/services/telemetry/otel-exporter.ts
 * @version 1.0.0
 * @description
 *   OpenTelemetry / OpenInference JSON exporter for PatchCat.
 *   Provides serializing and 1-click browser file download of trace data
 *   directly compatible with Langfuse, Arize Phoenix, and Jaeger.
 */

import type { RunHistoryRecord, OTelExportTrace } from '../../engine/types.ts';

/**
 * Formats a RunHistoryRecord into a standardized OTel/OpenInference JSON string.
 */
export function exportOTelTraceToJson(record: RunHistoryRecord): string {
  const payload: OTelExportTrace = record.otelTrace || {
    resourceSpans: [
      {
        resource: {
          attributes: {
            'service.name': 'patchcat',
            'service.version': 'v0.4.8',
            'workflow.id': record.workflowId,
            'workflow.title': record.workflowTitle || 'Untitled Workflow',
          },
        },
        scopeSpans: [
          {
            scope: {
              name: 'patchcat.dag.tracer',
              version: '1.0.0',
            },
            spans: [],
          },
        ],
      },
    ],
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Triggers a client-side file download of the OTel Trace JSON in the browser.
 */
export function downloadOTelTraceFile(record: RunHistoryRecord): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const jsonContent = exportOTelTraceToJson(record);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const cleanTitle = (record.workflowTitle || 'trace')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();
  const timestamp = new Date(record.startedAt).toISOString().replace(/[:.]/g, '-');
  const filename = `patchcat-trace-${cleanTitle}-${record.id.slice(0, 8)}-${timestamp}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
