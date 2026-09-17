import React, { memo, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { WorkflowNode } from '../../engine/types.ts';
import { CheckCircle2, Check, FileText, Copy, Code } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation.ts';

export const OutputNode: React.FC<NodeProps<WorkflowNode>> = memo(({ id, data, selected }) => {
  const { t } = useTranslation();
  const [copiedFormat, setCopiedFormat] = useState<'md' | 'text' | 'json' | null>(null);

  const outputs = data.outputs || {};
  const hasOutput = Object.keys(outputs).length > 0;

  const getOutputText = (): string => {
    if (typeof outputs['response'] === 'string') return outputs['response'];
    if (typeof outputs['output'] === 'string') return outputs['output'];
    if (typeof outputs['result'] === 'string') return outputs['result'];
    if (typeof outputs['promptText'] === 'string') return outputs['promptText'];
    return JSON.stringify(outputs, null, 2);
  };

  const handleCopy = (format: 'md' | 'text' | 'json', e: React.MouseEvent) => {
    e.stopPropagation();
    let text = '';
    if (format === 'json') {
      text = JSON.stringify(outputs, null, 2);
    } else {
      text = getOutputText();
    }
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 1800);
    });
  };

  return (
    <BaseNode
      id={id}
      type="output"
      label={data.label}
      status={data.status}
      selected={selected}
      executionResult={data.executionResult}
      hasLeftHandle={true}
      hasRightHandle={false}
      leftHandleLabel="input"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
          <span>Final Dispatch Output</span>
          <span className="text-rose-600 dark:text-pink-400 font-semibold">
            {hasOutput ? `${Object.keys(outputs).length} key(s)` : '0 key'}
          </span>
        </div>

        {hasOutput ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-rose-50/70 dark:bg-slate-950/80 border border-rose-200/80 dark:border-pink-500/30 text-[10px] text-rose-700 dark:text-pink-300 font-mono shadow-xs">
              <span className="flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 dark:text-pink-400" />
                <span>Result Ready</span>
              </span>
              <span className="text-[9px] text-slate-500 dark:text-slate-400">Click to inspect</span>
            </div>

            {/* Quick multi-format copy toolbar */}
            <div className="flex items-center justify-end gap-1 pt-0.5">
              <button
                onClick={(e) => handleCopy('md', e)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[9px] font-mono text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title={t.ergonomics.copyMarkdown}
              >
                {copiedFormat === 'md' ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <FileText className="w-2.5 h-2.5" />}
                <span>MD</span>
              </button>
              <button
                onClick={(e) => handleCopy('text', e)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[9px] font-mono text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title={t.ergonomics.copyPlainText}
              >
                {copiedFormat === 'text' ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
                <span>TXT</span>
              </button>
              <button
                onClick={(e) => handleCopy('json', e)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[9px] font-mono text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                title={t.ergonomics.copyRawJson}
              >
                {copiedFormat === 'json' ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Code className="w-2.5 h-2.5" />}
                <span>JSON</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 font-mono text-[10px] text-slate-400 dark:text-slate-500 text-center">
            Awaiting final result...
          </div>
        )}
      </div>
    </BaseNode>
  );
});

OutputNode.displayName = 'OutputNode';
