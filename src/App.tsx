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
} from './components/panels';
import { WorkflowCanvas } from './components/canvas';
import { useWorkflowStore } from './stores/workflow-store.ts';
import { useSettingsStore } from './stores/settings-store.ts';
import { useProjectStore } from './stores/project-store.ts';
import { useKnowledgeStore } from './stores/knowledge-store.ts';

export const App: React.FC = () => {
  const loadPreset = useWorkflowStore((s) => s.loadPreset);
  const theme = useWorkflowStore((s) => s.theme);
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

  // Global Ctrl+Shift+D shortcut for toggling Chat Debug Panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setIsChatOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      </div>
    </ReactFlowProvider>
  );
};

export default App;
