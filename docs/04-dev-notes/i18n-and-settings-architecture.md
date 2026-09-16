# 国际化 (i18n) 体系与全屏设置页面架构设计

> **模块名称**: Multi-Language i18n & Full-Page Settings Center  
> **文档版本**: 1.0.0  
> **作者**: PatchCat 核心架构组  
> **最后更新**: 2026-09-02  

---

## 1. 架构目标与设计原则

PatchCat 面向全球开发者，界面语言与系统设置需要具备：
1. **零外部重型依赖**：不依赖重量级 i18n 库，采用轻量强类型的 TypeScript Dictionary + React Hook 方案。
2. **默认英文 (English First) + 完整简体中文 (Full 简体中文)**：默认启动语言为英文，各界面（画布、属性面板、抽屉、设置页、帮助文档）提供 100% 覆盖的双语翻译。
3. **沉浸式全屏设置中心**：将复杂的 LLM Provider API Key 绑定、多语言切换、主题引擎选择以及运行日志合并为专用的全屏设置页（Settings Page），降低主画布的视觉干扰。

---

## 2. i18n 框架实现规范

### 2.1 强类型字典结构 (`src/i18n/translations.ts`)
```typescript
export type Language = 'en' | 'zh';

export interface Translations {
  common: { backToCanvas: string; settings: string; logs: string; save: string; ... };
  header: { addNode: string; run: string; stop: string; preset: string; ... };
  settings: { title: string; tabGeneral: string; tabProviders: string; tabLogs: string; ... };
  providers: { addProvider: string; apiKey: string; baseUrl: string; testConnection: string; ... };
  logs: { title: string; exportJson: string; clearLogs: string; filterAll: string; ... };
  sidebar: { newWorkflow: string; projects: string; newFolder: string; ... };
  propertyPanel: { ... };
  nodeTypes: { ... };
  help: { ... };
  footer: { ... };
}
```

### 2.2 响应式 Hook 封装 (`src/i18n/useTranslation.ts`)
```typescript
export function useTranslation() {
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const t = translations[language] || translations.en;
  return { t, language, setLanguage };
}
```

### 2.3 预设模板的本地化分流 (`src/presets/`)
- `src/presets/en/`：英文预设（Customer Support Routing, Report Generator with Critic, Model Arena）。
- `src/presets/zh/`：中文预设（智能客服意图识别与工单路由、自反思研报生成、多大模型横向盲测）。
- `src/presets/index.ts`：通过 `PRESETS_DATA[language]` 动态加载当前语言对应的预设数据。

---

## 3. 全屏设置页面 (Settings Page) 架构

### 3.1 视图路由与状态切换
- 全局路由状态受控于 `useSettingsStore.currentView`（`'canvas'` | `'settings'`）。
- 顶部导航栏原“日志”按钮升级为统一的“设置”按钮；进入设置页后，顶部导航栏展示清晰的 `← Back to Canvas` (返回画布) 按钮。

### 3.2 设置功能分区 (v0.4.4 升级为 5 维层级导航)
```
SettingsPage
├── 1. General & Backup (常规与备份)
│   ├── 界面语言切换 (English / 简体中文)
│   ├── 主题外观 (Dark Slate / Light Mode)
│   ├── 引擎运行模式 (Browser BYOK / Local FastAPI Server)
│   ├── 画布自动保存防抖延迟 (Auto-save Debounce Slider, 100~3000ms)
│   ├── 配置备份与迁移 (Export / Import Backup JSON，支持按需脱敏 Key)
│   └── 危险区域 (Danger Zone: 清除缓存 / 恢复出厂设置，双语防误触二次验证)
├── 2. Execution & Safety (执行与安全)
│   ├── 单次执行 Token 硬熔断 (Token Budget Limiter, 0为不限, >0即熔断)
│   ├── 死锁打破器 (Looping Tool-Call Detector 开关与 2~10 阈值)
│   ├── 单步工具执行看门狗 (Step Watchdog Timeout 开关与 5~300s 阈值)
│   ├── 代码沙箱执行超时 (Code Sandbox Timeout, 1000~30000ms)
│   └── 节点失败重试策略 (Max Retries 0~5 & 指数退避开关)
├── 3. Providers & Network (模型与网络)
│   ├── 大模型服务商 (Google Gemini / DeepSeek / OpenAI / SiliconFlow / Local Ollama)
│   ├── 全局网络请求超时 (Global HTTP Timeout, 5~120s)
│   ├── 允许跨域直连 (CORS Direct Fetch 开关)
│   └── 自定义反向代理 (Custom Proxy Base URL)
├── 4. Conversation Memory (对话记忆)
│   ├── 上下文最大保留消息轮数 (Max Memory Messages, 1~50)
│   └── 超长上下文自动滑动截断/摘要压缩 (Auto Context Compaction)
└── 5. Execution Logs (实时运行与遥测日志)
    ├── 日志级别过滤 (Summary / Detailed / Development)
    ├── 类别过滤 (System / Request / Node / Error / Security)
    ├── Payload 结构化报文折叠查看与一键复制
    ├── 实时关键词搜索与节点高亮过滤
    └── 日志导出 (.json / .txt) 与一键清空
```

