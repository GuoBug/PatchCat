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
  AlertTriangle
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

const PRESETS: Record<string, { name: string; desc: string; data: any }> = {
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
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const loadPreset = useWorkflowStore((s) => s.loadPreset);
  const resetExecutionState = useWorkflowStore((s) => s.resetExecutionState);

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
        } else {
          setNodeStatus(n.id, 'idle');
        }
      });

      // Highlight cyclic edges with glowing red
      useWorkflowStore.setState((state) => ({
        ...state,
        edges: state.edges.map((e) => {
          const isCyclicEdge = cycleNodes.includes(e.source) && cycleNodes.includes(e.target);
          return {
            ...e,
            style: isCyclicEdge
              ? { stroke: '#f43f5e', strokeWidth: 3 }
              : { stroke: '#475569', strokeWidth: 2 },
            animated: isCyclicEdge,
          };
        }),
      }));

      // Pop up visual alert banner
      setAlertNotification({
        type: 'error',
        title: '工作流校验失败：检测到拓扑环路（Cycle Detected）',
        message: `图中存在闭环依赖死锁，无法确定拓扑层级。成环节点: [${cycleNodes.join(' ⇄ ')}]。请删除回环边后重试。`,
        cycleNodes,
      });
      return;
    }

    // Clear any previous alert
    setAlertNotification(null);

    // 2. Start normal execution
    useWorkflowStore.setState((state) => ({
      ...state,
      isExecuting: true,
      edges: state.edges.map((e) => ({
        ...e,
        animated: true,
        style: { stroke: '#38bdf8', strokeWidth: 2.5 },
      })),
    }));
    setExecutionTimeMs(0);
    const startTs = Date.now();

    // Start live clock ticker
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = window.setInterval(() => {
      setExecutionTimeMs(Date.now() - startTs);
    }, 50);

    // Reset nodes to queued initially
    nodes.forEach((n) => {
      setNodeStatus(n.id, 'queued');
    });

    const engine = engineRef.current;
    const currentNodes = useWorkflowStore.getState().nodes;
    const currentEdges = useWorkflowStore.getState().edges;

    try {
      const eventStream = engine.executeWorkflow(
        { nodes: currentNodes, edges: currentEdges }
      );

      for await (const event of eventStream) {
        if (event.type === 'NODE_START') {
          setNodeStatus(event.payload.nodeId, 'running');
        } else if (event.type === 'NODE_COMPLETE') {
          setNodeStatus(event.payload.nodeId, 'success', {
            latencyMs: event.payload.durationMs,
            timestamp: Date.now(),
            tokenUsage: (event.payload.output?.['usage'] as any) || { prompt: 80, completion: 40, total: 120 },
          });
          updateNodeData(event.payload.nodeId, {
            outputs: event.payload.output,
          });
        } else if (event.type === 'NODE_ERROR') {
          setNodeStatus(event.payload.nodeId, 'error', {
            error: event.payload.error,
            latencyMs: event.payload.durationMs,
            timestamp: Date.now(),
          });
          setAlertNotification({
            type: 'error',
            title: `节点执行异常 (Node Error: ${event.payload.nodeId})`,
            message: event.payload.error,
          });
        } else if (event.type === 'WORKFLOW_COMPLETE') {
          setExecutionTimeMs(event.payload.totalDurationMs);
        } else if (event.type === 'WORKFLOW_ERROR') {
          setAlertNotification({
            type: 'error',
            title: '工作流执行终止 (Workflow Halted)',
            message: event.payload.error,
          });
        }
      }
    } catch (err: unknown) {
      console.error('Runtime execution error:', err);
    } finally {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      useWorkflowStore.setState((state) => ({
        ...state,
        isExecuting: false,
        edges: state.edges.map((e) => ({
          ...e,
          animated: false,
          style: { stroke: '#475569', strokeWidth: 2 },
        })),
      }));
    }
  };

  // Stop Workflow
  const handleStopWorkflow = () => {
    engineRef.current.abort();
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    useWorkflowStore.setState((state) => ({
      ...state,
      isExecuting: false,
      edges: state.edges.map((e) => ({
        ...e,
        animated: false,
        style: { stroke: '#475569', strokeWidth: 2 },
      })),
    }));
  };

  // Reset State
  const handleReset = () => {
    setAlertNotification(null);
    resetExecutionState();
    setExecutionTimeMs(null);
  };

  // Quick Add Node Helper
  const handleQuickAdd = (type: NodeType) => {
    addNode(type);
    setShowAddMenu(false);
  };

  return (
    <>
      <header className="h-14 shrink-0 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-4 flex items-center justify-between z-20 text-slate-200 font-sans shadow-lg select-none relative">
        {/* Left: Brand & Graph Stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 shadow-md shadow-sky-500/10 flex items-center justify-center">
              <CatLogo className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xs font-bold tracking-wider uppercase text-slate-100 flex items-center gap-1.5">
                <span>PATCHCAT</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  v2.0
                </span>
              </h1>
              <span className="text-[10px] text-slate-400 font-mono">
                Precision prompts. Seamless workflows.
              </span>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Stats Pill */}
          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <strong className="text-slate-200 font-semibold">{nodes.length}</strong> nodes
            </span>
            <span className="flex items-center gap-1">
              <Share2 className="w-3.5 h-3.5 text-slate-500" />
              <strong className="text-slate-200 font-semibold">{edges.length}</strong> edges
            </span>
          </div>

          {/* Real-time Cycle Warning Badge in Header */}
          {!topologyValidation.valid && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-mono animate-pulse shadow-sm shadow-rose-500/20">
              <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
              <span>检测到环路 ({topologyValidation.cycleNodes?.length || 0} 节点)</span>
            </div>
          )}

          {/* Quick Add Node Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 text-sky-400" />
              <span>Add Node</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>

            {showAddMenu && (
              <div className="absolute left-0 mt-1.5 w-44 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-1.5 z-50 space-y-1">
                {(['input', 'prompt', 'llm', 'code', 'output'] as NodeType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => handleQuickAdd(t)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono text-slate-300 hover:text-white hover:bg-slate-800 transition-colors uppercase"
                  >
                    <span className="capitalize">{t} Node</span>
                    <span className="text-[10px] text-slate-500">+{t}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: Preset Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-sans">
            <FileCode2 className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-400 font-medium">Preset:</span>
            <select
              value={selectedPresetKey}
              onChange={(e) => handleSelectPreset(e.target.value)}
              disabled={isExecuting}
              className="bg-transparent text-slate-200 font-medium text-xs focus:outline-none cursor-pointer disabled:opacity-50"
            >
              {Object.entries(PRESETS).map(([k, p]) => (
                <option key={k} value={k} className="bg-slate-900 text-slate-200">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Execution Controls & Clock */}
        <div className="flex items-center gap-3">
          {/* Realtime execution counter */}
          {executionTimeMs !== null && (
            <div className="flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
              {isExecuting ? (
                <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin" />
              ) : (
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{executionTimeMs}ms</span>
            </div>
          )}

          {/* Reset State Button */}
          <button
            onClick={handleReset}
            disabled={isExecuting}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40"
            title="Reset node states and clear alerts"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Run / Stop Button */}
          {isExecuting ? (
            <button
              onClick={handleStopWorkflow}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shadow-md shadow-rose-600/30 transition-all"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              onClick={handleRunWorkflow}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-medium text-xs shadow-md shadow-sky-600/30 hover:shadow-sky-500/40 transition-all active:scale-95"
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
          <div className="p-4 rounded-2xl bg-slate-950/95 border border-rose-500/50 shadow-2xl backdrop-blur-xl text-slate-200 flex items-start gap-3.5 ring-1 ring-rose-500/30">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0 space-y-1.5">
              <h4 className="text-sm font-semibold text-rose-200 flex items-center gap-2">
                <span>{alertNotification.title}</span>
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {alertNotification.message}
              </p>
              {alertNotification.cycleNodes && alertNotification.cycleNodes.length > 0 && (
                <div className="pt-1 flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-rose-400 font-semibold font-mono">涉及成环节点:</span>
                  {alertNotification.cycleNodes.map((nid) => (
                    <span
                      key={nid}
                      className="px-2 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-200 font-mono text-[10px]"
                    >
                      {nid}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setAlertNotification(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
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
