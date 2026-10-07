/**
 * @file    src/components/panels/properties/KnowledgeResultView.tsx
 * @version 1.0.0
 * @description
 *   Dedicated inspection view for Knowledge Retrieval Node outputs.
 *   Visualizes Cross-Encoder rank transitions (original_rank -> rerank_rank),
 *   rank delta leaps (promoted/demoted), coarse vs rerank score comparison,
 *   and graceful degradation airbag status.
 */

import React, { useState } from 'react';
import {
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  FileText,
  Check,
  Copy,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation.ts';
import type { KnowledgeRetrievalChunk } from '../../../services/storage/knowledge-adapter.ts';

interface KnowledgeResultViewProps {
  outputs: Record<string, unknown>;
}

export const KnowledgeResultView: React.FC<KnowledgeResultViewProps> = ({ outputs }) => {
  const { t, language } = useTranslation();
  const [viewMode, setViewMode] = useState<'chunks' | 'context'>('chunks');
  const [expandedChunks, setExpandedChunks] = useState<Record<string, boolean>>({});
  const [copiedContext, setCopiedContext] = useState(false);

  const rawChunks = Array.isArray(outputs['chunks'])
    ? (outputs['chunks'] as KnowledgeRetrievalChunk[])
    : [];
  const rawContext = typeof outputs['context'] === 'string'
    ? (outputs['context'] as string)
    : typeof outputs['result'] === 'string'
      ? (outputs['result'] as string)
      : '';

  const hasChunks = rawChunks.length > 0;
  const hasRerankScore = rawChunks.some((c) => typeof c.rerank_score === 'number');
  const isAirbagFallback =
    hasChunks &&
    !hasRerankScore &&
    Boolean((outputs['rerank'] as { enabled?: boolean } | undefined)?.enabled);

  const toggleChunkExpand = (id: string) => {
    setExpandedChunks((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyContext = () => {
    if (!rawContext) return;
    navigator.clipboard.writeText(rawContext);
    setCopiedContext(true);
    setTimeout(() => setCopiedContext(false), 2000);
  };

  return (
    <div className="space-y-3">
      {/* ── View Mode Switcher & Summary Bar ── */}
      <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode('chunks')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              viewMode === 'chunks'
                ? 'bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 shadow-xs border border-slate-200/60 dark:border-slate-700/60'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t.propertyPanel.showChunksView}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-200/60 dark:bg-slate-700/60">
              {rawChunks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('context')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              viewMode === 'context'
                ? 'bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 shadow-xs border border-slate-200/60 dark:border-slate-700/60'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t.propertyPanel.showContextView}</span>
          </button>
        </div>

        {/* Status Indicator Pill */}
        {hasRerankScore ? (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 text-[10px] font-bold shrink-0">
            <Sparkles className="w-3 h-3" />
            <span>{t.propertyPanel.rerankBadgeOn}</span>
          </span>
        ) : isAirbagFallback ? (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold shrink-0">
            <AlertTriangle className="w-3 h-3" />
            <span>{t.propertyPanel.rerankAirbagActive}</span>
          </span>
        ) : null}
      </div>

      {/* ── View 1: Chunks & Rank Transition Inspector ── */}
      {viewMode === 'chunks' && (
        <div className="space-y-2.5">
          {rawChunks.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 italic">
              {language === 'zh' ? '知识库未召回任何相关切片。' : 'No matching chunks recalled from knowledge base.'}
            </div>
          ) : (
            rawChunks.map((chunk, index) => {
              const chunkId = chunk.id || `chunk-${index}`;
              const isExpanded = expandedChunks[chunkId] ?? (index === 0);
              const rankDelta = chunk.rank_delta ?? 0;
              const hasDelta = typeof chunk.rank_delta === 'number';

              return (
                <div
                  key={chunkId}
                  className="rounded-xl bg-white dark:bg-slate-950 border border-slate-200/90 dark:border-slate-800/90 overflow-hidden shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  {/* Chunk Header */}
                  <div
                    onClick={() => toggleChunkExpand(chunkId)}
                    className="p-3 flex items-center justify-between gap-2.5 cursor-pointer bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-100/50 dark:hover:bg-slate-900/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Rank Index Pill */}
                      <span className="w-5 h-5 rounded-md bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 flex items-center justify-center font-mono font-bold text-[10px] shrink-0">
                        #{chunk.rerank_rank ?? index + 1}
                      </span>

                      {/* Rank Delta Badge (when reranked) */}
                      {hasDelta && (
                        <div
                          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 border ${
                            rankDelta > 0
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : rankDelta < 0
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}
                          title={
                            language === 'zh'
                              ? `粗排名次: #${chunk.original_rank} ➔ 精排名次: #${chunk.rerank_rank} (变化: ${rankDelta > 0 ? `+${rankDelta}` : rankDelta})`
                              : `Coarse Rank: #${chunk.original_rank} ➔ Rerank: #${chunk.rerank_rank} (Delta: ${rankDelta > 0 ? `+${rankDelta}` : rankDelta})`
                          }
                        >
                          {rankDelta > 0 ? (
                            <>
                              <ArrowUpRight className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>+{rankDelta}</span>
                            </>
                          ) : rankDelta < 0 ? (
                            <>
                              <ArrowDownRight className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              <span>{rankDelta}</span>
                            </>
                          ) : (
                            <>
                              <Minus className="w-3 h-3 text-slate-400" />
                              <span>0</span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Doc name & position */}
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {chunk.doc_name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        Pos #{chunk.position}
                      </span>
                    </div>

                    {/* Scores & Expand icon */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {typeof chunk.rerank_score === 'number' && (
                        <span className="px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 font-mono text-[10px] font-bold">
                          Rerank {chunk.rerank_score.toFixed(4)}
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[10px]">
                        Sim {chunk.similarity.toFixed(2)}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Chunk Expanded Content */}
                  {isExpanded && (
                    <div className="p-3 border-t border-slate-100 dark:border-slate-900 space-y-2 bg-white dark:bg-slate-950">
                      {/* Telemetry metadata tags */}
                      <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono text-slate-500">
                        {typeof chunk.token_count === 'number' && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            {chunk.token_count} tokens
                          </span>
                        )}
                        {typeof chunk.bm25_score === 'number' && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            BM25: {chunk.bm25_score.toFixed(2)}
                          </span>
                        )}
                        {typeof chunk.dense_score === 'number' && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            Dense: {chunk.dense_score.toFixed(2)}
                          </span>
                        )}
                        {typeof chunk.rrf_score === 'number' && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                            RRF: {chunk.rrf_score.toFixed(4)}
                          </span>
                        )}
                        {chunk.matched_terms && chunk.matched_terms.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                            Terms: {chunk.matched_terms.join(', ')}
                          </span>
                        )}
                      </div>

                      {/* Content excerpt */}
                      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-black/30 border border-slate-200/60 dark:border-slate-800/60 font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                        {chunk.content}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── View 2: Raw Context Text Viewer ── */}
      {viewMode === 'context' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
              {language === 'zh' ? '完整组装上下文 (Markdown)' : 'Assembled Context (Markdown)'}
            </span>
            <button
              type="button"
              onClick={handleCopyContext}
              className="flex items-center gap-1 text-[10px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-2xs"
            >
              {copiedContext ? (
                <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>{copiedContext ? (language === 'zh' ? '已复制' : 'Copied') : (language === 'zh' ? '复制上下文' : 'Copy Context')}</span>
            </button>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-800 dark:text-slate-200 max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-xs">
            {rawContext || <span className="text-slate-400 italic">Empty context.</span>}
          </div>
        </div>
      )}
    </div>
  );
};
