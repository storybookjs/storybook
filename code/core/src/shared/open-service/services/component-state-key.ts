import { getOwn, isReservedKey } from '../plain-object.ts';

const ESCAPE = '~';

// State drops reserved keys, so the component id `constructor` is stored as `~constructor`. An id
// that already starts with `~` (a custom `__id`) is escaped too, so no two ids share a key.
export function toComponentStateKey(id: string): string {
  return isReservedKey(id) || id.startsWith(ESCAPE) ? `${ESCAPE}${id}` : id;
}

export function fromComponentStateKey(key: string): string {
  return key.startsWith(ESCAPE) ? key.slice(ESCAPE.length) : key;
}

export function readComponent<TPayload>(
  components: Record<string, TPayload>,
  id: string
): TPayload | undefined {
  return getOwn(components, toComponentStateKey(id));
}

export function readAllComponents<TPayload>(
  components: Record<string, TPayload>
): Record<string, TPayload> {
  return Object.fromEntries(
    Object.entries(components).map(([key, payload]) => [fromComponentStateKey(key), payload])
  );
}
