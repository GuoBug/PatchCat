import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateCondition, BrowserWorkflowEngine } from "../src/engine/browser-engine.ts";
import { getDefaultNodeConfig } from "../src/engine/types.ts";
import type { WorkflowNode, WorkflowEdge, ConditionRule, ExecutionEvent } from "../src/engine/types.ts";

async function collectEvents(generator: AsyncGenerator<ExecutionEvent>): Promise<ExecutionEvent[]> {
  const events: ExecutionEvent[] = [];
  for await (const ev of generator) {
    events.push(ev);
  }
  return events;
}

function makeRule(operator: any, value: string | number): ConditionRule {
  return {
    variable: "x",
    operator,
    value,
    targetHandle: "if_true",
  };
}

describe("Phase 3: Condition Node & Variable Aggregator Node", () => {
  describe("evaluateCondition Operator Rules", () => {
    it("evaluates equals operator correctly", () => {
      assert.strictEqual(evaluateCondition(makeRule("equals", "billing"), "billing"), true);
      assert.strictEqual(evaluateCondition(makeRule("equals", "100"), 100), true);
      assert.strictEqual(evaluateCondition(makeRule("equals", "tech"), "billing"), false);
    });

    it("evaluates not_equals operator correctly", () => {
      assert.strictEqual(evaluateCondition(makeRule("not_equals", "tech"), "billing"), true);
      assert.strictEqual(evaluateCondition(makeRule("not_equals", "billing"), "billing"), false);
    });

    it("evaluates contains operator correctly", () => {
      assert.strictEqual(evaluateCondition(makeRule("contains", "504"), "gateway timeout 504"), true);
      assert.strictEqual(evaluateCondition(makeRule("contains", "error"), "healthy"), false);
    });

    it("evaluates not_contains operator correctly", () => {
      assert.strictEqual(evaluateCondition(makeRule("not_contains", "error"), "ok"), true);
      assert.strictEqual(evaluateCondition(makeRule("not_contains", "error"), "server error"), false);
    });

    it("evaluates numeric comparisons (greater_than and less_than)", () => {
      assert.strictEqual(evaluateCondition(makeRule("greater_than", 40), 42), true);
      assert.strictEqual(evaluateCondition(makeRule("greater_than", 50), 42), false);
      assert.strictEqual(evaluateCondition(makeRule("less_than", 20), 10), true);
      assert.strictEqual(evaluateCondition(makeRule("less_than", 5), 10), false);
    });

    it("evaluates is_empty and is_not_empty correctly", () => {
      assert.strictEqual(evaluateCondition(makeRule("is_empty", ""), ""), true);
      assert.strictEqual(evaluateCondition(makeRule("is_empty", ""), null), true);
      assert.strictEqual(evaluateCondition(makeRule("is_empty", ""), undefined), true);
      assert.strictEqual(evaluateCondition(makeRule("is_empty", ""), "content"), false);

      assert.strictEqual(evaluateCondition(makeRule("is_not_empty", ""), "content"), true);
      assert.strictEqual(evaluateCondition(makeRule("is_not_empty", ""), ""), false);
      assert.strictEqual(evaluateCondition(makeRule("is_not_empty", ""), null), false);
    });

    it("evaluates regex_match correctly", () => {
      assert.strictEqual(evaluateCondition(makeRule("regex_match", "^[\\w.-]+@[\\w.-]+\\.[a-z]{2,}$"), "user@example.com"), true);
      assert.strictEqual(evaluateCondition(makeRule("regex_match", "^[\\w.-]+@[\\w.-]+\\.[a-z]{2,}$"), "invalid-email"), false);
    });
  });

  describe("Branch Routing & Skipping in BrowserWorkflowEngine", () => {
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

    it("routes to matching case and marks non-matching branch nodes as skipped", async () => {
      const nodes: WorkflowNode[] = [
        makeNode("input_1", "input", { category: "tech" }),
        makeNode(
          "cond_1",
          "condition",
          { category: "{{input_1.category}}" },
          {
            conditions: [
              {
                id: "rule_tech",
                variable: "category",
                operator: "equals",
                value: "tech",
                targetHandle: "case_tech",
              },
              {
                id: "rule_billing",
                variable: "category",
                operator: "equals",
                value: "billing",
                targetHandle: "case_billing",
              },
            ],
            defaultBranch: "case_general",
          },
        ),
        makeNode("prompt_tech", "prompt", { template: "Tech Prompt" }),
        makeNode("prompt_billing", "prompt", { template: "Billing Prompt" }),
        makeNode("prompt_general", "prompt", { template: "General Prompt" }),
        makeNode(
          "agg_1",
          "aggregator",
          {},
          { mode: "first_available", outputKey: "result" },
        ),
      ];

      const edges: WorkflowEdge[] = [
        { id: "e1", source: "input_1", target: "cond_1" },
        { id: "e2", source: "cond_1", sourceHandle: "case_tech", target: "prompt_tech" },
        { id: "e3", source: "cond_1", sourceHandle: "case_billing", target: "prompt_billing" },
        { id: "e4", source: "cond_1", sourceHandle: "case_general", target: "prompt_general" },
        { id: "e5", source: "prompt_tech", target: "agg_1" },
        { id: "e6", source: "prompt_billing", target: "agg_1" },
        { id: "e7", source: "prompt_general", target: "agg_1" },
      ];

      const engine = new BrowserWorkflowEngine();
      const events = await collectEvents(engine.executeWorkflow({ nodes, edges }));

      const finalEv = events.find((e) => e.type === "WORKFLOW_COMPLETE");
      assert.ok(finalEv);
      const outputs = (finalEv.payload as any).outputs;

      assert.strictEqual(outputs["prompt_tech"]?.promptText, "Tech Prompt");
      assert.strictEqual(outputs["prompt_billing"], undefined);
      assert.strictEqual(outputs["prompt_general"], undefined);
      // Aggregator picked first_available from active branch
      assert.strictEqual(outputs["agg_1"]?.result, "Tech Prompt");

      // Verify skipped events fired for billing and general
      const skippedEvents = events.filter((e) => e.type === "NODE_SKIPPED");
      const skippedIds = skippedEvents.map((e) => (e.payload as any).nodeId);
      assert.ok(skippedIds.includes("prompt_billing"));
      assert.ok(skippedIds.includes("prompt_general"));
    });

    it("routes to default branch when no cases match", async () => {
      const nodes: WorkflowNode[] = [
        makeNode("input_1", "input", { category: "random_unknown" }),
        makeNode(
          "cond_1",
          "condition",
          { category: "{{input_1.category}}" },
          {
            conditions: [
              {
                id: "rule_tech",
                variable: "category",
                operator: "equals",
                value: "tech",
                targetHandle: "case_tech",
              },
            ],
            defaultBranch: "case_default",
          },
        ),
        makeNode("prompt_tech", "prompt", { template: "Tech Prompt" }),
        makeNode("prompt_default", "prompt", { template: "Default Prompt" }),
        makeNode(
          "agg_1",
          "aggregator",
          {},
          { mode: "first_available", outputKey: "result" },
        ),
      ];

      const edges: WorkflowEdge[] = [
        { id: "e1", source: "input_1", target: "cond_1" },
        { id: "e2", source: "cond_1", sourceHandle: "case_tech", target: "prompt_tech" },
        { id: "e3", source: "cond_1", sourceHandle: "case_default", target: "prompt_default" },
        { id: "e4", source: "prompt_tech", target: "agg_1" },
        { id: "e5", source: "prompt_default", target: "agg_1" },
      ];

      const engine = new BrowserWorkflowEngine();
      const events = await collectEvents(engine.executeWorkflow({ nodes, edges }));

      const finalEv = events.find((e) => e.type === "WORKFLOW_COMPLETE");
      assert.ok(finalEv);
      const outputs = (finalEv.payload as any).outputs;

      assert.strictEqual(outputs["prompt_default"]?.promptText, "Default Prompt");
      assert.strictEqual(outputs["agg_1"]?.result, "Default Prompt");
    });

    it("aggregator merge_all merges outputs from incoming edges", async () => {
      const nodes: WorkflowNode[] = [
        makeNode("input_a", "input", { val: "Alpha" }),
        makeNode("input_b", "input", { val: "Beta" }),
        makeNode(
          "agg_1",
          "aggregator",
          {},
          { mode: "merge_all", outputKey: "merged" },
        ),
      ];

      const edges: WorkflowEdge[] = [
        { id: "e1", source: "input_a", target: "agg_1" },
        { id: "e2", source: "input_b", target: "agg_1" },
      ];

      const engine = new BrowserWorkflowEngine();
      const events = await collectEvents(engine.executeWorkflow({ nodes, edges }));

      const finalEv = events.find((e) => e.type === "WORKFLOW_COMPLETE");
      assert.ok(finalEv);
      const outputs = (finalEv.payload as any).outputs;

      assert.ok(outputs["agg_1"]?.merged);
      assert.deepStrictEqual(outputs["agg_1"]?.merged["input_a"], { val: "Alpha" });
      assert.deepStrictEqual(outputs["agg_1"]?.merged["input_b"], { val: "Beta" });
    });

    it("aggregator wait_all preserves object mapping across all incoming edges", async () => {
      const nodes: WorkflowNode[] = [
        makeNode("input_a", "input", { val: "First" }),
        makeNode(
          "agg_1",
          "aggregator",
          {},
          { mode: "wait_all", outputKey: "all_inputs" },
        ),
      ];

      const edges: WorkflowEdge[] = [
        { id: "e1", source: "input_a", target: "agg_1" },
      ];

      const engine = new BrowserWorkflowEngine();
      const events = await collectEvents(engine.executeWorkflow({ nodes, edges }));

      const finalEv = events.find((e) => e.type === "WORKFLOW_COMPLETE");
      assert.ok(finalEv);
      const outputs = (finalEv.payload as any).outputs;

      assert.ok(outputs["agg_1"]?.all_inputs);
      assert.deepStrictEqual(outputs["agg_1"]?.all_inputs["input_a"], { val: "First" });
    });
  });
});
