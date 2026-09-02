import React, { useEffect, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { ControlHeader, PropertyPanel, SettingsPage, Footer } from './components/panels';
import { WorkflowCanvas } from './components/canvas';
import { useWorkflowStore } from './stores/workflow-store.ts';
import { useSettingsStore } from './stores/settings-store.ts';
import { PRESETS_DATA } from './presets/index.ts';

export const App: React.FC = () => {
  const loadPreset = useWorkflowStore((s) => s.loadPreset);
  const theme = useWorkflowStore((s) => s.theme);
  const currentView = useSettingsStore((s) => s.currentView);
  const language = useSettingsStore((s) => s.language);
  const initialLoadedRef = useRef(false);

  // Sync theme class to <html> element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Load default preset on initial mount matching active language
  useEffect(() => {
    if (!initialLoadedRef.current) {
      initialLoadedRef.current = true;
      const initialPreset = PRESETS_DATA[language]?.['customer-support'] || PRESETS_DATA.en['customer-support'];
      if (initialPreset?.data) {
        loadPreset(initialPreset.data);
      }
    }
  }, [loadPreset, language]);

  return (
    <ReactFlowProvider>
      <div
        className={`w-screen h-screen flex flex-col overflow-hidden font-sans transition-colors duration-200 ${
          theme === 'dark'
            ? 'dark bg-[#0B0F17] text-slate-100'
            : 'bg-slate-50 text-slate-900'
        }`}
      >
        {currentView === 'canvas' ? (
          <>
            {/* Top Navigation & Controls */}
            <ControlHeader />

            {/* Main Canvas & Inspector Layout */}
            <main className="flex-1 flex w-full min-h-0 overflow-hidden relative">
              {/* Visual Canvas Area */}
              <section className="flex-1 h-full relative">
                <WorkflowCanvas />
              </section>

              {/* Right Property Inspector Drawer */}
              <PropertyPanel />
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
      </div>
    </ReactFlowProvider>
  );
};

export default App;
