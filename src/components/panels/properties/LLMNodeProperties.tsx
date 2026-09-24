import React, { useState } from 'react';
import {
  KeyRound,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Play,
  FileCode,
  Layers,
  Plus,
  Trash2,
  RotateCcw,
  FlaskConical,
} from 'lucide-react';
import { useTranslation } from '../../../i18n/useTranslation.ts';
import { useSettingsStore } from '../../../stores/settings-store.ts';
import { useWorkflowStore } from '../../../stores/workflow-store.ts';
import { type ZodSchemaConfig } from '../../../engine/structured-output.ts';
import {
  TEST_SCENARIOS,
  type LLMTestScenario,
} from '../../../presets/self-healing-scenarios.ts';
import type { ResponseFormatMode, LLMSimulationMode } from '../../../engine/types.ts';

interface LLMNodePropertiesProps {
  nodeId: string;
  config: Record<string, unknown>;
  updateNodeConfig: (nodeId: string, patch: Record<string, unknown>) => void;
}

export const LLMNodeProperties: React.FC<LLMNodePropertiesProps> = ({
  nodeId,
  config,
  updateNodeConfig,
}) => {
  const { t } = useTranslation();
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);
  const [schemaJsonText, setSchemaJsonText] = useState<string>(() => {
    const raw = config['zodSchemaConfig'];
    return raw ? JSON.stringify(raw, null, 2) : '';
  });
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const setCurrentView = useSettingsStore((s) => s.setCurrentView);
  const setSettingsTab = useSettingsStore((s) => s.setSettingsTab);
  const activeProvider = useSettingsStore((s) => s.activeProvider);
  const providers = useSettingsStore((s) => s.providers);
  const fetchAvailableModels = useSettingsStore((s) => s.fetchAvailableModels);
  const researchMode = useSettingsStore((s) => s.researchMode);

  const retryNode = useWorkflowStore((s) => s.retryNode);
  const isExecuting = useWorkflowStore((s) => s.isExecuting);

  const currentProvider = providers[activeProvider];
  const hasKey =
    activeProvider === 'ollama' ? true : Boolean(currentProvider?.apiKey?.trim());
  const availableModels = currentProvider?.availableModels || [];

  const defaultModel =
    currentProvider?.defaultModel || availableModels[0] || 'gpt-4o-mini';
  const currentModel = (config['model'] as string) || defaultModel;

  // Auto-sync node config model if it was undefined/empty
  React.useEffect(() => {
    if (!config['model'] && defaultModel) {
      updateNodeConfig(nodeId, { model: defaultModel });
    }
  }, [config, defaultModel, nodeId, updateNodeConfig]);

  // Ensure available options always contains currentModel
  const modelOptions = React.useMemo(() => {
    if (!currentModel) return availableModels;
    if (availableModels.includes(currentModel)) return availableModels;
    return [currentModel, ...availableModels];
  }, [availableModels, currentModel]);

  const currentFormat =
    typeof config['responseFormat'] === 'string'
      ? (config['responseFormat'] as ResponseFormatMode)
      : typeof config['responseFormat'] === 'object' && config['responseFormat'] !== null
        ? ((config['responseFormat'] as { type?: ResponseFormatMode }).type || 'none')
        : config['zodSchemaConfig']
          ? 'json_schema'
          : 'none';

  const currentScenario = (config['testScenario'] as LLMTestScenario | undefined) || undefined;
  const activeScenarioDef = currentScenario ? TEST_SCENARIOS[currentScenario] : undefined;

  const simResponses = (config['simulationResponses'] as string[] | undefined) ||
    activeScenarioDef?.defaultResponses || [
      JSON.stringify(
        {
          urgency: 4,
          summary: '测试默认模型输出',
        },
        null,
        2,
      ),
    ];

  const simFinishReasons = (config['simulationFinishReasons'] as string[] | undefined) ||
    activeScenarioDef?.defaultFinishReasons ||
    simResponses.map(() => 'stop');

  const simMode: LLMSimulationMode =
    (config['simulationMode'] as LLMSimulationMode) ||
    (config['mockFirstRoundOnly']
      ? 'mock_first_round_then_real'
      : (config['forceSimulation'] ?? true)
        ? 'offline_mock'
        : 'live_api');

  const handleSelectScenario = (scenarioId: LLMTestScenario) => {
    const def = TEST_SCENARIOS[scenarioId];
    if (!def) return;

    const newSchemaConfig = def.schemaConfig;
    const newResponses = [...def.defaultResponses];
    const newFinishReasons = def.defaultFinishReasons
      ? [...def.defaultFinishReasons]
      : newResponses.map(() => 'stop');

    setSchemaJsonText(JSON.stringify(newSchemaConfig, null, 2));
    setSchemaError(null);

    const activeMode =
      (config['simulationMode'] as LLMSimulationMode) ||
      (config['mockFirstRoundOnly'] ? 'mock_first_round_then_real' : 'offline_mock');

    updateNodeConfig(nodeId, {
      testScenario: scenarioId,
      responseFormat: 'json_schema',
      zodSchemaConfig: newSchemaConfig,
      simulationResponses: newResponses,
      simulationFinishReasons: newFinishReasons,
      simulationMode: activeMode,
      forceSimulation: activeMode === 'offline_mock',
      mockFirstRoundOnly: activeMode === 'mock_first_round_then_real',
      maxSelfHealingRetries: 2,
    });
  };

  const handleResetScenarioDefaults = () => {
    if (!activeScenarioDef) return;
    const newResponses = [...activeScenarioDef.defaultResponses];
    const newFinishReasons = activeScenarioDef.defaultFinishReasons
      ? [...activeScenarioDef.defaultFinishReasons]
      : newResponses.map(() => 'stop');
    updateNodeConfig(nodeId, {
      simulationResponses: newResponses,
      simulationFinishReasons: newFinishReasons,
    });
  };

  const handleSchemaJsonChange = (text: string) => {
    setSchemaJsonText(text);
    if (!text.trim()) {
      setSchemaError(null);
      updateNodeConfig(nodeId, { zodSchemaConfig: undefined });
      return;
    }
    try {
      const parsed = JSON.parse(text) as ZodSchemaConfig;
      setSchemaError(null);
      updateNodeConfig(nodeId, { zodSchemaConfig: parsed });
    } catch (err: unknown) {
      setSchemaError(err instanceof Error ? err.message : 'Invalid JSON format');
    }
  };

  const handleSimResponseChange = (index: number, val: string) => {
    const updated = [...simResponses];
    updated[index] = val;
    updateNodeConfig(nodeId, { simulationResponses: updated });
  };

  const handleSimFinishReasonChange = (index: number, val: string) => {
    const updated = [...simFinishReasons];
    updated[index] = val;
    updateNodeConfig(nodeId, { simulationFinishReasons: updated });
  };

  const handleAddRound = () => {
    if (simResponses.length >= 3) return;
    const updatedResponses = [
      ...simResponses,
      JSON.stringify({ urgency: 4, summary: '自愈重试修正后的合法摘要' }, null, 2),
    ];
    const updatedFinish = [...simFinishReasons, 'stop'];
    updateNodeConfig(nodeId, {
      simulationResponses: updatedResponses,
      simulationFinishReasons: updatedFinish,
    });
  };

  const handleDeleteRound = (index: number) => {
    if (simResponses.length <= 1) return;
    const updatedResponses = simResponses.filter((_, i) => i !== index);
    const updatedFinish = simFinishReasons.filter((_, i) => i !== index);
    updateNodeConfig(nodeId, {
      simulationResponses: updatedResponses,
      simulationFinishReasons: updatedFinish,
    });
  };

  const handlePrettifyRound = (index: number) => {
    const raw = simResponses[index];
    if (typeof raw !== 'string' || !raw.trim()) return;
    try {
      const parsed = JSON.parse(raw);
      const pretty = JSON.stringify(parsed, null, 2);
      handleSimResponseChange(index, pretty);
    } catch {
      // ignore
    }
  };

  const handleResetToLiveMode = () => {
    updateNodeConfig(nodeId, {
      simulationMode: 'live_api',
      mockFirstRoundOnly: false,
      forceSimulation: false,
      testScenario: undefined,
      simulationResponses: undefined,
      simulationFinishReasons: undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Active Provider Banner */}
      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              hasKey ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
            }`}
          />
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-400 block">
              {t.propertyPanel.provider}
            </span>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {currentProvider?.name || 'OpenAI'}
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            setSettingsTab('providers');
            setCurrentView('settings');
          }}
          className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-sky-400 hover:text-blue-700 dark:hover:text-sky-300 px-2 py-1 rounded bg-blue-50 dark:bg-sky-500/10 hover:bg-blue-100 dark:hover:bg-sky-500/20 border border-blue-200 dark:border-sky-500/30 transition-all shadow-xs cursor-pointer"
        >
          <KeyRound className="w-3 h-3" />
          <span>{hasKey ? t.common.settings : t.settings.apiKeyLabel}</span>
        </button>
      </div>

      {/* Model Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span>{t.propertyPanel.model}</span>
            {modelOptions.length > 0 && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                ({modelOptions.length})
              </span>
            )}
          </label>
          <button
            type="button"
            onClick={async () => {
              setIsRefreshingModels(true);
              await fetchAvailableModels(activeProvider);
              setIsRefreshingModels(false);
            }}
            disabled={isRefreshingModels || !hasKey}
            className="text-[10px] text-blue-600 dark:text-sky-400 hover:text-blue-700 dark:hover:text-sky-300 disabled:opacity-40 flex items-center gap-1 transition-colors"
            title={t.propertyPanel.refreshModels}
          >
            <RefreshCw
              className={`w-3 h-3 ${isRefreshingModels ? 'animate-spin' : ''}`}
            />
            <span>
              {isRefreshingModels
                ? t.propertyPanel.refreshing
                : t.propertyPanel.refreshModels}
            </span>
          </button>
        </div>
        {modelOptions.length > 0 ? (
          <select
            value={currentModel}
            onChange={(e) => updateNodeConfig(nodeId, { model: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono cursor-pointer"
          >
            {modelOptions.map((m) => (
              <option
                key={m}
                value={m}
                className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200"
              >
                {m}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={currentModel}
            onChange={(e) => updateNodeConfig(nodeId, { model: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
            placeholder={t.propertyPanel.customModelPlaceholder}
          />
        )}
      </div>

      {/* Temperature Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            <span>{t.propertyPanel.temperature}</span>
          </span>
          <span className="text-amber-600 dark:text-amber-400 font-bold">
            {typeof config['temperature'] === 'number' ? config['temperature'] : 0.7}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={typeof config['temperature'] === 'number' ? config['temperature'] : 0.7}
          onChange={(e) =>
            updateNodeConfig(nodeId, { temperature: parseFloat(e.target.value) })
          }
          className="w-full accent-blue-600 dark:accent-sky-400 bg-slate-200 dark:bg-slate-950 cursor-pointer"
        />
      </div>

      {/* System Prompt */}
      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
          System Prompt (Optional)
        </label>
        <textarea
          rows={2}
          value={(config['systemPrompt'] as string) || ''}
          onChange={(e) => updateNodeConfig(nodeId, { systemPrompt: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-200 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
          placeholder="You are an expert AI assistant..."
        />
      </div>

      {/* ResponseFormat 显式协商模式选择 (生产标准配置) */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">
          Response Format 约束解码 (L1)
        </label>
        <select
          value={currentFormat}
          onChange={(e) => {
            const val = e.target.value as ResponseFormatMode;
            updateNodeConfig(nodeId, { responseFormat: val });
          }}
          className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-slate-200 cursor-pointer"
        >
          <option value="none">none (无格式约束 / Prompt 软指引)</option>
          <option value="json_schema">json_schema (Strict 严格结构化解码)</option>
          <option value="json_object">json_object (JSON Mode 语法闭合)</option>
        </select>
      </div>

      {/* Zod 业务契约 (zodSchemaConfig) 编辑器 (生产标准配置) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <FileCode className="w-3.5 h-3.5 text-blue-500" />
            <span>Zod 业务契约 (zodSchemaConfig)</span>
          </span>
          {schemaError ? (
            <span className="text-[10px] text-rose-500 font-mono">{schemaError}</span>
          ) : (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
              JSON 合法
            </span>
          )}
        </div>
        <textarea
          rows={3}
          value={schemaJsonText}
          onChange={(e) => handleSchemaJsonChange(e.target.value)}
          className="w-full px-2.5 py-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-800 dark:text-slate-200 leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-500/20 resize-y"
          placeholder='{"fields":{"urgency":{"type":"number","min":1,"max":5},"summary":{"type":"string","minLength":5}}}'
        />
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 研究模式未开启时的指引提示 (默认关闭，关闭时不显示测试模块) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {!researchMode && (
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px]">
            <FlaskConical className="w-4 h-4 text-slate-400 shrink-0" />
            <span>自愈测试台与故障注入模块默认隐藏</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setCurrentView('settings');
              setSettingsTab('general');
            }}
            className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline font-semibold cursor-pointer shrink-0"
          >
            开启研究模式 &rarr;
          </button>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 确定性输出与自愈测试台 (仅在研究模式开启时展现)              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {researchMode && (
        <div className="p-3.5 rounded-xl border border-sky-200 dark:border-sky-900/50 bg-sky-50/40 dark:bg-sky-950/20 space-y-3.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-800 dark:text-sky-300">
              <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>LLM 确定性测试台与返回值注入器</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 font-semibold">
              L1+L2 状态机
            </span>
          </div>

          {/* 运行与仿真模式选择 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                运行与仿真模式
              </span>
              <span className="text-[10px] text-sky-600 dark:text-sky-400 font-mono">
                {simMode === 'mock_first_round_then_real'
                  ? '首轮注入 ➔ 真实自愈'
                  : simMode === 'offline_mock'
                    ? '纯离线全仿真'
                    : '真实 API 直连'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() =>
                  updateNodeConfig(nodeId, {
                    simulationMode: 'mock_first_round_then_real',
                    mockFirstRoundOnly: true,
                    forceSimulation: false,
                  })
                }
                className={`py-1.5 px-1 rounded-md transition-all cursor-pointer text-center text-[10px] leading-tight ${
                  simMode === 'mock_first_round_then_real'
                    ? 'bg-sky-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="第 1 轮返回使用您在下方注入的模拟返回值；触发 L1/L2 校验失败后，将自动携带错误反馈丢给【真实 LLM】执行 Round 2 自愈！"
              >
                🎯 首轮注入+真实自愈
              </button>
              <button
                type="button"
                onClick={() =>
                  updateNodeConfig(nodeId, {
                    simulationMode: 'offline_mock',
                    mockFirstRoundOnly: false,
                    forceSimulation: true,
                  })
                }
                className={`py-1.5 px-1 rounded-md transition-all cursor-pointer text-center text-[10px] leading-tight ${
                  simMode === 'offline_mock'
                    ? 'bg-sky-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="全部轮次均使用下方的模拟返回值，无需真实 API Key 即可全离线测试"
              >
                🧪 纯离线全仿真
              </button>
              <button
                type="button"
                onClick={handleResetToLiveMode}
                className={`py-1.5 px-1 rounded-md transition-all cursor-pointer text-center text-[10px] leading-tight ${
                  simMode === 'live_api'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                title="所有轮次均调用真实配置的 LLM 服务商 API，并清除本节点的测试仿真配置"
              >
                🌐 纯实时 API
              </button>
            </div>
            {simMode === 'mock_first_round_then_real' && (
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-[10px] text-amber-800 dark:text-amber-300 leading-relaxed">
                ⚡ <strong>首轮故障注入已激活</strong>：第 1 轮将使用下方 Round 1 的注入返回值；若被 L1/L2 拦截，引擎将生成精准字段级纠错记忆，并在第 2 轮<strong>直接调用真实 LLM ({currentModel})</strong> 执行在线自愈修复！
              </div>
            )}
          </div>

          {/* 6 个核心测试场景快速载入卡片 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                6 大经典场景快捷载入
              </span>
              <div className="flex items-center gap-2">
                {Boolean(config['testScenario'] || (config['simulationResponses'] && (config['simulationResponses'] as unknown[]).length > 0) || simMode !== 'live_api') && (
                  <button
                    type="button"
                    onClick={handleResetToLiveMode}
                    className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors cursor-pointer"
                    title="清除当前节点的模拟返回值与测试场景，恢复为默认生产实时模式"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>恢复实时</span>
                  </button>
                )}
                <span className="text-[10px] text-slate-400">点击填入后可自由修改</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  'valid',
                  'missing_field',
                  'enum_out_of_bounds',
                  'token_truncated',
                  'empty_output',
                  'three_failures',
                  'semantic_refine_violation',
                ] as LLMTestScenario[]
              ).map((scId) => {
                const def = TEST_SCENARIOS[scId];
                const isSelected = currentScenario === scId;
                return (
                  <button
                    key={scId}
                    type="button"
                    onClick={() => handleSelectScenario(scId)}
                    className={`text-left p-2 rounded-lg border text-[11px] transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-500'
                    }`}
                  >
                    <div className="font-semibold truncate">{def.name}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 当前选中场景描述说明卡 */}
          {activeScenarioDef && (
            <div className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-sky-100 dark:border-sky-800/40 text-[11px] space-y-1">
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                {activeScenarioDef.name}
              </div>
              <div className="text-slate-600 dark:text-slate-400 text-[10px] leading-relaxed">
                {activeScenarioDef.description}
              </div>
              <div className="text-sky-700 dark:text-sky-400 font-mono text-[10px] pt-0.5">
                🎯 预期: {activeScenarioDef.expectedOutcome}
              </div>
            </div>
          )}

          {/* 多轮自愈模拟响应输入 (核心：可自由修改每轮 LLM 返回值) */}
          <div className="space-y-2.5 pt-1.5 border-t border-sky-100 dark:border-sky-900/40">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span>LLM 模拟返回值注入器 (可任意修改)</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">共 {simResponses.length} 轮返回</span>
            </div>

            <div className="space-y-2">
              {simResponses.map((resp, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                      <span className="w-4 h-4 rounded-full bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span>
                        {idx === 0 ? 'Round 1 (初次模型输出)' : `Round ${idx + 1} (自愈重试 #${idx} 输出)`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* finishReason 下拉选择 */}
                      <select
                        value={simFinishReasons[idx] || 'stop'}
                        onChange={(e) => handleSimFinishReasonChange(idx, e.target.value)}
                        className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                        title="模拟 finishReason"
                      >
                        <option value="stop">finish: stop</option>
                        <option value="length">finish: length</option>
                      </select>

                      {/* 格式化按钮 */}
                      <button
                        type="button"
                        onClick={() => handlePrettifyRound(idx)}
                        className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 transition-colors cursor-pointer"
                        title="格式化 JSON"
                      >
                        排版
                      </button>

                      {/* 空包按钮 */}
                      <button
                        type="button"
                        onClick={() => handleSimResponseChange(idx, '')}
                        className="text-[10px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 transition-colors cursor-pointer"
                        title="设为空包 (模拟 DeepSeek 空包坑)"
                      >
                        清空
                      </button>

                      {/* 删除轮次 (至少保留 1 轮) */}
                      {simResponses.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteRound(idx)}
                          className="text-[10px] text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 p-0.5 transition-colors cursor-pointer ml-0.5"
                          title="删除此轮输出"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    value={resp}
                    onChange={(e) => handleSimResponseChange(idx, e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-800 dark:text-slate-200 leading-snug focus:outline-none focus:ring-2 focus:ring-sky-500/20 resize-y"
                    placeholder='{"urgency": 9, "summary": "可自由修改此处的模型输出内容..."}'
                  />
                </div>
              ))}
            </div>

            {/* 轮次增减与重置快捷按钮 */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleAddRound}
                disabled={simResponses.length >= 3}
                className="flex items-center gap-1 text-[11px] text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 disabled:opacity-40 font-medium cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>添加一轮重试返回 (最多3轮)</span>
              </button>

              {activeScenarioDef && (
                <button
                  type="button"
                  onClick={handleResetScenarioDefaults}
                  className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                  title="重置为当前场景的默认返回值"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>重置为默认值</span>
                </button>
              )}
            </div>
          </div>

          {/* 触发控制按钮与模式开关 */}
          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={() => retryNode(nodeId, { isNodeTest: true })}
              disabled={isExecuting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
            >
              <Play className={`w-4 h-4 ${isExecuting ? 'animate-spin' : ''}`} />
              <span>
                {isExecuting
                  ? '正在由 LLM 节点处理逻辑...'
                  : '🚀 抛给此 LLM 节点执行 (Run with Mock Return)'}
              </span>
            </button>

            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed text-center">
              💡 点击上方按钮将仅在此节点执行注入测试（含格式协商、L1/L2 契约校验与自愈状态机）。右上角的「运行工作流」依然会按整网真实数据流跑全量生产流程，不会被本节点的测试注入影响。
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LLMNodeProperties;

