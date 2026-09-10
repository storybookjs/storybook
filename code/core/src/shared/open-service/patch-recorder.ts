/**
 * Records the state paths a `setState` recipe touched, for the open-service sync wrapper.
 *
 * The wrapper opens one collector per outer command invocation. Recipes write through a proxy over
 * the live deepsignal state. Flush emits one op per surviving path with its final value. Zero ops
 * means no broadcast and no stamp bump.
 *
 * Output is [RFC 6902 JSON Patch](https://datatracker.ietf.org/doc/html/rfc6902) with
 * [RFC 6901 JSON Pointer](https://datatracker.ietf.org/doc/html/rfc6901) paths.
 *
 * This is produce-with-patches over a live mutable proxy, not Immer: no copy-on-write (O(touched
 * paths), not O(container size)), arrays are atomic, and ops are standard JSON Patch rather than
 * Immer's segment-array paths.
 */
import { batch } from '@preact/signals-core';
import { peek } from 'deepsignal/core';

import { clonePlain, hasOwn, isReservedKey } from './plain-object.ts';
import { encodePointer, type JsonPatchOperation } from './service-channel.ts';

export type RecordedOp = JsonPatchOperation;

export type PatchCollector = {
  record<T extends object>(state: T, mutate: (state: T) => void): void;
  flush(): RecordedOp[];
};

type Touch = {
  segments: string[];
  firstValue: unknown;
  existed: boolean;
};

type ArrayRoot = {
  path: string[];
  target: object;
};

function peekProp(obj: object, key: string): unknown {
  return peek(obj as never, key as never);
}

function isPrimitive(value: unknown): boolean {
  return value === null || typeof value !== 'object';
}

function firstTouchValue(existed: boolean, current: unknown): unknown {
  if (!existed || !isPrimitive(current)) {
    return undefined;
  }
  return current;
}

function readPath(root: object, segments: readonly string[]): { found: boolean; value: unknown } {
  let current: unknown = root;

  for (const segment of segments) {
    if (current === null || typeof current !== 'object') {
      return { found: false, value: undefined };
    }

    if (!hasOwn(current, segment)) {
      return { found: false, value: undefined };
    }

    current = peekProp(current, segment);
  }

  return { found: true, value: current };
}

/**
 * Opens a per-invocation collector that records `setState` recipes onto the live state.
 *
 * `record` runs the recipe through a recording proxy. `flush` returns the RFC 6902 ops for paths
 * that still differ, or `[]` when the invocation was a no-op.
 */
