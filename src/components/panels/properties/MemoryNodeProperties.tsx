import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation.ts';
import type { MemoryNodeConfig } from '../../../engine/types.ts';
import { Sparkles, MessageSquare, Bookmark, AlertCircle } from 'lucide-react';

interface MemoryNodePropertiesProps {
  nodeId: string;
  config: Record<string, unknown>;
  updateNodeConfig: (nodeId: string, patch: Record<string, unknown>) => void;
}

export const MemoryNodeProperties: React.FC<MemoryNodePropertiesProps> = ({
  nodeId,
  config,
  updateNodeConfig,
}) => {
  const { t } = useTranslation();
  const typedConfig = config as Partial<MemoryNodeConfig>;

  const include = {
    summary: typedConfig.include?.summary ?? true,
    recentWindow: typedConfig.include?.recentWindow ?? true,
    pinned: typedConfig.include?.pinned ?? true,
  };
  const recentRounds = typedConfig.recentRounds ?? 5;
  const maxTokens = typedConfig.maxTokens ?? 0;
  const format = typedConfig.format ?? 'text';

  const updateInclude = (key: keyof typeof include, value: boolean) => {
    updateNodeConfig(nodeId, {
      include: {
        ...include,
        [key]: value,
      },
    });
  };

  const allDisabled = !include.summary && !include.recentWindow && !include.pinned;

  return (
    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800/80">
      {/* Section Header */}
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
          {t.propertyPanel.memorySection}
        </label>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
          {t.propertyPanel.memoryNoSessionWarning}
        </p>
      </div>

      {allDisabled && (
        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>All memory retrieval channels are disabled. Node will output empty content.</span>
        </div>
      )}

      {/* Include Checkboxes */}
      <div className="space-y-2">
        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
          Channels to Include
        </label>

        {/* 1. Recent Window */}
        <label className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
          <input
            type="checkbox"
            checked={include.recentWindow}
            onChange={(e) => updateInclude('recentWindow', e.target.checked)}
            className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950"
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
              <span>{t.propertyPanel.memoryIncludeRecentWindow}</span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              {t.propertyPanel.memoryIncludeRecentWindowDesc}
            </p>
          </div>
        </label>

        {/* 2. Rolling Summary */}
        <label className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
          <input
            type="checkbox"
            checked={include.summary}
            onChange={(e) => updateInclude('summary', e.target.checked)}
            className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950"
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{t.propertyPanel.memoryIncludeSummary}</span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              {t.propertyPanel.memoryIncludeSummaryDesc}
            </p>
          </div>
        </label>

        {/* 3. Pinned Messages */}
        <label className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
          <input
            type="checkbox"
            checked={include.pinned}
            onChange={(e) => updateInclude('pinned', e.target.checked)}
            className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950"
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-violet-500" />
              <span>{t.propertyPanel.memoryIncludePinned}</span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              {t.propertyPanel.memoryIncludePinnedDesc}
            </p>
          </div>
        </label>
      </div>

      {/* Numeric Bounds */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 uppercase block font-semibold">
            {t.propertyPanel.memoryRecentRounds}
          </label>
          <input
            type="number"
            min="1"
            max="50"
            value={recentRounds}
            onChange={(e) =>
              updateNodeConfig(nodeId, {
                recentRounds: Math.max(1, parseInt(e.target.value, 10) || 5),
              })
            }
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
          />
          <span className="text-[9px] text-slate-400 block">
            {t.propertyPanel.memoryRecentRoundsDesc}
          </span>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 uppercase block font-semibold">
            {t.propertyPanel.memoryMaxTokens}
          </label>
          <input
            type="number"
            min="0"
            step="100"
            value={maxTokens}
            onChange={(e) =>
              updateNodeConfig(nodeId, {
                maxTokens: Math.max(0, parseInt(e.target.value, 10) || 0),
              })
            }
            className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
            placeholder="0"
          />
          <span className="text-[9px] text-slate-400 block">
            {t.propertyPanel.memoryMaxTokensDesc}
          </span>
        </div>
      </div>

      {/* Format Selection */}
      <div className="space-y-1">
        <label className="text-[10px] text-slate-400 uppercase block font-semibold">
          {t.propertyPanel.memoryFormat}
        </label>
        <select
          value={format}
          onChange={(e) =>
            updateNodeConfig(nodeId, {
              format: e.target.value as 'text' | 'messages',
            })
          }
          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
        >
          <option value="text">{t.propertyPanel.memoryFormatText}</option>
          <option value="messages">{t.propertyPanel.memoryFormatMessages}</option>
        </select>
        <span className="text-[9px] text-slate-400 block">
          {t.propertyPanel.memoryFormatDesc}
        </span>
      </div>
    </div>
  );
};
