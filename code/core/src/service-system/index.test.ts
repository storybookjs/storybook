import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildStaticFiles,
  clearRegistry,
  configureStaticMode,
  defineCommand,
  defineQuery,
  defineService,
  getService,
} from './index.ts';

// ----------------------------------------------------------------- fixture --

// A simple status service: { [storyId]: { [typeId]: string } }
type StatusState = Record<string, Record<string, string> | undefined>;

const statusServiceDef = defineService({
  id: 'test/status',
  initialState: {} as StatusState,
  queries: {
    getStoryStatus: defineQuery<StatusState, { storyId: string }, Record<string, string> | null>({
      handler: (input: { storyId: string }, ctx) => ctx.self.state[input.storyId] ?? null,
    }),
  },
  commands: {
    setStatus: defineCommand<StatusState, { storyId: string; typeId: string; value: string }>({
      handler: (input: { storyId: string; typeId: string; value: string }, ctx) => {
        ctx.self.setState((s) => ({
          ...s,
          [input.storyId]: { ...s[input.storyId], [input.typeId]: input.value },
        }));
      },
    }),
  },
});

// A service with an async command used to test preload auto-population.
// Simulates a query whose data must be loaded on first subscribe.
// The command also carries `static` config so buildStaticFiles() can pre-compute results.
type AuditState = Record<string, string | undefined>;

const auditServiceDef = defineService({
  id: 'test/audit',
  initialState: {} as AuditState,
  queries: {
    getAuditResult: defineQuery<AuditState, { storyId: string }, string | null>({
      handler: (input: { storyId: string }, ctx) => ctx.self.state[input.storyId] ?? null,
      // Returning the Promise from the command makes direct `await query(input)`
      // wait for the load to finish before returning the value.
      // subscribe() works reactively regardless of whether you return here.
      preload: (input, ctx) => {
        if (!(input.storyId in ctx.self.state)) {
          return ctx.self.commands.runAudit(input);
        }
      },
      static: {
        // path is omitted — the default `{serviceId}/{queryName}/{hash}.json`
        // is used, e.g. `test/audit/getAuditResult/4bd3f151.json`
        inputs: async (_ctx) => [{ storyId: 'story-a' }, { storyId: 'story-b' }],
      },
    }),
  },
  commands: {
    runAudit: defineCommand<AuditState, { storyId: string }>({
      handler: async (input: { storyId: string }, ctx) => {
        // Simulate an async operation (network call, worker, etc.)
        await Promise.resolve();
        ctx.self.setState((s) => ({ ...s, [input.storyId]: 'pass' }));
      },
    }),
  },
});

// A variant where preload fires but does NOT return the Promise,
// so direct calls resolve immediately (fire-and-forget style).
const lazyAuditServiceDef = defineService({
  id: 'test/lazy-audit',
  initialState: {} as AuditState,
  queries: {
    getAuditResult: defineQuery<AuditState, { storyId: string }, string | null>({
      handler: (input: { storyId: string }, ctx) => ctx.self.state[input.storyId] ?? null,
      preload: (input, ctx) => {
        // No return — fire-and-forget
        if (!(input.storyId in ctx.self.state)) ctx.self.commands.runAudit(input);
      },
    }),
  },
  commands: {
    runAudit: defineCommand<AuditState, { storyId: string }>({
      handler: async (input: { storyId: string }, ctx) => {
        await Promise.resolve();
        ctx.self.setState((s) => ({ ...s, [input.storyId]: 'pass' }));
      },
    }),
  },
});

// ------------------------------------------------------------------- tests --

afterEach(() => {
  clearRegistry();
});

describe('direct query calls', () => {
  it('returns the initial state', async () => {
    const service = getService(statusServiceDef);
    expect(await service.queries.getStoryStatus({ storyId: 'story-a' })).toBeNull();
  });

  it('reflects state after a command', async () => {
    const service = getService(statusServiceDef);
    await service.commands.setStatus({ storyId: 'story-a', typeId: 'a11y', value: 'pass' });
    expect(await service.queries.getStoryStatus({ storyId: 'story-a' })).toEqual({ a11y: 'pass' });
  });
});

