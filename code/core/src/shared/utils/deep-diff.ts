import { once } from 'storybook/internal/client-logger';

import { isEqual as deepEqual, isPlainObject } from 'es-toolkit/predicate';

export const DEEPLY_EQUAL = Symbol('Deeply equal');

// Acyclic args/globals are shallow in practice; this only backstops pathologically deep (or
// reactive, fresh-reference-per-access) structures such as Vue VNodes/proxies that would otherwise
// overflow the call stack.
export const DEEP_DIFF_MAX_DEPTH = 100;

export const isObject = (value: unknown): value is Record<PropertyKey, unknown> =>
  value !== null && typeof value === 'object';

/**
 * Structural diff between two values, used to derive the minimal `args`/`globals` delta from their
 * initial state (e.g. to serialize into the URL or to emit arg updates). Because it runs against
 * arbitrary user-supplied values, it can receive circular or pathologically deep graphs (Vue
 * reactive proxies, VNodes, DOM nodes, class instances, ...).
 *
 * es-toolkit's `isEqual` has no cycle or depth protection, so we must never hand it a whole object
 * graph — doing so overflows the stack. Instead `isEqual` is only used to compare primitive leaves;
 * equality of objects and arrays is decided structurally here, bounded by both a cycle guard
 * (`stack`, the references currently on this recursion path) and a depth guard (`depth`), which also
 * catches reactive proxies that hand out a fresh reference on every access and so defeat
 * identity-based cycle detection.
 */
const diffInternal = (
  value: unknown,
  update: unknown,
  stack: Set<object>,
  depth: number
): unknown => {
  if (typeof value !== typeof update) {
    return update;
  }

  // Primitive (or null) leaves: a direct comparison is cheap and cannot recurse.
  if (!isObject(value) || !isObject(update)) {
    return deepEqual(value, update) ? DEEPLY_EQUAL : update;
  }

  // Cycle guard: we're re-entering an object already being diffed further up the stack.
  if (stack.has(value) || stack.has(update)) {
    return DEEPLY_EQUAL;
  }

  if (depth >= DEEP_DIFF_MAX_DEPTH) {
    once.warn(
      `deepDiff: reached max depth (${DEEP_DIFF_MAX_DEPTH}); treating deeper values as changed.`
    );
    return update;
  }

  stack.add(value);
  stack.add(update);

  try {
    if (Array.isArray(value) && Array.isArray(update)) {
      const res = new Array(update.length);
      let changed = value.length !== update.length;
      for (let index = 0; index < update.length; index += 1) {
        const diff = diffInternal(value[index], update[index], stack, depth + 1);
        if (diff !== DEEPLY_EQUAL) {
          res[index] = diff;
          changed = true;
        }
      }
      if (!changed) {
        return DEEPLY_EQUAL;
      }
      if (update.length >= value.length) {
        return res;
      }
      return res.concat(new Array(value.length - update.length).fill(undefined));
    }

    if (isPlainObject(value) && isPlainObject(update)) {
      const acc: Record<string, unknown> = {};
      let changed = false;
      for (const key of Object.keys({ ...value, ...update })) {
        const diff = diffInternal(value?.[key], update?.[key], stack, depth + 1);
        if (diff !== DEEPLY_EQUAL) {
          acc[key] = diff;
          changed = true;
        }
      }
      return changed ? acc : DEEPLY_EQUAL;
    }

    // Non-plain objects (Vue VNode/proxy, DOM node, class instance, ...): recursing into them is
    // unsafe. Compare known shallow built-ins by value; treat everything else as changed unless it
    // is the very same reference.
    if (value instanceof Date && update instanceof Date) {
      return value.getTime() === update.getTime() ? DEEPLY_EQUAL : update;
    }
    if (value instanceof RegExp && update instanceof RegExp) {
      return value.toString() === update.toString() ? DEEPLY_EQUAL : update;
    }
    return value === update ? DEEPLY_EQUAL : update;
  } finally {
    stack.delete(value);
    stack.delete(update);
  }
};

export function deepDiff<T>(value: T, update: T): T | typeof DEEPLY_EQUAL;
export function deepDiff(value: unknown, update: unknown): unknown;
export function deepDiff(value: unknown, update: unknown): unknown {
  return diffInternal(value, update, new Set(), 0);
}
