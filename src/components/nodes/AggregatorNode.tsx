import React, { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { WorkflowNode, AggregatorNodeConfig } from '../../engine/types.ts';
import { GitMerge, Layers, Zap } from 'lucide-react';

export const AggregatorNode: React.FC<NodeProps<WorkflowNode>> = memo(({ id, data, selected }) => {
  const config = (data.config || {}) as unknown as AggregatorNodeConfig;
  const mode = config.mode || 'first_available';
  const outputKey = config.outputKey || 'result';

  const modeDescriptions: Record<string, { label: string; icon: React.ReactNode; desc: string }> = {
    first_available: {
      label: 'First Available',
      icon: <Zap className="w-3 h-3 text-amber-500" />,
      desc: 'Takes the first non-skipped branch output',
    },
    merge_all: {
      label: 'Merge All',
      icon: <Layers className="w-3 h-3 text-purple-500" />,
      desc: 'Combines all active outputs into an object',
    },
    wait_all: {
      label: 'Wait All',
      icon: <GitMerge className="w-3 h-3 text-violet-500" />,
      desc: 'Waits for all branches (null for skipped)',
    },
  };

  const modeInfo = modeDescriptions[mode] || modeDescriptions['first_available']!;

  return (
    <BaseNode
      id={id}
      type="aggregator"
      label={data.label}
      status={data.status}
      selected={selected}
      executionResult={data.executionResult}
      hasLeftHandle={true}
      hasRightHandle={true}
      leftHandleLabel="in (all)"
      rightHandleLabel={outputKey}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono text-purple-700 dark:text-purple-300">
          <span className="flex items-center gap-1 font-semibold">
            {modeInfo.icon}
            <span className="uppercase">{modeInfo.label}</span>
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            key: {outputKey}
          </span>
        </div>

        <div className="p-2 rounded-lg bg-purple-50/40 dark:bg-slate-950 border border-purple-200/50 dark:border-purple-500/20 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
          {modeInfo.desc}
        </div>
      </div>
    </BaseNode>
  );
});

AggregatorNode.displayName = 'AggregatorNode';