describe('subscribe — notification behaviour', () => {
  it('fires immediately with the current value on subscribe', () => {
    const service = getService(statusServiceDef);
    const calls: any[] = [];

    const unsub = service.queries.getStoryStatus.subscribe({ storyId: 'story-a' }, (v) =>
      calls.push(v)
    );

    expect(calls).toEqual([null]); // immediate call, no change yet
    unsub();
  });

  it('notifies subscriber when its own state changes', async () => {
    const service = getService(statusServiceDef);
    const calls: any[] = [];

    const unsub = service.queries.getStoryStatus.subscribe({ storyId: 'story-a' }, (v) =>
      calls.push(v)
    );

    await service.commands.setStatus({ storyId: 'story-a', typeId: 'a11y', value: 'warn' });

    expect(calls).toEqual([
      null, // initial
      { a11y: 'warn' }, // after command
    ]);
    unsub();
  });

  it('does NOT notify a subscriber when a different story changes', async () => {
    const service = getService(statusServiceDef);
    const callsA: any[] = [];
    const callsB: any[] = [];

    const unsubA = service.queries.getStoryStatus.subscribe({ storyId: 'story-a' }, (v) =>
      callsA.push(v)
    );
    const unsubB = service.queries.getStoryStatus.subscribe({ storyId: 'story-b' }, (v) =>
      callsB.push(v)
    );

    // Only change story-b
    await service.commands.setStatus({ storyId: 'story-b', typeId: 'a11y', value: 'pass' });

    expect(callsA).toEqual([null]); // initial only — never re-notified
    expect(callsB).toEqual([null, { a11y: 'pass' }]); // initial + change
    unsubA();
    unsubB();
  });

  it('stops notifying after unsubscribe', async () => {
    const service = getService(statusServiceDef);
    const calls: any[] = [];

    const unsub = service.queries.getStoryStatus.subscribe({ storyId: 'story-a' }, (v) =>
      calls.push(v)
    );

    await service.commands.setStatus({ storyId: 'story-a', typeId: 'a11y', value: 'warn' });
    unsub();
    await service.commands.setStatus({ storyId: 'story-a', typeId: 'a11y', value: 'pass' });

    // Only the initial + first change — nothing after unsubscribe
    expect(calls).toEqual([null, { a11y: 'warn' }]);
  });

  it('handles multiple independent subscribers on the same query', async () => {
    const service = getService(statusServiceDef);
    const calls1: any[] = [];
    const calls2: any[] = [];

    const unsub1 = service.queries.getStoryStatus.subscribe({ storyId: 'story-a' }, (v) =>
      calls1.push(v)
    );
    const unsub2 = service.queries.getStoryStatus.subscribe({ storyId: 'story-a' }, (v) =>
      calls2.push(v)
    );

    await service.commands.setStatus({ storyId: 'story-a', typeId: 'a11y', value: 'fail' });

    expect(calls1).toEqual([null, { a11y: 'fail' }]);
    expect(calls2).toEqual([null, { a11y: 'fail' }]);
    unsub1();
    unsub2();
  });
});

