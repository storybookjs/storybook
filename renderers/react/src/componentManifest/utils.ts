// Object.groupBy polyfill
import { readFileSync } from 'node:fs';

import { resolveImport } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import * as find from 'empathic/find';

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

// Module-level cache store: per-function caches keyed by derived string keys
let memoStore: WeakMap<(...args: any[]) => any, Map<string, unknown>> = new WeakMap();

// Generic cache/memoization helper (synchronous only)
// - Caches by a derived key from the function arguments (must be a string)
// - Supports caching of `undefined` results (uses Map.has to distinguish)
// - Uses module-level store so multiple wrappers around the same function share cache
export const cached = <A extends unknown[], R>(
  fn: (...args: A) => R,
  opts: { key?: (...args: A) => string; name?: string } = {}
): ((...args: A) => R) => {
  const keyOf: (...args: A) => string =
    opts.key ??
    ((...args: A) => {
      try {
        // Prefer a stable string key based on the full arguments list
        return JSON.stringify(args);
      } catch {
        // Fallback: use the first argument if it is not serializable
        return String(args[0]);
      }
    });

  return (...args: A) => {
    const k = keyOf(...args);
    const name = fn.name || opts.name || 'anonymous';

    // Ensure store exists for this function
    let store = memoStore.get(fn);
    if (!store) {
      store = new Map<string, unknown>();
      memoStore.set(fn, store);
    }

    // Fast path: cached
    if (store.has(k)) {
      logger.verbose(`[cache] hit ${name} key=${k}`);
      return store.get(k) as R;
    }

    // Compute result with benchmarking
    const start = Date.now();
    const result = fn(...args);
    const duration = Date.now() - start;
    store.set(k, result as unknown);
    logger.verbose(`[cache] miss ${name} took ${duration}ms key=${k}`);
    return result;
  };
};

export const invalidateCache = () => {
  // Reinitialize the module-level store
  memoStore = new WeakMap();
};

export const cachedReadFileSync = cached(readFileSync, { name: 'cachedReadFile' });

export const cachedFindUp = cached(find.up, { name: 'findUp' });

export const cachedResolveImport = cached(resolveImport, { name: 'resolveImport' });
