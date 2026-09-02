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

### 3.2 设置功能分区
```
SettingsPage
├── General (常规设置)
│   ├── 语言切换 (English / 简体中文)
│   ├── 主题外观 (Dark Mode / Light Mode)
│   └── 引擎模式 (Browser BYOK / Local Server)
├── LLM Providers (模型服务商 & API Key)
│   ├── Google Gemini (支持原生 endpoint 与模型动态探测)
│   ├── DeepSeek (支持 R1 思考过程与 V3)
│   ├── OpenAI (GPT-4o, GPT-4o-mini)
│   ├── SiliconFlow (硅基流动云端开源模型)
│   └── Local Ollama (本地无 Key 连接与自动检测)
└── Execution Logs (实时运行与遥测日志)
    ├── 级别过滤 (System / Request / Node / Error)
    ├── Payload 报文折叠查看与复制
    └── 导出 JSON / 导出 TXT
```