describe('preload — auto-population on subscribe', () => {
  it('automatically loads state when subscribing to an empty query', async () => {
    const service = getService(auditServiceDef);
    const calls: any[] = [];

    const unsub = service.queries.getAuditResult.subscribe({ storyId: 'story-a' }, (v) =>
      calls.push(v)
    );

    // Before the async command resolves: initial value is null (not loaded)
    expect(calls).toEqual([null]);

    // Wait for the async command triggered by preload to complete
    await Promise.resolve();

    expect(calls).toEqual([null, 'pass']);
    unsub();
  });

  it('does NOT trigger preload again for a second subscriber when state is already loaded', async () => {
    const service = getService(auditServiceDef);
    const runAuditSpy = vi.spyOn(auditServiceDef.commands.runAudit, 'handler');

    // First subscriber — triggers preload, loads state
    const unsub1 = service.queries.getAuditResult.subscribe({ storyId: 'story-a' }, () => {});
    await Promise.resolve(); // let the async command finish

    // Second subscriber — state is already loaded, preload should not re-run the command
    const secondCalls: any[] = [];
    const unsub2 = service.queries.getAuditResult.subscribe({ storyId: 'story-a' }, (v) =>
      secondCalls.push(v)
    );

    expect(runAuditSpy).toHaveBeenCalledTimes(1); // only once, from first subscribe
    expect(secondCalls).toEqual(['pass']); // immediately gets the loaded value

    unsub1();
    unsub2();
    runAuditSpy.mockRestore();
  });

  it('each distinct storyId triggers its own preload independently', async () => {
    const service = getService(auditServiceDef);
    const callsA: any[] = [];
    const callsB: any[] = [];

    const unsubA = service.queries.getAuditResult.subscribe({ storyId: 'story-a' }, (v) =>
      callsA.push(v)
    );
    const unsubB = service.queries.getAuditResult.subscribe({ storyId: 'story-b' }, (v) =>
      callsB.push(v)
    );

    expect(callsA).toEqual([null]);
    expect(callsB).toEqual([null]);

    await Promise.resolve(); // both async commands resolve

    expect(callsA).toEqual([null, 'pass']);
    expect(callsB).toEqual([null, 'pass']);

    unsubA();
    unsubB();
  });
});

describe('direct await — preload with returned Promise', () => {
  it('awaiting a query with preload waits for the load and returns the value', async () => {
    const service = getService(auditServiceDef);

    // No manual command needed — the query triggers and awaits its own preload.
    const result = await service.queries.getAuditResult({ storyId: 'story-a' });

    expect(result).toBe('pass');
  });

  it('resolves immediately when state is already loaded (no round-trip)', async () => {
    const service = getService(auditServiceDef);
    const runAuditSpy = vi.spyOn(auditServiceDef.commands.runAudit, 'handler');

    // Pre-populate
    await service.queries.getAuditResult({ storyId: 'story-a' });
    runAuditSpy.mockClear();

    // Second call — preload sees state already exists and returns void
    const result = await service.queries.getAuditResult({ storyId: 'story-a' });

    expect(runAuditSpy).not.toHaveBeenCalled();
    expect(result).toBe('pass');
    runAuditSpy.mockRestore();
  });

  it('concurrent awaits for the same key both resolve correctly', async () => {
    const service = getService(auditServiceDef);

    // Both fire at the same time — each creates its own preload call,
    // but the guard `!(storyId in state)` means the second sees state is
    // already being populated... Actually each reads a snapshot of state
    // at call time, so both may trigger runAudit. That's fine — the command
    // is idempotent (setState merges). Both should resolve to 'pass'.
    const [r1, r2] = await Promise.all([
      service.queries.getAuditResult({ storyId: 'story-a' }),
      service.queries.getAuditResult({ storyId: 'story-a' }),
    ]);

    expect(r1).toBe('pass');
    expect(r2).toBe('pass');
  });
});

describe('direct await — fire-and-forget preload (void return)', () => {
  it('resolves immediately with null when state is not loaded yet', async () => {
    const service = getService(lazyAuditServiceDef);

    // preload fires but returns void, so the direct call does NOT wait
    const result = await service.queries.getAuditResult({ storyId: 'story-a' });

    expect(result).toBeNull(); // state not loaded yet — returned immediately
  });

  it('subscribe still works reactively even with fire-and-forget prefetch', async () => {
    const service = getService(lazyAuditServiceDef);
    const calls: any[] = [];

    const unsub = service.queries.getAuditResult.subscribe({ storyId: 'story-a' }, (v) =>
      calls.push(v)
    );

    expect(calls).toEqual([null]);
    await Promise.resolve();
    expect(calls).toEqual([null, 'pass']);

    unsub();
  });
});

