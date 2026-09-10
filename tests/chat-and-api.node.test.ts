import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { useWorkflowStore } from "../src/stores/workflow-store.ts";
import { getDefaultNodeConfig } from "../src/engine/types.ts";

describe("Phase 3: Interactive Chat Debug & API Publishing State", () => {
  it("initializes workflow store with condition, aggregator, and http node creation support", () => {
    const initialCount = useWorkflowStore.getState().nodes.length;

    useWorkflowStore.getState().addNode("condition", { x: 100, y: 100 });
    let currentNodes = useWorkflowStore.getState().nodes;
    assert.strictEqual(currentNodes.length, initialCount + 1);
    const condNode = currentNodes[currentNodes.length - 1];
    assert.strictEqual(condNode.type, "condition");
    assert.ok(condNode.data.config);

    useWorkflowStore.getState().addNode("aggregator", { x: 200, y: 200 });
    currentNodes = useWorkflowStore.getState().nodes;
    assert.strictEqual(currentNodes.length, initialCount + 2);
    const aggNode = currentNodes[currentNodes.length - 1];
    assert.strictEqual(aggNode.type, "aggregator");

    useWorkflowStore.getState().addNode("http", { x: 300, y: 300 });
    currentNodes = useWorkflowStore.getState().nodes;
    assert.strictEqual(currentNodes.length, initialCount + 3);
    const httpNode = currentNodes[currentNodes.length - 1];
    assert.strictEqual(httpNode.type, "http");
  });

  it("getDefaultNodeConfig returns complete schema for Phase 3 nodes", () => {
    const condCfg = getDefaultNodeConfig("condition") as any;
    assert.ok(Array.isArray(condCfg.conditions));
    assert.strictEqual(condCfg.defaultBranch, "else");

    const aggCfg = getDefaultNodeConfig("aggregator") as any;
    assert.strictEqual(aggCfg.mode, "first_available");
    assert.strictEqual(aggCfg.outputKey, "result");

    const httpCfg = getDefaultNodeConfig("http") as any;
    assert.strictEqual(httpCfg.method, "GET");
    assert.strictEqual(httpCfg.timeout, 30000);
    assert.strictEqual(httpCfg.retryConfig.maxRetries, 1);
  });

  it("updates node data and config reactively in store", () => {
    useWorkflowStore.getState().addNode("http", { x: 0, y: 0 });
    const nodes = useWorkflowStore.getState().nodes;
    const added = nodes[nodes.length - 1];

    useWorkflowStore.getState().updateNodeConfig(added.id, {
      url: "https://api.test.com/data",
      method: "POST",
    });

    const updated = useWorkflowStore.getState().nodes.find((n) => n.id === added.id);
    assert.ok(updated);
    assert.strictEqual(updated.data.config.url, "https://api.test.com/data");
    assert.strictEqual(updated.data.config.method, "POST");
  });

  it("injects runtime options.inputs dynamically into Input node execution context", async () => {
    const { BrowserWorkflowEngine } = await import("../src/engine/browser-engine.ts");
    const engine = new BrowserWorkflowEngine();

    const graph = {
      nodes: [
        {
          id: "input_ticket",
          type: "input" as const,
          position: { x: 0, y: 0 },
          data: {
            label: "Ticket Input",
            inputs: {
              category: "technical",
              query: "Default database issue",
            },
          },
        },
        {
          id: "cond_router",
          type: "condition" as const,
          position: { x: 200, y: 0 },
          data: {
            label: "Router",
            config: {
              conditions: [
                {
                  id: "case_tech",
                  variable: "{{input_ticket.category}}",
                  operator: "equals",
                  value: "technical",
                  targetHandle: "case_tech",
                },
                {
                  id: "case_billing",
                  variable: "{{input_ticket.category}}",
                  operator: "equals",
                  value: "billing",
                  targetHandle: "case_billing",
                },
              ],
              defaultBranch: "else",
            },
          },
        },
      ],
      edges: [
        {
          id: "e1",
          source: "input_ticket",
          target: "cond_router",
          sourceHandle: "output",
          targetHandle: "input",
        },
      ],
    };

    // Run 1: Default execution without override -> category should be 'technical' and hit case_tech
    let finalOutputs: Record<string, any> = {};
    for await (const event of engine.executeWorkflow(graph as any)) {
      if (event.type === "WORKFLOW_COMPLETE") {
        finalOutputs = event.payload.outputs;
      }
    }
    assert.strictEqual(finalOutputs["input_ticket"].category, "technical");
    assert.strictEqual(finalOutputs["cond_router"].activeBranch, "case_tech");

    // Run 2: Dynamic runtime injection with { category: "billing", query: "Refund question" }
    finalOutputs = {};
    const dynamicGen = engine.executeWorkflow(graph as any, {
      inputs: {
        category: "billing",
        query: "How to get a refund receipt?",
      },
    });
    for await (const event of dynamicGen) {
      if (event.type === "WORKFLOW_COMPLETE") {
        finalOutputs = event.payload.outputs;
      }
    }
    assert.strictEqual(finalOutputs["input_ticket"].category, "billing");
    assert.strictEqual(finalOutputs["input_ticket"].query, "How to get a refund receipt?");
    assert.strictEqual(finalOutputs["cond_router"].activeBranch, "case_billing");
  });
});
