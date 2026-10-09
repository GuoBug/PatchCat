/**
 * @file    src/services/export/workflow-sanitizer.ts
 * @version 1.0.0
 * @description
 *   Workflow Export Sanitization & Data Sovereignty Hardening Service.
 *   Conforms to PRD-017 Section 3.3:
 *   - Strips plaintext API keys, auth tokens, and credentials in node configs and headers.
 *   - Masks sensitive prompt placeholders (e.g. [SECRET_*], {{SECRET_*}}).
 *   - Strips and normalizes OS-specific absolute local filesystem paths in knowledge bases.
 *   - Clears transient execution outputs, ensuring pure deterministic logical topology export (.patchcat.json).
 */

import type { SavedWorkflow } from '../../stores/project-store.ts';
import type { WorkflowGraph, WorkflowNode } from '../../engine/types.ts';

export interface SanitizedExportOptions {
  /**
   * Scans and strips plaintext API keys in node configs, provider overrides,
   * auth configs, headers, and query parameters.
   * Default: true
   */
  stripApiKeys?: boolean;

  /**
   * Masks prompt placeholders matching [SECRET_*] or {{SECRET_*}}.
   * Default: true
   */
  maskSensitivePromptVars?: boolean;

  /**
   * Strips absolute OS local filesystem paths (Windows drive letters & POSIX /Users, /home, etc.).
   * Default: true
   */
  stripLocalPaths?: boolean;

  /**
   * Optional custom secret token strings or regex patterns to mask.
   */
  customSecretPatterns?: (string | RegExp)[];

  /**
   * Replacement string for sensitive values.
   * Default: '[REDACTED]'
   */
  redactedPlaceholder?: string;

  /**
   * Replacement string for local file paths.
   * Default: '[LOCAL_PATH_REDACTED]'
   */
  pathPlaceholder?: string;

  /**
   * Clears historical node execution outputs, errors, and running states.
   * Default: true
   */
  clearExecutionOutputs?: boolean;
}

export interface SanitizationDetail {
  nodeId?: string;
  nodeType?: string;
  field: string;
  type: 'apiKey' | 'promptVar' | 'localPath';
  action: 'stripped' | 'masked';
  originalSnippet?: string;
}

export type SanitizableWorkflow = SavedWorkflow | WorkflowGraph | Record<string, unknown>;

export interface SanitizedWorkflowResult<T = SavedWorkflow | WorkflowGraph> {
  sanitizedWorkflow: T;
  stats: {
    strippedApiKeysCount: number;
    maskedPromptVarsCount: number;
    strippedLocalPathsCount: number;
    totalSanitizedCount: number;
    details: SanitizationDetail[];
  };
}

// Regex for detecting Windows & POSIX absolute paths
const WINDOWS_ABSOLUTE_PATH_RE =
  /(?:[a-zA-Z]:[/\\]|\\\\[a-zA-Z0-9_.-]+\\[a-zA-Z0-9_.-]+\\)[^:*?"<>|\r\n\t\f\v'"]*/g;
