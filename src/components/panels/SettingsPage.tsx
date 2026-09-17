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
  HardDrive,
  Sliders,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Database,
  Shield,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import {
  useSettingsStore,
  type ProviderId,
  DEFAULT_PROVIDERS,
} from '../../stores/settings-store.ts';
import { useWorkflowStore } from '../../stores/workflow-store.ts';
import { useProjectStore } from '../../stores/project-store.ts';
import { useLogStore } from '../../stores/log-store.ts';
import { useTranslation } from '../../i18n/useTranslation.ts';
import { DangerConfirmModal } from './DangerConfirmModal.tsx';
import { CatLogo } from '../icons/CatLogo.tsx';
import type { LogLevel, LogType } from '../../engine/logger.ts';
import { PROJECT_LINKS } from '../../config/project.ts';

const PROVIDER_DOCS: Record<ProviderId, { label: string; url: string }> = {
  openai: { label: 'OpenAI API Keys', url: 'https://platform.openai.com/api-keys' },
  deepseek: { label: 'DeepSeek API Keys', url: 'https://platform.deepseek.com/api_keys' },
  siliconflow: { label: 'SiliconFlow API Keys', url: 'https://cloud.siliconflow.cn/account/ak' },
  google: { label: 'Google AI Studio Keys', url: 'https://aistudio.google.com/app/apikey' },
  ollama: { label: 'Ollama Documentation', url: 'https://ollama.com/' },
  custom: { label: 'OpenAI-Compatible Guide', url: PROJECT_LINKS.guide },
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

  // Storage & Backend Mode
  const storageMode = useSettingsStore((s) => s.storageMode);
  const setStorageMode = useSettingsStore((s) => s.setStorageMode);
  const serverBaseUrl = useSettingsStore((s) => s.serverBaseUrl);
  const setServerBaseUrl = useSettingsStore((s) => s.setServerBaseUrl);
  const serverTestResult = useSettingsStore((s) => s.serverTestResult);
  const testServerConnection = useSettingsStore((s) => s.testServerConnection);
  const clearAllCaches = useSettingsStore((s) => s.clearAllCaches);
  const syncWithStorage = useProjectStore((s) => s.syncWithStorage);
  const clearAllWorkflows = useProjectStore((s) => s.clearAllWorkflows);

  // Conversation Memory Defaults (Tier 1 Global Policy)
  const memoryDefaults = useSettingsStore((s) => s.memoryDefaults);
  const updateMemoryDefaults = useSettingsStore((s) => s.updateMemoryDefaults);
  const resetMemoryDefaults = useSettingsStore((s) => s.resetMemoryDefaults);
  const [showStorageQa, setShowStorageQa] = useState(false);

  // Runtime Protection, Editor Preferences & Network Settings
  const runtimeProtection = useSettingsStore((s) => s.runtimeProtection);
  const updateRuntimeProtection = useSettingsStore((s) => s.updateRuntimeProtection);
  const resetRuntimeProtection = useSettingsStore((s) => s.resetRuntimeProtection);
  const editorPreferences = useSettingsStore((s) => s.editorPreferences);
  const updateEditorPreferences = useSettingsStore((s) => s.updateEditorPreferences);
  const networkSettings = useSettingsStore((s) => s.networkSettings);
  const updateNetworkSettings = useSettingsStore((s) => s.updateNetworkSettings);
  const resetNetworkSettings = useSettingsStore((s) => s.resetNetworkSettings);
  const exportSettings = useSettingsStore((s) => s.exportSettings);
  const importSettings = useSettingsStore((s) => s.importSettings);

  // Export / Import Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importStatus, setImportStatus] = useState<{ type: 'idle' | 'success' | 'error'; message?: string }>({ type: 'idle' });
  const [exportIncludeKeys, setExportIncludeKeys] = useState(false);
  const [copiedExport, setCopiedExport] = useState(false);

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
  const [activeDangerModal, setActiveDangerModal] = useState<'cache' | 'workflows' | null>(null);
  const [dangerSuccessToast, setDangerSuccessToast] = useState<string | null>(null);

  const logListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logListRef.current) {
      logListRef.current.scrollTop = logListRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const currentProviderConfig =
    providers[selectedProviderTab] || DEFAULT_PROVIDERS[selectedProviderTab];
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

          <div className="flex items-center gap-2.5 shrink-0 select-none">
            <CatLogo className="w-7 h-7 shrink-0" />
            <div className="flex flex-col shrink-0">
              <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white font-mono uppercase whitespace-nowrap leading-none">
                PATCH<span className="text-blue-600 dark:text-sky-400">CAT</span>
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans whitespace-nowrap mt-0.5">
                {t.settings.pageTitle}
              </span>
            </div>
          </div>
        </div>

        {/* Right tools: Theme switcher */}
        <div className="flex items-center gap-3">
          {/* Theme button */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition-all shadow-xs"
            title={theme === 'dark' ? t.header.themeTooltipLight : t.header.themeTooltipDark}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
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
            onClick={() => setSettingsTab('execution')}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left whitespace-nowrap ${
              settingsTab === 'execution'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <Shield className="w-4 h-4" />
            <div className="flex-1 min-w-0">
              <span className="block">{t.settings.tabExecution}</span>
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
            onClick={() => setSettingsTab('memory')}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left whitespace-nowrap ${
              settingsTab === 'memory'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <div className="flex-1 min-w-0">
              <span className="block">{t.settings.tabMemory}</span>
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
                    settingsTab === 'logs'
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
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
                    {language === 'en' && (
                      <CheckCircle className="w-5 h-5 text-blue-600 dark:text-sky-400" />
                    )}
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
                    {language === 'zh' && (
                      <CheckCircle className="w-5 h-5 text-blue-600 dark:text-sky-400" />
                    )}
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
                      {engineMode === 'byok_browser' && (
                        <CheckCircle className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                      )}
                    </div>
                    <div className="text-xs opacity-75 mt-1 leading-relaxed">
                      {t.settings.engineBrowserDesc}
                    </div>
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
                      {engineMode === 'mock' && (
                        <CheckCircle className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                      )}
                    </div>
                    <div className="text-xs opacity-75 mt-1 leading-relaxed">
                      {t.settings.engineMockDesc}
                    </div>
                  </button>
                </div>
              </div>

              {/* Auto-save Debounce Delay */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-5 h-5 text-indigo-500" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {t.settings.autoSaveDebounce}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.settings.autoSaveDebounceDesc}
                    </p>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      {language === 'zh' ? '防抖延迟时长 (Debounce Delay)' : 'Debounce Delay'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {language === 'zh' ? '推荐: 800~1000ms' : 'Recommended: 800~1000ms'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={200}
                      max={10000}
                      step={100}
                      value={editorPreferences?.autoSaveDebounceMs ?? 1000}
                      onChange={(e) =>
                        updateEditorPreferences({
                          autoSaveDebounceMs: Math.max(200, parseInt(e.target.value, 10) || 1000),
                        })
                      }
                      className="w-36 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400">ms</span>
                  </div>
                </div>
              </div>

              {/* System Backup & Migration */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5">
                  <Database className="w-5 h-5 text-blue-500" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {t.settings.backupSection}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.settings.backupSectionDesc}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setExportIncludeKeys(false);
                      setCopiedExport(false);
                      setShowExportModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 dark:text-sky-300 border border-blue-200 dark:border-blue-900/80 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t.settings.exportSettingsBtn}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportJsonText('');
                      setImportStatus({ type: 'idle' });
                      setShowImportModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{t.settings.importSettingsBtn}</span>
                  </button>
                </div>
              </div>

              {/* Danger Zone (GitHub-style confirmation for destructive actions) */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-900/60 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-rose-600 dark:text-rose-400">
                      {t.settings.dangerZoneTitle}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {t.settings.dangerZoneDesc}
                    </p>
                  </div>
                </div>

                {dangerSuccessToast && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in">
                    <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{dangerSuccessToast}</span>
                  </div>
                )}

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border-t border-slate-100 dark:border-slate-800/80">
                  {/* Clear All Cache */}
                  <div className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {t.settings.clearCacheTitle}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
                        {t.settings.clearCacheDesc}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveDangerModal('cache')}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/80 transition-colors shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t.settings.clearCacheBtn}
                    </button>
                  </div>

                  {/* Clear All Workflows */}
                  <div className="pt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {t.settings.clearWorkflowsTitle}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xl leading-relaxed">
                        {t.settings.clearWorkflowsDesc}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveDangerModal('workflows')}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-700 shadow-xs transition-colors shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {t.settings.clearWorkflowsBtn}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Execution & Safety Tab */}
          {settingsTab === 'execution' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-150">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t.settings.executionTitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t.settings.executionDesc}
                </p>
              </div>

              {/* Tool Execution Watchdog */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-5 h-5 text-amber-500" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {t.settings.toolTimeoutTitle}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t.settings.toolTimeoutDesc}
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={runtimeProtection.toolTimeoutEnabled}
                      onChange={(e) =>
                        updateRuntimeProtection({ toolTimeoutEnabled: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {runtimeProtection.toolTimeoutEnabled && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">
                        {t.settings.toolTimeoutSecondsLabel}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {language === 'zh' ? '范围: 1 ~ 600 秒' : 'Range: 1 ~ 600s'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={600}
                        step={1}
                        value={runtimeProtection.toolTimeoutSeconds}
                        onChange={(e) =>
                          updateRuntimeProtection({
                            toolTimeoutSeconds: Math.max(1, parseInt(e.target.value, 10) || 30),
                          })
                        }
                        className="w-32 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {language === 'zh' ? '秒 (Seconds)' : 'Seconds'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Code Sandbox Timeout */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5">
                  <Code className="w-5 h-5 text-indigo-500" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {t.settings.sandboxTimeoutTitle}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.settings.sandboxTimeoutDesc}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      {t.settings.sandboxTimeoutSecondsLabel}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {language === 'zh' ? '范围: 1 ~ 300 秒' : 'Range: 1 ~ 300s'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={300}
                      step={1}
                      value={runtimeProtection.sandboxTimeoutSeconds}
                      onChange={(e) =>
                        updateRuntimeProtection({
                          sandboxTimeoutSeconds: Math.max(1, parseInt(e.target.value, 10) || 5),
                        })
                      }
                      className="w-32 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {language === 'zh' ? '秒 (Seconds)' : 'Seconds'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Agent Safeguards & Deadlock Breaker */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {t.settings.agentSafeguardsTitle}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.settings.agentSafeguardsDesc}
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 border-t border-slate-100 dark:border-slate-800/80">
                  {/* Loop Detection */}
                  <div className="py-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {t.settings.agentLoopEnable}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {t.settings.agentSafeguardsDesc}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {runtimeProtection.loopDetectionEnabled && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-slate-400">{t.settings.agentLoopThresholdLabel}:</span>
                          <select
                            value={runtimeProtection.loopDetectionThreshold}
                            onChange={(e) =>
                              updateRuntimeProtection({ loopDetectionThreshold: parseInt(e.target.value, 10) })
                            }
                            className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                          >
                            <option value={2}>2</option>
                            <option value={3}>3</option>
                            <option value={4}>4</option>
                            <option value={5}>5</option>
                          </select>
                        </div>
                      )}
                      <input
                        type="checkbox"
                        checked={runtimeProtection.loopDetectionEnabled}
                        onChange={(e) =>
                          updateRuntimeProtection({ loopDetectionEnabled: e.target.checked })
                        }
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Agent Default Iterations */}
                  <div className="pt-3 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">
                        {t.settings.agentDefaultIterationsLabel}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {language === 'zh' ? '范围: 1 ~ 100 轮' : 'Range: 1 ~ 100 rounds'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        step={1}
                        value={runtimeProtection.defaultMaxIterations}
                        onChange={(e) =>
                          updateRuntimeProtection({
                            defaultMaxIterations: Math.max(1, parseInt(e.target.value, 10) || 10),
                          })
                        }
                        className="w-32 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                      />
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {language === 'zh' ? '轮 (Rounds)' : 'Rounds'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => resetRuntimeProtection()}
                    className="text-[11px] text-slate-500 hover:text-blue-600 dark:hover:text-sky-400 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset to Defaults</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Memory & Storage */}
          {settingsTab === 'memory' && (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-150">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {t.settings.memoryTitle}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t.settings.memoryDesc}
                </p>
              </div>

              {/* Conversation Memory Defaults (Tier 1 Global Policy) */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {t.settings.memorySection}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t.settings.memorySectionDesc}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={resetMemoryDefaults}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold transition-colors"
                    title={t.settings.memoryResetBtn}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t.settings.memoryResetBtn}</span>
                  </button>
                </div>

                {/* Enable toggle */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
                      {t.settings.memoryEnableLabel}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed block mt-0.5">
                      {t.settings.memoryEnableDesc}
                    </span>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={memoryDefaults.enabled}
                    onClick={() => updateMemoryDefaults({ enabled: !memoryDefaults.enabled })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      memoryDefaults.enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        memoryDefaults.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Sub-controls shown when memory enabled */}
                {memoryDefaults.enabled && (
                  <div className="space-y-4 pt-1 animate-in fade-in duration-150">
                    {/* Sliding Window Rounds (Numeric Input) */}
                    <div className="space-y-1.5">
                      <label className="font-semibold text-xs text-slate-800 dark:text-slate-200 block">
                        {t.settings.memoryRoundsLabel}
                      </label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {t.settings.memoryRoundsDesc}
                      </p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          step={1}
                          value={memoryDefaults.maxHistoryRounds}
                          onChange={(e) =>
                            updateMemoryDefaults({
                              maxHistoryRounds: Math.max(1, parseInt(e.target.value, 10) || 1),
                            })
                          }
                          className="w-32 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          {language === 'zh' ? '轮 (Rounds)' : 'Rounds'}
                        </span>
                      </div>
                    </div>

                    {/* Token Budget (Numeric Input) */}
                    <div className="space-y-1.5">
                      <label className="font-semibold text-xs text-slate-800 dark:text-slate-200 block">
                        {t.settings.memoryBudgetLabel}
                      </label>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {t.settings.memoryBudgetDesc}
                      </p>
                      <div className="flex items-center gap-2 pt-0.5">
                        <input
                          type="number"
                          min={100}
                          max={128000}
                          step={100}
                          value={memoryDefaults.maxTokenBudget}
                          onChange={(e) =>
                            updateMemoryDefaults({
                              maxTokenBudget: Math.max(100, parseInt(e.target.value, 10) || 100),
                            })
                          }
                          className="w-36 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Tokens
                        </span>
                      </div>
                    </div>

                    {/* Pruning Strategy Selection (Dual Toggle) */}
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {t.settings.memoryStrategyLabel}
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {language === 'zh'
                            ? '点击按钮可切换选中状态，两个都选中即为双重约束'
                            : 'Click to toggle constraints; selecting both enables dual constraints.'}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* Window Toggle Button */}
                        <button
                          type="button"
                          onClick={() => {
                            const isWindowActive =
                              memoryDefaults.pruningStrategy === 'window' ||
                              memoryDefaults.pruningStrategy === 'hybrid';
                            const isBudgetActive =
                              memoryDefaults.pruningStrategy === 'token_budget' ||
                              memoryDefaults.pruningStrategy === 'hybrid';

                            let nextStrategy: 'window' | 'token_budget' | 'hybrid' | 'none';
                            if (isWindowActive) {
                              nextStrategy = isBudgetActive ? 'token_budget' : 'none';
                            } else {
                              nextStrategy = isBudgetActive ? 'hybrid' : 'window';
                            }
                            updateMemoryDefaults({ pruningStrategy: nextStrategy });
                          }}
                          className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                            memoryDefaults.pruningStrategy === 'window' ||
                            memoryDefaults.pruningStrategy === 'hybrid'
                              ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-600/30'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <span>{t.settings.memoryStrategyWindow}</span>
                          {(memoryDefaults.pruningStrategy === 'window' ||
                            memoryDefaults.pruningStrategy === 'hybrid') && (
                            <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          )}
                        </button>

                        {/* Budget Toggle Button */}
                        <button
                          type="button"
                          onClick={() => {
                            const isWindowActive =
                              memoryDefaults.pruningStrategy === 'window' ||
                              memoryDefaults.pruningStrategy === 'hybrid';
                            const isBudgetActive =
                              memoryDefaults.pruningStrategy === 'token_budget' ||
                              memoryDefaults.pruningStrategy === 'hybrid';

                            let nextStrategy: 'window' | 'token_budget' | 'hybrid' | 'none';
                            if (isBudgetActive) {
                              nextStrategy = isWindowActive ? 'window' : 'none';
                            } else {
                              nextStrategy = isWindowActive ? 'hybrid' : 'token_budget';
                            }
                            updateMemoryDefaults({ pruningStrategy: nextStrategy });
                          }}
                          className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                            memoryDefaults.pruningStrategy === 'token_budget' ||
                            memoryDefaults.pruningStrategy === 'hybrid'
                              ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-600/30'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <span>{t.settings.memoryStrategyBudget}</span>
                          {(memoryDefaults.pruningStrategy === 'token_budget' ||
                            memoryDefaults.pruningStrategy === 'hybrid') && (
                            <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          )}
                        </button>
                      </div>

                      {/* Strategy active status indication */}
                      <div className="pt-1">
                        {memoryDefaults.pruningStrategy === 'hybrid' && (
                          <div className="p-2.5 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                            <span>{t.settings.memoryStrategyHybridActive}</span>
                          </div>
                        )}
                        {memoryDefaults.pruningStrategy === 'window' && (
                          <div className="p-2.5 rounded-lg bg-slate-100/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                            {t.settings.memoryStrategyWindowActive}
                          </div>
                        )}
                        {memoryDefaults.pruningStrategy === 'token_budget' && (
                          <div className="p-2.5 rounded-lg bg-slate-100/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                            {t.settings.memoryStrategyBudgetActive}
                          </div>
                        )}
                        {memoryDefaults.pruningStrategy === 'none' && (
                          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-[11px] text-amber-700 dark:text-amber-300">
                            {language === 'zh'
                              ? '⚠️ 未激活任何裁剪限制（保留所有历史消息）'
                              : '⚠️ No pruning constraints active (all history preserved).'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Storage & Backend Mode */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5">
                  <HardDrive className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {t.settings.storageSection}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.settings.storageSectionDesc}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Local Mode */}
                  <button
                    onClick={() => {
                      setStorageMode('local');
                      syncWithStorage();
                    }}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      storageMode === 'local'
                        ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 ring-2 ring-emerald-600/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-sm">{t.settings.storageLocal}</div>
                      {storageMode === 'local' && (
                        <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>
                    <div className="text-xs opacity-75 mt-1 leading-relaxed">
                      {t.settings.storageLocalDesc}
                    </div>
                  </button>

                  {/* Server Mode */}
                  <button
                    onClick={() => {
                      setStorageMode('server');
                      syncWithStorage();
                      testServerConnection();
                    }}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      storageMode === 'server'
                        ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 ring-2 ring-emerald-600/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-sm">{t.settings.storageServer}</div>
                      {storageMode === 'server' && (
                        <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>
                    <div className="text-xs opacity-75 mt-1 leading-relaxed">
                      {t.settings.storageServerDesc}
                    </div>
                  </button>
                </div>

                {/* Server URL Input & Connection Tester (Shown when server mode is selected) */}
                {storageMode === 'server' && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        {t.settings.serverUrlLabel}
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={serverBaseUrl}
                          onChange={(e) => setServerBaseUrl(e.target.value)}
                          placeholder="http://localhost:8000"
                          className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={async () => {
                            await testServerConnection();
                            await syncWithStorage();
                          }}
                          disabled={serverTestResult.status === 'testing'}
                          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0"
                        >
                          {serverTestResult.status === 'testing' ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>{t.settings.testingServerBtn}</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5" />
                              <span>{t.settings.testServerBtn}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Test result status display */}
                    {serverTestResult.status !== 'idle' && (
                      <div
                        className={`p-3 rounded-lg text-xs flex items-center justify-between gap-2 ${
                          serverTestResult.status === 'success'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                            : serverTestResult.status === 'error'
                              ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                              : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {serverTestResult.status === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : serverTestResult.status === 'error' ? (
                            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                          ) : (
                            <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
                          )}
                          <span className="font-medium">
                            {serverTestResult.message ||
                              (serverTestResult.status === 'success'
                                ? t.settings.serverTestSuccess
                                : t.settings.serverTestFailed)}
                          </span>
                        </div>

                        {serverTestResult.latencyMs !== undefined && (
                          <span className="text-[11px] font-mono opacity-80 shrink-0">
                            {serverTestResult.latencyMs}ms
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Expandable Storage Architecture & FAQ */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowStorageQa((prev) => !prev)}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>{t.settings.storageQaTitle}</span>
                    </div>
                    {showStorageQa ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </button>

                  {showStorageQa && (
                    <div className="mt-2.5 p-4 rounded-xl bg-slate-50/90 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-150 text-xs leading-relaxed">
                      <div className="flex items-start gap-2.5">
                        <Database className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-slate-600 dark:text-slate-300">
                          {t.settings.storageQaBrowserDesc}
                        </p>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <HardDrive className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="text-slate-600 dark:text-slate-300">
                          {t.settings.storageQaServerDesc}
                        </p>
                      </div>

                      <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-1">
                        <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <span>💡</span>
                          <span>{t.settings.storageQaFolderTitle}</span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 pl-5">
                          {t.settings.storageQaFolderContent}
                        </p>
                      </div>
                    </div>
                  )}
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
                    const hasKey = p.id === 'ollama' ? false : p.apiKey.trim().length > 0;

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
                            <span
                              className="w-2 h-2 rounded-full bg-emerald-500"
                              title={t.header.apiKeyConfigured}
                            />
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
                          isSelectedProviderActive
                            ? 'bg-emerald-500 animate-pulse'
                            : 'bg-slate-300 dark:bg-slate-700'
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
                          {showApiKey ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
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
                        {currentProviderConfig.availableModels &&
                          currentProviderConfig.availableModels.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 font-mono">
                              {currentProviderConfig.availableModels.length}{' '}
                              {t.settings.availableCount}
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
                        disabled={
                          isRefreshingModels || (!isOllama && !currentProviderConfig.apiKey.trim())
                        }
                        className="text-[11px] text-blue-600 dark:text-sky-400 hover:text-blue-700 dark:hover:text-sky-300 disabled:opacity-40 flex items-center gap-1 transition-colors"
                        title={t.settings.fetchModels}
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${isRefreshingModels ? 'animate-spin' : ''}`}
                        />
                        <span>
                          {isRefreshingModels ? t.propertyPanel.refreshing : t.settings.fetchModels}
                        </span>
                      </button>
                    </div>

                    {currentProviderConfig.availableModels &&
                    currentProviderConfig.availableModels.length > 0 ? (
                      <div className="space-y-2">
                        <select
                          value={currentProviderConfig.defaultModel}
                          onChange={(e) =>
                            updateProviderConfig(selectedProviderTab, {
                              defaultModel: e.target.value,
                            })
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
                              updateProviderConfig(selectedProviderTab, {
                                defaultModel: e.target.value,
                              })
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
                          updateProviderConfig(selectedProviderTab, {
                            defaultModel: e.target.value,
                          })
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
                        <span>
                          {currentTest.status === 'testing'
                            ? t.settings.testingConnection
                            : t.settings.testConnection}
                        </span>
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
                        {currentTest.status === 'testing' && (
                          <Loader2 className="w-4 h-4 animate-spin shrink-0 mt-0.5" />
                        )}
                        {currentTest.status === 'success' && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        )}
                        {currentTest.status === 'error' && (
                          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">
                            {currentTest.message ||
                              (currentTest.status === 'testing'
                                ? t.settings.testingConnection
                                : '')}
                          </p>
                          {currentTest.latencyMs !== undefined && (
                            <span className="text-[10px] opacity-80 block mt-0.5">
                              Latency: {currentTest.latencyMs}ms
                            </span>
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

              {/* Network Resiliency Policy */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5">
                  <Radio className="w-5 h-5 text-sky-500" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {t.settings.networkSection}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t.settings.networkSectionDesc}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {t.settings.networkMaxRetriesLabel}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={networkSettings.llmMaxRetries}
                      onChange={(e) =>
                        updateNetworkSettings({ llmMaxRetries: Math.max(0, parseInt(e.target.value, 10) || 0) })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {t.settings.networkRetryDelayLabel}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={networkSettings.llmRetryDelaySeconds}
                      onChange={(e) =>
                        updateNetworkSettings({ llmRetryDelaySeconds: Math.max(1, parseInt(e.target.value, 10) || 1) })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => resetNetworkSettings()}
                    className="text-[11px] text-slate-500 hover:text-blue-600 dark:hover:text-sky-400 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset to Defaults</span>
                  </button>
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
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    {t.settings.logLevel}
                  </span>
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
                      const hasPayload = Boolean(
                        log.data?.inputs || log.data?.outputs || log.metadata,
                      );

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
                                <span>
                                  {isExpanded ? t.settings.hideDetails : t.settings.showDetails}
                                </span>
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
                                      JSON.stringify(
                                        { metadata: log.metadata, data: log.data },
                                        null,
                                        2,
                                      ),
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
                                  <div className="text-[10px] font-semibold text-slate-400 mb-0.5">
                                    Metadata:
                                  </div>
                                  <pre className="p-2.5 rounded-lg bg-slate-900 text-amber-300 overflow-x-auto max-h-40 whitespace-pre-wrap">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}

                              {log.data?.inputs !== undefined && (
                                <div>
                                  <div className="text-[10px] font-semibold text-sky-400 mb-0.5">
                                    Inputs:
                                  </div>
                                  <pre className="p-2.5 rounded-lg bg-slate-900 text-sky-200 overflow-x-auto max-h-48 whitespace-pre-wrap">
                                    {JSON.stringify(log.data.inputs, null, 2)}
                                  </pre>
                                </div>
                              )}

                              {log.data?.outputs !== undefined && (
                                <div>
                                  <div className="text-[10px] font-semibold text-emerald-400 mb-0.5">
                                    Outputs:
                                  </div>
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

      {/* Export Settings Modal */}
      {showExportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setShowExportModal(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                <span>{t.settings.exportModalTitle}</span>
              </h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setExportIncludeKeys(false)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    !exportIncludeKeys
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30 text-blue-900 dark:text-sky-300 ring-2 ring-blue-600/20'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs">{t.settings.exportModalSanitized}</div>
                  <div className="text-[11px] opacity-75 mt-0.5">{t.settings.exportModalSanitizedDesc}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setExportIncludeKeys(true)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    exportIncludeKeys
                      ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300 ring-2 ring-amber-500/20'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <div className="font-bold text-xs">{t.settings.exportModalFull}</div>
                  <div className="text-[11px] opacity-75 mt-0.5">{t.settings.exportModalFullDesc}</div>
                </button>
              </div>

              {exportIncludeKeys && (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-[11px] text-amber-700 dark:text-amber-400">
                  {t.settings.exportModalWarning}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  JSON Preview
                </label>
                <textarea
                  readOnly
                  rows={8}
                  value={exportSettings(exportIncludeKeys)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono resize-none focus:outline-none select-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const json = exportSettings(exportIncludeKeys);
                  navigator.clipboard.writeText(json);
                  setCopiedExport(true);
                  setTimeout(() => setCopiedExport(false), 2000);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {copiedExport ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedExport ? t.common.copied : t.common.copy}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const json = exportSettings(exportIncludeKeys);
                  const blob = new Blob([json], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `patchcat-settings-${exportIncludeKeys ? 'full' : 'sanitized'}-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Settings Modal */}
      {showImportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
          onClick={() => setShowImportModal(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600 dark:text-sky-400" />
                <span>{t.settings.importModalTitle}</span>
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.settings.importModalDesc}
              </p>

              {importStatus.type === 'error' && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{importStatus.message || t.settings.importModalError}</span>
                </div>
              )}

              {importStatus.type === 'success' && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{t.settings.importModalSuccess}</span>
                </div>
              )}

              <textarea
                rows={7}
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder={t.settings.importModalPastePlaceholder}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs font-mono resize-none focus:outline-none focus:border-blue-500"
              />

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      const text = evt.target?.result as string;
                      if (text) setImportJsonText(text);
                    };
                    reader.readAsText(file);
                  }}
                  className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-300 hover:file:bg-slate-200 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = importSettings(importJsonText);
                  if (!res.success) {
                    setImportStatus({ type: 'error', message: res.error });
                  } else {
                    setImportStatus({ type: 'success' });
                    setTimeout(() => {
                      setShowImportModal(false);
                      setImportStatus({ type: 'idle' });
                      setImportJsonText('');
                    }, 1200);
                  }
                }}
                disabled={!importJsonText.trim()}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-xs transition-colors cursor-pointer"
              >
                {t.settings.importModalConfirmBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone GitHub-style Confirmation Modal */}
      {activeDangerModal === 'cache' && (
        <DangerConfirmModal
          isOpen={true}
          title={t.settings.clearCacheTitle}
          description={t.settings.clearCacheDesc}
          confirmPhrase={t.settings.clearCacheConfirmPhrase}
          confirmButtonText={t.settings.clearCacheBtn}
          onConfirm={async () => {
            await clearAllCaches();
            setDangerSuccessToast(t.settings.clearCacheSuccess);
            setTimeout(() => setDangerSuccessToast(null), 4000);
          }}
          onClose={() => setActiveDangerModal(null)}
        />
      )}

      {activeDangerModal === 'workflows' && (
        <DangerConfirmModal
          isOpen={true}
          title={t.settings.clearWorkflowsTitle}
          description={t.settings.clearWorkflowsDesc}
          confirmPhrase={t.settings.clearWorkflowsConfirmPhrase}
          confirmButtonText={t.settings.clearWorkflowsBtn}
          onConfirm={async () => {
            await clearAllWorkflows();
            setDangerSuccessToast(t.settings.clearWorkflowsSuccess);
            setTimeout(() => setDangerSuccessToast(null), 4000);
          }}
          onClose={() => setActiveDangerModal(null)}
        />
      )}
    </div>
  );
};

export default SettingsPage;
