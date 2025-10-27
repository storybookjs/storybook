// Object.groupBy polyfill
export const groupBy = <K extends PropertyKey, T>(
  items: T[],
  keySelector: (item: T, index: number) => K
) => {
  return items.reduce<Partial<Record<K, T[]>>>((acc = {}, item, index) => {
    const key = keySelector(item, index);
    acc[key] ??= [];
    acc[key].push(item);
    return acc;
  }, {});
};

export function invariant(condition: any, message?: string | (() => string)): asserts condition {
  if (condition) {
    return;
  }
  throw new Error((typeof message === 'function' ? message() : message) ?? 'Invariant failed');
}
