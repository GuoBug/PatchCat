/**
 * @file src/components/nodes/index.ts
 * @description Custom Workflow Node Components Registry (Input, Prompt, LLM, Code, Router, Output)
 */

export const SUPPORTED_NODE_TYPES = [
  'input',
  'prompt',
  'llm',
  'code',
  'router',
  'output',
] as const;

export type RegisteredNodeType = typeof SUPPORTED_NODE_TYPES[number];
