import { isEqual } from 'es-toolkit/predicate';
import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { defineService } from './service-definition.ts';
import { serviceRegistryApi } from './service-registry.ts';
import { createServiceRuntime } from './service-runtime.ts';
import { clearRegistry, registerService } from './server.ts';
import type { QueryState } from './types.ts';
import {
  type RebuiltValue,
  awaitedPreloadValueServiceDef,
  createDerivedBooleanFromChildQueryServiceDef,
  createInvalidQueryOutputServiceDef,
  fireAndForgetPreloadValueServiceDef,
  mutableRecordLookupServiceDef,
  rebuiltEqualValueOnLoadServiceDef,
} from './fixtures.ts';

afterEach(() => {
  clearRegistry();
});

/**
 * Records the `data` of each emitted {@link QueryState}, deduping consecutive equal values.
 *
 * Subscriptions now emit a `QueryState`, and a load-backed query emits extra status-only transitions
 * (e.g. `loading` → `idle`) that repeat the same `data`. These tests assert the *data* sequence, so
 * collapsing consecutive equal data keeps them focused on value changes; lifecycle transitions are
 * asserted explicitly in the dedicated 'query state lifecycle' suite.
 */
function collectData<T>(target: T[]): (state: QueryState<T>) => void {
  return (state) => {
    if (target.length === 0 || !isEqual(target[target.length - 1], state.data)) {
      target.push(state.data as T);
    }
  };
}

