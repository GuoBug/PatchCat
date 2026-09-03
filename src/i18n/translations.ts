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
    unconfiguredModalTitle: string;
    unconfiguredModalDesc: string;
    bindApiKeyBtn: string;
    validateFlowOnlyBtn: string;
    unconfiguredBadge: string;
  };
  nodeTypes: {
    input: string;
    prompt: string;
    llm: string;
    code: string;
    output: string;
    knowledge: string;
    inputDesc: string;
    promptDesc: string;
    llmDesc: string;
    codeDesc: string;
    outputDesc: string;
    knowledgeDesc: string;
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
    knowledgeConfig: string;
    knowledgeBase: string;
    selectKnowledgeBase: string;
    noKnowledgeBaseFound: string;
    knowledgeQuery: string;
    knowledgeQueryPlaceholder: string;
    topK: string;
    scoreThreshold: string;
    knowledgeAttributionHint: string;
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
    // Storage Mode Section
    storageSection: string;
    storageSectionDesc: string;
    storageLocal: string;
    storageLocalDesc: string;
    storageServer: string;
    storageServerDesc: string;
    serverUrlLabel: string;
    testServerBtn: string;
    testingServerBtn: string;
    serverConnectedBadge: string;
    serverDisconnectedBadge: string;
    serverTestSuccess: string;
    serverTestFailed: string;
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
  sidebar: {
    newWorkflow: string;
    allWorkflows: string;
    workflowHistory: string;
    projects: string;
    newFolder: string;
    searchPlaceholder: string;
    folderNamePlaceholder: string;
    workflowNamePlaceholder: string;
    defaultFolder: string;
    presetsFolder: string;
    untitledWorkflow: string;
    rename: string;
    duplicate: string;
    moveTo: string;
    delete: string;
    deleteFolderConfirm: string;
    deleteWorkflowConfirm: string;
    noWorkflowsInFolder: string;
    toggleSidebar: string;
    collapseSidebar: string;
    expandSidebar: string;
    workflowsCount: string;
    selectFolder: string;
  };
}

