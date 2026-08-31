import React, { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { WorkflowNode } from '../../engine/types.ts';
import { CheckCircle2 } from 'lucide-react';

export const OutputNode: React.FC<NodeProps<WorkflowNode>> = memo(({ id, data, selected }) => {
  const outputs = data.outputs || {};
  const hasOutput = Object.keys(outputs).length > 0;

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
          <span className="text-rose-600 dark:text-pink-400 font-semibold">{hasOutput ? `${Object.keys(outputs).length} key(s)` : '0 key'}</span>
        </div>

        {hasOutput ? (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-rose-50/70 dark:bg-slate-950/80 border border-rose-200/80 dark:border-pink-500/30 text-[10px] text-rose-700 dark:text-pink-300 font-mono shadow-xs">
            <span className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-rose-600 dark:text-pink-400" />
              <span>Result Ready</span>
            </span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400">Click to inspect</span>
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
