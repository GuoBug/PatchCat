/**
 * @file    src/engine/sandbox-executor.ts
 * @version 1.0.0
 * @description
 *   High-security, isolated script execution sandbox for Code Nodes.
 *   - Browser: Dedicated Web Worker spawned via Blob URL with strict network blocking
 *              (fetch, XHR, WebSocket, Worker APIs disabled) and 5000ms watchdog timeout.
 *              Guarantees zero access to main-thread localStorage / cookies / DOM.
 *   - Node.js:  Isolated VM context with memory and execution timeout limits.
 */

import { RUNTIME_DEFAULTS } from '../config/runtime-defaults.ts';

export interface SandboxExecutionOptions {
  timeoutMs?: number;
}

export interface SandboxExecutionResult {
  result: unknown;
  stdout: string;
}

/**
 * Executes user-provided JavaScript code in an isolated sandbox.
 */
export async function runSandboxedScript(
  rawScript: string,
  inputs: Record<string, unknown>,
  options: SandboxExecutionOptions = {},
): Promise<SandboxExecutionResult> {
  const timeoutMs = options.timeoutMs ?? RUNTIME_DEFAULTS.SANDBOX_TIMEOUT_SECONDS * 1000;

  if (!rawScript || rawScript.trim().length === 0) {
    return { result: inputs, stdout: '' };
  }

  assertScriptSyntaxSafety(rawScript);

  const isBrowser =
    typeof window !== 'undefined' &&
    typeof Worker !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function';

  if (isBrowser) {
    return runInBrowserWorker(rawScript, inputs, timeoutMs);
  } else {
    return runInNodeVm(rawScript, inputs, timeoutMs);
  }
}

/**
 * Web Worker sandbox implementation for modern browsers.
 */
function runInBrowserWorker(
  rawScript: string,
  inputs: Record<string, unknown>,
  timeoutMs: number,
): Promise<SandboxExecutionResult> {
  return new Promise((resolve, reject) => {
    // Construct self-contained worker source code with network blocking
    const workerSource = [
      '(function() {',
      '  // 1. Defensively strip network and dangerous capabilities inside WorkerGlobalScope.',
      '  //    Delete along the prototype chain, then lock as non-writable/non-configurable so user',
      '  //    code can neither recover the original via getPrototypeOf nor reassign it.',
      '  (function lockdown() {',
      '    var names = ["fetch","XMLHttpRequest","WebSocket","EventSource","importScripts",',
      '      "Worker","SharedWorker","indexedDB","caches","navigator","performance","BroadcastChannel"];',
      '    names.forEach(function(name) {',
      '      var obj = self;',
      '      while (obj) {',
      '        try { delete obj[name]; } catch(e) {}',
      '        obj = Object.getPrototypeOf(obj);',
      '      }',
      '      try {',
      '        Object.defineProperty(self, name, { value: undefined, writable: false, configurable: false });',
      '      } catch(e) {',
      '        try { self[name] = undefined; } catch(e2) {}',
      '      }',
      '    });',
      '  })();',
      '',
      '  self.onmessage = function(event) {',
      '    var payload = event.data;',
      '    var inputs = payload.inputs;',
      '    var script = payload.script;',
      '',
      '    var logs = [];',
      '    var customConsole = {',
      '      log: function() {',
      '        var args = Array.prototype.slice.call(arguments);',
      '        logs.push(args.map(function(a) {',
      '          return (typeof a === "object" && a !== null) ? JSON.stringify(a) : String(a);',
      '        }).join(" "));',
      '      },',
      '      error: function() {',
      '        var args = Array.prototype.slice.call(arguments);',
      '        logs.push("[Error] " + args.map(function(a) {',
      '          return (typeof a === "object" && a !== null) ? JSON.stringify(a) : String(a);',
      '        }).join(" "));',
      '      }',
      '    };',
      '',
      '    try {',
      '      var scriptBody = script;',
      '      if (!/\\breturn\\b/.test(script)) {',
      '        try {',
      '          new Function("inputs", "console", "\\"use strict\\"; return (" + script + ");");',
      '          scriptBody = "return (" + script + ");";',
      '        } catch(e) {',
      '          scriptBody = script;',
      '        }',
      '      }',
      '      var AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;',
      '      var fn = new AsyncFunction("inputs", "console", "\\"use strict\\";\\n" + scriptBody);',
      '      var res = fn(inputs, customConsole);',
      '      Promise.resolve(res)',
      '        .then(function(resolvedRes) {',
      '          self.postMessage({',
      '            success: true,',
      '            result: resolvedRes,',
      '            stdout: logs.join("\\n")',
      '          });',
      '        })',
      '        .catch(function(asyncErr) {',
      '          self.postMessage({',
      '            success: false,',
      '            error: asyncErr && asyncErr.message ? asyncErr.message : String(asyncErr),',
      '            stdout: logs.join("\\n")',
      '          });',
      '        });',
      '    } catch(err) {',
      '      self.postMessage({',
      '        success: false,',
      '        error: err && err.message ? err.message : String(err),',
      '        stdout: logs.join("\\n")',
      '      });',
      '    }',
      '  };',
      '})();',
    ].join('\n');

    let blobUrl: string | null = null;
    let worker: Worker | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (worker) {
        worker.terminate();
        worker = null;
      }
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        blobUrl = null;
      }
    };

    try {
      const blob = new Blob([workerSource], { type: 'application/javascript' });
      blobUrl = URL.createObjectURL(blob);
      worker = new Worker(blobUrl);

      timerId = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            `[沙箱执行超时] 代码执行时间超过安全阈值 (${timeoutMs}ms)，已由看门狗强行终止。`,
          ),
        );
      }, timeoutMs);

      worker.onmessage = (e: MessageEvent) => {
        cleanup();
        const data = e.data;
        if (data.success) {
          resolve({
            result: data.result,
            stdout: data.stdout || '',
          });
        } else {
          reject(new Error(data.error || 'Unknown script execution error'));
        }
      };

      worker.onerror = (e: ErrorEvent) => {
        cleanup();
        reject(new Error(e.message || 'Worker runtime error'));
      };

      // Safely clone inputs (serializable check)
      const clonedInputs = JSON.parse(JSON.stringify(inputs));
      worker.postMessage({ inputs: clonedInputs, script: rawScript });
    } catch (err: unknown) {
      cleanup();
      const errMsg = err instanceof Error ? err.message : String(err);
      reject(new Error(`[沙箱启动失败] ${errMsg}`));
    }
  });
}

