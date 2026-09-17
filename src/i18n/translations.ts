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
    publishApi: string;
    chatDebug: string;
    lockedWorkflowBadge: string;
  };
  nodeTypes: {
    input: string;
    prompt: string;
    llm: string;
    code: string;
    output: string;
    knowledge: string;
    condition: string;
    aggregator: string;
    http: string;
    agent: string;
    loop: string;
    sub_workflow: string;
    inputDesc: string;
    promptDesc: string;
    llmDesc: string;
    codeDesc: string;
    outputDesc: string;
    knowledgeDesc: string;
    conditionDesc: string;
    aggregatorDesc: string;
    httpDesc: string;
    agentDesc: string;
    loopDesc: string;
    sub_workflowDesc: string;
  };
  propertyPanel: {
    title: string;
    noNodeSelected: string;
    noNodeSelectedDesc: string;
    collapsePanel: string;
    expandPanel: string;
    closePanel: string;
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
    // Condition Node
    conditionRulesTitle: string;
    addRule: string;
    deleteRule: string;
    ruleIndex: string;
    variableLabel: string;
    variablePlaceholder: string;
    operatorLabel: string;
    operatorEquals: string;
    operatorNotEquals: string;
    operatorContains: string;
    operatorNotContains: string;
    operatorGreaterThan: string;
    operatorLessThan: string;
    operatorIsEmpty: string;
    operatorIsNotEmpty: string;
    operatorRegexMatch: string;
    compareValueLabel: string;
    compareValuePlaceholder: string;
    targetHandleLabel: string;
    fallbackBranchTitle: string;
    fallbackBranchPlaceholder: string;
    fallbackBranchHint: string;
    // Aggregator Node
    aggregatorModeTitle: string;
    aggFirstAvailableLabel: string;
    aggFirstAvailableDesc: string;
    aggMergeAllLabel: string;
    aggMergeAllDesc: string;
    aggWaitAllLabel: string;
    aggWaitAllDesc: string;
    aggOutputKeyLabel: string;
    aggOutputKeyHint: string;
    // HTTP Request Node
    httpConfigTitle: string;
    httpUrlPlaceholder: string;
    httpUrlHint: string;
    httpTabParams: string;
    httpTabHeaders: string;
    httpTabBody: string;
    httpTabAuth: string;
    httpTabSettings: string;
    httpQueryParamsTitle: string;
    httpAddParam: string;
    httpNoQueryParams: string;
    httpHeadersTitle: string;
    httpAddHeader: string;
    httpDefaultHeadersHint: string;
    httpBodyFormat: string;
    httpAuthType: string;
    httpAuthNone: string;
    httpAuthBearer: string;
    httpAuthBasic: string;
    httpAuthApiKey: string;
    httpBearerTokenLabel: string;
    httpUsernameLabel: string;
    httpPasswordLabel: string;
    httpKeyNamePlaceholder: string;
    httpKeyValuePlaceholder: string;
    httpSendInHeader: string;
    httpSendInQuery: string;
    httpTimeoutLabel: string;
    httpMaxRetriesLabel: string;
    // Agent Node
    agentSystemPrompt: string;
    agentTools: string;
    agentAddTool: string;
    agentToolName: string;
    agentToolDescription: string;
    agentToolType: string;
    agentMaxIterations: string;
    agentToolCode: string;
    agentToolUrl: string;
    agentToolSchema: string;
    agentTokenBudget: string;
    agentLoopDetection: string;
    agentLoopThreshold: string;
    // Loop Node
    loopInputVariable: string;
    loopConcurrency: string;
    loopItemTimeout: string;
    // Sub-Workflow Node
    subWorkflowTarget: string;
    subWorkflowInputMapping: string;
    subWorkflowOutputMapping: string;
  };
  settings: {
    pageTitle: string;
    pageSubtitle: string;
    tabGeneral: string;
    tabExecution: string;
    tabMemory: string;
    tabProviders: string;
    tabLogs: string;
    // General Tab & Backup
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
    autoSaveDebounce: string;
    autoSaveDebounceDesc: string;
    backupSection: string;
    backupSectionDesc: string;
    exportSettingsBtn: string;
    importSettingsBtn: string;
    exportModalTitle: string;
    exportModalSanitized: string;
    exportModalSanitizedDesc: string;
    exportModalFull: string;
    exportModalFullDesc: string;
    exportModalWarning: string;
    importModalTitle: string;
    importModalDesc: string;
    importModalPastePlaceholder: string;
    importModalConfirmBtn: string;
    importModalSuccess: string;
    importModalError: string;
    // Execution & Safety Tab
    executionTitle: string;
    executionDesc: string;
    toolTimeoutTitle: string;
    toolTimeoutDesc: string;
    toolTimeoutEnable: string;
    toolTimeoutSecondsLabel: string;
    sandboxTimeoutTitle: string;
    sandboxTimeoutDesc: string;
    sandboxTimeoutSecondsLabel: string;
    agentSafeguardsTitle: string;
    agentSafeguardsDesc: string;
    agentLoopEnable: string;
    agentLoopThresholdLabel: string;
    agentDefaultIterationsLabel: string;
    // Network Resiliency in Providers Tab
    networkSection: string;
    networkSectionDesc: string;
    networkMaxRetriesLabel: string;
    networkRetryDelayLabel: string;
    engineSection: string;
    engineSectionDesc: string;
    engineMock: string;
    engineMockDesc: string;
    engineBrowser: string;
    engineBrowserDesc: string;
    // Memory & Storage Tab
    memoryTitle: string;
    memoryDesc: string;
    memoryStrategyHybridActive: string;
    memoryStrategyWindowActive: string;
    memoryStrategyBudgetActive: string;
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
    // Storage QA & Explanations
    storageQaTitle: string;
    storageQaBrowserDesc: string;
    storageQaServerDesc: string;
    storageQaFolderTitle: string;
    storageQaFolderContent: string;
    // Conversation Memory Defaults
    memorySection: string;
    memorySectionDesc: string;
    memoryEnableLabel: string;
    memoryEnableDesc: string;
    memoryRoundsLabel: string;
    memoryRoundsDesc: string;
    memoryBudgetLabel: string;
    memoryBudgetDesc: string;
    memoryStrategyLabel: string;
    memoryStrategyHybrid: string;
    memoryStrategyWindow: string;
    memoryStrategyBudget: string;
    memoryResetBtn: string;
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
    // Danger Zone
    dangerZoneTitle: string;
    dangerZoneDesc: string;
    clearCacheTitle: string;
    clearCacheDesc: string;
    clearCacheBtn: string;
    clearCacheConfirmPhrase: string;
    clearCacheSuccess: string;
    clearWorkflowsTitle: string;
    clearWorkflowsDesc: string;
    clearWorkflowsBtn: string;
    clearWorkflowsConfirmPhrase: string;
    clearWorkflowsSuccess: string;
    dangerModalTitle: string;
    dangerModalWarning: string;
    dangerModalPrompt: string;
    dangerModalInputPlaceholder: string;
    dangerModalConfirmBtn: string;
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
    projectSettings: string;
    folderSettings: string;
    newWorkflowInFolder: string;
    workflowParameters: string;
    workflowParametersDesc: string;
    paramKey: string;
    paramValue: string;
    addParam: string;
    noParamsConfigured: string;
    workflowFolder: string;
    workflowMemorySettings: string;
    workflowMemoryDesc: string;
    globalDefaultHint: string;
    saveSettings: string;
    lockWorkflow: string;
    unlockWorkflow: string;
    lockedBadge: string;
    workflowLockedToast: string;
    workflowUnlockedToast: string;
  };
  knowledge: {
    tabTitle: string;
    workflowsTab: string;
    knowledgeTab: string;
    newKnowledgeBase: string;
    knowledgeBasesCount: string;
    searchPlaceholder: string;
    noKnowledgeBases: string;
    createFirstKb: string;
    kbNameLabel: string;
    kbNamePlaceholder: string;
    kbDescLabel: string;
    kbDescPlaceholder: string;
    embeddingModel: string;
    documentsCount: string;
    chunksCount: string;
    manageDocuments: string;
    uploadDocument: string;
    dropzoneTitle: string;
    dropzoneSubtitle: string;
    chunkSize: string;
    chunkOverlap: string;
    previewChunks: string;
    uploading: string;
    chunkPosition: string;
    tokensCount: string;
    hitCount: string;
    chunkActive: string;
    chunkDisabled: string;
    noDocuments: string;
    noChunks: string;
    deleteKbConfirm: string;
    deleteDocConfirm: string;
    openInCanvas: string;
    manageKb: string;
  };
  chatDebug: {
    title: string;
    subtitle: string;
    emptyTitle: string;
    emptyDesc: string;
    userRole: string;
    assistantRole: string;
    executionTrace: string;
    streamingResponse: string;
    thinking: string;
    inputPlaceholder: string;
    clearHistory: string;
    exportHistory: string;
    closePanel: string;
    send: string;
    exportJson: string;
    exportMarkdown: string;
    nodesUnit: string;
    emptyResponse: string;
    parametersTitle: string;
    parametersHint: string;
    resetParams: string;
    copyContent: string;
    copied: string;
    viewJson: string;
    viewRaw: string;
  };
  publishApi: {
    title: string;
    subtitle: string;
    statusActive: string;
    statusDisabled: string;
    statusHint: string;
    enableBtn: string;
    disableBtn: string;
    endpointUrl: string;
    copyUrl: string;
    apiKey: string;
    copyKey: string;
    regenerateKey: string;
    copyCode: string;
    noKey: string;
  };
  ergonomics: {
    undo: string;
    redo: string;
    copySelected: string;
    pasteNodes: string;
    retryNode: string;
    retryAllFailed: string;
    retryNodeHint: string;
    failedNodesCount: string;
    locateNode: string;
    copyMarkdown: string;
    copyPlainText: string;
    copyRawJson: string;
    copySuccess: string;
    nodeRenderError: string;
    resetNodeData: string;
    dagTooltip: string;
    topologicalTooltip: string;
    vectorRAGTooltip: string;
    tokenBudgetTooltip: string;
    temperatureTooltip: string;
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
      cycleAlertMsg:
        'A closed dependency loop was detected. Unable to determine execution order. Please remove feedback edges and retry.',
      cycleNodesLabel: 'Involved cyclic nodes:',
      unknownEngineError: 'Execution Engine encountered an error',
      unconfiguredModalTitle: 'LLM Model API Key Not Configured',
      unconfiguredModalDesc:
        'The current workflow contains LLM inference nodes, but the active provider has no verified API Key configured. You can bind your API Key now, or run a flow validation that skips model calls and verifies data routing.',
      bindApiKeyBtn: 'Configure API Key',
      validateFlowOnlyBtn: 'Validate Flow Only (Skip LLM)',
      unconfiguredBadge: 'No API Key Set',
      publishApi: 'Publish API',
      chatDebug: 'Chat',
      lockedWorkflowBadge: 'Locked (Read-Only)',
    },
    nodeTypes: {
      input: 'Input Node',
      prompt: 'Prompt Template',
      llm: 'LLM Call',
      code: 'Code Node',
      output: 'Output Node',
      knowledge: 'Knowledge Retrieval',
      condition: 'Conditional Branch',
      aggregator: 'Variable Aggregator',
      http: 'HTTP Request',
      agent: 'AI Agent',
      loop: 'Loop Iterator',
      sub_workflow: 'Sub-Workflow',
      inputDesc: 'Defines initial workflow input parameters and default values as the data source.',
      promptDesc: 'Composes structured prompt templates, dynamically resolving {{nodeId.outputKey}} variables.',
      llmDesc: 'Calls cloud or local LLMs to generate streaming responses from composed prompts.',
      codeDesc: 'Runs lightweight JavaScript in an isolated sandbox for data transformation and cleaning.',
      outputDesc: 'Formats and displays final deliverables with Markdown preview and one-click export.',
      knowledgeDesc: 'Semantically searches vector knowledge bases for top-K text chunks to ground LLM reasoning (RAG).',
      conditionDesc: 'Evaluates input rules to dynamically route execution and prune inactive downstream branches.',
      aggregatorDesc: 'Synchronizes multiple incoming branches and merges their outputs into a single consolidated payload.',
      httpDesc: 'Sends external HTTP REST requests with custom headers, query params, and JSON payloads.',
      agentDesc: 'Runs an autonomous ReAct loop where the model plans, calls tools, and synthesizes results. Includes built-in loop deadlock breakers and execution watchdogs.',
      loopDesc: 'Iterates through array items to execute batch sub-topologies, bounded by maximum iteration safety caps.',
      sub_workflowDesc: 'Encapsulates an entire workflow as a nested node with isolated variable scope for modular orchestration.',
    },
    propertyPanel: {
      title: 'Node Properties',
      noNodeSelected: 'No Node Selected',
      noNodeSelectedDesc:
        'Click any node on the canvas to inspect its configuration and view live execution outputs.',
      collapsePanel: 'Collapse Property Panel',
      expandPanel: 'Open Property Panel',
      closePanel: 'Close Drawer',
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
      // Condition Node
      conditionRulesTitle: 'Condition Routing Rules',
      addRule: 'Add Rule',
      deleteRule: 'Delete rule',
      ruleIndex: 'RULE',
      variableLabel: 'Variable:',
      variablePlaceholder: '{{llm_1.response}} or category',
      operatorLabel: 'Operator:',
      operatorEquals: 'equals (==)',
      operatorNotEquals: 'not equals (!=)',
      operatorContains: 'contains',
      operatorNotContains: 'not contains',
      operatorGreaterThan: 'greater than (>)',
      operatorLessThan: 'less than (<)',
      operatorIsEmpty: 'is empty',
      operatorIsNotEmpty: 'is not empty',
      operatorRegexMatch: 'regex match',
      compareValueLabel: 'Compare Value:',
      compareValuePlaceholder: 'value or text',
      targetHandleLabel: 'Active Branch Handle:',
      fallbackBranchTitle: 'Fallback / Else Branch:',
      fallbackBranchPlaceholder: 'else',
      fallbackBranchHint: 'Activated if none of the above conditions evaluate to true.',
      // Aggregator Node
      aggregatorModeTitle: 'Variable Reconvergence Mode',
      aggFirstAvailableLabel: 'First Available',
      aggFirstAvailableDesc:
        'Takes the output of whichever upstream branch actually executed and was not skipped.',
      aggMergeAllLabel: 'Merge All Active',
      aggMergeAllDesc:
        'Combines all executed upstream branch outputs into an object keyed by source node ID.',
      aggWaitAllLabel: 'Wait All (Preserve Skipped)',
      aggWaitAllDesc: 'Waits for all connected branches, setting skipped branch results to null.',
      aggOutputKeyLabel: 'Output Variable Key:',
      aggOutputKeyHint: 'Downstream nodes can reference this via',
      // HTTP Request Node
      httpConfigTitle: 'REST API Request Configuration',
      httpUrlPlaceholder: 'https://api.example.com/v1/data',
      httpUrlHint: 'Supports template interpolation like {{input_1.city}} in URL or params.',
      httpTabParams: 'params',
      httpTabHeaders: 'headers',
      httpTabBody: 'body',
      httpTabAuth: 'auth',
      httpTabSettings: 'settings',
      httpQueryParamsTitle: 'Query Parameters',
      httpAddParam: 'Add Param',
      httpNoQueryParams: 'No query parameters configured.',
      httpHeadersTitle: 'HTTP Headers',
      httpAddHeader: 'Add Header',
      httpDefaultHeadersHint: 'Using default Content-Type: application/json.',
      httpBodyFormat: 'Body Format',
      httpAuthType: 'Authentication Type',
      httpAuthNone: 'None',
      httpAuthBearer: 'Bearer Token',
      httpAuthBasic: 'Basic Auth (Username / Password)',
      httpAuthApiKey: 'API Key',
      httpBearerTokenLabel: 'Bearer Token',
      httpUsernameLabel: 'Username',
      httpPasswordLabel: 'Password',
      httpKeyNamePlaceholder: 'Header/Query Name (e.g. X-API-Key)',
      httpKeyValuePlaceholder: 'API Key Value',
      httpSendInHeader: 'Send in Header',
      httpSendInQuery: 'Send in Query Param',
      httpTimeoutLabel: 'Timeout (ms)',
      httpMaxRetriesLabel: 'Max Retries',
      // Agent Node
      agentSystemPrompt: 'System Prompt',
      agentTools: 'Registered Tools',
      agentAddTool: 'Add Tool',
      agentToolName: 'Tool Name',
      agentToolDescription: 'Description',
      agentToolType: 'Tool Type',
      agentMaxIterations: 'Max Iterations',
      agentToolCode: 'Code Implementation',
      agentToolUrl: 'API URL',
      agentToolSchema: 'JSON Schema',
      agentTokenBudget: 'Token Budget Limit (0 = Unlimited)',
      agentLoopDetection: 'Deadlock Loop Detection',
      agentLoopThreshold: 'Trip Threshold',
      // Loop Node
      loopInputVariable: 'Input Array Variable',
      loopConcurrency: 'Concurrency',
      loopItemTimeout: 'Item Timeout (ms)',
      // Sub-Workflow Node
      subWorkflowTarget: 'Target Workflow',
      subWorkflowInputMapping: 'Input Mapping',
      subWorkflowOutputMapping: 'Output Mapping',
    },
    settings: {
      pageTitle: 'Settings & Configuration',
      pageSubtitle: 'Manage LLM Providers, UI Language, Runtime Protection, and Workflow Logs',
      tabGeneral: 'General & Backup',
      tabExecution: 'Execution & Safety',
      tabMemory: 'Memory',
      tabProviders: 'LLM Providers & Network',
      tabLogs: 'Execution Logs',
      // General Tab & Backup
      generalTitle: 'General Settings',
      generalDesc: 'Customize interface language, visual theme, and canvas auto-save preferences.',
      languageSection: 'Display Language',
      languageSectionDesc: 'Select your preferred language for the interface and default presets.',
      langEn: 'English (US)',
      langZh: '简体中文 (Simplified Chinese)',
      themeSection: 'Theme Mode',
      themeSectionDesc: 'Switch between light and dark visual aesthetics.',
      themeLight: 'Light Slate Theme',
      themeDark: 'Dark Cyberpunk Theme',
      autoSaveDebounce: 'Auto-Save Debounce Delay',
      autoSaveDebounceDesc: 'Time in milliseconds to wait after edits before auto-saving to storage.',
      backupSection: 'System Configuration Backup & Migration',
      backupSectionDesc: 'Export or import your full environment configuration, models, and execution settings.',
      exportSettingsBtn: 'Export Settings JSON',
      importSettingsBtn: 'Import Settings JSON',
      exportModalTitle: 'Export System Configuration',
      exportModalSanitized: 'Sanitized Export (Recommended)',
      exportModalSanitizedDesc: 'Exports all providers and runtime settings without API keys. Safe to share.',
      exportModalFull: 'Full Export (Sensitive)',
      exportModalFullDesc: 'Exports all settings including plaintext API keys for complete local migration.',
      exportModalWarning: 'Warning: Full export contains unencrypted API keys. Keep your exported file secure!',
      importModalTitle: 'Import System Configuration',
      importModalDesc: 'Paste your PatchCat settings JSON below or upload a configuration file.',
      importModalPastePlaceholder: 'Paste settings JSON here...',
      importModalConfirmBtn: 'Import and Apply Settings',
      importModalSuccess: 'Settings imported successfully! Preferences have been updated.',
      importModalError: 'Failed to import settings. Please verify the JSON schema.',
      // Execution & Safety Tab
      executionTitle: 'Execution Engine & Runtime Protection',
      executionDesc: 'Configure execution watchdogs, script sandbox timeouts, and AI Agent deadlock breakers.',
      toolTimeoutTitle: 'Step Tool Execution Watchdog',
      toolTimeoutDesc: 'Protects external HTTP and custom tool calls from hanging the workflow indefinitely.',
      toolTimeoutEnable: 'Enable Step Tool Execution Timeout',
      toolTimeoutSecondsLabel: 'Timeout Threshold (Seconds)',
      sandboxTimeoutTitle: 'JavaScript Code Sandbox Guard',
      sandboxTimeoutDesc: 'Maximum execution time for Web Worker script sandboxes before termination.',
      sandboxTimeoutSecondsLabel: 'Sandbox Timeout (Seconds)',
      agentSafeguardsTitle: 'Agent Cognitive Deadlock & Circuit Breakers',
      agentSafeguardsDesc: 'Detects and breaks repetitive identical tool-calling loops to protect token budgets.',
      agentLoopEnable: 'Enable Deadlock Loop Detection',
      agentLoopThresholdLabel: 'Consecutive Identical Calls to Trip',
      agentDefaultIterationsLabel: 'Default Max Iterations',
      // Network Resiliency in Providers Tab
      networkSection: 'Network Resiliency & Retry Policy',
      networkSectionDesc: 'Configure automatic retries and backoff delays for transient provider network errors.',
      networkMaxRetriesLabel: 'Max Automatic Retries',
      networkRetryDelayLabel: 'Retry Backoff Delay (Seconds)',
      engineSection: 'Execution Mode',
      engineSectionDesc: 'Choose how workflows are executed.',
      engineMock: 'Mock Execution Engine',
      engineMockDesc: 'Simulate workflow runs locally with mock responses for instant testing.',
      engineBrowser: 'Browser BYOK Mode (Recommended)',
      engineBrowserDesc:
        'Direct client-side connection using your own API keys with zero backend latency.',
      // Memory & Storage Tab
      memoryTitle: 'Conversation Memory & Storage Policy',
      memoryDesc:
        'Configure multi-turn conversation memory, sliding window rounds, token budget limits, and persistent storage architecture.',
      memoryStrategyHybridActive:
        '✨ Dual Constraints Active (Both sliding rounds and token budget are enforced).',
      memoryStrategyWindowActive:
        'Sliding Window Only (Prunes rounds exceeding the window threshold).',
      memoryStrategyBudgetActive:
        'Token Budget Only (Prunes older messages when token limit is reached).',
      // Storage Mode Section
      storageSection: 'Storage & Backend Mode',
      storageSectionDesc: 'Choose where workflows and project directories are saved.',
      storageLocal: 'Browser Local Storage (BYOK)',
      storageLocalDesc:
        'Store workflows completely in your browser localStorage. 100% private with zero backend setup.',
      storageServer: 'FastAPI Backend Server (PostgreSQL / SQLite)',
      storageServerDesc:
        'Persist workflows and project directories to your FastAPI backend server with database synchronization.',
      serverUrlLabel: 'Backend API URL',
      testServerBtn: 'Test Connection',
      testingServerBtn: 'Testing...',
      serverConnectedBadge: 'Connected',
      serverDisconnectedBadge: 'Disconnected',
      serverTestSuccess: 'Backend server is healthy and connected to database.',
      serverTestFailed: 'Unable to connect to backend server. Please check if FastAPI is running.',
      // Storage QA & Explanations
      storageQaTitle: 'Storage Architecture & FAQ',
      storageQaBrowserDesc:
        'Pure client-side mode defaults to browser IndexedDB (hundreds of MBs capacity, async non-blocking, survives tab closure).',
      storageQaServerDesc:
        'Self-hosted mode defaults to local zero-config SQLite (patchcat.db, ACID transactional, portable single-file backup).',
      storageQaFolderTitle: 'Can I store workflows & chats in a custom local folder?',
      storageQaFolderContent:
        'Direct local folder write is possible via File System API, but modern browser sandboxes enforce re-authorization on every page reload. For permanent, automated, and zero-prompt local persistence, self-hosted SQLite is strongly recommended.',
      // Conversation Memory Defaults
      memorySection: 'Conversation Memory Defaults (Tier 1 Global Policy)',
      memorySectionDesc:
        'Configure default conversation context window and token budget inherited by new workflows and LLM nodes.',
      memoryEnableLabel: 'Default Conversation Memory',
      memoryEnableDesc:
        'Automatically inject sliding window history into LLM nodes during interactive chat sessions.',
      memoryRoundsLabel: 'Context Window (Rounds)',
      memoryRoundsDesc:
        'Number of recent dialogue rounds to retain (1 round = 1 user message + 1 assistant message).',
      memoryBudgetLabel: 'Token Budget Limit',
      memoryBudgetDesc:
        'Accumulate tokens in reverse and prune older rounds when this threshold is reached.',
      memoryStrategyLabel: 'Pruning Strategy',
      memoryStrategyHybrid: 'Hybrid (Window Rounds + Token Budget)',
      memoryStrategyWindow: 'Sliding Window Only',
      memoryStrategyBudget: 'Token Budget Only',
      memoryResetBtn: 'Reset to Defaults',
      // Providers Tab
      providersTitle: 'LLM Providers & API Keys',
      providersSubtitle:
        'Configure model endpoints and API credentials (BYOK). Pure client-side direct connection.',
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
      privacyNotice:
        'All API keys are securely stored only in your browser LocalStorage and sent directly to LLM providers.',
      // Logs Tab
      logsTitle: 'Workflow Execution Logs',
      logsSubtitle: 'Real-time telemetry, request payloads, token counts, and error tracking.',
      logLevel: 'Log Level:',
      levelSummary: 'Summary',
      levelSummaryDesc: 'System start/stop, DAG scheduling, HTTP status, latency, and errors.',
      levelDetailed: 'Detailed',
      levelDetailedDesc:
        'Includes Summary + Node IDs, model parameters, and dependency resolution.',
      levelDev: 'Development',
      levelDevDesc:
        'Includes Detailed + Full Prompt inputs and output responses (strictly sanitized).',
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
      // Danger Zone
      dangerZoneTitle: 'Danger Zone',
      dangerZoneDesc:
        'Irreversible and destructive actions. Please proceed with extreme caution.',
      clearCacheTitle: 'Clear All Local Cache',
      clearCacheDesc:
        'Wipe multi-turn conversation memory, telemetry execution logs, and provider connection test caches. Workflows will not be affected.',
      clearCacheBtn: 'Clear All Cache...',
      clearCacheConfirmPhrase: 'CLEAR CACHE',
      clearCacheSuccess: 'All local caches have been wiped successfully.',
      clearWorkflowsTitle: 'Clear All Workflows',
      clearWorkflowsDesc:
        'Permanently delete all custom workflows and folders, resetting the canvas to a clean slate. This action cannot be undone.',
      clearWorkflowsBtn: 'Clear All Workflows...',
      clearWorkflowsConfirmPhrase: 'DELETE ALL WORKFLOWS',
      clearWorkflowsSuccess: 'All workflows have been cleared and reset.',
      dangerModalTitle: 'Are you absolutely sure?',
      dangerModalWarning: 'This action is destructive and cannot be undone.',
      dangerModalPrompt: 'Please type the following confirmation phrase to proceed:',
      dangerModalInputPlaceholder: 'Type confirmation phrase here...',
      dangerModalConfirmBtn: 'I understand the consequences, execute',
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
      presetsFolder: 'Preset Templates',
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
      projectSettings: 'Project Settings',
      folderSettings: 'Folder Settings',
      newWorkflowInFolder: 'New Workflow in Folder',
      workflowParameters: 'Global Runtime Parameters',
      workflowParametersDesc:
        'Default parameter values automatically supplied to Input nodes during workflow execution.',
      paramKey: 'Parameter Name',
      paramValue: 'Default Value',
      addParam: 'Add Parameter',
      noParamsConfigured:
        'No default parameters configured yet. Click "Add Parameter" to define runtime inputs.',
      workflowFolder: 'Belongs to Folder',
      workflowMemorySettings: 'Project Memory Constraints',
      workflowMemoryDesc:
        'Custom conversation history rounds and token budget for this workflow (overrides global preferences).',
      globalDefaultHint: 'Global default: ',
      saveSettings: 'Save Settings',
      lockWorkflow: 'Lock Workflow',
      unlockWorkflow: 'Unlock Workflow',
      lockedBadge: 'Locked (Changes not saved)',
      workflowLockedToast: 'Workflow locked. Changes will not be saved.',
      workflowUnlockedToast: 'Workflow unlocked. Changes will be saved automatically.',
    },
    knowledge: {
      tabTitle: 'Knowledge Bases',
      workflowsTab: 'Workflows',
      knowledgeTab: 'Knowledge',
      newKnowledgeBase: 'New Knowledge Base',
      knowledgeBasesCount: 'knowledge bases',
      searchPlaceholder: 'Search knowledge bases...',
      noKnowledgeBases: 'No knowledge bases found.',
      createFirstKb: 'Create your first knowledge base collection',
      kbNameLabel: 'Knowledge Base Name',
      kbNamePlaceholder: 'e.g. Product Knowledge Base',
      kbDescLabel: 'Description',
      kbDescPlaceholder: 'Describe the contents and retrieval purpose...',
      embeddingModel: 'Embedding Model',
      documentsCount: 'documents',
      chunksCount: 'chunks',
      manageDocuments: 'Manage Documents',
      uploadDocument: 'Upload Document',
      dropzoneTitle: 'Drag & drop .txt, .md, or .pdf files here',
      dropzoneSubtitle: 'Supports UTF-8 plain text, Markdown, and parsed PDF documents (Max 10MB)',
      chunkSize: 'Chunk Size (chars)',
      chunkOverlap: 'Chunk Overlap (chars)',
      previewChunks: 'Preview Chunks',
      uploading: 'Uploading & Indexing...',
      chunkPosition: 'Chunk',
      tokensCount: 'tokens',
      hitCount: 'hits',
      chunkActive: 'Active (Retrieval Enabled)',
      chunkDisabled: 'Disabled (Excluded from Retrieval)',
      noDocuments: 'No documents in this knowledge base yet. Upload one above!',
      noChunks: 'No chunks available.',
      deleteKbConfirm: 'Are you sure you want to delete this knowledge base and all its chunks?',
      deleteDocConfirm: 'Are you sure you want to delete this document and all its chunks?',
      openInCanvas: 'Use in Canvas',
      manageKb: 'Manage Knowledge Bases',
    },
    chatDebug: {
      title: 'Chat Debug Panel (Ctrl+Shift+D)',
      subtitle: 'Run graph & inspect streaming trace',
      emptyTitle: 'Start Conversation Debugging',
      emptyDesc:
        'Type a prompt below to run your workflow graph and inspect streaming LLM output with per-node execution trace.',
      userRole: 'You',
      assistantRole: 'Assistant',
      executionTrace: 'Execution Trace',
      streamingResponse: 'Streaming response...',
      thinking: 'Thinking...',
      inputPlaceholder: 'Type a message to run workflow...',
      clearHistory: 'Clear history',
      exportHistory: 'Export history',
      closePanel: 'Close Panel',
      send: 'Send',
      exportJson: 'Export JSON',
      exportMarkdown: 'Export Markdown',
      nodesUnit: 'nodes',
      emptyResponse: 'Completed with no textual output.',
      parametersTitle: 'Input Parameters',
      parametersHint: 'Tune input parameters to test dynamic branches',
      resetParams: 'Reset',
      copyContent: 'Copy',
      copied: 'Copied!',
      viewJson: 'JSON',
      viewRaw: 'Raw',
    },
    publishApi: {
      title: 'Publish Workflow as REST API',
      subtitle: 'Expose workflow as an automated HTTP endpoint',
      statusActive: 'API Access Status: Active (Ready)',
      statusDisabled: 'API Access Status: Disabled',
      statusHint: 'When enabled, external applications can trigger this DAG using POST requests.',
      enableBtn: 'Enable API',
      disableBtn: 'Disable API',
      endpointUrl: 'Endpoint URL',
      copyUrl: 'Copy URL',
      apiKey: 'Workflow API Key',
      copyKey: 'Copy Key',
      regenerateKey: 'Regenerate API Key',
      copyCode: 'Copy Code',
      noKey: 'No API key generated',
    },
    ergonomics: {
      undo: 'Undo (Ctrl+Z)',
      redo: 'Redo (Ctrl+Y)',
      copySelected: 'Copy Selected (Ctrl+C)',
      pasteNodes: 'Paste Nodes (Ctrl+V)',
      retryNode: 'Retry Node',
      retryAllFailed: 'Retry All Failed Nodes',
      retryNodeHint: 'Re-runs this node using cached upstream outputs without restarting the full workflow.',
      failedNodesCount: '{count} Nodes Failed',
      locateNode: 'Locate Node',
      copyMarkdown: 'Copy Markdown',
      copyPlainText: 'Copy Plain Text',
      copyRawJson: 'Copy Raw JSON',
      copySuccess: 'Copied to clipboard!',
      nodeRenderError: 'Node Rendering Error',
      resetNodeData: 'Reset Node Data',
      dagTooltip: 'Directed Acyclic Graph: Unidirectional workflow execution structure where nodes are sequenced strictly by dependencies to prevent deadlock loops.',
      topologicalTooltip: 'Topological Scheduling: Automatically determines dependencies and waves for optimal parallel node execution.',
      vectorRAGTooltip: 'Semantic Vector Retrieval: Dense vector distance matching to retrieve relevant knowledge chunks beyond literal keyword search.',
      tokenBudgetTooltip: 'Token Budget Limiter: Hard limit on total tokens consumed in a single execution to prevent unexpected costs.',
      temperatureTooltip: 'Sampling Temperature: Controls output variance. Lower values yield deterministic, focused responses; higher values encourage creativity.',
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
      unconfiguredModalDesc:
        '当前工作流包含 LLM 推理节点，但所选的大模型服务商尚未配置或绑定有效 API Key。您可以前往设置页面绑定 Key，或仅执行工作流流程校验（自动跳过模型调用，校验数据流转）。',
      bindApiKeyBtn: '去配置绑定 API Key',
      validateFlowOnlyBtn: '仅进行流程校验 (跳过模型)',
      unconfiguredBadge: '未配置 API Key',
      publishApi: '发布 API',
      chatDebug: '对话调试',
      lockedWorkflowBadge: '已锁定 (修改不保存)',
    },
    nodeTypes: {
      input: '输入节点',
      prompt: '提示词模板',
      llm: '大模型推理',
      code: '代码转换',
      output: '输出节点',
      knowledge: '知识库检索',
      condition: '条件分支',
      aggregator: '变量聚合器',
      http: 'HTTP 请求',
      agent: 'AI 智能体',
      loop: '循环迭代器',
      sub_workflow: '子工作流',
      inputDesc: '定义工作流的初始输入参数与默认值，作为整条流水线的数据源头。',
      promptDesc: '编写结构化提示词模板，支持通过 {{nodeId.outputKey}} 动态注入上游数据。',
      llmDesc: '接入主流大语言模型，将提示词发送至云端或本地端点并流式生成回答。',
      codeDesc: '在隔离沙箱中运行轻量 JavaScript 脚本，用于复杂数据清洗、格式转换与逻辑计算。',
      outputDesc: '汇聚并格式化展示最终运行产物，支持 Markdown 实时渲染与一键导出。',
      knowledgeDesc: '基于语义相似度在向量知识库中检索高相关度文本切片（RAG），为后续模型推理提供背景依据。',
      conditionDesc: '基于规则表达式判断输入数据，动态分流下游执行路径并自动对无效分支进行跳过剪枝。',
      aggregatorDesc: '汇聚并等待多个并行或条件分支的输出数据，按优先级合并为单一标准输出。',
      httpDesc: '发起标准 HTTP REST API 请求，支持自定义 Headers、Query 参数与 JSON 报文以打通外部系统。',
      agentDesc: '运行 ReAct 目标规划自主循环，模型根据任务自主决定思考并动态调用工具，直至输出最终成果。内置循环死锁监测与单步超时看门狗。',
      loopDesc: '对输入数组或批处理列表逐项执行子拓扑处理并聚合结果，内置最大迭代次数保护以防无限循环。',
      sub_workflowDesc: '将另一个完整工作流封装为当前画布的黑盒节点，具备独立作用域隔离，实现大型复杂工程的模块化解耦。',
    },
    propertyPanel: {
      title: '节点属性配置',
      noNodeSelected: '未选择节点',
      noNodeSelectedDesc: '在左侧画布中点击任意节点以检查其属性配置并查看实时运行输出。',
      collapsePanel: '折叠属性面板',
      expandPanel: '展开属性面板',
      closePanel: '关闭抽屉',
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
      knowledgeAttributionHint:
        '输出 {{result}} (标准 Markdown 上下文) 与 {{chunks}} (结构化切片数组)。',
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
      // Condition Node
      conditionRulesTitle: '条件分支路由规则',
      addRule: '添加规则',
      deleteRule: '删除规则',
      ruleIndex: '规则',
      variableLabel: '比较变量:',
      variablePlaceholder: '{{llm_1.response}} 或参数名',
      operatorLabel: '判断条件:',
      operatorEquals: '等于 (==)',
      operatorNotEquals: '不等于 (!=)',
      operatorContains: '包含 (contains)',
      operatorNotContains: '不包含 (not contains)',
      operatorGreaterThan: '大于 (>)',
      operatorLessThan: '小于 (<)',
      operatorIsEmpty: '为空 (is empty)',
      operatorIsNotEmpty: '非空 (is not empty)',
      operatorRegexMatch: '正则匹配 (regex match)',
      compareValueLabel: '目标比对值:',
      compareValuePlaceholder: '对比数值或字符串',
      targetHandleLabel: '命中输出端口名:',
      fallbackBranchTitle: '默认兜底分支 (Else):',
      fallbackBranchPlaceholder: 'else',
      fallbackBranchHint: '当上方所有条件均未命中时将走此分支。',
      // Aggregator Node
      aggregatorModeTitle: '多路分支汇聚重敛模式',
      aggFirstAvailableLabel: '首个有效分支 (First Available)',
      aggFirstAvailableDesc: '提取任意最先执行完毕且未被跳过的前序有效分支产出。',
      aggMergeAllLabel: '合并所有有效输出 (Merge All Active)',
      aggMergeAllDesc: '将所有实际执行的前序分支结果汇总为按来源节点 ID 映射的键值对象。',
      aggWaitAllLabel: '等待所有分支 (Wait All)',
      aggWaitAllDesc: '等待所有连接的分支结束，被跳过分支的结果置为 null。',
      aggOutputKeyLabel: '输出变量名 (Key):',
      aggOutputKeyHint: '下游节点可通过此路径引用',
      // HTTP Request Node
      httpConfigTitle: 'REST API 请求配置',
      httpUrlPlaceholder: 'https://api.example.com/v1/data',
      httpUrlHint: '支持在 URL 或参数中使用 {{input_1.city}} 格式的动态模板变量。',
      httpTabParams: 'Query 参数',
      httpTabHeaders: '请求头',
      httpTabBody: '请求体',
      httpTabAuth: '鉴权认证',
      httpTabSettings: '高级设置',
      httpQueryParamsTitle: 'Query 检索参数',
      httpAddParam: '添加参数',
      httpNoQueryParams: '暂无 Query 参数配置。',
      httpHeadersTitle: 'HTTP 请求头',
      httpAddHeader: '添加请求头',
      httpDefaultHeadersHint: '默认使用 Content-Type: application/json。',
      httpBodyFormat: '请求体格式',
      httpAuthType: '身份认证方式',
      httpAuthNone: '无认证 (None)',
      httpAuthBearer: 'Bearer Token',
      httpAuthBasic: 'Basic 基础认证 (账号 / 密码)',
      httpAuthApiKey: 'API Key',
      httpBearerTokenLabel: 'Bearer 令牌',
      httpUsernameLabel: '用户名',
      httpPasswordLabel: '密码',
      httpKeyNamePlaceholder: 'Header/Query 名称 (例如 X-API-Key)',
      httpKeyValuePlaceholder: 'API Key 密钥值',
      httpSendInHeader: '在 Header 请求头中携带',
      httpSendInQuery: '在 Query 参数中携带',
      httpTimeoutLabel: '超时时长 (ms)',
      httpMaxRetriesLabel: '重试次数',
      // Agent Node
      agentSystemPrompt: '系统提示词',
      agentTools: '已注册工具',
      agentAddTool: '添加工具',
      agentToolName: '工具名称',
      agentToolDescription: '工具描述',
      agentToolType: '工具类型',
      agentMaxIterations: '最大迭代轮数',
      agentToolCode: '代码实现',
      agentToolUrl: 'API 地址',
      agentToolSchema: 'JSON Schema',
      agentTokenBudget: 'Token 预算上限 (0 = 不限制)',
      agentLoopDetection: '死锁循环检测',
      agentLoopThreshold: '判定熔断阈值',
      // Loop Node
      loopInputVariable: '输入数组变量',
      loopConcurrency: '并发数',
      loopItemTimeout: '单项超时 (ms)',
      // Sub-Workflow Node
      subWorkflowTarget: '目标工作流',
      subWorkflowInputMapping: '输入映射',
      subWorkflowOutputMapping: '输出映射',
    },
    settings: {
      pageTitle: '系统设置与配置',
      pageSubtitle: '管理 LLM 模型服务商、界面多语言、运行防护与全链路日志',
      tabGeneral: '常规与备份',
      tabExecution: '运行与防护',
      tabMemory: '会话记忆',
      tabProviders: '模型与网络',
      tabLogs: '审计日志',
      // General Tab & Backup
      generalTitle: '常规与系统偏好',
      generalDesc: '自定义界面语言、显示主题与画布自动保存防抖延迟。',
      languageSection: '界面显示语言 (Language)',
      languageSectionDesc: '选择您希望使用的界面展示语言与默认示例。',
      langEn: 'English (US)',
      langZh: '简体中文 (Simplified Chinese)',
      themeSection: '外观主题',
      themeSectionDesc: '在清爽现代浅色风格与极客暗黑主题间切换。',
      themeLight: '现代极简浅色 (Light)',
      themeDark: '赛博极客暗黑 (Dark)',
      autoSaveDebounce: '画布自动保存防抖延迟',
      autoSaveDebounceDesc: '编辑停顿后自动暂存至存储的时间（毫秒），低配或弱网环境建议调高。',
      backupSection: '系统配置备份与跨机迁移',
      backupSectionDesc: '一键导出或导入当前系统的全套环境偏好、模型配置与运行保护参数。',
      exportSettingsBtn: '导出系统配置 JSON',
      importSettingsBtn: '导入系统配置 JSON',
      exportModalTitle: '导出系统配置备份',
      exportModalSanitized: '安全脱敏导出 (推荐)',
      exportModalSanitizedDesc: '导出所有模型服务商与运行时配置，自动剔除 API 密钥，适合公开分享或排错。',
      exportModalFull: '完整全量备份 (含密钥)',
      exportModalFullDesc: '包含所有明文 API 密钥与端点，用于个人跨设备无损迁移。',
      exportModalWarning: '警告：全量导出包含明文 API 密钥，请妥善保管导出的 JSON 文件，切勿上传公开网络！',
      importModalTitle: '导入系统配置备份',
      importModalDesc: '在下方粘贴 PatchCat 导出的配置 JSON 文本，或选择配置文件上传。',
      importModalPastePlaceholder: '在此粘贴配置 JSON 内容...',
      importModalConfirmBtn: '确认导入并应用配置',
      importModalSuccess: '配置导入成功！系统环境与服务商设置已刷新。',
      importModalError: '导入失败，请检查输入的 JSON 格式是否正确且符合 PatchCat 规范。',
      // Execution & Safety Tab
      executionTitle: '执行引擎与运行防护',
      executionDesc: '配置工具超时看门狗、JS 脚本隔离沙箱与智能体死循环熔断保护。',
      toolTimeoutTitle: '工具单步执行看门狗',
      toolTimeoutDesc: '防止外部 HTTP API 或长时间未响应的自定义工具将整张画布无限期挂起。',
      toolTimeoutEnable: '启用工具单步执行超时保护',
      toolTimeoutSecondsLabel: '超时时间阈值 (秒)',
      sandboxTimeoutTitle: 'JavaScript 代码沙箱防护',
      sandboxTimeoutDesc: 'Web Worker 隔离沙箱脚本的最大允许执行时间，防止用户死循环代码卡死进程。',
      sandboxTimeoutSecondsLabel: '沙箱看门狗超时 (秒)',
      agentSafeguardsTitle: 'Agent 认知死循环打破与熔断器',
      agentSafeguardsDesc: '实时检测并打破大模型连续重复调用相同工具的死锁循环，防止巨额 Token 浪费。',
      agentLoopEnable: '启用重复调用死锁打破器',
      agentLoopThresholdLabel: '连续重复调用熔断阈值',
      agentDefaultIterationsLabel: '默认最大迭代轮数',
      // Network Resiliency in Providers Tab
      networkSection: '网络连接韧性与重试策略',
      networkSectionDesc: '针对大模型服务商偶发 503 超载或网络抖动设置自动重试与退避间隔。',
      networkMaxRetriesLabel: '瞬时故障自动重试次数',
      networkRetryDelayLabel: '重试退避等待时长 (秒)',
      engineSection: '执行引擎模式',
      engineSectionDesc: '选择工作流的驱动与执行方式。',
      engineMock: 'Mock 离线模拟引擎',
      engineMockDesc: '无网络依赖，使用本地预设快速体验工作流调度过程。',
      engineBrowser: '纯前端 BYOK 直连模式 (推荐)',
      engineBrowserDesc: '使用您自己的 API 密钥从浏览器直接调用大模型，零后端中转，安全隐私。',
      // Memory & Storage Tab
      memoryTitle: '会话记忆与存储策略',
      memoryDesc:
        '配置多轮会话记忆偏好、滑动窗口轮数、Token 预算限制与底层存储架构。',
      memoryStrategyHybridActive:
        '✨ 已启用双重约束（同时受滑动窗口轮数与 Token 预算限制）。',
      memoryStrategyWindowActive:
        '仅滑动窗口轮数（超过 K 轮的早期对话将自动截断）。',
      memoryStrategyBudgetActive:
        '仅 Token 预算上限（倒序累加 Token 超过预算时将截断更早消息）。',
      // Storage Mode Section
      storageSection: '存储与后端服务模式',
      storageSectionDesc: '选择工作流和项目目录的保存位置与同步方式。',
      storageLocal: '浏览器本地存储 (BYOK 模式)',
      storageLocalDesc:
        '工作流完全保存在浏览器 LocalStorage 中，无需后端数据库，零配置且完全私密。',
      storageServer: 'FastAPI 后端服务 (PostgreSQL / SQLite)',
      storageServerDesc: '持久化存储至 FastAPI 后端数据库，支持多端数据同步与知识库向量检索。',
      serverUrlLabel: '后端服务地址 (API Base URL)',
      testServerBtn: '测试后端连接',
      testingServerBtn: '正在连接...',
      serverConnectedBadge: '后端已连接',
      serverDisconnectedBadge: '后端未连接',
      serverTestSuccess: '已成功连接至 FastAPI 后端服务并验证数据库连通正常。',
      serverTestFailed: '无法连接至后端服务，请检查 FastAPI 服务是否已在对应端口启动。',
      // Storage QA & Explanations
      storageQaTitle: '存储架构说明与 Q&A',
      storageQaBrowserDesc:
        '纯前端模式默认采用浏览器端侧 IndexedDB 数据库（数百兆大容量、异步事务零掉帧、页面关闭依然持久）。',
      storageQaServerDesc:
        '自部署模式默认采用本地零配置 SQLite 数据库（patchcat.db，ACID 事务，单文件便携随拷随走）。',
      storageQaFolderTitle: '能否直接指定本地某个自定义文件夹进行保存？',
      storageQaFolderContent:
        '纯前端可通过现代浏览器的 File System Access API 实现本地文件夹读写，但浏览器出于安全沙箱策略，每次刷新页面或重启浏览器均须重新弹窗手动授权。如需持久、自动化、免确认的本地体验，强烈推荐一键运行自部署 SQLite 模式。',
      // Conversation Memory Defaults
      memorySection: '全局会话记忆偏好 (第一级继承策略)',
      memorySectionDesc:
        '设置新建工作流与大模型节点默认继承的上下文轮数与 Token 预算上限（可随时在单个节点覆盖）。',
      memoryEnableLabel: '默认启用会话上下文记忆',
      memoryEnableDesc:
        '在调试会话中自动为 LLM 节点拼接历史滑动窗口记录，实现连续追问与多轮对话。',
      memoryRoundsLabel: '滑动窗口大小 (轮数)',
      memoryRoundsDesc:
        '发送给模型的最近问答对数量 (1轮 = 1次用户提问 + 1次助手回答)。',
      memoryBudgetLabel: 'Token 预算上限',
      memoryBudgetDesc:
        '从最新消息倒序累加 Token，一旦超出该预算将自动裁剪淘汰更早的历史轮次。',
      memoryStrategyLabel: '预算裁剪策略',
      memoryStrategyHybrid: '双重约束 (轮数窗口 + Token 预算)',
      memoryStrategyWindow: '仅滑动窗口轮数',
      memoryStrategyBudget: '仅 Token 预算上限',
      memoryResetBtn: '恢复默认配置',
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
      privacyNotice:
        '所有 API Key 仅保存在浏览器 LocalStorage，直连大模型服务商，绝不经由第三方服务器。',
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
      // Danger Zone
      dangerZoneTitle: '危险操作区域',
      dangerZoneDesc: '以下操作具有不可逆破坏性，请格外谨慎执行。',
      clearCacheTitle: '清除所有本地缓存',
      clearCacheDesc:
        '清空多轮会话记忆、运行遥测日志及模型服务商连接测试缓存。您的工作流与项目结构不会受到任何影响。',
      clearCacheBtn: '清除所有缓存...',
      clearCacheConfirmPhrase: '清空缓存',
      clearCacheSuccess: '所有本地会话与日志缓存已成功清空。',
      clearWorkflowsTitle: '清除所有流程',
      clearWorkflowsDesc:
        '永久清空所有自建目录与工作流流程并重置为空白画布。此操作不可逆，所有未导出的流程资产将被永久销毁。',
      clearWorkflowsBtn: '清除所有流程...',
      clearWorkflowsConfirmPhrase: '删除所有工作流',
      clearWorkflowsSuccess: '所有工作流已全部清空并重置为初始状态。',
      dangerModalTitle: '您确定要执行此危险操作吗？',
      dangerModalWarning: '此操作具有破坏性且无法撤销！',
      dangerModalPrompt: '请在下方输入指定的确认短语以继续：',
      dangerModalInputPlaceholder: '输入确认短语...',
      dangerModalConfirmBtn: '我已了解后果，确认执行',
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
      presetsFolder: '预设模版',
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
      projectSettings: '项目设置',
      folderSettings: '目录设置',
      newWorkflowInFolder: '在此目录下新建项目',
      workflowParameters: '全局运行时参数',
      workflowParametersDesc: '在测试与执行该工作流时，默认传递给 Input 节点的预置输入参数。',
      paramKey: '参数名称',
      paramValue: '默认参数值',
      addParam: '添加参数',
      noParamsConfigured: '暂无预设参数。点击“添加参数”为该项目预置输入参数。',
      workflowFolder: '所属目录',
      workflowMemorySettings: '项目记忆限制',
      workflowMemoryDesc: '为当前工作流独立配置会话保留轮数与 Token 预算上限（覆盖全局默认偏好）。',
      globalDefaultHint: '全局默认：',
      saveSettings: '保存设置',
      lockWorkflow: '锁定流程',
      unlockWorkflow: '解锁流程',
      lockedBadge: '已锁定 (修改不保存)',
      workflowLockedToast: '流程已锁定，画布修改将不予保存。',
      workflowUnlockedToast: '流程已解锁，画布修改将自动在本地保存。',
    },
    knowledge: {
      tabTitle: '私有知识库',
      workflowsTab: '编排流程',
      knowledgeTab: '知识库',
      newKnowledgeBase: '新建知识库',
      knowledgeBasesCount: '个知识库',
      searchPlaceholder: '搜索知识库...',
      noKnowledgeBases: '暂无知识库。',
      createFirstKb: '创建您的首个私有知识库集合',
      kbNameLabel: '知识库名称',
      kbNamePlaceholder: '例如：产品研发与架构白皮书',
      kbDescLabel: '功能描述',
      kbDescPlaceholder: '描述知识库内容与适用业务场景...',
      embeddingModel: '向量化模型 (Embedding)',
      documentsCount: '篇文档',
      chunksCount: '个切片',
      manageDocuments: '管理文档与切片',
      uploadDocument: '上传解析文档',
      dropzoneTitle: '点击或拖拽上传 .txt、.md、.pdf 文件',
      dropzoneSubtitle: '支持纯文本、Markdown 与 PDF 自动文本抽取与清洗切片 (最大 10MB)',
      chunkSize: '切片分块大小 (字符)',
      chunkOverlap: '分块重叠步长 (字符)',
      previewChunks: '即时切片预览',
      uploading: '正在清洗并向量化入库...',
      chunkPosition: '分块段落',
      tokensCount: 'Tokens',
      hitCount: '次命中',
      chunkActive: '已启用（参与向量检索）',
      chunkDisabled: '已停用（排除在检索之外）',
      noDocuments: '该知识库下暂无文档，请在上方上传入库！',
      noChunks: '暂无切片数据。',
      deleteKbConfirm: '确定要删除该知识库及其所有文档与切片吗？',
      deleteDocConfirm: '确定要删除该文档及其全部切片吗？',
      openInCanvas: '在画布中检索',
      manageKb: '管理知识库',
    },
    chatDebug: {
      title: '交互式多轮对话调试 (Ctrl+Shift+D)',
      subtitle: '运行工作流图谱并观察逐节点遥测',
      emptyTitle: '开启对话联调',
      emptyDesc:
        '在下方输入内容即可触发工作流运行，实时查看流式输出并检查每一步节点的执行轨迹与状态。',
      userRole: '用户',
      assistantRole: '助手',
      executionTrace: '节点执行轨迹',
      streamingResponse: '正在流式响应...',
      thinking: '思考中...',
      inputPlaceholder: '输入测试消息触发工作流...',
      clearHistory: '清空会话',
      exportHistory: '导出记录',
      closePanel: '关闭面板',
      send: '发送',
      exportJson: '导出 JSON',
      exportMarkdown: '导出 Markdown',
      nodesUnit: '个节点',
      emptyResponse: '执行完成，无文本内容输出。',
      parametersTitle: '运行参数',
      parametersHint: '配置输入参数以测试不同分支路由',
      resetParams: '重置',
      copyContent: '复制',
      copied: '已复制！',
      viewJson: '结构化 JSON',
      viewRaw: '原始文本',
    },
    publishApi: {
      title: '发布工作流为 REST API',
      subtitle: '将工作流作为自动化 HTTP 接口对外开放',
      statusActive: 'API 访问状态: 已激活 (就绪)',
      statusDisabled: 'API 访问状态: 未开启',
      statusHint: '启用后，外部第三方系统可通过 HTTP POST 请求触发此有向无环图 (DAG) 运行。',
      enableBtn: '启用 API',
      disableBtn: '关闭 API',
      endpointUrl: '接口调用地址 (Endpoint URL)',
      copyUrl: '复制地址',
      apiKey: '工作流专用 API 密钥',
      copyKey: '复制密钥',
      regenerateKey: '重新生成 API 密钥',
      copyCode: '复制代码',
      noKey: '暂未生成密钥',
    },
    ergonomics: {
      undo: '撤销操作 (Ctrl+Z)',
      redo: '重做操作 (Ctrl+Y)',
      copySelected: '复制选中节点 (Ctrl+C)',
      pasteNodes: '粘贴节点 (Ctrl+V)',
      retryNode: '就地重试该节点',
      retryAllFailed: '重试所有失败节点',
      retryNodeHint: '复用上游已缓存的入参就地重试此节点，无需从头重跑整条工作流。',
      failedNodesCount: '{count} 个节点执行失败',
      locateNode: '定位节点',
      copyMarkdown: '复制 Markdown',
      copyPlainText: '复制纯文本',
      copyRawJson: '复制原始 JSON',
      copySuccess: '已成功复制到剪贴板！',
      nodeRenderError: '节点组件渲染异常',
      resetNodeData: '重置节点数据',
      dagTooltip: '有向无环图 (DAG)：单向流动的拓扑执行网络。任务按前后依赖关系严格依次调度，杜绝闭环死锁与无限循环。',
      topologicalTooltip: '拓扑调度排序：根据连线自动计算依赖权重，将所有节点排布为最优并行波次依次执行的算法。',
      vectorRAGTooltip: '语义向量检索：基于高维语义相似度计算的检索技术。超越传统死板字面匹配，能够按意图查找意思相近的知识切片。',
      tokenBudgetTooltip: 'Token 限额保护：单次执行允许消耗的最大 Token 总量。超出设定值后立即触发安全硬熔断，防范费用失控。',
      temperatureTooltip: '模型采样温度：控制模型输出的发散度 (0.0~2.0)。数值越低输出越确定严谨，数值越高回答越丰富多样。',
    },
  },
};

