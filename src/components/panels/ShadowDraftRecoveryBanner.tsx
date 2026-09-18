import React, { useState } from 'react';
import { AlertTriangle, RotateCcw, Check } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation.ts';
import { useWorkflowStore } from '../../stores/workflow-store.ts';
import { useProjectStore } from '../../stores/project-store.ts';
import type { ShadowDraft } from '../../services/storage/shadow-draft-manager.ts';
import { clearShadowDraft } from '../../services/storage/shadow-draft-manager.ts';

export interface ShadowDraftRecoveryBannerProps {
  draft: ShadowDraft;
  onRestore?: () => void;
  onDiscard?: () => void;
}

export const ShadowDraftRecoveryBanner: React.FC<ShadowDraftRecoveryBannerProps> = ({
  draft,
  onRestore,
  onDiscard,
}) => {
  const { t, language } = useTranslation();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleRestore = () => {
    const wfStore = useWorkflowStore.getState();
    const { nodeDrafts, activeNodeId } = draft;

    // Apply draft properties into nodes
    for (const [nodeId, patch] of Object.entries(nodeDrafts)) {
      const nodeExists = wfStore.nodes.some((n) => n.id === nodeId);
      if (nodeExists) {
        if (patch.config && typeof patch.config === 'object') {
          wfStore.updateNodeConfig(nodeId, patch.config as Record<string, unknown>);
        }
        const { config: _, ...otherData } = patch;
        if (Object.keys(otherData).length > 0) {
          wfStore.updateNodeData(nodeId, otherData);
        }
      }
    }

    // Restore selected node and open property panel if applicable
    if (activeNodeId && wfStore.nodes.some((n) => n.id === activeNodeId)) {
      wfStore.setSelectedNodeId(activeNodeId);
      wfStore.setPropertyPanelOpen(true);
    }

    // Clear the shadow draft from localStorage
    clearShadowDraft();

    // Trigger auto-save immediately to persist restored state to formal storage
    useProjectStore.getState().autoSaveCurrentWorkflow();

    const successMsg =
      language === 'zh'
        ? '草稿已成功恢复并同步至当前工作流'
        : 'Draft restored and synced successfully';
    setToastMessage(successMsg);

    setTimeout(() => {
      setToastMessage(null);
      onRestore?.();
    }, 1500);
  };

  const handleDiscard = () => {
    clearShadowDraft();
    onDiscard?.();
  };

  const bannerText =
    language === 'zh'
      ? '检测到上次未正常同步的编辑草稿（包含未保存的节点配置内容）'
      : `${t.draftRecovery.bannerTitle} (${t.draftRecovery.bannerDesc})`;

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 animate-in slide-in-from-top-4 duration-300">
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 dark:from-amber-950 dark:via-amber-900 dark:to-orange-950 text-white border-b border-amber-400/50 dark:border-amber-700/50 shadow-xl backdrop-blur-md px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Warning Message */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1 rounded-md bg-amber-700/50 text-amber-200 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="text-xs sm:text-sm font-semibold tracking-tight truncate">
              ⚠️ {bannerText}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRestore}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-amber-50 text-amber-900 font-bold text-xs shadow-sm transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
              <span>{t.draftRecovery.restoreBtn}</span>
            </button>

            <button
              onClick={handleDiscard}
              className="px-3 py-1.5 rounded-lg bg-amber-700/60 hover:bg-amber-700/80 text-amber-100 hover:text-white font-medium text-xs border border-amber-400/30 transition-all active:scale-95 cursor-pointer"
            >
              <span>{t.draftRecovery.discardBtn}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Success Toast */}
      {toastMessage && (
        <div className="fixed bottom-8 right-8 z-50 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
};