describe('service runtime', () => {
  describe('direct query calls', () => {
    it('returns the initial record lookup value synchronously', () => {
      const service = registerService(mutableRecordLookupServiceDef);

      expect(service.queries.getRecordFields.get({ entryId: 'entry-a' })).toBeNull();
    });

    it('reflects state after a mutating command', async () => {
      const service = registerService(mutableRecordLookupServiceDef);

      await service.commands.assignRecordField({
        entryId: 'entry-a',
        fieldKey: 'marker',
        fieldValue: 'match',
      });

      expect(service.queries.getRecordFields.get({ entryId: 'entry-a' })).toEqual({
        marker: 'match',
      });
    });
  });

  describe('subscriptions', () => {
    it('delivers the current value after subscription starts', async () => {
      const service = registerService(mutableRecordLookupServiceDef);
      const calls: Array<Record<string, string> | null> = [];

      const unsubscribe = service.queries.getRecordFields.subscribe(
        { entryId: 'entry-a' },
        collectData(calls)
      );

      await vi.waitFor(() => expect(calls).toEqual([null]));
      unsubscribe();
    });

    it('emits the first state synchronously, before subscribe returns', () => {
      const service = registerService(mutableRecordLookupServiceDef);
      const states: Array<QueryState<unknown>> = [];
      // Flipped to true only once subscribe() has returned. The callback asserts it is still false,
      // proving the first emission ran mid-call rather than on a later microtask (a deferred emission
      // would see it already true). `emissionsInsideSubscribe` then guards that the callback — and so
      // its inner assertion — actually ran, instead of the test passing vacuously.
      let subscribeReturned = false;
      let emissionsInsideSubscribe = 0;

      const unsubscribe = service.queries.getRecordFields.subscribe(
        { entryId: 'entry-a' },
        (state) => {
          expect(subscribeReturned).toBe(false);
          emissionsInsideSubscribe += 1;
          states.push(state);
        }
      );
      subscribeReturned = true;

      expect(emissionsInsideSubscribe).toBe(1);
      expect(states).toHaveLength(1);
      expect(states[0]).toMatchObject({ data: null, status: 'success', loadStatus: 'idle' });
      unsubscribe();
    });

    it('emits a synchronous pending/loading first state for a load-backed query', () => {
      const service = registerService(awaitedPreloadValueServiceDef);
      const states: Array<QueryState<unknown>> = [];

      // The reactive-load effect runs synchronously during subscribe, so the synchronous first
      // emission already reports the initial load in flight.
      const unsubscribe = service.queries.getPreloadedValue.subscribe(
        { entryId: 'entry-a' },
        (state) => {
          states.push(state);
        }
      );

      expect(states).toHaveLength(1);
      expect(states[0]).toMatchObject({
        data: null,
        status: 'pending',
        loadStatus: 'loading',
      });
      unsubscribe();
    });

    it('notifies subscribers when their own record changes', async () => {
      const service = registerService(mutableRecordLookupServiceDef);
      const calls: Array<Record<string, string> | null> = [];

      const unsubscribe = service.queries.getRecordFields.subscribe(
        { entryId: 'entry-a' },
        collectData(calls)
      );

      await vi.waitFor(() => expect(calls).toEqual([null]));
      await service.commands.assignRecordField({
        entryId: 'entry-a',
        fieldKey: 'marker',
        fieldValue: 'updated',
      });

      expect(calls).toEqual([null, { marker: 'updated' }]);
      unsubscribe();
    });

    it('emits detached snapshots when nested state changes', async () => {
      const service = registerService(mutableRecordLookupServiceDef);
      const calls: Array<Record<string, string> | null> = [];

      const unsubscribe = service.queries.getRecordFields.subscribe(
        { entryId: 'entry-a' },
        collectData(calls)
      );

      await vi.waitFor(() => expect(calls).toEqual([null]));
      await service.commands.assignRecordField({
        entryId: 'entry-a',
        fieldKey: 'marker',
        fieldValue: 'first',
      });
      await service.commands.assignRecordField({
        entryId: 'entry-a',
        fieldKey: 'marker',
        fieldValue: 'second',
      });

      expect(calls).toEqual([null, { marker: 'first' }, { marker: 'second' }]);
      expect(calls[1]).not.toBe(calls[2]);
      unsubscribe();
    });

    it('stops notifying after unsubscribe', async () => {
      const service = registerService(mutableRecordLookupServiceDef);
      const calls: Array<Record<string, string> | null> = [];

      const unsubscribe = service.queries.getRecordFields.subscribe(
        { entryId: 'entry-a' },
        collectData(calls)
      );

      await vi.waitFor(() => expect(calls).toEqual([null]));
      await service.commands.assignRecordField({
        entryId: 'entry-a',
        fieldKey: 'marker',
        fieldValue: 'first',
      });
      unsubscribe();
      await service.commands.assignRecordField({
        entryId: 'entry-a',
        fieldKey: 'marker',
        fieldValue: 'second',
      });

      expect(calls).toEqual([null, { marker: 'first' }]);
    });

    it('supports multiple subscribers on the same query', async () => {
      const service = registerService(mutableRecordLookupServiceDef);
      const callsA: Array<Record<string, string> | null> = [];
      const callsB: Array<Record<string, string> | null> = [];

      const unsubscribeA = service.queries.getRecordFields.subscribe(
        { entryId: 'entry-a' },
        collectData(callsA)
      );
      const unsubscribeB = service.queries.getRecordFields.subscribe(
        { entryId: 'entry-a' },
        collectData(callsB)
      );

      await vi.waitFor(() => expect(callsA).toEqual([null]));
      await vi.waitFor(() => expect(callsB).toEqual([null]));
      await service.commands.assignRecordField({
        entryId: 'entry-a',
        fieldKey: 'marker',
        fieldValue: 'shared',
      });

      expect(callsA).toEqual([null, { marker: 'shared' }]);
      expect(callsB).toEqual([null, { marker: 'shared' }]);
      unsubscribeA();
      unsubscribeB();
    });

    it('emits the initial value but skips the late value when unsubscribed before a load settles', async () => {
      let resolveLoad!: () => void;
      let loadStarted = false;
      let loadFinished = false;
      const loadReady = new Promise<void>((resolve) => {
        resolveLoad = resolve;
      });
      const delayedQueryServiceDef = defineService({
        id: 'internal-fixture/delayed-subscription-value',
        description: 'Resolves a load after the subscriber has already unsubscribed.',
        initialState: { value: null as string | null },
        queries: {
          getValue: {
            input: v.undefined(),
            output: v.nullable(v.string()),
            handler: (_input, ctx) => ctx.self.state.value,
            load: async (_input, ctx) => {
              loadStarted = true;
              await loadReady;
              await ctx.self.commands.assignValue('late');
              loadFinished = true;
            },
          },
        },
        commands: {
          assignValue: {
            input: v.string(),
            output: v.void(),
            handler: (input, ctx) => {
              ctx.self.setState((state) => {
                state.value = input;
              });
            },
          },
        },
      });
      const service = registerService(delayedQueryServiceDef);
      const calls: Array<string | null> = [];

      const unsubscribe = service.queries.getValue.subscribe(undefined, collectData(calls));

      await vi.waitFor(() => expect(loadStarted).toBe(true));
      await vi.waitFor(() => expect(calls).toEqual([null]));
      unsubscribe();
      resolveLoad();

      await vi.waitFor(() => expect(loadFinished).toBe(true));
      expect(calls).toEqual([null]);
    });

    it('surfaces subscription input validation failure as an error state', () => {
      const service = registerService(mutableRecordLookupServiceDef);
      const states: Array<QueryState<unknown>> = [];

      service.queries.getRecordFields.subscribe({} as unknown as { entryId: string }, (state) => {
        states.push(state);
      });

      // Bad input is a programmer error, but surfacing it as an error state (instead of a thrown,
      // silently-dead subscription) keeps the subscription reporting the failure to its consumer.
      // Input is validated synchronously inside subscribe(), so the error state is emitted before
      // subscribe() returns — no waitFor needed.
      expect(states).toHaveLength(1);
      expect(states[0]).toMatchObject({
        data: undefined,
        status: 'error',
        isError: true,
        loadStatus: 'idle',
      });
      expect(states[0].error).toMatchObject({
        fromStorybook: true,
        code: 5,
        message:
          'Invalid input for query "internal-fixture/mutable-record-lookup.getRecordFields":\nentryId: Invalid key: Expected "entryId" but received undefined',
      });
    });

    // A `selector` narrows the reactive footprint but must not skip output validation: the handler
    // output is still validated (untracked) before the selector runs, so an invalid output surfaces
    // as an error state rather than slipping through.
    it('surfaces invalid query output as an error state for a subscriber that passes a selector', async () => {
      const service = registerService(createInvalidQueryOutputServiceDef());
      const states: Array<QueryState<unknown>> = [];

      service.queries.getBrokenValue.subscribe(
        undefined,
        (value) => value,
        (state) => {
          states.push(state);
        }
      );

      await vi.waitFor(() => expect(states).toHaveLength(1));
      expect(states[0]).toMatchObject({ status: 'error', isError: true });
      expect(states[0].error?.message).toContain(
        'Invalid output for query "internal-fixture/invalid-query-output.getBrokenValue"'
      );
    });
  });

  describe('background load', () => {
    it('returns the current value synchronously from .get() without ever firing the load', async () => {
      const loadSpy = vi.spyOn(awaitedPreloadValueServiceDef.queries.getPreloadedValue, 'load');
      try {
        const service = registerService(awaitedPreloadValueServiceDef);

        // .get() is a pure read: it returns current state and never fires the load. Repeated reads
        // therefore stay null forever — nothing populates state until .loaded()/.subscribe() run.
        expect(service.queries.getPreloadedValue.get({ entryId: 'entry-a' })).toBeNull();
        service.queries.getPreloadedValue.get({ entryId: 'entry-a' });
        service.queries.getPreloadedValue.get({ entryId: 'entry-a' });
        await new Promise((resolve) => setTimeout(resolve, 30));

        expect(loadSpy).not.toHaveBeenCalled();
        expect(service.queries.getPreloadedValue.get({ entryId: 'entry-a' })).toBeNull();
      } finally {
        loadSpy.mockRestore();
      }
    });

    it('populates state for a .get() read once .loaded() has run', async () => {
      const service = registerService(awaitedPreloadValueServiceDef);

      expect(service.queries.getPreloadedValue.get({ entryId: 'entry-a' })).toBeNull();
      await service.queries.getPreloadedValue.loaded({ entryId: 'entry-a' });
      expect(service.queries.getPreloadedValue.get({ entryId: 'entry-a' })).toBe('preloaded');
    });

    it('does not call the load command twice for concurrent in-flight calls', async () => {
      const service = registerService(awaitedPreloadValueServiceDef);
      const preloadValueSpy = vi.spyOn(
        awaitedPreloadValueServiceDef.commands.preloadValue,
        'handler'
      );

      try {
        const [first, second] = await Promise.all([
          service.queries.getPreloadedValue.loaded({ entryId: 'entry-a' }),
          service.queries.getPreloadedValue.loaded({ entryId: 'entry-a' }),
        ]);

        expect(first).toBe('preloaded');
        expect(second).toBe('preloaded');
        expect(preloadValueSpy).toHaveBeenCalledTimes(1);
      } finally {
        preloadValueSpy.mockRestore();
      }
    });

    it('emits the current value immediately and the loaded value once load settles', async () => {
      const service = registerService(awaitedPreloadValueServiceDef);
      const calls: Array<string | null> = [];

      const unsubscribe = service.queries.getPreloadedValue.subscribe(
        { entryId: 'entry-a' },
        collectData(calls)
      );

      await vi.waitFor(() => expect(calls).toEqual([null, 'preloaded']));

      unsubscribe();
    });

    // A load that re-runs and rewrites a deeply-equal value produces a new state slice, so the
    // subscription computed re-runs — but the emitted value is value-equal to the last one, so the
    // `isEqual` emit gate suppresses the redundant callback.
    it('does not re-emit when a load rewrites a deeply-equal but freshly-allocated value', async () => {
      const service = registerService(rebuiltEqualValueOnLoadServiceDef);

      // First subscription: null -> populated. After this, state holds value #1.
      const firstCalls: Array<RebuiltValue | null> = [];
      const unsubscribeFirst = service.queries.getRebuiltValue.subscribe(
        { entryId: 'entry-a' },
        collectData(firstCalls)
      );
      await vi.waitFor(() => expect(firstCalls).toEqual([null, { marker: 'stable', count: 1 }]));
      unsubscribeFirst();

      // Second subscription, entry already populated: the immediate emission carries the stored
      // value, then load reruns and stores a brand-new object that is deeply equal but not `===`.
      // The redundant emission must be suppressed.
      const secondCalls: Array<RebuiltValue | null> = [];
      const unsubscribeSecond = service.queries.getRebuiltValue.subscribe(
        { entryId: 'entry-a' },
        collectData(secondCalls)
      );

      await vi.waitFor(() => expect(secondCalls).toEqual([{ marker: 'stable', count: 1 }]));
      // Give the background load time to run and (not) notify.
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(secondCalls).toEqual([{ marker: 'stable', count: 1 }]);

      unsubscribeSecond();
    });

    // True fine-grained reactivity: the deep-signal proxy tracks reads per field, so writing an
    // unrelated key must not re-run the subscriber's handler at all (not merely suppress the
    // emission). The handler spy proves the computed did not re-evaluate. Before the deep-signal
    // migration this assertion failed — the handler re-ran on every write and the test only passed
    // because the emitted value happened to be value-equal.
    it('does not re-run a subscriber handler when an unrelated key changes', async () => {
      const handlerSpy = vi.spyOn(mutableRecordLookupServiceDef.queries.getRecordFields, 'handler');
      try {
        const service = registerService(mutableRecordLookupServiceDef);

        await service.commands.assignRecordField({
          entryId: 'entry-a',
          fieldKey: 'marker',
          fieldValue: 'match',
        });

        const callsA: Array<Record<string, string> | null> = [];
        const unsubscribe = service.queries.getRecordFields.subscribe(
          { entryId: 'entry-a' },
          collectData(callsA)
        );
        await vi.waitFor(() => expect(callsA).toEqual([{ marker: 'match' }]));
        const handlerRunsAfterSubscribe = handlerSpy.mock.calls.length;

        await service.commands.assignRecordField({
          entryId: 'entry-b',
          fieldKey: 'marker',
          fieldValue: 'other',
        });
        await new Promise((resolve) => setTimeout(resolve, 30));

        // No emission and — crucially — no handler re-run for entry-a.
        expect(callsA).toEqual([{ marker: 'match' }]);
        expect(handlerSpy.mock.calls.length).toBe(handlerRunsAfterSubscribe);

        unsubscribe();
      } finally {
        handlerSpy.mockRestore();
      }
    });

    // A `selector` narrows the subscriber to one slice of the value. Changing a sibling field the
    // selector ignores must neither fire the callback nor re-run the handler (the handler spy proves
    // the dependency footprint is narrowed, not just the emission); changing the selected field
    // fires once with the new slice.
    it('re-emits and re-runs only for the selected slice of a query value', async () => {
      const handlerSpy = vi.spyOn(mutableRecordLookupServiceDef.queries.getRecordFields, 'handler');
      try {
        const service = registerService(mutableRecordLookupServiceDef);

        await service.commands.assignRecordField({
          entryId: 'entry-a',
          fieldKey: 'selected',
          fieldValue: 'first',
        });

        const selectedCalls: Array<string | undefined> = [];
        const unsubscribe = service.queries.getRecordFields.subscribe(
          { entryId: 'entry-a' },
          (record) => record?.selected,
          collectData(selectedCalls)
        );
        await vi.waitFor(() => expect(selectedCalls).toEqual(['first']));
        const handlerRunsAfterSubscribe = handlerSpy.mock.calls.length;

        // Changing a sibling field re-runs nothing and emits nothing: the selector reads only
        // `selected`, so the sibling is outside the tracked footprint.
        await service.commands.assignRecordField({
          entryId: 'entry-a',
          fieldKey: 'sibling',
          fieldValue: 'ignored',
        });
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(selectedCalls).toEqual(['first']);
        expect(handlerSpy.mock.calls.length).toBe(handlerRunsAfterSubscribe);

        // Changing the selected field fires the callback once with the new slice.
        await service.commands.assignRecordField({
          entryId: 'entry-a',
          fieldKey: 'selected',
          fieldValue: 'second',
        });
        await vi.waitFor(() => expect(selectedCalls).toEqual(['first', 'second']));

        unsubscribe();
      } finally {
        handlerSpy.mockRestore();
      }
    });

    it('preloads distinct values independently by input', async () => {
      const service = registerService(awaitedPreloadValueServiceDef);
      const callsA: Array<string | null> = [];
      const callsB: Array<string | null> = [];

      const unsubscribeA = service.queries.getPreloadedValue.subscribe(
        { entryId: 'entry-a' },
        collectData(callsA)
      );
      const unsubscribeB = service.queries.getPreloadedValue.subscribe(
        { entryId: 'entry-b' },
        collectData(callsB)
      );

      await vi.waitFor(() => expect(callsA).toEqual([null, 'preloaded']));
      await vi.waitFor(() => expect(callsB).toEqual([null, 'preloaded']));
      unsubscribeA();
      unsubscribeB();
    });

    it('returns the fully loaded value from .loaded()', async () => {
      const service = registerService(awaitedPreloadValueServiceDef);

      await expect(service.queries.getPreloadedValue.loaded({ entryId: 'entry-a' })).resolves.toBe(
        'preloaded'
      );
    });

    it('resolves .loaded() immediately when state is already populated', async () => {
      const service = registerService(awaitedPreloadValueServiceDef);
      const preloadValueSpy = vi.spyOn(
        awaitedPreloadValueServiceDef.commands.preloadValue,
        'handler'
      );

      try {
        await service.queries.getPreloadedValue.loaded({ entryId: 'entry-a' });
        preloadValueSpy.mockClear();

        await expect(
          service.queries.getPreloadedValue.loaded({ entryId: 'entry-a' })
        ).resolves.toBe('preloaded');
        expect(preloadValueSpy).not.toHaveBeenCalled();
      } finally {
        preloadValueSpy.mockRestore();
      }
    });

    it('never fires the load from repeated .get() reads (no implicit background load)', async () => {
      const service = registerService(fireAndForgetPreloadValueServiceDef);
      const preloadValueSpy = vi.spyOn(
        fireAndForgetPreloadValueServiceDef.commands.preloadValue,
        'handler'
      );

      try {
        expect(service.queries.getPreloadedValue.get({ entryId: 'entry-a' })).toBeNull();
        expect(service.queries.getPreloadedValue.get({ entryId: 'entry-a' })).toBeNull();
        expect(service.queries.getPreloadedValue.get({ entryId: 'entry-a' })).toBeNull();
        await new Promise((resolve) => setTimeout(resolve, 30));

        // The old bare call fired the load fire-and-forget on every read; .get() never does, so the
        // command that the load would have invoked is never called.
        expect(preloadValueSpy).not.toHaveBeenCalled();
        expect(service.queries.getPreloadedValue.get({ entryId: 'entry-a' })).toBeNull();
      } finally {
        preloadValueSpy.mockRestore();
      }
    });

    it('updates subscribers reactively after the background load finishes', async () => {
      const service = registerService(fireAndForgetPreloadValueServiceDef);
      const calls: Array<string | null> = [];

      const unsubscribe = service.queries.getPreloadedValue.subscribe(
        { entryId: 'entry-a' },
        collectData(calls)
      );

      await vi.waitFor(() => expect(calls).toEqual([null, 'preloaded']));

      unsubscribe();
    });
  });

  describe('reactive load', () => {
    // Same-service: the load reads an external field (`source`) and writes a derived field;
    // changing `source` must re-fire the load and refresh the value.
    function createReactiveDerivedServiceDef() {
      return defineService({
        id: 'internal-fixture/reactive-derived-same-service',
        initialState: { source: 1, derived: null as number | null },
        queries: {
          getDerived: {
            input: v.void(),
            output: v.nullable(v.number()),
            handler: (_input, ctx) => ctx.self.state.derived,
            load: async (_input, ctx) => {
              const source = ctx.self.state.source; // external read -> tracked
              await Promise.resolve();
              await ctx.self.commands.setDerived(source * 10);
            },
          },
        },
        commands: {
          setSource: {
            input: v.number(),
            output: v.void(),
            handler: (next, ctx) =>
              ctx.self.setState((state) => {
                state.source = next;
              }),
          },
          bumpSourceTwice: {
            input: v.void(),
            output: v.void(),
            // Two writes in one command share one batch, so the load coalesces them into one re-fire.
            handler: (_input, ctx) =>
              ctx.self.setState((state) => {
                state.source = 2;
                state.source = 3;
              }),
          },
          setDerived: {
            input: v.number(),
            output: v.void(),
            handler: (next, ctx) =>
              ctx.self.setState((state) => {
                state.derived = next;
              }),
          },
        },
      });
    }

    it('re-fires load when a same-service external dependency changes', async () => {
      const service = registerService(createReactiveDerivedServiceDef());
      const calls: Array<number | null> = [];

      const unsubscribe = service.queries.getDerived.subscribe(undefined, collectData(calls));

      await vi.waitFor(() => expect(calls).toEqual([null, 10]));
      await service.commands.setSource(5);
      await vi.waitFor(() => expect(calls).toEqual([null, 10, 50]));

      unsubscribe();
    });

    it('re-fires load when a cross-service dependency changes (via getService)', async () => {
      const sourceDef = defineService({
        id: 'internal-fixture/reactive-cross-source',
        initialState: { value: 1 },
        queries: {
          getValue: {
            input: v.void(),
            output: v.number(),
            handler: (_input, ctx) => ctx.self.state.value,
          },
        },
        commands: {
          setValue: {
            input: v.number(),
            output: v.void(),
            handler: (next, ctx) =>
              ctx.self.setState((state) => {
                state.value = next;
              }),
          },
        },
      });
      const derivedDef = defineService({
        id: 'internal-fixture/reactive-cross-derived',
        initialState: { derived: null as number | null },
        queries: {
          getDerived: {
            input: v.void(),
            output: v.nullable(v.number()),
            handler: (_input, ctx) => ctx.self.state.derived,
            load: async (_input, ctx) => {
              const value = ctx.getService(sourceDef.id).queries.getValue.get(undefined) as number;
              await Promise.resolve();
              await ctx.self.commands.setDerived(value * 10);
            },
          },
        },
        commands: {
          setDerived: {
            input: v.number(),
            output: v.void(),
            handler: (next, ctx) =>
              ctx.self.setState((state) => {
                state.derived = next;
              }),
          },
        },
      });

      const sourceService = registerService(sourceDef);
      const derivedService = registerService(derivedDef);
      const calls: Array<number | null> = [];

      const unsubscribe = derivedService.queries.getDerived.subscribe(
        undefined,
        collectData(calls)
      );

      await vi.waitFor(() => expect(calls).toEqual([null, 10]));
      await sourceService.commands.setValue(5);
      await vi.waitFor(() => expect(calls).toEqual([null, 10, 50]));

      unsubscribe();
    });

    it('does not infinite-loop when the load writes the state its handler reads', async () => {
      const def = createReactiveDerivedServiceDef();
      const loadSpy = vi.spyOn(def.queries.getDerived, 'load');
      try {
        const service = registerService(def);
        const calls: Array<number | null> = [];

        const unsubscribe = service.queries.getDerived.subscribe(undefined, collectData(calls));

        await vi.waitFor(() => expect(calls).toEqual([null, 10]));
        await new Promise((resolve) => setTimeout(resolve, 40));

        // The load writes `derived` (read by the handler) but only reads `source`, so writing
        // `derived` does not re-trigger it: it fires exactly once and settles.
        expect(loadSpy).toHaveBeenCalledTimes(1);
        expect(calls).toEqual([null, 10]);

        unsubscribe();
      } finally {
        loadSpy.mockRestore();
      }
    });

    it('coalesces rapid dependency changes in one batch into a single re-load', async () => {
      const def = createReactiveDerivedServiceDef();
      const loadSpy = vi.spyOn(def.queries.getDerived, 'load');
      try {
        const service = registerService(def);
        const calls: Array<number | null> = [];

        const unsubscribe = service.queries.getDerived.subscribe(undefined, collectData(calls));
        await vi.waitFor(() => expect(calls).toEqual([null, 10]));
        expect(loadSpy).toHaveBeenCalledTimes(1);

        // Two writes to `source` within one batched command -> one re-load (not two).
        await service.commands.bumpSourceTwice();
        await vi.waitFor(() => expect(calls).toEqual([null, 10, 30]));

        expect(loadSpy).toHaveBeenCalledTimes(2);

        unsubscribe();
      } finally {
        loadSpy.mockRestore();
      }
    });

    it('supersedes an in-flight load when dependencies change again', async () => {
      const gates = new Map<number, () => void>();
      const waitForGate = (source: number) =>
        new Promise<void>((resolve) => {
          gates.set(source, resolve);
        });
      const releaseGate = async (source: number) => {
        await vi.waitFor(() => expect(gates.has(source)).toBe(true));
        gates.get(source)!();
      };

      const def = defineService({
        id: 'internal-fixture/reactive-superseding',
        initialState: { source: 0, derived: null as number | null },
        queries: {
          getDerived: {
            input: v.void(),
            output: v.nullable(v.number()),
            handler: (_input, ctx) => ctx.self.state.derived,
            load: async (_input, ctx) => {
              const source = ctx.self.state.source;
              await waitForGate(source); // hold the load open until the test releases it
              await ctx.self.commands.setDerived(source);
            },
          },
        },
        commands: {
          setSource: {
            input: v.number(),
            output: v.void(),
            handler: (next, ctx) =>
              ctx.self.setState((state) => {
                state.source = next;
              }),
          },
          setDerived: {
            input: v.number(),
            output: v.void(),
            handler: (next, ctx) =>
              ctx.self.setState((state) => {
                state.derived = next;
              }),
          },
        },
      });

      const service = registerService(def);
      const calls: Array<number | null> = [];
      const unsubscribe = service.queries.getDerived.subscribe(undefined, collectData(calls));

      // Initial load (source 0) settles first.
      await vi.waitFor(() => expect(calls).toEqual([null]));
      await releaseGate(0);
      await vi.waitFor(() => expect(calls).toEqual([null, 0]));

      // Start two loads back-to-back; release the stale one (1) first, then the newest (2).
      await service.commands.setSource(1);
      await service.commands.setSource(2);
      await releaseGate(1);
      await releaseGate(2);

      await vi.waitFor(() => expect(calls).toEqual([null, 0, 2]));
      // The superseded load (source 1) must never have written `derived`.
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(calls).toEqual([null, 0, 2]);

      unsubscribe();
    });

    it('never fires the load from .get() reads and sets up no reactivity', async () => {
      const def = createReactiveDerivedServiceDef();
      const loadSpy = vi.spyOn(def.queries.getDerived, 'load');
      try {
        const service = registerService(def);

        // A plain .get() read does not fire the load and does not set up reactivity, so a later
        // dependency change cannot re-fire anything either.
        service.queries.getDerived.get(undefined);
        service.queries.getDerived.get(undefined);
        await service.commands.setSource(9);
        await new Promise((resolve) => setTimeout(resolve, 40));

        expect(loadSpy).not.toHaveBeenCalled();
      } finally {
        loadSpy.mockRestore();
      }
    });

    it('fires an existing self-contained load exactly once for a subscription', async () => {
      const loadSpy = vi.spyOn(awaitedPreloadValueServiceDef.queries.getPreloadedValue, 'load');
      try {
        const service = registerService(awaitedPreloadValueServiceDef);
        const calls: Array<string | null> = [];

        const unsubscribe = service.queries.getPreloadedValue.subscribe(
          { entryId: 'entry-a' },
          collectData(calls)
        );

        await vi.waitFor(() => expect(calls).toEqual([null, 'preloaded']));
        await new Promise((resolve) => setTimeout(resolve, 40));

        // The load reads/writes only its own state (no external read), so it fires once.
        expect(loadSpy).toHaveBeenCalledTimes(1);

        unsubscribe();
      } finally {
        loadSpy.mockRestore();
      }
    });

    // A reactive subscription load that reads a dependency via `.get()` must still warm that
    // dependency's load — even though a bare consumer `.get()` never fires a load. The dependency's
    // freshly-loaded value then flows back through the reactive re-fire.
    it('warms a dependency load read from inside a reactive subscription load body', async () => {
      // Nested-object payloads (rather than bare strings) on purpose: `collectData` dedups emissions
      // by deep equality, so an object value exercises that path and would expose a runtime that
      // mutates state in place instead of propagating a fresh value — a class of bug primitives can
      // never reveal. If propagation works for a nested object, it trivially works for primitives.
      type Payload = { payload: { tag: string } };
      const payloadSchema = v.object({ payload: v.object({ tag: v.string() }) });
      const def = defineService({
        id: 'internal-fixture/reactive-dependency-warming',
        initialState: { inner: null as Payload | null, outer: null as Payload | null },
        queries: {
          getInner: {
            input: v.void(),
            output: v.nullable(payloadSchema),
            handler: (_input, ctx) => ctx.self.state.inner,
            load: async (_input, ctx) => {
              await ctx.self.commands.setInner({ payload: { tag: 'inner-ready' } });
            },
          },
          getOuter: {
            input: v.void(),
            output: v.nullable(payloadSchema),
            handler: (_input, ctx) => ctx.self.state.outer,
            load: async (_input, ctx) => {
              // Reading the dependency must fire its load (fire-and-forget). The read of
              // `state.inner` it performs is tracked, so this load re-fires once inner is ready.
              ctx.self.queries.getInner.get(undefined);
              await Promise.resolve();
              await ctx.self.commands.setOuter(ctx.self.state.inner);
            },
          },
        },
        commands: {
          setInner: {
            input: payloadSchema,
            output: v.void(),
            handler: (next, ctx) =>
              ctx.self.setState((state) => {
                state.inner = next;
              }),
          },
          setOuter: {
            input: v.nullable(payloadSchema),
            output: v.void(),
            handler: (next, ctx) =>
              ctx.self.setState((state) => {
                state.outer = next;
              }),
          },
        },
      });
      const innerLoadSpy = vi.spyOn(def.queries.getInner, 'load');
      try {
        const service = registerService(def);
        const calls: Array<Payload | null> = [];

        const unsubscribe = service.queries.getOuter.subscribe(undefined, collectData(calls));

        // The dependency's load fired purely because the outer reactive load read it via `.get()`,
        // and its value propagated back into `outer` through the reactive re-fire.
        await vi.waitFor(() => expect(calls).toEqual([null, { payload: { tag: 'inner-ready' } }]));
        expect(innerLoadSpy).toHaveBeenCalled();

        unsubscribe();
      } finally {
        innerLoadSpy.mockRestore();
      }
    });
  });

  describe('cross-service query composition', () => {
    it('reads a child query synchronously from another service', async () => {
      const sourceService = registerService(mutableRecordLookupServiceDef);
      const derivedService = registerService(createDerivedBooleanFromChildQueryServiceDef());

      expect(derivedService.queries.isEntryMarked.get({ entryId: 'entry-a' })).toBe(false);

      await sourceService.commands.assignRecordField({
        entryId: 'entry-a',
        fieldKey: 'marker',
        fieldValue: 'match',
      });

      expect(derivedService.queries.isEntryMarked.get({ entryId: 'entry-a' })).toBe(true);
    });
  });

  describe('loaded() drain', () => {
    it('awaits a transitive dependency before returning', async () => {
      const sourceService = registerService(awaitedPreloadValueServiceDef);
      const derivedDef = defineService({
        id: 'internal-fixture/derived-loaded-from-source',
        description: 'Reads the loaded value from the source service through a query.',
        initialState: {} as Record<string, never>,
        queries: {
          getLength: {
            input: v.object({ entryId: v.string() }),
            output: v.number(),
            handler: (input) => {
              const value = sourceService.queries.getPreloadedValue.get({ entryId: input.entryId });
              return value === null ? 0 : value.length;
            },
          },
        },
        commands: {},
      });
      const derivedService = registerService(derivedDef);

      await expect(derivedService.queries.getLength.loaded({ entryId: 'entry-a' })).resolves.toBe(
        'preloaded'.length
      );
    });

    it('does not refire dependency loads on the final .loaded() evaluation', async () => {
      const loadSpy = vi.spyOn(awaitedPreloadValueServiceDef.queries.getPreloadedValue, 'load');
      const sourceService = registerService(awaitedPreloadValueServiceDef);
      const derivedDef = defineService({
        id: 'internal-fixture/derived-loaded-from-spied-source',
        description: 'Reads the spied source query from a sync handler.',
        initialState: {} as Record<string, never>,
        queries: {
          getLength: {
            input: v.object({ entryId: v.string() }),
            output: v.number(),
            handler: (input) => {
              const value = sourceService.queries.getPreloadedValue.get({ entryId: input.entryId });
              return value === null ? 0 : value.length;
            },
          },
        },
        commands: {},
      });
      const derivedService = registerService(derivedDef);

      try {
        await expect(derivedService.queries.getLength.loaded({ entryId: 'entry-a' })).resolves.toBe(
          'preloaded'.length
        );
        expect(loadSpy).toHaveBeenCalledTimes(1);
      } finally {
        loadSpy.mockRestore();
      }
    });

    it('surfaces rejections from a transitive load through .loaded()', async () => {
      const failingDef = defineService({
        id: 'internal-fixture/failing-loaded',
        description: 'Rejects from the load body to exercise .loaded() error propagation.',
        initialState: { value: null as string | null },
        queries: {
          getValue: {
            input: v.undefined(),
            output: v.nullable(v.string()),
            handler: (_input, ctx) => ctx.self.state.value,
            load: async () => {
              throw new Error('boom');
            },
          },
        },
        commands: {},
      });
      const service = registerService(failingDef);

      await expect(service.queries.getValue.loaded(undefined)).rejects.toThrow('boom');
    });

    it('allows zero-argument .loaded() for v.void() queries', async () => {
      const voidDef = defineService({
        id: 'internal-fixture/void-loaded',
        initialState: { ready: false },
        queries: {
          getReady: {
            input: v.void(),
            output: v.boolean(),
            handler: (_input, ctx) => ctx.self.state.ready,
            load: async (_input, ctx) => {
              await ctx.self.commands.markReady(undefined);
            },
          },
        },
        commands: {
          markReady: {
            input: v.void(),
            output: v.void(),
            handler: (_input, ctx) => {
              ctx.self.setState((state) => {
                state.ready = true;
              });
            },
          },
        },
      });
      const service = registerService(voidDef);

      await expect(service.queries.getReady.loaded()).resolves.toBe(true);
    });

    it('breaks a load cycle without deadlocking', async () => {
      const cycleDef = defineService({
        id: 'internal-fixture/load-cycle',
        description: 'Two queries whose loads call each other through self.queries.',
        initialState: { aDone: false, bDone: false },
        queries: {
          a: {
            input: v.undefined(),
            output: v.boolean(),
            handler: (_input, ctx) => ctx.self.state.aDone,
            load: async (_input, ctx) => {
              // Reading b inside a's load would normally also await b's load — but since b's load
              // would in turn read a (the running ancestor), the runtime must break the cycle.
              ctx.self.queries.b.get(undefined);
              await ctx.self.commands.markA(undefined);
            },
          },
          b: {
            input: v.undefined(),
            output: v.boolean(),
            handler: (_input, ctx) => ctx.self.state.bDone,
            load: async (_input, ctx) => {
              ctx.self.queries.a.get(undefined);
              await ctx.self.commands.markB(undefined);
            },
          },
        },
        commands: {
          markA: {
            input: v.undefined(),
            output: v.void(),
            handler: (_input, ctx) => {
              ctx.self.setState((state) => {
                state.aDone = true;
              });
            },
          },
          markB: {
            input: v.undefined(),
            output: v.void(),
            handler: (_input, ctx) => {
              ctx.self.setState((state) => {
                state.bDone = true;
              });
            },
          },
        },
      });
      const service = registerService(cycleDef);

      await expect(service.queries.a.loaded(undefined)).resolves.toBe(true);
      expect(service.queries.b.get(undefined)).toBe(true);
    });

    it('throws OpenServiceLoadedDrainExceededError on persistent oscillation', async () => {
      const oscillatingDef = defineService({
        id: 'internal-fixture/oscillating-load',
        description: 'Handler reads a dynamic-keyed query on every discovery pass.',
        initialState: { counter: 0 },
        queries: {
          getCounter: {
            input: v.undefined(),
            output: v.number(),
            handler: (_input, ctx) => {
              // Each discovery pass produces a fresh input key, so the runtime can never observe
              // a stable set of dependencies — the drain loop hits its iteration cap.
              ctx.self.queries.dynamic.get({ tick: ctx.self.state.counter });
              return ctx.self.state.counter;
            },
          },
          dynamic: {
            input: v.object({ tick: v.number() }),
            output: v.number(),
            handler: (input) => input.tick,
            load: async (_input, ctx) => {
              await ctx.self.commands.bump(undefined);
            },
          },
        },
        commands: {
          bump: {
            input: v.undefined(),
            output: v.void(),
            handler: (_input, ctx) => {
              ctx.self.setState((state) => {
                state.counter += 1;
              });
            },
          },
        },
      });
      const service = registerService(oscillatingDef);

      await expect(service.queries.getCounter.loaded(undefined)).rejects.toMatchObject({
        fromStorybook: true,
        code: 11,
      });
    });
  });

  /**
   * `buildStaticFiles()` drives each snapshot through `runLoadOnce`. Load bodies normally pull
   * dependencies via `ctx.self.queries.*`; those reads run `triggerLoad` during the synchronous
   * prefix (before the first `await`). The root `runLoadOnce` load must therefore appear in the
   * process-global in-flight map before the body starts, same as dev-server `.loaded()` does via
   * `triggerLoad`. Otherwise a read that resolves to the same load key — including a deliberate
   * same-query re-read or a short cycle back to the running query — starts a second `runLoadBody`
   * and can double-apply command side effects in static output.
   *
   * The test below uses a same-query re-read as the smallest repro; reading other queries in the
   * sync prefix is common too, but only same-key (or cyclic) paths hit this duplicate.
   */
  describe('runLoadOnce (static snapshot loads)', () => {
    it('registers the root load so a synchronous self.queries re-read does not refire the load body', async () => {
      const queryName = 'getValue';
      const loadBodySpy = vi.fn();
      const bumpCommandSpy = vi.fn();

      const staticSnapshotServiceDef = defineService({
        id: 'internal-fixture/run-load-once-sync-self-read',
        description:
          'Static build fixture: load reads its own query through wrapped self.queries before awaiting.',
        initialState: { count: 0 },
        queries: {
          [queryName]: {
            input: v.undefined(),
            output: v.number(),
            handler: (_input, ctx) => ctx.self.state.count,
            load: async (_input, ctx) => {
              loadBodySpy();
              // Mirrors static snapshot loads: sync handler read before the first await.
              ctx.self.queries[queryName].get(undefined);
              await ctx.self.commands.bump(undefined);
            },
          },
        },
        commands: {
          bump: {
            input: v.undefined(),
            output: v.void(),
            handler: (_input, ctx) => {
              bumpCommandSpy();
              ctx.self.setState((state) => {
                state.count += 1;
              });
            },
          },
        },
      });

      const buildRuntime = createServiceRuntime(staticSnapshotServiceDef, {
        registryApi: serviceRegistryApi,
      });

      await buildRuntime.runLoadOnce(queryName, undefined);

      // A duplicate load body would run bump twice and leave count at 2.
      expect(buildRuntime.getStateSnapshot().count).toBe(1);
      expect(loadBodySpy).toHaveBeenCalledTimes(1);
      expect(bumpCommandSpy).toHaveBeenCalledTimes(1);
    });
  });

  // The `subscriptions`/`reactive load` suites assert the emitted *data* sequence (via collectData).
  // This suite asserts the orthogonal axis: the per-subscription `QueryState` lifecycle that wraps
  // that data (status / loadStatus / error and the derived booleans).
  describe('query state lifecycle', () => {
    it('reports success/idle immediately for a query with no load', () => {
      const service = registerService(mutableRecordLookupServiceDef);
      const states: Array<QueryState<unknown>> = [];

      const unsubscribe = service.queries.getRecordFields.subscribe(
        { entryId: 'entry-a' },
        (state) => {
          states.push(state);
        }
      );

      // A no-load query emits its success/idle state synchronously during subscribe() — no waitFor.
      expect(states).toHaveLength(1);
      expect(states[0]).toMatchObject({
        data: null,
        error: undefined,
        status: 'success',
        loadStatus: 'idle',
        isSuccess: true,
        isPending: false,
        isError: false,
        isLoading: false,
        isInitialLoading: false,
        isRefreshing: false,
      });

      unsubscribe();
    });

    it('transitions pending → success as a load settles', async () => {
      const service = registerService(awaitedPreloadValueServiceDef);
      const states: Array<QueryState<unknown>> = [];

      const unsubscribe = service.queries.getPreloadedValue.subscribe(
        { entryId: 'entry-a' },
        (state) => {
          states.push(state);
        }
      );

      // The first emission, before the load settles, is the initial load over no data yet. It is
      // emitted synchronously during subscribe() (the reactive-load effect runs synchronously and
      // the first emission already reads `loading`), so it is observable without waiting.
      expect(states).toHaveLength(1);
      expect(states[0]).toMatchObject({
        data: null,
        status: 'pending',
        loadStatus: 'loading',
        isPending: true,
        isRefreshing: false,
      });

      // Once the load resolves, the subscription is success/idle with the loaded data.
      await vi.waitFor(() => {
        const last = states[states.length - 1];
        expect(last).toMatchObject({
          data: 'preloaded',
          status: 'success',
          loadStatus: 'idle',
          isSuccess: true,
          isLoading: false,
          isInitialLoading: false,
        });
      });

      unsubscribe();
    });

    it('reports isInitialLoading only while there is no data yet, not over cached data', async () => {
      // Models a real load-backed query (like docgen/story-docs): the handler returns `undefined`
      // until the load populates state, and the populated value persists in state afterwards.
      const cachedDef = defineService({
        id: 'internal-fixture/lifecycle-initial-loading',
        description:
          'Load-backed query whose handler returns undefined until the load populates it.',
        initialState: { value: undefined as string | undefined },
        queries: {
          getValue: {
            input: v.undefined(),
            output: v.optional(v.string()),
            handler: (_input, ctx) => ctx.self.state.value,
            load: async (_input, ctx) => {
              await ctx.self.commands.setValue('loaded');
            },
          },
        },
        commands: {
          setValue: {
            input: v.string(),
            output: v.void(),
            handler: (next, ctx) =>
              ctx.self.setState((state) => {
                state.value = next;
              }),
          },
        },
      });
      const service = registerService(cachedDef);

      // First subscription: no data yet, so the in-flight first load is a genuine initial load.
      const firstStates: Array<QueryState<unknown>> = [];
      const unsubscribeFirst = service.queries.getValue.subscribe(undefined, (state) => {
        firstStates.push(state);
      });
      expect(firstStates[0]).toMatchObject({
        data: undefined,
        status: 'pending',
        loadStatus: 'loading',
        isInitialLoading: true,
      });
      await vi.waitFor(() => {
        expect(firstStates[firstStates.length - 1]).toMatchObject({
          data: 'loaded',
          status: 'success',
          isInitialLoading: false,
        });
      });
      unsubscribeFirst();

      // Second subscription, now that the value is cached: the per-subscription lifecycle still
      // starts pending/loading, but `data` is already present from the first emission, so this must
      // NOT report an initial load — consumers must not flash a skeleton over already-available data.
      const secondStates: Array<QueryState<unknown>> = [];
      const unsubscribeSecond = service.queries.getValue.subscribe(undefined, (state) => {
        secondStates.push(state);
      });
      expect(secondStates[0]).toMatchObject({
        data: 'loaded',
        loadStatus: 'loading',
        isInitialLoading: false,
      });
      unsubscribeSecond();
    });

    it('transitions to error when the load rejects, keeping the last data', async () => {
      const failingDef = defineService({
        id: 'internal-fixture/lifecycle-load-reject',
        description:
          'Loads successfully once, then rejects on a re-load to exercise error-state data retention.',
        initialState: { value: null as string | null, failNext: false },
        queries: {
          getValue: {
            input: v.undefined(),
            output: v.nullable(v.string()),
            handler: (_input, ctx) => ctx.self.state.value,
            load: async (_input, ctx) => {
              // Tracked read: flipping `failNext` re-fires this load, which then rejects.
              if (ctx.self.state.failNext) {
                throw new Error('boom');
              }
              await ctx.self.commands.setValue('loaded');
            },
          },
        },
        commands: {
          setValue: {
            input: v.nullable(v.string()),
            output: v.void(),
            handler: (next, ctx) =>
              ctx.self.setState((state) => {
                state.value = next;
              }),
          },
          setFailNext: {
            input: v.boolean(),
            output: v.void(),
            handler: (next, ctx) =>
              ctx.self.setState((state) => {
                state.failNext = next;
              }),
          },
        },
      });
      const service = registerService(failingDef);
      const states: Array<QueryState<unknown>> = [];

      const unsubscribe = service.queries.getValue.subscribe(undefined, (state) => {
        states.push(state);
      });

      // The first load succeeds and populates the data.
      await vi.waitFor(() => {
        const last = states[states.length - 1];
        expect(last).toMatchObject({ data: 'loaded', status: 'success', loadStatus: 'idle' });
      });

      // Flipping the tracked dependency re-fires the load, which now rejects. The resulting error
      // state must retain the previously-loaded `data` rather than dropping it to undefined/null.
      await service.commands.setFailNext(true);
      await vi.waitFor(() => {
        const last = states[states.length - 1];
        expect(last.status).toBe('error');
      });
      const last = states[states.length - 1];
      expect(last).toMatchObject({
        data: 'loaded',
        status: 'error',
        loadStatus: 'idle',
        isError: true,
        isLoading: false,
      });
      expect(last.error?.message).toBe('boom');

      unsubscribe();
    });

    it('reports isRefreshing on a background re-load over existing data', async () => {
      const reactiveDef = defineService({
        id: 'internal-fixture/lifecycle-reactive-refresh',
        initialState: { source: 1, derived: null as number | null },
        queries: {
          getDerived: {
            input: v.void(),
            output: v.nullable(v.number()),
            handler: (_input, ctx) => ctx.self.state.derived,
            load: async (_input, ctx) => {
              const source = ctx.self.state.source;
              await Promise.resolve();
              await ctx.self.commands.setDerived(source * 10);
            },
          },
        },
        commands: {
          setSource: {
            input: v.number(),
            output: v.void(),
            handler: (next, ctx) =>
              ctx.self.setState((state) => {
                state.source = next;
              }),
          },
          setDerived: {
            input: v.number(),
            output: v.void(),
            handler: (next, ctx) =>
              ctx.self.setState((state) => {
                state.derived = next;
              }),
          },
        },
      });
      const service = registerService(reactiveDef);
      const states: Array<QueryState<unknown>> = [];

      const unsubscribe = service.queries.getDerived.subscribe(undefined, (state) => {
        states.push(state);
      });

      // Wait for the initial load to settle to success.
      await vi.waitFor(() => {
        const last = states[states.length - 1];
        expect(last).toMatchObject({ data: 10, status: 'success', loadStatus: 'idle' });
      });

      // Changing the load's dependency re-fires it over the existing data: status stays success
      // while loadStatus flips to loading — a background refresh, not an initial load.
      await service.commands.setSource(5);
      await vi.waitFor(() =>
        expect(
          states.some(
            (state) =>
              state.isRefreshing &&
              state.status === 'success' &&
              state.loadStatus === 'loading' &&
              state.isInitialLoading === false
          )
        ).toBe(true)
      );

      // The refresh settles back to success/idle with the new value.
      await vi.waitFor(() => {
        const last = states[states.length - 1];
        expect(last).toMatchObject({ data: 50, status: 'success', loadStatus: 'idle' });
      });

      unsubscribe();
    });
  });
});
