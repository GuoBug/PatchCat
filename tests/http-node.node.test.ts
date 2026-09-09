import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BrowserWorkflowEngine } from "../src/engine/browser-engine.ts";
import { getDefaultNodeConfig } from "../src/engine/types.ts";
import type { WorkflowNode, WorkflowEdge, ExecutionEvent } from "../src/engine/types.ts";

async function collectEvents(generator: AsyncGenerator<ExecutionEvent>): Promise<ExecutionEvent[]> {
  const events: ExecutionEvent[] = [];
  for await (const ev of generator) {
    events.push(ev);
  }
  return events;
}

function makeNode(
  id: string,
  type: any,
  inputs: Record<string, unknown> = {},
  config: Record<string, unknown> = {},
): WorkflowNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: {
      label: id,
      type,
      status: "idle",
      inputs,
      outputs: {},
      config: { ...getDefaultNodeConfig(type), ...config },
    },
  };
}

describe("Phase 3: HTTP Node Engine & Security Verification", () => {
  it("rejects forbidden protocols (file:, javascript:, data:)", async () => {
    const forbiddenUrls = [
      "file:///etc/passwd",
      "javascript:alert(1)",
      "data:text/plain;base64,SGVsbG8=",
    ];

    for (const url of forbiddenUrls) {
      const node = makeNode("http_1", "http", {}, { url });
      const engine = new BrowserWorkflowEngine();
      const events = await collectEvents(engine.executeWorkflow({ nodes: [node], edges: [] }));

      const nodeErr = events.find((e) => e.type === "NODE_ERROR");
      assert.ok(nodeErr, `Expected NODE_ERROR for forbidden url ${url}`);
      assert.ok((nodeErr.payload as any).error.includes("Security Exception: Forbidden or unsafe URL protocol"));
    }
  });

  it("handles missing URL gracefully with error event", async () => {
    const node = makeNode("http_1", "http", {}, { url: "" });
    const engine = new BrowserWorkflowEngine();
    const events = await collectEvents(engine.executeWorkflow({ nodes: [node], edges: [] }));

    const nodeErr = events.find((e) => e.type === "NODE_ERROR");
    assert.ok(nodeErr);
    assert.ok((nodeErr.payload as any).error.includes("requires a valid URL"));
  });

  it("successfully bypasses HTTP request with mock payload when skipLLM is true", async () => {
    const node = makeNode("http_1", "http", {}, {
      url: "https://api.mock.internal/v1/weather",
      method: "GET",
    });

    const engine = new BrowserWorkflowEngine();
    const events = await collectEvents(
      engine.executeWorkflow(
        { nodes: [node], edges: [] },
        { skipLLM: true },
      ),
    );

    const comp = events.find((e) => e.type === "NODE_COMPLETE");
    assert.ok(comp);
    const out = (comp.payload as any).output;
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.data.mock, true);
    assert.strictEqual(out.data.weather, "Sunny");
  });

  it("correctly injects and resolves upstream variables in HTTP URL and query params", async () => {
    const nodes: WorkflowNode[] = [
      makeNode("input_1", "input", { city: "Tokyo", queryParam: "detailed" }),
      makeNode(
        "http_1",
        "http",
        { url: "https://api.mock.internal/v1/weather/{{input_1.city}}" },
        {
          method: "GET",
          queryParams: { view: "summary" },
        },
      ),
    ];

    const edges: WorkflowEdge[] = [
      { id: "e1", source: "input_1", target: "http_1" },
    ];

    const engine = new BrowserWorkflowEngine();
    const events = await collectEvents(
      engine.executeWorkflow(
        { nodes, edges },
        { skipLLM: true },
      ),
    );

    const comp = events.find((e) => e.type === "NODE_COMPLETE" && (e.payload as any).nodeId === "http_1");
    assert.ok(comp);
    const out = (comp.payload as any).output;
    assert.ok(out.data.url.includes("Tokyo"));
    assert.ok(out.data.url.includes("view=summary"));
  });

  it("emits proper latency and header telemetry", async () => {
    const node = makeNode("http_1", "http", {}, {
      url: "https://api.mock.internal/v1/status",
      method: "GET",
    });

    const engine = new BrowserWorkflowEngine();
    const events = await collectEvents(
      engine.executeWorkflow(
        { nodes: [node], edges: [] },
        { skipLLM: true },
      ),
    );

    const comp = events.find((e) => e.type === "NODE_COMPLETE");
    assert.ok(comp);
    const out = (comp.payload as any).output;
    assert.strictEqual(typeof out.latencyMs, "number");
    assert.ok(out.latencyMs >= 0);
  });
});
