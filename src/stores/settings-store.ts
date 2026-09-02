/**
 * @file    src/stores/settings-store.ts
 * @version 2.0.0
 * @description
 *   Zustand store for managing global LLM Provider configurations, API Keys,
 *   active language (i18n), and application view routing with LocalStorage sync.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Language } from '../i18n/translations.ts';

export type ProviderId = 'openai' | 'deepseek' | 'siliconflow' | 'google' | 'ollama' | 'custom';
export type AppView = 'canvas' | 'settings';
export type SettingsTab = 'general' | 'providers' | 'logs';

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  availableModels: string[];
  description: string;
}

export interface ConnectionTestResult {
  status: 'idle' | 'testing' | 'success' | 'error';
  latencyMs?: number;
  message?: string;
}

export const DEFAULT_PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    defaultModel: 'gpt-4o-mini',
    availableModels: ['gpt-4o-mini', 'gpt-4o', 'o3-mini', 'o1', 'gpt-3.5-turbo'],
    description: 'Official OpenAI API (GPT-4o, GPT-4o-mini, o3-mini)',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    apiKey: '',
    defaultModel: 'deepseek-chat',
    availableModels: ['deepseek-chat', 'deepseek-reasoner'],
    description: 'DeepSeek V3 & DeepSeek R1 Reasoning API',
  },
  siliconflow: {
    id: 'siliconflow',
    name: 'SiliconFlow (硅基流动)',
    baseUrl: 'https://api.siliconflow.cn/v1',
    apiKey: '',
    defaultModel: 'deepseek-ai/DeepSeek-V3',
    availableModels: [
      'deepseek-ai/DeepSeek-V3',
      'deepseek-ai/DeepSeek-R1',
      'Qwen/Qwen2.5-72B-Instruct',
      'THUDM/glm-4-9b-chat',
    ],
    description: 'High-speed cloud aggregator with free tier models',
  },
  google: {
    id: 'google',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey: '',
    defaultModel: 'gemini-2.5-flash',
    availableModels: [
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
    ],
    description: 'Google AI Studio Gemini Models (Multimodal, 1M+ Context & Fast)',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434/v1',
    apiKey: 'ollama',
    defaultModel: 'llama3:latest',
    availableModels: ['llama3:latest', 'qwen2.5:latest', 'deepseek-r1:latest', 'mistral:latest'],
    description: 'Local LLM server running on your machine (No API Key required)',
  },
  custom: {
    id: 'custom',
    name: 'Custom (OpenAI-Compatible)',
    baseUrl: 'https://api.example.com/v1',
    apiKey: '',
    defaultModel: 'custom-model',
    availableModels: [],
    description: 'Any OpenAI-compatible API endpoint (OneAPI, FastGPT, vLLM)',
  },
};

const STORAGE_KEY = 'patchcat-llm-settings-v1';
const LANG_STORAGE_KEY = 'patchcat-language-v1';
const STORAGE_MODE_KEY = 'patchcat-storage-mode-v1';
const SERVER_URL_KEY = 'patchcat-server-url-v1';

export interface SettingsStoreState {
  // Navigation
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  settingsTab: SettingsTab;
  setSettingsTab: (tab: SettingsTab) => void;

  // i18n Language
  language: Language;
  setLanguage: (lang: Language) => void;

  // Legacy modal flag for backward compatibility
  isSettingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  toggleSettingsModal: () => void;

  // LLM Providers
  activeProvider: ProviderId;
  providers: Record<ProviderId, ProviderConfig>;
  testResults: Record<ProviderId, ConnectionTestResult>;

  // Storage & Backend Mode
  storageMode: 'local' | 'server';
  serverBaseUrl: string;
  serverTestResult: ConnectionTestResult;
  setStorageMode: (mode: 'local' | 'server') => void;
  setServerBaseUrl: (url: string) => void;
  testServerConnection: () => Promise<ConnectionTestResult>;

  // Actions
  setActiveProvider: (id: ProviderId) => void;
  updateProviderConfig: (id: ProviderId, partial: Partial<ProviderConfig>) => void;
  resetProviderConfig: (id: ProviderId) => void;
  testConnection: (id: ProviderId) => Promise<ConnectionTestResult>;
  fetchAvailableModels: (id: ProviderId) => Promise<string[]>;
  getEffectiveConfig: (providerId?: ProviderId) => {
    provider: ProviderId;
    baseUrl: string;
    apiKey: string;
    model: string;
    hasKey: boolean;
  };
}

// Helper to load settings from LocalStorage
function loadInitialState(): {
  language: Language;
  activeProvider: ProviderId;
  providers: Record<ProviderId, ProviderConfig>;
  storageMode: 'local' | 'server';
  serverBaseUrl: string;
} {
  let language: Language = 'en';
  let activeProvider: ProviderId = 'deepseek';
  let providers: Record<ProviderId, ProviderConfig> = DEFAULT_PROVIDERS;
  let storageMode: 'local' | 'server' = 'local';
  let serverBaseUrl = 'http://localhost:8000';

  if (typeof window !== 'undefined') {
    try {
      const savedLang = localStorage.getItem(LANG_STORAGE_KEY);
      if (savedLang === 'en' || savedLang === 'zh') {
        language = savedLang;
      }
    } catch (e) {
      console.warn('[SettingsStore] Failed to load language from localStorage:', e);
    }

    try {
      const savedMode = localStorage.getItem(STORAGE_MODE_KEY);
      if (savedMode === 'local' || savedMode === 'server') {
        storageMode = savedMode;
      }
      const savedUrl = localStorage.getItem(SERVER_URL_KEY);
      if (savedUrl) {
        serverBaseUrl = savedUrl;
      }
    } catch (e) {
      console.warn('[SettingsStore] Failed to load storage settings:', e);
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        activeProvider = parsed.activeProvider || 'deepseek';
        providers = {
          ...DEFAULT_PROVIDERS,
          ...(parsed.providers || {}),
        };
      }
    } catch (e) {
      console.warn('[SettingsStore] Failed to load settings from localStorage:', e);
    }
  }

  return { language, activeProvider, providers, storageMode, serverBaseUrl };
}

function saveState(state: { activeProvider: ProviderId; providers: Record<ProviderId, ProviderConfig> }) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activeProvider: state.activeProvider,
        providers: state.providers,
      })
    );
  } catch (e) {
    console.error('[SettingsStore] Failed to save settings to localStorage:', e);
  }
}

export function parseFetchedModelList(data: unknown): string[] {
  if (!data || typeof data !== 'object') return [];

  let rawList: string[] = [];
  const obj = data as Record<string, unknown>;

  // Format 1: OpenAI, Google Gemini OpenAI compat, DeepSeek, SiliconFlow ({ data: [ { id: 'gemini-2.5-flash' } ] })
  if (Array.isArray(obj.data)) {
    rawList = obj.data
      .map((item) => (typeof item === 'object' && item !== null && 'id' in item ? String(item.id) : ''))
      .filter(Boolean);
  }
  // Format 2: Google Native or Ollama ({ models: [ { name: 'models/gemini-2.5-flash' } ] })
  else if (Array.isArray(obj.models)) {
    rawList = obj.models
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
          const m = item as Record<string, unknown>;
          return String(m.name || m.id || m.model || '');
        }
        return '';
      })
      .filter(Boolean);
  }

  // Normalize: strip 'models/' prefix from Google native response
  const normalized = rawList.map((m) => m.replace(/^models\//, '').trim()).filter(Boolean);

  // Filter out non-chat models (embeddings, tts, whisper, audio, moderation)
  const nonChatKeywords = ['embedding', 'whisper', 'tts', 'dall-e', 'moderation', 'bge-', 'rerank'];
  const chatModels = normalized.filter(
    (m) => !nonChatKeywords.some((k) => m.toLowerCase().includes(k))
  );

  const finalModels = chatModels.length > 0 ? chatModels : normalized;
  return Array.from(new Set(finalModels));
}

export const useSettingsStore = create<SettingsStoreState>()(
  immer((set, get) => {
    const initial = loadInitialState();

    return {
      currentView: 'canvas',
      setCurrentView: (view) => {
        set((state) => {
          state.currentView = view;
        });
      },

      settingsTab: 'general',
      setSettingsTab: (tab) => {
        set((state) => {
          state.settingsTab = tab;
        });
      },

      language: initial.language,
      setLanguage: (lang) => {
        set((state) => {
          state.language = lang;
        });
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(LANG_STORAGE_KEY, lang);
          } catch (e) {
            console.error('[SettingsStore] Failed to save language:', e);
          }
        }
      },

      isSettingsOpen: false,
      activeProvider: initial.activeProvider,
      providers: initial.providers,
      testResults: {
        openai: { status: 'idle' },
        deepseek: { status: 'idle' },
        siliconflow: { status: 'idle' },
        google: { status: 'idle' },
        ollama: { status: 'idle' },
        custom: { status: 'idle' },
      },

      // Storage & Backend Mode
      storageMode: initial.storageMode,
      serverBaseUrl: initial.serverBaseUrl,
      serverTestResult: { status: 'idle' },

      setStorageMode: (mode) => {
        set((state) => {
          state.storageMode = mode;
        });
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(STORAGE_MODE_KEY, mode);
          } catch (e) {
            console.error('[SettingsStore] Failed to save storageMode:', e);
          }
        }
      },

      setServerBaseUrl: (url) => {
        const clean = url.trim();
        set((state) => {
          state.serverBaseUrl = clean;
          state.serverTestResult = { status: 'idle' };
        });
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(SERVER_URL_KEY, clean);
          } catch (e) {
            console.error('[SettingsStore] Failed to save serverBaseUrl:', e);
          }
        }
      },

      testServerConnection: async () => {
        const url = get().serverBaseUrl.replace(/\/+$/, '');
        set((state) => {
          state.serverTestResult = { status: 'testing' };
        });

        const start = performance.now();
        try {
          const res = await fetch(`${url}/api/v1/health`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(5000),
          });

          const latencyMs = Math.round(performance.now() - start);

          if (!res.ok) {
            const result: ConnectionTestResult = {
              status: 'error',
              latencyMs,
              message: `HTTP ${res.status}: ${res.statusText}`,
            };
            set((state) => {
              state.serverTestResult = result;
            });
            return result;
          }

          const data = await res.json();
          const result: ConnectionTestResult = {
            status: 'success',
            latencyMs,
            message: `Connected (${data.app_name || 'FastAPI'} v${data.version || '0.1.0'}) - DB: ${
              data.database_connected ? 'Connected' : 'Degraded'
            }`,
          };
          set((state) => {
            state.serverTestResult = result;
          });
          return result;
        } catch (err: any) {
          const latencyMs = Math.round(performance.now() - start);
          const result: ConnectionTestResult = {
            status: 'error',
            latencyMs,
            message: err.name === 'TimeoutError' ? 'Connection timed out (5s)' : err.message || 'Connection failed',
          };
          set((state) => {
            state.serverTestResult = result;
          });
          return result;
        }
      },

      setSettingsOpen: (open) => {
        set((state) => {
          state.isSettingsOpen = open;
          state.currentView = open ? 'settings' : 'canvas';
        });
      },

      toggleSettingsModal: () => {
        set((state) => {
          state.isSettingsOpen = !state.isSettingsOpen;
          state.currentView = state.isSettingsOpen ? 'settings' : 'canvas';
        });
      },

      setActiveProvider: (id) => {
        set((state) => {
          state.activeProvider = id;
        });
        saveState({ activeProvider: id, providers: get().providers });
      },

      updateProviderConfig: (id, partial) => {
        set((state) => {
          state.providers[id] = { ...state.providers[id], ...partial };
          // Reset test status on edit
          state.testResults[id] = { status: 'idle' };
        });
        saveState({ activeProvider: get().activeProvider, providers: get().providers });
      },

      resetProviderConfig: (id) => {
        set((state) => {
          state.providers[id] = { ...DEFAULT_PROVIDERS[id] };
          state.testResults[id] = { status: 'idle' };
        });
        saveState({ activeProvider: get().activeProvider, providers: get().providers });
      },

      getEffectiveConfig: (providerId) => {
        const state = get();
        const targetId = providerId || state.activeProvider;
        const config = state.providers[targetId] || DEFAULT_PROVIDERS[targetId];
        const isOllama = targetId === 'ollama';
        const apiKey = config.apiKey.trim();
        const hasKey = isOllama ? true : apiKey.length > 0;

        return {
          provider: targetId,
          baseUrl: config.baseUrl.trim().replace(/\/+$/, ''),
          apiKey: apiKey || (isOllama ? 'ollama' : ''),
          model: config.defaultModel,
          hasKey,
        };
      },

      fetchAvailableModels: async (id) => {
        const config = get().providers[id];
        const isOllama = id === 'ollama';
        const cleanBaseUrl = config.baseUrl.trim().replace(/\/+$/, '');
        const apiKey = config.apiKey.trim();

        if (!isOllama && !apiKey) {
          return config.availableModels;
        }

        const modelsUrl = cleanBaseUrl.endsWith('/v1') || cleanBaseUrl.endsWith('/v1beta/openai')
          ? `${cleanBaseUrl}/models`
          : `${cleanBaseUrl}/v1/models`;

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (apiKey) {
          headers['Authorization'] = `Bearer ${apiKey}`;
          if (cleanBaseUrl.includes('googleapis.com')) {
            headers['x-goog-api-key'] = apiKey;
          }
        }

        try {
          const response = await fetch(modelsUrl, { method: 'GET', headers });
          if (response.ok) {
            const data = await response.json().catch(() => ({}));
            const fetched = parseFetchedModelList(data);
            if (fetched.length > 0) {
              set((state) => {
                state.providers[id].availableModels = fetched;
                if (!fetched.includes(state.providers[id].defaultModel) && fetched[0]) {
                  state.providers[id].defaultModel = fetched[0];
                }
              });
              saveState({ activeProvider: get().activeProvider, providers: get().providers });
              return fetched;
            }
          }
        } catch (err) {
          console.warn(`[SettingsStore] Failed to fetch models for ${id}:`, err);
        }

        return config.availableModels;
      },

      testConnection: async (id) => {
        const config = get().providers[id];
        const isOllama = id === 'ollama';
        const cleanBaseUrl = config.baseUrl.trim().replace(/\/+$/, '');
        const apiKey = config.apiKey.trim();

        if (!isOllama && !apiKey) {
          const result: ConnectionTestResult = {
            status: 'error',
            message: 'API Key cannot be empty / API Key 不能为空',
          };
          set((state) => {
            state.testResults[id] = result;
          });
          return result;
        }

        set((state) => {
          state.testResults[id] = { status: 'testing' };
        });

        const startTime = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        try {
          // Normalize endpoint: some providers require /v1/models or /models
          const modelsUrl = cleanBaseUrl.endsWith('/v1') || cleanBaseUrl.endsWith('/v1beta/openai')
            ? `${cleanBaseUrl}/models` 
            : `${cleanBaseUrl}/v1/models`;

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
            if (cleanBaseUrl.includes('googleapis.com')) {
              headers['x-goog-api-key'] = apiKey;
            }
          }

          const response = await fetch(modelsUrl, {
            method: 'GET',
            headers,
            signal: controller.signal,
          });

          clearTimeout(timeout);
          const latencyMs = Date.now() - startTime;

          if (response.ok) {
            const data = await response.json().catch(() => ({}));
            const fetched = parseFetchedModelList(data);

            if (fetched.length > 0) {
              set((state) => {
                state.providers[id].availableModels = fetched;
                if (!fetched.includes(state.providers[id].defaultModel) && fetched[0]) {
                  state.providers[id].defaultModel = fetched[0];
                }
              });
              saveState({ activeProvider: get().activeProvider, providers: get().providers });
            }

            const modelCount = fetched.length > 0 ? fetched.length : (Array.isArray(data?.data) ? data.data.length : null);
            const msg = modelCount !== null 
              ? `Connected successfully (${modelCount} models available)` 
              : 'Connected successfully (Endpoint reachable)';

            const result: ConnectionTestResult = {
              status: 'success',
              latencyMs,
              message: msg,
            };
            set((state) => {
              state.testResults[id] = result;
            });
            return result;
          } else {
            const errorBody = await response.text().catch(() => '');
            let errDetail = `HTTP ${response.status}`;
            try {
              const parsed = JSON.parse(errorBody);
              if (parsed?.error?.message) {
                errDetail = parsed.error.message;
              }
            } catch {
              if (errorBody.length > 0) {
                errDetail = errorBody.slice(0, 100);
              }
            }

            const result: ConnectionTestResult = {
              status: 'error',
              latencyMs,
              message: `Connection failed: ${errDetail}`,
            };
            set((state) => {
              state.testResults[id] = result;
            });
            return result;
          }
        } catch (err: unknown) {
          clearTimeout(timeout);
          const latencyMs = Date.now() - startTime;
          const isAbort = err instanceof Error && err.name === 'AbortError';
          const errMsg = isAbort 
            ? 'Connection timed out (>8s)' 
            : err instanceof Error ? err.message : String(err);

          const result: ConnectionTestResult = {
            status: 'error',
            latencyMs,
            message: `Network error: ${errMsg}`,
          };
          set((state) => {
            state.testResults[id] = result;
          });
          return result;
        }
      },
    };
  })
);
