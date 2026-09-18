import React, { useRef } from 'react';
import { useTranslation } from '../../i18n/useTranslation.ts';
import { useWorkflowStore } from '../../stores/workflow-store.ts';
import { useProjectStore } from '../../stores/project-store.ts';
import type { WorkflowNode, WorkflowEdge } from '../../engine/types.ts';
import { nanoid } from 'nanoid';

interface EmptyCanvasHeroProps {
  onOpenTemplateGallery: () => void;
}

export const EmptyCanvasHero: React.FC<EmptyCanvasHeroProps> = ({ onOpenTemplateGallery }) => {
  const { t, language } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nodes = useWorkflowStore((s) => s.nodes);
  const addNode = useWorkflowStore((s) => s.addNode);
  const captureSnapshot = useWorkflowStore((s) => s.captureSnapshot);
  const workflows = useProjectStore((s) => s.workflows);

  // If there are already nodes on the canvas, hero card is hidden
  if (nodes.length > 0) {
    return null;
  }

  // Detect whether the user is an experienced/returning user
  const isReturningUser =
    workflows.length > 1 || (workflows.length === 1 && workflows[0]?.nodes && workflows[0].nodes.length > 0);

  // 1. Add single starting blank node
  const handleAddBlankNode = () => {
    addNode('input', { x: 320, y: 220 });
  };

  // 2. Quick Starter Flow: Input ➔ Prompt ➔ LLM
  const handleQuickStart = () => {
    captureSnapshot();

    const inputId = `input_${nanoid(8)}`;
    const promptId = `prompt_${nanoid(8)}`;
    const llmId = `llm_${nanoid(8)}`;

    const isZh = language === 'zh';

    const starterNodes: WorkflowNode[] = [
      {
        id: inputId,
        type: 'input',
        position: { x: 150, y: 200 },
        data: {
          label: isZh ? '业务入参 #1' : 'Input Parameters #1',
          type: 'input',
          status: 'idle',
          inputs: {},
          outputs: {},
          config: {
            parameters: [
              {
                id: 'p_1',
                key: 'query',
                type: 'string',
                defaultValue: isZh ? '如何提升团队工程研发效能？' : 'How to improve team engineering efficiency?',
                description: isZh ? '用户输入提问' : 'User inquiry query',
              },
            ],
          },
        },
      },
      {
        id: promptId,
        type: 'prompt',
        position: { x: 480, y: 200 },
        data: {
          label: isZh ? '结构化提示词 #1' : 'Prompt Template #1',
          type: 'prompt',
          status: 'idle',
          inputs: {},
          outputs: {},
          config: {
            template: isZh
              ? '你是一名资深系统架构专家。请针对以下问题提供条理清晰的落地建议：\n\n{{input.query}}'
              : 'You are a senior system architect. Please provide structured recommendations for:\n\n{{input.query}}',
          },
        },
      },
      {
        id: llmId,
        type: 'llm',
        position: { x: 820, y: 200 },
        data: {
          label: isZh ? '大模型推理 #1' : 'LLM Inference #1',
          type: 'llm',
          status: 'idle',
          inputs: {},
          outputs: {},
          config: {
            model: 'deepseek-v3',
            temperature: 0.7,
            maxTokens: 4096,
          },
        },
      },
    ];

    const starterEdges: WorkflowEdge[] = [
      {
        id: `edge-${nanoid(8)}`,
        source: inputId,
        sourceHandle: null,
        target: promptId,
        targetHandle: 'input',
        animated: false,
        type: 'default',
      },
      {
        id: `edge-${nanoid(8)}`,
        source: promptId,
        sourceHandle: null,
        target: llmId,
        targetHandle: 'input',
        animated: false,
        type: 'default',
      },
    ];

    useWorkflowStore.setState((state) => {
      state.nodes = starterNodes;
      state.edges = starterEdges;
    });
  };

  // 3. Import JSON Workflow from file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
          captureSnapshot();
          useWorkflowStore.setState((state) => {
            state.nodes = parsed.nodes;
            state.edges = parsed.edges;
          });
        }
      } catch (err) {
        console.error('Failed to parse workflow JSON:', err);
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  return (
    <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center p-6">
      {/* Hidden file input for JSON import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        className="hidden"
      />

      <div className="pointer-events-auto max-w-lg w-full bg-slate-900/85 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-7 shadow-2xl text-center relative transition-all duration-300 animate-in fade-in zoom-in-95">
        {/* Badge Indicator */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 mb-3.5">
          <span>{isReturningUser ? '⚡' : '🔰'}</span>
          <span>
            {isReturningUser
              ? language === 'zh'
                ? '效率发射台 · 敏捷脚手架与快速起手'
                : 'Scaffolding Hub · Rapid Starters'
              : language === 'zh'
              ? '初次探索模式 · 场景启发与低门槛'
              : 'Explorer Mode · Scenarios & Low-Code'}
          </span>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-white tracking-tight mb-2">
          {isReturningUser ? t.emptyCanvas.returningTitle : t.emptyCanvas.newcomerTitle}
        </h2>

        {/* Subtitle */}
        <p className="text-xs leading-relaxed text-slate-400 mb-6 px-2">
          {isReturningUser ? t.emptyCanvas.returningDesc : t.emptyCanvas.newcomerDesc}
        </p>

        {/* Dynamic Action Buttons */}
        {!isReturningUser ? (
          // State A: First-time Newcomer
          <div className="flex flex-col gap-2.5">
            <button
              onClick={onOpenTemplateGallery}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 group"
            >
              <span className="text-sm group-hover:scale-110 transition-transform">✨</span>
              <span>{t.emptyCanvas.newcomerCta}</span>
            </button>
            <button
              onClick={handleAddBlankNode}
              className="w-full py-2.5 px-4 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white font-medium text-xs rounded-xl border border-slate-700/60 transition flex items-center justify-center gap-2"
            >
              <span>➕</span>
              <span>{t.emptyCanvas.addBlankNode}</span>
            </button>
          </div>
        ) : (
          // State B: Experienced Returning User on Blank Canvas
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={onOpenTemplateGallery}
                className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-600/25 transition flex items-center justify-center gap-1.5"
              >
                <span>📚</span>
                <span>{t.emptyCanvas.returningCta}</span>
              </button>
              <button
                onClick={handleQuickStart}
                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-emerald-600/25 transition flex items-center justify-center gap-1.5"
              >
                <span>⚡</span>
                <span>{language === 'zh' ? '快速起手 (Input➔LLM)' : 'Quick Start (Input➔LLM)'}</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl border border-slate-700 transition flex items-center justify-center gap-1.5"
              >
                <span>📂</span>
                <span>{t.emptyCanvas.importJson}</span>
              </button>
              <button
                onClick={handleAddBlankNode}
                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 transition flex items-center justify-center gap-1.5"
              >
                <span>➕</span>
                <span>{t.emptyCanvas.addBlankNode}</span>
              </button>
            </div>
          </div>
        )}

        {/* Auxiliary Geek Hint */}
        <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <span>
            {language === 'zh'
              ? '💡 极客模式：直接从左侧工具栏拖入节点，卡片将毫秒级自动隐藏'
              : '💡 Geek bypass: Drag any node from the sidebar to instantly dismiss this card.'}
          </span>
        </div>
      </div>
    </div>
  );
};
