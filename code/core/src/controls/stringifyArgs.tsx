export const stringifyArgs = (args: Record<string, any>): string =>
  JSON.stringify(args, (_, value) => {
    if (typeof value === 'function') {
      return '__sb_empty_function_arg__';
    }
    return value;
  });
