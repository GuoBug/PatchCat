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
      leftHandleId="inputs"
      rightHandleId="promptText"
      leftHandleLabel="in"
      rightHandleLabel="prompt"
    >
      <div className="space-y-2">
        {/* Template snippet box */}
        <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 font-mono text-[11px] text-slate-300 line-clamp-3 leading-relaxed whitespace-pre-wrap">
          {template ? (
            template
          ) : (
            <span className="text-slate-500 italic">Enter prompt template...</span>
          )}
        </div>

        {/* Extracted Slots Badges */}
        {variables.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] uppercase font-mono text-slate-400 font-semibold flex items-center justify-between">
              <span>Dynamic Slots</span>
              <span className="text-purple-400 font-normal">{variables.length} slot(s)</span>
            </div>
            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
              {variables.map((v, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono text-[10px] truncate max-w-[120px]"
                  title={v.raw}
                >
                  {v.nodeId}.{v.propertyPath}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
});

PromptNode.displayName = 'PromptNode';