describe('buildStaticFiles', () => {
  it('runs query preload from initialState for each input and stores the result', async () => {
    const store = await buildStaticFiles([auditServiceDef]);
    // Each input is isolated — started from a fresh initialState
    expect(Object.values(store)).toEqual(
      expect.arrayContaining([{ 'story-a': 'pass' }, { 'story-b': 'pass' }])
    );
  });

  it('produces one entry per input using a deterministic default path', async () => {
    const store = await buildStaticFiles([auditServiceDef]);
    expect(Object.keys(store)).toHaveLength(2);
    // Default path: {serviceId}/{queryName}/{8-char FNV-1a hex}.json — always filesystem-safe
    for (const key of Object.keys(store)) {
      expect(key).toMatch(/^test\/audit\/getAuditResult\/[0-9a-f]{8}\.json$/);
    }
    expect(Object.values(store)).toEqual(
      expect.arrayContaining([{ 'story-a': 'pass' }, { 'story-b': 'pass' }])
    );
  });

  it('skips services and queries without static config', async () => {
    const store = await buildStaticFiles([statusServiceDef]);
    expect(Object.keys(store)).toHaveLength(0);
  });
});

describe('static mode — configureStaticMode', () => {
  // No fetch mocking needed — static mode reads from an in-memory store.
  // Build the store with buildStaticFiles(), pass it to configureStaticMode({ store }).

  it('query with static config loads from the store and merges state', async () => {
    const store = await buildStaticFiles([auditServiceDef]);
    configureStaticMode({ store });
    const service = getService(auditServiceDef);

    expect(await service.queries.getAuditResult({ storyId: 'story-a' })).toBe('pass');
    expect(await service.queries.getAuditResult({ storyId: 'story-b' })).toBe('pass');
  });

  it('end-to-end: direct query load merges static state and returns correct value', async () => {
    const store = await buildStaticFiles([auditServiceDef]);
    configureStaticMode({ store });
    const service = getService(auditServiceDef);

    // Direct query loading waits for the store merge before reading.
    const result = await service.queries.getAuditResult({ storyId: 'story-a' });
    expect(result).toBe('pass');
  });

  it('subscribe fires immediately with initialState then updates reactively after merge', async () => {
    const store = await buildStaticFiles([auditServiceDef]);
    configureStaticMode({ store });
    const service = getService(auditServiceDef);
    const calls: any[] = [];

    const unsub = service.queries.getAuditResult.subscribe({ storyId: 'story-a' }, (v) =>
      calls.push(v)
    );

    // Effect fires immediately with null (store data not yet merged)
    expect(calls).toEqual([null]);

    // Wait for the async chain: static query load → store → toMerged → signal → effect
    await vi.waitFor(() => expect(calls).toHaveLength(2));

    expect(calls).toEqual([null, 'pass']);
    unsub();
  });

  it('deduplicates concurrent store loads for the same key', async () => {
    const baseStore = await buildStaticFiles([auditServiceDef]);
    // Wrap in a Proxy to count property accesses without needing to know the hash key
    let accessCount = 0;
    const monitoredStore = new Proxy(baseStore, {
      get(target, prop, receiver) {
        if (typeof prop === 'string' && prop.endsWith('.json')) accessCount++;
        return Reflect.get(target, prop, receiver);
      },
    });
    configureStaticMode({ store: monitoredStore });
    const service = getService(auditServiceDef);

    await Promise.all([
      service.queries.getAuditResult({ storyId: 'story-a' }),
      service.queries.getAuditResult({ storyId: 'story-a' }),
    ]);

    // Store key is accessed only once despite two concurrent query loads
    expect(accessCount).toBe(1);
    expect(await service.queries.getAuditResult({ storyId: 'story-a' })).toBe('pass');
  });

  it('different inputs load independently and accumulate in state via toMerged', async () => {
    const store = await buildStaticFiles([auditServiceDef]);
    configureStaticMode({ store });
    const service = getService(auditServiceDef);

    const [a, b] = await Promise.all([
      service.queries.getAuditResult({ storyId: 'story-a' }),
      service.queries.getAuditResult({ storyId: 'story-b' }),
    ]);

    expect(a).toBe('pass');
    expect(b).toBe('pass');
  });

  it('sequential loads accumulate — toMerged does not overwrite prior merges', async () => {
    const store = await buildStaticFiles([auditServiceDef]);
    configureStaticMode({ store });
    const service = getService(auditServiceDef);

    await service.queries.getAuditResult({ storyId: 'story-a' });
    await service.queries.getAuditResult({ storyId: 'story-b' });

    // Both entries must remain in state after sequential loads
    expect(await service.queries.getAuditResult({ storyId: 'story-a' })).toBe('pass');
    expect(await service.queries.getAuditResult({ storyId: 'story-b' })).toBe('pass');
  });

  it('commands without static config reject in static mode', async () => {
    configureStaticMode({ store: {} });
    const service = getService(statusServiceDef);
    await expect(
      service.commands.setStatus({ storyId: 'story-a', typeId: 'a11y', value: 'pass' })
    ).rejects.toThrow('Command "setStatus" is unavailable in static mode');
  });

  it('returns initialState value when store key is missing', async () => {
    configureStaticMode({ store: {} }); // empty store — no pre-built files
    const service = getService(auditServiceDef);

    // getAuditResult tries to load from empty store; missing key → state unchanged
    const result = await service.queries.getAuditResult({ storyId: 'story-a' });
    expect(result).toBeNull();
  });
});

