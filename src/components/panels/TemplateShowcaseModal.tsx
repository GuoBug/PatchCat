import React, { useState, useMemo } from 'react';
import { useTranslation } from '../../i18n/useTranslation.ts';
import { useWorkflowStore } from '../../stores/workflow-store.ts';
import { PRESETS_DATA } from '../../presets/index.ts';
import {
  TEMPLATE_CATEGORIES,
  TEMPLATES_META,
  type TemplateCategory,
  type TemplateMetadata,
} from '../../presets/preset-meta.ts';
import { useReactFlow } from '@xyflow/react';

interface TemplateShowcaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate?: (key: string) => void;
}

export const TemplateShowcaseModal: React.FC<TemplateShowcaseModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  const { t, language } = useTranslation();
  const { fitView } = useReactFlow();

  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const captureSnapshot = useWorkflowStore((s) => s.captureSnapshot);

  const categories = TEMPLATE_CATEGORIES[language] || TEMPLATE_CATEGORIES.en;
  const templatesMap = TEMPLATES_META[language] || TEMPLATES_META.en;
  const presetsSuite = PRESETS_DATA[language] || PRESETS_DATA.en;

  const filteredTemplates = useMemo(() => {
    return Object.values(templatesMap).filter((item: TemplateMetadata) => {
      // 1. Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      // 2. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(query);
        const matchScenario = item.scenario.toLowerCase().includes(query);
        const matchDesc = item.shortDesc.toLowerCase().includes(query);
        const matchTags = item.tags.some((tag) => tag.toLowerCase().includes(query));
        return matchName || matchScenario || matchDesc || matchTags;
      }

      return true;
    });
  }, [templatesMap, selectedCategory, searchQuery]);

  if (!isOpen) return null;

  const handleApplyTemplate = (templateKey: string) => {
    const preset = presetsSuite[templateKey];
    if (!preset || !preset.data) return;

    captureSnapshot();

    // Deep clone nodes and edges
    const clonedNodes = JSON.parse(JSON.stringify(preset.data.nodes || []));
    const clonedEdges = JSON.parse(JSON.stringify(preset.data.edges || []));

    useWorkflowStore.setState((state) => {
      state.nodes = clonedNodes;
      state.edges = clonedEdges;
      state.selectedNodeId = null;
    });

    onClose();

    if (onSelectTemplate) {
      onSelectTemplate(templateKey);
    }

    // Smoothly fit view to show all nodes
    setTimeout(() => {
      fitView({ padding: 0.2, duration: 600 });
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl h-[85vh] max-h-[760px] flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📚</span>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {t.templateGallery.title}
              </h2>
              <p className="text-xs text-slate-400">
                {t.templateGallery.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.templateGallery.searchPlaceholder}
                className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1.5 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Close"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Main Body (Categories Sidebar + Cards Grid) */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Categories Sidebar */}
          <div className="w-56 border-r border-slate-800 bg-slate-950/40 p-3 overflow-y-auto flex flex-col gap-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase px-3 py-2">
              {language === 'zh' ? '场景分类' : 'Categories'}
            </div>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition text-left ${
                    isSelected
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span className="truncate">{cat.name}</span>
                </button>
              );
            })}
          </div>

          {/* Templates Cards Grid */}
          <div className="flex-1 p-6 overflow-y-auto bg-[#0B0F17]/50 space-y-4">
            {filteredTemplates.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <span className="text-3xl mb-2">🔍</span>
                <p className="text-sm font-medium text-slate-300">
                  {language === 'zh' ? '未找到符合条件的场景模板' : 'No templates found matching your criteria'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {language === 'zh' ? '尝试调整关键词或切换全部分类' : 'Try adjusting search query or selecting all categories'}
                </p>
              </div>
            ) : (
              filteredTemplates.map((item) => {
                const preset = presetsSuite[item.key];
                const nodeCount = preset?.data?.nodes?.length || 0;

                return (
                  <div
                    key={item.key}
                    className="bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-5 transition shadow-lg flex flex-col gap-3 group"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl p-2 bg-slate-800/80 rounded-xl border border-slate-700/60">
                          {item.icon}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition">
                              {item.name}
                            </h3>
                            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700 font-mono">
                              {t.templateGallery.nodesCount.replace('{count}', String(nodeCount))}
                            </span>
                            <span className="text-[10px] bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/20">
                              {item.difficulty}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            {item.shortDesc}
                          </p>
                        </div>
                      </div>

                      {/* Primary CTA */}
                      <button
                        onClick={() => handleApplyTemplate(item.key)}
                        className="shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/25 transition flex items-center gap-1.5"
                      >
                        <span>🚀</span>
                        <span>{t.templateGallery.useTemplateBtn}</span>
                      </button>
                    </div>

                    {/* Business Scenario Box */}
                    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs leading-relaxed text-slate-300">
                      <span className="font-semibold text-slate-400 mr-2">
                        {t.templateGallery.scenarioLabel}:
                      </span>
                      {item.scenario}
                    </div>

                    {/* Visual Pipeline Capsules */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[11px] font-medium text-slate-500 mr-1">
                        {t.templateGallery.topologyLabel}:
                      </span>
                      {item.pipelineCapsules.map((capsule, idx) => (
                        <React.Fragment key={idx}>
                          <span className="text-[11px] bg-slate-800/90 text-slate-200 px-2.5 py-0.5 rounded-full border border-slate-700/80 font-medium">
                            {capsule}
                          </span>
                          {idx < item.pipelineCapsules.length - 1 && (
                            <span className="text-slate-600 text-xs">➔</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>

                    {/* Tags */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-800/60">
                      {item.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] text-slate-400 bg-slate-800/40 px-2 py-0.5 rounded-md border border-slate-800"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
