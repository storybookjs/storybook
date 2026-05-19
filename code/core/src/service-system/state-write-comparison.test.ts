/**
 * setState ergonomics — three-way API comparison
 *
 * Same four scenarios across all three options so you can read down each
 * column and vote on which syntax you prefer.
 *
 * ┌──────────┬───────────────────────────────────────────────────────────────┐
 * │          │ Same nested update: settings.darkMode = true                  │
 * ├──────────┼───────────────────────────────────────────────────────────────┤
 * │ Option A │ ctx.setState(prev => ({                                        │
 * │ immutable│   ...prev,                                                    │
 * │ updater  │   settings: { ...prev.settings, darkMode: true },             │
 * │          │ }))                                                           │
 * ├──────────┼───────────────────────────────────────────────────────────────┤
 * │ Option B │ ctx.setState(draft => {                                        │
 * │  draft   │   draft.settings.darkMode = true;                            │
 * │ mutation │ })                                                            │
 * ├──────────┼───────────────────────────────────────────────────────────────┤
 * │ Option C │ ctx.state.settings.darkMode = true;                           │
 * │  direct  │ // — no setState call at all                                  │
 * │ mutation │                                                               │
 * └──────────┴───────────────────────────────────────────────────────────────┘
 *
 * Consumer API (queries / subscribe) is identical across all three.
 *
 * ⚠️  Option C caveat: concurrent async commands exhibit "last write wins"
 *     (see the dedicated test at the bottom). Options A and B are safe.
 */

import { describe, expect, it } from 'vitest';
import { batch, computed, effect, signal } from '@preact/signals-core';

// ─────────────────────────────────────────────── shared state + query ──────

type State = {
  /** Flat map: story → status string */
  status: Record<string, string>;
  /** Pre-initialised nested object */
  settings: { darkMode: boolean; fontSize: number };
  /** Array of tags */
  tags: string[];
};

const makeState = (): State => ({
  status: {},
  settings: { darkMode: false, fontSize: 14 },
  tags: [],
});

/** Minimal query helper — returned type and subscribe() are identical in all options. */
function query<TIn, TOut>(
  s: ReturnType<typeof signal<State>>,
  fn: (input: TIn, state: State) => TOut
) {
  return {
    get: (input: TIn) => fn(input, s.value),
    subscribe: (input: TIn, cb: (v: TOut) => void) => {
      const comp = computed(() => fn(input, s.value));
      return effect(() => cb(comp.value));
    },
  };
}

// ════════════════════════════════════════════════════════════════════════════
// OPTION A — Immutable updater
// ctx.setState(prev => ({ ...prev, key: newValue }))
//
// Pros: explicit data flow, no hidden mutation, safe for concurrent async
// Cons: verbose for nested/array updates — spread noise grows with depth
// ════════════════════════════════════════════════════════════════════════════

type CtxA = {
  readonly state: State;
  setState(updater: (prev: State) => State): void;
};

function makeCtxA(s: ReturnType<typeof signal<State>>): CtxA {
  return {
    get state() {
      return s.value;
    },
    setState(updater) {
      batch(() => {
        s.value = updater(s.value);
      });
    },
  };
}

