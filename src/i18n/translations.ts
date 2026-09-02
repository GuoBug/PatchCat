export type Language = 'en' | 'zh';

export interface Translations {
  common: {
    backToCanvas: string;
    settings: string;
    logs: string;
    save: string;
    reset: string;
    cancel: string;
    done: string;
    copied: string;
    copy: string;
    delete: string;
    close: string;
    loading: string;
    success: string;
    error: string;
    warning: string;
    search: string;
    export: string;
    clear: string;
    active: string;
    nodes: string;
    edges: string;
    theme: string;
    lightMode: string;
    darkMode: string;
  };
  header: {
    tagline: string;
    addNode: string;
    preset: string;
    apiKey: string;
    apiKeyConfigured: string;
    apiKeyMissing: string;
    settingsTooltip: string;
    apiKeyTooltip: string;
    themeTooltipLight: string;
    themeTooltipDark: string;
    resetTooltip: string;
    runWorkflow: string;
    stopWorkflow: string;
    cycleDetected: string;
    cycleAlertTitle: string;
    cycleAlertMsg: string;
    cycleNodesLabel: string;
    unknownEngineError: string;
  };
  nodeTypes: {
    input: string;
    prompt: string;
    llm: string;
    code: string;
    output: string;
    inputDesc: string;
    promptDesc: string;
    llmDesc: string;
    codeDesc: string;
    outputDesc: string;
  };
  propertyPanel: {
    title: string;
    noNodeSelected: string;
    noNodeSelectedDesc: string;
    deleteNode: string;
    nodeLabel: string;
    nodeDescription: string;
    descriptionPlaceholder: string;
    parameters: string;
    fieldCount: string;
    noParameters: string;
    addParameter: string;
    paramKey: string;
    paramValue: string;
    promptTemplate: string;
    promptPlaceholder: string;
    variableHelper: string;
    detectedVars: string;
    noVarsDetected: string;
    modelConfig: string;
    provider: string;
    model: string;
    refreshModels: string;
    refreshing: string;
    customModelPlaceholder: string;
    temperature: string;
    temperatureCreative: string;
    temperaturePrecise: string;
    codeConfig: string;
    runtime: string;
    scriptCode: string;
    outputConfig: string;
    outputFormat: string;
    executionTelemetry: string;
    status: string;
    latency: string;
    tokenUsage: string;
    liveStreaming: string;
    reasoningThought: string;
    finalOutput: string;
  };
  settings: {
    pageTitle: string;
    pageSubtitle: string;
    tabGeneral: string;
    tabProviders: string;
    tabLogs: string;
    // General Tab
    generalTitle: string;
    generalDesc: string;
    languageSection: string;
    languageSectionDesc: string;
    langEn: string;
    langZh: string;
    themeSection: string;
    themeSectionDesc: string;
    themeLight: string;
    themeDark: string;
    engineSection: string;
    engineSectionDesc: string;
    engineMock: string;
    engineMockDesc: string;
    engineBrowser: string;
    engineBrowserDesc: string;
    // Providers Tab
    providersTitle: string;
    providersSubtitle: string;
    setAsActive: string;
    currentActive: string;
    apiBaseUrl: string;
    resetEndpoint: string;
    apiKeyLabel: string;
    ollamaNoKeyNeeded: string;
    getKey: string;
    defaultModel: string;
    availableCount: string;
    fetchModels: string;
    orCustomModel: string;
    testConnection: string;
    testingConnection: string;
    resetProvider: string;
    privacyNotice: string;
    // Logs Tab
    logsTitle: string;
    logsSubtitle: string;
    logLevel: string;
    levelSummary: string;
    levelSummaryDesc: string;
    levelDetailed: string;
    levelDetailedDesc: string;
    levelDev: string;
    levelDevDesc: string;
    secretMaskedNotice: string;
    searchLogsPlaceholder: string;
    autoScroll: string;
    clearLogs: string;
    exportLogs: string;
    exportJson: string;
    exportTxt: string;
    filterAll: string;
    filterSystem: string;
    filterRequest: string;
    filterNode: string;
    filterError: string;
    noLogsMatch: string;
    noLogsHint: string;
    showDetails: string;
    hideDetails: string;
    copyPayloadJson: string;
  };
  help: {
    title: string;
    subtitle: string;
    tabQuickstart: string;
    tabNodes: string;
    tabShortcuts: string;
    tabDocs: string;
  };
  footer: {
    tagline: string;
    author: string;
    helpDocs: string;
    github: string;
  };
}

