import React, { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { WorkflowNode } from '../../engine/types.ts';
import { Wrench, Repeat2, Cpu } from 'lucide-react';

export const AgentNode: React.FC<NodeProps<WorkflowNode>> = memo(({ id, data, selected }) => {
  const model = (data.config?.['model'] as string) || 'gpt-4o';
  const tools = (data.config?.['tools'] as unknown[]) || [];
  const maxIterations = (data.config?.['maxIterations'] as number) || 10;
  
  const isRunning = data.status === 'running';

  return (
    <BaseNode
      id={id}
      type="agent"
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
        {/* Badges container */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-50 dark:bg-violet-500/15 border border-violet-200 dark:border-violet-500/30 text-violet-700 dark:text-violet-300 font-semibold shadow-xs">
            <Wrench className="w-3 h-3 shrink-0" />
            <span>{tools.length} Tools</span>
          </div>

          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-slate-700 dark:text-slate-300 shadow-xs ${
            isRunning 
              ? 'bg-blue-50 dark:bg-sky-500/20 border-blue-300 dark:border-sky-500/40 text-blue-700 dark:text-sky-300 animate-pulse' 
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
          }`}>
            <Repeat2 className={`w-3 h-3 ${isRunning ? 'animate-spin' : ''}`} />
            <span>Max {maxIterations}</span>
          </div>
        </div>

        {model && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 font-mono text-[10px] text-slate-500 dark:text-slate-400 w-fit">
            <Cpu className="w-3 h-3" />
            <span>{model}</span>
          </div>
        )}
      </div>
    </BaseNode>
  );
});

AgentNode.displayName = 'AgentNode';