export function createPatchCollector(): PatchCollector {
  const touches = new Map<string, Touch>();
  const order: string[] = [];
  // One wrapper per target so draft identity (`draft.x === draft.x`, `indexOf`) matches deepsignal.
  const wrapperByTarget = new WeakMap<object, object>();
  const targetByWrapper = new WeakMap<object, object>();
  let root: object | undefined;

  const note = (touch: Touch): void => {
    const pointer = encodePointer(touch.segments);
    if (touches.has(pointer)) {
      return;
    }
    touches.set(pointer, touch);
    order.push(pointer);
  };

  const noteArray = (arrayRoot: ArrayRoot): void => {
    note({
      segments: arrayRoot.path,
      firstValue: undefined,
      existed: true,
    });
  };

  const storedValue = (value: unknown): unknown => {
    if (value === undefined) {
      return undefined;
    }
    if (value !== null && typeof value === 'object') {
      const target = targetByWrapper.get(value);
      if (target !== undefined) {
        // Assigning a draft shares the live object; external values are cloned.
        return target;
      }
      return clonePlain(value);
    }
    return value;
  };

  const isUnchangedAssignment = (inner: object, name: string, value: unknown): boolean => {
    if (!hasOwn(inner, name)) {
      return false;
    }
    const current = peekProp(inner, name);
    if (Object.is(current, value)) {
      return true;
    }
    if (value !== null && typeof value === 'object') {
      const target = targetByWrapper.get(value);
      return target !== undefined && Object.is(current, target);
    }
    return false;
  };

  const wrap = <T extends object>(target: T, path: string[], arrayRoot: ArrayRoot | null): T => {
    const cached = wrapperByTarget.get(target);
    if (cached) {
      return cached as T;
    }

    const effectiveArrayRoot: ArrayRoot | null =
      arrayRoot ?? (Array.isArray(target) ? { path, target } : null);

    const proxy = new Proxy(target, {
      get(inner, key) {
        if (typeof key === 'symbol') {
          return Reflect.get(inner, key);
        }

        const value = Reflect.get(inner, key);
        if (typeof value === 'function') {
          // Unbound, so array mutators (`push`, `splice`) go through this proxy's [[Set]].
          return value;
        }
        if (value !== null && typeof value === 'object') {
          return wrap(value, path.concat(String(key)), effectiveArrayRoot);
        }
        return value;
      },

      set(inner, key, value) {
        if (typeof key === 'symbol') {
          return Reflect.set(inner, key, value);
        }

        const name = String(key);
        if (isReservedKey(name)) {
          return true;
        }

        if (isUnchangedAssignment(inner, name, value)) {
          return true;
        }

        if (effectiveArrayRoot) {
          // Index and length writes collapse to one replace of the outermost array.
          noteArray(effectiveArrayRoot);
          return Reflect.set(inner, name, storedValue(value));
        }

        const existed = hasOwn(inner, name);
        const firstValue = firstTouchValue(existed, existed ? peekProp(inner, name) : undefined);

        if (value === undefined) {
          if (existed) {
            note({ segments: path.concat(name), firstValue, existed });
            return Reflect.deleteProperty(inner, name);
          }
          return true;
        }

        note({ segments: path.concat(name), firstValue, existed });
        return Reflect.set(inner, name, storedValue(value));
      },

      deleteProperty(inner, key) {
        if (typeof key === 'symbol') {
          return Reflect.deleteProperty(inner, key);
        }

        const name = String(key);
        if (isReservedKey(name)) {
          return true;
        }

        if (!hasOwn(inner, name)) {
          return true;
        }

        if (effectiveArrayRoot) {
          noteArray(effectiveArrayRoot);
          return Reflect.deleteProperty(inner, name);
        }

        note({
          segments: path.concat(name),
          firstValue: firstTouchValue(true, peekProp(inner, name)),
          existed: true,
        });
        return Reflect.deleteProperty(inner, name);
      },
    }) as T;

    wrapperByTarget.set(target, proxy);
    targetByWrapper.set(proxy, target);
    return proxy;
  };

  return {
    record(state, mutate) {
      root = state;
      batch(() => {
        mutate(wrap(state, [], null));
      });
    },

    flush() {
      if (!root) {
        return [];
      }

      const touched = new Set(order);
      const ops: RecordedOp[] = [];

      for (const pointer of order) {
        const touch = touches.get(pointer);
        if (!touch) {
          continue;
        }

        // `/a` covers `/a/b`; `/a` does not cover `/ab`.
        const hasTouchedAncestor = touch.segments.some((_, index) => {
          if (index === 0) {
            return false;
          }
          return touched.has(encodePointer(touch.segments.slice(0, index)));
        });
        if (hasTouchedAncestor) {
          continue;
        }

        // Final value comes from live state, so overlapping collectors cannot emit a stale remove.
        const { found, value } = readPath(root, touch.segments);
        if (!found) {
          if (touch.existed) {
            ops.push({ op: 'remove', path: pointer });
          }
          continue;
        }
        // Same-value primitives (including net-out) are not ops; objects are never deep-compared.
        if (isPrimitive(value) && Object.is(value, touch.firstValue)) {
          continue;
        }
        ops.push({
          op: touch.existed ? 'replace' : 'add',
          path: pointer,
          value: clonePlain(value),
        });
      }

      touches.clear();
      order.length = 0;
      root = undefined;
      return ops;
    },
  };
}
