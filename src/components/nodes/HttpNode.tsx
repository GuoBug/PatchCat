import React, { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode';
import type { WorkflowNode, HttpNodeConfig, HttpMethod } from '../../engine/types.ts';
import { Lock, Clock } from 'lucide-react';

const methodBadges: Record<HttpMethod, string> = {
  GET: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30',
  POST: 'bg-blue-100 text-blue-800 dark:bg-sky-500/20 dark:text-sky-300 border-blue-300 dark:border-sky-500/30',
  PUT: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border-amber-300 dark:border-amber-500/30',
  PATCH:
    'bg-violet-100 text-violet-800 dark:bg-purple-500/20 dark:text-purple-300 border-violet-300 dark:border-purple-500/30',
  DELETE:
    'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 border-rose-300 dark:border-rose-500/30',
};

export const HttpNode: React.FC<NodeProps<WorkflowNode>> = memo(({ id, data, selected }) => {
  const config = (data.config || {}) as unknown as HttpNodeConfig;
  const method = (config.method || 'GET').toUpperCase() as HttpMethod;
  const url = config.url || 'https://api.example.com/data';
  const authType = config.authType || 'none';
  const timeout = config.timeout || 30000;

  const badgeClass = methodBadges[method] || methodBadges.GET;

  return (
    <BaseNode
      id={id}
      type="http"
      label={data.label}
      status={data.status}
      selected={selected}
      executionResult={data.executionResult}
      hasLeftHandle={true}
      hasRightHandle={true}
      leftHandleLabel="in"
      rightHandleLabel="response"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${badgeClass}`}>
              {method}
            </span>
            {authType !== 'none' && (
              <span className="flex items-center gap-0.5 text-slate-500 dark:text-slate-400">
                <Lock className="w-2.5 h-2.5" />
                <span className="capitalize">{authType}</span>
              </span>
            )}
          </div>
          <span className="flex items-center gap-0.5 text-slate-400 font-mono text-[9px]">
            <Clock className="w-2.5 h-2.5" />
            {timeout / 1000}s
          </span>
        </div>

        <div className="p-2 rounded-lg bg-teal-50/40 dark:bg-slate-950 border border-teal-200/50 dark:border-teal-500/20 font-mono text-[10px] text-teal-900 dark:text-teal-200/90 truncate shadow-xs">
          <span className="text-slate-400 select-none mr-1">URL:</span>
          {url}
        </div>
      </div>
    </BaseNode>
  );
});

HttpNode.displayName = 'HttpNode';
