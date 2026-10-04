import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BrowserWorkflowEngine, evaluateCondition } from "../src/engine/browser-engine.ts";
import { isUnsafeRegexPattern } from "../src/engine/regex-safety.ts";
import { getDefaultNodeConfig } from "../src/engine/types.ts";
import type { WorkflowNode, ExecutionEvent } from "../src/engine/types.ts";

async function collectEvents(generator: AsyncGenerator<ExecutionEvent>): Promise<ExecutionEvent[]> {
  const events: ExecutionEvent[] = [];
  for await (const ev of generator) events.push(ev);
  return events;
}

function makeHttpNode(config: Record<string, unknown>): WorkflowNode {
  return {
    id: "http_1",
    type: "http",
    position: { x: 0, y: 0 },
    data: {
      label: "http_1",
      type: "http",
      status: "idle",
      inputs: {},
      outputs: {},
      config: { ...getDefaultNodeConfig("http"), ...config },
    },
  } as WorkflowNode;
}

describe("Security hardening: HTTP node target restrictions", () => {
  const blocked = [
    "http://169.254.169.254/latest/meta-data/",
    "http://169.254.0.1/",
    "http://0.0.0.0:8080/",
    "http://metadata.google.internal/computeMetadata/v1/",
    "http://[fe80::1]/",
    "ftp://example.com/file",
  ];

  for (const url of blocked) {
    it(`rejects ${url}`, async () => {
      const engine = new BrowserWorkflowEngine();
      const events = await collectEvents(
        engine.executeWorkflow({ nodes: [makeHttpNode({ url })], edges: [] }),
      );
      const err = events.find((e) => e.type === "NODE_ERROR");
      assert.ok(err, `expected NODE_ERROR for ${url}`);
      assert.match((err.payload as any).error, /Security Exception/);
    });
  }

  it("still allows localhost (local-first use such as Ollama) past the URL guard", async () => {
    const engine = new BrowserWorkflowEngine();
    const events = await collectEvents(
      engine.executeWorkflow({
        nodes: [makeHttpNode({ url: "http://127.0.0.1:1/unreachable", timeout: 500 })],
        edges: [],
      }),
    );
    const err = events.find((e) => e.type === "NODE_ERROR");
    assert.ok(err);
    assert.doesNotMatch((err.payload as any).error, /Security Exception/);
  });

  it("aborts a hanging request via the node timeout", async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = ((_url: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted by signal")));
      })) as typeof fetch;
    try {
      const engine = new BrowserWorkflowEngine();
      const started = Date.now();
      const events = await collectEvents(
        engine.executeWorkflow({
          nodes: [makeHttpNode({ url: "https://example.org/slow", timeout: 150 })],
          edges: [],
        }),
      );
      assert.ok(Date.now() - started < 3000, "request should be cut off near the timeout");
      assert.ok(events.find((e) => e.type === "NODE_ERROR"));
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("applies api-key auth in query to the actual request URL", async () => {
    const realFetch = globalThis.fetch;
    let seenUrl = "";
    globalThis.fetch = (async (url: unknown) => {
      seenUrl = String(url);
      return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
    }) as typeof fetch;
    try {
      const engine = new BrowserWorkflowEngine();
      await collectEvents(
        engine.executeWorkflow({
          nodes: [
            makeHttpNode({
              url: "https://example.org/data",
              authType: "api-key",
              authConfig: { keyName: "k", keyValue: "v123", addTo: "query" },
            }),
          ],
          edges: [],
        }),
      );
      assert.match(seenUrl, /[?&]k=v123/);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe("Security hardening: ReDoS guard", () => {
  it("flags nested quantifiers and overlapping alternation", () => {
    for (const p of ["(a+)+$", "(a*)*b", "(a+){2,}", "(x|x)+", "(a|aa)+", "([a-z]+)*end"]) {
      assert.equal(isUnsafeRegexPattern(p), true, `should flag ${p}`);
    }
  });

  it("accepts ordinary patterns", () => {
    for (const p of ["^\\d{3}-\\d{4}$", "foo|bar", "^(yes|no)$", "[a-z]+@[a-z]+\\.com", "(ab)+"]) {
      assert.equal(isUnsafeRegexPattern(p), false, `should accept ${p}`);
    }
  });

  it("evaluateCondition returns fast and false for a catastrophic pattern", () => {
    const started = Date.now();
    const result = evaluateCondition(
      { id: "r", variable: "x", operator: "regex_match", value: "(a+)+$", targetHandle: "if_true" } as any,
      "a".repeat(40) + "!",
    );
    assert.equal(result, false);
    assert.ok(Date.now() - started < 200);
  });

  it("evaluateCondition still matches safe patterns", () => {
    const result = evaluateCondition(
      { id: "r", variable: "x", operator: "regex_match", value: "^order-\\d+$", targetHandle: "if_true" } as any,
      "ORDER-123",
    );
    assert.equal(result, true);
  });
});
