import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Globe,
  KeyRound,
  Terminal,
  Sun,
  Moon,
  Server,
  Cpu,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  ExternalLink,
  RefreshCw,
  Search,
  Download,
  Trash2,
  ArrowDownToLine,
  Clock,
  Radio,
  Layers,
  Code,
  Copy,
  Check,
  CheckCircle,
} from 'lucide-react';
import {
  useSettingsStore,
  type ProviderId,
  DEFAULT_PROVIDERS,
} from '../../stores/settings-store.ts';
import { useWorkflowStore } from '../../stores/workflow-store.ts';
import { useLogStore } from '../../stores/log-store.ts';
import { useTranslation } from '../../i18n/useTranslation.ts';
import { CatLogo } from '../icons/CatLogo.tsx';
import type { LogLevel, LogType } from '../../engine/logger.ts';

const PROVIDER_DOCS: Record<ProviderId, { label: string; url: string }> = {
  openai: { label: 'OpenAI API Keys', url: 'https://platform.openai.com/api-keys' },
  deepseek: { label: 'DeepSeek API Keys', url: 'https://platform.deepseek.com/api_keys' },
  siliconflow: { label: 'SiliconFlow API Keys', url: 'https://cloud.siliconflow.cn/account/ak' },
  google: { label: 'Google AI Studio Keys', url: 'https://aistudio.google.com/app/apikey' },
  ollama: { label: 'Ollama Documentation', url: 'https://ollama.com/' },
  custom: { label: 'OpenAI-Compatible Guide', url: 'https://github.com/gu0bug/PatchCat' },
};

const TYPE_ICONS: Record<LogType, { icon: React.FC<{ className?: string }>; color: string }> = {
  system: { icon: Layers, color: 'text-sky-500' },
  request: { icon: Radio, color: 'text-amber-500' },
  node: { icon: Cpu, color: 'text-indigo-500' },
  error: { icon: AlertCircle, color: 'text-rose-500' },
  security: { icon: ShieldCheck, color: 'text-emerald-500' },
};

