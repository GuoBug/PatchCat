import React, { useState, useCallback, useEffect } from 'react';
import { 
  X, 
  Trash2, 
  Settings2, 
  Sparkles, 
  Plus, 
  Trash, 
  Sliders, 
  Terminal, 
  CheckCircle2, 
  Copy,
  Check,
  Bot,
  Clock,
  Coins,
  KeyRound,
  ChevronDown,
  ChevronRight,
  Brain,
  Loader2,
  RefreshCw,
  Database,
  GitBranch,
  GitMerge,
  Globe,
} from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflow-store.ts';
import { useSettingsStore } from '../../stores/settings-store.ts';
import { useKnowledgeStore } from '../../stores/knowledge-store.ts';
import { useTranslation } from '../../i18n/useTranslation.ts';
import { extractVariableReferences } from '../../engine/variable-resolver.ts';

interface InputParameterItemProps {
  paramKey: string;
  paramValue: string;
  keyLabel: string;
  valueLabel: string;
  onRenameKey: (newKey: string) => void;
  onChangeValue: (newValue: string) => void;
  onDelete: () => void;
}

const InputParameterItem: React.FC<InputParameterItemProps> = ({
  paramKey,
  paramValue,
  keyLabel,
  valueLabel,
  onRenameKey,
  onChangeValue,
  onDelete,
}) => {
  const [localKey, setLocalKey] = useState(paramKey);

  useEffect(() => {
    setLocalKey(paramKey);
  }, [paramKey]);

  const handleBlurKey = () => {
    const trimmed = localKey.trim();
    if (trimmed && trimmed !== paramKey) {
      onRenameKey(trimmed);
    } else {
      setLocalKey(paramKey);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 focus-within:border-emerald-500/50 transition-colors shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-[10px] uppercase font-mono text-emerald-600 dark:text-emerald-500 font-bold shrink-0">
            {keyLabel}:
          </span>
          <input
            type="text"
            value={localKey}
            onChange={(e) => setLocalKey(e.target.value)}
            onBlur={handleBlurKey}
            onKeyDown={handleKeyDown}
            className="w-full px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-emerald-700 dark:text-emerald-400 font-semibold focus:outline-none focus:border-emerald-500 transition-colors"
            placeholder="parameter_name"
          />
        </div>
        <button
          onClick={onDelete}
          className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-900 transition-colors shrink-0"
          title="Delete key"
        >
          <Trash className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1">
        <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 font-medium block">
          {valueLabel}:
        </span>
        <textarea
          rows={2}
          value={paramValue}
          onChange={(e) => onChangeValue(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-emerald-500 resize-y"
          placeholder="Enter parameter value..."
        />
      </div>
    </div>
  );
};

export const PropertyPanel: React.FC = () => {
  const { t } = useTranslation();

  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
  const nodes = useWorkflowStore((s) => s.nodes);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const updateNodeConfig = useWorkflowStore((s) => s.updateNodeConfig);

  const setCurrentView = useSettingsStore((s) => s.setCurrentView);
  const setSettingsTab = useSettingsStore((s) => s.setSettingsTab);
  const activeProvider = useSettingsStore((s) => s.activeProvider);
  const providers = useSettingsStore((s) => s.providers);
  const fetchAvailableModels = useSettingsStore((s) => s.fetchAvailableModels);

  const knowledgeBases = useKnowledgeStore((s) => s.knowledgeBases);
  const openKnowledgeDetail = useKnowledgeStore((s) => s.openDetail);

  const [copied, setCopied] = useState(false);
  const [showReasoning, setShowReasoning] = useState(true);
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [httpTab, setHttpTab] = useState<'params' | 'headers' | 'body' | 'auth' | 'settings'>('params');

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;
    const store = useWorkflowStore.getState();
    store.setNodes(store.nodes.filter((n) => n.id !== selectedNodeId));
    store.setEdges(store.edges.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
  }, [selectedNodeId, setSelectedNodeId]);

  if (!selectedNode) {
    return (
      <aside className="w-80 md:w-[380px] shrink-0 border-l border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-slate-400 font-sans shadow-xs dark:shadow-2xl">
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 mb-4 text-slate-400 dark:text-slate-500">
          <Settings2 className="w-8 h-8 stroke-[1.5]" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
          {t.propertyPanel.noNodeSelected}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-[240px]">
          {t.propertyPanel.noNodeSelectedDesc}
        </p>
      </aside>
    );
  }

  const { id, type, data } = selectedNode;
  const config = data.config || {};
  const inputs = data.inputs || {};
  const outputs = data.outputs || {};
  const executionResult = data.executionResult;

  // Handlers for Input Node parameter dictionary
  const handleInputChange = (key: string, value: string) => {
    updateNodeData(id, {
      inputs: { ...inputs, [key]: value },
    });
  };

  const handleRenameInputKey = (oldKey: string, newKey: string) => {
    if (oldKey === newKey || !newKey.trim()) return;
    const nextInputs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(inputs)) {
      if (k === oldKey) {
        nextInputs[newKey.trim()] = v;
      } else {
        nextInputs[k] = v;
      }
    }
    updateNodeData(id, { inputs: nextInputs });
  };

  const handleAddInputKey = () => {
    const newKey = `param_${Object.keys(inputs).length + 1}`;
    updateNodeData(id, {
      inputs: { ...inputs, [newKey]: 'default_value' },
    });
  };

  const handleDeleteInputKey = (keyToDelete: string) => {
    const nextInputs = { ...inputs };
    delete nextInputs[keyToDelete];
    updateNodeData(id, { inputs: nextInputs });
  };

  // Handlers for Prompt Node
  const promptTemplate = (inputs['template'] as string) || (config['template'] as string) || '';
  const extractedSlots = extractVariableReferences(promptTemplate);

  const handleTemplateChange = (val: string) => {
    updateNodeData(id, {
      inputs: { ...inputs, template: val },
    });
    updateNodeConfig(id, { template: val });
  };

  // Copy helper
  const handleCopyText = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Determine what output content to show in the drawer
  const hasOutputs = Object.keys(outputs).length > 0;
  const outputString = hasOutputs
    ? (typeof outputs['response'] === 'string'
        ? outputs['response']
        : JSON.stringify(outputs, null, 2))
    : '';

  return (
    <aside className="w-80 md:w-[380px] shrink-0 border-l border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/95 backdrop-blur-md flex flex-col h-full overflow-hidden text-slate-800 dark:text-slate-200 font-sans shadow-xs dark:shadow-2xl transition-colors duration-200">
      {/* Panel Header */}
      <div className="h-12 px-5 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-mono font-bold uppercase px-2 py-0.5 rounded bg-blue-50 dark:bg-sky-500/10 text-blue-600 dark:text-sky-400 border border-blue-200 dark:border-sky-500/30">
            {type}
          </span>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
            {data.label}
          </h3>
        </div>

        <button
          onClick={() => setSelectedNodeId(null)}
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t.propertyPanel.parameters}
              </label>
              <button
                onClick={handleAddInputKey}
                className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>{t.propertyPanel.addParameter}</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {Object.entries(inputs).length === 0 ? (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs italic text-center">
                  {t.propertyPanel.noParameters}
                </div>
              ) : (
                Object.entries(inputs).map(([key, val]) => (
                  <InputParameterItem
                    key={key}
                    paramKey={key}
                    paramValue={typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    keyLabel={t.propertyPanel.paramKey}
                    valueLabel={t.propertyPanel.paramValue}
                    onRenameKey={(newKey) => handleRenameInputKey(key, newKey)}
                    onChangeValue={(newVal) => handleInputChange(key, newVal)}
                    onDelete={() => handleDeleteInputKey(key)}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Type Specific: Prompt Node ── */}
        {type === 'prompt' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-purple-400" />
                <span>{t.propertyPanel.promptTemplate}</span>
              </label>
              <textarea
                rows={8}
                value={promptTemplate}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-y transition-all"
                placeholder={t.propertyPanel.promptPlaceholder}
              />
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                Use <code className="text-violet-600 dark:text-purple-400">{"{{nodeId.outputKey}}"}</code> or <code className="text-violet-600 dark:text-purple-400">{"{{nodeId.val | 'fallback'}}"}</code>
              </span>
            </div>

            {/* Extracted Slots Badges */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                {t.propertyPanel.detectedVars} ({extractedSlots.length})
              </label>
              {extractedSlots.length === 0 ? (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs italic text-center">
                  {t.propertyPanel.noVarsDetected}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {extractedSlots.map((slot, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-violet-50 dark:bg-slate-950 border border-violet-200 dark:border-purple-500/30 text-xs font-mono">
                      <span className="text-violet-800 dark:text-purple-300 font-medium truncate">{slot.raw}</span>
                      {slot.defaultValue && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-transparent">
                          Fallback: {slot.defaultValue}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Type Specific: LLM Node ── */}
        {type === 'llm' && (() => {
          const currentProvider = providers[activeProvider];
          const hasKey = activeProvider === 'ollama' ? true : Boolean(currentProvider?.apiKey?.trim());
          const availableModels = currentProvider?.availableModels || [];

          return (
            <div className="space-y-4">
              {/* Active Provider Banner */}
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      hasKey ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
                    }`}
                  />
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 block">{t.propertyPanel.provider}</span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {currentProvider?.name || 'OpenAI'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSettingsTab('providers');
                    setCurrentView('settings');
                  }}
                  className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-sky-400 hover:text-blue-700 dark:hover:text-sky-300 px-2 py-1 rounded bg-blue-50 dark:bg-sky-500/10 hover:bg-blue-100 dark:hover:bg-sky-500/20 border border-blue-200 dark:border-sky-500/30 transition-all shadow-xs cursor-pointer"
                >
                  <KeyRound className="w-3 h-3" />
                  <span>{hasKey ? t.common.settings : t.settings.apiKeyLabel}</span>
                </button>
              </div>

              {/* Model Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <span>{t.propertyPanel.model}</span>
                    {availableModels.length > 0 && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        ({availableModels.length})
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsRefreshingModels(true);
                      await fetchAvailableModels(activeProvider);
                      setIsRefreshingModels(false);
                    }}
                    disabled={isRefreshingModels || !hasKey}
                    className="text-[10px] text-blue-600 dark:text-sky-400 hover:text-blue-700 dark:hover:text-sky-300 disabled:opacity-40 flex items-center gap-1 transition-colors"
                    title={t.propertyPanel.refreshModels}
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshingModels ? 'animate-spin' : ''}`} />
                    <span>{isRefreshingModels ? t.propertyPanel.refreshing : t.propertyPanel.refreshModels}</span>
                  </button>
                </div>
                {availableModels.length > 0 ? (
                  <select
                    value={
                      availableModels.includes((config['model'] as string) || '')
                        ? (config['model'] as string)
                        : currentProvider?.defaultModel || availableModels[0]
                    }
                    onChange={(e) => updateNodeConfig(id, { model: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono cursor-pointer"
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200">
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={(config['model'] as string) || currentProvider?.defaultModel || 'gpt-4o-mini'}
                    onChange={(e) => updateNodeConfig(id, { model: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                    placeholder={t.propertyPanel.customModelPlaceholder}
                  />
                )}
              </div>

              {/* Temperature Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    <span>{t.propertyPanel.temperature}</span>
                  </span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold">
                    {typeof config['temperature'] === 'number' ? config['temperature'] : 0.7}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={typeof config['temperature'] === 'number' ? config['temperature'] : 0.7}
                  onChange={(e) => updateNodeConfig(id, { temperature: parseFloat(e.target.value) })}
                  className="w-full accent-blue-600 dark:accent-sky-400 bg-slate-200 dark:bg-slate-950 cursor-pointer"
                />
              </div>

              {/* System Prompt */}
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  System Prompt (Optional)
                </label>
                <textarea
                  rows={3}
                  value={(config['systemPrompt'] as string) || ''}
                  onChange={(e) => updateNodeConfig(id, { systemPrompt: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                  placeholder="You are an expert AI assistant..."
                />
              </div>
            </div>
          );
        })()}

        {/* ── Type Specific: Code Node ── */}
        {type === 'code' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                <span>{t.propertyPanel.scriptCode}</span>
              </label>
              <textarea
                rows={8}
                value={(config['script'] as string) || (config['code'] as string) || '// Transformation function\nreturn inputs;'}
                onChange={(e) => updateNodeConfig(id, { script: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-900 text-amber-300 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 resize-y border border-slate-800 shadow-inner"
                placeholder="return inputs;"
              />
            </div>
          </div>
        )}

        {/* ── Type Specific: Knowledge Retrieval Node ── */}
        {type === 'knowledge' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>{t.propertyPanel.knowledgeConfig}</span>
              </label>

              {/* Target Knowledge Base */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    {t.propertyPanel.knowledgeBase}
                  </label>
                  <button
                    type="button"
                    onClick={() => openKnowledgeDetail((config['knowledgeBaseId'] as string) || undefined)}
                    className="text-[11px] font-medium text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    {t.knowledge.manageKb} &rarr;
                  </button>
                </div>
                <select
                  value={(config['knowledgeBaseId'] as string) || ''}
                  onChange={(e) => updateNodeConfig(id, { knowledgeBaseId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 cursor-pointer"
                >
                  <option value="">{t.propertyPanel.selectKnowledgeBase}</option>
                  {knowledgeBases.map((kb) => (
                    <option key={kb.id} value={kb.id}>
                      {kb.name} ({kb.document_count || 0} {t.knowledge.documentsCount})
                    </option>
                  ))}
                  {Boolean(config['knowledgeBaseId']) && !knowledgeBases.some((k) => k.id === config['knowledgeBaseId']) && (
                    <option value={config['knowledgeBaseId'] as string}>
                      {config['knowledgeBaseId'] as string}
                    </option>
                  )}
                </select>
                {knowledgeBases.length === 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    {t.propertyPanel.noKnowledgeBaseFound}
                  </p>
                )}
              </div>

              {/* Query */}
              <div className="space-y-1 pt-1">
                <label className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  {t.propertyPanel.knowledgeQuery}
                </label>
                <textarea
                  rows={3}
                  value={typeof inputs['query'] === 'string' ? (inputs['query'] as string) : ((config['query'] as string) || '')}
                  onChange={(e) => {
                    updateNodeConfig(id, { query: e.target.value });
                    updateNodeData(id, { inputs: { ...inputs, query: e.target.value } });
                  }}
                  placeholder={t.propertyPanel.knowledgeQueryPlaceholder}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                  Tip: Use <code className="text-cyan-600 dark:text-cyan-400">{"{{input_1.query}}"}</code> to search user question dynamically.
                </span>
              </div>

              {/* Top-K Slider */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-slate-700 dark:text-slate-300 font-medium">
                    {t.propertyPanel.topK}
                  </label>
                  <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                    {typeof config['topK'] === 'number' ? config['topK'] : 3}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={typeof config['topK'] === 'number' ? config['topK'] : 3}
                  onChange={(e) => updateNodeConfig(id, { topK: parseInt(e.target.value, 10) })}
                  className="w-full accent-cyan-600 dark:accent-cyan-400 bg-slate-200 dark:bg-slate-950 cursor-pointer"
                />
              </div>

              {/* Score Threshold Slider */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-slate-700 dark:text-slate-300 font-medium">
                    {t.propertyPanel.scoreThreshold}
                  </label>
                  <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                    {typeof config['scoreThreshold'] === 'number' ? config['scoreThreshold'] : 0.0}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={typeof config['scoreThreshold'] === 'number' ? config['scoreThreshold'] : 0.0}
                  onChange={(e) => updateNodeConfig(id, { scoreThreshold: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-600 dark:accent-cyan-400 bg-slate-200 dark:bg-slate-950 cursor-pointer"
                />
              </div>

              {/* Attribution / Output format hint */}
              <div className="p-2.5 rounded-lg bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200/60 dark:border-cyan-500/20 text-[11px] text-cyan-800 dark:text-cyan-300 leading-relaxed">
                {t.propertyPanel.knowledgeAttributionHint}
              </div>
            </div>
          </div>
        )}

        {/* ── Type Specific: Condition Node (IF / ELSE) ── */}
        {type === 'condition' && (() => {
          const conditionConfig = (config || {}) as {
            conditions?: Array<{
              id?: string;
              variable?: string;
              operator?: string;
              value?: string | number;
              targetHandle?: string;
            }>;
            logicalOperator?: 'AND' | 'OR';
            defaultBranch?: string;
          };
          const conditions = conditionConfig.conditions || [
            { id: 'rule_1', variable: '', operator: 'equals', value: '', targetHandle: 'if_true' },
          ];
          const defaultBranch = conditionConfig.defaultBranch || 'else';

          const handleAddRule = () => {
            const nextIdx = conditions.length + 1;
            const newConditions = [
              ...conditions,
              {
                id: `rule_${Date.now()}`,
                variable: '',
                operator: 'equals',
                value: '',
                targetHandle: `branch_${nextIdx}`,
              },
            ];
            updateNodeConfig(id, { conditions: newConditions });
          };

          const handleUpdateRule = (index: number, patch: Partial<(typeof conditions)[0]>) => {
            const updated = [...conditions];
            updated[index] = { ...updated[index], ...patch };
            updateNodeConfig(id, { conditions: updated });
          };

          const handleDeleteRule = (index: number) => {
            if (conditions.length <= 1) return;
            const updated = conditions.filter((_, i) => i !== index);
            updateNodeConfig(id, { conditions: updated });
          };

          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>{t.propertyPanel.conditionRulesTitle} ({conditions.length})</span>
                </label>
                <button
                  type="button"
                  onClick={handleAddRule}
                  className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 px-2 py-1 rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 transition-all cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{t.propertyPanel.addRule}</span>
                </button>
              </div>

              {/* Rules List */}
              <div className="space-y-3">
                {conditions.map((rule, idx) => (
                  <div
                    key={rule.id || idx}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span className="font-bold text-amber-700 dark:text-amber-300">
                        {t.propertyPanel.ruleIndex} #{idx + 1}
                      </span>
                      {conditions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(idx)}
                          className="text-slate-400 hover:text-rose-500 p-0.5 rounded cursor-pointer"
                          title={t.propertyPanel.deleteRule}
                        >
                          <Trash className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Variable Reference */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block uppercase">
                        {t.propertyPanel.variableLabel}
                      </label>
                      <input
                        type="text"
                        value={rule.variable || ''}
                        onChange={(e) => handleUpdateRule(idx, { variable: e.target.value })}
                        placeholder={t.propertyPanel.variablePlaceholder}
                        className="w-full px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Operator & Value */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block uppercase">
                          {t.propertyPanel.operatorLabel}
                        </label>
                        <select
                          value={rule.operator || 'equals'}
                          onChange={(e) => handleUpdateRule(idx, { operator: e.target.value })}
                          className="w-full px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                        >
                          <option value="equals">{t.propertyPanel.operatorEquals}</option>
                          <option value="not_equals">{t.propertyPanel.operatorNotEquals}</option>
                          <option value="contains">{t.propertyPanel.operatorContains}</option>
                          <option value="not_contains">{t.propertyPanel.operatorNotContains}</option>
                          <option value="greater_than">{t.propertyPanel.operatorGreaterThan}</option>
                          <option value="less_than">{t.propertyPanel.operatorLessThan}</option>
                          <option value="is_empty">{t.propertyPanel.operatorIsEmpty}</option>
                          <option value="is_not_empty">{t.propertyPanel.operatorIsNotEmpty}</option>
                          <option value="regex_match">{t.propertyPanel.operatorRegexMatch}</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block uppercase">
                          {t.propertyPanel.compareValueLabel}
                        </label>
                        <input
                          type="text"
                          value={rule.value !== undefined ? String(rule.value) : ''}
                          onChange={(e) => handleUpdateRule(idx, { value: e.target.value })}
                          placeholder={t.propertyPanel.compareValuePlaceholder}
                          className="w-full px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* Target Handle Output Port */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block uppercase">
                        {t.propertyPanel.targetHandleLabel}
                      </label>
                      <input
                        type="text"
                        value={rule.targetHandle || ''}
                        onChange={(e) => handleUpdateRule(idx, { targetHandle: e.target.value })}
                        placeholder="if_true / technical"
                        className="w-full px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-amber-700 dark:text-amber-400 font-semibold focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Fallback Branch */}
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">
                  {t.propertyPanel.fallbackBranchTitle}
                </label>
                <input
                  type="text"
                  value={defaultBranch}
                  onChange={(e) => updateNodeConfig(id, { defaultBranch: e.target.value })}
                  placeholder={t.propertyPanel.fallbackBranchPlaceholder}
                  className="w-full px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-amber-700 dark:text-amber-400 font-semibold focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                  {t.propertyPanel.fallbackBranchHint}
                </span>
              </div>
            </div>
          );
        })()}

        {/* ── Type Specific: Aggregator Node ── */}
        {type === 'aggregator' && (() => {
          const aggConfig = (config || {}) as { mode?: string; outputKey?: string };
          const mode = aggConfig.mode || 'first_available';
          const outputKey = aggConfig.outputKey || 'result';

          return (
            <div className="space-y-4">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <GitMerge className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>{t.propertyPanel.aggregatorModeTitle}</span>
              </label>

              {/* Mode Selectors */}
              <div className="space-y-2">
                {[
                  {
                    key: 'first_available',
                    label: t.propertyPanel.aggFirstAvailableLabel,
                    desc: t.propertyPanel.aggFirstAvailableDesc,
                  },
                  {
                    key: 'merge_all',
                    label: t.propertyPanel.aggMergeAllLabel,
                    desc: t.propertyPanel.aggMergeAllDesc,
                  },
                  {
                    key: 'wait_all',
                    label: t.propertyPanel.aggWaitAllLabel,
                    desc: t.propertyPanel.aggWaitAllDesc,
                  },
                ].map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => updateNodeConfig(id, { mode: m.key })}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                      mode === m.key
                        ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-500/50 shadow-xs'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {m.label}
                      </span>
                      {mode === m.key && (
                        <span className="w-2 h-2 rounded-full bg-purple-600 dark:bg-purple-400" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {m.desc}
                    </p>
                  </button>
                ))}
              </div>

              {/* Output Key */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  {t.propertyPanel.aggOutputKeyLabel}
                </label>
                <input
                  type="text"
                  value={outputKey}
                  onChange={(e) => updateNodeConfig(id, { outputKey: e.target.value })}
                  placeholder="result"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-purple-700 dark:text-purple-300 font-semibold focus:outline-none focus:border-purple-500"
                />
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                  {t.propertyPanel.aggOutputKeyHint} <code className="text-purple-600 dark:text-purple-400">{`{{${id}.${outputKey}}}`}</code>.
                </span>
              </div>
            </div>
          );
        })()}

        {/* ── Type Specific: HTTP Request Node ── */}
        {type === 'http' && (() => {
          const httpConfig = (config || {}) as {
            method?: string;
            url?: string;
            queryParams?: Record<string, string>;
            headers?: Record<string, string>;
            bodyType?: string;
            bodyContent?: string;
            timeout?: number;
            retryConfig?: { maxRetries: number; retryDelayMs: number };
            authType?: string;
            authConfig?: { token?: string; username?: string; password?: string; keyName?: string; keyValue?: string; addTo?: string };
          };

          const method = (httpConfig.method || 'GET').toUpperCase();
          const url = httpConfig.url || '';
          const queryParams = httpConfig.queryParams || {};
          const headers = httpConfig.headers || {};
          const bodyType = httpConfig.bodyType || 'none';
          const bodyContent = httpConfig.bodyContent || '';
          const timeout = httpConfig.timeout || 30000;
          const maxRetries = httpConfig.retryConfig?.maxRetries ?? 1;
          const retryDelayMs = httpConfig.retryConfig?.retryDelayMs ?? 1000;
          const authType = httpConfig.authType || 'none';
          const authConfig = httpConfig.authConfig || {};

          return (
            <div className="space-y-4">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>{t.propertyPanel.httpConfigTitle}</span>
              </label>

              {/* Method & URL Row */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  <select
                    value={method}
                    onChange={(e) => updateNodeConfig(id, { method: e.target.value })}
                    className="px-2.5 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold font-mono focus:outline-none focus:border-teal-500 cursor-pointer shrink-0"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>

                  <input
                    type="text"
                    value={url}
                    onChange={(e) => updateNodeConfig(id, { url: e.target.value })}
                    placeholder={t.propertyPanel.httpUrlPlaceholder}
                    className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
                  {t.propertyPanel.httpUrlHint}
                </span>
              </div>

              {/* Tabs Bar */}
              <div className="flex items-center border-b border-slate-200 dark:border-slate-800 text-xs font-medium">
                {[
                  { id: 'params', label: t.propertyPanel.httpTabParams },
                  { id: 'headers', label: t.propertyPanel.httpTabHeaders },
                  { id: 'body', label: t.propertyPanel.httpTabBody },
                  { id: 'auth', label: t.propertyPanel.httpTabAuth },
                  { id: 'settings', label: t.propertyPanel.httpTabSettings },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setHttpTab(tab.id as any)}
                    className={`px-3 py-1.5 border-b-2 capitalize transition-colors cursor-pointer ${
                      httpTab === tab.id
                        ? 'border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400 font-semibold'
                        : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Active Tab Content */}
              {httpTab === 'params' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">{t.propertyPanel.httpQueryParamsTitle}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...queryParams, [`param_${Object.keys(queryParams).length + 1}`]: '' };
                        updateNodeConfig(id, { queryParams: next });
                      }}
                      className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> {t.propertyPanel.httpAddParam}
                    </button>
                  </div>
                  {Object.entries(queryParams).map(([k, v], idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={k}
                        onChange={(e) => {
                          const next = { ...queryParams };
                          delete next[k];
                          next[e.target.value] = v;
                          updateNodeConfig(id, { queryParams: next });
                        }}
                        placeholder="key"
                        className="w-1/3 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                      />
                      <input
                        type="text"
                        value={v}
                        onChange={(e) => {
                          updateNodeConfig(id, { queryParams: { ...queryParams, [k]: e.target.value } });
                        }}
                        placeholder="value or {{var}}"
                        className="flex-1 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = { ...queryParams };
                          delete next[k];
                          updateNodeConfig(id, { queryParams: next });
                        }}
                        className="text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {Object.keys(queryParams).length === 0 && (
                    <p className="text-[11px] text-slate-400 italic py-1">{t.propertyPanel.httpNoQueryParams}</p>
                  )}
                </div>
              )}

              {httpTab === 'headers' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">{t.propertyPanel.httpHeadersTitle}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...headers, [`Header-${Object.keys(headers).length + 1}`]: '' };
                        updateNodeConfig(id, { headers: next });
                      }}
                      className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> {t.propertyPanel.httpAddHeader}
                    </button>
                  </div>
                  {Object.entries(headers).map(([k, v], idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={k}
                        onChange={(e) => {
                          const next = { ...headers };
                          delete next[k];
                          next[e.target.value] = v;
                          updateNodeConfig(id, { headers: next });
                        }}
                        placeholder="Header-Name"
                        className="w-1/3 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                      />
                      <input
                        type="text"
                        value={v}
                        onChange={(e) => {
                          updateNodeConfig(id, { headers: { ...headers, [k]: e.target.value } });
                        }}
                        placeholder="value"
                        className="flex-1 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = { ...headers };
                          delete next[k];
                          updateNodeConfig(id, { headers: next });
                        }}
                        className="text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {Object.keys(headers).length === 0 && (
                    <p className="text-[11px] text-slate-400 italic py-1">{t.propertyPanel.httpDefaultHeadersHint}</p>
                  )}
                </div>
              )}

              {httpTab === 'body' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono text-slate-400 uppercase">{t.propertyPanel.httpBodyFormat}</label>
                    <select
                      value={bodyType}
                      onChange={(e) => updateNodeConfig(id, { bodyType: e.target.value })}
                      className="px-2 py-1 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono cursor-pointer"
                    >
                      <option value="none">None</option>
                      <option value="json">JSON</option>
                      <option value="raw">Raw Text</option>
                    </select>
                  </div>
                  {bodyType !== 'none' && (
                    <textarea
                      rows={5}
                      value={bodyContent}
                      onChange={(e) => updateNodeConfig(id, { bodyContent: e.target.value })}
                      placeholder={'{\n  "query": "{{input_1.query}}"\n}'}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500 resize-y"
                    />
                  )}
                </div>
              )}

              {httpTab === 'auth' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-slate-400 uppercase block">{t.propertyPanel.httpAuthType}</label>
                    <select
                      value={authType}
                      onChange={(e) => updateNodeConfig(id, { authType: e.target.value })}
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono cursor-pointer"
                    >
                      <option value="none">{t.propertyPanel.httpAuthNone}</option>
                      <option value="bearer">{t.propertyPanel.httpAuthBearer}</option>
                      <option value="basic">{t.propertyPanel.httpAuthBasic}</option>
                      <option value="api-key">{t.propertyPanel.httpAuthApiKey}</option>
                    </select>
                  </div>

                  {authType === 'bearer' && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase block">{t.propertyPanel.httpBearerTokenLabel}</label>
                      <input
                        type="password"
                        value={authConfig.token || ''}
                        onChange={(e) => updateNodeConfig(id, { authConfig: { ...authConfig, token: e.target.value } })}
                        placeholder="ey..."
                        className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                      />
                    </div>
                  )}

                  {authType === 'basic' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 uppercase block">{t.propertyPanel.httpUsernameLabel}</label>
                        <input
                          type="text"
                          value={authConfig.username || ''}
                          onChange={(e) => updateNodeConfig(id, { authConfig: { ...authConfig, username: e.target.value } })}
                          className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 uppercase block">{t.propertyPanel.httpPasswordLabel}</label>
                        <input
                          type="password"
                          value={authConfig.password || ''}
                          onChange={(e) => updateNodeConfig(id, { authConfig: { ...authConfig, password: e.target.value } })}
                          className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {authType === 'api-key' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={authConfig.keyName || ''}
                          onChange={(e) => updateNodeConfig(id, { authConfig: { ...authConfig, keyName: e.target.value } })}
                          placeholder={t.propertyPanel.httpKeyNamePlaceholder}
                          className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                        />
                        <input
                          type="password"
                          value={authConfig.keyValue || ''}
                          onChange={(e) => updateNodeConfig(id, { authConfig: { ...authConfig, keyValue: e.target.value } })}
                          placeholder={t.propertyPanel.httpKeyValuePlaceholder}
                          className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                        />
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="addTo"
                            checked={authConfig.addTo !== 'query'}
                            onChange={() => updateNodeConfig(id, { authConfig: { ...authConfig, addTo: 'header' } })}
                          />
                          <span>{t.propertyPanel.httpSendInHeader}</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="addTo"
                            checked={authConfig.addTo === 'query'}
                            onChange={() => updateNodeConfig(id, { authConfig: { ...authConfig, addTo: 'query' } })}
                          />
                          <span>{t.propertyPanel.httpSendInQuery}</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {httpTab === 'settings' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase block">{t.propertyPanel.httpTimeoutLabel}</label>
                      <input
                        type="number"
                        value={timeout}
                        onChange={(e) => updateNodeConfig(id, { timeout: parseInt(e.target.value, 10) || 30000 })}
                        className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase block">{t.propertyPanel.httpMaxRetriesLabel}</label>
                      <input
                        type="number"
                        min="0"
                        max="5"
                        value={maxRetries}
                        onChange={(e) => updateNodeConfig(id, { retryConfig: { maxRetries: parseInt(e.target.value, 10) || 0, retryDelayMs } })}
                        className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── UNIVERSAL EXECUTION OUTPUT VIEWER IN DRAWER ── */}
        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              {type === 'llm' ? <Bot className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              <span>{t.propertyPanel.finalOutput}</span>
            </label>
            {hasOutputs && (
              <button
                onClick={() => handleCopyText(outputString)}
                className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-xs cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? t.common.copied : t.common.copy}</span>
              </button>
            )}
          </div>

          {/* Telemetry metadata badges */}
          {executionResult && (
            <div className="flex items-center gap-2 text-[10px] font-mono">
              {executionResult.latencyMs !== undefined && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-sky-500/10 border border-blue-200 dark:border-sky-500/20 text-blue-700 dark:text-sky-300">
                  <Clock className="w-3 h-3" />
                  <span>{executionResult.latencyMs}ms</span>
                </span>
              )}
              {executionResult.tokenUsage && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300">
                  <Coins className="w-3 h-3" />
                  <span>{executionResult.tokenUsage.total} tokens</span>
                </span>
              )}
            </div>
          )}

          {/* Formatted Output Viewer Box */}
          <div className="space-y-2.5">
            {/* Collapsible Reasoning Block (DeepSeek R1 / Thinking models) */}
            {typeof outputs['reasoning'] === 'string' && outputs['reasoning'].length > 0 && (
              <div className="rounded-xl bg-violet-50/70 dark:bg-purple-950/20 border border-violet-200 dark:border-purple-500/30 overflow-hidden shadow-xs">
                <button
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-violet-700 dark:text-purple-300 hover:bg-violet-100/50 dark:hover:bg-purple-900/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-violet-600 dark:text-purple-400" />
                    <span>{t.propertyPanel.reasoningThought}</span>
                  </div>
                  {showReasoning ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
                {showReasoning && (
                  <div className="p-3 text-[11px] font-mono text-violet-900 dark:text-purple-200/90 whitespace-pre-wrap leading-relaxed border-t border-violet-200/60 dark:border-purple-500/20 max-h-48 overflow-y-auto bg-white/40 dark:bg-black/20">
                    {outputs['reasoning']}
                    {data.status === 'running' && <span className="animate-pulse font-bold text-violet-600 dark:text-purple-400"> ▌</span>}
                  </div>
                )}
              </div>
            )}

            {/* Standard Response Content Box */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-xs">
              {hasOutputs ? (
                <>
                  {outputString}
                  {data.status === 'running' && <span className="animate-pulse font-bold text-blue-500"> ▌</span>}
                </>
              ) : data.status === 'running' ? (
                <div className="flex items-center justify-center gap-2 py-4 text-blue-600 dark:text-sky-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.propertyPanel.liveStreaming}...</span>
                </div>
              ) : (
                <span className="text-slate-400 dark:text-slate-500 italic text-center block py-2">
                  {t.propertyPanel.noNodeSelectedDesc}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Panel Footer Actions */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-between">
        <button
          onClick={handleDeleteNode}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs font-medium transition-all shadow-xs cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{t.propertyPanel.deleteNode}</span>
        </button>

        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
          ID: {id}
        </span>
      </div>
    </aside>
  );
};

export default PropertyPanel;
