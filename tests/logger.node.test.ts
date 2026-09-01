/**
 * @file    tests/logger.node.test.ts
 * @description
 *   Unit test suite for the Multi-Level Logging Engine and Security Sanitization:
 *   1. Strict credential & secret sanitization (API keys, Google keys, Bearer tokens, passwords).
 *   2. Multi-level filtering (Summary vs Detailed vs Dev).
 *   3. Pub/Sub subscription and event emission.
 *   4. Formatted exports (JSON and Text).
 *   5. Circular reference safety in payload objects.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { LoggerEngine, sanitizeData, type LogEntry } from '../src/engine/logger.ts';

describe('Logger Security Sanitization', () => {
  it('should mask OpenAI API key strings', () => {
    const raw = 'Request sent with key sk-proj-1234567890abcdef1234567890 to endpoint';
    const sanitized = sanitizeData(raw);
    assert.match(sanitized as string, /sk-proj\*\*\*\[MASKED\]\*\*\*7890/);
    assert.doesNotMatch(sanitized as string, /abcdef/);
  });

  it('should mask Google AI Studio API key strings', () => {
    const raw = 'Using Google key AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7';
    const sanitized = sanitizeData(raw);
    assert.match(sanitized as string, /AIzaSyA1B2\*\*\*\[MASKED\]\*\*\*P6Q7/);
    assert.doesNotMatch(sanitized as string, /C3D4E5F6G7H8/);
  });

  it('should mask Bearer authorization tokens in strings', () => {
    const raw = 'Header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const sanitized = sanitizeData(raw);
    assert.match(sanitized as string, /Bearer \*\*\*\[MASKED\]\*\*\*/);
    assert.doesNotMatch(sanitized as string, /eyJhbGci/);
  });

  it('should recursively mask sensitive keys in nested objects and arrays', () => {
    const payload = {
      model: 'gemini-2.5-flash',
      apiKey: 'sk-1234567890abcdef',
      nested: {
        authorization: 'Bearer secret_token_xyz',
        password: 'my_super_secret_password',
        user_tier: 'VIP',
      },
      headers: [
        { 'x-goog-api-key': 'AIzaSySecretGoogleKey12345' },
        { 'Content-Type': 'application/json' },
      ],
    };

    const sanitized = sanitizeData(payload) as any;

    assert.equal(sanitized.model, 'gemini-2.5-flash');
    assert.equal(sanitized.nested.user_tier, 'VIP');
    assert.equal(sanitized.headers[1]['Content-Type'], 'application/json');

    // Sensitive keys must be masked
    assert.match(sanitized.apiKey, /\*\*\*\[MASKED\]\*\*\*/);
    assert.match(sanitized.nested.authorization, /\*\*\*\[MASKED\]\*\*\*/);
    assert.match(sanitized.nested.password, /\*\*\*\[MASKED\]\*\*\*/);
    assert.match(sanitized.headers[0]['x-goog-api-key'], /\*\*\*\[MASKED\]\*\*\*/);

    assert.doesNotMatch(JSON.stringify(sanitized), /my_super_secret_password/);
    assert.doesNotMatch(JSON.stringify(sanitized), /secret_token_xyz/);
  });

  it('should safely handle circular references without infinite loops', () => {
    const circular: any = { name: 'WorkflowContext' };
    circular.self = circular;

    const sanitized = sanitizeData(circular) as any;
    assert.equal(sanitized.name, 'WorkflowContext');
    assert.equal(sanitized.self, '[Circular Reference]');
  });
});

describe('LoggerEngine Multi-Level Logging', () => {
  let logger: LoggerEngine;

  beforeEach(() => {
    logger = new LoggerEngine('detailed');
  });

  it('should filter logs according to level: Summary level ignores Detailed and Dev', () => {
    logger.setLogLevel('summary');

    logger.summary('System', 'Workflow started');
    logger.detailed('DAG', 'Executing wave 1', { nodes: ['n1', 'n2'] });
    logger.dev('LLM', 'Prompt content', { inputs: { prompt: 'hello' } });
    logger.error('System', 'A fatal error occurred');

    const logs = logger.getLogs();
    assert.equal(logs.length, 2);
    assert.equal(logs[0].message, 'Workflow started');
    assert.equal(logs[1].message, 'A fatal error occurred');
  });

  it('should record Summary and Detailed when level is Detailed, ignoring Dev', () => {
    logger.setLogLevel('detailed');

    logger.summary('System', 'Workflow started');
    logger.detailed('DAG', 'Executing wave 1', { nodes: ['n1'] });
    logger.dev('LLM', 'Prompt content', { inputs: { prompt: 'hello' } });

    const logs = logger.getLogs();
    assert.equal(logs.length, 2);
    assert.equal(logs[0].level, 'summary');
    assert.equal(logs[1].level, 'detailed');
  });

  it('should record all levels when level is Dev (with sanitized inputs and outputs)', () => {
    logger.setLogLevel('dev');

    logger.summary('System', 'Workflow started');
    logger.detailed('DAG', 'Executing wave 1');
    logger.dev(
      'LLM',
      'Prompt execution payload',
      {
        inputs: { apiKey: 'sk-secret12345', query: 'Translate this' },
        outputs: { response: 'Translated text' },
      },
      { model: 'gemini-2.5-flash' },
      'llm_node_1'
    );

    const logs = logger.getLogs();
    assert.equal(logs.length, 3);
    const devLog = logs[2];
    assert.equal(devLog.level, 'dev');
    assert.equal(devLog.nodeId, 'llm_node_1');
    assert.equal((devLog.data?.outputs as any).response, 'Translated text');
    // Ensure apiKey inside dev inputs is sanitized
    assert.match((devLog.data?.inputs as any).apiKey, /\*\*\*\[MASKED\]\*\*\*/);
  });

  it('should notify subscribers when new logs are added', () => {
    logger.setLogLevel('detailed');
    const received: LogEntry[] = [];

    const unsubscribe = logger.subscribe((entry) => {
      received.push(entry);
    });

    logger.summary('Test', 'Msg 1');
    logger.detailed('Test', 'Msg 2');
    unsubscribe();
    logger.summary('Test', 'Msg 3');

    assert.equal(received.length, 2);
    assert.equal(received[0].message, 'Msg 1');
    assert.equal(received[1].message, 'Msg 2');
  });

  it('should format logs correctly for JSON and Text export', () => {
    logger.setLogLevel('dev');
    logger.summary('Engine', 'Run started');
    logger.dev('Node', 'Node data', { inputs: { test: 123 } });

    const jsonExport = logger.exportAsJson();
    const parsed = JSON.parse(jsonExport);
    assert.equal(parsed.totalEntries, 2);
    assert.equal(parsed.logs.length, 2);

    const textExport = logger.exportAsText();
    assert.ok(textExport.includes('PATCHCAT WORKFLOW EXECUTION LOGS'));
    assert.ok(textExport.includes('Run started'));
    assert.ok(textExport.includes('Node data'));
  });
});
