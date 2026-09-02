import React, { useState, useRef, useMemo } from 'react';
import {
  Play,
  Square,
  RotateCcw,
  Layers,
  Share2,
  Plus,
  ChevronDown,
  Activity,
  FileCode2,
  AlertOctagon,
  X,
  Loader2,
  AlertTriangle,
  Sun,
  Moon,
  KeyRound,
  Settings,
} from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflow-store.ts';
import { useSettingsStore } from '../../stores/settings-store.ts';
import { useTranslation } from '../../i18n/useTranslation.ts';
import { BrowserWorkflowEngine } from '../../engine/browser-engine.ts';
import { validateGraphTopology } from '../../engine/topological-sort.ts';
import type { NodeType, WorkflowGraph, TokenUsage } from '../../engine/types.ts';
import { CatLogo } from '../icons/CatLogo.tsx';
import { PRESETS_DATA } from '../../presets/index.ts';

export interface AlertNotification {
  type: 'error' | 'warning';
  title: string;
  message: string;
  cycleNodes?: string[];
}

export const ControlHeader: React.FC = () => {
  const { t, language } = useTranslation();

  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const isExecuting = useWorkflowStore((s) => s.isExecuting);
  const addNode = useWorkflowStore((s) => s.addNode);
  const setNodeStatus = useWorkflowStore((s) => s.setNodeStatus);
  const loadPreset = useWorkflowStore((s) => s.loadPreset);
  const resetExecutionState = useWorkflowStore((s) => s.resetExecutionState);
  const theme = useWorkflowStore((s) => s.theme);
  const toggleTheme = useWorkflowStore((s) => s.toggleTheme);

  const setCurrentView = useSettingsStore((s) => s.setCurrentView);
  const setSettingsTab = useSettingsStore((s) => s.setSettingsTab);
  const activeProvider = useSettingsStore((s) => s.activeProvider);
  const providers = useSettingsStore((s) => s.providers);

  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('customer-support');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [alertNotification, setAlertNotification] = useState<AlertNotification | null>(null);

  const engineRef = useRef<BrowserWorkflowEngine>(new BrowserWorkflowEngine());
  const timerIntervalRef = useRef<number | null>(null);

  const currentPresets = useMemo(() => {
    return PRESETS_DATA[language] || PRESETS_DATA.en;
  }, [language]);

  // Real-time pre-flight topology validation (detects cycles live)
  const topologyValidation = useMemo(() => {
    return validateGraphTopology({ nodes, edges });
  }, [nodes, edges]);

  // Handle Preset Change
  const handleSelectPreset = (key: string) => {
    setSelectedPresetKey(key);
    setAlertNotification(null);
    const preset = currentPresets[key];
    if (preset?.data) {
      loadPreset(preset.data as WorkflowGraph);
      setExecutionTimeMs(null);
    }
  };

  // Run Workflow Flow
  const handleRunWorkflow = async () => {
    if (isExecuting) return;

    // 1. Pre-flight check before running
    if (!topologyValidation.valid) {
      const cycleNodes = topologyValidation.cycleNodes || [];
      
      // Highlight all cyclic nodes with error status
      nodes.forEach((n) => {
        if (cycleNodes.includes(n.id)) {
          setNodeStatus(n.id, 'error', {
            error: language === 'zh' ? '环路死锁 (Cycle Deadlock)' : 'Cycle Deadlock',
            timestamp: Date.now(),
          });
        }
      });

      // Highlight cyclic edges with glowing red pulse
      const updatedEdges = edges.map((e) => {
        if (cycleNodes.includes(e.source) && cycleNodes.includes(e.target)) {
          return {
            ...e,
            style: { stroke: '#f43f5e', strokeWidth: 3 },
            animated: true,
          };
        }
        return e;
      });
      useWorkflowStore.getState().setEdges(updatedEdges);

      const cyclePathText = cycleNodes.length > 0 ? `[${cycleNodes.join(' ⇄ ')}]` : '';
      setAlertNotification({
        type: 'error',
        title: t.header.cycleAlertTitle,
        message: `${t.header.cycleAlertMsg} ${t.header.cycleNodesLabel} ${cyclePathText}`,
        cycleNodes,
      });
      return;
    }

    // Clear alerts
    setAlertNotification(null);

    // Reset old status before starting
    resetExecutionState();
    const startTime = Date.now();
    setExecutionTimeMs(0);

    timerIntervalRef.current = window.setInterval(() => {
      setExecutionTimeMs(Date.now() - startTime);
    }, 50);

    const store = useWorkflowStore.getState();
    const engine = engineRef.current;

    try {
      useWorkflowStore.setState({ isExecuting: true });

      // Animate active edge connections during run
      const runningEdges = store.edges.map((e) => ({
        ...e,
        animated: true,
        style: { stroke: '#2563EB', strokeWidth: 2, strokeDasharray: '6,6' },
      }));
      useWorkflowStore.getState().setEdges(runningEdges);

      for await (const event of engine.executeWorkflow(
        { nodes: store.nodes, edges: store.edges },
        { inputs: store.globalInputs }
      )) {
        switch (event.type) {
          case 'NODE_START':
            store.setNodeStatus(event.payload.nodeId, 'running');
            break;
          case 'NODE_CHUNK':
            store.updateNodeStreamingOutput(
              event.payload.nodeId,
              event.payload.fullContent,
              event.payload.fullReasoning
            );
            break;
          case 'NODE_COMPLETE': {
            const rawUsage = event.payload.output?.usage as TokenUsage | undefined;
            const tokenUsage = rawUsage || { prompt: 60, completion: 60, total: 120 };
            store.setNodeStatus(event.payload.nodeId, 'success', {
              latencyMs: event.payload.durationMs,
              tokenUsage,
              timestamp: Date.now(),
            });
            if (event.payload.output) {
              store.updateNodeData(event.payload.nodeId, {
                outputs: event.payload.output,
              });
            }
            break;
          }
          case 'NODE_ERROR':
            store.setNodeStatus(event.payload.nodeId, 'error', {
              latencyMs: event.payload.durationMs,
              error: event.payload.error,
              timestamp: Date.now(),
            });
            setAlertNotification({
              type: 'error',
              title: `[${event.payload.nodeId}] Execution Error`,
              message: event.payload.error,
            });
            break;
          case 'WORKFLOW_COMPLETE': {
            const finalEdges = useWorkflowStore.getState().edges.map((e) => ({
              ...e,
              animated: false,
              style: { stroke: '#10B981', strokeWidth: 2 },
            }));
            useWorkflowStore.getState().setEdges(finalEdges);
            break;
          }
          case 'WORKFLOW_ERROR':
            console.error('[Workflow Error]:', event.payload.error);
            if (
              event.payload.error.includes('Cycle') ||
              event.payload.error.includes('cycle') ||
              event.payload.error.includes('validation')
            ) {
              setAlertNotification({
                type: 'error',
                title: t.header.cycleAlertTitle,
                message: event.payload.error,
              });
            }
            break;
        }
      }
    } catch (e: any) {
      console.error('[Engine Execution Exception]:', e);
      setAlertNotification({
        type: 'error',
        title: t.header.unknownEngineError,
        message: e?.message || String(e),
      });
    } finally {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      setExecutionTimeMs(Date.now() - startTime);
      useWorkflowStore.setState({ isExecuting: false });
    }
  };

  // Stop Workflow Flow
  const handleStopWorkflow = () => {
    engineRef.current.abort();
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    useWorkflowStore.setState({ isExecuting: false });
  };

  // Quick Add Node
  const handleQuickAdd = (type: NodeType) => {
    addNode(type);
    setShowAddMenu(false);
  };

  // Reset graph node status
  const handleReset = () => {
    resetExecutionState();
    setExecutionTimeMs(null);
    setAlertNotification(null);
  };

  const isDark = theme === 'dark';
  const activeConfig = providers[activeProvider];
  const hasActiveKey = activeProvider === 'ollama' ? true : Boolean(activeConfig?.apiKey?.trim());

  return (
    <>
      <header className="h-14 bg-white/95 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 px-5 flex items-center justify-between z-30 shadow-xs dark:shadow-md text-slate-800 dark:text-slate-200 transition-colors duration-200">
        {/* Left: Brand Identity & Topology Info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <CatLogo className="w-8 h-8 filter drop-shadow(0 2px 4px rgba(0,0,0,0.15))" />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white font-mono uppercase">
                  PATCH<span className="text-blue-600 dark:text-sky-400">CAT</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-50 dark:bg-sky-500/10 text-blue-600 dark:text-sky-400 border border-blue-200 dark:border-sky-500/30">
                  v0.1
                </span>
              </div>
              <span className="text-[9px] text-slate-500 dark:text-slate-400 font-sans tracking-wide">
                {t.header.tagline}
              </span>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

          {/* Graph Overview Stats & Topology Warnings */}
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <Layers className="w-3 h-3 text-blue-500 dark:text-sky-400" />
              <span>{nodes.length} {t.common.nodes}</span>
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <Share2 className="w-3 h-3 text-purple-500 dark:text-purple-400" />
              <span>{edges.length} {t.common.edges}</span>
            </span>

            {/* Realtime Cycle Warning Alert Badge */}
            {!topologyValidation.valid && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold animate-pulse">
                <AlertOctagon className="w-3 h-3" />
                <span>{t.header.cycleDetected} ({topologyValidation.cycleNodes?.length || 0})</span>
              </span>
            )}
          </div>

          {/* Add Node Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
              <span>{t.header.addNode}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            </button>

            {showAddMenu && (
              <div className="absolute left-0 mt-1.5 w-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-1.5 z-50 space-y-1">
                {(['input', 'prompt', 'llm', 'code', 'output'] as NodeType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => handleQuickAdd(type)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="font-medium">{t.nodeTypes[type]}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono uppercase">+{type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: Preset Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-xs font-sans">
            <FileCode2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span className="text-slate-500 dark:text-slate-400 font-medium">{t.header.preset}</span>
            <select
              value={selectedPresetKey}
              onChange={(e) => handleSelectPreset(e.target.value)}
              disabled={isExecuting}
              className="bg-transparent text-slate-800 dark:text-slate-200 font-medium text-xs focus:outline-none cursor-pointer disabled:opacity-50"
            >
              {Object.entries(currentPresets).map(([k, p]) => (
                <option key={k} value={k} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: API Key Trigger, Settings Page Trigger, Theme Switcher, Reset & Execution Controls */}
        <div className="flex items-center gap-2.5">
          {/* API Key Button (Navigates to Settings -> Providers) */}
          <button
            onClick={() => {
              setSettingsTab('providers');
              setCurrentView('settings');
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition-all shadow-xs cursor-pointer"
            title={t.header.apiKeyTooltip}
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span className="hidden sm:inline font-mono">{activeConfig?.name.split(' ')[0] || t.header.apiKey}</span>
            <span
              className={`w-2 h-2 rounded-full ${
                hasActiveKey ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50' : 'bg-rose-400 animate-pulse'
              }`}
              title={hasActiveKey ? t.header.apiKeyConfigured : t.header.apiKeyMissing}
            />
          </button>

          {/* Settings Page Trigger Button (Replaces old inline "Logs" button) */}
          <button
            onClick={() => {
              setSettingsTab('general');
              setCurrentView('settings');
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-xs font-medium transition-all shadow-xs cursor-pointer"
            title={t.header.settingsTooltip}
          >
            <Settings className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span className="hidden sm:inline">{t.common.settings}</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition-all shadow-xs"
            title={isDark ? t.header.themeTooltipLight : t.header.themeTooltipDark}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {/* Realtime execution counter */}
          {executionTimeMs !== null && (
            <div className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              {isExecuting ? (
                <Loader2 className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400 animate-spin" />
              ) : (
                <Activity className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              )}
              <span>{executionTimeMs}ms</span>
            </div>
          )}

          {/* Reset State Button */}
          <button
            onClick={handleReset}
            disabled={isExecuting}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 transition-colors disabled:opacity-40"
            title={t.header.resetTooltip}
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Run / Stop Button */}
          {isExecuting ? (
            <button
              onClick={handleStopWorkflow}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-medium text-xs shadow-xs shadow-rose-600/20 transition-all"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
              <span>{t.header.stopWorkflow}</span>
            </button>
          ) : (
            <button
              onClick={handleRunWorkflow}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-xs shadow-xs shadow-blue-600/20 transition-all active:scale-95 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>{t.header.runWorkflow}</span>
            </button>
          )}
        </div>
      </header>

      {/* Floating Global Alert / Cycle Warning Banner */}
      {alertNotification && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 w-[600px] max-w-[90vw] animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="p-4 rounded-2xl bg-white/95 dark:bg-slate-950/95 border border-rose-300 dark:border-rose-500/50 shadow-2xl backdrop-blur-xl text-slate-800 dark:text-slate-200 flex items-start gap-3.5 ring-1 ring-rose-300/50 dark:ring-rose-500/30">
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/40 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0 space-y-1.5">
              <h4 className="text-sm font-semibold text-rose-700 dark:text-rose-200 flex items-center gap-2">
                <span>{alertNotification.title}</span>
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-sans">
                {alertNotification.message}
              </p>
              {alertNotification.cycleNodes && alertNotification.cycleNodes.length > 0 && (
                <div className="pt-1 flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold font-mono">
                    {t.header.cycleNodesLabel}
                  </span>
                  {alertNotification.cycleNodes.map((nid) => (
                    <span
                      key={nid}
                      className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-500/20 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-200 font-mono text-[10px]"
                    >
                      {nid}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setAlertNotification(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              title={t.common.close}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ControlHeader;
