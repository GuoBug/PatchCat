/**
 * @file src/components/nodes/index.ts
 * @description Custom Workflow Node Components Registry for React Flow
 */

import type { NodeTypes } from '@xyflow/react';
import { InputNode } from './InputNode';
import { PromptNode } from './PromptNode';
import { LLMNode } from './LLMNode';
import { CodeNode } from './CodeNode';
import { OutputNode } from './OutputNode';
import { KnowledgeNode } from './KnowledgeNode';
import { ConditionNode } from './ConditionNode';
import { AggregatorNode } from './AggregatorNode';
import { HttpNode } from './HttpNode';

export { BaseNode } from './BaseNode';
export { InputNode } from './InputNode';
export { PromptNode } from './PromptNode';
export { LLMNode } from './LLMNode';
export { CodeNode } from './CodeNode';
export { OutputNode } from './OutputNode';
export { KnowledgeNode } from './KnowledgeNode';
export { ConditionNode } from './ConditionNode';
export { AggregatorNode } from './AggregatorNode';
export { HttpNode } from './HttpNode';

/**
 * Standard NodeTypes dictionary registered in React Flow
 */
export const nodeTypes: NodeTypes = {
  input: InputNode,
  prompt: PromptNode,
  llm: LLMNode,
  code: CodeNode,
  output: OutputNode,
  knowledge: KnowledgeNode,
  condition: ConditionNode,
  aggregator: AggregatorNode,
  http: HttpNode,
};

export const SUPPORTED_NODE_TYPES = [
  'input',
  'prompt',
  'llm',
  'code',
  'output',
  'knowledge',
  'condition',
  'aggregator',
  'http',
] as const;

export type RegisteredNodeType = (typeof SUPPORTED_NODE_TYPES)[number];
