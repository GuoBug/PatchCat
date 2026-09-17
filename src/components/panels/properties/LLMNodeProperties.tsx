import React, { useState } from 'react';
import { KeyRound, RefreshCw, Sliders } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation.ts';
import { useSettingsStore } from '../../../stores/settings-store.ts';

interface LLMNodePropertiesProps {
  nodeId: string;
  config: Record<string, unknown>;
  updateNodeConfig: (nodeId: string, patch: Record<string, unknown>) => void;
}

export const LLMNodeProperties: React.FC<LLMNodePropertiesProps> = ({
  nodeId,
  config,
  updateNodeConfig,
}) => {
  const { t } = useTranslation();
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);

  const setCurrentView = useSettingsStore((s) => s.setCurrentView);
  const setSettingsTab = useSettingsStore((s) => s.setSettingsTab);
  const activeProvider = useSettingsStore((s) => s.activeProvider);
  const providers = useSettingsStore((s) => s.providers);
  const fetchAvailableModels = useSettingsStore((s) => s.fetchAvailableModels);

  const currentProvider = providers[activeProvider];
  const hasKey =
    activeProvider === 'ollama' ? true : Boolean(currentProvider?.apiKey?.trim());
  const availableModels = currentProvider?.availableModels || [];

  const defaultModel =
    currentProvider?.defaultModel || availableModels[0] || 'gpt-4o-mini';
  const currentModel = (config['model'] as string) || defaultModel;

  // Auto-sync node config model if it was undefined/empty
  React.useEffect(() => {
    if (!config['model'] && defaultModel) {
      updateNodeConfig(nodeId, { model: defaultModel });
    }
  }, [config, defaultModel, nodeId, updateNodeConfig]);

  // Ensure available options always contains currentModel so the select element never falls back or desyncs
  const modelOptions = React.useMemo(() => {
    if (!currentModel) return availableModels;
    if (availableModels.includes(currentModel)) return availableModels;
    return [currentModel, ...availableModels];
  }, [availableModels, currentModel]);

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
            <span className="text-[10px] font-mono uppercase text-slate-400 block">
              {t.propertyPanel.provider}
            </span>
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
            {modelOptions.length > 0 && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                ({modelOptions.length})
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
            <RefreshCw
              className={`w-3 h-3 ${isRefreshingModels ? 'animate-spin' : ''}`}
            />
            <span>
              {isRefreshingModels
                ? t.propertyPanel.refreshing
                : t.propertyPanel.refreshModels}
            </span>
          </button>
        </div>
        {modelOptions.length > 0 ? (
          <select
            value={currentModel}
            onChange={(e) => updateNodeConfig(nodeId, { model: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono cursor-pointer"
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
          onChange={(e) =>
            updateNodeConfig(nodeId, { temperature: parseFloat(e.target.value) })
          }
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
          onChange={(e) => updateNodeConfig(nodeId, { systemPrompt: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
          placeholder="You are an expert AI assistant..."
        />
      </div>
    </div>
  );
};
