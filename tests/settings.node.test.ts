/**
 * @file    tests/settings.node.test.ts
 * @description
 *   Unit test suite for LLM Provider Settings Store & Configuration:
 *   1. Default providers loading (OpenAI, DeepSeek, SiliconFlow, Ollama, Custom).
 *   2. Active provider selection and config updates.
 *   3. Effective configuration resolution and hasKey detection.
 *   4. Connection testing error handling.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useSettingsStore, DEFAULT_PROVIDERS, parseFetchedModelList } from '../src/stores/settings-store.ts';

describe('Settings Store & Provider Configuration', () => {
  beforeEach(() => {
    // Reset to defaults
    useSettingsStore.setState({
      isSettingsOpen: false,
      activeProvider: 'deepseek',
      providers: JSON.parse(JSON.stringify(DEFAULT_PROVIDERS)),
      testResults: {
        openai: { status: 'idle' },
        deepseek: { status: 'idle' },
        siliconflow: { status: 'idle' },
        google: { status: 'idle' },
        ollama: { status: 'idle' },
        custom: { status: 'idle' },
      },
    });
  });

  it('should initialize with default providers and deepseek as active', () => {
    const state = useSettingsStore.getState();
    assert.equal(state.activeProvider, 'deepseek');
    assert.ok(state.providers.openai);
    assert.ok(state.providers.deepseek);
    assert.ok(state.providers.siliconflow);
    assert.ok(state.providers.google);
    assert.ok(state.providers.ollama);
    assert.ok(state.providers.custom);
    assert.equal(state.providers.google.defaultModel, 'gemini-2.5-flash');
  });

  it('should switch active provider correctly', () => {
    const store = useSettingsStore.getState();
    store.setActiveProvider('openai');

    const updated = useSettingsStore.getState();
    assert.equal(updated.activeProvider, 'openai');
  });

  it('should update provider baseUrl, apiKey and defaultModel', () => {
    const store = useSettingsStore.getState();
    store.updateProviderConfig('deepseek', {
      apiKey: 'sk-test-deepseek-12345',
      defaultModel: 'deepseek-reasoner',
    });

    const updated = useSettingsStore.getState();
    assert.equal(updated.providers.deepseek.apiKey, 'sk-test-deepseek-12345');
    assert.equal(updated.providers.deepseek.defaultModel, 'deepseek-reasoner');
  });

  it('should resolve effective config and detect whether key is configured', () => {
    const store = useSettingsStore.getState();

    // DeepSeek with no key
    const initialConfig = store.getEffectiveConfig('deepseek');
    assert.equal(initialConfig.hasKey, false);
    assert.equal(initialConfig.provider, 'deepseek');

    // Add key
    store.updateProviderConfig('deepseek', { apiKey: 'sk-deepseek-abc' });
    const withKeyConfig = useSettingsStore.getState().getEffectiveConfig('deepseek');
    assert.equal(withKeyConfig.hasKey, true);
    assert.equal(withKeyConfig.apiKey, 'sk-deepseek-abc');

    // Ollama is local, hasKey should always be true
    const ollamaConfig = store.getEffectiveConfig('ollama');
    assert.equal(ollamaConfig.hasKey, true);
  });

  it('should toggle settings modal visibility', () => {
    const store = useSettingsStore.getState();
    assert.equal(store.isSettingsOpen, false);

    store.toggleSettingsModal();
    assert.equal(useSettingsStore.getState().isSettingsOpen, true);

    store.setSettingsOpen(false);
    assert.equal(useSettingsStore.getState().isSettingsOpen, false);
  });

  it('should return error when testing connection with empty apiKey for cloud providers', async () => {
    const store = useSettingsStore.getState();
    const result = await store.testConnection('openai');

    assert.equal(result.status, 'error');
    assert.match(result.message || '', /API Key/i);
  });

  it('should parse model list correctly from OpenAI and Google native format', () => {
    // OpenAI / Gemini OpenAI compat format
    const openAiFormat = {
      data: [
        { id: 'gemini-2.5-flash' },
        { id: 'gemini-2.5-pro' },
        { id: 'text-embedding-004' }, // should be filtered
      ],
    };
    const parsed1 = parseFetchedModelList(openAiFormat);
    assert.deepEqual(parsed1, ['gemini-2.5-flash', 'gemini-2.5-pro']);

    // Google Native format
    const googleNativeFormat = {
      models: [
        { name: 'models/gemini-2.0-flash' },
        { name: 'models/gemini-1.5-flash' },
        { name: 'models/embedding-001' }, // should be filtered
      ],
    };
    const parsed2 = parseFetchedModelList(googleNativeFormat);
    assert.deepEqual(parsed2, ['gemini-2.0-flash', 'gemini-1.5-flash']);
  });

  it('should fetch and update available models for Google Gemini provider', async () => {
    const store = useSettingsStore.getState();
    store.updateProviderConfig('google', { apiKey: 'test-google-key' });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          data: [
            { id: 'gemini-2.5-flash' },
            { id: 'gemini-2.5-pro' },
            { id: 'gemini-2.0-flash' },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

    try {
      const models = await store.fetchAvailableModels('google');
      assert.deepEqual(models, ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash']);
      const updatedGoogle = useSettingsStore.getState().providers.google;
      assert.deepEqual(updatedGoogle.availableModels, [
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'gemini-2.0-flash',
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('should support language switching and view navigation', () => {
    const store = useSettingsStore.getState();
    assert.equal(store.language, 'en');
    assert.equal(store.currentView, 'canvas');

    store.setLanguage('zh');
    assert.equal(useSettingsStore.getState().language, 'zh');

    store.setCurrentView('settings');
    assert.equal(useSettingsStore.getState().currentView, 'settings');

    store.setSettingsTab('logs');
    assert.equal(useSettingsStore.getState().settingsTab, 'logs');

    store.setLanguage('en');
    store.setCurrentView('canvas');
    assert.equal(useSettingsStore.getState().language, 'en');
    assert.equal(useSettingsStore.getState().currentView, 'canvas');
  });

  it('should support storage mode switching and server base url configuration', async () => {
    const store = useSettingsStore.getState();
    assert.equal(store.storageMode, 'local');
    assert.equal(store.serverBaseUrl, 'http://localhost:8000');

    store.setStorageMode('server');
    assert.equal(useSettingsStore.getState().storageMode, 'server');

    store.setServerBaseUrl('http://127.0.0.1:8000');
    assert.equal(useSettingsStore.getState().serverBaseUrl, 'http://127.0.0.1:8000');

    // Mock fetch for health test
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL) => {
      if (String(input).includes('/api/v1/health')) {
        return new Response(
          JSON.stringify({ status: 'healthy', app_name: 'PatchCat Backend', version: '0.1.0', database_connected: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response('Not Found', { status: 404 });
    };

    try {
      const result = await store.testServerConnection();
      assert.equal(result.status, 'success');
      assert.ok(result.latencyMs !== undefined);
      assert.ok(result.message?.includes('Connected'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

