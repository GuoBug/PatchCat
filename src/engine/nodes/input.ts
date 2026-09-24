import type { INodeExecutor, NodeExecContext } from './types.ts';

export const InputNodeExecutor: INodeExecutor = {
  type: 'input',
  execute(ctx: NodeExecContext): Record<string, unknown> {
    const { node, resolvedInputs, options } = ctx;
    let mergedInputs: Record<string, unknown> = { ...resolvedInputs };

    if (options?.inputs) {
      // 1. Direct node-specific namespace: options.inputs[node.id]
      if (
        typeof options.inputs[node.id] === 'object' &&
        options.inputs[node.id] !== null &&
        !Array.isArray(options.inputs[node.id])
      ) {
        mergedInputs = {
          ...mergedInputs,
          ...(options.inputs[node.id] as Record<string, unknown>),
        };
      }

      // 2. Flat parameter overlay (by key match or common query aliases)
      for (const [key, val] of Object.entries(options.inputs)) {
        if (key === node.id) continue;
        if (
          key in (node.data.inputs || {}) ||
          key in resolvedInputs ||
          key === 'query' ||
          key === 'input' ||
          key === 'user_query'
        ) {
          mergedInputs[key] = val;
        }
      }
    }

    return { ...mergedInputs, output: mergedInputs };
  },
};
