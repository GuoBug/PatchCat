import React from 'react';
import {
  GitBranch,
  Plus,
  Trash,
  Code2,
  Sliders,
  Zap,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation.ts';
import type { ConditionRule } from '../../../engine/types.ts';

interface ConditionNodePropertiesProps {
  nodeId: string;
  config: Record<string, unknown>;
  updateNodeConfig: (nodeId: string, patch: Record<string, unknown>) => void;
}

const EXPRESSION_TEMPLATES = [
  {
    code: 'inputs.score >= 80',
    descZh: '数值门槛 (score >= 80)',
    descEn: 'Threshold (score >= 80)',
  },
  {
    code: "inputs.urgency >= 4 && inputs.sentiment === 'negative'",
    descZh: '复合判定 (紧急且负向)',
    descEn: 'Compound (urgency & sentiment)',
  },
  {
    code: "inputs.status === 'success'",
    descZh: '状态判定 (status === success)',
    descEn: 'State check (status === success)',
  },
];

export const ConditionNodeProperties: React.FC<ConditionNodePropertiesProps> = ({
  nodeId,
  config,
  updateNodeConfig,
}) => {
  const { t, language } = useTranslation();
  const isZh = language === 'zh';

  const mode = (config.mode as 'rules' | 'expression') || 'rules';
  const expression = typeof config.expression === 'string' ? config.expression : '';
  const expressionTargetHandle =
    typeof config.expressionTargetHandle === 'string' && config.expressionTargetHandle
      ? config.expressionTargetHandle
      : 'if_true';

  const conditions: ConditionRule[] =
    (config.conditions as ConditionRule[]) || [
      {
        id: 'rule_1',
        variable: '',
        operator: 'equals',
        value: '',
        targetHandle: 'if_true',
      },
    ];

  const logicalOperator = (config.logicalOperator as 'AND' | 'OR') || 'AND';
  const defaultBranch =
    typeof config.defaultBranch === 'string' && config.defaultBranch
      ? config.defaultBranch
      : 'else';

  const handleAddRule = () => {
    const nextIdx = conditions.length + 1;
    const newConditions: ConditionRule[] = [
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

  const handleUpdateRule = (index: number, patch: Partial<ConditionRule>) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], ...patch } as ConditionRule;
    updateNodeConfig(nodeId, { conditions: updated });
  };

  const handleDeleteRule = (index: number) => {
    if (conditions.length <= 1) return;
    const updated = conditions.filter((_, i) => i !== index);
    updateNodeConfig(nodeId, { conditions: updated });
  };

  return (
    <div className="space-y-4">
      {/* ── Dual Mode Switcher ───────────────────────────────────────── */}
      <div className="flex rounded-xl bg-slate-100 dark:bg-slate-900/80 p-1 border border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => updateNodeConfig(nodeId, { mode: 'rules' })}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            mode === 'rules'
              ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs border border-slate-200/60 dark:border-slate-700/60'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{isZh ? '📋 可视规则表单' : '📋 Visual Rules'}</span>
        </button>
        <button
          type="button"
          onClick={() => updateNodeConfig(nodeId, { mode: 'expression' })}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            mode === 'expression'
              ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs border border-slate-200/60 dark:border-slate-700/60'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>{isZh ? '⚡ 高级 JS 表达式' : '⚡ Expression'}</span>
        </button>
      </div>

      {/* ── Mode 1: Expression Mode ──────────────────────────────────── */}
      {mode === 'expression' ? (
        <div className="space-y-4">
          {/* Expression Code Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>{t.propertyPanel.expressionCodeLabel}</span>
              </label>
            </div>
            <textarea
              rows={3}
              value={expression}
              onChange={(e) => updateNodeConfig(nodeId, { expression: e.target.value })}
              placeholder={t.propertyPanel.expressionPlaceholder}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 font-mono text-xs text-amber-400 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 resize-y leading-relaxed"
              spellCheck={false}
            />
            <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <HelpCircle className="w-3 h-3 text-slate-400 shrink-0" />
              <span>
                {isZh
                  ? '执行安全单行 JavaScript 表达式，可直接使用 inputs 及 context 对象。'
                  : 'Evaluates single-line JS expression in sandbox with inputs and context.'}
              </span>
            </div>
          </div>

          {/* Quick Expression Template Chips */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>{t.propertyPanel.expressionTemplatesLabel}</span>
            </label>
            <div className="flex flex-col gap-1.5">
              {EXPRESSION_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.code}
                  type="button"
                  onClick={() => updateNodeConfig(nodeId, { expression: tmpl.code })}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-50/70 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 text-[11px] font-mono text-amber-800 dark:text-amber-300 transition-all text-left cursor-pointer flex items-center justify-between group"
                  title={isZh ? `点击填入: ${tmpl.code}` : `Click to use: ${tmpl.code}`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Zap className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
                    <span className="truncate">{tmpl.code}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-sans shrink-0 ml-2">
                    {isZh ? tmpl.descZh : tmpl.descEn}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Target Branch When Truthy */}
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block uppercase">
              {t.propertyPanel.expressionTargetHandleLabel}
            </label>
            <input
              type="text"
              value={expressionTargetHandle}
              onChange={(e) => updateNodeConfig(nodeId, { expressionTargetHandle: e.target.value })}
              placeholder="if_true"
              className="w-full px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-amber-700 dark:text-amber-400 font-semibold focus:outline-none focus:border-amber-500"
            />
            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
              {t.propertyPanel.expressionTargetHandleHint}
            </span>
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
      ) : (
        /* ── Mode 2: Visual Rules Mode ────────────────────────────────── */
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

          {/* Logical Operator (AND / OR) */}
          {conditions.length > 1 && (
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
              <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                {t.propertyPanel.logicalOperatorLabel}
              </label>
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => updateNodeConfig(nodeId, { logicalOperator: 'AND' })}
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-all cursor-pointer ${
                    logicalOperator === 'AND'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {t.propertyPanel.logicalOperatorAnd}
                </button>
                <button
                  type="button"
                  onClick={() => updateNodeConfig(nodeId, { logicalOperator: 'OR' })}
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-all cursor-pointer ${
                    logicalOperator === 'OR'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {t.propertyPanel.logicalOperatorOr}
                </button>
              </div>
            </div>
          )}

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
                      onChange={(e) =>
                        handleUpdateRule(idx, {
                          operator: e.target.value as ConditionRule['operator'],
                        })
                      }
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
      )}
    </div>
  );
};
