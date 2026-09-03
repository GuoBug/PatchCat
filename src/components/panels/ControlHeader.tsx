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
  ShieldAlert,
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
  const [showUnconfiguredModal, setShowUnconfiguredModal] = useState(false);

  const engineRef = useRef<BrowserWorkflowEngine>(new BrowserWorkflowEngine());
  const timerIntervalRef = useRef<number | null>(null);

  const currentPresets = useMemo(() => {
    return PRESETS_DATA[language] || PRESETS_DATA.en;
  }, [language]);

  // Real-time pre-flight topology validation (detects cycles live)
  const topologyValidation = useMemo(() => {
    return validateGraphTopology({ nodes, edges });
  }, [nodes, edges]);

  // Check if graph contains LLM nodes
  const hasLlmNodes = useMemo(() => {
    return nodes.some((n) => n.type === 'llm');
  }, [nodes]);

  // Check if active provider has an API key or is local ollama
  const activeConfig = providers[activeProvider];
  const hasActiveKey = activeProvider === 'ollama' ? true : Boolean(activeConfig?.apiKey?.trim());

  // Handle Preset Change
  const handleSelectPreset = (key: string) => {
    setSelectedPresetKey(key);
    setAlertNotification(null);
    setShowUnconfiguredModal(false);
    const preset = currentPresets[key];
    if (preset?.data) {
      loadPreset(preset.data as WorkflowGraph);
      setExecutionTimeMs(null);
    }
  };

  // Run Workflow Execution Flow
  const executeWorkflowRun = async (runOptions?: { skipLLM?: boolean }) => {
    if (isExecuting) return;

    // 1. Topology validation check
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

    // 2. Pre-flight check: If graph has LLM nodes and active provider has no key configured
    if (!runOptions?.skipLLM && hasLlmNodes && !hasActiveKey) {
      setShowUnconfiguredModal(true);
      return;
    }

    // Clear alerts & close preflight modal
    setAlertNotification(null);
    setShowUnconfiguredModal(false);

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
        { inputs: store.globalInputs, skipLLM: runOptions?.skipLLM }
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
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('[Engine Execution Exception]:', errMsg);
      setAlertNotification({
        type: 'error',
        title: t.header.unknownEngineError,
        message: errMsg,
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
    setAlertNotification(null);
    setShowUnconfiguredModal(false);
    setExecutionTimeMs(null);
  };

  // Node creation palette definition
  const nodePalette: { type: NodeType; label: string; desc: string; color: string }[] = [
    {
      type: 'input',
      label: t.nodeTypes.input,
      desc: t.nodeTypes.inputDesc,
      color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    },
    {
      type: 'prompt',
      label: t.nodeTypes.prompt,
      desc: t.nodeTypes.promptDesc,
      color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
    },
    {
      type: 'llm',
      label: t.nodeTypes.llm,
      desc: t.nodeTypes.llmDesc,
      color: 'bg-blue-500/10 text-blue-600 dark:text-sky-400 border-blue-500/30',
    },
    {
      type: 'code',
      label: t.nodeTypes.code,
      desc: t.nodeTypes.codeDesc,
      color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    },
    {
      type: 'output',
      label: t.nodeTypes.output,
      desc: t.nodeTypes.outputDesc,
      color: 'bg-rose-500/10 text-rose-600 dark:text-pink-400 border-rose-500/30',
    },
  ];

  return (
    <>
      <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-20 select-none shadow-xs transition-colors duration-200">
        {/* Left: Brand + Realtime DAG Stats */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2 shrink-0 select-none">
            <CatLogo className="w-7 h-7 shrink-0" />
            <div className="flex flex-col shrink-0">
              <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white font-mono uppercase whitespace-nowrap leading-none">
                PATCH<span className="text-blue-600 dark:text-sky-400">CAT</span>
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans hidden xl:inline whitespace-nowrap mt-0.5">
                {t.header.tagline}
              </span>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block shrink-0" />

          {/* Quick Add Node Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-sky-500/10 dark:hover:bg-sky-500/20 text-blue-600 dark:text-sky-400 border border-blue-200 dark:border-sky-500/30 font-medium text-xs transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.header.addNode}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {showAddMenu && (
              <div className="absolute left-0 top-full mt-2 w-64 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 font-sans">
                <div className="space-y-1">
                  {nodePalette.map((item) => (
                    <button
                      key={item.type}
                      onClick={() => handleQuickAdd(item.type)}
                      className="w-full p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-start gap-2.5 text-left transition-colors cursor-pointer"
                    >
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold border shrink-0 ${item.color}`}>
                        {item.type}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {item.label}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {item.desc}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Realtime Graph Metrics */}
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/60 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>{nodes.length} {t.common.nodes}</span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <Share2 className="w-3.5 h-3.5 text-slate-400" />
            <span>{edges.length} {t.common.edges}</span>
          </div>

          {/* Live Topological Cycle Warning Chip */}
          {!topologyValidation.valid && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-medium animate-pulse">
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>{t.header.cycleDetected}</span>
            </div>
          )}
        </div>

        {/* Center: Preset Scenarios Selector */}
        <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-100 dark:bg-slate-900 px-2 sm:px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner shrink min-w-0 max-w-[180px] sm:max-w-xs md:max-w-sm">
          <FileCode2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 hidden sm:block shrink-0" />
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden md:inline shrink-0">
            {t.header.preset}
          </span>
          <select
            value={selectedPresetKey}
            onChange={(e) => handleSelectPreset(e.target.value)}
            disabled={isExecuting}
            className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer truncate min-w-0 w-full"
          >
            {Object.entries(currentPresets).map(([key, item]) => (
              <option key={key} value={key} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                {item.name}
              </option>
            ))}
          </select>
        </div>

        {/* Right: Actions & Execution Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
          {/* API Key / Provider Status Button */}
          <button
            onClick={() => {
              setSettingsTab('providers');
              setCurrentView('settings');
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all shadow-xs cursor-pointer ${
              hasActiveKey
                ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
                : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30 animate-pulse'
            }`}
            title={t.header.apiKeyTooltip}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-mono">{activeConfig?.name || 'API Key'}</span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                hasActiveKey ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </button>

          {/* Settings Page Navigation Button */}
          <button
            onClick={() => {
              setSettingsTab('general');
              setCurrentView('settings');
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 text-xs font-medium transition-colors shadow-xs cursor-pointer"
            title={t.header.settingsTooltip}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{t.common.settings}</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
            title={theme === 'dark' ? t.header.themeTooltipLight : t.header.themeTooltipDark}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Real-time execution timer badge */}
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
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 transition-colors disabled:opacity-40 cursor-pointer"
            title={t.header.resetTooltip}
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Run / Stop Button */}
          {isExecuting ? (
            <button
              onClick={handleStopWorkflow}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-medium text-xs shadow-xs shadow-rose-600/20 transition-all cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
              <span>{t.header.stopWorkflow}</span>
            </button>
          ) : (
            <button
              onClick={() => executeWorkflowRun()}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-xs shadow-xs shadow-blue-600/20 transition-all active:scale-95 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>{t.header.runWorkflow}</span>
            </button>
          )}
        </div>
      </header>

      {/* Pre-flight Unconfigured LLM Model Modal */}
      {showUnconfiguredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-800 dark:text-slate-100 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-amber-50/50 dark:bg-amber-950/20">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700/50 shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {t.header.unconfiguredModalTitle}
                  </h3>
                  <span className="text-[11px] text-amber-700 dark:text-amber-400 font-mono flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span>{activeConfig?.name || 'LLM'} · {t.header.unconfiguredBadge}</span>
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowUnconfiguredModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                {t.header.unconfiguredModalDesc}
              </p>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] font-mono">
                <span className="text-slate-500 dark:text-slate-400">Target Provider:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {activeConfig?.name} ({activeConfig?.defaultModel})
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
              <button
                onClick={() => executeWorkflowRun({ skipLLM: true })}
                className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                <span>{t.header.validateFlowOnlyBtn}</span>
              </button>

              <button
                onClick={() => {
                  setShowUnconfiguredModal(false);
                  setSettingsTab('providers');
                  setCurrentView('settings');
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-md shadow-blue-600/25 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{t.header.bindApiKeyBtn}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
