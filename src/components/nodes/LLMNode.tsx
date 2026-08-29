import React, { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { WorkflowNode } from '../../engine/types.ts';
import { Cpu, Thermometer } from 'lucide-react';

export const LLMNode: React.FC<NodeProps<WorkflowNode>> = memo(({ id, data, selected }) => {
  const model = (data.config?.['model'] as string) || 'gpt-4o-mini';
  const temperature = typeof data.config?.['temperature'] === 'number' ? data.config['temperature'] : 0.7;
  const outputs = data.outputs || {};
  const responseText = (outputs['response'] as string) || '';

  return (
    <BaseNode
      id={id}
      type="llm"
      label={data.label}
      status={data.status}
      selected={selected}
      executionResult={data.executionResult}
      hasLeftHandle={true}
      hasRightHandle={true}
      leftHandleLabel="prompt"
      rightHandleLabel="response"
    >
      <div className="space-y-2">
        {/* Model info tags */}
        <div className="flex items-center justify-between gap-1.5 text-[11px] font-mono">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-sky-500/15 border border-blue-200 dark:border-sky-500/30 text-blue-700 dark:text-sky-300 font-semibold truncate shadow-xs">
            <Cpu className="w-3 h-3 shrink-0" />
            <span className="truncate">{model}</span>
          </div>

          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shrink-0 text-[10px]">
            <Thermometer className="w-3 h-3 text-amber-500 dark:text-amber-400" />
            <span>T:{temperature}</span>
          </div>
        </div>

        {/* Live response preview or prompt placeholder */}
        {responseText ? (
          <div className="p-2 rounded-lg bg-blue-50/50 dark:bg-slate-950/80 border border-blue-100 dark:border-emerald-500/30 font-sans text-[11px] text-blue-900 dark:text-slate-200 line-clamp-3 leading-relaxed shadow-xs">
            <span className="text-[10px] text-blue-600 dark:text-emerald-400 font-mono block mb-0.5 font-semibold">Response output:</span>
            {responseText}
          </div>
        ) : (
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 font-mono text-[10px] text-slate-400 dark:text-slate-500 text-center">
            Awaiting execution...
          </div>
        )}
      </div>
    </BaseNode>
  );
});

LLMNode.displayName = 'LLMNode';
