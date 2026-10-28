type MergeableObject = Record<string, unknown>;

/**
 * Recursively merges plain objects from `source` into `target`. Nested plain objects are merged
 * key by key; arrays and primitive values in `source` replace the target's values instead of being
 * concatenated; `null` and `undefined` values in `source` are skipped, keeping the target's value.
 */
export function deepMerge<T extends MergeableObject>(target: T, source: MergeableObject): T {
  const result: MergeableObject = { ...target };

  for (const key in source) {
    if (source[key] !== undefined && source[key] !== null) {
      if (
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key]) &&
        target[key] !== null
      ) {
        result[key] = deepMerge(target[key] as MergeableObject, source[key] as MergeableObject);
      } else {
        result[key] = source[key];
      }
    }
  }

  return result as T;
}
