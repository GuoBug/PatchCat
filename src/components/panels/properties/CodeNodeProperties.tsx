import React from 'react';
import { Terminal } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation.ts';

interface CodeNodePropertiesProps {
  nodeId: string;
  config: Record<string, unknown>;
  updateNodeConfig: (nodeId: string, patch: Record<string, unknown>) => void;
}

export const CodeNodeProperties: React.FC<CodeNodePropertiesProps> = ({
  nodeId,
  config,
  updateNodeConfig,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
          <span>{t.propertyPanel.scriptCode}</span>
        </label>
        <textarea
          rows={8}
          value={
            (config['script'] as string) ||
            (config['code'] as string) ||
            '// Transformation function\nreturn inputs;'
          }
          onChange={(e) => updateNodeConfig(nodeId, { script: e.target.value })}
          className="w-full px-3 py-2.5 rounded-lg bg-slate-900 text-amber-300 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 resize-y border border-slate-800 shadow-inner"
          placeholder="return inputs;"
        />
      </div>
    </div>
  );
};
