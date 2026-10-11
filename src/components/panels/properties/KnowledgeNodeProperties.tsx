import React, { useState } from 'react';
import { Database, Sparkles, Key, Eye, EyeOff, Zap, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation.ts';
import { useKnowledgeStore } from '../../../stores/knowledge-store.ts';
import { useSettingsStore, type ProviderId } from '../../../stores/settings-store.ts';
import type { RerankProtocol, KnowledgeRerankOptions } from '../../../engine/types.ts';

export type EmbeddingProvider = 'siliconflow' | 'openai' | 'ollama' | 'custom';

const EMBEDDING_PRESETS: Record<
  EmbeddingProvider,
  { label: string; baseUrl: string; model: string; dimension: number; defaultKeyProvider?: ProviderId }
> = {
  siliconflow: {
    label: 'SiliconFlow (BAAI/bge-m3, 1024d)',
    baseUrl: 'https://api.siliconflow.cn',
    model: 'BAAI/bge-m3',
    dimension: 1024,
    defaultKeyProvider: 'siliconflow',
  },
  openai: {
    label: 'OpenAI (text-embedding-3-small, 1536d)',
    baseUrl: 'https://api.openai.com',
    model: 'text-embedding-3-small',
    dimension: 1536,
    defaultKeyProvider: 'openai',
  },
  ollama: {
    label: 'Ollama Local (nomic-embed-text, 768d)',
    baseUrl: 'http://localhost:11434',
    model: 'nomic-embed-text',
    dimension: 768,
  },
  custom: {
    label: 'Custom OpenAI-Compatible',
    baseUrl: 'http://localhost:8000',
    model: 'text-embedding-3-small',
    dimension: 1536,
  },
};

const PROTOCOL_PRESETS: Record<
  RerankProtocol,
  { label: string; baseUrl: string; model: string; defaultKeyProvider?: ProviderId }
> = {
  cohere: {
    label: 'Cohere (/v2/rerank)',
    baseUrl: 'https://api.cohere.com',
    model: 'rerank-v3.5',
  },
  jina: {
    label: 'Jina AI (/v1/rerank)',
    baseUrl: 'https://api.jina.ai',
    model: 'jina-reranker-v2-base-multilingual',
  },
  openai: {
    label: 'SiliconFlow / OpenAI (/v1/rerank)',
    baseUrl: 'https://api.siliconflow.cn',
    model: 'BAAI/bge-reranker-v2-m3',
    defaultKeyProvider: 'siliconflow',
  },
  tei: {
    label: 'HuggingFace TEI Local (/rerank)',
    baseUrl: 'http://localhost:8080',
    model: 'BAAI/bge-reranker-large',
  },
};

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
  const { t, language } = useTranslation();
  const knowledgeBases = useKnowledgeStore((s) => s.knowledgeBases);
  const openKnowledgeDetail = useKnowledgeStore((s) => s.openDetail);
  const settingsProviders = useSettingsStore((s) => s.providers);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showEmbeddingApiKey, setShowEmbeddingApiKey] = useState(false);

  const embeddingConfig = (config['embedding'] as {
    enabled?: boolean;
    provider?: EmbeddingProvider;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    dimension?: number;
  } | undefined) || {};
  const isEmbeddingEnabled = Boolean(embeddingConfig.enabled);
  const embeddingProvider: EmbeddingProvider = embeddingConfig.provider || 'siliconflow';

  const updateEmbeddingConfig = (patch: Partial<typeof embeddingConfig>) => {
    const currentEmbedding = (config['embedding'] as typeof embeddingConfig | undefined) || {};
    updateNodeConfig(nodeId, {
      embedding: {
        ...currentEmbedding,
        ...patch,
      },
    });
  };

  const handleEmbeddingProviderChange = (newProvider: EmbeddingProvider) => {
    const preset = EMBEDDING_PRESETS[newProvider];
    if (!preset) return;
    updateEmbeddingConfig({
      provider: newProvider,
      baseUrl: preset.baseUrl,
      model: preset.model,
      dimension: preset.dimension,
    });
  };

  const inheritedEmbeddingKey =
    embeddingProvider === 'siliconflow'
      ? settingsProviders['siliconflow']?.apiKey || ''
      : embeddingProvider === 'openai'
        ? settingsProviders['openai']?.apiKey || ''
        : '';

  const rerankConfig = (config['rerank'] as Partial<KnowledgeRerankOptions> | undefined) || {};
  const isRerankEnabled = Boolean(rerankConfig.enabled);
  const protocol = (rerankConfig.protocol as RerankProtocol) || 'cohere';

  // Safe nested patch helper preventing shallow merge overwrite (P1-1)
  const updateRerankConfig = (patch: Partial<KnowledgeRerankOptions>) => {
    const currentRerank = (config['rerank'] as Partial<KnowledgeRerankOptions> | undefined) || {};
    updateNodeConfig(nodeId, {
      rerank: {
        ...currentRerank,
        ...patch,
      },
    });
  };

  const handleProtocolChange = (newProtocol: RerankProtocol) => {
    const preset = PROTOCOL_PRESETS[newProtocol];
    if (!preset) return;
    updateRerankConfig({
      protocol: newProtocol,
      baseUrl: preset.baseUrl,
      model: preset.model,
    });
  };

  const inheritedKey =
    protocol === 'openai'
      ? settingsProviders['siliconflow']?.apiKey || settingsProviders['openai']?.apiKey || ''
      : '';

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

        {/* Search Mode Select */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs text-slate-700 dark:text-slate-300 font-medium">
            {t.propertyPanel.searchMode}
          </label>
          <select
            value={(config['searchMode'] as string) || 'hybrid'}
            onChange={(e) => updateNodeConfig(nodeId, { searchMode: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 cursor-pointer"
          >
            <option value="hybrid">{t.propertyPanel.searchModeHybrid}</option>
            <option value="bm25">{t.propertyPanel.searchModeBM25}</option>
            <option value="vector">{t.propertyPanel.searchModeVector}</option>
          </select>
        </div>

        {/* Hybrid Weights Tuning (Shown when searchMode is 'hybrid' or default) */}
        {((config['searchMode'] as string) || 'hybrid') === 'hybrid' && (
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-2.5">
            <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400 flex items-center justify-between">
              <span>{t.propertyPanel.hybridWeightHelp}</span>
              <span className="font-mono text-cyan-600 dark:text-cyan-400 text-[10px]">
                {typeof config['bm25Weight'] === 'number' ? config['bm25Weight'] : 0.5} :{' '}
                {typeof config['vectorWeight'] === 'number' ? config['vectorWeight'] : 0.5}
              </span>
            </div>

            {/* BM25 Weight */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  {t.propertyPanel.bm25Weight}
                </span>
                <span className="font-mono text-cyan-600 dark:text-cyan-400 text-[11px] font-medium">
                  {typeof config['bm25Weight'] === 'number' ? config['bm25Weight'] : 0.5}
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={typeof config['bm25Weight'] === 'number' ? config['bm25Weight'] : 0.5}
                onChange={(e) =>
                  updateNodeConfig(nodeId, { bm25Weight: parseFloat(e.target.value) })
                }
                className="w-full accent-cyan-600 dark:accent-cyan-400 bg-slate-200 dark:bg-slate-950 cursor-pointer h-1.5"
              />
            </div>

            {/* Vector Weight */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-600 dark:text-slate-400">
                  {t.propertyPanel.vectorWeight}
                </span>
                <span className="font-mono text-cyan-600 dark:text-cyan-400 text-[11px] font-medium">
                  {typeof config['vectorWeight'] === 'number' ? config['vectorWeight'] : 0.5}
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={typeof config['vectorWeight'] === 'number' ? config['vectorWeight'] : 0.5}
                onChange={(e) =>
                  updateNodeConfig(nodeId, { vectorWeight: parseFloat(e.target.value) })
                }
                className="w-full accent-cyan-600 dark:accent-cyan-400 bg-slate-200 dark:bg-slate-950 cursor-pointer h-1.5"
              />
            </div>
          </div>
        )}

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

        {/* ── Browser-Native Multi-Provider Vector Embedding Section (Phase 4.19) ── */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 overflow-hidden shadow-2xs">
          <div
            className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
            onClick={() => updateEmbeddingConfig({ enabled: !isEmbeddingEnabled })}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                  {t.propertyPanel.embeddingConfig}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-tight">
                  {t.propertyPanel.embeddingToggleDesc}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isEmbeddingEnabled}
              onChange={(e) => updateEmbeddingConfig({ enabled: e.target.checked })}
              className="accent-emerald-600 cursor-pointer w-4 h-4 rounded shrink-0"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {isEmbeddingEnabled && (
            <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/80 space-y-3 bg-white/60 dark:bg-slate-950/40">
              {/* Threshold recalibration warning notice */}
              <div className="p-2.5 rounded-lg bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span className="text-[11px] text-amber-800 dark:text-amber-300 leading-tight">
                  {t.propertyPanel.embeddingThresholdWarning}
                </span>
              </div>

              {/* Provider */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  {t.propertyPanel.embeddingProvider}
                </label>
                <select
                  value={embeddingProvider}
                  onChange={(e) => handleEmbeddingProviderChange(e.target.value as EmbeddingProvider)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                >
                  {(Object.keys(EMBEDDING_PRESETS) as EmbeddingProvider[]).map((p) => (
                    <option key={p} value={p}>
                      {EMBEDDING_PRESETS[p]?.label ?? p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ollama CORS Hint */}
              {embeddingProvider === 'ollama' && (
                <div className="p-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 text-[11px] text-blue-700 dark:text-blue-300">
                  {t.propertyPanel.embeddingOllamaCorsHint}
                </div>
              )}

              {/* Base URL */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  {t.propertyPanel.embeddingBaseUrl}
                </label>
                <input
                  type="text"
                  value={embeddingConfig.baseUrl || ''}
                  onChange={(e) => updateEmbeddingConfig({ baseUrl: e.target.value })}
                  placeholder={EMBEDDING_PRESETS[embeddingProvider]?.baseUrl}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Model */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  {t.propertyPanel.embeddingModel}
                </label>
                <input
                  type="text"
                  value={embeddingConfig.model || ''}
                  onChange={(e) => updateEmbeddingConfig({ model: e.target.value })}
                  placeholder={EMBEDDING_PRESETS[embeddingProvider]?.model}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Dimension */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  {t.propertyPanel.embeddingDimension}
                </label>
                <input
                  type="number"
                  value={embeddingConfig.dimension || ''}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    updateEmbeddingConfig({ dimension: isNaN(parsed) ? undefined : parsed });
                  }}
                  placeholder={String(EMBEDDING_PRESETS[embeddingProvider]?.dimension || 1024)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* API Key (if not Ollama) */}
              {embeddingProvider !== 'ollama' && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Key className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>{t.propertyPanel.embeddingApiKey}</span>
                    </label>
                    {inheritedEmbeddingKey && !embeddingConfig.apiKey && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        {t.propertyPanel.embeddingApiKeyInheritHint} {embeddingProvider}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showEmbeddingApiKey ? 'text' : 'password'}
                      value={embeddingConfig.apiKey || ''}
                      onChange={(e) => updateEmbeddingConfig({ apiKey: e.target.value })}
                      placeholder={
                        inheritedEmbeddingKey
                          ? `●●●●●●●●●●●● (${t.propertyPanel.embeddingApiKeyInheritHint} ${embeddingProvider})`
                          : t.propertyPanel.embeddingApiKeyPlaceholder
                      }
                      className="w-full pl-2.5 pr-8 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEmbeddingApiKey(!showEmbeddingApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      {showEmbeddingApiKey ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Cross-Encoder Reranker Section (Phase 4) ── */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 overflow-hidden shadow-2xs">
          <div
            className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
            onClick={() => updateRerankConfig({ enabled: !isRerankEnabled })}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
              <div>
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 block">
                  {t.propertyPanel.rerankConfig}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block leading-tight">
                  {t.propertyPanel.rerankToggleDesc}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isRerankEnabled}
              onChange={(e) => updateRerankConfig({ enabled: e.target.checked })}
              className="accent-violet-600 cursor-pointer w-4 h-4 rounded shrink-0"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {isRerankEnabled && (
            <div className="p-3 border-t border-slate-200/80 dark:border-slate-800/80 space-y-3 bg-white/60 dark:bg-slate-950/40">
              {/* Protocol */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  {t.propertyPanel.rerankProtocol}
                </label>
                <select
                  value={protocol}
                  onChange={(e) => handleProtocolChange(e.target.value as RerankProtocol)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 cursor-pointer"
                >
                  {(Object.keys(PROTOCOL_PRESETS) as RerankProtocol[]).map((p) => (
                    <option key={p} value={p}>
                      {PROTOCOL_PRESETS[p]?.label ?? p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Base URL */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  {t.propertyPanel.rerankBaseUrl}
                </label>
                <input
                  type="text"
                  value={rerankConfig.baseUrl || ''}
                  onChange={(e) => updateRerankConfig({ baseUrl: e.target.value })}
                  placeholder={PROTOCOL_PRESETS[protocol]?.baseUrl}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                />
              </div>

              {/* Model */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  {t.propertyPanel.rerankModel}
                </label>
                <input
                  type="text"
                  value={rerankConfig.model || ''}
                  onChange={(e) => updateRerankConfig({ model: e.target.value })}
                  placeholder={PROTOCOL_PRESETS[protocol]?.model}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                />
              </div>

              {/* API Key (if not TEI) */}
              {protocol !== 'tei' && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Key className="w-3 h-3 text-slate-400" />
                      <span>{t.propertyPanel.rerankApiKey}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-0.5 cursor-pointer"
                    >
                      {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showApiKey ? (language === 'zh' ? '隐藏' : 'Hide') : (language === 'zh' ? '显示' : 'Show')}</span>
                    </button>
                  </div>
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={rerankConfig.apiKey || ''}
                    onChange={(e) => updateRerankConfig({ apiKey: e.target.value })}
                    placeholder={
                      inheritedKey
                        ? t.propertyPanel.rerankApiKeyPlaceholder
                        : 'sk-...'
                    }
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  />
                  {!rerankConfig.apiKey && inheritedKey && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block font-mono">
                      ✨ {t.propertyPanel.rerankApiKeyInheritHint}{' '}
                      {settingsProviders['siliconflow']?.apiKey ? 'SiliconFlow' : 'OpenAI'}
                    </span>
                  )}
                </div>
              )}

              {/* Top-N Slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                    {t.propertyPanel.rerankTopN}
                  </label>
                  <span className="font-mono text-violet-600 dark:text-violet-400 font-semibold text-xs">
                    {typeof rerankConfig.topN === 'number' ? rerankConfig.topN : (config['topK'] as number) || 3}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={typeof rerankConfig.topN === 'number' ? rerankConfig.topN : (config['topK'] as number) || 3}
                  onChange={(e) => updateRerankConfig({ topN: parseInt(e.target.value, 10) })}
                  className="w-full accent-violet-600 dark:accent-violet-400 bg-slate-200 dark:bg-slate-950 cursor-pointer h-1.5"
                />
              </div>

              {/* Rerank Score Threshold */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                    {t.propertyPanel.rerankScoreThreshold}
                  </label>
                  <span className="font-mono text-violet-600 dark:text-violet-400 font-semibold text-xs">
                    {typeof rerankConfig.scoreThreshold === 'number' ? rerankConfig.scoreThreshold : 0.0}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={typeof rerankConfig.scoreThreshold === 'number' ? rerankConfig.scoreThreshold : 0.0}
                  onChange={(e) => updateRerankConfig({ scoreThreshold: parseFloat(e.target.value) })}
                  className="w-full accent-violet-600 dark:accent-violet-400 bg-slate-200 dark:bg-slate-950 cursor-pointer h-1.5"
                />
              </div>

              {/* Candidate Pool Size */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300" title={t.propertyPanel.rerankCandidatePoolHelp}>
                    {t.propertyPanel.rerankCandidatePoolSize}
                  </label>
                  <span className="font-mono text-violet-600 dark:text-violet-400 font-semibold text-xs">
                    {typeof rerankConfig.candidatePoolSize === 'number' ? rerankConfig.candidatePoolSize : 15}
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="1"
                  value={typeof rerankConfig.candidatePoolSize === 'number' ? rerankConfig.candidatePoolSize : 15}
                  onChange={(e) => updateRerankConfig({ candidatePoolSize: parseInt(e.target.value, 10) })}
                  className="w-full accent-violet-600 dark:accent-violet-400 bg-slate-200 dark:bg-slate-950 cursor-pointer h-1.5"
                />
              </div>
            </div>
          )}
        </div>

        {/* Attribution / Output format hint */}
        <div className="p-2.5 rounded-lg bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200/60 dark:border-cyan-500/20 text-[11px] text-cyan-800 dark:text-cyan-300 leading-relaxed">
          {t.propertyPanel.knowledgeAttributionHint}
        </div>
      </div>
    </div>
  );
};
