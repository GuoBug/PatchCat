/**
 * @file    src/components/panels/WorkflowDiffModal.tsx
 * @version 1.0.0
 * @description
 *   Modal dialog displaying structural DAG diff between a selected version snapshot
 *   and the current canvas (PRD-020 Part B).
 *   - Layout position shifts are collapsed by default to prevent visual noise.
 *   - Highlights node additions, deletions, and property-level modifications.
 *   - Provides line-level diff view for prompt templates and code scripts.
 *   - Enables direct safe rollback from the diff inspector.
 */

import React, { useState, useMemo } from 'react';
import { useWorkflowStore } from '../../stores/workflow-store.ts';
import { useTranslation } from '../../i18n/useTranslation.ts';
import {
  diffTextLines,
  type WorkflowDiffResult,
} from '../../services/diff/workflow-diff.ts';
import {
  diffVersionAgainstLive,
  type WorkflowVersionRecord,
} from '../../services/versioning/workflow-version-service.ts';

const SENSITIVE_PATH_RE = /(api[-_]?key|token|secret|password|auth)/i;
function formatDiffValue(path: string, val: unknown): string {
  if (SENSITIVE_PATH_RE.test(path) && typeof val === 'string' && val.length > 0) {
    return '"[REDACTED]"';
  }
  return JSON.stringify(val);
}

interface WorkflowDiffModalProps {
  version: WorkflowVersionRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onRollback?: (version: WorkflowVersionRecord) => void;
}

