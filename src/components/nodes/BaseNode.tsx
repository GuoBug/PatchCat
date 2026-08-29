import React, { memo, ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import { 
  PlayCircle, 
  FileText, 
  Bot, 
  Code2, 
  CheckCircle2, 
  Clock, 
  Coins, 
  AlertTriangle,
  Loader2,
  Check
} from 'lucide-react';
import type { NodeType, NodeStatus, NodeExecutionResult } from '../../engine/types.ts';

export interface BaseNodeProps {
  id: string;
  type: NodeType;
  label: string;
  status?: NodeStatus;
  selected?: boolean;
  executionResult?: NodeExecutionResult;
  hasLeftHandle?: boolean;
  hasRightHandle?: boolean;
  leftHandleLabel?: string;
  rightHandleLabel?: string;
  children?: ReactNode;
}

const typeConfig: Record<NodeType, { icon: React.ComponentType<{ className?: string }>; color: string; handleColor: string; badge: string }> = {
  input: {
    icon: PlayCircle,
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30',
    handleColor: '#10B981',
    badge: 'INPUT',
  },
  prompt: {
    icon: FileText,
    color: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30',
    handleColor: '#8B5CF6',
    badge: 'PROMPT',
  },
  llm: {
    icon: Bot,
    color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/30',
    handleColor: '#3B82F6',
    badge: 'LLM',
  },
  code: {
    icon: Code2,
    color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30',
    handleColor: '#F59E0B',
    badge: 'CODE',
  },
  output: {
    icon: CheckCircle2,
    color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-500/30',
    handleColor: '#F43F5E',
    badge: 'OUTPUT',
  },
};

const statusStyles: Record<NodeStatus, { border: string; badge: string; icon: ReactNode }> = {
  idle: {
    border: 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700',
    badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    icon: null,
  },
  queued: {
    border: 'border-amber-400 dark:border-amber-500/50 border-dashed bg-amber-50/20 dark:bg-slate-900/90',
    badge: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30',
    icon: <Clock className="w-3 h-3 animate-spin" />,
  },
  running: {
    border: 'border-blue-500 shadow-md shadow-blue-500/20 ring-1 ring-blue-500 animate-pulse',
    badge: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/40 animate-pulse',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  success: {
    border: 'border-emerald-500/80 shadow-sm shadow-emerald-500/10',
    badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30',
    icon: <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />,
  },
  error: {
    border: 'border-rose-500 bg-rose-50/20 dark:bg-slate-900/95 shadow-md shadow-rose-500/20 ring-1 ring-rose-500',
    badge: 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30',
    icon: <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />,
  },
};

export const BaseNode: React.FC<BaseNodeProps> = memo(({
  id,
  type,
  label,
  status = 'idle',
  selected = false,
  executionResult,
  hasLeftHandle = true,
  hasRightHandle = true,
  leftHandleLabel,
  rightHandleLabel,
  children,
}) => {
  const currentType = typeConfig[type] || typeConfig.llm;
  const IconComponent = currentType.icon;
  const currentStatus = statusStyles[status] || statusStyles.idle;

  return (
    <div
      className={`relative w-[280px] rounded-xl bg-white dark:bg-slate-900/95 backdrop-blur-md transition-all duration-200 border text-slate-900 dark:text-slate-200 font-sans shadow-sm dark:shadow-xl ${
        currentStatus.border
      } ${selected ? 'ring-2 ring-blue-500/40 border-blue-500 shadow-md' : ''}`}
    >
      {/* Left Input Handle */}
      {hasLeftHandle && (
        <Handle
          type="target"
          position={Position.Left}
          style={{ borderColor: currentType.handleColor }}
          className="!w-3.5 !h-3.5 !bg-white dark:!bg-slate-800 !border-2 hover:!bg-blue-500 hover:!border-white !-left-[8px] transition-all cursor-crosshair shadow-sm"
        />
      )}
      {leftHandleLabel && (
        <span className="absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full text-[10px] font-mono text-slate-400 dark:text-slate-500 select-none pr-1">
          {leftHandleLabel}
        </span>
      )}

      {/* Right Output Handle */}
      {hasRightHandle && (
        <Handle
          type="source"
          position={Position.Right}
          style={{ borderColor: currentType.handleColor }}
          className="!w-3.5 !h-3.5 !bg-white dark:!bg-slate-800 !border-2 hover:!bg-blue-500 hover:!border-white !-right-[8px] transition-all cursor-crosshair shadow-sm"
        />
      )}
      {rightHandleLabel && (
        <span className="absolute -right-2 top-1/2 -translate-y-1/2 translate-x-full text-[10px] font-mono text-slate-400 dark:text-slate-500 select-none pl-1">
          {rightHandleLabel}
        </span>
      )}

      {/* Node Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/40 rounded-t-xl">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-lg border ${currentType.color}`}>
            <IconComponent className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate tracking-wide">
              {label}
            </h4>
            <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 block uppercase tracking-wider">
              {id}
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${currentStatus.badge}`}>
          {currentStatus.icon}
          <span className="capitalize">{status}</span>
        </div>
      </div>

      {/* Node Content Body */}
      <div className="p-3 text-xs text-slate-700 dark:text-slate-300 space-y-2">
        {children}
      </div>

      {/* Node Telemetry Footer (Latency & Tokens) */}
      {executionResult && (
        <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-950/60 rounded-b-xl flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
          {executionResult.latencyMs !== undefined ? (
            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <Clock className="w-3 h-3 text-blue-500 dark:text-sky-400" />
              <span>{executionResult.latencyMs}ms</span>
            </div>
          ) : <div />}

          {executionResult.tokenUsage ? (
            <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
              <Coins className="w-3 h-3 text-amber-500 dark:text-amber-400" />
              <span>{executionResult.tokenUsage.total} tok</span>
            </div>
          ) : null}

          {executionResult.error && (
            <span className="text-rose-600 dark:text-rose-400 truncate max-w-[150px]" title={executionResult.error}>
              {executionResult.error}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

BaseNode.displayName = 'BaseNode';
