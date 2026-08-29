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
  Check
} from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflow-store.ts';
import { extractVariableReferences } from '../../engine/variable-resolver.ts';

const LLM_MODELS = [
  { id: 'gpt-4o-mini', name: 'OpenAI GPT-4o Mini (Fast & Cheap)' },
  { id: 'gpt-4o', name: 'OpenAI GPT-4o (Reasoning & Coding)' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet (Analysis)' },
  { id: 'deepseek-r1', name: 'DeepSeek R1 (Open Reasoning)' },
  { id: 'gemini-1.5-pro', name: 'Google Gemini 1.5 Pro' },
  { id: 'ollama/llama3', name: 'Ollama Llama 3 (Local)' },
];

interface InputParameterItemProps {
  paramKey: string;
  paramValue: string;
  onRenameKey: (newKey: string) => void;
  onChangeValue: (newValue: string) => void;
  onDelete: () => void;
}

const InputParameterItem: React.FC<InputParameterItemProps> = ({
  paramKey,
  paramValue,
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
    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 focus-within:border-emerald-500/50 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-[10px] uppercase font-mono text-emerald-500 font-bold shrink-0">KEY:</span>
          <input
            type="text"
            value={localKey}
            onChange={(e) => setLocalKey(e.target.value)}
            onBlur={handleBlurKey}
            onKeyDown={handleKeyDown}
            className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-400 font-semibold focus:outline-none focus:border-emerald-500 transition-colors"
            placeholder="parameter_name"
          />
        </div>
        <button
          onClick={onDelete}
          className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-900 transition-colors shrink-0"
          title="Delete key"
        >
          <Trash className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1">
        <span className="text-[10px] uppercase font-mono text-slate-500 font-medium block">VALUE:</span>
        <textarea
          rows={2}
          value={paramValue}
          onChange={(e) => onChangeValue(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500 resize-y"
          placeholder="Enter parameter value..."
        />
      </div>
    </div>
  );
};

export const PropertyPanel: React.FC = () => {
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useWorkflowStore((s) => s.setSelectedNodeId);
  const nodes = useWorkflowStore((s) => s.nodes);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const updateNodeConfig = useWorkflowStore((s) => s.updateNodeConfig);

  const [copied, setCopied] = useState(false);

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
      <aside className="w-[380px] shrink-0 border-l border-slate-800/80 bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center text-slate-400 font-sans">
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 mb-4 text-slate-500">
          <Settings2 className="w-8 h-8 stroke-[1.5]" />
        </div>
        <h3 className="text-sm font-semibold text-slate-200 mb-1">No Node Selected</h3>
        <p className="text-xs text-slate-500 leading-relaxed max-w-[240px]">
          Click any node on the canvas to inspect, modify parameters, and configure execution settings.
        </p>
      </aside>
    );
  }

  const { id, type, data } = selectedNode;
  const config = data.config || {};
  const inputs = data.inputs || {};
  const outputs = data.outputs || {};

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

  // Copy output helper
  const handleCopyOutput = () => {
    navigator.clipboard.writeText(JSON.stringify(outputs, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside className="w-[380px] shrink-0 border-l border-slate-800/80 bg-slate-900/95 backdrop-blur-md flex flex-col h-full overflow-hidden text-slate-200 font-sans shadow-2xl">
      {/* Panel Header */}
      <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-mono font-bold uppercase px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30">
            {type}
          </span>
          <h3 className="text-sm font-semibold text-slate-100 truncate">
            {data.label}
          </h3>
        </div>

        <button
          onClick={() => setSelectedNodeId(null)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Form Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Common Section: Node Label */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Node Label
          </label>
          <input
            type="text"
            value={data.label}
            onChange={(e) => updateNodeData(id, { label: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-mono"
            placeholder="Enter node label..."
          />
        </div>

        {/* ── Type Specific: Input Node ── */}
        {type === 'input' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Input Parameters
              </label>
              <button
                onClick={handleAddInputKey}
                className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all"
              >
                <Plus className="w-3 h-3" />
                <span>Add Key</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {Object.entries(inputs).map(([key, val]) => (
                <InputParameterItem
                  key={key}
                  paramKey={key}
                  paramValue={typeof val === 'object' ? JSON.stringify(val) : String(val)}
                  onRenameKey={(newKey) => handleRenameInputKey(key, newKey)}
                  onChangeValue={(newVal) => handleInputChange(key, newVal)}
                  onDelete={() => handleDeleteInputKey(key)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Type Specific: Prompt Node ── */}
        {type === 'prompt' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Prompt Template</span>
              </label>
              <textarea
                rows={8}
                value={promptTemplate}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-y transition-all"
                placeholder="Write template with dynamic slots like {{nodeId.outputKey}}..."
              />
              <span className="text-[10px] text-slate-500 block">
                Use <code className="text-purple-400">{"{{nodeId.outputKey}}"}</code> or <code className="text-purple-400">{"{{nodeId.val | 'fallback'}}"}</code>
              </span>
            </div>

            {/* Extracted Slots Badges */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Detected Slots ({extractedSlots.length})
              </label>
              {extractedSlots.length === 0 ? (
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-500 text-xs italic text-center">
                  No variable slots found in template
                </div>
              ) : (
                <div className="space-y-1.5">
                  {extractedSlots.map((slot, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-950 border border-purple-500/30 text-xs font-mono">
                      <span className="text-purple-300 font-medium truncate">{slot.raw}</span>
                      {slot.defaultValue && (
                        <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
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
        {type === 'llm' && (
          <div className="space-y-4">
            {/* Model Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Model Provider
              </label>
              <select
                value={(config['model'] as string) || 'gpt-4o-mini'}
                onChange={(e) => updateNodeConfig(id, { model: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
              >
                {LLM_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Temperature Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400 flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>Temperature</span>
                </span>
                <span className="text-amber-400 font-bold">
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
                className="w-full accent-sky-400 bg-slate-950"
              />
            </div>

            {/* System Prompt */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                System Prompt (Optional)
              </label>
              <textarea
                rows={4}
                value={(config['systemPrompt'] as string) || ''}
                onChange={(e) => updateNodeConfig(id, { systemPrompt: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-sky-500 resize-y"
                placeholder="You are an expert AI assistant..."
              />
            </div>
          </div>
        )}

        {/* ── Type Specific: Code Node ── */}
        {type === 'code' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                <span>Script Code</span>
              </label>
              <textarea
                rows={8}
                value={(config['script'] as string) || (config['code'] as string) || '// Transformation function\nreturn inputs;'}
                onChange={(e) => updateNodeConfig(id, { script: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-amber-300 font-mono leading-relaxed focus:outline-none focus:border-amber-500 resize-y"
                placeholder="return inputs;"
              />
            </div>
          </div>
        )}

        {/* ── Type Specific: Output Node ── */}
        {type === 'output' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-pink-400" />
                <span>Output Result Data</span>
              </label>
              {Object.keys(outputs).length > 0 && (
                <button
                  onClick={handleCopyOutput}
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              )}
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 max-h-56 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {Object.keys(outputs).length > 0
                ? JSON.stringify(outputs, null, 2)
                : <span className="text-slate-500 italic">No output yet. Run workflow to populate results.</span>}
            </div>
          </div>
        )}
      </div>

      {/* Panel Footer Actions */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between">
        <button
          onClick={handleDeleteNode}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/30 text-xs font-medium transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Node</span>
        </button>

        <span className="text-[10px] font-mono text-slate-500">
          ID: {id}
        </span>
      </div>
    </aside>
  );
};

export default PropertyPanel;
