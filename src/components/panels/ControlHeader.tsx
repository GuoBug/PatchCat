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
  Moon
} from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflow-store.ts';
import { BrowserWorkflowEngine } from '../../engine/browser-engine.ts';
import { validateGraphTopology } from '../../engine/topological-sort.ts';
import type { NodeType, WorkflowGraph } from '../../engine/types.ts';
import { CatLogo } from '../icons/CatLogo.tsx';

// Import presets JSON
import customerSupportPreset from '../../presets/customer-support-routing.json';
import reportCriticPreset from '../../presets/report-generation-critic.json';
import modelArenaPreset from '../../presets/model-arena-eval.json';

const PRESETS: Record<string, { name: string; desc: string; data: unknown }> = {
  'customer-support': {
    name: 'Customer Support Routing',
    desc: 'Intent Classification & Ticket Dispatch',
    data: customerSupportPreset,
  },
  'report-critic': {
    name: 'Report Generator with Critic',
    desc: 'Self-Reflective Multi-Agent Loop',
    data: reportCriticPreset,
  },
  'model-arena': {
    name: 'Multi-LLM Arena & Judge',
    desc: 'Side-by-Side Model Benchmark',
    data: modelArenaPreset,
  },
};

export interface AlertNotification {
  type: 'error' | 'warning';
  title: string;
  message: string;
  cycleNodes?: string[];
}

export const ControlHeader: React.FC = () => {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const isExecuting = useWorkflowStore((s) => s.isExecuting);
  const addNode = useWorkflowStore((s) => s.addNode);
  const setNodeStatus = useWorkflowStore((s) => s.setNodeStatus);
  const loadPreset = useWorkflowStore((s) => s.loadPreset);
  const resetExecutionState = useWorkflowStore((s) => s.resetExecutionState);
  const theme = useWorkflowStore((s) => s.theme);
  const toggleTheme = useWorkflowStore((s) => s.toggleTheme);

  const [selectedPresetKey, setSelectedPresetKey] = useState<string>('customer-support');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [alertNotification, setAlertNotification] = useState<AlertNotification | null>(null);

  const engineRef = useRef<BrowserWorkflowEngine>(new BrowserWorkflowEngine());
  const timerIntervalRef = useRef<number | null>(null);

  // Real-time pre-flight topology validation (detects cycles live)
  const topologyValidation = useMemo(() => {
    return validateGraphTopology({ nodes, edges });
  }, [nodes, edges]);

  // Handle Preset Change
  const handleSelectPreset = (key: string) => {
    setSelectedPresetKey(key);
    setAlertNotification(null);
    const preset = PRESETS[key];
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
            error: '环路死锁 (Cycle Deadlock)',
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

      const cyclePathText = cycleNodes.length > 0 ? `成环节点: [${cycleNodes.join(' ⇄ ')}]` : '';
      setAlertNotification({
        type: 'error',
        title: '工作流校验失败：检测到拓扑环路 (Cycle Detected)',
        message: `图中存在闭环依赖死锁，无法确定拓扑层级。${cyclePathText}。请删除回环边后重试。`,
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
          case 'NODE_COMPLETE':
            store.setNodeStatus(event.payload.nodeId, 'success', {
              latencyMs: event.payload.durationMs,
              tokenUsage: { prompt: 60, completion: 60, total: 120 },
              timestamp: Date.now(),
            });
            if (event.payload.output) {
              store.updateNodeData(event.payload.nodeId, {
                outputs: event.payload.output,
              });
            }
            break;
          case 'NODE_ERROR':
            store.setNodeStatus(event.payload.nodeId, 'error', {
              latencyMs: event.payload.durationMs,
              error: event.payload.error,
              timestamp: Date.now(),
            });
            setAlertNotification({
              type: 'error',
              title: `节点执行异常: [${event.payload.nodeId}]`,
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
                title: '工作流校验或运行异常',
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
        title: '执行引擎发生未知错误',
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
                  v2.0
                </span>
              </div>
              <span className="text-[9px] text-slate-500 dark:text-slate-400 font-sans tracking-wide">
                Precision prompts. Seamless workflows.
              </span>
            </div>
          </div>

          <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

          {/* Graph Overview Stats & Topology Warnings */}
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <Layers className="w-3 h-3 text-blue-500 dark:text-sky-400" />
              <span>{nodes.length} nodes</span>
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <Share2 className="w-3 h-3 text-purple-500 dark:text-purple-400" />
              <span>{edges.length} edges</span>
            </span>

            {/* Realtime Cycle Warning Alert Badge */}
            {!topologyValidation.valid && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold animate-pulse">
                <AlertOctagon className="w-3 h-3" />
                <span>检测到环路 ({topologyValidation.cycleNodes?.length || 0} 节点)</span>
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
              <span>Add Node</span>
              <ChevronDown className="w-3 h-3 text-slate-400 dark:text-slate-500" />
            </button>

            {showAddMenu && (
              <div className="absolute left-0 mt-1.5 w-44 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-1.5 z-50 space-y-1">
                {(['input', 'prompt', 'llm', 'code', 'output'] as NodeType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => handleQuickAdd(t)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors uppercase"
                  >
                    <span className="capitalize">{t} Node</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">+{t}</span>
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
            <span className="text-slate-500 dark:text-slate-400 font-medium">Preset:</span>
            <select
              value={selectedPresetKey}
              onChange={(e) => handleSelectPreset(e.target.value)}
              disabled={isExecuting}
              className="bg-transparent text-slate-800 dark:text-slate-200 font-medium text-xs focus:outline-none cursor-pointer disabled:opacity-50"
            >
              {Object.entries(PRESETS).map(([k, p]) => (
                <option key={k} value={k} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Theme Switcher, Reset & Execution Controls */}
        <div className="flex items-center gap-2.5">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition-all shadow-xs"
            title={isDark ? '切换为浅色主题 (Switch to Light Mode)' : '切换为暗黑主题 (Switch to Dark Mode)'}
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
            title="Reset node states and clear alerts"
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
              <span>Stop</span>
            </button>
          ) : (
            <button
              onClick={handleRunWorkflow}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-xs shadow-xs shadow-blue-600/20 transition-all active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>Run Workflow</span>
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
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold font-mono">涉及成环节点:</span>
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
              title="Close alert"
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
