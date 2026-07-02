// Args can hold non-serializable values (e.g. Vue VNodes, whose `el` references back via `__vnode`).
// `JSON.stringify` throws "Converting circular structure to JSON" on those, which would crash the
// save-story flow — so circular references are dropped to a marker, like functions are.
export const stringifyArgs = (args: Record<string, unknown>) => {
  const seen = new WeakSet<object>();
  return JSON.stringify(args, (_, value) => {
    if (typeof value === 'function') {
      return '__sb_empty_function_arg__';
    }
    if (value !== null && typeof value === 'object') {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  });
};
