import { readFileSync } from 'node:fs';

import { logger } from 'storybook/internal/node-logger';

import * as find from 'empathic/find';

/** Object.groupBy polyfill */
export const groupBy = <K extends PropertyKey, T>(
  items: T[],
  keySelector: (item: T, index: number) => K
): Partial<Record<K, T[]>> => {
  const acc: Partial<Record<K, T[]>> = {};
  items.forEach((item, index) => {
    const key = keySelector(item, index);
    if (!Array.isArray(acc[key])) {
      acc[key] = [];
    }
    acc[key]!.push(item);
  });
  return acc;
};

/**
 * Assertion helper that throws if the condition is falsy.
 * Supports lazy evaluation of the message string.
 */
export function invariant(
  condition: unknown,
  message?: string | (() => string)
): asserts condition {
  if (condition) {
    return;
  }
  throw new Error((typeof message === 'function' ? message() : message) ?? 'Invariant failed');
}

// Module-level cache store
let memoStore: WeakMap<(...args: any[]) => any, Map<string, unknown>> = new WeakMap();

/**
 * Generic memoization helper for synchronous functions.
 * Caches by a derived string key from the function arguments.
 */
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

/** Invalidate all caches. */
export const invalidateCache = (): void => {
  memoStore = new WeakMap();
};

export const cachedReadFileSync = cached(readFileSync, { name: 'cachedReadFile' });

export const cachedFindUp = cached(find.up, { name: 'findUp' });