export const translations: Record<Language, Translations> = {
  en: {
    common: {
      backToCanvas: 'Back to Canvas',
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
      unconfiguredModalTitle: 'LLM Model API Key Not Configured',
      unconfiguredModalDesc: 'The current workflow contains LLM inference nodes, but the active provider has no verified API Key configured. You can bind your API Key now, or run a flow validation that skips model calls and verifies data routing.',
      bindApiKeyBtn: 'Configure API Key',
      validateFlowOnlyBtn: 'Validate Flow Only (Skip LLM)',
      unconfiguredBadge: 'No API Key Set',
    },
    nodeTypes: {
      input: 'Input Node',
      prompt: 'Prompt Template',
      llm: 'LLM Call',
      code: 'Code Node',
      output: 'Output Node',
      knowledge: 'Knowledge Retrieval',
      inputDesc: 'Inject entry parameters into workflow',
      promptDesc: 'Dynamic prompt template assembly',
      llmDesc: 'Execute LLM inference call',
      codeDesc: 'Execute JavaScript code transformation',
      outputDesc: 'Format and display final outputs',
      knowledgeDesc: 'Semantic retrieval from knowledge base (RAG)',
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
      knowledgeConfig: 'Knowledge Base (RAG) Config',
      knowledgeBase: 'Target Knowledge Base',
      selectKnowledgeBase: 'Select Knowledge Base...',
      noKnowledgeBaseFound: 'No knowledge bases found. Create one in backend.',
      knowledgeQuery: 'Query String',
      knowledgeQueryPlaceholder: 'Query to search (supports {{input_1.query}})...',
      topK: 'Top-K Recall Count',
      scoreThreshold: 'Similarity Threshold',
      knowledgeAttributionHint: 'Outputs {{result}} (markdown text) and {{chunks}} (array).',
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
      // Storage Mode Section
      storageSection: 'Storage & Backend Mode',
      storageSectionDesc: 'Choose where workflows and project directories are saved.',
      storageLocal: 'Browser Local Storage (BYOK)',
      storageLocalDesc: 'Store workflows completely in your browser localStorage. 100% private with zero backend setup.',
      storageServer: 'FastAPI Backend Server (PostgreSQL / SQLite)',
      storageServerDesc: 'Persist workflows and project directories to your FastAPI backend server with database synchronization.',
      serverUrlLabel: 'Backend API URL',
      testServerBtn: 'Test Connection',
      testingServerBtn: 'Testing...',
      serverConnectedBadge: 'Connected',
      serverDisconnectedBadge: 'Disconnected',
      serverTestSuccess: 'Backend server is healthy and connected to database.',
      serverTestFailed: 'Unable to connect to backend server. Please check if FastAPI is running.',
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
    sidebar: {
      newWorkflow: 'New Workflow',
      allWorkflows: 'All Workflows',
      workflowHistory: 'Workflow History',
      projects: 'Projects & Folders',
      newFolder: 'New Folder',
      searchPlaceholder: 'Search workflows...',
      folderNamePlaceholder: 'Folder name...',
      workflowNamePlaceholder: 'Workflow name...',
      defaultFolder: 'Default',
      presetsFolder: 'Built-in Presets',
      untitledWorkflow: 'Untitled Workflow',
      rename: 'Rename',
      duplicate: 'Duplicate',
      moveTo: 'Move to Folder',
      delete: 'Delete',
      deleteFolderConfirm: 'Are you sure you want to delete this folder and its workflows?',
      deleteWorkflowConfirm: 'Are you sure you want to delete this workflow?',
      noWorkflowsInFolder: 'No workflows in this folder',
      toggleSidebar: 'Toggle Workflow Drawer',
      collapseSidebar: 'Collapse Sidebar',
      expandSidebar: 'Expand Sidebar',
      workflowsCount: 'workflows',
      selectFolder: 'Select destination folder',
    },
  },
  zh: {
    common: {
      backToCanvas: '返回画布',
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
      unconfiguredModalTitle: '未配置大模型 API Key 凭证',
      unconfiguredModalDesc: '当前工作流包含 LLM 推理节点，但所选的大模型服务商尚未配置或绑定有效 API Key。您可以前往设置页面绑定 Key，或仅执行工作流流程校验（自动跳过模型调用，校验数据流转）。',
      bindApiKeyBtn: '去配置绑定 API Key',
      validateFlowOnlyBtn: '仅进行流程校验 (跳过模型)',
      unconfiguredBadge: '未配置 API Key',
    },
    nodeTypes: {
      input: '输入节点',
      prompt: '提示词模板',
      llm: '大模型推理',
      code: '代码转换',
      output: '输出节点',
      knowledge: '知识库检索',
      inputDesc: '向工作流注入入参变量',
      promptDesc: '动态组装提示词模板',
      llmDesc: '执行大模型推理调用',
      codeDesc: '运行 JavaScript 数据处理与路由',
      outputDesc: '汇总并展示最终生成结果',
      knowledgeDesc: '从私有知识库中语义召回相关切片 (RAG)',
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
      knowledgeConfig: '知识库增强检索 (RAG) 配置',
      knowledgeBase: '目标知识库',
      selectKnowledgeBase: '选择知识库...',
      noKnowledgeBaseFound: '暂未发现可用知识库，请先在服务端创建知识库',
      knowledgeQuery: '检索查询语句 (Query)',
      knowledgeQueryPlaceholder: '输入搜索内容，支持 {{input_1.query}} 动态变量...',
      topK: 'Top-K 召回数量',
      scoreThreshold: '相似度过滤阈值',
      knowledgeAttributionHint: '输出 {{result}} (标准 Markdown 上下文) 与 {{chunks}} (结构化切片数组)。',
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
      // Storage Mode Section
      storageSection: '存储与后端服务模式',
      storageSectionDesc: '选择工作流和项目目录的保存位置与同步方式。',
      storageLocal: '浏览器本地存储 (BYOK 模式)',
      storageLocalDesc: '工作流完全保存在浏览器 LocalStorage 中，无需后端数据库，零配置且完全私密。',
      storageServer: 'FastAPI 后端服务 (PostgreSQL / SQLite)',
      storageServerDesc: '持久化存储至 FastAPI 后端数据库，支持多端数据同步与知识库向量检索。',
      serverUrlLabel: '后端服务地址 (API Base URL)',
      testServerBtn: '测试后端连接',
      testingServerBtn: '正在连接...',
      serverConnectedBadge: '后端已连接',
      serverDisconnectedBadge: '后端未连接',
      serverTestSuccess: '已成功连接至 FastAPI 后端服务并验证数据库连通正常。',
      serverTestFailed: '无法连接至后端服务，请检查 FastAPI 服务是否已在对应端口启动。',
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
    sidebar: {
      newWorkflow: '新建流程',
      allWorkflows: '全部流程',
      workflowHistory: '流程历史',
      projects: '目录与项目',
      newFolder: '新建目录',
      searchPlaceholder: '搜索工作流...',
      folderNamePlaceholder: '目录名称...',
      workflowNamePlaceholder: '流程名称...',
      defaultFolder: '默认目录',
      presetsFolder: '官方预设库',
      untitledWorkflow: '未命名流程',
      rename: '重命名',
      duplicate: '复制副本',
      moveTo: '移动至目录',
      delete: '删除',
      deleteFolderConfirm: '确定要删除此目录及其包含的所有工作流吗？',
      deleteWorkflowConfirm: '确定要删除此工作流吗？',
      noWorkflowsInFolder: '该目录下暂无工作流',
      toggleSidebar: '切换流程侧边栏',
      collapseSidebar: '收起侧边栏',
      expandSidebar: '展开侧边栏',
      workflowsCount: '个流程',
      selectFolder: '选择目标目录',
    },
  },
};
