import React, { useState } from 'react';
import {
  X,
  KeyRound,
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
  Terminal,
} from 'lucide-react';
import {
  useSettingsStore,
  type ProviderId,
  DEFAULT_PROVIDERS,
} from '../../stores/settings-store.ts';
import { useLogStore } from '../../stores/log-store.ts';
import { PROJECT_LINKS } from '../../config/project.ts';

const PROVIDER_DOCS: Record<ProviderId, { label: string; url: string }> = {
  openai: { label: 'OpenAI API Keys', url: 'https://platform.openai.com/api-keys' },
  deepseek: { label: 'DeepSeek API Keys', url: 'https://platform.deepseek.com/api_keys' },
  siliconflow: { label: 'SiliconFlow API Keys', url: 'https://cloud.siliconflow.cn/account/ak' },
  google: { label: 'Google AI Studio Keys', url: 'https://aistudio.google.com/app/apikey' },
  ollama: { label: 'Ollama Documentation', url: 'https://ollama.com/' },
  custom: { label: 'OpenAI-Compatible Guide', url: PROJECT_LINKS.guide },
};

export const SettingsModal: React.FC = () => {
  const isSettingsOpen = useSettingsStore((s) => s.isSettingsOpen);
  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen);
  const activeProvider = useSettingsStore((s) => s.activeProvider);
  const setActiveProvider = useSettingsStore((s) => s.setActiveProvider);
  const providers = useSettingsStore((s) => s.providers);
  const updateProviderConfig = useSettingsStore((s) => s.updateProviderConfig);
  const resetProviderConfig = useSettingsStore((s) => s.resetProviderConfig);
  const testResults = useSettingsStore((s) => s.testResults);
  const testConnection = useSettingsStore((s) => s.testConnection);
  const fetchAvailableModels = useSettingsStore((s) => s.fetchAvailableModels);

  const logLevel = useLogStore((s) => s.logLevel);
  const setLogLevel = useLogStore((s) => s.setLogLevel);
  const toggleConsole = useLogStore((s) => s.toggleConsole);

  const [selectedTab, setSelectedTab] = useState<ProviderId>(activeProvider);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);

  if (!isSettingsOpen) return null;

  const currentConfig = providers[selectedTab] || DEFAULT_PROVIDERS[selectedTab];
  const currentTest = testResults[selectedTab] || { status: 'idle' };
  const isOllama = selectedTab === 'ollama';
  const isActive = activeProvider === selectedTab;

  const handleTest = async () => {
    await testConnection(selectedTab);
  };

  const handleSetAsActive = () => {
    setActiveProvider(selectedTab);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-800 dark:text-slate-200 font-sans transition-colors duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-sky-500/10 text-blue-600 dark:text-sky-400 border border-blue-200 dark:border-sky-500/30">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                LLM Provider & API Key 设置
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                配置模型端点与 API 凭证 (BYOK)，零后端纯前端直连
              </p>
            </div>
          </div>

          <button
            onClick={() => setSettingsOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Container: Provider Tabs + Config Form */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Provider Sidebar / Tabs */}
          <div className="w-full md:w-52 shrink-0 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-3 space-y-1.5 bg-slate-50/40 dark:bg-slate-950/20 overflow-y-auto">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-1">
              Providers
            </span>
            {(Object.keys(DEFAULT_PROVIDERS) as ProviderId[]).map((pid) => {
              const p = providers[pid] || DEFAULT_PROVIDERS[pid];
              const isSelected = selectedTab === pid;
              const isPActive = activeProvider === pid;
              const hasKey = p.id === 'ollama' ? true : p.apiKey.trim().length > 0;

              return (
                <button
                  key={pid}
                  onClick={() => {
                    setSelectedTab(pid);
                    setShowApiKey(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'hover:bg-slate-200/70 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">{p.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isPActive && (
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-semibold ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-blue-50 dark:bg-sky-500/20 text-blue-600 dark:text-sky-300 border border-blue-200 dark:border-sky-500/30'
                        }`}
                      >
                        ACTIVE
                      </span>
                    )}
                    {hasKey && !isPActive && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500" title="Key configured" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Active Provider Indicator & Switch */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-3 h-3 rounded-full ${
                    isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                />
                <div>
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white">
                    {currentConfig.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {currentConfig.description}
                  </p>
                </div>
              </div>

              {!isActive ? (
                <button
                  onClick={handleSetAsActive}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-sky-500/10 hover:bg-blue-100 dark:hover:bg-sky-500/20 text-blue-600 dark:text-sky-300 border border-blue-200 dark:border-sky-500/30 text-xs font-semibold transition-all shadow-xs"
                >
                  设为默认 (Set as Active)
                </button>
              ) : (
                <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 rounded-md border border-emerald-200 dark:border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>当前默认 Provider</span>
                </span>
              )}
            </div>

            {/* Base URL Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-blue-500 dark:text-sky-400" />
                  <span>API Base URL</span>
                </label>
                <button
                  onClick={() =>
                    updateProviderConfig(selectedTab, {
                      baseUrl: DEFAULT_PROVIDERS[selectedTab].baseUrl,
                    })
                  }
                  className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
                  title="Reset Base URL to default"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>重置端点</span>
                </button>
              </div>
              <input
                type="text"
                value={currentConfig.baseUrl}
                onChange={(e) =>
                  updateProviderConfig(selectedTab, { baseUrl: e.target.value })
                }
                placeholder="https://api.openai.com/v1"
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            {/* API Key Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  <span>API Key {isOllama && '(Ollama 本地无需 API Key)'}</span>
                </label>
                {PROVIDER_DOCS[selectedTab] && (
                  <a
                    href={PROVIDER_DOCS[selectedTab].url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                  >
                    <span>获取 Key</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="relative">
                <input
                  type={showApiKey || isOllama ? 'text' : 'password'}
                  disabled={isOllama}
                  value={currentConfig.apiKey}
                  onChange={(e) =>
                    updateProviderConfig(selectedTab, { apiKey: e.target.value })
                  }
                  placeholder={
                    isOllama ? 'ollama (built-in default)' : 'sk-xxxxxxxxxxxxxxxxxxxxxxxx'
                  }
                  className="w-full pl-3 pr-10 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-60 transition-all"
                />
                {!isOllama && (
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {/* Default Model Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                  <span>默认模型 (Default Model)</span>
                  {currentConfig.availableModels && currentConfig.availableModels.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 font-mono">
                      {currentConfig.availableModels.length} 个可用
                    </span>
                  )}
                </label>

                <button
                  type="button"
                  onClick={async () => {
                    setIsRefreshingModels(true);
                    await fetchAvailableModels(selectedTab);
                    setIsRefreshingModels(false);
                  }}
                  disabled={isRefreshingModels || (!isOllama && !currentConfig.apiKey.trim())}
                  className="text-[11px] text-blue-600 dark:text-sky-400 hover:text-blue-700 dark:hover:text-sky-300 disabled:opacity-40 flex items-center gap-1 transition-colors"
                  title="从服务商 API 获取最新的可用模型列表"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshingModels ? 'animate-spin' : ''}`} />
                  <span>{isRefreshingModels ? '拉取中...' : '刷新模型列表'}</span>
                </button>
              </div>

              {currentConfig.availableModels && currentConfig.availableModels.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={currentConfig.defaultModel}
                    onChange={(e) =>
                      updateProviderConfig(selectedTab, { defaultModel: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                  >
                    {currentConfig.availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span>或输入自定义模型:</span>
                    <input
                      type="text"
                      value={currentConfig.defaultModel}
                      onChange={(e) =>
                        updateProviderConfig(selectedTab, { defaultModel: e.target.value })
                      }
                      placeholder="custom-model-name"
                      className="flex-1 px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              ) : (
                <input
                  type="text"
                  value={currentConfig.defaultModel}
                  onChange={(e) =>
                    updateProviderConfig(selectedTab, { defaultModel: e.target.value })
                  }
                  placeholder="gpt-4o-mini"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              )}
            </div>

            {/* Connection Test Section */}
            <div className="pt-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleTest}
                  disabled={currentTest.status === 'testing'}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-medium transition-all disabled:opacity-50 shadow-xs"
                >
                  {currentTest.status === 'testing' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{currentTest.status === 'testing' ? '正在连接...' : '测试连通性 (Test Connection)'}</span>
                </button>

                <button
                  onClick={() => resetProviderConfig(selectedTab)}
                  className="px-3 py-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white text-xs transition-colors"
                >
                  重置该 Provider
                </button>
              </div>

              {/* Test Result Message Box */}
              {currentTest.status !== 'idle' && (
                <div
                  className={`mt-3 p-3 rounded-xl border text-xs font-mono flex items-start gap-2.5 ${
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
                    <p className="font-semibold">{currentTest.message || (currentTest.status === 'testing' ? '正在发送探测请求...' : '')}</p>
                    {currentTest.latencyMs !== undefined && (
                      <span className="text-[10px] opacity-80 block mt-0.5">响应耗时: {currentTest.latencyMs}ms</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* System Logging Configuration */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-blue-500" />
                  <span>系统日志登记级别 (Logging Level)</span>
                </label>
                <button
                  type="button"
                  onClick={toggleConsole}
                  className="text-[11px] text-blue-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                >
                  <span>打开控制台</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { level: 'summary', title: '概要 (Summary)', desc: '记录系统启停、拓扑调度、请求状态码与耗时、异常报错' },
                  { level: 'detailed', title: '详细 (Detailed)', desc: '包含概要，补充节点ID、模型参数、依赖波次流转' },
                  { level: 'dev', title: '开发 (Development)', desc: '包含详细，捕获输入输出全文 (密钥已脱敏过滤)' },
                ].map((item) => (
                  <button
                    key={item.level}
                    type="button"
                    onClick={() => setLogLevel(item.level as any)}
                    className={`p-2.5 rounded-xl text-left border transition-all ${
                      logLevel === item.level
                        ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 text-blue-900 dark:text-blue-200 ring-1 ring-blue-400/50'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                  >
                    <div className="font-semibold text-xs flex items-center justify-between">
                      <span>{item.title}</span>
                      {logLevel === item.level && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                    </div>
                    <div className="text-[10px] opacity-75 mt-1 leading-tight">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Privacy Notice & Close */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>所有 API Key 仅保存在浏览器 LocalStorage，直连大模型服务商，绝不经由第三方服务器。</span>
          </div>

          <button
            onClick={() => setSettingsOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold transition-all shadow-xs"
          >
            完成 (Done)
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
