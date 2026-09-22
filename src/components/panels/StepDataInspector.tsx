/**
 * @file    src/components/panels/StepDataInspector.tsx
 * @version 1.0.0
 * @description
 *   Freeze-frame step data inspector modal for deep-diving into individual node
 *   snapshots: inputs, outputs, TTFT, token usage, and OpenInference telemetry.
 */

import React, { useState } from 'react';
import { useWorkflowStore } from '../../stores/workflow-store.ts';
import { useTranslation } from '../../i18n/useTranslation.ts';

export const StepDataInspector: React.FC = () => {
  const selectedSnapshot = useWorkflowStore((s) => s.selectedSnapshot);
  const setSelectedSnapshot = useWorkflowStore((s) => s.setSelectedSnapshot);
  const { language } = useTranslation();
  const isZh = language === 'zh';

  const [activeTab, setActiveTab] = useState<'inputs' | 'outputs' | 'telemetry'>('outputs');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!selectedSnapshot) return null;

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const inputsJson = JSON.stringify(selectedSnapshot.inputs || {}, null, 2);
  const outputsJson = JSON.stringify(selectedSnapshot.outputs || {}, null, 2);

  const spanAttrs = selectedSnapshot.spanAttributes || {};

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={() => setSelectedSnapshot(null)}
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <span className="text-xl">
              {selectedSnapshot.nodeType === 'llm'
                ? '⚡'
                : selectedSnapshot.nodeType === 'agent'
                ? '🤖'
                : selectedSnapshot.nodeType === 'code'
                ? '⚙️'
                : selectedSnapshot.nodeType === 'condition'
                ? '🔀'
                : selectedSnapshot.nodeType === 'http'
                ? '🌐'
                : selectedSnapshot.nodeType === 'knowledge'
                ? '📚'
                : '📦'}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  {selectedSnapshot.nodeName}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {selectedSnapshot.nodeType}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    selectedSnapshot.status === 'success'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {selectedSnapshot.status === 'success'
                    ? isZh
                      ? '成功'
                      : 'Success'
                    : isZh
                    ? '失败'
                    : 'Failed'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                Node ID: {selectedSnapshot.nodeId} · {selectedSnapshot.durationMs}ms
              </p>
            </div>
          </div>

          <button
            onClick={() => setSelectedSnapshot(null)}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-900/20">
          <button
            onClick={() => setActiveTab('outputs')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'outputs'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span>📤</span>
            <span>{isZh ? '产出数据 (Outputs)' : 'Outputs'}</span>
          </button>
          <button
            onClick={() => setActiveTab('inputs')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'inputs'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span>📥</span>
            <span>{isZh ? '输入入参 (Inputs)' : 'Inputs'}</span>
          </button>
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'telemetry'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <span>📈</span>
            <span>{isZh ? '遥测与成本 (Telemetry)' : 'Telemetry & Cost'}</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'outputs' && (
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {isZh ? '该节点产出的完整数据包：' : 'Full Output Payload:'}
                </span>
                <button
                  onClick={() => handleCopy(outputsJson, 'outputs')}
                  className="px-2.5 py-1 text-xs rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                >
                  <span>{copiedKey === 'outputs' ? '✓' : '📋'}</span>
                  <span>{copiedKey === 'outputs' ? (isZh ? '已复制' : 'Copied') : isZh ? '复制' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 max-h-[50vh]">
                {outputsJson}
              </pre>
            </div>
          )}

          {activeTab === 'inputs' && (
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {isZh ? '传入该节点的解析后参数：' : 'Resolved Input Parameters:'}
                </span>
                <button
                  onClick={() => handleCopy(inputsJson, 'inputs')}
                  className="px-2.5 py-1 text-xs rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                >
                  <span>{copiedKey === 'inputs' ? '✓' : '📋'}</span>
                  <span>{copiedKey === 'inputs' ? (isZh ? '已复制' : 'Copied') : isZh ? '复制' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 max-h-[50vh]">
                {inputsJson}
              </pre>
            </div>
          )}

          {activeTab === 'telemetry' && (
            <div className="space-y-4">
              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400">TTFT 首字延迟</div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-1 font-mono">
                    {selectedSnapshot.ttftMs !== undefined ? `${selectedSnapshot.ttftMs}ms` : '—'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400">执行耗时</div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-1 font-mono">
                    {selectedSnapshot.durationMs}ms
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Token 消耗</div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-1 font-mono">
                    {selectedSnapshot.tokens?.total ?? 0}
                    <span className="text-[10px] text-slate-400 ml-1 font-normal">
                      ({selectedSnapshot.tokens?.prompt ?? 0} / {selectedSnapshot.tokens?.completion ?? 0})
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400">预估成本 (USD)</div>
                  <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                    {selectedSnapshot.costUSD !== undefined ? `$${selectedSnapshot.costUSD.toFixed(5)}` : '$0.00'}
                  </div>
                </div>
              </div>

              {/* Model info */}
              {selectedSnapshot.model && (
                <div className="px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs flex items-center justify-between text-indigo-700 dark:text-indigo-300">
                  <span className="font-medium">Model / Provider:</span>
                  <span className="font-mono">{selectedSnapshot.model}</span>
                </div>
              )}

              {/* OpenInference / OTel Attributes Table */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isZh ? 'OpenTelemetry / OpenInference 语义规约属性' : 'OpenTelemetry & OpenInference Attributes'}
                </div>
                <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-medium">
                      <tr>
                        <th className="px-3 py-2">Attribute Key</th>
                        <th className="px-3 py-2">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono text-slate-700 dark:text-slate-300">
                      <tr>
                        <td className="px-3 py-1.5 text-indigo-600 dark:text-indigo-400">span_id</td>
                        <td className="px-3 py-1.5 text-slate-500">{selectedSnapshot.spanId}</td>
                      </tr>
                      {selectedSnapshot.parentSpanId && (
                        <tr>
                          <td className="px-3 py-1.5 text-indigo-600 dark:text-indigo-400">parent_span_id</td>
                          <td className="px-3 py-1.5 text-slate-500">{selectedSnapshot.parentSpanId}</td>
                        </tr>
                      )}
                      {Object.entries(spanAttrs).map(([k, v]) => (
                        <tr key={k}>
                          <td className="px-3 py-1.5 text-indigo-600 dark:text-indigo-400">{k}</td>
                          <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400 truncate max-w-xs">
                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={() => setSelectedSnapshot(null)}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            {isZh ? '关闭' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
