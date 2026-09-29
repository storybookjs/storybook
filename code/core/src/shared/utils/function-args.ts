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

/** The channel serializes with telejson's default `maxDepth` of 25; never walk deeper than that. */
const MAX_DEPTH = 25;

type PlainObject = Record<string, unknown>;

type Path = (string | number)[];

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
 * Replaces every function in `value` (at any depth, up to the transport's max depth) with a
 * `{ __function__: { name } }` marker, and escapes marker-shaped plain objects. Returns a new
 * structure; the input is never mutated, because the preview keeps living references to these
 * args objects. Non-plain objects (class instances, Dates, RegExps, ...) are passed through
 * untouched and left to the transport, exactly as today.
 */
export function serializeArgFunctions<T>(value: T, depth = 0, seen = new WeakSet<object>()): T {
  if (typeof value === 'function') {
    const name = value.name;
    return { [FUNCTION_MARKER]: { name: typeof name === 'string' ? name : '' } } as T;
  }
  if (depth >= MAX_DEPTH || seen.has(value as object)) {
    return value;
  }
  if (Array.isArray(value)) {
    seen.add(value);
    // `map` keeps sparse-array holes intact, unlike an index-by-index copy.
    return value.map((element) => serializeArgFunctions(element, depth + 1, seen)) as T;
  }
  if (!isPlainObject(value)) {
    return value;
  }
  seen.add(value);
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    copy[key] = serializeArgFunctions(value[key], depth + 1, seen);
  }
  if (hasOwn(value, FUNCTION_MARKER) || hasOwn(value, ESCAPE_MARKER)) {
    // User data that looks like a marker (or like the escape wrapper) must survive the round
    // trip as data; brand it so the reviver takes the branch below instead of the marker branch.
    return { [ESCAPE_MARKER]: copy } as T;
  }
  return copy as T;
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
  revive<T>(value: T, current?: unknown): T;
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
    depth: number,
    seen: WeakSet<object>
  ): unknown => {
    if (depth >= MAX_DEPTH || value === null || typeof value !== 'object') {
      return value;
    }
    if (seen.has(value)) {
      return value;
    }
    if (Array.isArray(value)) {
      seen.add(value);
      const currentArray = Array.isArray(current) ? current : undefined;
      return value.map((element, index) =>
        reviveNode(element, currentArray?.[index], [...path, index], false, depth + 1, seen)
      );
    }
    if (!isPlainObject(value)) {
      return value;
    }
    seen.add(value);
    const keys = Object.keys(value);
    if (
      !escaped &&
      keys.length === 1 &&
      keys[0] === ESCAPE_MARKER &&
      isPlainObject(value[ESCAPE_MARKER])
    ) {
      // Our escape wrapper: the object inside is literal user data, so its own `__function__` key
      // must not be treated as a marker, while its children get normal codec treatment.
      return reviveNode(value[ESCAPE_MARKER], current, path, true, depth + 1, seen);
    }
    if (!escaped && hasOwn(value, FUNCTION_MARKER)) {
      return reviveMarker(value[FUNCTION_MARKER], current, path);
    }
    const currentObject =
      current !== null && typeof current === 'object' ? (current as PlainObject) : undefined;
    const copy: Record<string, unknown> = {};
    for (const key of keys) {
      copy[key] = reviveNode(
        value[key],
        currentObject?.[key],
        [...path, key],
        false,
        depth + 1,
        seen
      );
    }
    return copy;
  };

  return {
    revive: <T>(value: T, current?: unknown): T =>
      reviveNode(value, current, [], false, 0, new WeakSet()) as T,
  };
}

/**
 * Replaces every `{ __function__: { name } }` marker in `value` with a function, resolving
 * against `current` (the value stored at the same path) when it is a function with the same
 * name. Returns a new structure; the input is never mutated.
 */
export function reviveArgFunctions<T>(value: T, current?: unknown): T {
  return createArgFunctionReviver().revive(value, current);
}
