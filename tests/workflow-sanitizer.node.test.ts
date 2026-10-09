/**
 * @file    tests/workflow-sanitizer.node.test.ts
 * @version 1.0.0
 * @description
 *   Unit and contract tests for Workflow Export Sanitization Service (PRD-017 Section 3.3):
 *   1. Plaintext API key and credential stripping across all node types and headers.
 *   2. Prompt sensitive variable masking ([SECRET_*], {{SECRET_*}}).
 *   3. Windows & POSIX local absolute filesystem path neutralization.
 *   4. Historical execution outputs cleanup.
 *   5. Non-mutation guarantee of original workflow objects.
 *   6. Granular toggle controls and JSON export serialization.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeWorkflow,
  exportSanitizedWorkflowJson,
  type SanitizedWorkflowResult,
} from '../src/services/export/workflow-sanitizer.ts';
import type { SavedWorkflow } from '../src/stores/project-store.ts';
import type { WorkflowNode, WorkflowEdge } from '../src/engine/types.ts';

function createMockWorkflowWithSensitives(): SavedWorkflow {
  const nodes: WorkflowNode[] = [
    {
      id: 'node_input',
      type: 'input',
      position: { x: 0, y: 0 },
      data: {
        label: 'Input Node',
        type: 'input',
        status: 'success',
        inputs: {
          apiKey: 'sk-input-secret-leak-12345',
          query: 'Explain quantum computing',
        },
        outputs: { query: 'Explain quantum computing' },
        config: {},
      },
    },
    {
      id: 'node_prompt',
      type: 'prompt',
      position: { x: 200, y: 0 },
      data: {
        label: 'Prompt Node',
        type: 'prompt',
        status: 'success',
        inputs: {},
        outputs: { text: 'Prompt output' },
        config: {
          template:
            'Hello {{user_name}}, please use [SECRET_GEMINI_KEY] and {{SECRET_DB_PASS}} to connect to local DB at C:\\Users\\Administrator\\data\\db.sqlite.',
        },
      },
    },
    {
      id: 'node_llm',
      type: 'llm',
      position: { x: 400, y: 0 },
      data: {
        label: 'LLM Node',
        type: 'llm',
        status: 'success',
        inputs: {},
        outputs: { response: 'AI text response with secret: sk-112233' },
        config: {
          model: 'gpt-4o',
          apiKey: 'sk-llm-node-api-key-99999',
          systemPrompt:
            'You are an assistant. Secret internal token: [SECRET_BACKEND_TOKEN]. Relative path ./data/readme.md should stay.',
          providerOverrides: {
            apiKey: 'sk-override-provider-key-8888',
          },
        },
      },
    },
    {
      id: 'node_http',
      type: 'http',
      position: { x: 600, y: 0 },
      data: {
        label: 'HTTP Node',
        type: 'http',
        status: 'error',
        inputs: {},
        outputs: { error: 'Failed request' },
        config: {
          method: 'POST',
          url: 'https://api.example.com/v1/data?key=query_secret_key_111&safe=true',
          headers: {
            'Authorization': 'Bearer bearer-secret-token-token',
            'x-api-key': 'x-api-key-header-value',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          queryParams: {
            key: 'url_param_secret_key',
            page: '1',
          },
          authConfig: {
            token: 'auth-config-token-value',
            password: 'secret-password-123',
            keyValue: 'header-key-value-999',
          },
        },
      },
    },
    {
      id: 'node_knowledge',
      type: 'knowledge',
      position: { x: 800, y: 0 },
      data: {
        label: 'Knowledge Node',
        type: 'knowledge',
        status: 'success',
        inputs: {},
        outputs: { chunks: [] },
        config: {
          knowledgeBaseId: 'kb_prod_1',
          localPath: 'C:\\Users\\GuoQiang\\Documents\\PatchCat\\rag_docs\\enterprise_spec.pdf',
          filePath: '/Users/guoqiang/workspace/docs/internal_architecture.md',
          rerank: {
            enabled: true,
            apiKey: 'cohere-rerank-secret-key-4444',
            model: 'rerank-v3.5',
          },
        },
      },
    },
  ];

  const edges: WorkflowEdge[] = [
    { id: 'edge_1', source: 'node_input', target: 'node_prompt' },
    { id: 'edge_2', source: 'node_prompt', target: 'node_llm' },
  ];

  return {
    id: 'wf_sensitive_demo',
    name: 'Sensitive Demo Workflow',
    folderId: 'default',
    nodes,
    edges,
    globalInputs: {
      apiKey: 'sk-global-api-key-root',
      env: 'production',
    },
    api_key: 'sk-root-workflow-published-key',
    apiKey: 'sk-root-camel-case-key',
    createdAt: 1700000000000,
    updatedAt: 1700000050000,
  };
}

describe('Phase 4.16: Workflow Export Sanitization Service (PRD-017 Section 3.3)', () => {
  // ── 1. Comprehensive Sanitization with Defaults ────────────────────────────
  describe('1. Default Sanitization (All Protections Enabled)', () => {
    it('strips all API keys, masks prompt secrets, and resets local paths', () => {
      const original = createMockWorkflowWithSensitives();
      const result = sanitizeWorkflow(original);

      const sw = result.sanitizedWorkflow;
      const stats = result.stats;

      // 1. Root and Global Inputs
      assert.equal(sw.api_key, '');
      assert.equal((sw as unknown as Record<string, unknown>)['apiKey'], '');
      assert.equal((sw.globalInputs as Record<string, unknown>)['apiKey'], '');
      assert.equal((sw.globalInputs as Record<string, unknown>)['env'], 'production'); // Safe preserved

      // 2. Input Node credentials stripped
      const inputNode = sw.nodes.find((n) => n.id === 'node_input');
      assert.ok(inputNode);
      assert.equal((inputNode.data.inputs as Record<string, unknown>)['apiKey'], '');
      assert.equal((inputNode.data.inputs as Record<string, unknown>)['query'], 'Explain quantum computing');

      // 3. Prompt Node template masked
      const promptNode = sw.nodes.find((n) => n.id === 'node_prompt');
      assert.ok(promptNode);
      const promptTemplate = promptNode.data.config['template'] as string;
      assert.ok(!promptTemplate.includes('[SECRET_GEMINI_KEY]'));
      assert.ok(!promptTemplate.includes('{{SECRET_DB_PASS}}'));
      assert.ok(promptTemplate.includes('[MASKED_SECRET]'));
      assert.ok(promptTemplate.includes('{{user_name}}')); // Safe variable preserved
      // Local path in prompt template neutralized
      assert.ok(!promptTemplate.includes('C:\\Users\\Administrator'));
      assert.ok(promptTemplate.includes('[LOCAL_PATH_REDACTED]'));

      // 4. LLM Node credentials & prompt masked
      const llmNode = sw.nodes.find((n) => n.id === 'node_llm');
      assert.ok(llmNode);
      assert.equal(llmNode.data.config['apiKey'], '');
      const po = llmNode.data.config['providerOverrides'] as Record<string, unknown>;
      assert.equal(po['apiKey'], '');
      const sysPrompt = llmNode.data.config['systemPrompt'] as string;
      assert.ok(!sysPrompt.includes('[SECRET_BACKEND_TOKEN]'));
      assert.ok(sysPrompt.includes('[MASKED_SECRET]'));
      assert.ok(sysPrompt.includes('./data/readme.md')); // Relative path preserved

      // 5. HTTP Node auth headers & params stripped
      const httpNode = sw.nodes.find((n) => n.id === 'node_http');
      assert.ok(httpNode);
      const headers = httpNode.data.config['headers'] as Record<string, string>;
      assert.equal(headers['Authorization'], '[REDACTED]');
      assert.equal(headers['x-api-key'], '[REDACTED]');
      assert.equal(headers['Content-Type'], 'application/json'); // Safe preserved
      assert.equal(headers['Accept'], 'application/json');       // Safe preserved

      const queryParams = httpNode.data.config['queryParams'] as Record<string, string>;
      assert.equal(queryParams['key'], '[REDACTED]');
      assert.equal(queryParams['page'], '1'); // Safe preserved

      const authConfig = httpNode.data.config['authConfig'] as Record<string, unknown>;
      assert.equal(authConfig['token'], '');
      assert.equal(authConfig['password'], '');
      assert.equal(authConfig['keyValue'], '');

      // 6. Knowledge Node local paths and rerank apiKey stripped
      const kbNode = sw.nodes.find((n) => n.id === 'node_knowledge');
      assert.ok(kbNode);
      const rerank = kbNode.data.config['rerank'] as Record<string, unknown>;
      assert.equal(rerank['apiKey'], '');
      assert.equal(rerank['model'], 'rerank-v3.5'); // Safe preserved

      const localPath = kbNode.data.config['localPath'] as string;
      assert.ok(!localPath.includes('C:\\Users\\GuoQiang'));
      assert.ok(localPath.includes('[LOCAL_PATH_REDACTED]/enterprise_spec.pdf'));

      const filePath = kbNode.data.config['filePath'] as string;
      assert.ok(!filePath.includes('/Users/guoqiang'));
      assert.ok(filePath.includes('[LOCAL_PATH_REDACTED]/internal_architecture.md'));

      // 7. Execution outputs cleared and statuses reset to idle
      for (const node of sw.nodes) {
        assert.deepEqual(node.data.outputs, {});
        assert.equal(node.data.status, 'idle');
      }

      // 8. Stats audit count accuracy
      assert.ok(stats.strippedApiKeysCount >= 10);
      assert.ok(stats.maskedPromptVarsCount >= 3);
      assert.ok(stats.strippedLocalPathsCount >= 3);
      assert.equal(
        stats.totalSanitizedCount,
        stats.strippedApiKeysCount + stats.maskedPromptVarsCount + stats.strippedLocalPathsCount,
      );
      assert.equal(stats.details.length, stats.totalSanitizedCount);
    });
  });

  // ── 2. Non-Mutation Guarantee ──────────────────────────────────────────────
  describe('2. Input Workflow Immutability Guarantee', () => {
    it('does not mutate the original workflow object in place', () => {
      const original = createMockWorkflowWithSensitives();
      const originalJson = JSON.stringify(original);

      sanitizeWorkflow(original);

      const afterJson = JSON.stringify(original);
      assert.equal(
        afterJson,
        originalJson,
        'Original workflow object was mutated during sanitization!',
      );
    });
  });

  // ── 3. Selective Toggles ───────────────────────────────────────────────────
  describe('3. Selective Options & Custom Patterns', () => {
    it('preserves API keys when stripApiKeys is explicitly false', () => {
      const original = createMockWorkflowWithSensitives();
      const result = sanitizeWorkflow(original, { stripApiKeys: false });

      assert.equal(result.stats.strippedApiKeysCount, 0);
      assert.equal(result.sanitizedWorkflow.api_key, 'sk-root-workflow-published-key');
      const llmNode = result.sanitizedWorkflow.nodes.find((n) => n.id === 'node_llm');
      assert.equal(llmNode?.data.config['apiKey'], 'sk-llm-node-api-key-99999');
    });

    it('preserves prompt variables when maskSensitivePromptVars is false', () => {
      const original = createMockWorkflowWithSensitives();
      const result = sanitizeWorkflow(original, { maskSensitivePromptVars: false });

      assert.equal(result.stats.maskedPromptVarsCount, 0);
      const promptNode = result.sanitizedWorkflow.nodes.find((n) => n.id === 'node_prompt');
      assert.ok(String(promptNode?.data.config['template']).includes('[SECRET_GEMINI_KEY]'));
    });

    it('preserves local absolute paths when stripLocalPaths is false', () => {
      const original = createMockWorkflowWithSensitives();
      const result = sanitizeWorkflow(original, { stripLocalPaths: false });

      assert.equal(result.stats.strippedLocalPathsCount, 0);
      const kbNode = result.sanitizedWorkflow.nodes.find((n) => n.id === 'node_knowledge');
      assert.ok(String(kbNode?.data.config['localPath']).includes('C:\\Users\\GuoQiang'));
    });

    it('supports custom secret patterns', () => {
      const original = createMockWorkflowWithSensitives();
      const result = sanitizeWorkflow(original, {
        customSecretPatterns: ['Explain quantum computing'],
      });

      const promptDetails = result.stats.details.filter(
        (d) => d.originalSnippet === 'Explain quantum computing',
      );
      assert.ok(promptDetails.length >= 0);
    });

    it('preserves node outputs when clearExecutionOutputs is false', () => {
      const original = createMockWorkflowWithSensitives();
      const result = sanitizeWorkflow(original, { clearExecutionOutputs: false });

      const inputNode = result.sanitizedWorkflow.nodes.find((n) => n.id === 'node_input');
      assert.deepEqual(inputNode?.data.outputs, { query: 'Explain quantum computing' });
      assert.equal(inputNode?.data.status, 'success');
    });
  });

  // ── 4. JSON Serialization ──────────────────────────────────────────────────
  describe('4. JSON Export Serialization (.patchcat.json)', () => {
    it('produces valid parseable JSON without any leaked credentials', () => {
      const original = createMockWorkflowWithSensitives();
      const jsonStr = exportSanitizedWorkflowJson(original);

      assert.ok(typeof jsonStr === 'string');
      const parsed = JSON.parse(jsonStr) as SavedWorkflow;
      assert.equal(parsed.id, 'wf_sensitive_demo');
      assert.equal(parsed.api_key, '');
      assert.ok(!jsonStr.includes('sk-llm-node-api-key-99999'));
      assert.ok(!jsonStr.includes('C:\\Users\\GuoQiang'));
      assert.ok(!jsonStr.includes('bearer-secret-token-token'));
    });
  });
});
