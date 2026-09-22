import { clonePlain, hasOwn, isPlainObject, isReservedKey } from './plain-object.ts';
import { decodePointer, isRfc6901Pointer, type JsonPatchOperation } from './service-channel.ts';

export type ApplyJsonPatchResult = { ok: true } | { ok: false; path: string };

function parentAt(
  root: Record<string, unknown>,
  segments: readonly string[]
): { parent: Record<string, unknown>; key: string } | undefined {
  if (segments.length === 0) {
    return undefined;
  }

  let current: unknown = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (isReservedKey(segment) || !isPlainObject(current) || !hasOwn(current, segment)) {
      return undefined;
    }
    current = current[segment];
  }

  // Arrays are atomic values, so a non-object in the path is a missing parent.
  if (!isPlainObject(current)) {
    return undefined;
  }

  return { parent: current, key: segments[segments.length - 1] };
}

class MissingParentError extends Error {
  readonly path: string;

  constructor(path: string) {
    super(`Missing parent for JSON Patch path ${path}`);
    this.name = 'MissingParentError';
    this.path = path;
  }
}

/**
 * Apply an RFC 6902 document onto `target` in place.
 *
 * `add` and `replace` both upsert. `remove` of a missing key calls `onMissingRemove` and continues.
 * Incoming values are cloned. A missing parent, reserved key, or invalid pointer rolls back every
 * op already applied in this call and returns `{ ok: false, path }` for that pointer. Any other
 * throw also rolls back, then rethrows.
 */
export function applyJsonPatch(
  target: Record<string, unknown>,
  patch: readonly JsonPatchOperation[],
  onMissingRemove: (path: string) => void
): ApplyJsonPatchResult {
  const undo: Array<() => void> = [];

  try {
    for (const operation of patch) {
      applyOne(target, operation, undo, onMissingRemove);
    }
    return { ok: true };
  } catch (error) {
    for (const revert of undo.reverse()) {
      revert();
    }
    if (error instanceof MissingParentError) {
      return { ok: false, path: error.path };
    }
    throw error;
  }
}

function applyOne(
  target: Record<string, unknown>,
  operation: JsonPatchOperation,
  undo: Array<() => void>,
  onMissingRemove: (path: string) => void
): void {
  if (!isRfc6901Pointer(operation.path)) {
    throw new MissingParentError(operation.path);
  }

  const location = parentAt(target, decodePointer(operation.path));
  if (!location || isReservedKey(location.key)) {
    throw new MissingParentError(operation.path);
  }

  const { parent, key } = location;

  switch (operation.op) {
    case 'add':
    case 'replace': {
      // RFC 6902 add fails if the key exists and replace fails if it does not. Entries upsert:
      // add vs replace is whether the author had the key, not whether this replica does.
      const existed = hasOwn(parent, key);
      // parent[key] may be a deepsignal proxy; restoring that proxy poisons the backing store.
      const previous = existed ? clonePlain(parent[key]) : undefined;
      parent[key] = clonePlain(operation.value);
      undo.push(() => {
        if (existed) {
          parent[key] = previous;
        } else {
          delete parent[key];
        }
      });
      return;
    }
    case 'remove': {
      if (!hasOwn(parent, key)) {
        onMissingRemove(operation.path);
        return;
      }
      const previous = clonePlain(parent[key]);
      delete parent[key];
      undo.push(() => {
        parent[key] = previous;
      });
      return;
    }
    default: {
      const exhaustive: never = operation;
      void exhaustive;
    }
  }
}
