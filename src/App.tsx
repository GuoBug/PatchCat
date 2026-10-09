import React, { useEffect, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { ShieldAlert } from 'lucide-react';
import {
  ControlHeader,
  PropertyPanel,
  SettingsPage,
  Footer,
  WorkflowSidebar,
  KnowledgeDetailDrawer,
  ChatDebugPanel,
  PublishApiModal,
  ShadowDraftRecoveryBanner,
  RunHistoryDrawer,
  StepDataInspector,
} from './components/panels';
import { WorkflowCanvas } from './components/canvas';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { useWorkflowStore } from './stores/workflow-store.ts';
import { useSettingsStore } from './stores/settings-store.ts';
import { useProjectStore } from './stores/project-store.ts';
import { useKnowledgeStore } from './stores/knowledge-store.ts';
import {
  ShadowDraftManager,
  type ShadowDraft,
} from './services/storage/shadow-draft-manager.ts';

export const App: React.FC = () => {
  const loadPreset = useWorkflowStore((s) => s.loadPreset);
  const theme = useWorkflowStore((s) => s.theme);
  const isExecuting = useWorkflowStore((s) => s.isExecuting);
  const currentView = useSettingsStore((s) => s.currentView);
  const setCurrentView = useSettingsStore((s) => s.setCurrentView);
  const setSettingsTab = useSettingsStore((s) => s.setSettingsTab);
  const hasLegacyKeysPending = useSettingsStore((s) => s.hasLegacyKeysPending);
  const language = useSettingsStore((s) => s.language);
  const storageMode = useSettingsStore((s) => s.storageMode);
  const serverBaseUrl = useSettingsStore((s) => s.serverBaseUrl);
  const activeWorkflowId = useProjectStore((s) => s.activeWorkflowId);
  const workflows = useProjectStore((s) => s.workflows);
  const seedPresetsIfEmpty = useProjectStore((s) => s.seedPresetsIfEmpty);
  const syncStorageMode = useKnowledgeStore((s) => s.syncStorageMode);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  const initialLoadedRef = useRef(false);

  // Sync theme class to <html> element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Sync knowledge storage mode
  useEffect(() => {
    syncStorageMode(storageMode, serverBaseUrl);
  }, [storageMode, serverBaseUrl, syncStorageMode]);

  // Initialize Web Crypto Secure Vault status on mount
  const initVault = useSettingsStore((s) => s.initVault);
  useEffect(() => {
    void initVault();
  }, [initVault]);

  // Global Ctrl+Shift+D (Chat Debug) & Ctrl+Shift+H (Run History) shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setIsChatOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'H' || e.key === 'h')) {
        e.preventDefault();
        useWorkflowStore.getState().toggleRunHistory();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Page leave guard: Warn if workflow is executing or legacy keys pending (P1-A / P2-C)
  // Decrypted in-memory keys are purged via pagehide ONLY when actually navigating away
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isExecuting || hasLegacyKeysPending) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    const handlePageHide = () => {
      useSettingsStore.getState().lockVault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [isExecuting, hasLegacyKeysPending]);

  // Check whether an unsynced shadow draft exists for active workflow
  const [recoveryDraft, setRecoveryDraft] = useState<ShadowDraft | null>(null);

  useEffect(() => {
    if (!activeWorkflowId) return;
    const currentWf = workflows.find((w) => w.id === activeWorkflowId);
    const currentUpdatedAt = currentWf?.updatedAt || 0;
    const { needed, draft } = ShadowDraftManager.checkRecoveryNeeded(
      activeWorkflowId,
      currentUpdatedAt,
    );
    if (needed && draft) {
      setRecoveryDraft(draft);
    } else {
      setRecoveryDraft(null);
    }
  }, [activeWorkflowId, workflows]);

  // Seed / load initial workflow from project store on mount
  useEffect(() => {
    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true;
      seedPresetsIfEmpty(language);
      const active = workflows.find((w) => w.id === activeWorkflowId) || workflows[0];
      if (active) {
        loadPreset({
          nodes: active.nodes,
          edges: active.edges,
        });
      }
    }
  }, [seedPresetsIfEmpty, language, workflows, activeWorkflowId, loadPreset]);

  return (
    <ReactFlowProvider>
      <div
        className={`w-screen h-screen flex flex-col overflow-hidden font-sans transition-colors duration-200 ${
          theme === 'dark' ? 'dark bg-[#0B0F17] text-slate-100' : 'bg-slate-50 text-slate-900'
        }`}
      >
        {/* Legacy API Keys Pending Migration Banner (PRD-017 / P1-A) */}
        {hasLegacyKeysPending && (
          <div className="bg-amber-600 dark:bg-amber-700 text-white px-4 py-2 flex items-center justify-between text-xs font-medium shadow-md z-50 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldAlert className="w-4 h-4 shrink-0 animate-pulse text-amber-200" />
              <span className="truncate sm:whitespace-normal">
                {language === 'zh'
                  ? '【重要安全提醒】检测到升级前保留的 API 密钥当前仅暂存于临时会话中。为防止刷新或关闭浏览器后丢失密钥，请立即设置主口令完成安全加密存储！'
                  : '[Security Alert] Legacy API Keys detected in temporary session memory. To prevent losing them on page reload, please set your Master Passphrase now to encrypt them!'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setCurrentView('settings');
                setSettingsTab('providers');
              }}
              className="px-3 py-1 bg-white text-amber-900 rounded-md font-bold text-xs hover:bg-amber-50 active:scale-95 transition-all shrink-0 ml-3 shadow-xs cursor-pointer"
            >
              {language === 'zh' ? '立即设置主口令' : 'Set Master Passphrase'}
            </button>
          </div>
        )}

        {/* Unsynced Shadow Draft Recovery Banner */}
        {recoveryDraft && (
          <ShadowDraftRecoveryBanner
            draft={recoveryDraft}
            onRestore={() => setRecoveryDraft(null)}
            onDiscard={() => setRecoveryDraft(null)}
          />
        )}
        {currentView === 'canvas' ? (
          <>
            {/* Top Navigation & Controls */}
            <ControlHeader
              onToggleChat={() => setIsChatOpen((prev) => !prev)}
              isChatOpen={isChatOpen}
              onOpenPublishApi={() => setIsPublishModalOpen(true)}
            />

            {/* Main Layout: Left Workflow Drawer | Canvas | Property Panel */}
            <main className="flex-1 flex w-full min-h-0 overflow-hidden relative">
              {/* Left Antigravity-style Workflow & Folder Drawer */}
              <AppErrorBoundary region="Sidebar">
                <WorkflowSidebar />
              </AppErrorBoundary>

              {/* Visual Canvas Area */}
              <section className="flex-1 h-full relative">
                <AppErrorBoundary region="Canvas">
                  <WorkflowCanvas />
                </AppErrorBoundary>
              </section>

              {/* Right Property Inspector Drawer */}
              <AppErrorBoundary region="Properties">
                <PropertyPanel />
              </AppErrorBoundary>

              {/* Interactive Chat Debug Slide-over Drawer */}
              <ChatDebugPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
            </main>

            {/* Bottom Status / Links Footer */}
            <Footer />
          </>
        ) : (
          <>
            {/* Dedicated Full-Page Settings View */}
            <SettingsPage />

            {/* Bottom Status / Links Footer */}
            <Footer />
          </>
        )}

        {/* Global Knowledge Base & Chunks Management Drawer */}
        <KnowledgeDetailDrawer />

        {/* Publish Workflow as REST API Modal */}
        <PublishApiModal isOpen={isPublishModalOpen} onClose={() => setIsPublishModalOpen(false)} />

        {/* Run Observability History Drawer (v0.4.8) */}
        <RunHistoryDrawer />

        {/* Step Data Freeze-Frame Inspector Modal (v0.4.8) */}
        <StepDataInspector />
      </div>
    </ReactFlowProvider>
  );
};

export default App;