describe('cross-service query composition — reactive propagation', () => {
  // A "summary" service whose query delegates to the child status service.
  // The parent query reads from the child service's query so that a change
  // in child state propagates: child signal → child computed → parent computed
  // → parent effect → parent subscriber callback.

  it('propagates a child-state change through a cross-service query to the parent subscriber', async () => {
    const statusService = getService(statusServiceDef);

    // Parent service: its query calls the child service's query inline.
    // The parent state is empty; all reactive data comes from the child.
    type SummaryState = Record<string, never>;

    const summaryServiceDef = defineService({
      id: 'test/summary',
      initialState: {} as SummaryState,
      queries: {
        getStoryPassed: defineQuery<SummaryState, { storyId: string }, boolean>({
          handler: (_input: { storyId: string }, _ctx) => {
            // Deliberately call the child query inside the parent handler.
            // This child query has no preload/static work, so the awaitable
            // accessor still resolves from the current signal snapshot during
            // computed evaluation and preserves the reactive dependency.
            const storyStatus = (
              statusService.queries.getStoryStatus as unknown as (input: {
                storyId: string;
              }) => { a11y?: string } | null
            )({ storyId: _input.storyId });
            return storyStatus?.['a11y'] === 'pass';
          },
        }),
      },
      commands: {},
    });

    const summaryService = getService(summaryServiceDef);
    const calls: boolean[] = [];

    const unsub = summaryService.queries.getStoryPassed.subscribe({ storyId: 'story-a' }, (v) =>
      calls.push(v)
    );

    // Initial: no status set yet → not passed
    expect(calls).toEqual([false]);

    // Mutate the CHILD service's state
    await statusService.commands.setStatus({
      storyId: 'story-a',
      typeId: 'a11y',
      value: 'pass',
    });

    // The parent subscriber must have been notified via the reactive chain:
    // child signal → child computed (getStoryStatus) → parent computed
    // (getStoryPassed) → parent effect → callback
    expect(calls).toEqual([false, true]);

    unsub();
  });
});
