import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BrowserWorkflowEngine } from "../src/engine/browser-engine.ts";
import { getDefaultNodeConfig, getDefaultNodeLabel } from "../src/engine/types.ts";
import type { WorkflowNode, WorkflowEdge, ExecutionEvent, AgentNodeConfig } from "../src/engine/types.ts";

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

describe("Phase 4: Agent, Tool Calling & Iteration Engine Verification", () => {
  describe("1. Agent Node Default Config & Label Specifications", () => {
    it("provides valid default config for agent node", () => {
      const config = getDefaultNodeConfig("agent") as AgentNodeConfig;
      assert.ok(typeof config.systemPrompt === "string" && config.systemPrompt.length > 0);
      assert.ok(Array.isArray(config.tools));
      assert.strictEqual(config.maxIterations, 10);
      assert.strictEqual(config.temperature, 0.7);
    });

    it("provides valid default config for loop and sub_workflow nodes", () => {
      const loopConfig = getDefaultNodeConfig("loop") as any;
      assert.strictEqual(loopConfig.inputArrayVariable, "");
      assert.strictEqual(loopConfig.maxConcurrency, 1);
      assert.strictEqual(loopConfig.itemTimeoutMs, 30000);

      const subWfConfig = getDefaultNodeConfig("sub_workflow") as any;
      assert.strictEqual(subWfConfig.targetWorkflowId, "");
      assert.deepStrictEqual(subWfConfig.inputMapping, {});
      assert.deepStrictEqual(subWfConfig.outputMapping, {});
    });

    it("provides human-readable labels for new nodes", () => {
      assert.strictEqual(getDefaultNodeLabel("agent"), "AI Agent");
      assert.strictEqual(getDefaultNodeLabel("loop"), "Loop Iterator");
      assert.strictEqual(getDefaultNodeLabel("sub_workflow"), "Sub-Workflow");
    });
  });

  describe("2. Agent Node Flow Execution (Validation & Mock Mode)", () => {
    it("executes agent node in simulated validation mode without API keys", async () => {
      const agentNode = makeNode("agent_1", "agent", {
        prompt: "Calculate total revenue after 15% tax deduction",
      }, {
        systemPrompt: "You are a calculation agent.",
        tools: [
          {
            id: "t_calc",
            name: "calculate",
            description: "Math calculation tool",
            type: "builtin_code",
            implementation: "return { res: 100 * 0.85 };",
            schema: {},
          },
        ],
        maxIterations: 5,
      });

      const engine = new BrowserWorkflowEngine();
      const events = await collectEvents(
        engine.executeWorkflow(
          { nodes: [agentNode], edges: [] },
          { skipLLM: true }
        )
      );

      const completeEv = events.find((e) => e.type === "WORKFLOW_COMPLETE");
      assert.ok(completeEv, "WORKFLOW_COMPLETE event must be emitted");

      const nodeCompleteEv = events.find(
        (e) => e.type === "NODE_COMPLETE" && (e.payload as any).nodeId === "agent_1"
      );
      assert.ok(nodeCompleteEv, "NODE_COMPLETE event must be emitted for agent_1");
      const output = (nodeCompleteEv.payload as any).output;
      assert.ok(output.response.includes("Simulated agent execution"));
      assert.strictEqual(output.iterations, 1);
    });

    it("runs complete E2E topology: Input -> Agent -> Output", async () => {
      const inputNode = makeNode("in_1", "input", {
        query: "What is 450 * 7.25?",
      });

      const agentNode = makeNode("agent_1", "agent", {
        prompt: "{{in_1.query}}",
      }, {
        systemPrompt: "Solve arithmetic questions accurately.",
        tools: [],
        maxIterations: 6,
      });

      const outputNode = makeNode("out_1", "output", {
        agentAnswer: "{{agent_1.response}}",
      });

      const edges: WorkflowEdge[] = [
        { id: "e1", source: "in_1", target: "agent_1", sourceHandle: "out", targetHandle: "in" },
        { id: "e2", source: "agent_1", target: "out_1", sourceHandle: "out", targetHandle: "in" },
      ];

      const engine = new BrowserWorkflowEngine();
      const events = await collectEvents(
        engine.executeWorkflow(
          { nodes: [inputNode, agentNode, outputNode], edges },
          { skipLLM: true }
        )
      );

      const nodeStarts = events.filter((e) => e.type === "NODE_START");
      assert.strictEqual(nodeStarts.length, 3);
      assert.strictEqual((nodeStarts[0].payload as any).nodeId, "in_1");
      assert.strictEqual((nodeStarts[1].payload as any).nodeId, "agent_1");
      assert.strictEqual((nodeStarts[2].payload as any).nodeId, "out_1");

      const completeEv = events.find((e) => e.type === "WORKFLOW_COMPLETE");
      assert.ok(completeEv);
      const outputs = (completeEv.payload as any).outputs;
      assert.ok(outputs.out_1);
    });
  });

  describe("3. Loop Iterator Node Execution", () => {
    it("processes array variables and returns indexed result set", async () => {
      const inputNode = makeNode("in_list", "input", {
        data: ["alpha", "beta", "gamma"],
      });

      const loopNode = makeNode("loop_1", "loop", {
        items: "{{in_list.data}}",
      }, {
        inputArrayVariable: "items",
        maxConcurrency: 2,
      });

      const edges: WorkflowEdge[] = [
        { id: "e1", source: "in_list", target: "loop_1", sourceHandle: "out", targetHandle: "in" },
      ];

      const engine = new BrowserWorkflowEngine();
      const events = await collectEvents(
        engine.executeWorkflow(
          { nodes: [inputNode, loopNode], edges },
          { skipLLM: true }
        )
      );

      const nodeCompleteEv = events.find(
        (e) => e.type === "NODE_COMPLETE" && (e.payload as any).nodeId === "loop_1"
      );
      assert.ok(nodeCompleteEv);
      const output = (nodeCompleteEv.payload as any).output;
      assert.strictEqual(output.totalItems, 3);
      assert.strictEqual(output.results.length, 3);
      assert.strictEqual(output.results[0].item, "alpha");
      assert.strictEqual(output.results[1].item, "beta");
      assert.strictEqual(output.results[2].item, "gamma");
    });

    it("safely handles JSON string arrays or empty fallbacks", async () => {
      const loopNode = makeNode("loop_str", "loop", {
        items: JSON.stringify(["doc1.pdf", "doc2.pdf"]),
      }, {
        inputArrayVariable: "items",
      });

      const engine = new BrowserWorkflowEngine();
      const events = await collectEvents(
        engine.executeWorkflow(
          { nodes: [loopNode], edges: [] },
          { skipLLM: true }
        )
      );

      const nodeComplete = events.find(
        (e) => e.type === "NODE_COMPLETE" && (e.payload as any).nodeId === "loop_str"
      );
      assert.ok(nodeComplete);
      const output = (nodeComplete.payload as any).output;
      assert.strictEqual(output.totalItems, 2);
    });
  });

  describe("4. Sub-Workflow Node Execution", () => {
    it("executes sub_workflow stub and retains target reference", async () => {
      const subWfNode = makeNode("sub_1", "sub_workflow", {
        param1: "invoice_992",
      }, {
        targetWorkflowId: "wf-financial-audit",
      });

      const engine = new BrowserWorkflowEngine();
      const events = await collectEvents(
        engine.executeWorkflow(
          { nodes: [subWfNode], edges: [] },
          { skipLLM: true }
        )
      );

      const nodeComplete = events.find(
        (e) => e.type === "NODE_COMPLETE" && (e.payload as any).nodeId === "sub_1"
      );
      assert.ok(nodeComplete);
      const output = (nodeComplete.payload as any).output;
      assert.strictEqual(output.targetWorkflowId, "wf-financial-audit");
      assert.ok(output.result.includes("wf-financial-audit"));
    });
  });
});