import React, { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { WorkflowNode } from '../../engine/types.ts';
import { extractVariableReferences } from '../../engine/variable-resolver.ts';

export const PromptNode: React.FC<NodeProps<WorkflowNode>> = memo(({ id, data, selected }) => {
  const template = (data.inputs?.['template'] as string) || (data.config?.['template'] as string) || '';
  const variables = extractVariableReferences(template);

  return (
    <BaseNode
      id={id}
      type="prompt"
      label={data.label}
      status={data.status}
      selected={selected}
      executionResult={data.executionResult}
      hasLeftHandle={true}
      hasRightHandle={true}
      leftHandleLabel="in"
      rightHandleLabel="prompt"
    >
      <div className="space-y-1.5">
        {/* Extracted Slots Badges (Single Row Only) */}
        <div className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 font-semibold flex items-center justify-between">
          <span>Template Slots</span>
          <span className="text-violet-600 dark:text-purple-400 font-normal">{variables.length} slot(s)</span>
        </div>

        {variables.length === 0 ? (
          <div className="p-2 rounded bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 font-mono text-[10px] text-slate-400 dark:text-slate-500 text-center italic">
            No dynamic slots
          </div>
        ) : (
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5" style={{ scrollbarWidth: 'none' }}>
            {variables.map((v, i) => (
              <span
                key={i}
                className="shrink-0 px-2 py-1 rounded-lg bg-violet-50 dark:bg-purple-500/15 border border-violet-200 dark:border-purple-500/30 text-violet-800 dark:text-purple-300 font-mono text-[10px] truncate max-w-[160px] shadow-xs"
                title={v.raw}
              >
                {v.nodeId}.{v.propertyPath}
              </span>
            ))}
          </div>
        )}
      </div>
    </BaseNode>
  );
});

PromptNode.displayName = 'PromptNode';
