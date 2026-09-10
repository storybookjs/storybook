/**
 * Records the state paths a `setState` recipe touched, for the open-service sync wrapper.
 *
 * The wrapper opens one collector per outer command invocation and passes it into the runtime
 * command. Recipes write through a proxy over the live deepsignal state. At flush, each surviving
 * path is emitted once with its final value. Zero ops means the wrapper sends nothing and does not
 * bump the stamp.
 */
import { batch } from '@preact/signals-core';
import { peek } from 'deepsignal/core';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export type RecordedOp =
  | { op: 'add'; path: string; value: unknown }
  | { op: 'replace'; path: string; value: unknown }
  | { op: 'remove'; path: string };

export type PatchCollector = {
  record<T extends object>(state: T, mutate: (state: T) => void): void;
  flush(): RecordedOp[];
};

type TouchKind = 'set' | 'remove';

type Touch = {
  segments: string[];
  firstValue: unknown;
  existed: boolean;
  kind: TouchKind;
};

type ArrayRoot = {
  path: string[];
  target: object;
};

export function toJsonPointer(segments: readonly string[]): string {
  return `/${segments.map(escapePointerSegment).join('/')}`;
}

function escapePointerSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

function isForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEYS.has(key);
}

function peekProp(obj: object, key: string): unknown {
  return peek(obj as never, key as never);
}

function snapshotValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    const copy = Array.from({ length: value.length });
    for (let i = 0; i < value.length; i += 1) {
      copy[i] = snapshotValue(peekProp(value, String(i)));
    }
    return copy;
  }

  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    if (isForbiddenKey(key)) {
      continue;
    }
    copy[key] = snapshotValue(peekProp(value, key));
  }
  return copy;
}

function cloneAssigned(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => cloneAssigned(entry));
  }

  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(value as object)) {
    if (isForbiddenKey(key)) {
      continue;
    }
    copy[key] = cloneAssigned((value as Record<string, unknown>)[key]);
  }
  return copy;
}

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function isPrimitive(value: unknown): boolean {
  return value === null || typeof value !== 'object';
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

export function createPatchCollector(): PatchCollector {
  const touches = new Map<string, Touch>();
  const order: string[] = [];
  let root: object | undefined;

  const note = (touch: Touch): void => {
    const pointer = toJsonPointer(touch.segments);
    const existing = touches.get(pointer);
    if (!existing) {
      touches.set(pointer, touch);
      order.push(pointer);
      return;
    }
    existing.kind = touch.kind;
  };

  const noteArray = (arrayRoot: ArrayRoot, kind: TouchKind): void => {
    const pointer = toJsonPointer(arrayRoot.path);
    const existing = touches.get(pointer);
    if (!existing) {
      touches.set(pointer, {
        segments: arrayRoot.path,
        firstValue: snapshotValue(arrayRoot.target),
        existed: true,
        kind,
      });
      order.push(pointer);
      return;
    }
    existing.kind = kind;
  };

  const wrap = <T extends object>(target: T, path: string[], arrayRoot: ArrayRoot | null): T => {
    const effectiveArrayRoot: ArrayRoot | null =
      arrayRoot ?? (Array.isArray(target) ? { path, target } : null);

    return new Proxy(target, {
      get(inner, key) {
        if (typeof key === 'symbol') {
          return Reflect.get(inner, key);
        }

        const value = Reflect.get(inner, key);
        if (typeof value === 'function') {
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
        if (name.startsWith('$') || isForbiddenKey(name)) {
          return true;
        }

        if (effectiveArrayRoot) {
          noteArray(effectiveArrayRoot, 'set');
          const stored = value === undefined ? undefined : cloneAssigned(value);
          return Reflect.set(inner, name, stored);
        }

        const existed = hasOwn(inner, name);
        const firstValue = existed ? snapshotValue(peekProp(inner, name)) : undefined;

        if (value === undefined) {
          if (existed) {
            note({ segments: path.concat(name), firstValue, existed, kind: 'remove' });
            return Reflect.deleteProperty(inner, name);
          }
          return true;
        }

        note({ segments: path.concat(name), firstValue, existed, kind: 'set' });
        return Reflect.set(inner, name, cloneAssigned(value));
      },

      deleteProperty(inner, key) {
        if (typeof key === 'symbol') {
          return Reflect.deleteProperty(inner, key);
        }

        const name = String(key);
        if (name.startsWith('$') || isForbiddenKey(name)) {
          return true;
        }

        if (effectiveArrayRoot) {
          noteArray(effectiveArrayRoot, 'set');
          return Reflect.deleteProperty(inner, name);
        }

        if (!hasOwn(inner, name)) {
          return true;
        }

        note({
          segments: path.concat(name),
          firstValue: snapshotValue(peekProp(inner, name)),
          existed: true,
          kind: 'remove',
        });
        return Reflect.deleteProperty(inner, name);
      },
    }) as T;
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

        const hasTouchedAncestor = touch.segments.some((_, index) => {
          if (index === 0) {
            return false;
          }
          return touched.has(toJsonPointer(touch.segments.slice(0, index)));
        });
        if (hasTouchedAncestor) {
          continue;
        }

        switch (touch.kind) {
          case 'remove': {
            if (touch.existed) {
              ops.push({ op: 'remove', path: pointer });
            }
            break;
          }
          case 'set': {
            const { found, value } = readPath(root, touch.segments);
            if (!found) {
              if (touch.existed) {
                ops.push({ op: 'remove', path: pointer });
              }
              break;
            }
            if (isPrimitive(value) && Object.is(value, touch.firstValue)) {
              break;
            }
            ops.push({
              op: touch.existed ? 'replace' : 'add',
              path: pointer,
              value: cloneAssigned(value),
            });
            break;
          }
          default: {
            touch.kind satisfies never;
            break;
          }
        }
      }

      touches.clear();
      order.length = 0;
      root = undefined;
      return ops;
    },
  };
}
