import React, { useState, useRef } from 'react';
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
  Workflow
} from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflow-store.ts';
import { BrowserWorkflowEngine } from '../../engine/browser-engine.ts';
import type { NodeType, WorkflowGraph } from '../../engine/types.ts';

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

  const engineRef = useRef<BrowserWorkflowEngine>(new BrowserWorkflowEngine());
  const timerIntervalRef = useRef<number | null>(null);

  // Handle Preset Change
  const handleSelectPreset = (key: string) => {
    setSelectedPresetKey(key);
    const preset = PRESETS[key];
    if (preset?.data) {
      loadPreset(preset.data as WorkflowGraph);
      setExecutionTimeMs(null);
    }
  };

  // Run Workflow Flow
  const handleRunWorkflow = async () => {
    if (isExecuting) return;

    useWorkflowStore.setState({ isExecuting: true });
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
        } else if (event.type === 'WORKFLOW_COMPLETE') {
          setExecutionTimeMs(event.payload.totalDurationMs);
        } else if (event.type === 'WORKFLOW_ERROR') {
          console.error('Workflow error event:', event.payload.error);
        }
      }
    } catch (err: unknown) {
      console.error('Runtime execution error:', err);
    } finally {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      useWorkflowStore.setState({ isExecuting: false });
    }
  };

  // Stop Workflow
  const handleStopWorkflow = () => {
    engineRef.current.abort();
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    useWorkflowStore.setState({ isExecuting: false });
  };

  // Quick Add Node Helper
  const handleQuickAdd = (type: NodeType) => {
    addNode(type);
    setShowAddMenu(false);
  };

  return (
    <header className="h-14 shrink-0 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-4 flex items-center justify-between z-20 text-slate-200 font-sans shadow-lg select-none">
      {/* Left: Brand & Graph Stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-md shadow-sky-500/20">
            <Workflow className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-wider uppercase text-slate-100 flex items-center gap-1.5">
              <span>AI Prompt Flow</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-400 border border-sky-500/30">
                v2.0
              </span>
            </h1>
            <span className="text-[10px] text-slate-400 font-mono">
              DAG Orchestrator
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
            <Activity className={`w-3.5 h-3.5 ${isExecuting ? 'text-sky-400 animate-pulse' : 'text-emerald-400'}`} />
            <span>{executionTimeMs}ms</span>
          </div>
        )}

        {/* Reset State Button */}
        <button
          onClick={resetExecutionState}
          disabled={isExecuting}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40"
          title="Reset node states"
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
  );
};

export default ControlHeader;
