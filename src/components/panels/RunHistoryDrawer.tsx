/**
 * @file    src/components/panels/RunHistoryDrawer.tsx
 * @version 1.0.0
 * @description
 *   Run Observability & Trace Drawer displaying recent 10-run FIFO records,
 *   aggregate KPI metrics, execution waterfall timeline, and OTel JSON export.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useWorkflowStore } from '../../stores/workflow-store.ts';
import { useProjectStore } from '../../stores/project-store.ts';
import { useTranslation } from '../../i18n/useTranslation.ts';
import { indexedDb } from '../../services/storage/indexeddb-adapter.ts';
import { downloadOTelTraceFile, exportOTelTraceToJson } from '../../services/telemetry/otel-exporter.ts';
import type { RunHistoryRecord, NodeRunSnapshot } from '../../engine/types.ts';

export const RunHistoryDrawer: React.FC = () => {
  const isRunHistoryOpen = useWorkflowStore((s) => s.isRunHistoryOpen);
  const setRunHistoryOpen = useWorkflowStore((s) => s.setRunHistoryOpen);
  const selectedRunRecord = useWorkflowStore((s) => s.selectedRunRecord);
  const setSelectedRunRecord = useWorkflowStore((s) => s.setSelectedRunRecord);
  const setSelectedSnapshot = useWorkflowStore((s) => s.setSelectedSnapshot);
  const lastRunRecord = useWorkflowStore((s) => s.lastRunRecord);
  const restoreRunToCanvas = useWorkflowStore((s) => s.restoreRunToCanvas);

  const activeWorkflowId = useProjectStore((s) => s.activeWorkflowId) || 'default-workflow';
  const { language } = useTranslation();
  const isZh = language === 'zh';

  const [runs, setRuns] = useState<RunHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedTrace, setCopiedTrace] = useState(false);
  const [restoredSuccess, setRestoredSuccess] = useState(false);

  // Load recent runs whenever drawer opens or lastRunRecord updates
  const fetchRecentRuns = async () => {
    setIsLoading(true);
    try {
      const records = await indexedDb.getRecentRuns(activeWorkflowId, 10);
      setRuns(records);
      if (records.length > 0 && !selectedRunRecord) {
        setSelectedRunRecord(records[0] || null);
      } else if (records.length > 0 && selectedRunRecord) {
        const stillExists = records.find((r) => r.runId === selectedRunRecord.runId);
        if (stillExists) {
          setSelectedRunRecord(stillExists);
        } else {
          setSelectedRunRecord(records[0] || null);
        }
      } else if (records.length === 0) {
        setSelectedRunRecord(null);
      }
    } catch (err) {
      console.error('Failed to load recent runs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isRunHistoryOpen) {
      fetchRecentRuns();
    }
  }, [isRunHistoryOpen, activeWorkflowId, lastRunRecord]);

  // Aggregate stats across recent runs
  const stats = useMemo(() => {
    if (runs.length === 0) {
      return { total: 0, successCount: 0, avgDurationMs: 0, totalTokens: 0, totalCostUSD: 0 };
    }
    const total = runs.length;
    const successCount = runs.filter((r) => r.status === 'success').length;
    const sumDuration = runs.reduce((acc, r) => acc + r.totalDurationMs, 0);
    const totalTokens = runs.reduce((acc, r) => acc + r.totalTokens.total, 0);
    const totalCostUSD = runs.reduce((acc, r) => acc + r.totalCostUSD, 0);

    return {
      total,
      successCount,
      avgDurationMs: Math.round(sumDuration / total),
      totalTokens,
      totalCostUSD,
    };
  }, [runs]);

  const handleClearHistory = async () => {
    const confirmMsg = isZh
      ? '确定清空当前工作流的全部运行历史记录？'
      : 'Clear all run history records for this workflow?';
    if (window.confirm(confirmMsg)) {
      await indexedDb.clearRunsForWorkflow(activeWorkflowId);
      setRuns([]);
      setSelectedRunRecord(null);
    }
  };

  const handleExportOTel = () => {
    if (!selectedRunRecord) return;
    downloadOTelTraceFile(selectedRunRecord);
  };

  const handleCopyOTelJson = () => {
    if (!selectedRunRecord) return;
    const jsonStr = exportOTelTraceToJson(selectedRunRecord);
    navigator.clipboard.writeText(jsonStr);
    setCopiedTrace(true);
    setTimeout(() => setCopiedTrace(false), 2000);
  };

  const handleRestoreToCanvas = () => {
    if (!selectedRunRecord) return;
    restoreRunToCanvas(selectedRunRecord);
    setRestoredSuccess(true);
    setTimeout(() => setRestoredSuccess(false), 2000);
  };

  if (!isRunHistoryOpen) return null;

  return (
    <div className="fixed inset-0 z-40 overflow-hidden">
      {/* Dark semi-transparent backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity"
        onClick={() => setRunHistoryOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <aside className="w-screen max-w-2xl bg-white dark:bg-[#0B0F17] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="text-xl">📊</span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {isZh ? '运行可观测性与追踪 (Trace)' : 'Run Observability & Traces'}
                  </h2>
                  <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    Ring Buffer: {runs.length}/10
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isZh
                    ? '最近 10 次运行指标、Token 成本审计与 OpenTelemetry 标准追踪'
                    : 'Recent 10 runs metrics, token cost audit & OpenTelemetry standard tracing'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchRecentRuns}
                title={isZh ? '刷新记录' : 'Refresh'}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <svg
                  className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>

              <button
                onClick={() => setRunHistoryOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Top Aggregate KPI Cards */}
          <div className="px-6 py-3.5 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800 grid grid-cols-4 gap-3">
            <div className="p-2.5 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{isZh ? '记录轮次' : 'Runs'}</div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                {stats.total}{' '}
                <span className="text-[10px] font-normal text-emerald-500">
                  ({stats.total > 0 ? Math.round((stats.successCount / stats.total) * 100) : 100}% OK)
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{isZh ? '平均耗时' : 'Avg Latency'}</div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5 font-mono">
                {stats.avgDurationMs}ms
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{isZh ? '累计消耗' : 'Total Tokens'}</div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5 font-mono">
                {stats.totalTokens}
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{isZh ? '预估总成本' : 'Total Cost'}</div>
              <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                ${stats.totalCostUSD.toFixed(5)}
              </div>
            </div>
          </div>

          {/* Main Body */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {runs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl mb-3">
                  🕒
                </div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {isZh ? '暂无运行历史记录' : 'No execution history yet'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                  {isZh
                    ? '点击顶部工具栏的「运行」或「单步调试」，系统将自动捕获运行快照、TTFT 及 OpenTelemetry 追踪数据。'
                    : 'Click Run in the top bar to execute workflow. Snapshots, TTFT, and OpenTelemetry traces will appear here.'}
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Horizontal Run Selector Chips */}
                <div className="px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto bg-slate-50/30 dark:bg-slate-900/10 scrollbar-none">
                  {runs.map((r, index) => {
                    const isSelected = selectedRunRecord?.runId === r.runId;
                    const dateObj = new Date(r.startedAt);
                    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    return (
                      <button
                        key={r.runId}
                        onClick={() => setSelectedRunRecord(r)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-2 ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-sm'
                            : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            r.status === 'success'
                              ? 'bg-emerald-500'
                              : r.status === 'cancelled'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                        />
                        <span>#{runs.length - index}</span>
                        <span className="text-[11px] text-slate-400">{timeStr}</span>
                        <span className="text-[11px] text-slate-400 font-sans">{r.totalDurationMs}ms</span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Run Deep-Dive View */}
                {selectedRunRecord && (
                  <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Run Header & Metadata */}
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                              selectedRunRecord.status === 'success'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : selectedRunRecord.status === 'cancelled'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {selectedRunRecord.status}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            Run ID: {selectedRunRecord.runId.slice(0, 12)}...
                          </span>
                        </div>

                        {/* OTel Export & Checkpoint Restore Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleRestoreToCanvas}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-600/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors flex items-center gap-1.5"
                            title={isZh ? '将该次运行的所有节点快照与输出还原到画布' : 'Restore node snapshot states and outputs to canvas'}
                          >
                            <span>{restoredSuccess ? '✓' : '⤺'}</span>
                            <span>{restoredSuccess ? (isZh ? '已还原' : 'Restored') : (isZh ? '恢复至画布' : '恢复快照至画布')}</span>
                          </button>

                          <button
                            onClick={handleCopyOTelJson}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                          >
                            <span>{copiedTrace ? '✓' : '📋'}</span>
                            <span>{copiedTrace ? (isZh ? '已复制' : 'Copied') : isZh ? '复制 Trace' : 'Copy Trace'}</span>
                          </button>

                          <button
                            onClick={handleExportOTel}
                            className="px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-colors flex items-center gap-1.5"
                          >
                            <span>📥</span>
                            <span>{isZh ? '导出 OTel JSON' : 'Export OTel JSON'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Detail Metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/80 text-xs">
                        <div>
                          <span className="text-slate-400">{isZh ? '触发时间' : 'Started'}:</span>{' '}
                          <span className="font-mono text-slate-700 dark:text-slate-300">
                            {new Date(selectedRunRecord.startedAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">{isZh ? '总耗时' : 'Duration'}:</span>{' '}
                          <span className="font-mono text-slate-700 dark:text-slate-300">
                            {selectedRunRecord.totalDurationMs}ms
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">{isZh ? 'Token 消耗' : 'Tokens'}:</span>{' '}
                          <span className="font-mono text-slate-700 dark:text-slate-300">
                            {selectedRunRecord.totalTokens.total}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">{isZh ? '预估成本' : 'Cost'}:</span>{' '}
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            ${selectedRunRecord.totalCostUSD.toFixed(5)}
                          </span>
                        </div>
                      </div>

                      {/* Trace ID */}
                      <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-2.5 py-1 rounded">
                        <span className="text-slate-500">Trace ID:</span>
                        <span className="text-slate-700 dark:text-slate-300 select-all">{selectedRunRecord.traceId}</span>
                      </div>

                      {/* Error Banner if run failed */}
                      {selectedRunRecord.error && (
                        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                          <span className="font-semibold">{isZh ? '中断异常' : 'Error'}: </span>
                          {selectedRunRecord.error}
                        </div>
                      )}
                    </div>

                    {/* Execution Waterfall Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <span>⏱️</span>
                          <span>{isZh ? '执行波次瀑布流 (Execution Waterfall)' : 'Execution Waterfall Spans'}</span>
                        </h4>
                        <span className="text-xs text-slate-400">
                          {selectedRunRecord.stepSnapshots.length} {isZh ? '个执行步骤' : 'steps recorded'}
                        </span>
                      </div>

                      {/* Waterfall Bars Container */}
                      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#111827]">
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {selectedRunRecord.stepSnapshots.map((snap: NodeRunSnapshot, idx: number) => {
                            const totalMs = Math.max(selectedRunRecord.totalDurationMs, 1);
                            const startOffsetMs = Math.max(0, snap.startedAt - selectedRunRecord.startedAt);
                            const leftPct = Math.min(95, Math.max(0, (startOffsetMs / totalMs) * 100));
                            const widthPct = Math.min(
                              100 - leftPct,
                              Math.max(4, (snap.durationMs / totalMs) * 100)
                            );

                            return (
                              <div
                                key={snap.nodeId + '_' + idx}
                                className="p-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors flex flex-col gap-2"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">
                                      {snap.nodeType === 'llm'
                                        ? '⚡'
                                        : snap.nodeType === 'agent'
                                        ? '🤖'
                                        : snap.nodeType === 'code'
                                        ? '⚙️'
                                        : snap.nodeType === 'condition'
                                        ? '🔀'
                                        : snap.nodeType === 'http'
                                        ? '🌐'
                                        : snap.nodeType === 'knowledge'
                                        ? '📚'
                                        : '📦'}
                                    </span>
                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                      {snap.nodeName}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-100 dark:bg-slate-800 text-slate-500">
                                      {snap.nodeType}
                                    </span>
                                    {snap.ttftMs !== undefined && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                        TTFT {snap.ttftMs}ms
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <div className="text-right font-mono text-xs">
                                      <span className="text-slate-800 dark:text-slate-200 font-medium">
                                        {snap.durationMs}ms
                                      </span>
                                      {snap.tokens && (
                                        <span className="text-[11px] text-slate-400 ml-2">
                                          {snap.tokens.total} tok
                                        </span>
                                      )}
                                      {snap.costUSD !== undefined && snap.costUSD > 0 && (
                                        <span className="text-[11px] text-emerald-500 ml-1.5">
                                          ${snap.costUSD.toFixed(5)}
                                        </span>
                                      )}
                                    </div>

                                    <button
                                      onClick={() => setSelectedSnapshot(snap)}
                                      className="px-2.5 py-1 text-xs font-medium rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                                    >
                                      {isZh ? '查看快照' : 'Inspect'}
                                    </button>
                                  </div>
                                </div>

                                {/* Proportional Timeline Bar */}
                                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800/80 rounded-full relative overflow-hidden">
                                  <div
                                    className={`absolute top-0 bottom-0 rounded-full ${
                                      snap.status === 'success'
                                        ? 'bg-gradient-to-r from-indigo-500 to-emerald-500'
                                        : 'bg-rose-500'
                                    }`}
                                    style={{
                                      left: `${leftPct}%`,
                                      width: `${widthPct}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-between">
            <button
              onClick={handleClearHistory}
              disabled={runs.length === 0}
              className="text-xs text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-40 disabled:hover:no-underline"
            >
              {isZh ? '清空历史记录' : 'Clear Run History'}
            </button>

            <button
              onClick={() => setRunHistoryOpen(false)}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
            >
              {isZh ? '收起面板' : 'Close Drawer'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
