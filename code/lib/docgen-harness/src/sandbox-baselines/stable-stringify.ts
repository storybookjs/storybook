// Key-sorted JSON so a recorded baseline's diff reflects content, never the order a producer happened
// to emit. Comparison uses `deepEqual`, which is key-order insensitive without serializing.
export function stableStringify(value: unknown, indent = 2): string {
  const sortKeys = (input: unknown): unknown => {
    if (Array.isArray(input)) {
      return input.map(sortKeys);
    }
    if (input !== null && typeof input === 'object') {
      return Object.fromEntries(
        Object.entries(input)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, sortKeys(item)])
      );
    }
    return input;
  };
  return JSON.stringify(sortKeys(value), null, indent);
}
