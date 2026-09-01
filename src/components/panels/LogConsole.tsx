/**
 * @file    src/components/panels/LogConsole.tsx
 * @version 1.0.0
 * @description
 *   Modern visual log console drawer for real-time workflow telemetry inspection:
 *   - 3 configurable log levels: 'summary' | 'detailed' | 'dev'
 *   - Type filters (all / system / request / node / error) and keyword search
 *   - Expandable JSON payloads for dev-level inspection (with strict secret masking)
 *   - Exporting (JSON / TXT), clearing, auto-scrolling, and height resizing
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Terminal,
  X,
  Trash2,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  ShieldCheck,
  Clock,
  Cpu,
  Radio,
  AlertCircle,
  Code,
  Layers,
  ArrowDownToLine,
} from 'lucide-react';
import { useLogStore } from '../../stores/log-store.ts';
import type { LogLevel, LogType } from '../../engine/logger.ts';

const LEVEL_CONFIG: Record<
  LogLevel,
  { label: string; desc: string; badgeClass: string }
> = {
  summary: {
    label: '概要 (Summary)',
    desc: '记录系统启停、拓扑调度、API 请求概况（状态码/耗时/Token）与异常错误',
    badgeClass: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700',
  },
  detailed: {
    label: '详细 (Detailed)',
    desc: '在概要基础上，记录节点 ID、模型参数 (model/temp)、依赖解析与流转元数据',
    badgeClass: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700',
  },
  dev: {
    label: '开发 (Development)',
    desc: '在详细基础上，捕获完整节点输入 (Prompt) 与输出响应 (已严格脱敏密钥)',
    badgeClass: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
  },
};

const TYPE_CONFIG: Record<
  LogType,
  { label: string; icon: React.FC<{ className?: string }>; color: string }
> = {
  system: { label: '系统', icon: Layers, color: 'text-sky-500' },
  request: { label: '请求', icon: Radio, color: 'text-amber-500' },
  node: { label: '节点', icon: Cpu, color: 'text-indigo-500' },
  error: { label: '异常', icon: AlertCircle, color: 'text-rose-500' },
  security: { label: '安全', icon: ShieldCheck, color: 'text-emerald-500' },
};

export const LogConsole: React.FC = () => {
  const isConsoleOpen = useLogStore((s) => s.isConsoleOpen);
  const setConsoleOpen = useLogStore((s) => s.setConsoleOpen);
  const isMinimized = useLogStore((s) => s.isMinimized);
  const setIsMinimized = useLogStore((s) => s.setIsMinimized);
  const consoleHeight = useLogStore((s) => s.consoleHeight);
  const setConsoleHeight = useLogStore((s) => s.setConsoleHeight);
  const logLevel = useLogStore((s) => s.logLevel);
  const setLogLevel = useLogStore((s) => s.setLogLevel);
  const autoScroll = useLogStore((s) => s.autoScroll);
  const setAutoScroll = useLogStore((s) => s.setAutoScroll);
  const selectedTypeFilter = useLogStore((s) => s.selectedTypeFilter);
  const setSelectedTypeFilter = useLogStore((s) => s.setSelectedTypeFilter);
  const searchQuery = useLogStore((s) => s.searchQuery);
  const setSearchQuery = useLogStore((s) => s.setSearchQuery);
  const logs = useLogStore((s) => s.logs);
  const clearLogs = useLogStore((s) => s.clearLogs);
  const exportLogs = useLogStore((s) => s.exportLogs);

  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const logListRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const startHeightRef = useRef(consoleHeight);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logListRef.current) {
      logListRef.current.scrollTop = logListRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Handle resizing drag
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartYRef.current = e.clientY;
    startHeightRef.current = consoleHeight;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaY = dragStartYRef.current - ev.clientY;
      setConsoleHeight(startHeightRef.current + deltaY);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleCopyPayload = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Filtered logs calculation
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Filter by type
      if (selectedTypeFilter !== 'all' && log.type !== selectedTypeFilter) {
        return false;
      }
      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const msgMatch = log.message.toLowerCase().includes(q);
        const sourceMatch = log.source.toLowerCase().includes(q);
        const nodeMatch = log.nodeId?.toLowerCase().includes(q);
        if (!msgMatch && !sourceMatch && !nodeMatch) {
          return false;
        }
      }
      return true;
    });
  }, [logs, selectedTypeFilter, searchQuery]);

  const countsByType = useMemo(() => {
    const counts = { all: logs.length, system: 0, request: 0, node: 0, error: 0, security: 0 };
    for (const log of logs) {
      if (log.type in counts) {
        counts[log.type]++;
      }
    }
    return counts;
  }, [logs]);

  if (!isConsoleOpen) return null;

  return (
    <div
      style={{
        height: isMinimized ? '42px' : isMaximized ? 'calc(100vh - 56px)' : `${consoleHeight}px`,
      }}
      className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/98 backdrop-blur-xl border-t border-slate-700/80 shadow-2xl flex flex-col text-slate-200 font-sans transition-all duration-150 ease-out select-none"
    >
      {/* Resizing Handle Bar */}
      {!isMinimized && !isMaximized && (
        <div
          onMouseDown={handleMouseDown}
          className="h-1.5 w-full cursor-ns-resize bg-transparent hover:bg-blue-500/50 transition-colors absolute top-0 left-0 right-0 z-50 flex items-center justify-center group"
          title="按住上下拖拽调整控制台高度"
        >
          <div className="w-12 h-0.5 rounded-full bg-slate-600 group-hover:bg-blue-400 transition-colors" />
        </div>
      )}

      {/* Header Toolbar */}
      <div className="h-11 px-3 border-b border-slate-800 flex items-center justify-between gap-2 text-xs shrink-0 bg-slate-950/80">
        {/* Left: Title & Level Configurator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold tracking-wide">
            <Terminal className="w-4 h-4 text-blue-400" />
            <span>日志控制台</span>
          </div>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Log Level Selector */}
          <div className="flex items-center gap-1.5" title="配置日志记录等级">
            <span className="text-[11px] text-slate-400">等级:</span>
            <select
              value={logLevel}
              onChange={(e) => setLogLevel(e.target.value as LogLevel)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-750 border border-slate-700 text-[11px] font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="summary">概要 (Summary)</option>
              <option value="detailed">详细 (Detailed)</option>
              <option value="dev">开发 (Development)</option>
            </select>
          </div>

          <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800/80 text-[10px] text-slate-400 border border-slate-700/60 font-mono">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>密钥自动脱敏</span>
          </div>
        </div>

        {/* Center: Search input */}
        {!isMinimized && (
          <div className="relative hidden md:flex items-center w-56 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索日志 (关键词/节点)..."
              className="w-full pl-8 pr-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {!isMinimized && (
            <>
              {/* Auto Scroll Toggle */}
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors ${
                  autoScroll
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40'
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
                title={autoScroll ? '已开启自动滚到底部' : '自动滚动已暂停'}
              >
                <ArrowDownToLine className="w-3.5 h-3.5" />
              </button>

              {/* Clear Logs */}
              <button
                onClick={clearLogs}
                className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                title="清空所有日志"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Export Menu */}
              <div className="relative">
                <button
                  onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                  className="px-2 py-1 rounded text-[11px] flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                  title="导出日志文件"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">导出</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {isExportMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-32 rounded-lg bg-slate-800 border border-slate-700 shadow-xl py-1 z-50 text-xs">
                    <button
                      onClick={() => {
                        exportLogs('json');
                        setIsExportMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 flex items-center justify-between"
                    >
                      <span>导出 JSON</span>
                      <span className="text-[10px] text-slate-400 font-mono">.json</span>
                    </button>
                    <button
                      onClick={() => {
                        exportLogs('txt');
                        setIsExportMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-700 flex items-center justify-between"
                    >
                      <span>导出 文本</span>
                      <span className="text-[10px] text-slate-400 font-mono">.txt</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Maximize / Restore Toggle */}
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title={isMaximized ? '还原高度' : '全屏展开'}
              >
                {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </>
          )}

          {/* Minimize / Expand Toggle */}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title={isMinimized ? '展开日志面板' : '最小化'}
          >
            {isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Close Console */}
          <button
            onClick={() => setConsoleOpen(false)}
            className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            title="关闭日志控制台"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sub-header Filter Chips */}
      {!isMinimized && (
        <div className="h-8 px-3 border-b border-slate-800/80 bg-slate-950/40 flex items-center gap-1.5 text-[11px] shrink-0 overflow-x-auto">
          <button
            onClick={() => setSelectedTypeFilter('all')}
            className={`px-2 py-0.5 rounded transition-colors ${
              selectedTypeFilter === 'all'
                ? 'bg-blue-600 text-white font-medium shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            全部 ({countsByType.all})
          </button>

          {(['system', 'request', 'node', 'error'] as LogType[]).map((type) => {
            const conf = TYPE_CONFIG[type];
            const Icon = conf.icon;
            const count = countsByType[type];
            const active = selectedTypeFilter === type;

            return (
              <button
                key={type}
                onClick={() => setSelectedTypeFilter(type)}
                className={`px-2 py-0.5 rounded flex items-center gap-1 transition-colors ${
                  active
                    ? 'bg-slate-700 text-slate-100 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3 h-3 ${conf.color}`} />
                <span>{conf.label}</span>
                <span className="font-mono text-[10px] opacity-75">({count})</span>
              </button>
            );
          })}

          <div className="ml-auto text-[10px] text-slate-500 font-mono">
            {LEVEL_CONFIG[logLevel].desc}
          </div>
        </div>
      )}

      {/* Main Log List Area */}
      {!isMinimized && (
        <div
          ref={logListRef}
          className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-1 select-text bg-[#070A0F]"
        >
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 py-8 select-none">
              <Terminal className="w-8 h-8 stroke-[1.2] opacity-40" />
              <span>暂无符合条件的日志记录</span>
              <span className="text-[11px] text-slate-600">
                点击上方 “▶ Run Workflow” 运行工作流后，实时日志将在此滚动展示。
              </span>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const typeConf = TYPE_CONFIG[log.type] || TYPE_CONFIG.system;
              const TypeIcon = typeConf.icon;
              const timeStr = new Date(log.timestamp).toISOString().slice(11, 23);
              const isExpanded = expandedLogId === log.id;
              const hasPayload = Boolean(log.data?.inputs || log.data?.outputs || log.metadata);

              return (
                <div
                  key={log.id}
                  className={`p-1.5 rounded-md transition-colors border ${
                    log.type === 'error'
                      ? 'bg-rose-950/20 border-rose-900/40 text-rose-300'
                      : log.level === 'dev'
                      ? 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-850 text-slate-300'
                      : 'bg-transparent border-transparent hover:bg-slate-900/50 text-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-2 leading-relaxed">
                    {/* Timestamp */}
                    <span className="text-[10px] text-slate-500 shrink-0 font-mono pt-0.5">
                      {timeStr}
                    </span>

                    {/* Level Badge */}
                    <span
                      className={`text-[9px] font-bold uppercase px-1 py-0.2 rounded border shrink-0 font-mono ${
                        LEVEL_CONFIG[log.level]?.badgeClass || ''
                      }`}
                    >
                      {log.level}
                    </span>

                    {/* Type Badge */}
                    <span className="flex items-center gap-1 text-[11px] font-semibold shrink-0">
                      <TypeIcon className={`w-3.5 h-3.5 ${typeConf.color}`} />
                      <span className="text-slate-400">[{log.source}]</span>
                    </span>

                    {/* Node ID Badge if present */}
                    {log.nodeId && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 shrink-0 font-mono">
                        #{log.nodeId}
                      </span>
                    )}

                    {/* Duration Badge */}
                    {log.durationMs !== undefined && (
                      <span className="text-[10px] px-1 py-0.2 rounded bg-blue-950/60 text-sky-300 border border-blue-800/40 shrink-0 font-mono flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{log.durationMs}ms</span>
                      </span>
                    )}

                    {/* Message Body */}
                    <span className="flex-1 break-all text-xs font-mono select-text">
                      {log.message}
                    </span>

                    {/* Expand payload toggle button for dev/metadata logs */}
                    {hasPayload && (
                      <button
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                        className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-750 transition-colors shrink-0"
                      >
                        <Code className="w-3 h-3" />
                        <span>{isExpanded ? '收起详情' : '详情 Payload'}</span>
                      </button>
                    )}
                  </div>

                  {/* Expanded JSON Payload Box */}
                  {isExpanded && (
                    <div className="mt-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-2 relative">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 border-b border-slate-850 pb-1">
                        <span>Payload Data (已严格脱敏)</span>
                        <button
                          onClick={() =>
                            handleCopyPayload(
                              log.id,
                              JSON.stringify({ metadata: log.metadata, data: log.data }, null, 2)
                            )
                          }
                          className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
                        >
                          {copiedId === log.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy JSON</span>
                            </>
                          )}
                        </button>
                      </div>

                      {log.metadata && (
                        <div>
                          <div className="text-[10px] font-semibold text-slate-400 mb-0.5">Metadata:</div>
                          <pre className="p-2 rounded bg-slate-900/90 text-amber-300/90 overflow-x-auto max-h-40 whitespace-pre-wrap">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}

                      {log.data?.inputs !== undefined && (
                        <div>
                          <div className="text-[10px] font-semibold text-sky-400 mb-0.5">Inputs (开发级别入参):</div>
                          <pre className="p-2 rounded bg-slate-900/90 text-sky-200 overflow-x-auto max-h-48 whitespace-pre-wrap">
                            {JSON.stringify(log.data.inputs, null, 2)}
                          </pre>
                        </div>
                      )}

                      {log.data?.outputs !== undefined && (
                        <div>
                          <div className="text-[10px] font-semibold text-emerald-400 mb-0.5">Outputs (开发级别响应):</div>
                          <pre className="p-2 rounded bg-slate-900/90 text-emerald-200 overflow-x-auto max-h-48 whitespace-pre-wrap">
                            {JSON.stringify(log.data.outputs, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
