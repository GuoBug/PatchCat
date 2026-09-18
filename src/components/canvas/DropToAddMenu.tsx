import React, { useState, useEffect, useRef } from 'react';
import type { NodeType } from '../../engine/types.ts';
import { useTranslation } from '../../i18n/useTranslation.ts';

interface DropToAddMenuProps {
  position: { x: number; y: number };
  onSelectNodeType: (type: NodeType) => void;
  onClose: () => void;
}

interface NodeOption {
  type: NodeType;
  name: string;
  desc: string;
  icon: string;
  color: string;
}

export const DropToAddMenu: React.FC<DropToAddMenuProps> = ({
  position,
  onSelectNodeType,
  onClose,
}) => {
  const { t, language } = useTranslation();
  const [search, setSearch] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isZh = language === 'zh';

  const nodeOptions: NodeOption[] = [
    {
      type: 'prompt',
      name: t.nodeTypes.prompt,
      desc: isZh ? '编排提示词与动态插槽' : 'Prompt template with variable slots',
      icon: '✍️',
      color: 'border-purple-500/40 text-purple-400',
    },
    {
      type: 'llm',
      name: t.nodeTypes.llm,
      desc: isZh ? '调用大语言模型推理' : 'Call LLM for reasoning & generation',
      icon: '🤖',
      color: 'border-blue-500/40 text-blue-400',
    },
    {
      type: 'code',
      name: t.nodeTypes.code,
      desc: isZh ? 'JavaScript 运行清洗沙箱' : 'Run JavaScript transformation sandbox',
      icon: '⚡',
      color: 'border-amber-500/40 text-amber-400',
    },
    {
      type: 'condition',
      name: t.nodeTypes.condition,
      desc: isZh ? '根据规则或表达式多路路由' : 'Route dataflow via IF/ELSE conditions',
      icon: '🔀',
      color: 'border-orange-500/40 text-orange-400',
    },
    {
      type: 'knowledge',
      name: t.nodeTypes.knowledge,
      desc: isZh ? '向量语义检索与召回' : 'Dense vector semantic search',
      icon: '📚',
      color: 'border-cyan-500/40 text-cyan-400',
    },
    {
      type: 'http',
      name: t.nodeTypes.http,
      desc: isZh ? '三方 REST API 请求调度' : 'External REST API HTTP client',
      icon: '🌐',
      color: 'border-teal-500/40 text-teal-400',
    },
    {
      type: 'output',
      name: t.nodeTypes.output,
      desc: isZh ? '最终结果交付与格式化' : 'Final deliverable output & copy',
      icon: '🏁',
      color: 'border-rose-500/40 text-rose-400',
    },
    {
      type: 'aggregator',
      name: t.nodeTypes.aggregator,
      desc: isZh ? '多分支合并与数据汇聚' : 'Merge and aggregate parallel branches',
      icon: '🧩',
      color: 'border-fuchsia-500/40 text-fuchsia-400',
    },
    {
      type: 'agent',
      name: t.nodeTypes.agent,
      desc: isZh ? 'ReAct 自主循环与工具调度' : 'Autonomous agent with tools',
      icon: '🦾',
      color: 'border-indigo-500/40 text-indigo-400',
    },
  ];

  const filtered = nodeOptions.filter(
    (n) =>
      n.name.toLowerCase().includes(search.toLowerCase()) ||
      n.desc.toLowerCase().includes(search.toLowerCase()) ||
      n.type.toLowerCase().includes(search.toLowerCase()),
  );

  // Auto focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on outside click or ESC
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Constrain position to viewport
  const left = Math.min(Math.max(16, position.x), window.innerWidth - 300);
  const top = Math.min(Math.max(16, position.y), window.innerHeight - 380);

  return (
    <div
      ref={menuRef}
      style={{ left: `${left}px`, top: `${top}px` }}
      className="fixed z-50 w-72 bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 rounded-2xl shadow-2xl p-3 flex flex-col gap-2 animate-in fade-in zoom-in-95"
    >
      {/* Menu Header */}
      <div className="flex items-center justify-between px-1 pb-1 border-b border-slate-800">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
          <span>⚡</span>
          <span>{t.dropToAdd.title}</span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-xs p-1 rounded hover:bg-slate-800"
        >
          ✕
        </button>
      </div>

      {/* Quick Search */}
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t.dropToAdd.searchPlaceholder}
        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
      />

      {/* Node Options List */}
      <div className="max-h-60 overflow-y-auto space-y-1 pr-0.5">
        {filtered.map((item) => (
          <button
            key={item.type}
            onClick={() => {
              onSelectNodeType(item.type);
              onClose();
            }}
            className="w-full p-2 rounded-xl hover:bg-slate-800/80 active:bg-slate-700/80 transition flex items-center gap-2.5 text-left group"
          >
            <span className={`text-base p-1.5 bg-slate-950 rounded-lg border ${item.color}`}>
              {item.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 truncate">
                {item.name}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {item.desc}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