export const SettingsPage: React.FC = () => {
  const { t, language, setLanguage } = useTranslation();

  const setCurrentView = useSettingsStore((s) => s.setCurrentView);
  const settingsTab = useSettingsStore((s) => s.settingsTab);
  const setSettingsTab = useSettingsStore((s) => s.setSettingsTab);
  const activeProvider = useSettingsStore((s) => s.activeProvider);
  const setActiveProvider = useSettingsStore((s) => s.setActiveProvider);
  const providers = useSettingsStore((s) => s.providers);
  const updateProviderConfig = useSettingsStore((s) => s.updateProviderConfig);
  const resetProviderConfig = useSettingsStore((s) => s.resetProviderConfig);
  const testResults = useSettingsStore((s) => s.testResults);
  const testConnection = useSettingsStore((s) => s.testConnection);
  const fetchAvailableModels = useSettingsStore((s) => s.fetchAvailableModels);

  const theme = useWorkflowStore((s) => s.theme);
  const setTheme = useWorkflowStore((s) => s.setTheme);
  const engineMode = useWorkflowStore((s) => s.engineMode);
  const setEngineMode = useWorkflowStore((s) => s.setEngineMode);

  // Log store
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

  // Local state
  const [selectedProviderTab, setSelectedProviderTab] = useState<ProviderId>(activeProvider);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const logListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logListRef.current) {
      logListRef.current.scrollTop = logListRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const currentProviderConfig = providers[selectedProviderTab] || DEFAULT_PROVIDERS[selectedProviderTab];
  const currentTest = testResults[selectedProviderTab] || { status: 'idle' };
  const isOllama = selectedProviderTab === 'ollama';
  const isSelectedProviderActive = activeProvider === selectedProviderTab;

  const handleTest = async () => {
    await testConnection(selectedProviderTab);
  };

  const handleCopyPayload = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedTypeFilter !== 'all' && log.type !== selectedTypeFilter) {
        return false;
      }
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

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-[#080C14] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200 overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/90 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentView('canvas')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all hover:scale-102 active:scale-98 shadow-xs"
          >
            <ArrowLeft className="w-4 h-4 text-blue-600 dark:text-sky-400" />
            <span>{t.common.backToCanvas}</span>
          </button>

          <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

          <div className="flex items-center gap-2.5">
            <CatLogo className="w-7 h-7" />
            <div className="flex flex-col">
              <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white font-mono uppercase">
                PATCH<span className="text-blue-600 dark:text-sky-400">CAT</span>
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">
                {t.settings.pageTitle}
              </span>
            </div>
          </div>
        </div>

        {/* Right tools: Language Pill, Theme switcher */}
        <div className="flex items-center gap-3">
          {/* Quick Language switch buttons */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium">
            <button
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                language === 'en'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-sky-400 font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('zh')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                language === 'zh'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-sky-400 font-bold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              中文
            </button>
          </div>

          {/* Theme button */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition-all shadow-xs"
            title={theme === 'dark' ? t.header.themeTooltipLight : t.header.themeTooltipDark}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>
        </div>
      </header>

      {/* Main Settings Body */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Left Navigation Tabs */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-slate-950/40 p-4 shrink-0 flex md:flex-col gap-1.5 overflow-x-auto md:overflow-y-auto">
          <div className="hidden md:block mb-3 px-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
              {t.settings.pageTitle}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {t.settings.pageSubtitle}
            </p>
          </div>

          <button
            onClick={() => setSettingsTab('general')}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left whitespace-nowrap ${
              settingsTab === 'general'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <Globe className="w-4 h-4" />
            <div className="flex-1 min-w-0">
              <span className="block">{t.settings.tabGeneral}</span>
            </div>
          </button>

          <button
            onClick={() => setSettingsTab('providers')}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left whitespace-nowrap ${
              settingsTab === 'providers'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <div className="flex-1 min-w-0">
              <span className="block">{t.settings.tabProviders}</span>
            </div>
          </button>

          <button
            onClick={() => setSettingsTab('logs')}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left whitespace-nowrap ${
              settingsTab === 'logs'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <div className="flex-1 min-w-0 flex items-center justify-between">
              <span>{t.settings.tabLogs}</span>
              {logs.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    settingsTab === 'logs' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {logs.length}
                </span>
              )}
            </div>
          </button>
        </aside>

        {/* Right Content Area */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 min-h-0 bg-slate-50/50 dark:bg-slate-950/20">
          {/* TAB 1: General & Language */}
          {settingsTab === 'general' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-150">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t.settings.generalTitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t.settings.generalDesc}
                </p>
              </div>

              {/* Language Preference */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5">
                  <Globe className="w-5 h-5 text-blue-600 dark:text-sky-400" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {t.settings.languageSection}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.settings.languageSectionDesc}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={() => setLanguage('en')}
                    className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all ${
                      language === 'en'
                        ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/30 text-blue-900 dark:text-sky-300 ring-2 ring-blue-600/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm">English</div>
                      <div className="text-xs opacity-75 mt-0.5">United States (Default)</div>
                    </div>
                    {language === 'en' && <CheckCircle className="w-5 h-5 text-blue-600 dark:text-sky-400" />}
                  </button>

                  <button
                    onClick={() => setLanguage('zh')}
                    className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all ${
                      language === 'zh'
                        ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/30 text-blue-900 dark:text-sky-300 ring-2 ring-blue-600/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm">简体中文</div>
                      <div className="text-xs opacity-75 mt-0.5">Simplified Chinese</div>
                    </div>
                    {language === 'zh' && <CheckCircle className="w-5 h-5 text-blue-600 dark:text-sky-400" />}
                  </button>
                </div>
              </div>

              {/* Theme Preference */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5">
                  <Sun className="w-5 h-5 text-amber-500" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {t.settings.themeSection}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.settings.themeSectionDesc}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={() => setTheme('light')}
                    className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all ${
                      theme === 'light'
                        ? 'border-blue-600 bg-blue-50/80 text-blue-900 ring-2 ring-blue-600/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm">{t.settings.themeLight}</div>
                      <div className="text-xs opacity-75 mt-0.5">Clean Slate / Indigo Visuals</div>
                    </div>
                    {theme === 'light' && <CheckCircle className="w-5 h-5 text-blue-600" />}
                  </button>

                  <button
                    onClick={() => setTheme('dark')}
                    className={`p-4 rounded-xl border text-left flex items-center justify-between transition-all ${
                      theme === 'dark'
                        ? 'border-blue-500 bg-blue-950/40 text-sky-300 ring-2 ring-blue-500/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm">{t.settings.themeDark}</div>
                      <div className="text-xs opacity-75 mt-0.5">Cyberpunk Slate / Neon Glow</div>
                    </div>
                    {theme === 'dark' && <CheckCircle className="w-5 h-5 text-sky-400" />}
                  </button>
                </div>
              </div>

              {/* Execution Engine Mode */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5">
                  <Cpu className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {t.settings.engineSection}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.settings.engineSectionDesc}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={() => setEngineMode('byok_browser')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      engineMode === 'byok_browser'
                        ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/30 text-blue-900 dark:text-sky-300 ring-2 ring-blue-600/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-sm">{t.settings.engineBrowser}</div>
                      {engineMode === 'byok_browser' && <CheckCircle className="w-4 h-4 text-blue-600 dark:text-sky-400" />}
                    </div>
                    <div className="text-xs opacity-75 mt-1 leading-relaxed">{t.settings.engineBrowserDesc}</div>
                  </button>

                  <button
                    onClick={() => setEngineMode('mock')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      engineMode === 'mock'
                        ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/30 text-blue-900 dark:text-sky-300 ring-2 ring-blue-600/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-sm">{t.settings.engineMock}</div>
                      {engineMode === 'mock' && <CheckCircle className="w-4 h-4 text-blue-600 dark:text-sky-400" />}
                    </div>
                    <div className="text-xs opacity-75 mt-1 leading-relaxed">{t.settings.engineMockDesc}</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LLM Providers & API Keys */}
          {settingsTab === 'providers' && (
            <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-150">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t.settings.providersTitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t.settings.providersSubtitle}
                </p>
              </div>

              {/* Providers Tab Container */}
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col md:flex-row">
                {/* Providers Sub-Sidebar */}
                <div className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-3 space-y-1.5 bg-slate-50/50 dark:bg-slate-950/40">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-1">
                    Providers
                  </span>
                  {(Object.keys(DEFAULT_PROVIDERS) as ProviderId[]).map((pid) => {
                    const p = providers[pid] || DEFAULT_PROVIDERS[pid];
                    const isSelected = selectedProviderTab === pid;
                    const isPActive = activeProvider === pid;
                    const hasKey = p.id === 'ollama' ? true : p.apiKey.trim().length > 0;

                    return (
                      <button
                        key={pid}
                        onClick={() => {
                          setSelectedProviderTab(pid);
                          setShowApiKey(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                            : 'hover:bg-slate-200/70 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="truncate">{p.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isPActive && (
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-blue-50 dark:bg-sky-500/20 text-blue-600 dark:text-sky-300 border border-blue-200 dark:border-sky-500/30'
                              }`}
                            >
                              {t.common.active}
                            </span>
                          )}
                          {hasKey && !isPActive && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500" title={t.header.apiKeyConfigured} />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Form Content */}
                <div className="flex-1 p-6 space-y-6">
                  {/* Active Status Badge */}
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3.5 h-3.5 rounded-full ${
                          isSelectedProviderActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      />
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {currentProviderConfig.name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {currentProviderConfig.description}
                        </p>
                      </div>
                    </div>

                    {!isSelectedProviderActive ? (
                      <button
                        onClick={() => setActiveProvider(selectedProviderTab)}
                        className="px-3.5 py-1.5 rounded-lg bg-blue-50 dark:bg-sky-500/10 hover:bg-blue-100 dark:hover:bg-sky-500/20 text-blue-600 dark:text-sky-300 border border-blue-200 dark:border-sky-500/30 text-xs font-semibold transition-all shadow-xs"
                      >
                        {t.settings.setAsActive}
                      </button>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-200 dark:border-emerald-500/30">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t.settings.currentActive}</span>
                      </span>
                    )}
                  </div>

                  {/* Base URL */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Server className="w-3.5 h-3.5 text-blue-500 dark:text-sky-400" />
                        <span>{t.settings.apiBaseUrl}</span>
                      </label>
                      <button
                        onClick={() =>
                          updateProviderConfig(selectedProviderTab, {
                            baseUrl: DEFAULT_PROVIDERS[selectedProviderTab].baseUrl,
                          })
                        }
                        className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
                        title={t.settings.resetEndpoint}
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{t.settings.resetEndpoint}</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={currentProviderConfig.baseUrl}
                      onChange={(e) =>
                        updateProviderConfig(selectedProviderTab, { baseUrl: e.target.value })
                      }
                      placeholder="https://api.openai.com/v1"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>

                  {/* API Key */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                        <span>
                          {t.settings.apiKeyLabel} {isOllama && t.settings.ollamaNoKeyNeeded}
                        </span>
                      </label>
                      {PROVIDER_DOCS[selectedProviderTab] && (
                        <a
                          href={PROVIDER_DOCS[selectedProviderTab].url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-blue-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                        >
                          <span>{t.settings.getKey}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <div className="relative">
                      <input
                        type={showApiKey || isOllama ? 'text' : 'password'}
                        disabled={isOllama}
                        value={currentProviderConfig.apiKey}
                        onChange={(e) =>
                          updateProviderConfig(selectedProviderTab, { apiKey: e.target.value })
                        }
                        placeholder={
                          isOllama ? 'ollama (built-in default)' : 'sk-xxxxxxxxxxxxxxxxxxxxxxxx'
                        }
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-60 transition-all"
                      />
                      {!isOllama && (
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Default Model */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                        <span>{t.settings.defaultModel}</span>
                        {currentProviderConfig.availableModels && currentProviderConfig.availableModels.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 font-mono">
                            {currentProviderConfig.availableModels.length} {t.settings.availableCount}
                          </span>
                        )}
                      </label>

                      <button
                        type="button"
                        onClick={async () => {
                          setIsRefreshingModels(true);
                          await fetchAvailableModels(selectedProviderTab);
                          setIsRefreshingModels(false);
                        }}
                        disabled={isRefreshingModels || (!isOllama && !currentProviderConfig.apiKey.trim())}
                        className="text-[11px] text-blue-600 dark:text-sky-400 hover:text-blue-700 dark:hover:text-sky-300 disabled:opacity-40 flex items-center gap-1 transition-colors"
                        title={t.settings.fetchModels}
                      >
                        <RefreshCw className={`w-3 h-3 ${isRefreshingModels ? 'animate-spin' : ''}`} />
                        <span>{isRefreshingModels ? t.propertyPanel.refreshing : t.settings.fetchModels}</span>
                      </button>
                    </div>

                    {currentProviderConfig.availableModels && currentProviderConfig.availableModels.length > 0 ? (
                      <div className="space-y-2">
                        <select
                          value={currentProviderConfig.defaultModel}
                          onChange={(e) =>
                            updateProviderConfig(selectedProviderTab, { defaultModel: e.target.value })
                          }
                          className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                        >
                          {currentProviderConfig.availableModels.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <span>{t.settings.orCustomModel}</span>
                          <input
                            type="text"
                            value={currentProviderConfig.defaultModel}
                            onChange={(e) =>
                              updateProviderConfig(selectedProviderTab, { defaultModel: e.target.value })
                            }
                            placeholder={t.settings.orCustomModel}
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={currentProviderConfig.defaultModel}
                        onChange={(e) =>
                          updateProviderConfig(selectedProviderTab, { defaultModel: e.target.value })
                        }
                        placeholder="gpt-4o-mini"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      />
                    )}
                  </div>

                  {/* Actions & Connection Test */}
                  <div className="pt-2">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleTest}
                        disabled={currentTest.status === 'testing'}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-medium transition-all disabled:opacity-50 shadow-xs"
                      >
                        {currentTest.status === 'testing' ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4 text-amber-400" />
                        )}
                        <span>{currentTest.status === 'testing' ? t.settings.testingConnection : t.settings.testConnection}</span>
                      </button>

                      <button
                        onClick={() => resetProviderConfig(selectedProviderTab)}
                        className="px-3.5 py-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white text-xs transition-colors"
                      >
                        {t.settings.resetProvider}
                      </button>
                    </div>

                    {/* Test Result Message Box */}
                    {currentTest.status !== 'idle' && (
                      <div
                        className={`mt-4 p-3.5 rounded-xl border text-xs font-mono flex items-start gap-3 ${
                          currentTest.status === 'testing'
                            ? 'bg-blue-50 dark:bg-sky-500/10 border-blue-200 dark:border-sky-500/30 text-blue-700 dark:text-sky-300'
                            : currentTest.status === 'success'
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {currentTest.status === 'testing' && <Loader2 className="w-4 h-4 animate-spin shrink-0 mt-0.5" />}
                        {currentTest.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />}
                        {currentTest.status === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">{currentTest.message || (currentTest.status === 'testing' ? t.settings.testingConnection : '')}</p>
                          {currentTest.latencyMs !== undefined && (
                            <span className="text-[10px] opacity-80 block mt-0.5">Latency: {currentTest.latencyMs}ms</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Privacy Banner */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{t.settings.privacyNotice}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Execution Logs */}
          {settingsTab === 'logs' && (
            <div className="h-full flex flex-col space-y-4 max-w-6xl mx-auto animate-in fade-in duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-blue-500" />
                    <span>{t.settings.logsTitle}</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {t.settings.logsSubtitle}
                  </p>
                </div>

                {/* Log Level Selector */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">{t.settings.logLevel}</span>
                  <select
                    value={logLevel}
                    onChange={(e) => setLogLevel(e.target.value as LogLevel)}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                  >
                    <option value="summary">{t.settings.levelSummary}</option>
                    <option value="detailed">{t.settings.levelDetailed}</option>
                    <option value="dev">{t.settings.levelDev}</option>
                  </select>
                </div>
              </div>

              {/* Log Console Container */}
              <div className="flex-1 flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden min-h-[400px]">
                {/* Search & Actions Toolbar */}
                <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-950/40 text-xs shrink-0">
                  {/* Category Filter Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    <button
                      onClick={() => setSelectedTypeFilter('all')}
                      className={`px-2.5 py-1 rounded-lg transition-all ${
                        selectedTypeFilter === 'all'
                          ? 'bg-blue-600 text-white font-semibold shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {t.settings.filterAll} ({countsByType.all})
                    </button>

                    {(['system', 'request', 'node', 'error'] as LogType[]).map((type) => {
                      const conf = TYPE_ICONS[type];
                      const Icon = conf.icon;
                      const count = countsByType[type];
                      const active = selectedTypeFilter === type;

                      const labelMap: Record<LogType, string> = {
                        system: t.settings.filterSystem,
                        request: t.settings.filterRequest,
                        node: t.settings.filterNode,
                        error: t.settings.filterError,
                        security: 'Security',
                      };

                      return (
                        <button
                          key={type}
                          onClick={() => setSelectedTypeFilter(type)}
                          className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                            active
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <Icon className={`w-3.5 h-3.5 ${conf.color}`} />
                          <span>{labelMap[type]}</span>
                          <span className="font-mono text-[10px] opacity-75">({count})</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Search and Action buttons */}
                  <div className="flex items-center gap-2 ml-auto">
                    <div className="relative w-48 sm:w-60">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t.settings.searchLogsPlaceholder}
                        className="w-full pl-8 pr-3 py-1 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <button
                      onClick={() => setAutoScroll(!autoScroll)}
                      className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-all ${
                        autoScroll
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-sky-400 border-blue-200 dark:border-blue-700'
                          : 'text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      title={t.settings.autoScroll}
                    >
                      <ArrowDownToLine className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={clearLogs}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                      title={t.settings.clearLogs}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Export Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 text-xs transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{t.settings.exportLogs}</span>
                      </button>

                      {isExportMenuOpen && (
                        <div className="absolute right-0 top-full mt-1.5 w-36 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl py-1 z-50 text-xs">
                          <button
                            onClick={() => {
                              exportLogs('json');
                              setIsExportMenuOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>JSON</span>
                            <span className="text-[10px] text-slate-400 font-mono">.json</span>
                          </button>
                          <button
                            onClick={() => {
                              exportLogs('txt');
                              setIsExportMenuOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between"
                          >
                            <span>Text</span>
                            <span className="text-[10px] text-slate-400 font-mono">.txt</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Log List View */}
                <div
                  ref={logListRef}
                  className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1.5 bg-slate-950 text-slate-200 select-text"
                >
                  {filteredLogs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2 py-16 select-none">
                      <Terminal className="w-10 h-10 stroke-[1.2] opacity-40" />
                      <span className="font-semibold text-sm">{t.settings.noLogsMatch}</span>
                      <span className="text-xs text-slate-600 max-w-sm text-center">
                        {t.settings.noLogsHint}
                      </span>
                    </div>
                  ) : (
                    filteredLogs.map((log) => {
                      const typeConf = TYPE_ICONS[log.type] || TYPE_ICONS.system;
                      const TypeIcon = typeConf.icon;
                      const timeStr = new Date(log.timestamp).toISOString().slice(11, 23);
                      const isExpanded = expandedLogId === log.id;
                      const hasPayload = Boolean(log.data?.inputs || log.data?.outputs || log.metadata);

                      return (
                        <div
                          key={log.id}
                          className={`p-2 rounded-lg border transition-colors ${
                            log.type === 'error'
                              ? 'bg-rose-950/30 border-rose-900/50 text-rose-300'
                              : log.level === 'dev'
                              ? 'bg-slate-900/80 border-slate-800 hover:bg-slate-850 text-slate-200'
                              : 'bg-transparent border-transparent hover:bg-slate-900/50 text-slate-300'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 leading-relaxed">
                            <span className="text-[10px] text-slate-500 shrink-0 font-mono pt-0.5">
                              {timeStr}
                            </span>

                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border shrink-0 font-mono bg-blue-950/60 text-sky-300 border-blue-800/40">
                              {log.level}
                            </span>

                            <span className="flex items-center gap-1 text-[11px] font-semibold shrink-0">
                              <TypeIcon className={`w-3.5 h-3.5 ${typeConf.color}`} />
                              <span className="text-slate-400">[{log.source}]</span>
                            </span>

                            {log.nodeId && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40 shrink-0 font-mono">
                                #{log.nodeId}
                              </span>
                            )}

                            {log.durationMs !== undefined && (
                              <span className="text-[10px] px-1 py-0.2 rounded bg-blue-950/60 text-sky-300 border border-blue-800/40 shrink-0 font-mono flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                <span>{log.durationMs}ms</span>
                              </span>
                            )}

                            <span className="flex-1 break-all select-text font-mono text-xs">
                              {log.message}
                            </span>

                            {hasPayload && (
                              <button
                                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-750 transition-colors shrink-0"
                              >
                                <Code className="w-3 h-3" />
                                <span>{isExpanded ? t.settings.hideDetails : t.settings.showDetails}</span>
                              </button>
                            )}
                          </div>

                          {/* Expanded JSON payload */}
                          {isExpanded && (
                            <div className="mt-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-2.5 relative">
                              <div className="flex items-center justify-between text-[10px] text-slate-500 border-b border-slate-850 pb-1.5">
                                <span>Payload Data ({t.settings.secretMaskedNotice})</span>
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
                                      <span className="text-emerald-400">{t.common.copied}</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>{t.settings.copyPayloadJson}</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              {log.metadata && (
                                <div>
                                  <div className="text-[10px] font-semibold text-slate-400 mb-0.5">Metadata:</div>
                                  <pre className="p-2.5 rounded-lg bg-slate-900 text-amber-300 overflow-x-auto max-h-40 whitespace-pre-wrap">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}

                              {log.data?.inputs !== undefined && (
                                <div>
                                  <div className="text-[10px] font-semibold text-sky-400 mb-0.5">Inputs:</div>
                                  <pre className="p-2.5 rounded-lg bg-slate-900 text-sky-200 overflow-x-auto max-h-48 whitespace-pre-wrap">
                                    {JSON.stringify(log.data.inputs, null, 2)}
                                  </pre>
                                </div>
                              )}

                              {log.data?.outputs !== undefined && (
                                <div>
                                  <div className="text-[10px] font-semibold text-emerald-400 mb-0.5">Outputs:</div>
                                  <pre className="p-2.5 rounded-lg bg-slate-900 text-emerald-200 overflow-x-auto max-h-48 whitespace-pre-wrap">
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
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default SettingsPage;