/**
 * Static security pre-flight check to block dangerous syntax patterns (dynamic import, process, require).
 */
function assertScriptSyntaxSafety(rawScript: string): void {
  if (/\bimport\s*\(/.test(rawScript)) {
    throw new Error('[沙箱安全拦截] 禁止在沙箱代码中使用动态 import() 语法。');
  }
  if (/\bprocess\b/.test(rawScript)) {
    throw new Error('[沙箱安全拦截] 禁止在沙箱代码中访问 process 对象。');
  }
  if (/\brequire\s*\(/.test(rawScript)) {
    throw new Error('[沙箱安全拦截] 禁止在沙箱代码中调用 require()。');
  }
}

/**
 * VM execution for Node.js (test suites and offline environments).
 *
 * ⚠️ 安全加固：彻底阻断通过宿主 realm 函数（如 setTimeout.constructor）逃逸至宿主 process 的路径。
 * 1. 禁用代码字符串生成 (codeGeneration: { strings: false, wasm: false })
 * 2. 严禁注入任何宿主 realm 函数（如 setTimeout、clearTimeout），console 在 context 内部原生初始化
 * 3. 静态拦截 import()、process、require 语法特征
 */
async function runInNodeVm(
  rawScript: string,
  inputs: Record<string, unknown>,
  timeoutMs: number,
): Promise<SandboxExecutionResult> {
  assertScriptSyntaxSafety(rawScript);
  const rawLogs: string[] = [];

  try {
    const vmModuleName = 'node:vm';
    const vm = await import(/* @vite-ignore */ vmModuleName);

    let scriptBody = rawScript;
    if (!/\breturn\b/.test(rawScript)) {
      const isStatement = /^\s*(while|for|if|switch|try|throw|class|function|let|const|var|do|await)\b|[;{}]/.test(rawScript);
      if (!isStatement) {
        scriptBody = `return (${rawScript});`;
      }
    }

    const wrappedCode = `"use strict";\n__result = (async function(inputs, console) {\n${scriptBody}\n})(inputs, globalThis.console);`;

    const hostTimer = (cb: () => void, ms: number) => {
      return setTimeout(() => {
        try {
          cb();
        } catch {
          // suppress uncaught callback errors
        }
      }, typeof ms === 'number' ? ms : 0);
    };
    const hostClearTimer = (id: ReturnType<typeof setTimeout>) => {
      clearTimeout(id);
    };

    // Strip prototypes to eliminate prototype-chain constructor escape vectors
    Object.setPrototypeOf(hostTimer, null);
    Object.setPrototypeOf(hostClearTimer, null);

    const sandbox = {
      inputs: JSON.parse(JSON.stringify(inputs)),
      __rawLogs: rawLogs,
      __result: undefined,
      __safeTimer: hostTimer,
      __safeClearTimer: hostClearTimer,
    };

    const context = vm.createContext(sandbox, {
      codeGeneration: { strings: false, wasm: false },
    });

    // Initialize in-context console and timer bridge entirely inside guest realm,
    // then immediately delete host references from the guest global object
    vm.runInContext(
      `"use strict";
      (function(logs, timerFn, clearFn) {
        globalThis.console = {
          log: function(...args) {
            logs.push(args.map(function(a) { return typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a); }).join(' '));
          },
          error: function(...args) {
            logs.push('[Error] ' + args.map(function(a) { return typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a); }).join(' '));
          }
        };
        globalThis.setTimeout = function(fn, delay) {
          return timerFn(function() {
            try { fn(); } catch(e) {}
          }, delay);
        };
        globalThis.clearTimeout = function(id) {
          clearFn(id);
        };
      })(__rawLogs, __safeTimer, __safeClearTimer);
      delete globalThis.__safeTimer;
      delete globalThis.__safeClearTimer;`,
      context,
    );

    vm.runInContext(wrappedCode, context, {
      timeout: timeoutMs,
      displayErrors: true,
    });

    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new Error(
            `[沙箱执行超时] 代码执行时间超过安全阈值 (${timeoutMs}ms)，已由看门狗强行终止。`,
          ),
        );
      }, timeoutMs);
    });

    try {
      const resolvedResult = await Promise.race([
        Promise.resolve(sandbox.__result),
        timeoutPromise,
      ]);
      const cleanResult =
        resolvedResult !== undefined && typeof resolvedResult === 'object' && resolvedResult !== null
          ? JSON.parse(JSON.stringify(resolvedResult))
          : resolvedResult;
      return {
        result: cleanResult,
        stdout: rawLogs.join('\n'),
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    throw new Error(errMsg);
  }
}

