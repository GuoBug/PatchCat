/**
 * @file    src/components/panels/CreateVersionModal.tsx
 * @version 1.0.0
 * @description
 *   Modal dialog for creating a user-named workflow version snapshot.
 *   Conforms to PRD-020 Part B:
 *   - Auto-sanitizes API keys and clears execution outputs.
 *   - Computes canonical graph hash to prevent duplicate identical saves.
 *   - Enforces 30-version hard quota with clear visual warning when full.
 */

import React, { useState, useEffect } from 'react';
import { useWorkflowStore } from '../../stores/workflow-store.ts';
import { useProjectStore } from '../../stores/project-store.ts';
import { useTranslation } from '../../i18n/useTranslation.ts';
import {
  createWorkflowVersion,
  listWorkflowVersions,
  prepareVersionGraph,
  MAX_WORKFLOW_VERSIONS,
  MAX_VERSION_LABEL_LENGTH,
  DuplicateWorkflowVersionError,
  WorkflowVersionQuotaError,
} from '../../services/versioning/workflow-version-service.ts';
import { diffWorkflowGraphs } from '../../services/diff/workflow-diff.ts';

interface CreateVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (versionId: string) => void;
}

export const CreateVersionModal: React.FC<CreateVersionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t, language } = useTranslation();
  const isZh = language === 'zh';
  const vt = t.workflowVersions;

  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const activeWorkflowId = useProjectStore((s) => s.activeWorkflowId) || 'default-workflow';

  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentCount, setCurrentCount] = useState(0);
  const [diffSummary, setDiffSummary] = useState<{
    hasLogical: boolean;
    added: number;
    deleted: number;
    modified: number;
    layout: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setLabel('');
      setDescription('');
      setErrorMessage(null);
      setDiffSummary(null);
      return;
    }

    const currentNodes = useWorkflowStore.getState().nodes;
    const currentEdges = useWorkflowStore.getState().edges;

    // Default label based on date and count
    void listWorkflowVersions(activeWorkflowId).then((versions) => {
      setCurrentCount(versions.length);
      const nextIndex = versions.length + 1;
      const defaultName = isZh
        ? `版本 ${nextIndex} - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : `Version ${nextIndex} - ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      setLabel((prev) => (prev ? prev : defaultName));

      const latest = versions[0];
      if (latest) {
        const cleanCurrent = prepareVersionGraph(currentNodes, currentEdges);
        const diff = diffWorkflowGraphs(latest.graph, {
          nodes: cleanCurrent.nodes,
          edges: cleanCurrent.edges,
        });
        setDiffSummary({
          hasLogical: diff.hasLogicalChanges,
          added: diff.stats.addedNodeCount,
          deleted: diff.stats.deletedNodeCount,
          modified: diff.stats.modifiedNodeCount,
          layout: diff.stats.layoutNodeCount,
        });
      }
    });
  }, [isOpen, activeWorkflowId, isZh]);

  if (!isOpen) return null;

  const isQuotaFull = currentCount >= MAX_WORKFLOW_VERSIONS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || isSubmitting || isQuotaFull) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const record = await createWorkflowVersion({
        workflowId: activeWorkflowId,
        label: label.trim(),
        description: description.trim() || undefined,
        nodes,
        edges,
      });

      onClose();
      if (onSuccess) {
        onSuccess(record.id);
      }
    } catch (err) {
      if (err instanceof DuplicateWorkflowVersionError) {
        setErrorMessage(vt.duplicateWarning);
      } else if (err instanceof WorkflowVersionQuotaError) {
        setErrorMessage(vt.quotaFullWarning);
      } else {
        setErrorMessage((err as Error).message || String(err));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0E131F] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">⏱️</span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {vt.modalCreateTitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {vt.modalCreateDesc}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                  isQuotaFull
                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 font-bold'
                    : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20'
                }`}
              >
                {vt.quotaBadge}: {currentCount}/{MAX_WORKFLOW_VERSIONS}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {/* Quota Full Warning Banner */}
            {isQuotaFull && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2">
                <span className="text-sm">⚠️</span>
                <div>
                  <div className="font-semibold">{vt.quotaFullWarning}</div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
                <span className="text-sm">❌</span>
                <div>{errorMessage}</div>
              </div>
            )}

            {/* Pre-flight Diff Summary */}
            {diffSummary && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {isZh ? '相较最新已存版本的改动预检：' : 'Changes vs Latest Version:'}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  {diffSummary.added > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                      +{diffSummary.added} {isZh ? '节点' : 'nodes'}
                    </span>
                  )}
                  {diffSummary.deleted > 0 && (
                    <span className="text-rose-600 dark:text-rose-400 font-mono">
                      -{diffSummary.deleted} {isZh ? '节点' : 'nodes'}
                    </span>
                  )}
                  {diffSummary.modified > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 font-mono">
                      ~{diffSummary.modified} {isZh ? '处配置修改' : 'modified'}
                    </span>
                  )}
                  {diffSummary.layout > 0 && (
                    <span className="text-slate-400 dark:text-slate-500 font-mono">
                      ({diffSummary.layout} {isZh ? '处仅坐标移动' : 'layout shifts'})
                    </span>
                  )}
                  {!diffSummary.hasLogical && diffSummary.layout === 0 && (
                    <span className="text-slate-400 italic">
                      {isZh ? '与最新版本完全一致' : 'Identical to latest version'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Label Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {vt.versionLabelLabel} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value.slice(0, MAX_VERSION_LABEL_LENGTH))}
                placeholder={vt.versionLabelPlaceholder}
                disabled={isQuotaFull || isSubmitting}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161C2C] text-slate-900 dark:text-slate-100 text-xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
                required
                autoFocus
              />
              <div className="text-[10px] text-slate-400 text-right mt-1 font-mono">
                {label.length}/{MAX_VERSION_LABEL_LENGTH}
              </div>
            </div>

            {/* Description Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                {vt.versionDescLabel}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={vt.versionDescPlaceholder}
                disabled={isQuotaFull || isSubmitting}
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161C2C] text-slate-900 dark:text-slate-100 text-xs placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 resize-none disabled:opacity-50"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={!label.trim() || isQuotaFull || isSubmitting}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting && (
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              <span>{vt.saveSnapshotBtn}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