export const WorkflowDiffModal: React.FC<WorkflowDiffModalProps> = ({
  version,
  isOpen,
  onClose,
  onRollback,
}) => {
  const { t, language } = useTranslation();
  const isZh = language === 'zh';
  const vt = t.workflowVersions;

  const currentNodes = useWorkflowStore((s) => s.nodes);
  const currentEdges = useWorkflowStore((s) => s.edges);
  const currentGlobalInputs = useWorkflowStore((s) => s.globalInputs);

  // User confirmed decision: Layout-only shifts collapsed by default!
  const [showLayoutOnly, setShowLayoutOnly] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [expandedLineDiffs, setExpandedLineDiffs] = useState<Record<string, boolean>>({});

  const diffResult: WorkflowDiffResult | null = useMemo(() => {
    if (!version) return null;
    return diffVersionAgainstLive(version.graph, {
      nodes: currentNodes,
      edges: currentEdges,
      globalInputs: currentGlobalInputs,
    });
  }, [version, currentNodes, currentEdges, currentGlobalInputs]);

  if (!isOpen || !version || !diffResult) return null;

  const toggleNodeExpand = (nodeId: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const toggleLineDiff = (key: string) => {
    setExpandedLineDiffs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const { stats, nodes, edges, hasChanges, hasLogicalChanges } = diffResult;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-4xl max-h-[88vh] bg-white dark:bg-[#0E131F] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🔍</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {vt.diffModalTitle}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  {version.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {vt.diffModalDesc}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRollback && (
              <button
                type="button"
                onClick={() => onRollback(version)}
                className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>↺</span>
                <span>{vt.rollbackBtn}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Top KPI Metrics Bar */}
        <div className="px-6 py-3 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
          <div className="p-2 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">{vt.diffStatsAddedNodes}</div>
            <div className="text-sm font-bold font-mono text-emerald-500 mt-0.5">
              +{stats.addedNodeCount}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">{vt.diffStatsDeletedNodes}</div>
            <div className="text-sm font-bold font-mono text-rose-500 mt-0.5">
              -{stats.deletedNodeCount}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">{vt.diffStatsModifiedNodes}</div>
            <div className="text-sm font-bold font-mono text-amber-500 mt-0.5">
              ~{stats.modifiedNodeCount}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">{vt.diffStatsAddedEdges}</div>
            <div className="text-sm font-bold font-mono text-emerald-500 mt-0.5">
              +{stats.addedEdgeCount}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">{vt.diffStatsDeletedEdges}</div>
            <div className="text-sm font-bold font-mono text-rose-500 mt-0.5">
              -{stats.deletedEdgeCount}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">{vt.diffStatsLayoutOnly}</div>
            <div className="text-sm font-bold font-mono text-slate-400 mt-0.5">
              {stats.layoutNodeCount}
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* No Changes State */}
          {!hasChanges && (
            <div className="py-12 text-center space-y-2">
              <span className="text-3xl">✨</span>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {vt.noDiffTitle}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {vt.noDiffDesc}
              </p>
            </div>
          )}

          {/* Section: Added Nodes */}
          {nodes.added.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <span>🟢</span>
                <span>{vt.diffStatsAddedNodes} (+{nodes.added.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {nodes.added.map((node) => (
                  <div
                    key={node.id}
                    className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {String(node.data?.label || node.id)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        id: {node.id} · type: {node.type}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                      + Added
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Deleted Nodes */}
          {nodes.deleted.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <span>🔴</span>
                <span>{vt.diffStatsDeletedNodes} (-{nodes.deleted.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {nodes.deleted.map((node) => (
                  <div
                    key={node.id}
                    className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 line-through">
                        {String(node.data?.label || node.id)}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        id: {node.id} · type: {node.type}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium">
                      - Deleted
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Modified Nodes */}
          {nodes.modified.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <span>🟡</span>
                <span>{vt.diffStatsModifiedNodes} (~{nodes.modified.length})</span>
              </div>
              <div className="space-y-2">
                {nodes.modified.map((item) => {
                  const isExpanded = expandedNodes[item.nodeId] ?? true;
                  return (
                    <div
                      key={item.nodeId}
                      className="rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => toggleNodeExpand(item.nodeId)}
                        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-amber-500/10 transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {item.label}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            ({item.nodeId} · {item.nodeType})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                            {item.changes.length} {isZh ? '项修改' : 'changes'}
                          </span>
                          <span className="text-slate-400 text-xs">{isExpanded ? '▼' : '▶'}</span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-3 pt-1 border-t border-amber-500/10 space-y-2">
                          {item.changes.map((change, idx) => {
                            const isLongText =
                              typeof change.oldValue === 'string' &&
                              typeof change.newValue === 'string' &&
                              (change.oldValue.length > 60 ||
                                change.newValue.length > 60 ||
                                change.oldValue.includes('\n') ||
                                change.newValue.includes('\n'));

                            const lineDiffKey = `${item.nodeId}_${change.path}`;
                            const isLineDiffOpen = expandedLineDiffs[lineDiffKey] ?? false;

                            return (
                              <div
                                key={idx}
                                className="p-2 rounded-lg bg-white/70 dark:bg-[#141A28] border border-slate-200/60 dark:border-slate-800/80 space-y-1.5"
                              >
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-mono font-medium text-indigo-600 dark:text-indigo-400">
                                    {change.path}
                                  </span>
                                  {isLongText && (
                                    <button
                                      type="button"
                                      onClick={() => toggleLineDiff(lineDiffKey)}
                                      className="text-[10px] text-indigo-500 hover:underline cursor-pointer"
                                    >
                                      {isLineDiffOpen
                                        ? isZh ? '收起行级比对' : 'Collapse line diff'
                                        : isZh ? '展开行级比对' : 'Expand line diff'}
                                    </button>
                                  )}
                                </div>

                                {isLongText && isLineDiffOpen ? (
                                  <div className="max-h-48 overflow-y-auto font-mono text-[10px] rounded border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100 p-2 space-y-0.5">
                                    {diffTextLines(
                                      String(change.oldValue),
                                      String(change.newValue),
                                    ).map((line, lIdx) => (
                                      <div
                                        key={lIdx}
                                        className={`px-1 py-0.5 rounded-xs flex gap-2 ${
                                          line.type === 'added'
                                            ? 'bg-emerald-900/40 text-emerald-300'
                                            : line.type === 'removed'
                                              ? 'bg-rose-900/40 text-rose-300 line-through'
                                              : 'text-slate-400'
                                        }`}
                                      >
                                        <span className="w-3 select-none opacity-50">
                                          {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                                        </span>
                                        <span className="whitespace-pre-wrap">{line.text || ' '}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                                    <div className="p-1.5 rounded bg-rose-500/5 text-rose-700 dark:text-rose-300 border border-rose-500/10 overflow-hidden text-ellipsis whitespace-nowrap">
                                      <span className="text-[9px] text-rose-400 block font-sans">
                                        {vt.diffOldValue}:
                                      </span>
                                      {formatDiffValue(change.path, change.oldValue)}
                                    </div>
                                    <div className="p-1.5 rounded bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 border border-emerald-500/10 overflow-hidden text-ellipsis whitespace-nowrap">
                                      <span className="text-[9px] text-emerald-400 block font-sans">
                                        {vt.diffNewValue}:
                                      </span>
                                      {formatDiffValue(change.path, change.newValue)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Edges Diff */}
          {(edges.added.length > 0 || edges.deleted.length > 0) && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <span>🔗</span>
                <span>
                  {isZh ? '连线关系变动' : 'Connection Changes'} (+{edges.added.length}, -{edges.deleted.length})
                </span>
              </div>
              <div className="space-y-1.5 font-mono text-[11px]">
                {edges.added.map((e) => (
                  <div
                    key={e.key}
                    className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-between"
                  >
                    <span>+ {e.key}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 font-sans">
                      Added
                    </span>
                  </div>
                ))}
                {edges.deleted.map((e) => (
                  <div
                    key={e.key}
                    className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-between line-through"
                  >
                    <span>- {e.key}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/10 font-sans">
                      Deleted
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section: Layout-only Moves (COLLAPSED BY DEFAULT PER DECISION #2) */}
          {nodes.layoutOnly.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span>📐</span>
                  <span>
                    {vt.diffStatsLayoutOnly} ({nodes.layoutOnly.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLayoutOnly(!showLayoutOnly)}
                  className="text-xs text-indigo-500 hover:text-indigo-600 font-medium cursor-pointer"
                >
                  {showLayoutOnly
                    ? isZh ? '折叠排版位移' : 'Hide Layout Shifts'
                    : isZh ? '展开排版位移' : 'Show Layout Shifts'}
                </button>
              </div>

              {!showLayoutOnly ? (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 text-slate-400 text-xs">
                  {vt.layoutOnlyCollapsedHint.replace('{count}', String(nodes.layoutOnly.length))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {nodes.layoutOnly.map((node) => (
                    <div
                      key={node.nodeId}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium text-slate-700 dark:text-slate-300">
                          {node.label}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          id: {node.nodeId}
                        </div>
                      </div>
                      {node.positionDelta && (
                        <div className="text-[10px] font-mono text-slate-400 text-right">
                          Δx: {node.positionDelta.dx > 0 ? `+${node.positionDelta.dx}` : node.positionDelta.dx}px
                          <br />
                          Δy: {node.positionDelta.dy > 0 ? `+${node.positionDelta.dy}` : node.positionDelta.dy}px
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="text-xs text-slate-400 font-mono">
            {hasLogicalChanges
              ? isZh ? '⚠️ 存在真实业务拓扑差异' : '⚠️ Logical topology changes detected'
              : hasChanges
                ? isZh ? 'ℹ️ 仅存在画布坐标位移' : 'ℹ️ Only layout shifts detected'
                : isZh ? '✅ 与快照版本完全一致' : '✅ Identical to snapshot'}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors cursor-pointer"
          >
            {t.common.close}
          </button>
        </div>
      </div>
    </div>
  );
};
