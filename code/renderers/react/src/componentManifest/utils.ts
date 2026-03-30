// Object.groupBy polyfill
import { readFileSync } from 'node:fs';

import { getProjectRoot, resolveImport } from 'storybook/internal/common';
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

/** Like {@link groupBy} but returns a `Map`, allowing non-PropertyKey keys. */
export function groupByToMap<T, K>(items: Iterable<T>, getKey: (item: T) => K): Map<K, T[]> {
  const result = new Map<K, T[]>();
  for (const item of items) {
    const key = getKey(item);
    const group = result.get(key);
    if (group) {
      group.push(item);
    } else {
      result.set(key, [item]);
    }
  }
  return result;
}

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
let memoStore: WeakMap<object, Map<string, unknown>> = new WeakMap();
let asyncMemoStore: WeakMap<object, Map<string, Promise<unknown>>> = new WeakMap();

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

// Generic cache/memoization helper for async functions
// - Caches the in-flight Promise so concurrent callers share work
// - Drops rejected Promises from the cache so retries can succeed
// - Uses a module-level store so multiple wrappers around the same function share cache
export const asyncCache = <A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  opts: { key?: (...args: A) => string; name?: string } = {}
): ((...args: A) => Promise<R>) => {
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

    let store = asyncMemoStore.get(fn);
    if (!store) {
      store = new Map<string, Promise<unknown>>();
      asyncMemoStore.set(fn, store);
    }

    const existing = store.get(k);
    if (existing) {
      logger.verbose(`[cache] hit ${name} key=${k}`);
      return existing as Promise<R>;
    }

    const start = Date.now();
    const pending = fn(...args)
      .then((result) => {
        logger.verbose(`[cache] miss ${name} took ${Date.now() - start}ms key=${k}`);
        return result;
      })
      .catch((error) => {
        if (store.get(k) === pending) {
          store.delete(k);
        }
        logger.verbose(`[cache] miss ${name} failed after ${Date.now() - start}ms key=${k}`);
        throw error;
      });

    store.set(k, pending);
    return pending;
  };
};

export const invalidateCache = () => {
  // Reinitialize the module-level store
  memoStore = new WeakMap();
  asyncMemoStore = new WeakMap();
};

export const cachedReadFileSync = cached(readFileSync, { name: 'cachedReadFile' });
export const cachedReadTextFileSync = cached(
  (filePath: string) => readFileSync(filePath, 'utf-8'),
  { name: 'cachedReadTextFile' }
);

export const cachedFindUp = cached(find.up, { name: 'findUp' });

/** Preserve `resolveImport` overloads at call sites after wrapping it in the generic cache helper. */
export const cachedResolveImport: typeof resolveImport = cached(resolveImport, {
  name: 'resolveImport',
}) as typeof resolveImport;

export const findTsconfigPath = cached(
  (cwd: string): string | undefined => {
    return find.up('tsconfig.json', { cwd, last: getProjectRoot() });
  },
  { name: 'findTsconfigPath' }
);
