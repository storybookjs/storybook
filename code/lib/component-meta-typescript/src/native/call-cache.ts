// Get a key's value from a Map or WeakMap, computing and storing it on the first call.
export const getOrCompute = <Key, Value>(
  map: {
    get(key: Key): Value | undefined;
    has(key: Key): boolean;
    set(key: Key, value: Value): unknown;
  },
  key: Key,
  compute: () => Value
): Value => {
  let value = map.get(key);
  if (value === undefined && !map.has(key)) {
    value = compute();
    map.set(key, value);
  }
  return value as Value;
};

interface CallLevel {
  objects?: WeakMap<object, CallLevel>;
  values?: Map<unknown, CallLevel>;
  answered?: boolean;
  answer?: unknown;
}

// The answers of pure checker queries, keyed by their arguments' identity. Every argument is a
// facade, a node or a primitive of one snapshot, so an answer holds for that snapshot's life.
export class CallCache {
  private readonly methods = new Map<string, CallLevel>();

  answer<Answer>(method: string, args: readonly unknown[], ask: () => Answer): Answer {
    let level = getOrCompute(this.methods, method, (): CallLevel => ({}));
    for (const arg of args) {
      level =
        arg !== null && typeof arg === 'object'
          ? getOrCompute((level.objects ??= new WeakMap()), arg, (): CallLevel => ({}))
          : getOrCompute((level.values ??= new Map()), arg, (): CallLevel => ({}));
    }
    if (!level.answered) {
      level.answer = ask();
      level.answered = true;
    }
    return level.answer as Answer;
  }
}
