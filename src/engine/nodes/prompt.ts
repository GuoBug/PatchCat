import type { INodeExecutor, NodeExecContext } from './types.ts';

export const PromptNodeExecutor: INodeExecutor = {
  type: 'prompt',
  execute(ctx: NodeExecContext): Record<string, unknown> {
    const { resolvedInputs } = ctx;
    const template = resolvedInputs['template'];
    return {
      promptText: typeof template === 'string' ? template : JSON.stringify(resolvedInputs),
    };
  },
};
