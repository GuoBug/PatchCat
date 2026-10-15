/**
 * @file    src/components/panels/WorkflowVersionDrawer.tsx
 * @version 1.0.0
 * @description
 *   Workflow version snapshots drawer (PRD-020 Part B).
 *   - Lists versions newest-to-oldest with relative timestamps.
 *   - Enforces 30-version hard quota with visual indicators.
 *   - Provides 1-click structural DAG diff against current canvas.
 *   - Implements atomic rollback with Ctrl+Z undo support and dirty pre-flight checks.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useWorkflowStore } from '../../stores/workflow-store.ts';
import { useProjectStore } from '../../stores/project-store.ts';
import { useTranslation } from '../../i18n/useTranslation.ts';
import {
  listWorkflowVersions,
  deleteWorkflowVersion,
  getDirtyState,
  createWorkflowVersion,
  WorkflowVersionQuotaError,
  MAX_WORKFLOW_VERSIONS,
  type WorkflowVersionRecord,
} from '../../services/versioning/workflow-version-service.ts';
import { WorkflowDiffModal } from './WorkflowDiffModal.tsx';
import { CreateVersionModal } from './CreateVersionModal.tsx';

function formatRelativeTime(timestamp: number, isZh: boolean, language: string): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return isZh ? '刚刚' : 'just now';
  if (diffMin < 60) return isZh ? `${diffMin} 分钟前` : `${diffMin}m ago`;
  if (diffHour < 24) return isZh ? `${diffHour} 小时前` : `${diffHour}h ago`;
  if (diffDay < 7) return isZh ? `${diffDay} 天前` : `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString(language);
}

export const WorkflowVersionDrawer: React.FC = () => {
  const isVersionDrawerOpen = useWorkflowStore((s) => s.isVersionDrawerOpen);
  const setVersionDrawerOpen = useWorkflowStore((s) => s.setVersionDrawerOpen);
  const restoreVersionGraph = useWorkflowStore((s) => s.restoreVersionGraph);
  const isCreateVersionModalOpen = useWorkflowStore((s) => s.isCreateVersionModalOpen);
  const setCreateVersionModalOpen = useWorkflowStore((s) => s.setCreateVersionModalOpen);

  const activeWorkflowId = useProjectStore((s) => s.activeWorkflowId) || 'default-workflow';
  const { t, language } = useTranslation();
  const isZh = language === 'zh';
  const vt = t.workflowVersions;

  const [versions, setVersions] = useState<WorkflowVersionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [diffTargetVersion, setDiffTargetVersion] = useState<WorkflowVersionRecord | null>(null);
  const [rollbackCandidate, setRollbackCandidate] = useState<{
    version: WorkflowVersionRecord;
    isDirty: boolean;
  } | null>(null);
  const [isRollbackProcessing, setIsRollbackProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const fetchVersions = useCallback(async () => {
    setIsLoading(true);
    try {
      const records = await listWorkflowVersions(activeWorkflowId);
      setVersions(records);
    } catch (err) {
      console.error('Failed to load workflow versions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkflowId]);

  useEffect(() => {
    if (isVersionDrawerOpen) {
      void fetchVersions();
    }
  }, [isVersionDrawerOpen, fetchVersions]);

  if (!isVersionDrawerOpen) return null;

  const isQuotaFull = versions.length >= MAX_WORKFLOW_VERSIONS;

  const requestRollback = async (ver: WorkflowVersionRecord) => {
    if (useWorkflowStore.getState().isExecuting) {
      showToast(vt.rollbackExecutingError);
      return;
    }
    const { nodes, edges } = useWorkflowStore.getState();
    const dirty = await getDirtyState(activeWorkflowId, nodes, edges);
    setRollbackCandidate({ version: ver, isDirty: dirty.isDirty });
  };

  const executeRollback = (ver: WorkflowVersionRecord) => {
    if (useWorkflowStore.getState().isExecuting) {
      showToast(vt.rollbackExecutingError);
      return;
    }
    const success = restoreVersionGraph(ver.graph);
    if (success) {
      // P1-4: Persist the restored graph into IndexedDB & project store so refresh preserves rollback!
      useProjectStore.getState().saveCurrentWorkflow(activeWorkflowId);
      setRollbackCandidate(null);
      setDiffTargetVersion(null);
      showToast(vt.rollbackSuccessToast.replace('{label}', ver.label));
    } else {
      showToast(vt.rollbackExecutingError);
    }
  };

  const handleSaveAndRollback = async (ver: WorkflowVersionRecord) => {
    setIsRollbackProcessing(true);
    try {
      const nextIndex = versions.length + 1;
      const autoLabel = isZh
        ? `回滚前自动备份 (v${nextIndex})`
        : `Pre-rollback snapshot (v${nextIndex})`;
      const { nodes: curNodes, edges: curEdges } = useWorkflowStore.getState();
      await createWorkflowVersion({
        workflowId: activeWorkflowId,
        label: autoLabel,
        description: isZh
          ? `在回滚至「${ver.label}」前自动创建的保护快照`
          : `Auto-saved before rolling back to "${ver.label}"`,
        nodes: curNodes,
        edges: curEdges,
      });
      await fetchVersions();
      executeRollback(ver);
    } catch (err) {
      if (err instanceof WorkflowVersionQuotaError) {
        showToast(vt.quotaFullWarning);
      } else {
        console.error('Failed to create snapshot before rollback:', err);
        showToast(String(err));
      }
    } finally {
      setIsRollbackProcessing(false);
    }
  };

  const handleDelete = async (ver: WorkflowVersionRecord) => {
    const msg = vt.deleteConfirm.replace('{label}', ver.label);
    if (window.confirm(msg)) {
      await deleteWorkflowVersion(ver.id);
      await fetchVersions();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 overflow-hidden">
        {/* Dark semi-transparent backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={() => setVersionDrawerOpen(false)}
        />

        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <aside className="w-screen max-w-xl bg-white dark:bg-[#0B0F17] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-50">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <span className="text-xl">⏱️</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {vt.drawerTitle}
                    </h2>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-mono border ${
                        isQuotaFull
                          ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 font-bold'
                          : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                      }`}
                    >
                      {vt.quotaBadge}: {versions.length}/{MAX_WORKFLOW_VERSIONS}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {vt.drawerDesc}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCreateVersionModalOpen(true)}
                  disabled={isQuotaFull}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>+</span>
                  <span className="hidden sm:inline">{vt.createBtn}</span>
                </button>

                <button
                  type="button"
                  onClick={fetchVersions}
                  title={isZh ? '刷新记录' : 'Refresh'}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
                  type="button"
                  onClick={() => setVersionDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Quota Full Warning Banner */}
            {isQuotaFull && (
              <div className="px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span>{vt.quotaFullWarning}</span>
              </div>
            )}

            {/* Toast Notification */}
            {toastMessage && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between animate-in fade-in">
                <span>{toastMessage}</span>
                <button
                  type="button"
                  onClick={() => setToastMessage(null)}
                  className="text-xs text-emerald-500 hover:underline cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Body: Versions List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {versions.length === 0 ? (
                <div className="py-20 text-center space-y-3">
                  <span className="text-4xl">📦</span>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {vt.noVersionsTitle}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    {vt.noVersionsDesc}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCreateVersionModalOpen(true)}
                    className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>+</span>
                    <span>{vt.createBtn}</span>
                  </button>
                </div>
              ) : (
                versions.map((ver, idx) => (
                  <div
                    key={ver.id}
                    className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {ver.label}
                          </h4>
                          {idx === 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              {isZh ? '最新快照' : 'Latest'}
                            </span>
                          )}
                        </div>
                        {ver.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 whitespace-pre-wrap">
                            {ver.description}
                          </p>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 whitespace-nowrap font-mono">
                        {formatRelativeTime(ver.createdAt, isZh, language)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs">
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                        <span>{ver.metadata.nodeCount} {isZh ? '节点' : 'nodes'}</span>
                        <span>·</span>
                        <span>{ver.metadata.edgeCount} {isZh ? '连线' : 'edges'}</span>
                        {ver.metadata.sanitized && (
                          <>
                            <span>·</span>
                            <span className="text-emerald-500">🛡️ {isZh ? '已脱敏' : 'Sanitized'}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDiffTargetVersion(ver)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <span>🔍</span>
                          <span>{vt.diffWithCanvas}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void requestRollback(ver)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <span>↺</span>
                          <span>{vt.rollbackBtn}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(ver)}
                          title={vt.deleteBtn}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Diff Inspector Modal */}
      <WorkflowDiffModal
        version={diffTargetVersion}
        isOpen={Boolean(diffTargetVersion)}
        onClose={() => setDiffTargetVersion(null)}
        onRollback={(ver) => {
          setDiffTargetVersion(null);
          void requestRollback(ver);
        }}
      />

      {/* Create Version Modal */}
      <CreateVersionModal
        isOpen={isCreateVersionModalOpen}
        onClose={() => setCreateVersionModalOpen(false)}
        onSuccess={async () => {
          await fetchVersions();
          showToast(vt.saveSuccessToast.replace('{label}', 'Snapshot'));
        }}
      />

      {/* Rollback Confirmation Modal (PRD §3.4 3-way Dirty Guard) */}
      {rollbackCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => !isRollbackProcessing && setRollbackCandidate(null)}
          />
          <div className="relative w-full max-w-lg bg-white dark:bg-[#0E131F] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl z-10 space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{rollbackCandidate.isDirty ? '⚠️' : '↺'}</span>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {rollbackCandidate.isDirty ? vt.rollbackDirtyTitle : vt.rollbackConfirmTitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {rollbackCandidate.isDirty ? vt.rollbackDirtyDesc : vt.rollbackConfirmDesc}
                </p>
                <div className="mt-2.5 p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
                  <span className="font-semibold">{rollbackCandidate.version.label}</span>
                  <span className="text-[11px] text-slate-400">
                    {rollbackCandidate.version.metadata.nodeCount} {isZh ? '节点' : 'nodes'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isRollbackProcessing}
                onClick={() => setRollbackCandidate(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              >
                {t.common.cancel}
              </button>

              {rollbackCandidate.isDirty ? (
                <>
                  <button
                    type="button"
                    disabled={isRollbackProcessing}
                    onClick={() => executeRollback(rollbackCandidate.version)}
                    className="px-3.5 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {vt.rollbackDiscardAndProceed}
                  </button>
                  <button
                    type="button"
                    disabled={isRollbackProcessing}
                    onClick={() => void handleSaveAndRollback(rollbackCandidate.version)}
                    className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <span>💾</span>
                    <span>
                      {isRollbackProcessing
                        ? isZh
                          ? '保存中...'
                          : 'Saving...'
                        : vt.rollbackSaveAndProceed}
                    </span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={isRollbackProcessing}
                  onClick={() => executeRollback(rollbackCandidate.version)}
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>↺</span>
                  <span>{vt.rollbackConfirmAction}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
