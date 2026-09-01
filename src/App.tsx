import React, { useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { ControlHeader, PropertyPanel, LogConsole } from './components/panels';
import { WorkflowCanvas } from './components/canvas';
import { useWorkflowStore } from './stores/workflow-store.ts';
import customerSupportPreset from './presets/customer-support-routing.json';
import type { WorkflowGraph } from './engine/types.ts';

export const App: React.FC = () => {
  const loadPreset = useWorkflowStore((s) => s.loadPreset);
  const theme = useWorkflowStore((s) => s.theme);

  // Sync theme class to <html> element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Load default preset on initial mount
  useEffect(() => {
    loadPreset(customerSupportPreset as unknown as WorkflowGraph);
  }, [loadPreset]);

  return (
    <ReactFlowProvider>
      <div
        className={`w-screen h-screen flex flex-col overflow-hidden font-sans transition-colors duration-200 ${
          theme === 'dark'
            ? 'dark bg-[#0B0F17] text-slate-100'
            : 'bg-slate-50 text-slate-900'
        }`}
      >
        {/* Top Navigation & Controls */}
        <ControlHeader />

        {/* Main Canvas & Inspector Layout */}
        <main className="flex-1 flex w-full h-[calc(100vh-56px)] overflow-hidden relative">
          {/* Visual Canvas Area */}
          <section className="flex-1 h-full relative">
            <WorkflowCanvas />
          </section>

          {/* Right Property Inspector Drawer */}
          <PropertyPanel />
        </main>

        {/* Bottom Execution Log Console Drawer */}
        <LogConsole />
      </div>
    </ReactFlowProvider>
  );
};

export default App;