const POSIX_ABSOLUTE_PATH_RE =
  /(?:^|(?<=[\s"'`=:]))(?:\/(?:Users|home|root|var|etc|opt|tmp|private|usr|Volumes)\/[^\s:*?"<>|\r\n\t\f\v'"]*)/g;

// Regex for detecting sensitive prompt variable placeholders
const SENSITIVE_PROMPT_VAR_RE =
  /\[SECRET_[A-Za-z0-9_]+\]|\{\{\s*SECRET_[A-Za-z0-9_]+\s*\}\}/g;

// Sensitive key name patterns
const SENSITIVE_KEY_NAME_RE =
  /^(apiKey|api_key|token|secret|secretKey|secret_key|accessToken|access_token|privateKey|private_key|auth_token|keyValue|password)$/i;

const SENSITIVE_HEADER_RE =
  /^(authorization|x-api-key|api-key|apikey|x-token|token|bearer|secret|proxy-authorization)$/i;

const SENSITIVE_QUERY_PARAM_RE =
  /^(key|api_key|apikey|token|secret|access_token|auth)$/i;

/**
 * Sanitizes a workflow object by stripping credentials, masking sensitive prompt variables,
 * and neutralizing OS local filesystem paths.
 *
 * @param workflow - Target workflow (SavedWorkflow or WorkflowGraph)
 * @param options - Sanitization toggles and options
 * @returns SanitizedWorkflowResult containing deep-cloned clean workflow and audit stats
 */
export function sanitizeWorkflow<T extends SanitizableWorkflow = SavedWorkflow>(
  workflow: T,
  options: SanitizedExportOptions = {},
): SanitizedWorkflowResult<T> {
  const {
    stripApiKeys = true,
    maskSensitivePromptVars = true,
    stripLocalPaths = true,
    customSecretPatterns = [],
    redactedPlaceholder = '[REDACTED]',
    pathPlaceholder = '[LOCAL_PATH_REDACTED]',
    clearExecutionOutputs = true,
  } = options;

  // Deep clone to guarantee non-mutation of input workflow
  const cloned = (
    typeof structuredClone === 'function'
      ? structuredClone(workflow)
      : JSON.parse(JSON.stringify(workflow))
  ) as Record<string, unknown>;

  const details: SanitizationDetail[] = [];
  let strippedApiKeysCount = 0;
  let maskedPromptVarsCount = 0;
  let strippedLocalPathsCount = 0;

  // 1. Root-level metadata API keys
  if (stripApiKeys) {
    if (typeof cloned['api_key'] === 'string' && cloned['api_key'].trim() !== '') {
      details.push({
        field: 'root.api_key',
        type: 'apiKey',
        action: 'stripped',
        originalSnippet: '[REDACTED_API_KEY]',
      });
      cloned['api_key'] = '';
      strippedApiKeysCount++;
    }
    if (typeof cloned['apiKey'] === 'string' && cloned['apiKey'].trim() !== '') {
      details.push({
        field: 'root.apiKey',
        type: 'apiKey',
        action: 'stripped',
        originalSnippet: '[REDACTED_API_KEY]',
      });
      cloned['apiKey'] = '';
      strippedApiKeysCount++;
    }
  }

  // 2. Global inputs credential check
  const globalInputs = (cloned['globalInputs'] || cloned['global_inputs']) as
    | Record<string, unknown>
    | undefined;
  if (globalInputs && typeof globalInputs === 'object') {
    for (const [key, val] of Object.entries(globalInputs)) {
      if (stripApiKeys && SENSITIVE_KEY_NAME_RE.test(key) && val) {
        globalInputs[key] = '';
        strippedApiKeysCount++;
        details.push({
          field: `globalInputs.${key}`,
          type: 'apiKey',
          action: 'stripped',
          originalSnippet: '[REDACTED_API_KEY]',
        });
      }
    }
  }

  // 3. Process Graph Nodes
  const nodes = (cloned['nodes'] as WorkflowNode[]) || [];
  if (Array.isArray(nodes)) {
    for (const node of nodes) {
      if (!node || typeof node !== 'object' || !node.data) continue;

      const nodeId = node.id;
      const nodeType = node.type || node.data.type;
      const nodeData = node.data as Record<string, unknown>;
      const config = (nodeData['config'] || {}) as Record<string, unknown>;

      // A. Strip API Keys & Credentials
      if (stripApiKeys) {
        // Direct config keys
        for (const [k, v] of Object.entries(config)) {
          if (SENSITIVE_KEY_NAME_RE.test(k) && typeof v === 'string' && v.trim() !== '') {
            config[k] = '';
            strippedApiKeysCount++;
            details.push({
              nodeId,
              nodeType,
              field: `config.${k}`,
              type: 'apiKey',
              action: 'stripped',
              originalSnippet: '[REDACTED_API_KEY]',
            });
          }
        }

        // Auth config in HTTP node
        const authConfig = config['authConfig'] as Record<string, unknown> | undefined;
        if (authConfig && typeof authConfig === 'object') {
          for (const authField of ['keyValue', 'token', 'password']) {
            if (
              typeof authConfig[authField] === 'string' &&
              (authConfig[authField] as string).trim() !== ''
            ) {
              details.push({
                nodeId,
                nodeType,
                field: `config.authConfig.${authField}`,
                type: 'apiKey',
                action: 'stripped',
                originalSnippet: '[REDACTED_API_KEY]',
              });
              authConfig[authField] = '';
              strippedApiKeysCount++;
            }
          }
        }

        // Rerank config in Knowledge node
        const rerankConfig = config['rerank'] as Record<string, unknown> | undefined;
        if (rerankConfig && typeof rerankConfig === 'object') {
          if (
            typeof rerankConfig['apiKey'] === 'string' &&
            rerankConfig['apiKey'].trim() !== ''
          ) {
            details.push({
              nodeId,
              nodeType,
              field: 'config.rerank.apiKey',
              type: 'apiKey',
              action: 'stripped',
              originalSnippet: '[REDACTED_API_KEY]',
            });
            rerankConfig['apiKey'] = '';
            strippedApiKeysCount++;
          }
        }

        // Headers in HTTP node
        const headers = config['headers'] as Record<string, string> | undefined;
        if (headers && typeof headers === 'object') {
          for (const [hKey, hVal] of Object.entries(headers)) {
            if (SENSITIVE_HEADER_RE.test(hKey) && hVal) {
              headers[hKey] = redactedPlaceholder;
              strippedApiKeysCount++;
              details.push({
                nodeId,
                nodeType,
                field: `config.headers.${hKey}`,
                type: 'apiKey',
                action: 'stripped',
              });
            }
          }
        }

        // Query parameters in HTTP node
        const queryParams = config['queryParams'] as Record<string, string> | undefined;
        if (queryParams && typeof queryParams === 'object') {
          for (const [qKey, qVal] of Object.entries(queryParams)) {
            if (SENSITIVE_QUERY_PARAM_RE.test(qKey) && qVal) {
              queryParams[qKey] = redactedPlaceholder;
              strippedApiKeysCount++;
              details.push({
                nodeId,
                nodeType,
                field: `config.queryParams.${qKey}`,
                type: 'apiKey',
                action: 'stripped',
              });
            }
          }
        }

        // Provider Overrides
        const providerOverrides = config['providerOverrides'] || config['providerOverride'];
        if (providerOverrides && typeof providerOverrides === 'object') {
          const po = providerOverrides as Record<string, unknown>;
          if (typeof po['apiKey'] === 'string' && po['apiKey'].trim() !== '') {
            po['apiKey'] = '';
            strippedApiKeysCount++;
            details.push({
              nodeId,
              nodeType,
              field: 'config.providerOverrides.apiKey',
              type: 'apiKey',
              action: 'stripped',
            });
          }
        }

        // Node inputs credential check
        const inputs = nodeData['inputs'] as Record<string, unknown> | undefined;
        if (inputs && typeof inputs === 'object') {
          for (const [iKey, iVal] of Object.entries(inputs)) {
            if (SENSITIVE_KEY_NAME_RE.test(iKey) && typeof iVal === 'string' && iVal) {
              inputs[iKey] = '';
              strippedApiKeysCount++;
              details.push({
                nodeId,
                nodeType,
                field: `inputs.${iKey}`,
                type: 'apiKey',
                action: 'stripped',
              });
            }
          }
        }
      }

      // B. Mask Sensitive Prompt Variables
      if (maskSensitivePromptVars) {
        const textFieldsToScan = [
          'template',
          'systemPrompt',
          'script',
          'expression',
          'bodyContent',
          'query',
        ];

        for (const field of textFieldsToScan) {
          const textVal = config[field];
          if (typeof textVal === 'string' && textVal.length > 0) {
            let sanitizedText = textVal;

            // 1. Built-in [SECRET_*] and {{SECRET_*}} patterns
            sanitizedText = sanitizedText.replace(SENSITIVE_PROMPT_VAR_RE, (match) => {
              maskedPromptVarsCount++;
              details.push({
                nodeId,
                nodeType,
                field: `config.${field}`,
                type: 'promptVar',
                action: 'masked',
                originalSnippet: match,
              });
              return '[MASKED_SECRET]';
            });

            // 2. Custom secret patterns
            for (const pattern of customSecretPatterns) {
              const regex =
                typeof pattern === 'string'
                  ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
                  : pattern;
              sanitizedText = sanitizedText.replace(regex, (match) => {
                maskedPromptVarsCount++;
                details.push({
                  nodeId,
                  nodeType,
                  field: `config.${field}`,
                  type: 'promptVar',
                  action: 'masked',
                  originalSnippet: match,
                });
                return '[MASKED_SECRET]';
              });
            }

            config[field] = sanitizedText;
          }
        }
      }

      // C. Strip Absolute Local File Paths
      if (stripLocalPaths) {
        // Direct local path config fields (e.g. localPath, filePath)
        const pathFields = [
          'localPath',
          'filePath',
          'documentPath',
          'absolutePath',
          'sourcePath',
          'baseDir',
        ];
        for (const pf of pathFields) {
          const pVal = config[pf];
          if (typeof pVal === 'string' && pVal.trim() !== '') {
            const hasWinPath = WINDOWS_ABSOLUTE_PATH_RE.test(pVal);
            WINDOWS_ABSOLUTE_PATH_RE.lastIndex = 0;
            const hasPosixPath = POSIX_ABSOLUTE_PATH_RE.test(pVal);
            POSIX_ABSOLUTE_PATH_RE.lastIndex = 0;

            if (hasWinPath || hasPosixPath) {
              const filename = pVal.split(/[/\\]/).pop() || '';
              config[pf] = filename ? `${pathPlaceholder}/${filename}` : pathPlaceholder;
              strippedLocalPathsCount++;
              details.push({
                nodeId,
                nodeType,
                field: `config.${pf}`,
                type: 'localPath',
                action: 'stripped',
                originalSnippet: pVal,
              });
            }
          }
        }

        // Scan all other string values in config for embedded absolute paths
        for (const [cKey, cVal] of Object.entries(config)) {
          if (pathFields.includes(cKey)) continue;
          if (typeof cVal === 'string' && cVal.length > 0) {
            let replacedVal = cVal;

            replacedVal = replacedVal.replace(WINDOWS_ABSOLUTE_PATH_RE, (match) => {
              strippedLocalPathsCount++;
              details.push({
                nodeId,
                nodeType,
                field: `config.${cKey}`,
                type: 'localPath',
                action: 'stripped',
                originalSnippet: match,
              });
              const filename = match.split(/[/\\]/).pop() || '';
              return filename ? `${pathPlaceholder}/${filename}` : pathPlaceholder;
            });

            replacedVal = replacedVal.replace(POSIX_ABSOLUTE_PATH_RE, (match) => {
              strippedLocalPathsCount++;
              details.push({
                nodeId,
                nodeType,
                field: `config.${cKey}`,
                type: 'localPath',
                action: 'stripped',
                originalSnippet: match,
              });
              const filename = match.split(/[/\\]/).pop() || '';
              return filename ? `${pathPlaceholder}/${filename}` : pathPlaceholder;
            });

            config[cKey] = replacedVal;
          }
        }
      }

      // D. Clear Historical Execution Outputs
      if (clearExecutionOutputs) {
        nodeData['outputs'] = {};
        nodeData['status'] = 'idle';
        delete nodeData['executionResult'];
        delete nodeData['streamingOutput'];
        delete nodeData['streamingReasoning'];
      }
    }
  }

  const totalSanitizedCount =
    strippedApiKeysCount + maskedPromptVarsCount + strippedLocalPathsCount;

  return {
    sanitizedWorkflow: cloned as unknown as T,
    stats: {
      strippedApiKeysCount,
      maskedPromptVarsCount,
      strippedLocalPathsCount,
      totalSanitizedCount,
      details,
    },
  };
}

/**
 * Formats a sanitized workflow as a JSON string (.patchcat.json).
 */
export function exportSanitizedWorkflowJson<T extends SanitizableWorkflow = SavedWorkflow>(
  workflow: T,
  options: SanitizedExportOptions = {},
  space = 2,
): string {
  const result = sanitizeWorkflow(workflow, options);
  return JSON.stringify(result.sanitizedWorkflow, null, space);
}

/**
 * Triggers a browser file download of the sanitized workflow in .patchcat.json format.
 */
export function downloadSanitizedWorkflow<T extends SanitizableWorkflow = SavedWorkflow>(
  workflow: T,
  filename?: string,
  options: SanitizedExportOptions = {},
): SanitizedWorkflowResult<T> {
  const result = sanitizeWorkflow(workflow, options);
  const jsonContent = JSON.stringify(result.sanitizedWorkflow, null, 2);

  if (typeof document !== 'undefined' && typeof Blob !== 'undefined') {
    const rawName =
      filename ||
      ('name' in workflow && typeof workflow['name'] === 'string' && workflow['name']
        ? (workflow['name'] as string)
        : 'id' in workflow && typeof workflow['id'] === 'string'
          ? (workflow['id'] as string)
          : 'workflow');

    const safeBaseName = rawName.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_');
    const finalFilename = safeBaseName.endsWith('.patchcat.json')
      ? safeBaseName
      : `${safeBaseName}.patchcat.json`;

    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = finalFilename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  return result;
}
