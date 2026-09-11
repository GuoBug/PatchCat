import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { translations } from '../src/i18n/translations.ts';
import { PRESETS_DATA } from '../src/presets/index.ts';
import type { ConditionNodeConfig, AggregatorNodeConfig, HttpNodeConfig } from '../src/engine/types.ts';

// Helper to recursively collect all keys and check non-empty string values
function assertNoMissingOrEmptyTranslations(obj: Record<string, any>, path = ''): void {
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    assert.notStrictEqual(value, undefined, `Translation key "${currentPath}" is undefined`);
    assert.notStrictEqual(value, null, `Translation key "${currentPath}" is null`);
    if (typeof value === 'object' && value !== null) {
      assertNoMissingOrEmptyTranslations(value, currentPath);
    } else {
      assert.strictEqual(typeof value, 'string', `Translation key "${currentPath}" must be a string`);
      assert.ok(value.trim().length > 0, `Translation key "${currentPath}" must not be empty`);
      assert.ok(!value.includes('[object Object]'), `Translation key "${currentPath}" contains raw [object Object]`);
    }
  }
}

// Helper to compare object schema structure parity
function getObjectShape(obj: Record<string, any>): string[] {
  const keys: string[] = [];
  function recurse(current: Record<string, any>, prefix = '') {
    for (const [k, v] of Object.entries(current)) {
      const full = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'object' && v !== null) {
        recurse(v, full);
      } else {
        keys.push(full);
      }
    }
  }
  recurse(obj);
  return keys.sort();
}

