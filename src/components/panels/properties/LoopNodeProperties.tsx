import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation.ts';

interface LoopNodePropertiesProps {
  nodeId: string;
  config: Record<string, unknown>;
  updateNodeConfig: (nodeId: string, patch: Record<string, unknown>) => void;
}

export const LoopNodeProperties: React.FC<LoopNodePropertiesProps> = ({
  nodeId,
  config,
  updateNodeConfig,
}) => {
  const { t } = useTranslation();
  const inputArrayVariable = (config.inputArrayVariable as string) || '';
  const maxConcurrency = (config.maxConcurrency as number) ?? 1;
  const itemTimeoutMs = (config.itemTimeoutMs as number) ?? 30000;

  return (
    <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800/80">
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {t.propertyPanel.loopInputVariable}
        </label>
        <input
          type="text"
          value={inputArrayVariable}
          onChange={(e) => updateNodeConfig(nodeId, { inputArrayVariable: e.target.value })}
          placeholder="e.g. {{node_1.items}}"
          className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 uppercase block">
            {t.propertyPanel.loopConcurrency}
          </label>
          <input
            type="number"
            min="1"
            value={maxConcurrency}
            onChange={(e) =>
              updateNodeConfig(nodeId, { maxConcurrency: parseInt(e.target.value, 10) || 1 })
            }
            className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-slate-400 uppercase block">
            {t.propertyPanel.loopItemTimeout}
          </label>
          <input
            type="number"
            value={itemTimeoutMs}
            onChange={(e) =>
              updateNodeConfig(nodeId, { itemTimeoutMs: parseInt(e.target.value, 10) || 30000 })
            }
            className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
          />
        </div>
      </div>
    </div>
  );
};
