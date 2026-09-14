import React, { useState } from 'react';
import { Plus, Trash } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation.ts';

interface InputParameterItemProps {
  paramKey: string;
  paramValue: string;
  keyLabel: string;
  valueLabel: string;
  onRenameKey: (newKey: string) => void;
  onChangeValue: (newValue: string) => void;
  onDelete: () => void;
}

export const InputParameterItem: React.FC<InputParameterItemProps> = ({
  paramKey,
  paramValue,
  keyLabel,
  valueLabel,
  onRenameKey,
  onChangeValue,
  onDelete,
}) => {
  const [localKey, setLocalKey] = useState(paramKey);

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
    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
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

interface InputNodePropertiesProps {
  nodeId: string;
  inputs: Record<string, unknown>;
  updateNodeData: (nodeId: string, data: { inputs: Record<string, unknown> }) => void;
}

export const InputNodeProperties: React.FC<InputNodePropertiesProps> = ({
  nodeId,
  inputs,
  updateNodeData,
}) => {
  const { t } = useTranslation();

  const handleAddInputKey = () => {
    let nextIndex = Object.keys(inputs).length + 1;
    let newKey = `input_${nextIndex}`;
    while (Object.prototype.hasOwnProperty.call(inputs, newKey)) {
      nextIndex++;
      newKey = `input_${nextIndex}`;
    }
    updateNodeData(nodeId, {
      inputs: {
        ...inputs,
        [newKey]: '',
      },
    });
  };

  const handleRenameInputKey = (oldKey: string, newKey: string) => {
    if (oldKey === newKey || !newKey) return;
    const newInputs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(inputs)) {
      if (k === oldKey) {
        newInputs[newKey] = v;
      } else {
        newInputs[k] = v;
      }
    }
    updateNodeData(nodeId, { inputs: newInputs });
  };

  const handleInputChange = (key: string, value: string) => {
    updateNodeData(nodeId, {
      inputs: {
        ...inputs,
        [key]: value,
      },
    });
  };

  const handleDeleteInputKey = (keyToDelete: string) => {
    const newInputs = { ...inputs };
    delete newInputs[keyToDelete];
    updateNodeData(nodeId, { inputs: newInputs });
  };

  return (
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
  );
};