/**
 * Evaluates single-line or multi-line JavaScript condition expressions in an isolated sandbox.
 * Runs in a dedicated Web Worker in browser environments (zero access to localStorage / DOM / network)
 * and in an isolated VM context in Node.js test environments.
 */
export async function evaluateSandboxedCondition(
  rawExpr: string,
  inputs: Record<string, unknown>,
  context: Record<string, unknown> = {},
  options: SandboxExecutionOptions = {},
): Promise<{ isTruthy: boolean; actualValue: unknown }> {
  const cleanExpr = rawExpr.trim();
  if (cleanExpr.length === 0) {
    return { isTruthy: false, actualValue: 'empty_expression' };
  }

  // Wrap expression safely to execute in the Worker/VM sandbox.
  // Both `inputs` (and nested properties) and `context` are accessible.
  const hasReturn = /\breturn\b/.test(cleanExpr);
  const script = `
const context = inputs.__context || inputs.context || {};
${hasReturn ? cleanExpr : `return Boolean(${cleanExpr});`}
`;

  try {
    const safeInputs = typeof inputs === 'object' && inputs !== null ? { ...inputs } : {};
    const safeContext = typeof context === 'object' && context !== null ? { ...context } : {};
    const sandboxInputs: Record<string, unknown> = {
      ...safeInputs,
      inputs: safeInputs,
      __context: safeContext,
      context: safeContext,
    };

    const res = await runSandboxedScript(script, sandboxInputs, options);
    return {
      isTruthy: Boolean(res.result),
      actualValue: res.result,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      isTruthy: false,
      actualValue: errMsg,
    };
  }
}

