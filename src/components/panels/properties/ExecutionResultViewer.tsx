import React, { useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Copy,
  Check,
  Clock,
  Coins,
  Brain,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import type { NodeType, NodeStatus, NodeExecutionResult } from '../../../engine/types.ts';
import { useTranslation } from '../../../i18n/useTranslation.ts';

interface ExecutionResultViewerProps {
  type: NodeType;
  status?: NodeStatus;
  outputs: Record<string, unknown>;
  executionResult?: NodeExecutionResult;
}

export const ExecutionResultViewer: React.FC<ExecutionResultViewerProps> = ({
  type,
  status,
  outputs,
  executionResult,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [showReasoning, setShowReasoning] = useState(true);

  const handleCopyText = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getFormattedOutput = (outputData: Record<string, unknown>): string => {
    if (typeof outputData['response'] === 'string') {
      return outputData['response'];
    }
    if (typeof outputData['output'] === 'string') {
      return outputData['output'];
    }
    if (typeof outputData['output'] === 'object' && outputData['output'] !== null) {
      return JSON.stringify(outputData['output'], null, 2);
    }
    if (typeof outputData['result'] === 'string') {
      return outputData['result'];
    }
    if (typeof outputData['result'] === 'object' && outputData['result'] !== null) {
      return JSON.stringify(outputData['result'], null, 2);
    }
    if (typeof outputData['promptText'] === 'string') {
      return outputData['promptText'];
    }
    if (typeof outputData['context'] === 'string') {
      return outputData['context'];
    }
    if (Object.keys(outputData).length > 0) {
      return JSON.stringify(outputData, null, 2);
    }
    return '';
  };

  const outputString = getFormattedOutput(outputs);
  const hasOutputs = Object.keys(outputs).length > 0 && outputString.length > 0;

  return (
    <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800/80">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          {type === 'llm' || type === 'agent' ? (
            <Bot className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          )}
          <span>{t.propertyPanel.finalOutput}</span>
        </label>
        {hasOutputs && (
          <button
            onClick={() => handleCopyText(outputString)}
            className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-xs cursor-pointer"
          >
            {copied ? (
              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span>{copied ? t.common.copied : t.common.copy}</span>
          </button>
        )}
      </div>

      {/* Telemetry metadata badges */}
      {executionResult && (
        <div className="flex items-center gap-2 text-[10px] font-mono">
          {executionResult.latencyMs !== undefined && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-sky-500/10 border border-blue-200 dark:border-sky-500/20 text-blue-700 dark:text-sky-300">
              <Clock className="w-3 h-3" />
              <span>{executionResult.latencyMs}ms</span>
            </span>
          )}
          {executionResult.tokenUsage && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300">
              <Coins className="w-3 h-3" />
              <span>{executionResult.tokenUsage.total} tokens</span>
            </span>
          )}
        </div>
      )}

      {/* Formatted Output Viewer Box */}
      <div className="space-y-2.5">
        {/* Collapsible Reasoning Block (DeepSeek R1 / Thinking models) */}
        {typeof outputs['reasoning'] === 'string' && outputs['reasoning'].length > 0 && (
          <div className="rounded-xl bg-violet-50/70 dark:bg-purple-950/20 border border-violet-200 dark:border-purple-500/30 overflow-hidden shadow-xs">
            <button
              onClick={() => setShowReasoning(!showReasoning)}
              className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-violet-700 dark:text-purple-300 hover:bg-violet-100/50 dark:hover:bg-purple-900/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-violet-600 dark:text-purple-400" />
                <span>{t.propertyPanel.reasoningThought}</span>
              </div>
              {showReasoning ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
            {showReasoning && (
              <div className="p-3 text-[11px] font-mono text-violet-900 dark:text-purple-200/90 whitespace-pre-wrap leading-relaxed border-t border-violet-200/60 dark:border-purple-500/20 max-h-48 overflow-y-auto bg-white/40 dark:bg-black/20">
                {outputs['reasoning']}
                {status === 'running' && (
                  <span className="animate-pulse font-bold text-violet-600 dark:text-purple-400">
                    {' '}
                    ▌
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Standard Response Content Box */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-xs">
          {hasOutputs ? (
            <>
              {outputString}
              {status === 'running' && (
                <span className="animate-pulse font-bold text-blue-500"> ▌</span>
              )}
            </>
          ) : status === 'running' ? (
            <div className="flex items-center justify-center gap-2 py-4 text-blue-600 dark:text-sky-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t.propertyPanel.liveStreaming}...</span>
            </div>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 italic text-center block py-2">
              {t.propertyPanel.noNodeSelectedDesc}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