describe('Frontend Visual Presentation & Visual Readability Tests', () => {
  describe('1. i18n Completeness & Exact English/Chinese Parity', () => {
    it('ensures English translations are 100% non-empty and well-formed', () => {
      assertNoMissingOrEmptyTranslations(translations.en);
    });

    it('ensures Chinese translations are 100% non-empty and well-formed', () => {
      assertNoMissingOrEmptyTranslations(translations.zh);
    });

    it('guarantees identical key parity between English and Chinese translation dictionaries', () => {
      const enKeys = getObjectShape(translations.en);
      const zhKeys = getObjectShape(translations.zh);

      const missingInZh = enKeys.filter((k) => !zhKeys.includes(k));
      const missingInEn = zhKeys.filter((k) => !enKeys.includes(k));

      assert.deepStrictEqual(missingInZh, [], `Keys present in English but missing in Chinese: ${missingInZh.join(', ')}`);
      assert.deepStrictEqual(missingInEn, [], `Keys present in Chinese but missing in English: ${missingInEn.join(', ')}`);
      assert.strictEqual(enKeys.length, zhKeys.length, 'Total translation key counts must match exactly');
    });
  });

  describe('2. All 9 Node Types Visual Descriptor Verification', () => {
    const allNodeTypes = [
      'input',
      'prompt',
      'llm',
      'code',
      'output',
      'knowledge',
      'condition',
      'aggregator',
      'http',
    ] as const;

    it('has readable names and descriptions for every node type in both languages', () => {
      for (const nodeType of allNodeTypes) {
        const enName = translations.en.nodeTypes[nodeType];
        const zhName = translations.zh.nodeTypes[nodeType];
        const enDesc = (translations.en.nodeTypes as Record<string, string>)[`${nodeType}Desc`];
        const zhDesc = (translations.zh.nodeTypes as Record<string, string>)[`${nodeType}Desc`];

        assert.ok(enName && enName.length > 0, `Missing EN name for node type: ${nodeType}`);
        assert.ok(zhName && zhName.length > 0, `Missing ZH name for node type: ${nodeType}`);
        assert.ok(enDesc && enDesc.length > 0, `Missing EN description for node type: ${nodeType}`);
        assert.ok(zhDesc && zhDesc.length > 0, `Missing ZH description for node type: ${nodeType}`);
      }
    });

    it('verifies Condition Node property panel & operator definitions are complete', () => {
      const operators = [
        'operatorEquals',
        'operatorNotEquals',
        'operatorContains',
        'operatorNotContains',
        'operatorGreaterThan',
        'operatorLessThan',
        'operatorIsEmpty',
        'operatorIsNotEmpty',
        'operatorRegexMatch',
      ] as const;

      for (const op of operators) {
        assert.ok(translations.en.propertyPanel[op], `Missing EN label for ${op}`);
        assert.ok(translations.zh.propertyPanel[op], `Missing ZH label for ${op}`);
      }

      // Check condition rule labels
      assert.ok(translations.en.propertyPanel.conditionRulesTitle);
      assert.ok(translations.zh.propertyPanel.conditionRulesTitle);
      assert.ok(translations.en.propertyPanel.fallbackBranchTitle);
      assert.ok(translations.zh.propertyPanel.fallbackBranchTitle);
      assert.ok(translations.en.propertyPanel.targetHandleLabel);
      assert.ok(translations.zh.propertyPanel.targetHandleLabel);
    });

    it('verifies Aggregator Node modes and output key labels are complete', () => {
      const aggKeys = [
        'aggregatorModeTitle',
        'aggFirstAvailableLabel',
        'aggFirstAvailableDesc',
        'aggMergeAllLabel',
        'aggMergeAllDesc',
        'aggWaitAllLabel',
        'aggWaitAllDesc',
        'aggOutputKeyLabel',
        'aggOutputKeyHint',
      ] as const;

      for (const key of aggKeys) {
        assert.ok(translations.en.propertyPanel[key], `Missing EN aggregator key: ${key}`);
        assert.ok(translations.zh.propertyPanel[key], `Missing ZH aggregator key: ${key}`);
      }
    });

    it('verifies HTTP Request Node tabs, auth formats, and parameter labels are complete', () => {
      const httpKeys = [
        'httpConfigTitle',
        'httpUrlPlaceholder',
        'httpUrlHint',
        'httpTabParams',
        'httpTabHeaders',
        'httpTabBody',
        'httpTabAuth',
        'httpTabSettings',
        'httpQueryParamsTitle',
        'httpAddParam',
        'httpNoQueryParams',
        'httpHeadersTitle',
        'httpAddHeader',
        'httpDefaultHeadersHint',
        'httpBodyFormat',
        'httpAuthType',
        'httpAuthNone',
        'httpAuthBearer',
        'httpAuthBasic',
        'httpAuthApiKey',
        'httpBearerTokenLabel',
        'httpUsernameLabel',
        'httpPasswordLabel',
        'httpKeyNamePlaceholder',
        'httpKeyValuePlaceholder',
        'httpSendInHeader',
        'httpSendInQuery',
        'httpTimeoutLabel',
        'httpMaxRetriesLabel',
      ] as const;

      for (const key of httpKeys) {
        assert.ok(translations.en.propertyPanel[key], `Missing EN http key: ${key}`);
        assert.ok(translations.zh.propertyPanel[key], `Missing ZH http key: ${key}`);
      }
    });

    it('verifies Chat Debug Panel and Publish API Modal have full bilingual support', () => {
      // Chat Debug keys
      const chatKeys = [
        'title',
        'subtitle',
        'emptyTitle',
        'emptyDesc',
        'userRole',
        'assistantRole',
        'executionTrace',
        'streamingResponse',
        'thinking',
        'inputPlaceholder',
        'clearHistory',
        'exportHistory',
        'closePanel',
        'send',
        'exportJson',
        'exportMarkdown',
        'nodesUnit',
        'emptyResponse',
      ] as const;

      for (const k of chatKeys) {
        assert.ok(translations.en.chatDebug[k], `Missing EN chatDebug.${k}`);
        assert.ok(translations.zh.chatDebug[k], `Missing ZH chatDebug.${k}`);
      }

      // Publish API keys
      const pubKeys = [
        'title',
        'subtitle',
        'statusActive',
        'statusDisabled',
        'statusHint',
        'enableBtn',
        'disableBtn',
        'endpointUrl',
        'copyUrl',
        'apiKey',
        'copyKey',
        'regenerateKey',
        'copyCode',
        'noKey',
      ] as const;

      for (const k of pubKeys) {
        assert.ok(translations.en.publishApi[k], `Missing EN publishApi.${k}`);
        assert.ok(translations.zh.publishApi[k], `Missing ZH publishApi.${k}`);
      }
    });
  });

  describe('3. Preset Workflows Visual Integrity & Connection Handle Safety', () => {
    const languages: ('en' | 'zh')[] = ['en', 'zh'];

    for (const lang of languages) {
      describe(`Preset Suite (${lang.toUpperCase()})`, () => {
        const presets = PRESETS_DATA[lang];

        for (const [presetKey, preset] of Object.entries(presets)) {
          it(`validates preset "${presetKey}" has readable node labels and zero undefined configs`, () => {
            assert.ok(preset.name.length > 0, `Preset ${presetKey} name is empty`);
            assert.ok(preset.desc.length > 0, `Preset ${presetKey} desc is empty`);
            assert.ok(preset.data.nodes.length > 0, `Preset ${presetKey} has no nodes`);

            for (const node of preset.data.nodes) {
              assert.ok(node.id && node.id.trim().length > 0, `Node in ${presetKey} has empty id`);
              assert.ok(node.data?.label && node.data.label.trim().length > 0, `Node ${node.id} in ${presetKey} has empty label`);
              assert.ok(node.data?.type || node.type, `Node ${node.id} has no type defined`);

              // Ensure config is stringifiable without NaN or [object Object]
              const serialized = JSON.stringify(node.data?.config ?? {});
              assert.ok(!serialized.includes('NaN'), `Node ${node.id} config contains NaN`);
              assert.ok(!serialized.includes('[object Object]'), `Node ${node.id} config contains [object Object]`);
            }
          });

          it(`validates condition nodes in "${presetKey}" have outgoing edges matching handle IDs`, () => {
            const conditionNodes = preset.data.nodes.filter(
              (n) => n.data?.type === 'condition' || n.type === 'condition'
            );

            for (const cNode of conditionNodes) {
              const cfg = (cNode.data?.config || {}) as ConditionNodeConfig;
              const ruleHandles = (cfg.conditions || []).map((r) => r.targetHandle);
              const defaultHandle = cfg.defaultBranch || 'else';
              const validHandles = new Set([...ruleHandles, defaultHandle]);

              // Find outgoing edges from this condition node
              const outgoingEdges = preset.data.edges.filter((e) => e.source === cNode.id);
              assert.ok(outgoingEdges.length > 0, `Condition node ${cNode.id} in ${presetKey} has no outgoing edges`);

              for (const edge of outgoingEdges) {
                assert.ok(
                  edge.sourceHandle && validHandles.has(edge.sourceHandle),
                  `Edge ${edge.id} in ${presetKey} references sourceHandle "${edge.sourceHandle}" which is not defined on ConditionNode ${cNode.id}. Valid: ${Array.from(validHandles).join(', ')}`
                );
              }
            }
          });

          it(`validates aggregator nodes in "${presetKey}" have valid mode and outputKey`, () => {
            const aggregatorNodes = preset.data.nodes.filter(
              (n) => n.data?.type === 'aggregator' || n.type === 'aggregator'
            );

            for (const aNode of aggregatorNodes) {
              const cfg = (aNode.data?.config || {}) as AggregatorNodeConfig;
              const validModes = ['first_available', 'merge_all', 'wait_all'];
              assert.ok(
                validModes.includes(cfg.mode || 'first_available'),
                `Aggregator node ${aNode.id} in ${presetKey} has invalid mode "${cfg.mode}"`
              );
              assert.ok(
                cfg.outputKey && cfg.outputKey.trim().length > 0,
                `Aggregator node ${aNode.id} in ${presetKey} has empty outputKey`
              );
            }
          });

          it(`validates http nodes in "${presetKey}" have valid method and url`, () => {
            const httpNodes = preset.data.nodes.filter(
              (n) => n.data?.type === 'http' || n.type === 'http'
            );

            for (const hNode of httpNodes) {
              const cfg = (hNode.data?.config || {}) as HttpNodeConfig;
              const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
              assert.ok(
                validMethods.includes((cfg.method || 'GET').toUpperCase()),
                `HTTP node ${hNode.id} in ${presetKey} has invalid method "${cfg.method}"`
              );
              assert.ok(
                cfg.url && cfg.url.trim().length > 0,
                `HTTP node ${hNode.id} in ${presetKey} has empty URL`
              );
            }
          });
        }
      });
    }
  });

  describe('4. Visual Readability & Output Rendering Safety', () => {
    function formatOutputForDisplay(output: unknown): string {
      if (output === undefined || output === null) {
        return 'Completed with no textual output.';
      }
      if (typeof output === 'string') {
        return output.trim() || 'Completed with no textual output.';
      }
      try {
        return JSON.stringify(output, null, 2);
      } catch {
        return String(output);
      }
    }

    it('safely formats complex nested objects without [object Object]', () => {
      const sample = {
        status: 200,
        city: 'Tokyo',
        forecast: [{ day: 'Mon', temp: 22 }, { day: 'Tue', temp: 24 }],
      };

      const formatted = formatOutputForDisplay(sample);
      assert.ok(!formatted.includes('[object Object]'), 'Output should not contain [object Object]');
      assert.ok(formatted.includes('"city": "Tokyo"'));
      assert.ok(formatted.includes('Mon'));
    });

    it('safely formats null and undefined without blank or broken UI', () => {
      assert.strictEqual(formatOutputForDisplay(null), 'Completed with no textual output.');
      assert.strictEqual(formatOutputForDisplay(undefined), 'Completed with no textual output.');
      assert.strictEqual(formatOutputForDisplay('   '), 'Completed with no textual output.');
    });

    it('safely formats primitives without unexpected characters', () => {
      assert.strictEqual(formatOutputForDisplay(12345), '12345');
      assert.strictEqual(formatOutputForDisplay(true), 'true');
      assert.strictEqual(formatOutputForDisplay('hello world'), 'hello world');
    });
  });

  describe('5. Danger Zone Confirmation Matching & Typed Phrase Safety', () => {
    function isConfirmationMatching(inputVal: string, confirmPhrase: string, altConfirmPhrase?: string): boolean {
      const trimmed = inputVal.trim();
      return (
        trimmed.toUpperCase() === confirmPhrase.toUpperCase() ||
        Boolean(altConfirmPhrase && trimmed === altConfirmPhrase.trim())
      );
    }

    it('validates Clear Cache confirmation phrases (case-insensitive English & Chinese)', () => {
      const phrase = translations.en.settings.clearCacheConfirmPhrase;
      const altPhrase = '清除缓存';

      assert.strictEqual(phrase, 'CLEAR CACHE');
      assert.strictEqual(isConfirmationMatching('CLEAR CACHE', phrase, altPhrase), true);
      assert.strictEqual(isConfirmationMatching('clear cache', phrase, altPhrase), true);
      assert.strictEqual(isConfirmationMatching('  Clear Cache  ', phrase, altPhrase), true);
      assert.strictEqual(isConfirmationMatching('清除缓存', phrase, altPhrase), true);
      assert.strictEqual(isConfirmationMatching(' 清除缓存 ', phrase, altPhrase), true);

      // Rejections
      assert.strictEqual(isConfirmationMatching('', phrase, altPhrase), false);
      assert.strictEqual(isConfirmationMatching('clear', phrase, altPhrase), false);
      assert.strictEqual(isConfirmationMatching('delete', phrase, altPhrase), false);
      assert.strictEqual(isConfirmationMatching('CLEAR', phrase, altPhrase), false);
    });

    it('validates Clear All Workflows confirmation phrases (case-insensitive English & Chinese)', () => {
      const phrase = translations.en.settings.clearWorkflowsConfirmPhrase;
      const altPhrase = '清除所有流程';

      assert.strictEqual(phrase, 'DELETE ALL WORKFLOWS');
      assert.strictEqual(isConfirmationMatching('DELETE ALL WORKFLOWS', phrase, altPhrase), true);
      assert.strictEqual(isConfirmationMatching('delete all workflows', phrase, altPhrase), true);
      assert.strictEqual(isConfirmationMatching('  Delete All Workflows  ', phrase, altPhrase), true);
      assert.strictEqual(isConfirmationMatching('清除所有流程', phrase, altPhrase), true);
      assert.strictEqual(isConfirmationMatching(' 清除所有流程 ', phrase, altPhrase), true);

      // Rejections
      assert.strictEqual(isConfirmationMatching('', phrase, altPhrase), false);
      assert.strictEqual(isConfirmationMatching('DELETE', phrase, altPhrase), false);
      assert.strictEqual(isConfirmationMatching('workflows', phrase, altPhrase), false);
      assert.strictEqual(isConfirmationMatching('CLEAR CACHE', phrase, altPhrase), false);
      assert.strictEqual(isConfirmationMatching('清除缓存', phrase, altPhrase), false);
    });
  });
});
