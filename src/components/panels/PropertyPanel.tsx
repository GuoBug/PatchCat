import React, { useCallback } from 'react';
import {
  X,
  Trash2,
  Settings2,
  Sliders,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  FastForward,
} from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflow-store.ts';
import { useTranslation } from '../../i18n/useTranslation.ts';
import { extractVariableReferences } from '../../engine/variable-resolver.ts';
import {
  ExecutionResultViewer,
  InputNodeProperties,
  PromptNodeProperties,
  LLMNodeProperties,
  CodeNodeProperties,
  KnowledgeNodeProperties,
  ConditionNodeProperties,
  AggregatorNodeProperties,
  HttpNodeProperties,
  AgentNodeProperties,
  LoopNodeProperties,
  SubWorkflowProperties,
} from './properties/index.ts';

export const PropertyPanel: React.FC = () => {
  const { t } = useTranslation();

  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
  const isPropertyPanelOpen = useWorkflowStore((s) => s.isPropertyPanelOpen);
  const togglePropertyPanel = useWorkflowStore((s) => s.togglePropertyPanel);
  const setPropertyPanelOpen = useWorkflowStore((s) => s.setPropertyPanelOpen);
  const nodes = useWorkflowStore((s) => s.nodes);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const updateNodeConfig = useWorkflowStore((s) => s.updateNodeConfig);
  const retryNode = useWorkflowStore((s) => s.retryNode);
  const resumeFromNode = useWorkflowStore((s) => s.resumeFromNode);
  const isExecuting = useWorkflowStore((s) => s.isExecuting);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    const store = useWorkflowStore.getState();
    store.setNodes(store.nodes.filter((n) => n.id !== selectedNodeId));
    store.setEdges(
      store.edges.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId),
    );
    setSelectedNodeId(null);
  }, [selectedNodeId, setSelectedNodeId]);

  if (!isPropertyPanelOpen) {
    return (
      <button
        onClick={togglePropertyPanel}
        className="absolute right-0 top-3 z-30 w-6 h-9 rounded-l-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-y border-l border-slate-200 dark:border-slate-800 shadow-md flex items-center justify-center text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-sky-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer group"
        title={t.propertyPanel.expandPanel}
      >
        <ChevronsLeft className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400 group-hover:-translate-x-0.5 transition-transform" />
      </button>
    );
  }

  if (!selectedNode) {
    return (
      <aside className="w-80 md:w-[380px] max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-40 max-md:w-full max-md:max-w-xs shrink-0 border-l border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex flex-col h-full relative overflow-visible text-slate-800 dark:text-slate-200 font-sans shadow-xs dark:shadow-2xl transition-all duration-200 z-20">
        {/* Protruding drawer collapse tab (>>) */}
        <button
          onClick={togglePropertyPanel}
          className="absolute -left-6 top-3 z-30 w-6 h-9 rounded-l-lg bg-white dark:bg-slate-900 border-y border-l border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-sky-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer group"
          title={t.propertyPanel.collapsePanel}
        >
          <ChevronsRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Empty State Header with Title and Close Button */}
        <div className="h-12 px-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/40 shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Sliders className="w-3.5 h-3.5 text-slate-500" />
            <span>{t.propertyPanel.title}</span>
          </div>

          <button
            onClick={() => setPropertyPanelOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={t.common.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Empty State Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400 font-sans">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 mb-4 text-slate-400 dark:text-slate-500">
            <Settings2 className="w-8 h-8 stroke-[1.5]" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
            {t.propertyPanel.noNodeSelected}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-[240px]">
            {t.propertyPanel.noNodeSelectedDesc}
          </p>
          <button
            onClick={() => setPropertyPanelOpen(false)}
            className="mt-5 px-3.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <X className="w-3.5 h-3.5" />
            <span>{t.propertyPanel.closePanel}</span>
          </button>
        </div>
      </aside>
    );
  }

  const { id, type, data } = selectedNode;
  const config = data.config || {};
  const inputs = (data.inputs || {}) as Record<string, unknown>;
  const outputs = (data.outputs || {}) as Record<string, unknown>;
  const executionResult = data.executionResult;

  // Handlers for Prompt Node
  const promptTemplate = (inputs['template'] as string) || (config['template'] as string) || '';
  const extractedSlots = extractVariableReferences(promptTemplate);

  const handleTemplateChange = (val: string) => {
    updateNodeData(id, {
      inputs: { ...inputs, template: val },
    });
    updateNodeConfig(id, { template: val });
  };

  return (
    <aside className="w-80 md:w-[380px] max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-40 max-md:w-full max-md:max-w-xs shrink-0 border-l border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex flex-col h-full relative overflow-visible text-slate-800 dark:text-slate-200 font-sans shadow-xs dark:shadow-2xl transition-all duration-200 z-20">
      {/* Protruding drawer collapse tab (>>) */}
      <button
        onClick={togglePropertyPanel}
        className="absolute -left-6 top-3 z-30 w-6 h-9 rounded-l-lg bg-white dark:bg-slate-900 border-y border-l border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-sky-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer group"
        title={t.propertyPanel.collapsePanel}
      >
        <ChevronsRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
      </button>

      {/* Panel Header */}
      <div className="h-12 px-5 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/40 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-mono font-bold uppercase px-2 py-0.5 rounded bg-blue-50 dark:bg-sky-500/10 text-blue-600 dark:text-sky-400 border border-blue-200 dark:border-sky-500/30">
            {type}
          </span>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
            {data.label}
          </h3>
        </div>

        <button
          onClick={() => {
            setSelectedNodeId(null);
            setPropertyPanelOpen(false);
          }}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title={t.common.close}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Form Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Common Section: Node Label */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            {t.propertyPanel.nodeLabel}
          </label>
          <input
            type="text"
            value={data.label}
            onChange={(e) => updateNodeData(id, { label: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
            placeholder="Enter node label..."
          />
        </div>

        {/* ── Type Specific: Input Node ── */}
        {type === 'input' && (
          <InputNodeProperties
            nodeId={id}
            inputs={inputs}
            updateNodeData={updateNodeData}
          />
        )}

        {/* ── Type Specific: Prompt Node ── */}
        {type === 'prompt' && (
          <PromptNodeProperties
            nodeId={id}
            template={promptTemplate}
            extractedSlots={extractedSlots}
            onTemplateChange={handleTemplateChange}
          />
        )}

        {/* ── Type Specific: LLM Node ── */}
        {type === 'llm' && (
          <LLMNodeProperties
            nodeId={id}
            config={config}
            updateNodeConfig={updateNodeConfig}
          />
        )}

        {/* ── Type Specific: Code Node ── */}
        {type === 'code' && (
          <CodeNodeProperties
            nodeId={id}
            config={config}
            updateNodeConfig={updateNodeConfig}
          />
        )}

        {/* ── Type Specific: Knowledge Node ── */}
        {type === 'knowledge' && (
          <KnowledgeNodeProperties
            nodeId={id}
            config={config}
            inputs={inputs}
            updateNodeConfig={updateNodeConfig}
            updateNodeData={updateNodeData}
          />
        )}

        {/* ── Type Specific: Condition Node ── */}
        {type === 'condition' && (
          <ConditionNodeProperties
            nodeId={id}
            config={config}
            updateNodeConfig={updateNodeConfig}
          />
        )}

        {/* ── Type Specific: Aggregator Node ── */}
        {type === 'aggregator' && (
          <AggregatorNodeProperties
            nodeId={id}
            config={config}
            updateNodeConfig={updateNodeConfig}
          />
        )}

        {/* ── Type Specific: HTTP Request Node ── */}
        {type === 'http' && (
          <HttpNodeProperties
            nodeId={id}
            config={config}
            updateNodeConfig={updateNodeConfig}
          />
        )}

        {/* ── Type Specific: Agent Node ── */}
        {type === 'agent' && (
          <AgentNodeProperties
            nodeId={id}
            config={config}
            updateNodeConfig={updateNodeConfig}
          />
        )}

        {/* ── Type Specific: Loop Node ── */}
        {type === 'loop' && (
          <LoopNodeProperties
            nodeId={id}
            config={config}
            updateNodeConfig={updateNodeConfig}
          />
        )}

        {/* ── Type Specific: Sub-Workflow Node ── */}
        {type === 'sub_workflow' && (
          <SubWorkflowProperties
            nodeId={id}
            config={config}
            updateNodeConfig={updateNodeConfig}
          />
        )}

        {/* ── Universal Execution Output Viewer in Drawer ── */}
        <ExecutionResultViewer
          type={type}
          status={data.status}
          outputs={outputs}
          executionResult={executionResult}
          error={(data.error as string) || executionResult?.error}
        />
      </div>

      {/* Panel Footer Actions */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/60 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 w-full">
          {(data.status === 'error' || data.status === 'success' || data.status === 'cached') && (
            <>
              <button
                onClick={() => retryNode(id)}
                disabled={isExecuting}
                className="flex-1 min-w-0 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-blue-600 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-sky-500/10 border border-blue-200 dark:border-sky-500/30 text-xs font-medium transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                title={t.ergonomics.retryNodeHint}
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t.ergonomics.retryNode}</span>
              </button>
              <button
                onClick={() => resumeFromNode(id)}
                disabled={isExecuting}
                className="flex-1 min-w-0 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-xs font-medium transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                title={t.ergonomics.resumeFromNodeHint}
              >
                <FastForward className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t.ergonomics.resumeFromNode}</span>
              </button>
            </>
          )}

          <button
            onClick={handleDeleteNode}
            className={`${
              data.status === 'error' || data.status === 'success' || data.status === 'cached'
                ? 'flex-1 min-w-0'
                : 'w-full'
            } flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs font-medium transition-all shadow-xs cursor-pointer`}
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{t.propertyPanel.deleteNode}</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 dark:text-slate-500 px-0.5">
          <span>Node ID</span>
          <span className="select-all font-semibold text-slate-500 dark:text-slate-400">{id}</span>
        </div>
      </div>
    </aside>
  );
};

export default PropertyPanel;
