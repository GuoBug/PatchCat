/**
 * @file tests/knowledge-node.node.test.ts
 * @description Unit tests for Knowledge Retrieval Node & End-to-End RAG Pipeline Execution
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BrowserWorkflowEngine } from '../src/engine/browser-engine.ts';
import type { WorkflowGraph, WorkflowNode, WorkflowEdge } from '../src/engine/types.ts';

describe('Knowledge Node & RAG Pipeline Execution', () => {
  const engine = new BrowserWorkflowEngine();

  it('should execute a standalone knowledge retrieval node and return structured chunks and context', async () => {
    const node: WorkflowNode = {
      id: 'knowledge_1',
      type: 'knowledge',
      position: { x: 0, y: 0 },
      data: {
        label: 'Knowledge Retrieval #1',
        type: 'knowledge',
        status: 'idle',
        inputs: {},
        outputs: {},
        config: {
          knowledgeBaseId: 'kb_demo',
          query: 'Topological sorting Kahn algorithm',
          topK: 3,
          scoreThreshold: 0.5,
        },
      },
    };

    const graph: WorkflowGraph = {
      nodes: [node],
      edges: [],
    };

    const events: unknown[] = [];
    for await (const event of engine.executeWorkflow(graph, { skipLLM: true })) {
      events.push(event);
    }

    const completed = events.find(
      (e: any) => e.type === 'NODE_COMPLETE' && e.payload?.nodeId === 'knowledge_1',
    ) as any;

    assert.ok(completed, 'Knowledge node should emit NODE_COMPLETE');
    assert.ok(typeof completed.payload.output.result === 'string');
    assert.ok(completed.payload.output.result.includes('Similarity'));
    assert.ok(Array.isArray(completed.payload.output.chunks));
    assert.equal(completed.payload.output.chunks.length, 1);
  });

  it('should execute a 4-node RAG pipeline: Input -> Knowledge -> Prompt -> Output', async () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'input_1',
        type: 'input',
        position: { x: 0, y: 0 },
        data: {
          label: 'User Query Input',
          type: 'input',
          status: 'idle',
          inputs: { user_question: 'How does PatchCat handle cycle detection?' },
          outputs: {},
          config: {},
        },
      },
      {
        id: 'knowledge_1',
        type: 'knowledge',
        position: { x: 200, y: 0 },
        data: {
          label: 'PatchCat KB Retrieval',
          type: 'knowledge',
          status: 'idle',
          inputs: { query: '{{input_1.user_question}}' },
          outputs: {},
          config: {
            knowledgeBaseId: 'kb_patchcat',
            topK: 2,
            scoreThreshold: 0.1,
          },
        },
      },
      {
        id: 'prompt_1',
        type: 'prompt',
        position: { x: 400, y: 0 },
        data: {
          label: 'RAG Augmented Prompt',
          type: 'prompt',
          status: 'idle',
          inputs: {
            template:
              'Background Context:\n{{knowledge_1.result}}\n\nUser Question:\n{{input_1.user_question}}',
          },
          outputs: {},
          config: {},
        },
      },
      {
        id: 'output_1',
        type: 'output',
        position: { x: 600, y: 0 },
        data: {
          label: 'Final Response',
          type: 'output',
          status: 'idle',
          inputs: { assembledPrompt: '{{prompt_1.promptText}}' },
          outputs: {},
          config: {},
        },
      },
    ];

    const edges: WorkflowEdge[] = [
      { id: 'e1', source: 'input_1', target: 'knowledge_1' },
      { id: 'e2', source: 'knowledge_1', target: 'prompt_1' },
      { id: 'e3', source: 'input_1', target: 'prompt_1' },
      { id: 'e4', source: 'prompt_1', target: 'output_1' },
    ];

    const graph: WorkflowGraph = { nodes, edges };

    const events: unknown[] = [];
    for await (const event of engine.executeWorkflow(graph, { skipLLM: true })) {
      events.push(event);
    }

    const finishEvent = events.find(
      (e: any) => e.type === 'NODE_COMPLETE' && e.payload?.nodeId === 'output_1',
    ) as any;

    assert.ok(finishEvent, 'Output node must finish');
    const finalResult = finishEvent.payload.output.finalResult as any;
    assert.ok(finalResult.assembledPrompt.includes('Background Context:'));
    assert.ok(finalResult.assembledPrompt.includes('Similarity: 0.88'));
    assert.ok(
      finalResult.assembledPrompt.includes(
        'User Question:\nHow does PatchCat handle cycle detection?',
      ),
    );
  });

  it('should validate and execute the official RAG preset workflow (rag-qa) end-to-end', async () => {
    const { PRESETS_DATA } = await import('../src/presets/index.ts');
    const zhPreset = PRESETS_DATA.zh['rag-qa'];
    assert.ok(zhPreset, 'Chinese RAG preset must exist');
    assert.equal(zhPreset.data.nodes.length, 5, 'RAG preset must have 5 nodes');

    const enPreset = PRESETS_DATA.en['rag-qa'];
    assert.ok(enPreset, 'English RAG preset must exist');
    assert.equal(enPreset.data.nodes.length, 5, 'English RAG preset must have 5 nodes');

    // Execute the preset graph with skipLLM mode
    const events: unknown[] = [];
    for await (const event of engine.executeWorkflow(zhPreset.data, { skipLLM: true })) {
      events.push(event);
    }

    const outputFinish = events.find(
      (e: any) => (e.type === 'NODE_COMPLETE' || e.type === 'NODE_ERROR') && e.payload?.nodeId === 'output_final',
    ) as any;

    assert.ok(outputFinish, 'RAG preset output node must complete');
    assert.equal(outputFinish.type, 'NODE_COMPLETE', 'Must complete successfully without error');
    assert.ok(outputFinish.payload.output.finalResult, 'Output node must have finalResult');
    const finalResult = outputFinish.payload.output.finalResult as any;
    assert.ok(finalResult.answer);
    assert.ok(finalResult.reference_context.includes('Similarity'));
  });
});
