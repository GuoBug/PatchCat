import React, { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { BaseNode } from './BaseNode.tsx';
import type { WorkflowNode, MemoryNodeConfig, MemoryNodeOutput } from '../../engine/types.ts';
import { Bookmark, MessageSquare, Sparkles } from 'lucide-react';

export const MemoryNode: React.FC<NodeProps<WorkflowNode>> = memo(({ id, data, selected }) => {
  const config = (data.config || {}) as Partial<MemoryNodeConfig>;
  const outputs = (data.outputs || {}) as Partial<MemoryNodeOutput>;
  const meta = outputs.meta;

  const include = {
    summary: config.include?.summary ?? true,
    recentWindow: config.include?.recentWindow ?? true,
    pinned: config.include?.pinned ?? true,
  };
  const recentRounds = config.recentRounds ?? 5;
  const format = config.format ?? 'text';

  const sessionStatus = meta?.session_status;

  return (
    <BaseNode
      id={id}
      type="memory"
      label={data.label || 'Conversation Memory'}
      status={data.status}
      selected={selected}
      executionResult={data.executionResult}
      hasLeftHandle={false}
      hasRightHandle={true}
      rightHandleLabel="memory"
    >
      <div className="space-y-2">
        {/* Session Status Pill */}
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase">
            Session Context
          </span>
          {sessionStatus === 'active' && meta && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 font-medium">
              {meta.rounds} rnd(s) · {meta.tokens} tok
            </span>
          )}
          {sessionStatus === 'empty' && (
            <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20 font-medium">
              Empty
            </span>
          )}
          {sessionStatus === 'no_session' && (
            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-medium">
              No Session
            </span>
          )}
          {!sessionStatus && (
            <span className="text-indigo-600 dark:text-indigo-400 font-normal">
              {format.toUpperCase()}
            </span>
          )}
        </div>

        {/* Enabled Channels */}
        <div className="space-y-1">
          {include.recentWindow && (
            <div className="px-2 py-1 rounded bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-500/20 flex items-center justify-between text-[11px] text-indigo-700 dark:text-indigo-300 font-mono">
              <span className="flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3 text-indigo-500" />
                <span>Recent Window</span>
              </span>
              <span className="text-[9px] text-indigo-500 font-medium">
                {recentRounds} round(s)
              </span>
            </div>
          )}

          {include.summary && (
            <div className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Rolling Summary</span>
              </span>
              <span className="text-[9px] text-slate-400 font-medium">
                chat_summary
              </span>
            </div>
          )}

          {include.pinned && (
            <div className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <Bookmark className="w-3 h-3 text-violet-500" />
                <span>Pinned Items</span>
              </span>
              <span className="text-[9px] text-slate-400 font-medium">
                isPinned
              </span>
            </div>
          )}

          {!include.recentWindow && !include.summary && !include.pinned && (
            <div className="p-2 rounded bg-amber-50/60 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 italic text-center text-[10px] border border-amber-200 dark:border-amber-800/40">
              All memory sources disabled
            </div>
          )}
        </div>

        {/* Truncated flag alert */}
        {meta?.truncated && (
          <div className="text-[9px] font-mono text-amber-500 dark:text-amber-400 text-center py-0.5">
            ⚠️ Content truncated by budget limit
          </div>
        )}
      </div>
    </BaseNode>
  );
});
