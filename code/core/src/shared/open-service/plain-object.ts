import { OpenServiceCyclicStateError } from '../../server-errors.ts';

// Own keys that must never be copied or assigned, to block prototype pollution.
export const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// No JSON-shaped state nests this deep; only a cycle does.
const MAX_DEPTH = 256;

// deepsignal stores signal accessors on `$`-prefixed keys; they are never state.
export function isReservedKey(key: string): boolean {
  return FORBIDDEN_KEYS.has(key) || key.startsWith('$');
}

export function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Deep-copies a JSON-shaped value, giving every path its own object.
 *
 * Used for every value on its way into service state: a definition's `initialState`, an object
 * assigned inside a `setState` recipe, and the value carried by a recorded op.
 *
 * Not `structuredClone`. That keeps a reference shared between two keys as one object, so a write
 * through one key would also change the other on the writing runtime, while peers, who only ever
 * receive JSON, would see one path change. Rebuilding key by key removes the alias on both sides.
 * It also accepts proxies and drops the prototype-pollution keys in {@link FORBIDDEN_KEYS} and
 * deepsignal's `$`-prefixed accessor keys. A cyclic value throws {@link OpenServiceCyclicStateError},
 * since it could never be serialized for peers; the check is a depth limit, which costs nothing per
 * node. An `undefined` property is dropped, as JSON drops it, so the author and peers agree on which
 * keys exist.
 *
 * Only own enumerable string keys are copied. Class instances, `Map`, `Set`, and `Date` become plain
 * objects, which matches the JSON-serializable contract service state already has.
 */
export function clonePlain(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (depth > MAX_DEPTH) {
    throw new OpenServiceCyclicStateError();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => clonePlain(entry, depth + 1));
  }
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const entry = (value as Record<string, unknown>)[key];
    if (isReservedKey(key) || entry === undefined) {
      continue;
    }
    copy[key] = clonePlain(entry, depth + 1);
  }
  return copy;
}
