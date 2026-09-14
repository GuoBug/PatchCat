import React from 'react';
import { useTranslation } from '../../../i18n/useTranslation.ts';

interface SubWorkflowPropertiesProps {
  nodeId: string;
  config: Record<string, unknown>;
  updateNodeConfig: (nodeId: string, patch: Record<string, unknown>) => void;
}

export const SubWorkflowProperties: React.FC<SubWorkflowPropertiesProps> = ({
  nodeId,
  config,
  updateNodeConfig,
}) => {
  const { t } = useTranslation();
  const targetWorkflowId = (config.targetWorkflowId as string) || '';

  return (
    <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800/80">
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {t.propertyPanel.subWorkflowTarget}
        </label>
        <input
          type="text"
          value={targetWorkflowId}
          onChange={(e) => updateNodeConfig(nodeId, { targetWorkflowId: e.target.value })}
          placeholder="Workflow ID"
          className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono"
        />
      </div>
    </div>
  );
};
