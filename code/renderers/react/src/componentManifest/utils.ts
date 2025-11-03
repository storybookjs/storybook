// Object.groupBy polyfill
import { readFileSync } from 'node:fs';

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

// Module-level cache stores: per-function caches keyed by derived string keys
// memoStore caches synchronous function results
let memoStore: WeakMap<(...args: any[]) => any, Map<string, unknown>> = new WeakMap();
// asyncMemoStore caches resolved values for async functions (never stores Promises)
let asyncMemoStore: WeakMap<(...args: any[]) => any, Map<string, unknown>> = new WeakMap();

// Generic cache/memoization helper
// - Caches by a derived key from the function arguments (must be a string)
// - Supports caching of `undefined` results (uses Map.has to distinguish)
// - Uses module-level stores so multiple wrappers around the same function share cache
// - Never stores a Promise; for async functions, we cache only the resolved value. Concurrent calls are not de-duped.
export const cached = <A extends unknown[], R>(
  fn: (...args: A) => R,
  opts: { key?: (...args: A) => string; name?: string } = {}
): ((...args: A) => R) => {
  const keyOf: (...args: A) => string =
    opts.key ??
    ((...args: A) => {
      try {
        // Prefer a stable string key based on the full arguments list
        return JSON.stringify(args) ?? String(args[0]);
      } catch {
        // Fallback: use the first argument if it is not serializable
        return String(args[0]);
      }
    });

  return (...args: A) => {
    const k = keyOf(...args);
    const name = fn.name || opts.name || 'anonymous';

    // Ensure stores exist for this function
    let syncStore = memoStore.get(fn);
    if (!syncStore) {
      syncStore = new Map<string, unknown>();
      memoStore.set(fn, syncStore);
    }
    let asyncStore = asyncMemoStore.get(fn);
    if (!asyncStore) {
      asyncStore = new Map<string, unknown>();
      asyncMemoStore.set(fn, asyncStore);
    }

    // Fast path: sync cached
    if (syncStore.has(k)) {
      // Log cache hit
      try {
        logger.verbose(`[cache] hit (sync) ${name} key=${k}`);
      } catch {}
      return syncStore.get(k);
    }

    // Fast path: async resolved cached
    if (asyncStore.has(k)) {
      logger.verbose(`[cache] hit (async) ${name} key=${k}`);
      return Promise.resolve(asyncStore.get(k));
    }

    // Compute result with benchmarking
    const start = Date.now();
    const result = fn(...args);

    // If it's a promise-returning function, cache the resolved value later
    const isPromise =
      result &&
      typeof result === 'object' &&
      'then' in result &&
      typeof (result as any).then === 'function';
    if (isPromise) {
      return (result as any).then((val: any) => {
        const duration = Date.now() - start;
        asyncStore!.set(k, val);
        logger.verbose(`[cache] miss ${name} took ${duration}ms key=${k}`);
        return val as R;
      });
    } else {
      const duration = Date.now() - start;
      syncStore.set(k, result);
      logger.verbose(`[cache] miss ${name} took ${duration}ms key=${k}`);
      return result;
    }
  };
};

export const invalidateCache = () => {
  // Reinitialize the module-level stores
  memoStore = new WeakMap();
  asyncMemoStore = new WeakMap();
};

export const cachedReadFileSync = cached(readFileSync, { name: 'cachedReadFile' });

export const cachedFindUp = cached(find.up, { name: 'findUp' });
