import React from 'react';
import { Bot, Plus, Trash2, Cpu } from 'lucide-react';
import type { AgentToolBinding, AgentToolType } from '../../../engine/types.ts';
import { useTranslation } from '../../../i18n/useTranslation.ts';
import { useSettingsStore } from '../../../stores/settings-store.ts';

interface AgentNodePropertiesProps {
  nodeId: string;
  config: Record<string, unknown>;
  updateNodeConfig: (nodeId: string, patch: Record<string, unknown>) => void;
}

export const AgentNodeProperties: React.FC<AgentNodePropertiesProps> = ({
  nodeId,
  config,
  updateNodeConfig,
}) => {
  const { t } = useTranslation();
  const activeProvider = useSettingsStore((s) => s.activeProvider);
  const providers = useSettingsStore((s) => s.providers);
  const currentProvider = providers[activeProvider];
  const availableModels = currentProvider?.availableModels || [];
  const defaultModel = currentProvider?.defaultModel || availableModels[0] || 'gpt-4o';
  const currentModel = (config.model as string) || defaultModel;

  React.useEffect(() => {
    if (!config.model && defaultModel) {
      updateNodeConfig(nodeId, { model: defaultModel });
    }
  }, [config.model, defaultModel, nodeId, updateNodeConfig]);

  const modelOptions = React.useMemo(() => {
    if (!currentModel) return availableModels;
    if (availableModels.includes(currentModel)) return availableModels;
    return [currentModel, ...availableModels];
  }, [availableModels, currentModel]);

  const systemPrompt = (config.systemPrompt as string) || '';
  const tools = (config.tools as AgentToolBinding[]) || [];
  const maxIterations = (config.maxIterations as number) ?? 10;
  const temperature = (config.temperature as number) ?? 0.7;
  const maxTokenBudget = (config.maxTokenBudget as number) ?? 0;
  const loopDetectionEnabled = (config.loopDetectionEnabled as boolean) ?? true;
  const loopDetectionThreshold = (config.loopDetectionThreshold as number) ?? 3;

  return (
    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800/80">
      {/* Model Selector */}
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
          <span>{t.propertyPanel.model}</span>
        </label>
        {modelOptions.length > 0 ? (
          <select
            value={currentModel}
            onChange={(e) => updateNodeConfig(nodeId, { model: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 font-mono cursor-pointer"
          >
            {modelOptions.map((m) => (
              <option
                key={m}
                value={m}
                className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200"
              >
                {m}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={currentModel}
            onChange={(e) => updateNodeConfig(nodeId, { model: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 font-mono"
            placeholder={t.propertyPanel.customModelPlaceholder}
          />
        )}
      </div>
      {/* System Prompt */}
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
          <span>{t.propertyPanel.agentSystemPrompt}</span>
        </label>
        <textarea
          value={systemPrompt}
          onChange={(e) => updateNodeConfig(nodeId, { systemPrompt: e.target.value })}
          placeholder="You are a helpful assistant..."
          className="w-full h-32 px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-sans focus:outline-none focus:border-violet-500 resize-y"
        />
      </div>

      {/* Tools Management */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {t.propertyPanel.agentTools}
          </label>
          <button
            type="button"
            onClick={() => {
              const newTool: AgentToolBinding = {
                id: Math.random().toString(36).substring(2, 11),
                name: 'new_tool',
                description: 'Description of the new tool',
                type: 'builtin_code',
                implementation: 'return {}',
              };
              updateNodeConfig(nodeId, { tools: [...tools, newTool] });
            }}
            className="flex items-center gap-1 text-[10px] text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-2 py-1 rounded transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>{t.propertyPanel.agentAddTool}</span>
          </button>
        </div>

        <div className="space-y-2">
          {tools.map((tool, idx) => {
            const updateTool = (patch: Partial<AgentToolBinding>) => {
              const updated = tools.map((tItem, i) => (i === idx ? { ...tItem, ...patch } : tItem));
              updateNodeConfig(nodeId, { tools: updated });
            };

            return (
              <div
                key={tool.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={tool.name}
                      onChange={(e) => updateTool({ name: e.target.value })}
                      placeholder={t.propertyPanel.agentToolName}
                      className="w-full px-2 py-1 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold"
                    />
                    <input
                      type="text"
                      value={tool.description}
                      onChange={(e) => updateTool({ description: e.target.value })}
                      placeholder={t.propertyPanel.agentToolDescription}
                      className="w-full px-2 py-1 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs"
                    />
                    <select
                      value={tool.type}
                      onChange={(e) => updateTool({ type: e.target.value as AgentToolType })}
                      className="w-full px-2 py-1 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs cursor-pointer"
                    >
                      <option value="builtin_code">builtin_code</option>
                      <option value="builtin_http">builtin_http</option>
                      <option value="custom_schema">custom_schema</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const newTools = tools.filter((_, i) => i !== idx);
                      updateNodeConfig(nodeId, { tools: newTools });
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {tool.type === 'builtin_code' && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase">
                      {t.propertyPanel.agentToolCode}
                    </label>
                    <textarea
                      value={tool.implementation || ''}
                      onChange={(e) => updateTool({ implementation: e.target.value })}
                      className="w-full h-24 px-2 py-1.5 rounded bg-slate-900 text-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                )}

                {tool.type === 'builtin_http' && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase">
                      {t.propertyPanel.agentToolUrl}
                    </label>
                    <input
                      type="text"
                      value={tool.implementation || ''}
                      onChange={(e) => updateTool({ implementation: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                    />
                  </div>
                )}

                {tool.type === 'custom_schema' && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-400 uppercase">
                      {t.propertyPanel.agentToolSchema}
                    </label>
                    <textarea
                      value={tool.schema ? JSON.stringify(tool.schema, null, 2) : ''}
                      onChange={(e) => {
                        try {
                          updateTool({ schema: JSON.parse(e.target.value) });
                        } catch {
                          // Ignore invalid json temporarily
                        }
                      }}
                      className="w-full h-24 px-2 py-1.5 rounded bg-slate-900 text-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Agent Settings */}
      <div className="space-y-3">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              {t.propertyPanel.agentMaxIterations}
            </label>
            <span className="text-xs font-mono text-slate-500">{maxIterations}</span>
          </div>
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            value={maxIterations}
            onChange={(e) => updateNodeConfig(nodeId, { maxIterations: parseInt(e.target.value, 10) })}
            className="w-full accent-violet-600 cursor-pointer"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              {t.propertyPanel.temperature}
            </label>
            <span className="text-xs font-mono text-slate-500">{temperature.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={temperature}
            onChange={(e) => updateNodeConfig(nodeId, { temperature: parseFloat(e.target.value) })}
            className="w-full accent-violet-600 cursor-pointer"
          />
        </div>

        {/* Token Budget Limit */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              {t.propertyPanel.agentTokenBudget}
            </label>
            <span className="text-xs font-mono text-slate-500">
              {maxTokenBudget > 0 ? `${maxTokenBudget} tokens` : '0 (Unlimited)'}
            </span>
          </div>
          <input
            type="number"
            min="0"
            step="500"
            value={maxTokenBudget}
            onChange={(e) => {
              const val = Math.max(0, parseInt(e.target.value, 10) || 0);
              updateNodeConfig(nodeId, { maxTokenBudget: val });
            }}
            className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
            placeholder="0 = Unlimited"
          />
        </div>

        {/* Loop Detection */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={loopDetectionEnabled}
                onChange={(e) => updateNodeConfig(nodeId, { loopDetectionEnabled: e.target.checked })}
                className="rounded text-violet-600 focus:ring-violet-500"
              />
              <span>{t.propertyPanel.agentLoopDetection}</span>
            </label>
            {loopDetectionEnabled && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400">{t.propertyPanel.agentLoopThreshold}:</span>
                <select
                  value={loopDetectionThreshold}
                  onChange={(e) => updateNodeConfig(nodeId, { loopDetectionThreshold: parseInt(e.target.value, 10) })}
                  className="px-2 py-0.5 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                >
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
