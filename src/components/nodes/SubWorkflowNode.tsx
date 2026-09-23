import React, { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { WorkflowNode } from '../../engine/types.ts';
import { Workflow } from 'lucide-react';

export const SubWorkflowNode: React.FC<NodeProps<WorkflowNode>> = memo(({ id, data, selected }) => {
  const targetWorkflow =
    (data.config?.['targetWorkflowId'] as string) ||
    (data.config?.['workflowId'] as string) ||
    'Select Workflow or Node...';

  return (
    <BaseNode
      id={id}
      type="sub_workflow"
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
        <div className="p-2 rounded-lg bg-indigo-50/50 dark:bg-slate-950 border border-indigo-200/50 dark:border-indigo-500/20 font-mono text-[10px] text-indigo-900 dark:text-indigo-200/90 truncate shadow-xs flex items-center gap-1.5">
          <Workflow className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="truncate">{targetWorkflow}</span>
        </div>
        <div className="text-[9px] text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded px-1.5 py-0.5 font-sans">
          画布委托 / 嵌套子图调度
        </div>
      </div>
    </BaseNode>
  );
});

SubWorkflowNode.displayName = 'SubWorkflowNode';
