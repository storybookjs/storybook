/**
 * Records the state paths one `setState` recipe touched, as the runtime's entry author needs them.
 *
 * A recipe is synchronous, so one call is one transaction: the recipe writes through a proxy over
 * the live deepsignal state, and when it returns the recorder hands the touched paths with their
 * final values to `author`. Zero ops means `author` is not called.
 *
 * Output is [RFC 6902 JSON Patch](https://datatracker.ietf.org/doc/html/rfc6902) with
 * [RFC 6901 JSON Pointer](https://datatracker.ietf.org/doc/html/rfc6901) paths.
 *
 * This is produce-with-patches over a live mutable proxy, not Immer: no copy-on-write (O(touched
 * paths), not O(container size)), arrays are atomic, and ops are standard JSON Patch rather than
 * Immer's segment-array paths.
 */
import { batch, untracked } from '@preact/signals-core';
import { peek } from 'deepsignal/core';

import { OpenServiceAsyncRecipeError } from '../../server-errors.ts';
import { FORBIDDEN_KEYS, clonePlain, hasOwn } from './plain-object.ts';
import { encodePointer, type JsonPatchOperation } from './service-channel.ts';

export type RecordedOp = JsonPatchOperation;

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
 * Runs `mutate` against `state` through a recording proxy and passes the resulting RFC 6902 ops to
 * `author`.
 *
 * `author` runs even when the recipe throws, with the paths written before the throw, and the
 * throw then propagates. A recipe that changes nothing does not call `author`.
 */
export function recordPatch<T extends object>(
  state: T,
  mutate: (state: T) => void,
  author: (ops: RecordedOp[]) => void
): void {
  const root: object = state;
  const touches = new Map<string, Touch>();
  const order: string[] = [];
  // One wrapper per target so draft identity (`draft.x === draft.x`, `indexOf`) matches deepsignal.
  const wrapperByTarget = new WeakMap<object, object>();
  const targetByWrapper = new WeakMap<object, object>();
  const revokes: (() => void)[] = [];

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

  // Assigned objects are copied, drafts included, so state never holds two paths to one object
  // and a later nested write reaches the same single path on every runtime.
  const storedValue = (value: unknown): unknown => {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    return clonePlain(targetByWrapper.get(value) ?? value);
  };

  const isUnchangedAssignment = (inner: object, name: string, value: unknown): boolean => {
    if (!hasOwn(inner, name)) {
      return false;
    }
    if (Object.is(peekProp(inner, name), value)) {
      return true;
    }
    if (value !== null && typeof value === 'object') {
      const target = targetByWrapper.get(value);
      return target !== undefined && Object.is(Reflect.get(inner, name), target);
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

    const { proxy, revoke } = Proxy.revocable(target, {
      get(inner, key) {
        if (typeof key === 'symbol') {
          return Reflect.get(inner, key);
        }
        // Traversing `__proto__` or `constructor` would let a nested write reach Object.prototype,
        // and a `$` accessor is deepsignal's signal, which a write would change unrecorded.
        if (FORBIDDEN_KEYS.has(key) || key.startsWith('$')) {
          return undefined;
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
        if (FORBIDDEN_KEYS.has(name)) {
          return true;
        }
        if (name.startsWith('$')) {
          // deepsignal swaps the field's signal, which changes the plain key's value.
          const plain = name.slice(1);
          const existed = hasOwn(inner, plain);
          const firstValue = firstTouchValue(existed, existed ? peekProp(inner, plain) : undefined);
          const done = Reflect.set(inner, key, value);
          note({ segments: path.concat(plain), firstValue, existed });
          return done;
        }

        if (isUnchangedAssignment(inner, name, value)) {
          return true;
        }

        if (effectiveArrayRoot) {
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
        if (FORBIDDEN_KEYS.has(name)) {
          return true;
        }
        if (name.startsWith('$')) {
          return Reflect.deleteProperty(inner, key);
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
    });

    revokes.push(revoke);
    wrapperByTarget.set(target, proxy);
    targetByWrapper.set(proxy, target);
    return proxy as T;
  };

  const flush = (): RecordedOp[] => {
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

    return ops;
  };

  // Authored inside the batch, so a subscriber that reacts to this write never sees state that is
  // in no entry, and its own entry is ordered after this one. Untracked, so a recipe run from an
  // effect does not make that effect depend on every field the recipe and its clones read.
  batch(() => {
    untracked(() => {
      try {
        const result: unknown = mutate(wrap(state, [], null));
        if (isThenable(result)) {
          // The recipe keeps running and rejects on its first write to a revoked draft.
          void Promise.resolve(result).catch(() => {});
          throw new OpenServiceAsyncRecipeError();
        }
      } finally {
        // Revoke first so a draft that escaped the recipe throws instead of writing unrecorded.
        for (const revoke of revokes) {
          revoke();
        }
        const ops = flush();
        if (ops.length > 0) {
          author(ops);
        }
      }
    });
  });
}

function isThenable(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}
