import React, { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { WorkflowNode } from '../../engine/types.ts';
import { ListTree, Zap } from 'lucide-react';

export const LoopNode: React.FC<NodeProps<WorkflowNode>> = memo(({ id, data, selected }) => {
  const loopVar = (data.config?.['loopVariable'] as string) || 'items';
  const concurrency = (data.config?.['concurrency'] as number) || 1;

  return (
    <BaseNode
      id={id}
      type="loop"
      label={data.label}
      status={data.status}
      selected={selected}
      executionResult={data.executionResult}
      hasLeftHandle={true}
      hasRightHandle={true}
      leftHandleLabel="in"
      rightHandleLabel="out"
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold shadow-xs">
            <ListTree className="w-3 h-3 shrink-0" />
            <span>var: {loopVar}</span>
          </div>

          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-xs">
            <Zap className="w-3 h-3 text-amber-500" />
            <span>x{concurrency}</span>
          </div>
        </div>
      </div>
    </BaseNode>
  );
});

LoopNode.displayName = 'LoopNode';
