import type { INodeExecutor, NodeExecContext } from './types.ts';

export const OutputNodeExecutor: INodeExecutor = {
  type: 'output',
  execute(ctx: NodeExecContext): Record<string, unknown> {
    const { resolvedInputs } = ctx;
    return {
      finalResult: resolvedInputs,
      renderedAt: new Date().toISOString(),
    };
  },
};
