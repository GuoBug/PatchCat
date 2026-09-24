import type { NodeType } from '../types.ts';
import type { INodeExecutor } from './types.ts';
import { InputNodeExecutor } from './input.ts';
import { PromptNodeExecutor } from './prompt.ts';
import { OutputNodeExecutor } from './output.ts';

export * from './types.ts';
export { InputNodeExecutor } from './input.ts';
export { PromptNodeExecutor } from './prompt.ts';
export { OutputNodeExecutor } from './output.ts';

/**
 * Registry of modular node executors.
 * Follows the Extract-on-Touch pattern: nodes are cleanly extracted here
 * without requiring a massive, all-at-once engine refactoring.
 */
export const NODE_EXECUTORS: Partial<Record<NodeType, INodeExecutor>> = {
  input: InputNodeExecutor,
  prompt: PromptNodeExecutor,
  output: OutputNodeExecutor,
};
