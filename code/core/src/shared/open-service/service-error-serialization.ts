/**
 * Error (de)serialization for remote command execution.
 *
 * A command invoked from a runtime that has no local handler runs on a peer; when it throws, the
 * thrown value has to cross the channel and be rethrown on the requester. `Error` instances are not
 * structured-cloneable in a way that survives a websocket (JSON) or postMessage transport with their
 * `name`, `stack`, `cause`, and Storybook-specific fields (`code`, `fromStorybook`, …) intact, so we
 * convert to and from a plain, transport-safe shape here.
 *
 * The conversion is recursive: an error's `cause` (and any nested arrays/objects, e.g. the
 * `cause.aggregated` array used by the `.loaded()` drain) is walked so a multi-cause failure arrives
 * on the requester with its chain reconstructed rather than flattened to a single message.
 */

/** Marks a serialized object as a reconstructable `Error` rather than a plain payload object. */
const ERROR_MARKER = '__openServiceError__' as const;

/** Keys handled explicitly so they are not duplicated into the extra-properties bag. */
const RESERVED_KEYS = new Set<string>([ERROR_MARKER, 'name', 'message', 'stack', 'cause']);

/** Transport-safe representation of a thrown `Error`, including its recursive `cause` chain. */
export interface SerializedError {
  [ERROR_MARKER]: true;
  name: string;
  message: string;
  stack?: string;
  /** The error's `cause`, itself serialized (another error, a plain object, an array, …). */
  cause?: unknown;
  /** Extra own enumerable fields (e.g. Storybook's `code`, `fromStorybook`), serialized. */
  properties?: Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSerializedError(value: unknown): value is SerializedError {
  return isPlainObject(value) && value[ERROR_MARKER] === true;
}

/**
 * Reduces any value to one a channel transport can clone.
 *
 * Functions, symbols, and `undefined` are dropped (structuredClone throws on functions/symbols);
 * `bigint` is stringified; plain objects and arrays are walked; `Error`s become {@link SerializedError}.
 */
function toTransportSafe(value: unknown): unknown {
  if (value instanceof Error) {
    return serializeError(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toTransportSafe(entry));
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = toTransportSafe(entry);
    }
    return result;
  }

  if (value === null) {
    return null;
  }

  const kind = typeof value;
  if (kind === 'string' || kind === 'number' || kind === 'boolean') {
    return value;
  }
  if (kind === 'bigint') {
    return (value as bigint).toString();
  }

  // function / symbol / undefined: not cloneable and not meaningful on the wire.
  return undefined;
}

/**
 * Converts a thrown value into a transport-safe {@link SerializedError}.
 *
 * Non-`Error` throws (a string, an object, …) are wrapped in a synthetic error whose message is the
 * stringified value, so the requester always receives a real `Error` to reject with.
 */
export function serializeError(value: unknown): SerializedError {
  if (!(value instanceof Error)) {
    return { [ERROR_MARKER]: true, name: 'Error', message: String(value) };
  }

  const properties: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    if (!RESERVED_KEYS.has(key)) {
      properties[key] = toTransportSafe((value as unknown as Record<string, unknown>)[key]);
    }
  }

  return {
    [ERROR_MARKER]: true,
    name: value.name,
    message: value.message,
    ...(value.stack !== undefined ? { stack: value.stack } : {}),
    ...(value.cause !== undefined ? { cause: toTransportSafe(value.cause) } : {}),
    ...(Object.keys(properties).length > 0 ? { properties } : {}),
  };
}

/** Inverse of {@link toTransportSafe}: rebuilds nested errors while passing other values through. */
function fromTransportSafe(value: unknown): unknown {
  if (isSerializedError(value)) {
    return deserializeError(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => fromTransportSafe(entry));
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = fromTransportSafe(entry);
    }
    return result;
  }

  return value;
}

/**
 * Rebuilds an `Error` from a {@link SerializedError}, restoring its `name`, `stack`, `cause` chain,
 * and any extra fields (so a Storybook error arrives with `code`/`fromStorybook` intact).
 *
 * The result is a plain `Error`, not the original subclass — reconstructing arbitrary classes across
 * a realm boundary is neither possible nor needed; callers branch on the restored fields instead.
 */
export function deserializeError(serialized: SerializedError): Error {
  // A generic Error is intentional: this reconstructs an arbitrary error thrown in another runtime
  // (its original class cannot cross the realm boundary). Storybook-specific fields like `code` and
  // `fromStorybook` are restored from `properties`, so callers can still branch on them.
  // eslint-disable-next-line local-rules/no-uncategorized-errors
  const error = new Error(serialized.message);
  error.name = serialized.name;

  if (serialized.stack !== undefined) {
    error.stack = serialized.stack;
  }
  if ('cause' in serialized) {
    error.cause = fromTransportSafe(serialized.cause);
  }
  if (serialized.properties) {
    for (const [key, value] of Object.entries(serialized.properties)) {
      (error as unknown as Record<string, unknown>)[key] = fromTransportSafe(value);
    }
  }

  return error;
}