describe('Option A — immutable updater', () => {
  it('flat: set a status entry', () => {
    const s = signal(makeState());
    const ctx = makeCtxA(s);

    // ✍️ service author:
    ctx.setState((prev) => ({ ...prev, status: { ...prev.status, 'story-a': 'pass' } }));

    // 👁️ consumer:
    const getStatus = query(s, (id: string, state) => state.status[id]);
    expect(getStatus.get('story-a')).toBe('pass');
  });

  it('nested: toggle a settings flag', () => {
    const s = signal(makeState());
    const ctx = makeCtxA(s);

    // ✍️ service author:
    ctx.setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, darkMode: true },
    }));

    // 👁️ consumer:
    const getSettings = query(s, (_, state) => state.settings);
    expect(getSettings.get(null)).toEqual({ darkMode: true, fontSize: 14 });
  });

  it('array: push a tag', () => {
    const s = signal(makeState());
    const ctx = makeCtxA(s);

    // ✍️ service author:
    ctx.setState((prev) => ({ ...prev, tags: [...prev.tags, 'a11y'] }));
    ctx.setState((prev) => ({ ...prev, tags: [...prev.tags, 'perf'] }));

    // 👁️ consumer:
    const getTags = query(s, (_, state) => state.tags);
    expect(getTags.get(null)).toEqual(['a11y', 'perf']);
  });

  it('subscribe: reactive to state changes', () => {
    const s = signal(makeState());
    const ctx = makeCtxA(s);
    const calls: (string | undefined)[] = [];

    const getStatus = query(s, (id: string, state) => state.status[id]);
    const unsub = getStatus.subscribe('story-a', (v) => calls.push(v));

    ctx.setState((prev) => ({ ...prev, status: { ...prev.status, 'story-a': 'pass' } }));

    expect(calls).toEqual([undefined, 'pass']);
    unsub();
  });

  it('subscribe: no notification when watched slice is unchanged', () => {
    const s = signal(makeState());
    const ctx = makeCtxA(s);
    const calls: (string | undefined)[] = [];

    const getStatus = query(s, (id: string, state) => state.status[id]);
    const unsub = getStatus.subscribe('story-a', (v) => calls.push(v));

    // Change a completely different slice of state
    ctx.setState((prev) => ({ ...prev, tags: [...prev.tags, 'a11y'] }));

    // Only the initial effect() call — no second notification
    expect(calls).toEqual([undefined]);
    unsub();
  });

  it('concurrent async: both writes survive (setState always reads latest signal)', async () => {
    const s = signal(makeState());
    const ctx = makeCtxA(s);

    // Two async commands run concurrently; each calls setState after an await.
    // Because setState reads s.value at call time (not command start time),
    // the second command sees the first command's committed state.
    await Promise.all([
      (async () => {
        await Promise.resolve();
        ctx.setState((prev) => ({ ...prev, status: { ...prev.status, 'story-a': 'cmd-1' } }));
      })(),
      (async () => {
        await Promise.resolve();
        ctx.setState((prev) => ({ ...prev, status: { ...prev.status, 'story-b': 'cmd-2' } }));
      })(),
    ]);

    expect(s.value.status['story-a']).toBe('cmd-1');
    expect(s.value.status['story-b']).toBe('cmd-2');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// OPTION B — Draft mutation (structuredClone, no extra dependencies)
// ctx.setState(draft => { draft.settings.darkMode = true; })
//
// Pros: mutable syntax, no spread noise, arrays just work, safe concurrency
// Cons: still requires a wrapper function; structuredClone on every setState
// ════════════════════════════════════════════════════════════════════════════

type CtxB = {
  readonly state: State;
  setState(mutate: (draft: State) => void): void;
};

function makeCtxB(s: ReturnType<typeof signal<State>>): CtxB {
  return {
    get state() {
      return s.value;
    },
    setState(mutate) {
      batch(() => {
        const draft = structuredClone(s.value as object) as State;
        mutate(draft);
        s.value = draft;
      });
    },
  };
}

describe('Option B — draft mutation', () => {
  it('flat: set a status entry', () => {
    const s = signal(makeState());
    const ctx = makeCtxB(s);

    // ✍️ service author:
    ctx.setState((draft) => {
      draft.status['story-a'] = 'pass';
    });

    // 👁️ consumer (identical to Option A):
    const getStatus = query(s, (id: string, state) => state.status[id]);
    expect(getStatus.get('story-a')).toBe('pass');
  });

  it('nested: toggle a settings flag', () => {
    const s = signal(makeState());
    const ctx = makeCtxB(s);

    // ✍️ service author:
    ctx.setState((draft) => {
      draft.settings.darkMode = true;
    });

    // 👁️ consumer:
    const getSettings = query(s, (_, state) => state.settings);
    expect(getSettings.get(null)).toEqual({ darkMode: true, fontSize: 14 });
  });

  it('array: push a tag', () => {
    const s = signal(makeState());
    const ctx = makeCtxB(s);

    // ✍️ service author:
    ctx.setState((draft) => {
      draft.tags.push('a11y');
    });
    ctx.setState((draft) => {
      draft.tags.push('perf');
    });

    // 👁️ consumer:
    const getTags = query(s, (_, state) => state.tags);
    expect(getTags.get(null)).toEqual(['a11y', 'perf']);
  });

  it('subscribe: reactive to state changes', () => {
    const s = signal(makeState());
    const ctx = makeCtxB(s);
    const calls: (string | undefined)[] = [];

    const getStatus = query(s, (id: string, state) => state.status[id]);
    const unsub = getStatus.subscribe('story-a', (v) => calls.push(v));

    ctx.setState((draft) => {
      draft.status['story-a'] = 'pass';
    });

    expect(calls).toEqual([undefined, 'pass']);
    unsub();
  });

  it('subscribe: no notification when watched slice is unchanged', () => {
    const s = signal(makeState());
    const ctx = makeCtxB(s);
    const calls: (string | undefined)[] = [];

    const getStatus = query(s, (id: string, state) => state.status[id]);
    const unsub = getStatus.subscribe('story-a', (v) => calls.push(v));

    // Change a completely different slice of state
    ctx.setState((draft) => {
      draft.tags.push('a11y');
    });

    // Only the initial effect() call — no second notification
    expect(calls).toEqual([undefined]);
    unsub();
  });

  it('concurrent async: both writes survive (same as Option A)', async () => {
    const s = signal(makeState());
    const ctx = makeCtxB(s);

    await Promise.all([
      (async () => {
        await Promise.resolve();
        ctx.setState((draft) => {
          draft.status['story-a'] = 'cmd-1';
        });
      })(),
      (async () => {
        await Promise.resolve();
        ctx.setState((draft) => {
          draft.status['story-b'] = 'cmd-2';
        });
      })(),
    ]);

    expect(s.value.status['story-a']).toBe('cmd-1');
    expect(s.value.status['story-b']).toBe('cmd-2');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// OPTION C — Direct mutation, no setState at all
// ctx.state.settings.darkMode = true
//
// How it works: ctx.state is a per-execution mutable clone (structuredClone).
// Mutations accumulate on it during the handler. When the handler resolves
// (sync or async), the draft is committed to the signal in one batch.
// No Proxy, no $ dollar-sign prefix — it's just a plain object.
//
// Pros: no wrapper function, most natural mutation syntax
// Cons: ⚠️ concurrent async commands exhibit "last write wins" (see last test)
// ════════════════════════════════════════════════════════════════════════════

type CtxC = {
  state: State; // intentionally mutable — no Proxy, no $ required
};

/** Each call clones the current state, hands it to the handler, then commits. */
function runC(
  s: ReturnType<typeof signal<State>>,
  handler: (ctx: CtxC) => void | Promise<void>
): Promise<void> {
  const draft = structuredClone(s.value as object) as State;
  return Promise.resolve(handler({ state: draft })).then(() => {
    batch(() => {
      s.value = draft;
    });
  });
}

describe('Option C — direct mutation (no setState, no Proxy, no $)', () => {
  it('flat: set a status entry', async () => {
    const s = signal(makeState());

    // ✍️ service author:
    await runC(s, (ctx) => {
      ctx.state.status['story-a'] = 'pass';
    });

    // 👁️ consumer (identical to Options A and B):
    const getStatus = query(s, (id: string, state) => state.status[id]);
    expect(getStatus.get('story-a')).toBe('pass');
  });

  it('nested: toggle a settings flag', async () => {
    const s = signal(makeState());

    // ✍️ service author:
    await runC(s, (ctx) => {
      ctx.state.settings.darkMode = true;
    });

    // 👁️ consumer:
    const getSettings = query(s, (_, state) => state.settings);
    expect(getSettings.get(null)).toEqual({ darkMode: true, fontSize: 14 });
  });

  it('array: push a tag', async () => {
    const s = signal(makeState());

    // ✍️ service author:
    await runC(s, (ctx) => {
      ctx.state.tags.push('a11y');
    });
    await runC(s, (ctx) => {
      ctx.state.tags.push('perf');
    });

    // 👁️ consumer:
    const getTags = query(s, (_, state) => state.tags);
    expect(getTags.get(null)).toEqual(['a11y', 'perf']);
  });

  it('subscribe: reactive to state changes', async () => {
    const s = signal(makeState());
    const calls: (string | undefined)[] = [];

    const getStatus = query(s, (id: string, state) => state.status[id]);
    const unsub = getStatus.subscribe('story-a', (v) => calls.push(v));

    await runC(s, (ctx) => {
      ctx.state.status['story-a'] = 'pass';
    });

    expect(calls).toEqual([undefined, 'pass']);
    unsub();
  });

  it('subscribe: no notification when watched slice is unchanged', async () => {
    const s = signal(makeState());
    const calls: (string | undefined)[] = [];

    const getStatus = query(s, (id: string, state) => state.status[id]);
    const unsub = getStatus.subscribe('story-a', (v) => calls.push(v));

    // Change a completely different slice of state
    await runC(s, (ctx) => {
      ctx.state.tags.push('a11y');
    });

    // Only the initial effect() call — no second notification
    expect(calls).toEqual([undefined]);
    unsub();
  });

  it('⚠️ concurrent async: last write wins — story-a is lost', async () => {
    const s = signal(makeState());

    // Both commands clone state at T=0 before either has committed.
    // When they commit, the second overwrites the first because each
    // draft was taken from the same initial snapshot.
    //
    // Contrast with Options A/B where setState(updater) reads the
    // LATEST signal value at commit time, so both writes survive.
    await Promise.all([
      runC(s, async (ctx) => {
        await Promise.resolve(); // simulates real async work
        ctx.state.status['story-a'] = 'cmd-1';
      }),
      runC(s, async (ctx) => {
        await Promise.resolve();
        ctx.state.status['story-b'] = 'cmd-2';
      }),
    ]);

    // Only one survives — whichever committed last
    expect(Object.keys(s.value.status)).toHaveLength(1);
  });
});
