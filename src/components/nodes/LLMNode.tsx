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
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/15 border border-sky-500/30 text-sky-300 font-semibold truncate">
            <Cpu className="w-3 h-3 shrink-0" />
            <span className="truncate">{model}</span>
          </div>

          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 shrink-0 text-[10px]">
            <Thermometer className="w-3 h-3 text-amber-400" />
            <span>T:{temperature}</span>
          </div>
        </div>

        {/* Live response preview or prompt placeholder */}
        {responseText ? (
          <div className="p-2 rounded bg-slate-950/80 border border-emerald-500/30 font-sans text-[11px] text-slate-200 line-clamp-3 leading-relaxed">
            <span className="text-[10px] text-emerald-400 font-mono block mb-0.5">Response output:</span>
            {responseText}
          </div>
        ) : (
          <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80 font-mono text-[10px] text-slate-500 text-center">
            Awaiting execution...
          </div>
        )}
      </div>
    </BaseNode>
  );
});

LLMNode.displayName = 'LLMNode';
