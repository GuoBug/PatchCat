/**
 * @file    src/components/modals/SanitizedExportModal.tsx
 * @version 1.0.0
 * @description
 *   Modal dialog for one-click sanitized workflow export.
 *   Conforms to PRD-017 Section 3.3:
 *   - Real-time pre-flight credential and sensitive path detection.
 *   - Interactive toggles for API key stripping, prompt secret masking, and local path neutralization.
 *   - One-click .patchcat.json file download and clipboard export.
 */

import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  FileCode,
  FolderLock,
  Download,
  Copy,
  Check,
  X,
  Layers,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation.ts';
import type { SavedWorkflow } from '../../stores/project-store.ts';
import {
  sanitizeWorkflow,
  downloadSanitizedWorkflow,
} from '../../services/export/workflow-sanitizer.ts';

export interface SanitizedExportModalProps {
  workflow: SavedWorkflow | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SanitizedExportModal: React.FC<SanitizedExportModalProps> = ({
  workflow,
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();

  const [stripApiKeys, setStripApiKeys] = useState(true);
  const [maskSensitivePromptVars, setMaskSensitivePromptVars] = useState(true);
  const [stripLocalPaths, setStripLocalPaths] = useState(true);
  const [clearExecutionOutputs, setClearExecutionOutputs] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  // Real-time pre-flight security scan
  const scanResult = useMemo(() => {
    if (!workflow) return null;
    return sanitizeWorkflow(workflow, {
      stripApiKeys,
      maskSensitivePromptVars,
      stripLocalPaths,
      clearExecutionOutputs,
    });
  }, [workflow, stripApiKeys, maskSensitivePromptVars, stripLocalPaths, clearExecutionOutputs]);

  if (!isOpen || !workflow) return null;

  const stats = scanResult?.stats;
  const hasSensitives = Boolean(stats && stats.totalSanitizedCount > 0);

  const handleDownload = () => {
    if (!workflow) return;
    downloadSanitizedWorkflow(workflow, undefined, {
      stripApiKeys,
      maskSensitivePromptVars,
      stripLocalPaths,
      clearExecutionOutputs,
    });
    onClose();
  };

  const handleCopy = async () => {
    if (!scanResult) return;
    try {
      const jsonStr = JSON.stringify(scanResult.sanitizedWorkflow, null, 2);
      await navigator.clipboard.writeText(jsonStr);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy sanitized JSON to clipboard:', err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-800 dark:text-slate-100 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{t.sanitizedExport.modalTitle}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 dark:bg-sky-950/60 text-blue-600 dark:text-sky-400 border border-blue-200 dark:border-sky-800">
                  .patchcat.json
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {t.sanitizedExport.modalDesc}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={t.sanitizedExport.closeBtn}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Target Workflow Information Card */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                {workflow.name}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-3">
              <span>{workflow.nodes?.length || 0} nodes</span>
              <span>{workflow.edges?.length || 0} edges</span>
            </div>
          </div>

          {/* Pre-flight Security Audit Banner */}
          {hasSensitives ? (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{t.sanitizedExport.scanDetectedTitle}</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-0.5 text-[11px] font-mono">
                {stats && stats.strippedApiKeysCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/80 flex items-center gap-1">
                    <KeyRound className="w-3 h-3" />
                    <span>{t.sanitizedExport.scanApiKeysFound.replace('{count}', String(stats.strippedApiKeysCount))}</span>
                  </span>
                )}
                {stats && stats.maskedPromptVarsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800/80 flex items-center gap-1">
                    <FileCode className="w-3 h-3" />
                    <span>{t.sanitizedExport.scanPromptVarsFound.replace('{count}', String(stats.maskedPromptVarsCount))}</span>
                  </span>
                )}
                {stats && stats.strippedLocalPathsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800/80 flex items-center gap-1">
                    <FolderLock className="w-3 h-3" />
                    <span>{t.sanitizedExport.scanLocalPathsFound.replace('{count}', String(stats.strippedLocalPathsCount))}</span>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{t.sanitizedExport.scanCleanTitle}</span>
            </div>
          )}

          {/* Sanitization Options Form */}
          <div className="space-y-3 pt-1">
            {/* Toggle 1: Strip API Keys */}
            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors cursor-pointer select-none">
              <input
                type="checkbox"
                checked={stripApiKeys}
                onChange={(e) => setStripApiKeys(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer accent-blue-600"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t.sanitizedExport.stripApiKeysLabel}</span>
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                  {t.sanitizedExport.stripApiKeysDesc}
                </p>
              </div>
            </label>

            {/* Toggle 2: Mask Sensitive Prompt Variables */}
            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors cursor-pointer select-none">
              <input
                type="checkbox"
                checked={maskSensitivePromptVars}
                onChange={(e) => setMaskSensitivePromptVars(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer accent-blue-600"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-purple-500" />
                  <span>{t.sanitizedExport.maskPromptVarsLabel}</span>
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                  {t.sanitizedExport.maskPromptVarsDesc}
                </p>
              </div>
            </label>

            {/* Toggle 3: Strip Local Paths */}
            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors cursor-pointer select-none">
              <input
                type="checkbox"
                checked={stripLocalPaths}
                onChange={(e) => setStripLocalPaths(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer accent-blue-600"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FolderLock className="w-3.5 h-3.5 text-cyan-500" />
                  <span>{t.sanitizedExport.stripLocalPathsLabel}</span>
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                  {t.sanitizedExport.stripLocalPathsDesc}
                </p>
              </div>
            </label>

            {/* Toggle 4: Clear Execution Outputs */}
            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors cursor-pointer select-none">
              <input
                type="checkbox"
                checked={clearExecutionOutputs}
                onChange={(e) => setClearExecutionOutputs(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700 cursor-pointer accent-blue-600"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>{t.sanitizedExport.clearOutputsLabel}</span>
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                  {t.sanitizedExport.clearOutputsDesc}
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-xs cursor-pointer"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">
                  {t.sanitizedExport.copiedToast}
                </span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>{t.sanitizedExport.copyJsonBtn}</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.sanitizedExport.exportJsonBtn}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
