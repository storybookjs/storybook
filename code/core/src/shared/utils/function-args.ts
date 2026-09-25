/**
 * Functions cannot cross the channel: `telejson.stringify` drops function-typed values (as
 * `JSON.stringify` does), so any function nested in an args payload disappears before the manager
 * sees it. The result is that the Controls panel renders object args without their function keys
 * (#29207), while the docs page, rendered next to the real args in the preview, shows them.
 *
 * These helpers close that gap at the two boundaries the payloads cross. The preview replaces each
 * function with a `{ __function__: { name } }` marker, the same wire shape the instrumenter uses
 * for call arguments, and the manager revives the markers back into named no-op functions so every
 * consumer of story args (the Controls panel's JSON tree, URL diffing, save-story) sees "a function
 * lives here" rather than a hole.
 */

/** Matches the marker key the instrumenter's serialization of call arguments uses. */
const FUNCTION_MARKER = '__function__';

/** The channel serializes with telejson's default `maxDepth` of 25; never walk deeper than that. */
const MAX_DEPTH = 25;

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === Object.prototype || proto === null;
}

/**
 * Replaces every function in `value` (at any depth, up to the transport's max depth) with a
 * `{ __function__: { name } }` marker. Returns a new structure; the input is never mutated, because
 * the preview keeps living references to these args objects. Non-plain objects (class instances,
 * Dates, RegExps, ...) are passed through untouched and left to the transport, exactly as today.
 */
export function serializeArgFunctions<T>(value: T, depth = 0, seen = new WeakSet<object>()): T {
  if (typeof value === 'function') {
    const name = value.name;
    return { [FUNCTION_MARKER]: { name: typeof name === 'string' ? name : '' } } as T;
  }
  if (depth >= MAX_DEPTH || seen.has(value)) {
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
  return copy as T;
}

/**
 * Revived functions are memoized per name so the same identity is restored on every event.
 * Story args are diffed by reference in the manager (URL args, the save-story bar), so distinct
 * instances revived from two events describing the same unchanged function would show up as
 * phantom changes.
 */
const revivedFunctions = new Map<string, () => void>();

function namedFunction(name: string): () => void {
  let fn = revivedFunctions.get(name);
  if (!fn) {
    // The computed property key gives the anonymous function its `name`.
    fn = { [name]: function () {} }[name];
    revivedFunctions.set(name, fn);
  }
  return fn;
}

/**
 * Replaces every `{ __function__: { name } }` marker in `value` with the memoized named no-op
 * function for that name. Returns a new structure; the input is never mutated.
 */
export function reviveArgFunctions<T>(value: T, depth = 0, seen = new WeakSet<object>()): T {
  if (depth >= MAX_DEPTH || seen.has(value)) {
    return value;
  }
  if (!Array.isArray(value) && !isPlainObject(value)) {
    return value;
  }
  if (!Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, FUNCTION_MARKER)) {
    const marker = value[FUNCTION_MARKER];
    const name = isPlainObject(marker) && typeof marker.name === 'string' ? marker.name : '';
    return namedFunction(name) as T;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((element) => reviveArgFunctions(element, depth + 1, seen)) as T;
  }
  const copy: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    copy[key] = reviveArgFunctions(value[key], depth + 1, seen);
  }
  return copy as T;
}
