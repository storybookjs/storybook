import { readFileSync } from 'node:fs';

import { logger } from 'storybook/internal/node-logger';

export const groupBy = <K extends PropertyKey, T>(
  items: T[],
  keySelector: (item: T, index: number) => K
) => {
  return items.reduce<Partial<Record<K, T[]>>>((acc = {}, item, index) => {
    const key = keySelector(item, index);
    if (!Array.isArray(acc[key])) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {});
};

let memoStore: WeakMap<object, Map<string, unknown>> = new WeakMap();

export const cached = <A extends unknown[], R>(
  fn: (...args: A) => R,
  opts: { key?: (...args: A) => string; name?: string } = {}
): ((...args: A) => R) => {
  const keyOf: (...args: A) => string =
    opts.key ??
    ((...args: A) => {
      try {
        return JSON.stringify(args);
      } catch {
        return String(args[0]);
      }
    });

  return (...args: A) => {
    const k = keyOf(...args);
    const name = fn.name || opts.name || 'anonymous';

    let store = memoStore.get(fn);
    if (!store) {
      store = new Map<string, unknown>();
      memoStore.set(fn, store);
    }

    if (store.has(k)) {
      logger.verbose(`[cache] hit ${name} key=${k}`);
      return store.get(k) as R;
    }

    const start = Date.now();
    const result = fn(...args);
    const duration = Date.now() - start;
    store.set(k, result as unknown);
    logger.verbose(`[cache] miss ${name} took ${duration}ms key=${k}`);
    return result;
  };
};

export const invalidateCache = () => {
  memoStore = new WeakMap();
};

export const cachedReadTextFileSync = cached(
  (filePath: string) => readFileSync(filePath, 'utf-8'),
  { name: 'cachedReadTextFile' }
);
