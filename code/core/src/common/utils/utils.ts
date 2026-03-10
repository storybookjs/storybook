// Object.groupBy polyfill
export const groupBy = <K extends PropertyKey, T>(
  items: T[],
  keySelector: (item: T, index: number) => K
) => {
  return items.reduce<Record<K, T[]>>(
    (acc, item, index) => {
      const key = keySelector(item, index);
      acc[key] ??= [];
      acc[key].push(item);
      return acc;
    },
    {} as Record<K, T[]>
  );
};

// This invariant allows for lazy evaluation of the message, which we need to avoid excessive computation.
export function invariant(
  condition: unknown,
  message?: string | (() => string)
): asserts condition {
  if (condition) {
    return;
  }
  throw new Error((typeof message === 'function' ? message() : message) ?? 'Invariant failed');
}
