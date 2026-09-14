import React from 'react';
import { GitMerge } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation.ts';

interface AggregatorNodePropertiesProps {
  nodeId: string;
  config: Record<string, unknown>;
  updateNodeConfig: (nodeId: string, patch: Record<string, unknown>) => void;
}

export const AggregatorNodeProperties: React.FC<AggregatorNodePropertiesProps> = ({
  nodeId,
  config,
  updateNodeConfig,
}) => {
  const { t } = useTranslation();
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
            onClick={() => updateNodeConfig(nodeId, { mode: m.key })}
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
          onChange={(e) => updateNodeConfig(nodeId, { outputKey: e.target.value })}
          placeholder="result"
          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-purple-700 dark:text-purple-300 font-semibold focus:outline-none focus:border-purple-500"
        />
        <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
          {t.propertyPanel.aggOutputKeyHint}{' '}
          <code className="text-purple-600 dark:text-purple-400">{`{{${nodeId}.${outputKey}}}`}</code>
          .
        </span>
      </div>
    </div>
  );
};
