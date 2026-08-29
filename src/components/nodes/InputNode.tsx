import React, { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { WorkflowNode } from '../../engine/types.ts';

export const InputNode: React.FC<NodeProps<WorkflowNode>> = memo(({ id, data, selected }) => {
  const inputs = data.inputs || {};
  const inputEntries = Object.entries(inputs);
  const visibleEntries = inputEntries.slice(0, 3);
  const remainingCount = inputEntries.length - visibleEntries.length;

  return (
    <BaseNode
      id={id}
      type="input"
      label={data.label}
      status={data.status}
      selected={selected}
      executionResult={data.executionResult}
      hasLeftHandle={false}
      hasRightHandle={true}
      rightHandleLabel="output"
    >
      <div className="space-y-1.5">
        <div className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 font-semibold flex items-center justify-between">
          <span>Parameters</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-normal">{inputEntries.length} field(s)</span>
        </div>

        {inputEntries.length === 0 ? (
          <div className="p-2 rounded bg-slate-50 dark:bg-slate-950/60 text-slate-400 dark:text-slate-500 italic text-center text-[11px] border border-slate-100 dark:border-slate-800">
            No default inputs configured
          </div>
        ) : (
          <div className="space-y-1">
            {visibleEntries.map(([key]) => (
              <div
                key={key}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-50/70 dark:bg-slate-950/80 border border-emerald-200/80 dark:border-emerald-500/20 font-mono text-[11px] text-emerald-800 dark:text-emerald-400 flex items-center justify-between shadow-xs"
              >
                <span className="font-semibold truncate">{key}</span>
                <span className="text-[9px] text-emerald-600/70 dark:text-emerald-500/60 font-mono uppercase">param</span>
              </div>
            ))}

            {remainingCount > 0 && (
              <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 text-center py-0.5">
                +{remainingCount} more parameter(s)
              </div>
            )}
          </div>
        )}
      </div>
    </BaseNode>
  );
});

InputNode.displayName = 'InputNode';
