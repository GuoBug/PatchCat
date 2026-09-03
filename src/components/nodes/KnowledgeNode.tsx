import React, { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { WorkflowNode } from '../../engine/types.ts';
import { Database, Search } from 'lucide-react';

export const KnowledgeNode: React.FC<NodeProps<WorkflowNode>> = memo(({ id, data, selected }) => {
  const kbId = (data.config?.['knowledgeBaseId'] as string) || '';
  const kbName = (data.config?.['knowledgeBaseName'] as string) || (kbId ? `KB: ${kbId.slice(0, 8)}...` : 'Default Knowledge Base');
  const query = (data.inputs?.['query'] as string) || (data.config?.['query'] as string) || '{{input_1.query}}';
  const topK = typeof data.config?.['topK'] === 'number' ? (data.config['topK'] as number) : 3;

  return (
    <BaseNode
      id={id}
      type="knowledge"
      label={data.label}
      status={data.status}
      selected={selected}
      executionResult={data.executionResult}
      hasLeftHandle={true}
      hasRightHandle={true}
      leftHandleLabel="in"
      rightHandleLabel="context"
    >
      <div className="space-y-2">
        {/* Target KB indicator */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 text-cyan-800 dark:text-cyan-300 text-[11px] font-medium truncate">
          <Database className="w-3.5 h-3.5 shrink-0 text-cyan-600 dark:text-cyan-400" />
          <span className="truncate">{kbName}</span>
        </div>

        {/* Query & Top-K badge */}
        <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1 truncate max-w-[150px]" title={query}>
            <Search className="w-3 h-3 shrink-0 text-slate-400" />
            <span className="truncate text-slate-700 dark:text-slate-300">{query}</span>
          </div>
          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
            Top-{topK}
          </span>
        </div>
      </div>
    </BaseNode>
  );
});

KnowledgeNode.displayName = 'KnowledgeNode';
