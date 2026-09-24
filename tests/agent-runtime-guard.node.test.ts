/**
 * @file    tests/agent-runtime-guard.node.test.ts
 * @description
 *   Unit test suite for PatchCat v0.4.4 hardened runtime guards, safety mechanisms,
 *   centralized runtime defaults, settings export/import migration, and localized danger confirmations.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RUNTIME_DEFAULTS } from '../src/config/runtime-defaults.ts';
import { useSettingsStore, DEFAULT_PROVIDERS } from '../src/stores/settings-store.ts';
import { getDefaultNodeConfig } from '../src/engine/types.ts';
import type { AgentNodeConfig, WorkflowNode, ExecutionEvent } from '../src/engine/types.ts';
import { BrowserWorkflowEngine } from '../src/engine/browser-engine.ts';
import { PROJECT_VERSION } from '../src/config/project.ts';

async function collectEvents(generator: AsyncGenerator<ExecutionEvent>): Promise<ExecutionEvent[]> {
  const events: ExecutionEvent[] = [];
  for await (const ev of generator) {
    events.push(ev);
  }
  return events;
}

describe('v0.4.4 Hardened Agent Runtime, Configuration & Safety Verification', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      activeProvider: 'deepseek',
      providers: JSON.parse(JSON.stringify(DEFAULT_PROVIDERS)),
      runtimeProtection: {
        toolTimeoutEnabled: RUNTIME_DEFAULTS.TOOL_EXECUTION_TIMEOUT_ENABLED,
        toolTimeoutSeconds: RUNTIME_DEFAULTS.TOOL_EXECUTION_TIMEOUT_SECONDS,
        sandboxTimeoutSeconds: RUNTIME_DEFAULTS.SANDBOX_TIMEOUT_SECONDS,
        loopDetectionEnabled: RUNTIME_DEFAULTS.AGENT_LOOP_DETECTION_ENABLED,
        loopDetectionThreshold: RUNTIME_DEFAULTS.AGENT_LOOP_DETECTION_THRESHOLD,
        defaultMaxIterations: RUNTIME_DEFAULTS.AGENT_DEFAULT_MAX_ITERATIONS,
      },
      editorPreferences: {
        autoSaveDebounceMs: RUNTIME_DEFAULTS.AUTOSAVE_DEBOUNCE_MS,
      },
      networkSettings: {
        llmMaxRetries: RUNTIME_DEFAULTS.LLM_MAX_RETRIES,
        llmRetryDelaySeconds: RUNTIME_DEFAULTS.LLM_RETRY_DELAY_SECONDS,
      },
    });
  });

  describe('1. Centralized Runtime Defaults & Decoupled Constants', () => {
    it('verifies all centralized runtime constants exist and fall within safe boundaries', () => {
      assert.ok(RUNTIME_DEFAULTS.AUTOSAVE_DEBOUNCE_MS >= RUNTIME_DEFAULTS.AUTOSAVE_DEBOUNCE_MIN_MS);
      assert.ok(RUNTIME_DEFAULTS.AUTOSAVE_DEBOUNCE_MS <= RUNTIME_DEFAULTS.AUTOSAVE_DEBOUNCE_MAX_MS);

      assert.ok(RUNTIME_DEFAULTS.SANDBOX_TIMEOUT_SECONDS >= RUNTIME_DEFAULTS.SANDBOX_TIMEOUT_MIN_SECONDS);
      assert.ok(RUNTIME_DEFAULTS.SANDBOX_TIMEOUT_SECONDS <= RUNTIME_DEFAULTS.SANDBOX_TIMEOUT_MAX_SECONDS);

      assert.ok(RUNTIME_DEFAULTS.TOOL_EXECUTION_TIMEOUT_SECONDS >= RUNTIME_DEFAULTS.TOOL_EXECUTION_TIMEOUT_MIN_SECONDS);
      assert.ok(RUNTIME_DEFAULTS.TOOL_EXECUTION_TIMEOUT_SECONDS <= RUNTIME_DEFAULTS.TOOL_EXECUTION_TIMEOUT_MAX_SECONDS);

      assert.ok(RUNTIME_DEFAULTS.LLM_MAX_RETRIES >= RUNTIME_DEFAULTS.LLM_MAX_RETRIES_MIN);
      assert.ok(RUNTIME_DEFAULTS.LLM_MAX_RETRIES <= RUNTIME_DEFAULTS.LLM_MAX_RETRIES_MAX);

      assert.strictEqual(RUNTIME_DEFAULTS.AGENT_LOOP_DETECTION_THRESHOLD, 3);
      assert.strictEqual(RUNTIME_DEFAULTS.AGENT_LOOP_DETECTION_HINT_THRESHOLD, 2);
      assert.strictEqual(RUNTIME_DEFAULTS.AGENT_TOKEN_BUDGET, 0); // 0 = unlimited
    });

    it('verifies Agent default node config inherits from RUNTIME_DEFAULTS', () => {
      const config = getDefaultNodeConfig('agent') as AgentNodeConfig;
      assert.strictEqual(config.maxTokenBudget, 0);
      assert.strictEqual(config.loopDetectionEnabled, true);
      assert.strictEqual(config.loopDetectionThreshold, 3);
      assert.strictEqual(config.maxIterations, RUNTIME_DEFAULTS.AGENT_DEFAULT_MAX_ITERATIONS);
    });
  });

  describe('2. Settings Store Backup & Migration (Export / Import)', () => {
    it('exports sanitized settings without exposing API credentials', () => {
      const store = useSettingsStore.getState();
      store.updateProviderConfig('deepseek', { apiKey: 'sk-secret-key-12345' });

      const sanitizedJson = store.exportSettings(false);
      const parsed = JSON.parse(sanitizedJson);

      assert.strictEqual(parsed.version, PROJECT_VERSION);
      assert.strictEqual(parsed.providers.deepseek.apiKey, '');
      assert.strictEqual(parsed.providers.openai.apiKey, '');
      assert.ok(parsed.runtimeProtection);
      assert.ok(parsed.editorPreferences);
      assert.ok(parsed.networkSettings);
    });

    it('exports full settings including API credentials for device migration', () => {
      const store = useSettingsStore.getState();
      store.updateProviderConfig('deepseek', { apiKey: 'sk-secret-key-12345' });

      const fullJson = store.exportSettings(true);
      const parsed = JSON.parse(fullJson);

      assert.strictEqual(parsed.version, PROJECT_VERSION);
      assert.strictEqual(parsed.providers.deepseek.apiKey, 'sk-secret-key-12345');
      assert.ok(parsed._securityWarning);
    });

    it('imports valid configuration backup and updates reactive state', () => {
      const store = useSettingsStore.getState();
      const backupPayload = {
        version: '0.4.4',
        timestamp: new Date().toISOString(),
        activeProvider: 'siliconflow',
        providers: {
          siliconflow: {
            id: 'siliconflow',
            name: 'SiliconFlow',
            baseUrl: 'https://api.siliconflow.cn/v1',
            apiKey: 'sk-migrated-key',
            defaultModel: 'deepseek-ai/DeepSeek-V3',
            availableModels: ['deepseek-ai/DeepSeek-V3'],
            description: 'Imported SiliconFlow config',
          },
        },
        runtimeProtection: {
          toolTimeoutEnabled: true,
          toolTimeoutSeconds: 45,
          sandboxTimeoutSeconds: 12,
          loopDetectionEnabled: true,
          loopDetectionThreshold: 4,
          defaultMaxIterations: 15,
        },
        editorPreferences: {
          autoSaveDebounceMs: 1500,
        },
        networkSettings: {
          llmMaxRetries: 2,
          llmRetryDelaySeconds: 3.0,
        },
      };

      const res = store.importSettings(JSON.stringify(backupPayload));
      assert.strictEqual(res.success, true);

      const updated = useSettingsStore.getState();
      assert.strictEqual(updated.activeProvider, 'siliconflow');
      assert.strictEqual(updated.providers.siliconflow.apiKey, 'sk-migrated-key');
      assert.strictEqual(updated.runtimeProtection.toolTimeoutEnabled, true);
      assert.strictEqual(updated.runtimeProtection.toolTimeoutSeconds, 45);
      assert.strictEqual(updated.runtimeProtection.sandboxTimeoutSeconds, 12);
      assert.strictEqual(updated.runtimeProtection.loopDetectionThreshold, 4);
      assert.strictEqual(updated.editorPreferences.autoSaveDebounceMs, 1500);
      assert.strictEqual(updated.networkSettings.llmMaxRetries, 2);
    });

    it('safely rejects corrupted or malformed configuration imports', () => {
      const store = useSettingsStore.getState();

      const invalidJsonRes = store.importSettings('not a valid json {]');
      assert.strictEqual(invalidJsonRes.success, false);
      assert.ok(invalidJsonRes.error && invalidJsonRes.error.length > 0);

      const missingProvidersRes = store.importSettings(JSON.stringify({ version: '0.4.4' }));
      assert.strictEqual(missingProvidersRes.success, false);
      assert.ok(missingProvidersRes.error?.includes('Missing providers configuration'));
    });
  });

  describe('3. Runtime Protection Store Actions', () => {
    it('updates and resets runtime protection settings cleanly', () => {
      const store = useSettingsStore.getState();

      store.updateRuntimeProtection({
        toolTimeoutEnabled: true,
        toolTimeoutSeconds: 60,
        sandboxTimeoutSeconds: 20,
      });

      let current = useSettingsStore.getState().runtimeProtection;
      assert.strictEqual(current.toolTimeoutEnabled, true);
      assert.strictEqual(current.toolTimeoutSeconds, 60);
      assert.strictEqual(current.sandboxTimeoutSeconds, 20);

      store.resetRuntimeProtection();
      current = useSettingsStore.getState().runtimeProtection;
      assert.strictEqual(current.toolTimeoutEnabled, RUNTIME_DEFAULTS.TOOL_EXECUTION_TIMEOUT_ENABLED);
      assert.strictEqual(current.toolTimeoutSeconds, RUNTIME_DEFAULTS.TOOL_EXECUTION_TIMEOUT_SECONDS);
      assert.strictEqual(current.sandboxTimeoutSeconds, RUNTIME_DEFAULTS.SANDBOX_TIMEOUT_SECONDS);
    });

    it('updates and resets network retry settings cleanly', () => {
      const store = useSettingsStore.getState();

      store.updateNetworkSettings({
        llmMaxRetries: 3,
        llmRetryDelaySeconds: 4.5,
      });

      let net = useSettingsStore.getState().networkSettings;
      assert.strictEqual(net.llmMaxRetries, 3);
      assert.strictEqual(net.llmRetryDelaySeconds, 4.5);

      store.resetNetworkSettings();
      net = useSettingsStore.getState().networkSettings;
      assert.strictEqual(net.llmMaxRetries, RUNTIME_DEFAULTS.LLM_MAX_RETRIES);
      assert.strictEqual(net.llmRetryDelaySeconds, RUNTIME_DEFAULTS.LLM_RETRY_DELAY_SECONDS);
    });
  });

  describe('4. Danger Zone Single-Language Confirmation Match Contract', () => {
    it('strictly enforces English uppercase matching without accepting other languages when in English mode', () => {
      const enExpectedPhrase = 'CLEAR CACHE';

      const matchFn = (input: string) => input.trim().toUpperCase() === enExpectedPhrase.toUpperCase();

      assert.strictEqual(matchFn('CLEAR CACHE'), true);
      assert.strictEqual(matchFn('clear cache'), true);
      assert.strictEqual(matchFn('  clear cache  '), true);
      assert.strictEqual(matchFn('清空缓存'), false);
      assert.strictEqual(matchFn('清除缓存'), false);
      assert.strictEqual(matchFn('DELETE ALL WORKFLOWS'), false);
    });

    it('strictly enforces Chinese exact matching without accepting English when in Chinese mode', () => {
      const zhExpectedPhrase = '清空缓存';

      const matchFn = (input: string) => input.trim() === zhExpectedPhrase;

      assert.strictEqual(matchFn('清空缓存'), true);
      assert.strictEqual(matchFn('  清空缓存  '), true);
      assert.strictEqual(matchFn('CLEAR CACHE'), false);
      assert.strictEqual(matchFn('clear cache'), false);
      assert.strictEqual(matchFn('清除缓存'), false);
    });

    it('strictly validates Chinese Delete All Workflows phrase', () => {
      const zhWorkflowsPhrase = '删除所有工作流';

      const matchFn = (input: string) => input.trim() === zhWorkflowsPhrase;

      assert.strictEqual(matchFn('删除所有工作流'), true);
      assert.strictEqual(matchFn('DELETE ALL WORKFLOWS'), false);
    });
  });

  describe('5. Sub-Workflow Variable Scope Isolation Contract', () => {
    it('isolates sub-workflow variables so child executions do not corrupt parent scope', async () => {
      const engine = new BrowserWorkflowEngine();

      const subWfNode: WorkflowNode = {
        id: 'sub_wf_1',
        type: 'sub_workflow',
        position: { x: 0, y: 0 },
        data: {
          label: 'Sub Workflow Node',
          type: 'sub_workflow',
          status: 'idle',
          inputs: { testKey: 'parent_val' },
          outputs: {},
          config: {
            ...getDefaultNodeConfig('sub_workflow'),
            inputMapping: { testKey: 'child_in' },
            outputMapping: { child_out: 'parent_result' },
            allowStub: true,
          },
        },
      };

      const events = await collectEvents(
        engine.executeWorkflow(
          { nodes: [subWfNode], edges: [] },
          { skipLLM: true }
        )
      );

      const completeEv = events.find(
        (e) => e.type === 'NODE_COMPLETE' && (e.payload as any).nodeId === 'sub_wf_1'
      );
      assert.ok(completeEv, 'Sub-workflow node must complete execution');
      const outputs = (completeEv.payload as any).output;
      assert.ok(typeof outputs.result === 'string' && outputs.result.includes('[Sub-Workflow]'));
      assert.deepStrictEqual(outputs.output, { testKey: 'parent_val' });
    });
  });
});
