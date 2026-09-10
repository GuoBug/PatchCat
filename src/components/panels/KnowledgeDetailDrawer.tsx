import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  Trash2,
  Sliders,
  Flame,
  Check,
  AlertCircle,
  Layers,
  Database,
  RefreshCw,
  FileCode,
} from 'lucide-react';
import { useKnowledgeStore } from '../../stores/knowledge-store.ts';
import { useTranslation } from '../../i18n/useTranslation.ts';
import { parseDocumentFile } from '../../services/document-parser.ts';

export const KnowledgeDetailDrawer: React.FC = () => {
  const { t } = useTranslation();

  const isDetailOpen = useKnowledgeStore((s) => s.isDetailOpen);
  const closeDetail = useKnowledgeStore((s) => s.closeDetail);
  const knowledgeBases = useKnowledgeStore((s) => s.knowledgeBases);
  const activeKbId = useKnowledgeStore((s) => s.activeKbId);
  const documents = useKnowledgeStore((s) => s.documents);
  const activeDocId = useKnowledgeStore((s) => s.activeDocId);
  const chunks = useKnowledgeStore((s) => s.chunks);
  const isUploading = useKnowledgeStore((s) => s.isUploading);
  const selectDocument = useKnowledgeStore((s) => s.selectDocument);
  const uploadDocument = useKnowledgeStore((s) => s.uploadDocument);
  const deleteDocument = useKnowledgeStore((s) => s.deleteDocument);
  const toggleChunk = useKnowledgeStore((s) => s.toggleChunk);
  const previewChunks = useKnowledgeStore((s) => s.previewChunks);

  // Upload dropzone local state
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [chunkSize, setChunkSize] = useState<number>(500);
  const [chunkOverlap, setChunkOverlap] = useState<number>(50);
  const [parsedContent, setParsedContent] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    chars: number;
    chunks: number;
    tokens: number;
  } | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isDetailOpen) return null;

  const currentKb = knowledgeBases.find((k) => k.id === activeKbId);
  const currentDoc = documents.find((d) => d.id === activeDocId);

  // Handle file selection
  const handleFileChange = async (file: File) => {
    setSelectedFile(file);
    setUploadError(null);
    setIsPreviewing(true);

    try {
      const parsed = await parseDocumentFile(file);
      setParsedContent(parsed.text);
      const res = await previewChunks(parsed.text, { chunkSize, chunkOverlap });
      setPreviewData({
        chars: res.total_characters,
        chunks: res.total_chunks,
        tokens: res.estimated_tokens,
      });
    } catch (e: any) {
      console.warn('Failed to parse and preview document:', e);
      setUploadError(e.message || 'Failed to process document');
      setPreviewData(null);
      setParsedContent(null);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleChunkSizeChange = async (newSize: number) => {
    setChunkSize(newSize);
    if (parsedContent) {
      try {
        const res = await previewChunks(parsedContent, { chunkSize: newSize, chunkOverlap });
        setPreviewData({
          chars: res.total_characters,
          chunks: res.total_chunks,
          tokens: res.estimated_tokens,
        });
      } catch (e) {
        console.warn('Failed to update chunk size preview:', e);
      }
    }
  };

  const handleChunkOverlapChange = async (newOverlap: number) => {
    setChunkOverlap(newOverlap);
    if (parsedContent) {
      try {
        const res = await previewChunks(parsedContent, { chunkSize, chunkOverlap: newOverlap });
        setPreviewData({
          chars: res.total_characters,
          chunks: res.total_chunks,
          tokens: res.estimated_tokens,
        });
      } catch (e) {
        console.warn('Failed to update chunk overlap preview:', e);
      }
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleExecuteUpload = async () => {
    if (!selectedFile || !activeKbId) return;
    setUploadError(null);
    try {
      const ext = selectedFile.name.split('.').pop()?.toLowerCase() || '';
      if (parsedContent !== null) {
        await uploadDocument(
          activeKbId,
          {
            name: selectedFile.name,
            content: parsedContent,
            extension: ext,
            size: selectedFile.size,
          },
          { chunkSize, chunkOverlap },
        );
      } else {
        await uploadDocument(activeKbId, selectedFile, { chunkSize, chunkOverlap });
      }
      setSelectedFile(null);
      setParsedContent(null);
      setPreviewData(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload document');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
        {/* ── HEADER ── */}
        <header className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {currentKb?.name || t.knowledge.tabTitle}
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-cyan-100/80 dark:bg-cyan-900/40 text-[10px] font-mono text-cyan-700 dark:text-cyan-300 font-semibold border border-cyan-200 dark:border-cyan-800">
                  {currentKb?.embedding_model || 'text-embedding-3-small'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {currentKb?.description || t.knowledge.kbDescPlaceholder}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
              <span>
                <strong className="text-slate-800 dark:text-slate-200 font-bold">
                  {documents.length}
                </strong>{' '}
                {t.knowledge.documentsCount}
              </span>
              <span>•</span>
              <span>
                <strong className="text-slate-800 dark:text-slate-200 font-bold">
                  {currentKb?.total_chunks || 0}
                </strong>{' '}
                {t.knowledge.chunksCount}
              </span>
            </div>

            <button
              onClick={closeDetail}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ── MAIN CONTENT (SPLIT VIEW) ── */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* ── LEFT PANEL: UPLOAD & DOCUMENTS LIST ── */}
          <section className="w-full md:w-96 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 bg-slate-50/40 dark:bg-[#070A0F]/60">
            {/* Upload & Dropzone Area */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800/80 space-y-3">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/20'
                    : 'border-slate-300 dark:border-slate-700 hover:border-cyan-400 hover:bg-slate-100/50 dark:hover:bg-slate-800/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.markdown,.pdf,.html,.htm"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                />
                <Upload className="w-6 h-6 mx-auto text-cyan-600 dark:text-cyan-400 mb-1.5" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {selectedFile ? selectedFile.name : t.knowledge.dropzoneTitle}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  {t.knowledge.dropzoneSubtitle}
                </p>
              </div>

              {/* Chunking Settings Slider */}
              <div className="space-y-2 pt-1 text-xs">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1 font-medium">
                    <Sliders className="w-3.5 h-3.5 text-cyan-500" />
                    {t.knowledge.chunkSize}
                  </span>
                  <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                    {chunkSize}
                  </span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="1500"
                  step="50"
                  value={chunkSize}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    handleChunkSizeChange(val);
                  }}
                  className="w-full accent-cyan-500 cursor-pointer"
                />

                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 pt-1">
                  <span className="flex items-center gap-1 font-medium">
                    <Layers className="w-3.5 h-3.5 text-cyan-500" />
                    {t.knowledge.chunkOverlap}
                  </span>
                  <span className="font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                    {chunkOverlap}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  step="10"
                  value={chunkOverlap}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    handleChunkOverlapChange(val);
                  }}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              {/* Instant Preview & Action */}
              {selectedFile && (
                <div className="p-2.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/60 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">
                      {isPreviewing ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin inline mr-1 text-cyan-500" />
                      ) : (
                        <Check className="w-3.5 h-3.5 inline mr-1 text-emerald-500" />
                      )}
                      {t.knowledge.previewChunks}:
                    </span>
                    <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
                      {previewData?.chunks || 1} {t.knowledge.chunksCount} (~
                      {previewData?.tokens || 0} {t.knowledge.tokensCount})
                    </span>
                  </div>

                  <button
                    onClick={handleExecuteUpload}
                    disabled={isUploading}
                    className="w-full py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{t.knowledge.uploading}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>{t.knowledge.uploadDocument}</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {uploadError && (
                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>

            {/* Documents List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              <div className="px-2 py-1 text-[11px] font-semibold tracking-wider uppercase text-slate-400 dark:text-slate-500">
                {t.knowledge.manageDocuments} ({documents.length})
              </div>

              {documents.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500">
                  {t.knowledge.noDocuments}
                </div>
              ) : (
                documents.map((doc) => {
                  const isSelected = doc.id === activeDocId;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => selectDocument(doc.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                        isSelected
                          ? 'bg-cyan-50/80 dark:bg-cyan-950/40 border-cyan-300 dark:border-cyan-700/60 shadow-xs'
                          : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/80 hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <div
                          className={`p-1.5 rounded-lg ${
                            doc.file_extension === 'pdf'
                              ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          <FileText className="w-4 h-4 shrink-0" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {doc.name}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                            <span className="uppercase font-bold">{doc.file_extension}</span>
                            <span>•</span>
                            <span>
                              {doc.chunk_count} {t.knowledge.chunksCount}
                            </span>
                            <span>•</span>
                            <span>{Math.round(doc.file_size / 1024)} KB</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(t.knowledge.deleteDocConfirm)) {
                            deleteDocument(doc.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer"
                        title={t.common.delete}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* ── RIGHT PANEL: DOCUMENT CHUNKS INSPECTOR ── */}
          <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0B0F17] overflow-hidden">
            {currentDoc ? (
              <>
                {/* Chunks Toolbar */}
                <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/30 dark:bg-slate-900/20">
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {currentDoc.name}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {chunks.length} {t.knowledge.chunksCount} (Chunk Size:{' '}
                      {currentDoc.chunk_size || 500} / Overlap: {currentDoc.chunk_overlap || 50})
                    </span>
                  </div>
                </div>

                {/* Chunks List Cards */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3 min-w-0">
                  {chunks.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 text-xs">
                      {t.knowledge.noChunks}
                    </div>
                  ) : (
                    chunks.map((chunk) => {
                      return (
                        <div
                          key={chunk.id}
                          className={`p-4 rounded-xl border transition-all min-w-0 max-w-full overflow-hidden ${
                            chunk.is_active
                              ? 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
                              : 'bg-slate-100/40 dark:bg-slate-900/10 border-slate-200/60 dark:border-slate-800/40 opacity-60'
                          }`}
                        >
                          {/* Chunk Header Info */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                                #{chunk.position}
                              </span>
                              <span className="text-[11px] font-mono text-slate-400">
                                {chunk.token_count} {t.knowledge.tokensCount} (
                                {chunk.content.length} chars)
                              </span>
                              <span className="flex items-center gap-1 text-[11px] font-mono font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-500/20">
                                <Flame className="w-3 h-3 fill-amber-500 text-amber-500" />
                                {chunk.hit_count} {t.knowledge.hitCount}
                              </span>
                            </div>

                            {/* Active Toggle Switch */}
                            <button
                              onClick={() => toggleChunk(chunk.id, !chunk.is_active)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                                chunk.is_active
                                  ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                              }`}
                              title={
                                chunk.is_active
                                  ? t.knowledge.chunkActive
                                  : t.knowledge.chunkDisabled
                              }
                            >
                              <div
                                className={`w-2 h-2 rounded-full ${
                                  chunk.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                }`}
                              />
                              <span className="text-[10px]">
                                {chunk.is_active
                                  ? t.knowledge.chunkActive
                                  : t.knowledge.chunkDisabled}
                              </span>
                            </button>
                          </div>

                          {/* Chunk Content Text */}
                          <div className="p-3 rounded-lg bg-white dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap select-text break-all break-words overflow-x-hidden max-h-96 overflow-y-auto">
                            {chunk.content}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs p-8">
                <FileText className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-700 stroke-1" />
                <p className="font-medium text-slate-600 dark:text-slate-400">
                  {t.knowledge.noDocuments}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">{t.knowledge.dropzoneSubtitle}</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeDetailDrawer;
