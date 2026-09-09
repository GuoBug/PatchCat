import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Trash2,
  Download,
  Bot,
  User,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  AlertCircle,
  Loader2,
  CheckCircle2,
  MinusCircle,
  Sparkles,
} from 'lucide-react';
import { useWorkflowStore } from '../../stores/workflow-store.ts';
import { BrowserWorkflowEngine } from '../../engine/browser-engine.ts';
import { useTranslation } from '../../i18n/useTranslation.ts';
import { nanoid } from 'nanoid';

export interface ChatNodeTrace {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  status: 'running' | 'success' | 'error' | 'skipped';
  durationMs?: number;
  output?: unknown;
}

export interface ChatMessageItem {
  id: string;
  timestamp: number;
  role: 'user' | 'assistant';
  content: string;
  rawInputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  tokenUsage?: { prompt: number; completion: number; total: number };
  durationMs?: number;
  error?: string;
  trace?: ChatNodeTrace[];
}

interface ChatDebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatDebugPanel: React.FC<ChatDebugPanelProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);

  const [messages, setMessages] = useState<ChatMessageItem[]>(() => {
    try {
      const saved = sessionStorage.getItem('patchcat_chat_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [inputQuery, setInputQuery] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [activeStreamingText, setActiveStreamingText] = useState('');
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<BrowserWorkflowEngine>(new BrowserWorkflowEngine());

  // Save to session storage
  useEffect(() => {
    try {
      sessionStorage.setItem('patchcat_chat_history', JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  // Scroll to bottom on new message or streaming text
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeStreamingText]);

  // Find input fields from graph Input nodes
  const inputNodes = nodes.filter((n) => n.data.type === 'input' || n.type === 'input');

  const handleClearHistory = () => {
    setMessages([]);
    sessionStorage.removeItem('patchcat_chat_history');
  };

  const handleExportHistory = (format: 'json' | 'markdown') => {
    if (messages.length === 0) return;
    let text = '';
    let filename = `chat-history-${new Date().toISOString().slice(0, 10)}`;

    if (format === 'json') {
      text = JSON.stringify(messages, null, 2);
      filename += '.json';
    } else {
      filename += '.md';
      text = messages
        .map((m) => {
          const sender = m.role === 'user' ? '### 👤 User' : '### 🤖 Assistant';
          const meta = m.durationMs ? ` *(Duration: ${m.durationMs}ms)*` : '';
          return `${sender}${meta}\n\n${m.content}\n`;
        })
        .join('\n---\n\n');
    }

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendMessage = async () => {
    const query = inputQuery.trim();
    if (!query || isRunning) return;

    setInputQuery('');
    const userMsgId = nanoid();
    const assistantMsgId = nanoid();

    // 1. Append User Message
    const userMsg: ChatMessageItem = {
      id: userMsgId,
      timestamp: Date.now(),
      role: 'user',
      content: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsRunning(true);
    setActiveStreamingText('');

    // Prepare inputs bag
    const inputsBag: Record<string, unknown> = {
      query,
      user_query: query,
      input: query,
    };

    // If input node defines default values or keys, populate
    inputNodes.forEach((node) => {
      const defaultVals = (node.data.config?.['defaultValues'] || {}) as Record<string, unknown>;
      Object.entries(defaultVals).forEach(([k, v]) => {
        if (!inputsBag[k]) inputsBag[k] = v;
      });
      // also set first input parameter key if any
      const inputKeys = Object.keys(node.data.inputs || {});
      const firstKey = inputKeys[0];
      if (firstKey && !inputsBag[firstKey]) {
        inputsBag[firstKey] = query;
      }
    });

    const traces: Map<string, ChatNodeTrace> = new Map();
    nodes.forEach((n) => {
      traces.set(n.id, {
        nodeId: n.id,
        nodeLabel: n.data.label || n.id,
        nodeType: n.data.type || n.type || 'unknown',
        status: 'running',
      });
    });

    let assistantContent = '';
    let finalOutputs: Record<string, unknown> = {};
    let errorMsg: string | undefined = undefined;
    const startTime = Date.now();

    try {
      const graphInput = { nodes, edges };
      const eventGen = engineRef.current.executeWorkflow(graphInput, {
        inputs: inputsBag,
      });

      for await (const event of eventGen) {
        if (event.type === 'NODE_CHUNK') {
          setActiveStreamingText(event.payload.fullContent);
          assistantContent = event.payload.fullContent;
        } else if (event.type === 'NODE_COMPLETE') {
          const tr = traces.get(event.payload.nodeId);
          if (tr) {
            tr.status = 'success';
            tr.durationMs = event.payload.durationMs;
            tr.output = event.payload.output;
          }
          // If this is an output node or llm node, capture content
          const n = nodes.find((item) => item.id === event.payload.nodeId);
          if (n?.data.type === 'output' || n?.type === 'output') {
            const outBag = event.payload.output;
            const finalVal = outBag['finalResult'] ?? outBag['output'] ?? outBag;
            if (typeof finalVal === 'string') {
              assistantContent = finalVal;
            } else if (typeof finalVal === 'object' && finalVal !== null) {
              assistantContent = (finalVal as Record<string, unknown>)['response'] as string || JSON.stringify(finalVal, null, 2);
            }
          }
        } else if (event.type === 'NODE_SKIPPED') {
          const tr = traces.get(event.payload.nodeId);
          if (tr) {
            tr.status = 'skipped';
          }
        } else if (event.type === 'NODE_ERROR') {
          const tr = traces.get(event.payload.nodeId);
          if (tr) {
            tr.status = 'error';
            tr.durationMs = event.payload.durationMs;
          }
        } else if (event.type === 'WORKFLOW_COMPLETE') {
          finalOutputs = event.payload.outputs;
        } else if (event.type === 'WORKFLOW_ERROR') {
          errorMsg = event.payload.error;
        }
      }
    } catch (err: unknown) {
      errorMsg = err instanceof Error ? err.message : String(err);
    } finally {
      setIsRunning(false);
      setActiveStreamingText('');

      const totalDurationMs = Date.now() - startTime;
      const assistantMsg: ChatMessageItem = {
        id: assistantMsgId,
        timestamp: Date.now(),
        role: 'assistant',
        content: assistantContent || (errorMsg ? `Workflow Execution Error: ${errorMsg}` : t.chatDebug.emptyResponse),
        outputs: finalOutputs,
        durationMs: totalDurationMs,
        error: errorMsg,
        trace: Array.from(traces.values()),
        tokenUsage: {
          prompt: Math.round(query.length / 4),
          completion: Math.round((assistantContent.length || 10) / 4),
          total: Math.round((query.length + assistantContent.length) / 4),
        },
      };

      setMessages((prev) => [...prev, assistantMsg]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSendMessage();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="fixed top-12 right-0 bottom-7 w-96 md:w-[420px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl z-40 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-sky-500/10 dark:text-sky-400 border border-blue-200 dark:border-sky-500/30">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <span>{t.chatDebug.title}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                Ctrl+Shift+D
              </span>
            </h3>
            <span className="text-[10px] text-slate-400 block">
              {t.chatDebug.subtitle}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => handleExportHistory('markdown')}
                className="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={t.chatDebug.exportHistory}
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleClearHistory}
                className="p-1.5 rounded text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={t.chatDebug.clearHistory}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={t.chatDebug.closePanel}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-xs">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-slate-800/60 border border-blue-100 dark:border-slate-700 flex items-center justify-center mb-3 text-blue-500">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {t.chatDebug.emptyTitle}
            </p>
            <p className="text-[11px] max-w-[260px] leading-relaxed">
              {t.chatDebug.emptyDesc}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col space-y-1.5 ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 px-1">
              {msg.role === 'user' ? (
                <>
                  <span>{t.chatDebug.userRole}</span>
                  <User className="w-3 h-3 text-emerald-500" />
                </>
              ) : (
                <>
                  <Bot className="w-3 h-3 text-blue-500" />
                  <span>{t.chatDebug.assistantRole}</span>
                  {msg.durationMs && (
                    <span className="flex items-center gap-0.5 ml-1 text-slate-400">
                      <Clock className="w-2.5 h-2.5" />
                      {msg.durationMs}ms
                    </span>
                  )}
                  {msg.tokenUsage && (
                    <span className="flex items-center gap-0.5 ml-1 px-1 rounded bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                      <Coins className="w-2.5 h-2.5" />
                      {msg.tokenUsage.total} tok
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Bubble */}
            <div
              className={`p-3 rounded-2xl max-w-[90%] text-xs leading-relaxed whitespace-pre-wrap shadow-xs ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-xs'
                  : msg.error
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-500/30 rounded-tl-xs'
                  : 'bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700/60 rounded-tl-xs'
              }`}
            >
              {msg.content}
            </div>

            {/* Collapsible Execution Trace (Assistant Only) */}
            {msg.role === 'assistant' && msg.trace && msg.trace.length > 0 && (
              <div className="w-full max-w-[95%] mt-1">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedTraceId(expandedTraceId === msg.id ? null : msg.id)
                  }
                  className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-mono py-1 px-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {expandedTraceId === msg.id ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                  <span>{t.chatDebug.executionTrace} ({msg.trace.length} {t.chatDebug.nodesUnit})</span>
                </button>

                {expandedTraceId === msg.id && (
                  <div className="p-2 mt-1 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 font-mono text-[10px]">
                    {msg.trace.map((tr) => (
                      <div
                        key={tr.nodeId}
                        className="flex items-center justify-between p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          {tr.status === 'success' && (
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          )}
                          {tr.status === 'error' && (
                            <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                          )}
                          {tr.status === 'skipped' && (
                            <MinusCircle className="w-3 h-3 text-slate-400 shrink-0" />
                          )}
                          {tr.status === 'running' && (
                            <Loader2 className="w-3 h-3 text-blue-500 animate-spin shrink-0" />
                          )}
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {tr.nodeLabel}
                          </span>
                          <span className="text-[9px] text-slate-400 uppercase">
                            ({tr.nodeType})
                          </span>
                        </div>
                        <span className="text-slate-400 shrink-0 ml-2">
                          {tr.status === 'skipped' ? 'skipped' : `${tr.durationMs ?? 0}ms`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Live Streaming Bubble */}
        {isRunning && (
          <div className="flex flex-col space-y-1.5 items-start">
            <div className="flex items-center gap-1 text-[10px] font-mono text-blue-500 px-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{t.chatDebug.streamingResponse}</span>
            </div>
            <div className="p-3 rounded-2xl rounded-tl-xs bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 border border-blue-300 dark:border-sky-500/40 max-w-[90%] text-xs leading-relaxed whitespace-pre-wrap">
              {activeStreamingText || <span className="text-slate-400 italic">{t.chatDebug.thinking}</span>}
              <span className="animate-pulse font-bold text-blue-500"> ▌</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Bar */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 focus-within:border-blue-500 bg-slate-50 dark:bg-slate-900 transition-colors p-2 flex flex-col gap-2">
          <textarea
            rows={3}
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isRunning}
            placeholder={t.chatDebug.inputPlaceholder}
            className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-100 focus:outline-none resize-none leading-relaxed"
          />

          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800 text-[10px] text-slate-400">
            <span>
              Press <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono">Enter</kbd> to run
            </span>
            <button
              type="button"
              onClick={handleSendMessage}
              disabled={!inputQuery.trim() || isRunning}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium transition-all shadow-xs cursor-pointer"
            >
              {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              <span>{t.chatDebug.send}</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
