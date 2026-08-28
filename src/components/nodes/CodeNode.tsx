import React, { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { WorkflowNode } from '../../engine/types.ts';
import { Terminal } from 'lucide-react';

export const CodeNode: React.FC<NodeProps<WorkflowNode>> = memo(({ id, data, selected }) => {
  const runtime = (data.config?.['runtime'] as string) || 'javascript';
  const script = (data.config?.['script'] as string) || (data.config?.['code'] as string) || '// Custom transformation script\nreturn inputs;';

  return (
    <BaseNode
      id={id}
      type="code"
      label={data.label}
      status={data.status}
      selected={selected}
      executionResult={data.executionResult}
      hasLeftHandle={true}
      hasRightHandle={true}
      leftHandleId="inputs"
      rightHandleId="result"
      leftHandleLabel="in"
      rightHandleLabel="result"
    >
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <Terminal className="w-3 h-3 text-amber-400" />
            <span className="uppercase text-amber-300 font-semibold">{runtime}</span>
          </span>
          <span className="text-slate-500">Sandbox</span>
        </div>

        <div className="p-2 rounded bg-slate-950 border border-slate-800 font-mono text-[10px] text-amber-200/90 line-clamp-3 leading-relaxed">
          <code>{script}</code>
        </div>
      </div>
    </BaseNode>
  );
});

CodeNode.displayName = 'CodeNode';
