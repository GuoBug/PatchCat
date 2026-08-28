/**
 * @file    scripts/demo-run.ts
 * @description
 *   Interactive CLI demo that exercises the core engine end-to-end:
 *   1. Builds a 4-node workflow graph in memory
 *   2. Validates the DAG topology
 *   3. Runs the browser engine (mock mode)
 *   4. Prints every execution event to the console
 *
 *   Usage:  npx tsx scripts/demo-run.ts
 */

import { topologicalSort } from '../src/engine/topological-sort.ts';
import { BrowserWorkflowEngine } from '../src/engine/browser-engine.ts';
import { resolveTemplateVariables } from '../src/engine/variable-resolver.ts';
import { getDefaultNodeConfig } from '../src/engine/types.ts';
import type { WorkflowNode, WorkflowEdge, ExecutionEvent } from '../src/engine/types.ts';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Build a demo graph
// ─────────────────────────────────────────────────────────────────────────────

const nodes: WorkflowNode[] = [
  {
    id: 'input_1',
    type: 'input',
    position: { x: 0, y: 0 },
    data: {
      label: 'User Input',
      type: 'input',
      status: 'idle',
      inputs: { user_query: 'Explain quantum computing in simple terms.' },
      outputs: {},
      config: getDefaultNodeConfig('input'),
    },
  },
  {
    id: 'prompt_1',
    type: 'prompt',
    position: { x: 300, y: 0 },
    data: {
      label: 'Prompt Builder',
      type: 'prompt',
      status: 'idle',
      inputs: {
        template:
          'You are a helpful science teacher. Explain the following topic:\n{{input_1.user_query}}',
      },
      outputs: {},
      config: getDefaultNodeConfig('prompt'),
    },
  },
  {
    id: 'llm_1',
    type: 'llm',
    position: { x: 600, y: 0 },
    data: {
      label: 'GPT-4o Mini',
      type: 'llm',
      status: 'idle',
      inputs: { prompt: '{{prompt_1.promptText}}' },
      outputs: {},
      config: { model: 'gpt-4o-mini', temperature: 0.7 },
    },
  },
  {
    id: 'output_1',
    type: 'output',
    position: { x: 900, y: 0 },
    data: {
      label: 'Final Output',
      type: 'output',
      status: 'idle',
      inputs: { content: '{{llm_1.response}}' },
      outputs: {},
      config: getDefaultNodeConfig('output'),
    },
  },
];

const edges: WorkflowEdge[] = [
  { id: 'e1', source: 'input_1', target: 'prompt_1', sourceHandle: 'output', targetHandle: 'input' },
  { id: 'e2', source: 'prompt_1', target: 'llm_1', sourceHandle: 'promptText', targetHandle: 'prompt' },
  { id: 'e3', source: 'llm_1', target: 'output_1', sourceHandle: 'response', targetHandle: 'content' },
];

// ─────────────────────────────────────────────────────────────────────────────
// 2. Run the demo
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   AI Prompt Flow Orchestrator — CLI Engine Demo         ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log();

  // ── Step 1: Topological Sort ─────────────────────────────────────────
  console.log('📐 Step 1: Topological Sort');
  const sortResult = topologicalSort({ nodes, edges });
  console.log(`   Has Cycle: ${sortResult.hasCycle}`);
  console.log(`   Execution Layers:`);
  sortResult.executionLayers.forEach((layer, i) => {
    console.log(`     Layer ${i}: [${layer.join(', ')}]`);
  });
  console.log();

  // ── Step 2: Variable Resolution Demo ─────────────────────────────────
  console.log('🔗 Step 2: Variable Resolution Demo');
  const mockContext = {
    input_1: { user_query: 'Explain quantum computing in simple terms.' },
  };
  const promptTemplate = nodes[1]!.data.inputs['template'] as string;
  const resolved = resolveTemplateVariables(promptTemplate, mockContext);
  console.log(`   Template: "${promptTemplate}"`);
  console.log(`   Resolved: "${resolved}"`);
  console.log();

  // ── Step 3: Execute Workflow (Mock Mode) ─────────────────────────────
  console.log('🚀 Step 3: Execute Workflow (Mock Mode)');
  console.log('─'.repeat(60));
  const engine = new BrowserWorkflowEngine();
  const eventStream = engine.executeWorkflow(
    { nodes, edges },
    { inputs: { user_query: 'Explain quantum computing in simple terms.' } },
  );

  for await (const event of eventStream) {
    printEvent(event);
  }

  console.log('─'.repeat(60));
  console.log('✅ Demo complete!');
}

function printEvent(event: ExecutionEvent) {
  const ts = new Date().toISOString().slice(11, 23);
  switch (event.type) {
    case 'WORKFLOW_START':
      console.log(`  [${ts}] 🟢 WORKFLOW_START — ${event.payload.totalNodes} nodes`);
      break;
    case 'NODE_COMPLETE':
      console.log(`  [${ts}] ✅ NODE_COMPLETE — ${event.payload.nodeId} (${event.payload.durationMs}ms)`);
      console.log(`           Output: ${JSON.stringify(event.payload.output).slice(0, 120)}…`);
      break;
    case 'NODE_ERROR':
      console.log(`  [${ts}] ❌ NODE_ERROR — ${event.payload.nodeId}: ${event.payload.error}`);
      break;
    case 'WORKFLOW_COMPLETE':
      console.log(`  [${ts}] 🏁 WORKFLOW_COMPLETE — Total: ${event.payload.totalDurationMs}ms`);
      break;
    case 'WORKFLOW_ERROR':
      console.log(`  [${ts}] 💥 WORKFLOW_ERROR — ${event.payload.error}`);
      break;
    default:
      console.log(`  [${ts}] 📌 ${event.type}`);
  }
}

main().catch(console.error);
