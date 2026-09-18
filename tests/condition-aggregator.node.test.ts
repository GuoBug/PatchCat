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

  describe("PRD-013 Module 3: Condition Node Dual-Mode (Advanced JS Expression)", () => {
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

    it("evaluates truthy JS expression and routes to expressionTargetHandle", async () => {
      const nodes: WorkflowNode[] = [
        makeNode("input_1", "input", { urgency: 5, sentiment: "negative" }),
        makeNode(
          "cond_expr",
          "condition",
          {
            urgency: "{{input_1.urgency}}",
            sentiment: "{{input_1.sentiment}}",
          },
          {
            mode: "expression",
            expression: "inputs.urgency >= 4 && inputs.sentiment === 'negative'",
            expressionTargetHandle: "escalate_tier2",
            defaultBranch: "standard_routing",
          },
        ),
        makeNode("prompt_escalate", "prompt", { template: "Escalate Prompt" }),
        makeNode("prompt_standard", "prompt", { template: "Standard Prompt" }),
        makeNode("agg_1", "aggregator", {}, { mode: "first_available" }),
      ];

      const edges: WorkflowEdge[] = [
        { id: "e1", source: "input_1", target: "cond_expr" },
        { id: "e2", source: "cond_expr", sourceHandle: "escalate_tier2", target: "prompt_escalate" },
        { id: "e3", source: "cond_expr", sourceHandle: "standard_routing", target: "prompt_standard" },
        { id: "e4", source: "prompt_escalate", target: "agg_1" },
        { id: "e5", source: "prompt_standard", target: "agg_1" },
      ];

      const engine = new BrowserWorkflowEngine();
      const events = await collectEvents(engine.executeWorkflow({ nodes, edges }));

      const finalEv = events.find((e) => e.type === "WORKFLOW_COMPLETE");
      assert.ok(finalEv);
      const outputs = (finalEv.payload as any).outputs;

      // Active branch should be escalate_tier2
      assert.strictEqual(outputs["cond_expr"]?.activeBranch, "escalate_tier2");
      assert.strictEqual(outputs["prompt_escalate"]?.promptText, "Escalate Prompt");
      assert.strictEqual(outputs["prompt_standard"], undefined);
      assert.strictEqual(outputs["agg_1"]?.result, "Escalate Prompt");

      // Verify standard branch was skipped
      const skippedEvents = events.filter((e) => e.type === "NODE_SKIPPED");
      const skippedIds = skippedEvents.map((e) => (e.payload as any).nodeId);
      assert.ok(skippedIds.includes("prompt_standard"));
    });

    it("evaluates falsy JS expression and routes to defaultBranch (else)", async () => {
      const nodes: WorkflowNode[] = [
        makeNode("input_1", "input", { urgency: 2, sentiment: "positive" }),
        makeNode(
          "cond_expr",
          "condition",
          {
            urgency: "{{input_1.urgency}}",
            sentiment: "{{input_1.sentiment}}",
          },
          {
            mode: "expression",
            expression: "inputs.urgency >= 4 && inputs.sentiment === 'negative'",
            expressionTargetHandle: "escalate_tier2",
            defaultBranch: "standard_routing",
          },
        ),
        makeNode("prompt_escalate", "prompt", { template: "Escalate Prompt" }),
        makeNode("prompt_standard", "prompt", { template: "Standard Prompt" }),
        makeNode("agg_1", "aggregator", {}, { mode: "first_available" }),
      ];

      const edges: WorkflowEdge[] = [
        { id: "e1", source: "input_1", target: "cond_expr" },
        { id: "e2", source: "cond_expr", sourceHandle: "escalate_tier2", target: "prompt_escalate" },
        { id: "e3", source: "cond_expr", sourceHandle: "standard_routing", target: "prompt_standard" },
        { id: "e4", source: "prompt_escalate", target: "agg_1" },
        { id: "e5", source: "prompt_standard", target: "agg_1" },
      ];

      const engine = new BrowserWorkflowEngine();
      const events = await collectEvents(engine.executeWorkflow({ nodes, edges }));

      const finalEv = events.find((e) => e.type === "WORKFLOW_COMPLETE");
      assert.ok(finalEv);
      const outputs = (finalEv.payload as any).outputs;

      // Active branch should be standard_routing
      assert.strictEqual(outputs["cond_expr"]?.activeBranch, "standard_routing");
      assert.strictEqual(outputs["prompt_escalate"], undefined);
      assert.strictEqual(outputs["prompt_standard"]?.promptText, "Standard Prompt");
      assert.strictEqual(outputs["agg_1"]?.result, "Standard Prompt");

      const skippedEvents = events.filter((e) => e.type === "NODE_SKIPPED");
      const skippedIds = skippedEvents.map((e) => (e.payload as any).nodeId);
      assert.ok(skippedIds.includes("prompt_escalate"));
    });

    it("safely catches syntax or runtime errors in JS expression and routes to defaultBranch", async () => {
      const nodes: WorkflowNode[] = [
        makeNode("input_1", "input", { score: 95 }),
        makeNode(
          "cond_expr",
          "condition",
          { score: "{{input_1.score}}" },
          {
            mode: "expression",
            expression: "inputs.nonExistent.badProperty.deeper >= 100", // Throws TypeError
            expressionTargetHandle: "if_true",
            defaultBranch: "else",
          },
        ),
        makeNode("prompt_true", "prompt", { template: "True Prompt" }),
        makeNode("prompt_else", "prompt", { template: "Else Prompt" }),
      ];

      const edges: WorkflowEdge[] = [
        { id: "e1", source: "input_1", target: "cond_expr" },
        { id: "e2", source: "cond_expr", sourceHandle: "if_true", target: "prompt_true" },
        { id: "e3", source: "cond_expr", sourceHandle: "else", target: "prompt_else" },
      ];

      const engine = new BrowserWorkflowEngine();
      const events = await collectEvents(engine.executeWorkflow({ nodes, edges }));

      const finalEv = events.find((e) => e.type === "WORKFLOW_COMPLETE");
      assert.ok(finalEv);
      const outputs = (finalEv.payload as any).outputs;

      // Safe fallback to else branch without crashing workflow
      assert.strictEqual(outputs["cond_expr"]?.activeBranch, "else");
      assert.strictEqual(outputs["prompt_else"]?.promptText, "Else Prompt");
      assert.strictEqual(outputs["prompt_true"], undefined);
    });

    it("supports access to context in JS expression mode", async () => {
      const nodes: WorkflowNode[] = [
        makeNode("input_1", "input", { userRole: "admin" }),
        makeNode(
          "cond_expr",
          "condition",
          {},
          {
            mode: "expression",
            expression: "context['input_1']?.userRole === 'admin'",
            expressionTargetHandle: "admin_route",
            defaultBranch: "guest_route",
          },
        ),
        makeNode("prompt_admin", "prompt", { template: "Admin Dashboard" }),
        makeNode("prompt_guest", "prompt", { template: "Guest Portal" }),
      ];

      const edges: WorkflowEdge[] = [
        { id: "e1", source: "input_1", target: "cond_expr" },
        { id: "e2", source: "cond_expr", sourceHandle: "admin_route", target: "prompt_admin" },
        { id: "e3", source: "cond_expr", sourceHandle: "guest_route", target: "prompt_guest" },
      ];

      const engine = new BrowserWorkflowEngine();
      const events = await collectEvents(engine.executeWorkflow({ nodes, edges }));

      const finalEv = events.find((e) => e.type === "WORKFLOW_COMPLETE");
      assert.ok(finalEv);
      const outputs = (finalEv.payload as any).outputs;

      assert.strictEqual(outputs["cond_expr"]?.activeBranch, "admin_route");
      assert.strictEqual(outputs["prompt_admin"]?.promptText, "Admin Dashboard");
    });
  });
});