export const translations: Record<Language, Translations> = {
  en: {
    common: {
      backToCanvas: '← Back to Canvas',
      settings: 'Settings',
      logs: 'Logs',
      save: 'Save',
      reset: 'Reset',
      cancel: 'Cancel',
      done: 'Done',
      copied: 'Copied',
      copy: 'Copy',
      delete: 'Delete',
      close: 'Close',
      loading: 'Loading...',
      success: 'Success',
      error: 'Error',
      warning: 'Warning',
      search: 'Search',
      export: 'Export',
      clear: 'Clear',
      active: 'ACTIVE',
      nodes: 'nodes',
      edges: 'edges',
      theme: 'Theme',
      lightMode: 'Light Mode',
      darkMode: 'Dark Mode',
    },
    header: {
      tagline: 'Precision prompts. Seamless workflows.',
      addNode: 'Add Node',
      preset: 'Preset:',
      apiKey: 'API Key',
      apiKeyConfigured: 'API Key Configured',
      apiKeyMissing: 'API Key Not Set',
      settingsTooltip: 'Settings (LLM Providers, Language & Logs)',
      apiKeyTooltip: 'Configure API Keys & LLM Providers',
      themeTooltipLight: 'Switch to Light Mode',
      themeTooltipDark: 'Switch to Dark Mode',
      resetTooltip: 'Reset node states and clear execution cache',
      runWorkflow: 'Run Workflow',
      stopWorkflow: 'Stop',
      cycleDetected: 'Cycle Detected',
      cycleAlertTitle: 'Workflow Validation Failed: Cycle Detected',
      cycleAlertMsg: 'A closed dependency loop was detected. Unable to determine execution order. Please remove feedback edges and retry.',
      cycleNodesLabel: 'Involved cyclic nodes:',
      unknownEngineError: 'Execution Engine encountered an error',
    },
    nodeTypes: {
      input: 'Input Node',
      prompt: 'Prompt Template',
      llm: 'LLM Call',
      code: 'Code Node',
      output: 'Output Node',
      inputDesc: 'Inject entry parameters into workflow',
      promptDesc: 'Dynamic prompt template assembly',
      llmDesc: 'Execute LLM inference call',
      codeDesc: 'Execute JavaScript code transformation',
      outputDesc: 'Format and display final outputs',
    },
    propertyPanel: {
      title: 'Node Properties',
      noNodeSelected: 'No Node Selected',
      noNodeSelectedDesc: 'Click any node on the canvas to inspect its configuration and view live execution outputs.',
      deleteNode: 'Delete Node',
      nodeLabel: 'Node Name',
      nodeDescription: 'Description',
      descriptionPlaceholder: 'Brief description of this node...',
      parameters: 'Parameters',
      fieldCount: 'field(s)',
      noParameters: 'No parameters configured yet',
      addParameter: 'Add Parameter',
      paramKey: 'Key',
      paramValue: 'Value',
      promptTemplate: 'Prompt Template',
      promptPlaceholder: 'Write prompt template. Use {{nodeId.param}} for variable injection...',
      variableHelper: 'Upstream Variable Reference:',
      detectedVars: 'Detected Variables:',
      noVarsDetected: 'No variables detected yet. Type {{ to reference upstream nodes.',
      modelConfig: 'Model Configuration',
      provider: 'Provider',
      model: 'Model',
      refreshModels: 'Refresh Models',
      refreshing: 'Fetching...',
      customModelPlaceholder: 'custom-model-name',
      temperature: 'Temperature',
      temperatureCreative: 'Creative (1.0)',
      temperaturePrecise: 'Precise (0.0)',
      codeConfig: 'Transform Code',
      runtime: 'Runtime',
      scriptCode: 'JavaScript Function Body',
      outputConfig: 'Output Configuration',
      outputFormat: 'Display Format',
      executionTelemetry: 'Execution Telemetry',
      status: 'Status',
      latency: 'Latency',
      tokenUsage: 'Token Usage',
      liveStreaming: 'Live Streaming Output',
      reasoningThought: 'Reasoning Thought (DeepSeek R1 / o1)',
      finalOutput: 'Execution Result Output',
    },
    settings: {
      pageTitle: 'Settings & Configuration',
      pageSubtitle: 'Manage LLM Providers, UI Language, and Workflow Telemetry Logs',
      tabGeneral: 'General & Language',
      tabProviders: 'LLM Providers & API Keys',
      tabLogs: 'Execution Logs',
      // General Tab
      generalTitle: 'General Settings',
      generalDesc: 'Customize interface language, visual theme, and execution preferences.',
      languageSection: 'Display Language',
      languageSectionDesc: 'Select your preferred language for the interface and default presets.',
      langEn: 'English (US)',
      langZh: '简体中文 (Simplified Chinese)',
      themeSection: 'Theme Mode',
      themeSectionDesc: 'Switch between light and dark visual aesthetics.',
      themeLight: 'Light Slate Theme',
      themeDark: 'Dark Cyberpunk Theme',
      engineSection: 'Execution Mode',
      engineSectionDesc: 'Choose how workflows are executed.',
      engineMock: 'Mock Execution Engine',
      engineMockDesc: 'Simulate workflow runs locally with mock responses for instant testing.',
      engineBrowser: 'Browser BYOK Mode (Recommended)',
      engineBrowserDesc: 'Direct client-side connection using your own API keys with zero backend latency.',
      // Providers Tab
      providersTitle: 'LLM Providers & API Keys',
      providersSubtitle: 'Configure model endpoints and API credentials (BYOK). Pure client-side direct connection.',
      setAsActive: 'Set as Active',
      currentActive: 'Current Active Provider',
      apiBaseUrl: 'API Base URL',
      resetEndpoint: 'Reset Endpoint',
      apiKeyLabel: 'API Key',
      ollamaNoKeyNeeded: '(Ollama local server requires no API Key)',
      getKey: 'Get API Key',
      defaultModel: 'Default Model',
      availableCount: 'available',
      fetchModels: 'Fetch Models',
      orCustomModel: 'or enter custom model:',
      testConnection: 'Test Connection',
      testingConnection: 'Connecting...',
      resetProvider: 'Reset Provider',
      privacyNotice: 'All API keys are securely stored only in your browser LocalStorage and sent directly to LLM providers.',
      // Logs Tab
      logsTitle: 'Workflow Execution Logs',
      logsSubtitle: 'Real-time telemetry, request payloads, token counts, and error tracking.',
      logLevel: 'Log Level:',
      levelSummary: 'Summary',
      levelSummaryDesc: 'System start/stop, DAG scheduling, HTTP status, latency, and errors.',
      levelDetailed: 'Detailed',
      levelDetailedDesc: 'Includes Summary + Node IDs, model parameters, and dependency resolution.',
      levelDev: 'Development',
      levelDevDesc: 'Includes Detailed + Full Prompt inputs and output responses (strictly sanitized).',
      secretMaskedNotice: 'API Keys Auto-Masked',
      searchLogsPlaceholder: 'Search logs (keywords, node ID)...',
      autoScroll: 'Auto Scroll',
      clearLogs: 'Clear Logs',
      exportLogs: 'Export',
      exportJson: 'Export JSON (.json)',
      exportTxt: 'Export Text (.txt)',
      filterAll: 'All',
      filterSystem: 'System',
      filterRequest: 'Request',
      filterNode: 'Node',
      filterError: 'Error',
      noLogsMatch: 'No matching log entries found',
      noLogsHint: 'Run a workflow on the canvas to inspect real-time execution telemetry here.',
      showDetails: 'View Payload',
      hideDetails: 'Hide Payload',
      copyPayloadJson: 'Copy JSON',
    },
    help: {
      title: 'PatchCat Documentation',
      subtitle: 'Visual Prompt Flow Orchestrator & Multi-Agent Architecture Guide',
      tabQuickstart: '🚀 Quickstart',
      tabNodes: '🧩 Node Types',
      tabShortcuts: '⌨️ Shortcuts',
      tabDocs: '📚 Dev Docs',
    },
    footer: {
      tagline: 'Visual Prompt Orchestration Engine',
      author: 'Author',
      helpDocs: 'Help & Docs',
      github: 'GitHub',
    },
  },
  zh: {
    common: {
      backToCanvas: '← 返回画布',
      settings: '设置',
      logs: '日志',
      save: '保存',
      reset: '重置',
      cancel: '取消',
      done: '完成',
      copied: '已复制',
      copy: '复制',
      delete: '删除',
      close: '关闭',
      loading: '加载中...',
      success: '成功',
      error: '错误',
      warning: '警告',
      search: '搜索',
      export: '导出',
      clear: '清空',
      active: '当前使用',
      nodes: '节点',
      edges: '连线',
      theme: '主题',
      lightMode: '浅色主题',
      darkMode: '暗黑主题',
    },
    header: {
      tagline: '精准提示词编排 · 无缝工作流协同',
      addNode: '添加节点',
      preset: '预设模板:',
      apiKey: 'API 密钥',
      apiKeyConfigured: 'API Key 已配置',
      apiKeyMissing: '未配置 API Key',
      settingsTooltip: '系统设置 (大模型配置、语言切换与日志)',
      apiKeyTooltip: '配置 API Keys & LLM Providers',
      themeTooltipLight: '切换为浅色主题',
      themeTooltipDark: '切换为暗黑主题',
      resetTooltip: '重置节点运行状态与清空执行缓存',
      runWorkflow: '运行工作流',
      stopWorkflow: '停止运行',
      cycleDetected: '检测到环路',
      cycleAlertTitle: '工作流校验失败：检测到拓扑环路',
      cycleAlertMsg: '图中存在闭环依赖死锁，无法确定拓扑执行层级。请删除回环边后重试。',
      cycleNodesLabel: '涉及成环节点:',
      unknownEngineError: '执行引擎发生未知错误',
    },
    nodeTypes: {
      input: '输入节点',
      prompt: '提示词模板',
      llm: '大模型推理',
      code: '代码转换',
      output: '输出节点',
      inputDesc: '向工作流注入入参变量',
      promptDesc: '动态组装提示词模板',
      llmDesc: '执行大模型推理调用',
      codeDesc: '运行 JavaScript 数据处理与路由',
      outputDesc: '汇总并展示最终生成结果',
    },
    propertyPanel: {
      title: '节点属性配置',
      noNodeSelected: '未选择节点',
      noNodeSelectedDesc: '在左侧画布中点击任意节点以检查其属性配置并查看实时运行输出。',
      deleteNode: '删除此节点',
      nodeLabel: '节点名称',
      nodeDescription: '功能描述',
      descriptionPlaceholder: '简要描述该节点职责...',
      parameters: '输入参数表',
      fieldCount: '个字段',
      noParameters: '暂未配置任何默认参数',
      addParameter: '添加参数字段',
      paramKey: '参数名 (Key)',
      paramValue: '默认值 (Value)',
      promptTemplate: '提示词模板',
      promptPlaceholder: '编写提示词模板，支持使用 {{nodeId.param}} 引用上游节点变量...',
      variableHelper: '上游可用变量参考:',
      detectedVars: '已识别模板变量:',
      noVarsDetected: '尚未检测到变量。输入 {{ 即可引用上游节点输出。',
      modelConfig: '模型与推理配置',
      provider: '模型服务商',
      model: '推理模型',
      refreshModels: '刷新模型列表',
      refreshing: '拉取中...',
      customModelPlaceholder: '自定义模型名称',
      temperature: '采样温度 (Temperature)',
      temperatureCreative: '发散创意 (1.0)',
      temperaturePrecise: '严谨精确 (0.0)',
      codeConfig: '脚本转换逻辑',
      runtime: '运行环境',
      scriptCode: 'JavaScript 函数体代码',
      outputConfig: '输出配置',
      outputFormat: '渲染格式',
      executionTelemetry: '执行性能与消耗指标',
      status: '状态',
      latency: '耗时',
      tokenUsage: 'Token 消耗',
      liveStreaming: '实时流式输出',
      reasoningThought: '思考过程 (DeepSeek R1 / o1 推理链)',
      finalOutput: '执行结果输出',
    },
    settings: {
      pageTitle: '系统设置与配置',
      pageSubtitle: '管理 LLM 模型服务商、界面多语言与全链路运行遥测日志',
      tabGeneral: '常规与语言',
      tabProviders: '模型服务商与 API Key',
      tabLogs: '运行日志控制台',
      // General Tab
      generalTitle: '常规与语言偏好',
      generalDesc: '自定义界面语言、显示主题与工作流执行模式。',
      languageSection: '界面显示语言 (Language)',
      languageSectionDesc: '选择您希望使用的界面展示语言与默认示例。',
      langEn: 'English (US)',
      langZh: '简体中文 (Simplified Chinese)',
      themeSection: '外观主题',
      themeSectionDesc: '在清爽现代浅色风格与极客暗黑主题间切换。',
      themeLight: '现代极简浅色 (Light)',
      themeDark: '赛博极客暗黑 (Dark)',
      engineSection: '执行引擎模式',
      engineSectionDesc: '选择工作流的驱动与执行方式。',
      engineMock: 'Mock 离线模拟引擎',
      engineMockDesc: '无网络依赖，使用本地预设快速体验工作流调度过程。',
      engineBrowser: '纯前端 BYOK 直连模式 (推荐)',
      engineBrowserDesc: '使用您自己的 API 密钥从浏览器直接调用大模型，零后端中转，安全隐私。',
      // Providers Tab
      providersTitle: 'LLM Provider & API Key 设置',
      providersSubtitle: '配置大模型端点与 API 凭证 (BYOK)，零后端纯前端直连。',
      setAsActive: '设为默认',
      currentActive: '当前默认 Provider',
      apiBaseUrl: 'API Base URL',
      resetEndpoint: '重置端点',
      apiKeyLabel: 'API Key',
      ollamaNoKeyNeeded: '(Ollama 本地无需 API Key)',
      getKey: '获取 Key',
      defaultModel: '默认模型 (Default Model)',
      availableCount: '个可用',
      fetchModels: '刷新模型列表',
      orCustomModel: '或输入自定义模型:',
      testConnection: '测试连通性 (Test Connection)',
      testingConnection: '正在连接...',
      resetProvider: '重置该 Provider',
      privacyNotice: '所有 API Key 仅保存在浏览器 LocalStorage，直连大模型服务商，绝不经由第三方服务器。',
      // Logs Tab
      logsTitle: '工作流运行日志控制台',
      logsSubtitle: '全链路遥测日志、API 请求响应 Payload 检查与报错追踪。',
      logLevel: '日志记录等级:',
      levelSummary: '概要 (Summary)',
      levelSummaryDesc: '记录系统启停、拓扑调度、请求状态码与耗时、异常报错。',
      levelDetailed: '详细 (Detailed)',
      levelDetailedDesc: '包含概要，补充节点 ID、模型参数、依赖波次流转。',
      levelDev: '开发 (Development)',
      levelDevDesc: '包含详细，捕获输入输出全文 (密钥已脱敏过滤)。',
      secretMaskedNotice: '密钥自动脱敏',
      searchLogsPlaceholder: '搜索日志 (关键词/节点 ID)...',
      autoScroll: '自动滚动',
      clearLogs: '清空日志',
      exportLogs: '导出日志',
      exportJson: '导出 JSON (.json)',
      exportTxt: '导出 文本 (.txt)',
      filterAll: '全部',
      filterSystem: '系统',
      filterRequest: '请求',
      filterNode: '节点',
      filterError: '异常',
      noLogsMatch: '暂无符合条件的日志记录',
      noLogsHint: '点击画布上方 “运行工作流” 后，实时日志将在此滚动展示。',
      showDetails: '详情 Payload',
      hideDetails: '收起详情',
      copyPayloadJson: '复制 JSON',
    },
    help: {
      title: 'PatchCat 帮助与使用文档',
      subtitle: '可视化 AI Prompt 编排引擎与多智能体工作流快速上手指南',
      tabQuickstart: '🚀 快速上手',
      tabNodes: '🧩 节点指南',
      tabShortcuts: '⌨️ 快捷操作',
      tabDocs: '📚 开发文档',
    },
    footer: {
      tagline: '可视化 AI Prompt 编排引擎',
      author: '作者',
      helpDocs: '帮助文档',
      github: 'GitHub 仓库',
    },
  },
};
