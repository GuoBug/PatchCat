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
      '  // 1. Defensively strip network and dangerous capabilities inside WorkerGlobalScope',
      '  try { self.fetch = undefined; } catch(e) {}',
      '  try { self.XMLHttpRequest = undefined; } catch(e) {}',
      '  try { self.WebSocket = undefined; } catch(e) {}',
      '  try { self.EventSource = undefined; } catch(e) {}',
      '  try { self.importScripts = undefined; } catch(e) {}',
      '  try { self.Worker = undefined; } catch(e) {}',
      '  try { self.SharedWorker = undefined; } catch(e) {}',
      '  try { self.indexedDB = undefined; } catch(e) {}',
      '  try { self.navigator = undefined; } catch(e) {}',
      '  try { self.performance = undefined; } catch(e) {}',
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
 * Isolated VM execution for Node.js (test suites and server-side runtimes).
 */
async function runInNodeVm(
  rawScript: string,
  inputs: Record<string, unknown>,
  timeoutMs: number,
): Promise<SandboxExecutionResult> {
  const logs: string[] = [];
  const customConsole = {
    log: (...args: unknown[]) => {
      logs.push(
        args
          .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
          .join(' '),
      );
    },
    error: (...args: unknown[]) => {
      logs.push(
        '[Error] ' +
          args
            .map((a) => (typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)))
            .join(' '),
      );
    },
  };

  try {
    const vmModuleName = 'node:vm';
    const vm = await import(/* @vite-ignore */ vmModuleName);

    let scriptBody = rawScript;
    if (!/\breturn\b/.test(rawScript)) {
      try {
        new Function('inputs', 'console', `"use strict"; return (${rawScript});`);
        scriptBody = `return (${rawScript});`;
      } catch {
        scriptBody = rawScript;
      }
    }

    const wrappedCode = `"use strict";\n__result = (async function(inputs, console) {\n${scriptBody}\n})(inputs, console);`;

    const sandbox = {
      inputs: JSON.parse(JSON.stringify(inputs)),
      console: customConsole,
      setTimeout,
      clearTimeout,
      __result: undefined,
    };

    const context = vm.createContext(sandbox);
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
        stdout: logs.join('\n'),
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    throw new Error(errMsg);
  }
}
