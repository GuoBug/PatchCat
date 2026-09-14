import React from 'react';
import { Database } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation.ts';
import { useKnowledgeStore } from '../../../stores/knowledge-store.ts';

interface KnowledgeNodePropertiesProps {
  nodeId: string;
  config: Record<string, unknown>;
  inputs: Record<string, unknown>;
  updateNodeConfig: (nodeId: string, patch: Record<string, unknown>) => void;
  updateNodeData: (nodeId: string, data: { inputs: Record<string, unknown> }) => void;
}

export const KnowledgeNodeProperties: React.FC<KnowledgeNodePropertiesProps> = ({
  nodeId,
  config,
  inputs,
  updateNodeConfig,
  updateNodeData,
}) => {
  const { t } = useTranslation();
  const knowledgeBases = useKnowledgeStore((s) => s.knowledgeBases);
  const openKnowledgeDetail = useKnowledgeStore((s) => s.openDetail);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          <span>{t.propertyPanel.knowledgeConfig}</span>
        </label>

        {/* Target Knowledge Base */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              {t.propertyPanel.knowledgeBase}
            </label>
            <button
              type="button"
              onClick={() =>
                openKnowledgeDetail((config['knowledgeBaseId'] as string) || undefined)
              }
              className="text-[11px] font-medium text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
            >
              {t.knowledge.manageKb} &rarr;
            </button>
          </div>
          <select
            value={(config['knowledgeBaseId'] as string) || ''}
            onChange={(e) => updateNodeConfig(nodeId, { knowledgeBaseId: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 cursor-pointer"
          >
            <option value="">{t.propertyPanel.selectKnowledgeBase}</option>
            {knowledgeBases.map((kb) => (
              <option key={kb.id} value={kb.id}>
                {kb.name} ({kb.document_count || 0} {t.knowledge.documentsCount})
              </option>
            ))}
            {Boolean(config['knowledgeBaseId']) &&
              !knowledgeBases.some((k) => k.id === config['knowledgeBaseId']) && (
                <option value={config['knowledgeBaseId'] as string}>
                  {config['knowledgeBaseId'] as string}
                </option>
              )}
          </select>
          {knowledgeBases.length === 0 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              {t.propertyPanel.noKnowledgeBaseFound}
            </p>
          )}
        </div>

        {/* Query */}
        <div className="space-y-1 pt-1">
          <label className="text-xs text-slate-700 dark:text-slate-300 font-medium">
            {t.propertyPanel.knowledgeQuery}
          </label>
          <textarea
            rows={3}
            value={
              typeof inputs['query'] === 'string'
                ? (inputs['query'] as string)
                : (config['query'] as string) || ''
            }
            onChange={(e) => {
              updateNodeConfig(nodeId, { query: e.target.value });
              updateNodeData(nodeId, { inputs: { ...inputs, query: e.target.value } });
            }}
            placeholder={t.propertyPanel.knowledgeQueryPlaceholder}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
          />
          <span className="text-[10px] text-slate-400 dark:text-slate-500 block">
            Tip: Use{' '}
            <code className="text-cyan-600 dark:text-cyan-400">{'{{input_1.query}}'}</code> to
            search user question dynamically.
          </span>
        </div>

        {/* Top-K Slider */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-xs">
            <label className="text-slate-700 dark:text-slate-300 font-medium">
              {t.propertyPanel.topK}
            </label>
            <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
              {typeof config['topK'] === 'number' ? config['topK'] : 3}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            value={typeof config['topK'] === 'number' ? config['topK'] : 3}
            onChange={(e) => updateNodeConfig(nodeId, { topK: parseInt(e.target.value, 10) })}
            className="w-full accent-cyan-600 dark:accent-cyan-400 bg-slate-200 dark:bg-slate-950 cursor-pointer"
          />
        </div>

        {/* Score Threshold Slider */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-xs">
            <label className="text-slate-700 dark:text-slate-300 font-medium">
              {t.propertyPanel.scoreThreshold}
            </label>
            <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
              {typeof config['scoreThreshold'] === 'number' ? config['scoreThreshold'] : 0.0}
            </span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={
              typeof config['scoreThreshold'] === 'number' ? config['scoreThreshold'] : 0.0
            }
            onChange={(e) =>
              updateNodeConfig(nodeId, { scoreThreshold: parseFloat(e.target.value) })
            }
            className="w-full accent-cyan-600 dark:accent-cyan-400 bg-slate-200 dark:bg-slate-950 cursor-pointer"
          />
        </div>

        {/* Attribution / Output format hint */}
        <div className="p-2.5 rounded-lg bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200/60 dark:border-cyan-500/20 text-[11px] text-cyan-800 dark:text-cyan-300 leading-relaxed">
          {t.propertyPanel.knowledgeAttributionHint}
        </div>
      </div>
    </div>
  );
};
