import React from 'react';
import { GitBranch, Plus, Trash } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation.ts';

interface ConditionNodePropertiesProps {
  nodeId: string;
  config: Record<string, unknown>;
  updateNodeConfig: (nodeId: string, patch: Record<string, unknown>) => void;
}

export const ConditionNodeProperties: React.FC<ConditionNodePropertiesProps> = ({
  nodeId,
  config,
  updateNodeConfig,
}) => {
  const { t } = useTranslation();

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
    {
      id: 'rule_1',
      variable: '',
      operator: 'equals',
      value: '',
      targetHandle: 'if_true',
    },
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
    updateNodeConfig(nodeId, { conditions: newConditions });
  };

  const handleUpdateRule = (index: number, patch: Partial<(typeof conditions)[0]>) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], ...patch };
    updateNodeConfig(nodeId, { conditions: updated });
  };

  const handleDeleteRule = (index: number) => {
    if (conditions.length <= 1) return;
    const updated = conditions.filter((_, i) => i !== index);
    updateNodeConfig(nodeId, { conditions: updated });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <GitBranch className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>
            {t.propertyPanel.conditionRulesTitle} ({conditions.length})
          </span>
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
                  <Trash className="w-3.5 h-3.5" />
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
                  <option value="not_contains">
                    {t.propertyPanel.operatorNotContains}
                  </option>
                  <option value="greater_than">
                    {t.propertyPanel.operatorGreaterThan}
                  </option>
                  <option value="less_than">{t.propertyPanel.operatorLessThan}</option>
                  <option value="is_empty">{t.propertyPanel.operatorIsEmpty}</option>
                  <option value="is_not_empty">
                    {t.propertyPanel.operatorIsNotEmpty}
                  </option>
                  <option value="regex_match">
                    {t.propertyPanel.operatorRegexMatch}
                  </option>
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
          onChange={(e) => updateNodeConfig(nodeId, { defaultBranch: e.target.value })}
          placeholder={t.propertyPanel.fallbackBranchPlaceholder}
          className="w-full px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-amber-700 dark:text-amber-400 font-semibold focus:outline-none focus:border-amber-500"
        />
        <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
          {t.propertyPanel.fallbackBranchHint}
        </span>
      </div>
    </div>
  );
};
