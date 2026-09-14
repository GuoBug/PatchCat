import React from 'react';
import { Sparkles } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation.ts';
import type { VariableReference } from '../../../engine/variable-resolver.ts';

interface PromptNodePropertiesProps {
  nodeId: string;
  template: string;
  extractedSlots: VariableReference[];
  onTemplateChange: (newTemplate: string) => void;
}

export const PromptNodeProperties: React.FC<PromptNodePropertiesProps> = ({
  template,
  extractedSlots,
  onTemplateChange,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-purple-400" />
          <span>{t.propertyPanel.promptTemplate}</span>
        </label>
        <textarea
          rows={8}
          value={template}
          onChange={(e) => onTemplateChange(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-y transition-all"
          placeholder={t.propertyPanel.promptPlaceholder}
        />
        <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
          Use{' '}
          <code className="text-violet-600 dark:text-purple-400">
            {'{{nodeId.outputKey}}'}
          </code>{' '}
          or{' '}
          <code className="text-violet-600 dark:text-purple-400">
            {"{{nodeId.val | 'fallback'}}"}
          </code>
        </span>
      </div>

      {/* Extracted Slots Badges */}
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
          {t.propertyPanel.detectedVars} ({extractedSlots.length})
        </label>
        {extractedSlots.length === 0 ? (
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs italic text-center">
            {t.propertyPanel.noVarsDetected}
          </div>
        ) : (
          <div className="space-y-1.5">
            {extractedSlots.map((slot, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-lg bg-violet-50 dark:bg-slate-950 border border-violet-200 dark:border-purple-500/30 text-xs font-mono"
              >
                <span className="text-violet-800 dark:text-purple-300 font-medium truncate">
                  {slot.raw}
                </span>
                {slot.defaultValue && (
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-transparent">
                    Fallback: {slot.defaultValue}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
