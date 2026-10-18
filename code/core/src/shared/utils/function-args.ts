import type { Args } from 'storybook/internal/types';

/**
 * Functions cannot cross the channel: `telejson.stringify` drops function-typed values (as
 * `JSON.stringify` does), so any function nested in an args payload disappears before the other
 * side sees it. The result is that the Controls panel renders object args without their function
 * keys (#29207), while the docs page, rendered next to the real args in the preview, shows them.
 *
 * These helpers close that gap at every boundary an args payload crosses, in both directions:
 *
 * - the sender replaces each function with a `{ __function__: { name } }` marker, the same wire
 *   shape the instrumenter uses for call arguments, and escapes plain objects that merely look
 *   like a marker (`{ __sb_function_escape__: … }`), so user data is never mistaken for one;
 * - the receiver revives each marker back into a named function, resolving it against the value
 *   currently stored at the same path when it is a function with the same name. In the preview
 *   that keeps the real callback alive across a sibling edit of the same object; in the manager
 *   it keeps the identity stable across events, which reference-based args diffing (URL args,
 *   save-story, Controls' updated-args indicator) relies on.
 *
 * Identity is scoped to one reviver (one channel event, or one args/initialArgs pair) plus the
 * stored value at each path: two functions with the same name at different paths, or in different
 * stories, never share an identity.
 */

/** Matches the marker key the instrumenter's serialization of call arguments uses. */
const FUNCTION_MARKER = '__function__';

/**
 * Wraps plain-object user data that happens to be shaped like a function marker (or like this
 * wrapper itself), so `reviveArgFunctions` returns it untouched. Follows the `__sb_` prefix the
 * save-story placeholder (`__sb_empty_function_arg__`) established for Storybook-owned tokens.
 */
const ESCAPE_MARKER = '__sb_function_escape__';

type PlainObject = Record<string, unknown>;

type Path = (string | number)[];

type RevivedArgs<T> = T extends undefined ? undefined : Args;

function isPlainObject(value: unknown): value is PlainObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === Object.prototype || proto === null;
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * Replaces every function in `value` with a `{ __function__: { name } }` marker, and escapes
 * marker-shaped plain objects. Returns a new structure; the input is never mutated, because the
 * preview keeps living references to these args objects. Non-plain objects (class instances,
 * Dates, RegExps, ...) are passed through untouched and left to the transport, exactly as today.
 */
function serializeNode(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'function') {
    return { [FUNCTION_MARKER]: { name: value.name } };
  }
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    seen.add(value);
    const copy = value.map((element) => serializeNode(element, seen));
    seen.delete(value);
    return copy;
  }
  if (!isPlainObject(value)) {
    return value;
  }
  seen.add(value);
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    copy[key] = serializeNode(value[key], seen);
  }
  seen.delete(value);
  if (hasOwn(value, FUNCTION_MARKER) || hasOwn(value, ESCAPE_MARKER)) {
    return { [ESCAPE_MARKER]: copy };
  }
  return copy;
}

export function serializeArgFunctions(value: unknown): unknown {
  return serializeNode(value, new WeakSet());
}

/** A named empty function; `{ [name]: fn }[name]` gives the anonymous function its `name`. */
function namedFunction(name: string): () => void {
  return { [name]: function () {} }[name] as () => void;
}

/**
 * Revives markers within one channel event. The `resolvedByPath` memo makes every revival of the
 * same path inside the event share one function, so the `args` and `initialArgs` of a single
 * STORY_PREPARED payload compare equal wherever the story did not change. Successive events get a
 * fresh reviver and regain stability by resolving against the stored value at each path.
 */
export function createArgFunctionReviver(): {
  revive<T>(value: T, current?: Args): RevivedArgs<T>;
} {
  const resolvedByPath = new Map<string, () => void>();

  const reviveMarker = (marker: unknown, current: unknown, path: Path): unknown => {
    const name = isPlainObject(marker) && typeof marker.name === 'string' ? marker.name : '';
    if (typeof current === 'function' && current.name === name) {
      // An unchanged token for a slot that already holds a matching function: keep the stored
      // value. In the preview that is the real callback; in the manager, the stable placeholder.
      return current;
    }
    const pathKey = JSON.stringify(path);
    let fn = resolvedByPath.get(pathKey);
    if (!fn) {
      fn = namedFunction(name);
      resolvedByPath.set(pathKey, fn);
    }
    return fn;
  };

  const reviveNode = (
    value: unknown,
    current: unknown,
    path: Path,
    escaped: boolean,
    seen: WeakSet<object>
  ): unknown => {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    if (seen.has(value)) {
      return value;
    }
    if (Array.isArray(value)) {
      seen.add(value);
      const currentArray = Array.isArray(current) ? current : undefined;
      const copy = value.map((element, index) =>
        reviveNode(element, currentArray?.[index], [...path, index], false, seen)
      );
      seen.delete(value);
      return copy;
    }
    if (!isPlainObject(value)) {
      return value;
    }
    const keys = Object.keys(value);
    if (
      !escaped &&
      keys.length === 1 &&
      keys[0] === ESCAPE_MARKER &&
      isPlainObject(value[ESCAPE_MARKER])
    ) {
      seen.add(value);
      const revived = reviveNode(value[ESCAPE_MARKER], current, path, true, seen);
      seen.delete(value);
      return revived;
    }
    if (!escaped && hasOwn(value, FUNCTION_MARKER)) {
      return reviveMarker(value[FUNCTION_MARKER], current, path);
    }
    seen.add(value);
    const currentObject =
      current !== null && typeof current === 'object' ? (current as PlainObject) : undefined;
    const copy: Record<string, unknown> = {};
    for (const key of keys) {
      copy[key] = reviveNode(value[key], currentObject?.[key], [...path, key], false, seen);
    }
    seen.delete(value);
    return copy;
  };

  return {
    revive: <T>(value: T, current?: Args): RevivedArgs<T> =>
      reviveNode(value, current, [], false, new WeakSet()) as RevivedArgs<T>,
  };
}

/**
 * Replaces every `{ __function__: { name } }` marker in `value` with a function, resolving
 * against `current` (the value stored at the same path) when it is a function with the same
 * name. Returns a new structure; the input is never mutated.
 */
export function reviveArgFunctions<T>(value: T, current?: Args): RevivedArgs<T> {
  return createArgFunctionReviver().revive(value, current);
}
