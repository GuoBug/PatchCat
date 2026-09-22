import React, { useEffect, useRef, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
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

  // Page leave guard: Prevent unload when isExecuting is true
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isExecuting) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isExecuting]);

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
              <WorkflowSidebar />

              {/* Visual Canvas Area */}
              <section className="flex-1 h-full relative">
                <WorkflowCanvas />
              </section>

              {/* Right Property Inspector Drawer */}
              <PropertyPanel />

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
