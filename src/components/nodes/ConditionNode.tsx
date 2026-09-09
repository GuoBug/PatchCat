import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { WorkflowNode, ConditionNodeConfig, ConditionRule } from '../../engine/types.ts';
import { GitBranch, CornerDownRight } from 'lucide-react';

export const ConditionNode: React.FC<NodeProps<WorkflowNode>> = memo(({ id, data, selected }) => {
  const config = (data.config || {}) as unknown as ConditionNodeConfig;
  const conditions: ConditionRule[] = config.conditions || [
    { id: 'rule_1', variable: '', operator: 'equals', value: '', targetHandle: 'if_true' },
  ];
  const defaultBranch = config.defaultBranch || 'else';

  // Build list of all branch targets: each condition's targetHandle + defaultBranch
  const branches = [
    ...conditions.map((c, i) => ({
      id: c.targetHandle || `branch_${i + 1}`,
      label: c.targetHandle || `IF (#${i + 1})`,
      rule: `${c.variable || 'var'} ${c.operator} "${c.value}"`,
    })),
    {
      id: defaultBranch,
      label: defaultBranch.toUpperCase(),
      rule: 'Fallback / Default',
    },
  ];

  return (
    <BaseNode
      id={id}
      type="condition"
      label={data.label}
      status={data.status}
      selected={selected}
      executionResult={data.executionResult}
      hasLeftHandle={true}
      hasRightHandle={false} // Custom dynamic right handles for each branch
      leftHandleLabel="in"
    >
      <div className="space-y-2 relative">
        <div className="flex items-center justify-between text-[10px] font-mono text-amber-700 dark:text-amber-300">
          <span className="flex items-center gap-1 font-semibold">
            <GitBranch className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>{conditions.length} RULE{conditions.length > 1 ? 'S' : ''}</span>
          </span>
          <span className="text-slate-400 dark:text-slate-500 font-sans">
            {branches.length} Branches
          </span>
        </div>

        {/* Branch handles list rendered inside card */}
        <div className="space-y-1.5 pt-1">
          {branches.map((branch, idx) => {
            const total = branches.length;
            const topPct = total === 1 ? 50 : Math.round(30 + (idx / (total - 1)) * 50);

            return (
              <div
                key={branch.id}
                className="relative flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-amber-50/40 dark:bg-slate-950 border border-amber-200/50 dark:border-amber-500/20 text-[11px]"
              >
                <div className="flex items-center gap-1.5 min-w-0 pr-4">
                  <CornerDownRight className="w-3 h-3 text-amber-500 shrink-0" />
                  <span className="font-mono font-bold text-amber-800 dark:text-amber-300 truncate">
                    {branch.label}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                    ({branch.rule})
                  </span>
                </div>

                <Handle
                  id={branch.id}
                  type="source"
                  position={Position.Right}
                  style={{ top: `${topPct}%` }}
                  className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white dark:!border-slate-900 hover:!bg-amber-600 !-right-[18px] transition-all cursor-crosshair shadow-sm"
                />
              </div>
            );
          })}
        </div>
      </div>
    </BaseNode>
  );
});

ConditionNode.displayName = 'ConditionNode';
