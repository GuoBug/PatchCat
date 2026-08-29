import React, { memo, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { WorkflowNode } from '../../engine/types.ts';
import { Copy, Check } from 'lucide-react';

export const OutputNode: React.FC<NodeProps<WorkflowNode>> = memo(({ id, data, selected }) => {
  const [copied, setCopied] = useState(false);
  const outputs = data.outputs || {};
  const hasOutput = Object.keys(outputs).length > 0;
  const displayContent = hasOutput
    ? JSON.stringify(outputs, null, 2)
    : '';

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!displayContent) return;
    navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
          <span>Final Output</span>
          {hasOutput && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
        </div>

        {hasOutput ? (
          <div className="p-2 rounded-lg bg-rose-50/50 dark:bg-slate-950/90 border border-rose-100 dark:border-pink-500/30 font-mono text-[10px] text-rose-900 dark:text-pink-200/90 max-h-24 overflow-y-auto leading-relaxed whitespace-pre-wrap shadow-xs">
            {displayContent}
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
