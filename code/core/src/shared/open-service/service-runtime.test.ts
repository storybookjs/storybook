import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { defineService } from './service-definition.ts';
import { serviceRegistryApi } from './service-registration.ts';
import { createServiceRuntime } from './service-runtime.ts';
import { clearRegistry, registerService } from './server.ts';
import {
  awaitedPreloadValueServiceDef,
  createDerivedBooleanFromChildQueryServiceDef,
  entryIdInputSchema,
  fireAndForgetPreloadValueServiceDef,
  mutableRecordLookupServiceDef,
  preloadedValueOutputSchema,
  voidOutputSchema,
} from './fixtures.ts';

afterEach(() => {
  clearRegistry();
});

describe('service runtime', () => {
  describe('direct query calls', () => {
    it('returns the initial record lookup value synchronously', () => {
      const service = registerService(mutableRecordLookupServiceDef);

      expect(service.queries.getRecordFields({ entryId: 'entry-a' })).toBeNull();
    });

    it('reflects state after a mutating command', async () => {
      const service = registerService(mutableRecordLookupServiceDef);

      await service.commands.assignRecordField({
        entryId: 'entry-a',
        fieldKey: 'marker',
        fieldValue: 'match',
      });

      expect(service.queries.getRecordFields({ entryId: 'entry-a' })).toEqual({
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
        (value) => {
          calls.push(value);
        }
      );

      await vi.waitFor(() => expect(calls).toEqual([null]));
      unsubscribe();
    });

    it('notifies subscribers when their own record changes', async () => {
      const service = registerService(mutableRecordLookupServiceDef);
      const calls: Array<Record<string, string> | null> = [];

      const unsubscribe = service.queries.getRecordFields.subscribe(
        { entryId: 'entry-a' },
        (value) => {
          calls.push(value);
        }
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

    it('does not notify subscribers for a different record', async () => {
      const service = registerService(mutableRecordLookupServiceDef);
      const callsA: Array<Record<string, string> | null> = [];
      const callsB: Array<Record<string, string> | null> = [];

      const unsubscribeA = service.queries.getRecordFields.subscribe(
        { entryId: 'entry-a' },
        (value) => {
          callsA.push(value);
        }
      );
      const unsubscribeB = service.queries.getRecordFields.subscribe(
        { entryId: 'entry-b' },
        (value) => {
          callsB.push(value);
        }
      );

      await vi.waitFor(() => expect(callsA).toEqual([null]));
      await vi.waitFor(() => expect(callsB).toEqual([null]));
      await service.commands.assignRecordField({
        entryId: 'entry-b',
        fieldKey: 'marker',
        fieldValue: 'match',
      });

      expect(callsA).toEqual([null]);
      expect(callsB).toEqual([null, { marker: 'match' }]);
      unsubscribeA();
      unsubscribeB();
    });

    it('stops notifying after unsubscribe', async () => {
      const service = registerService(mutableRecordLookupServiceDef);
      const calls: Array<Record<string, string> | null> = [];

      const unsubscribe = service.queries.getRecordFields.subscribe(
        { entryId: 'entry-a' },
        (value) => {
          calls.push(value);
        }
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
        (value) => {
          callsA.push(value);
        }
      );
      const unsubscribeB = service.queries.getRecordFields.subscribe(
        { entryId: 'entry-a' },
        (value) => {
          callsB.push(value);
        }
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
              ctx.self.setState((draft) => {
                draft.value = input;
              });
            },
          },
        },
      });
      const service = registerService(delayedQueryServiceDef);
      const calls: Array<string | null> = [];

      const unsubscribe = service.queries.getValue.subscribe(undefined, (value) => {
        calls.push(value);
      });

      await vi.waitFor(() => expect(loadStarted).toBe(true));
      await vi.waitFor(() => expect(calls).toEqual([null]));
      unsubscribe();
      resolveLoad();

      await vi.waitFor(() => expect(loadFinished).toBe(true));
      expect(calls).toEqual([null]);
    });

    it('rethrows subscription input validation failures through queueMicrotask', async () => {
      const queuedCallbacks: Array<() => void> = [];
      const queueMicrotaskSpy = vi
        .spyOn(globalThis, 'queueMicrotask')
        .mockImplementation((callback: VoidFunction) => {
          queuedCallbacks.push(callback);
        });
      const service = registerService(mutableRecordLookupServiceDef);

      service.queries.getRecordFields.subscribe({} as unknown as { entryId: string }, () => {});

      await vi.waitFor(() => expect(queuedCallbacks).toHaveLength(1));
      try {
        try {
          queuedCallbacks[0]();
          expect.unreachable('Expected queued validation error to be thrown');
        } catch (error) {
          expect(error).toMatchObject({
            fromStorybook: true,
            code: 5,
            message:
              'Invalid input for query "internal-fixture/mutable-record-lookup.getRecordFields":\nentryId: Invalid key: Expected "entryId" but received undefined',
          });
        }
      } finally {
        queueMicrotaskSpy.mockRestore();
      }
    });
  });

  describe('background load', () => {
    it('returns the current value synchronously and triggers load in the background', async () => {
      const service = registerService(awaitedPreloadValueServiceDef);

      expect(service.queries.getPreloadedValue({ entryId: 'entry-a' })).toBeNull();

      await vi.waitFor(() =>
        expect(service.queries.getPreloadedValue({ entryId: 'entry-a' })).toBe('preloaded')
      );
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
        (value) => {
          calls.push(value);
        }
      );

      await vi.waitFor(() => expect(calls).toEqual([null, 'preloaded']));

      unsubscribe();
    });

    it('preloads distinct values independently by input', async () => {
      const service = registerService(awaitedPreloadValueServiceDef);
      const callsA: Array<string | null> = [];
      const callsB: Array<string | null> = [];

      const unsubscribeA = service.queries.getPreloadedValue.subscribe(
        { entryId: 'entry-a' },
        (value) => {
          callsA.push(value);
        }
      );
      const unsubscribeB = service.queries.getPreloadedValue.subscribe(
        { entryId: 'entry-b' },
        (value) => {
          callsB.push(value);
        }
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

    it('fires background load on every sync call but dedupes while in flight', async () => {
      const service = registerService(fireAndForgetPreloadValueServiceDef);
      const preloadValueSpy = vi.spyOn(
        fireAndForgetPreloadValueServiceDef.commands.preloadValue,
        'handler'
      );

      try {
        expect(service.queries.getPreloadedValue({ entryId: 'entry-a' })).toBeNull();
        expect(service.queries.getPreloadedValue({ entryId: 'entry-a' })).toBeNull();
        expect(service.queries.getPreloadedValue({ entryId: 'entry-a' })).toBeNull();

        await vi.waitFor(() =>
          expect(service.queries.getPreloadedValue({ entryId: 'entry-a' })).toBe('preloaded')
        );

        expect(preloadValueSpy).toHaveBeenCalledTimes(1);
      } finally {
        preloadValueSpy.mockRestore();
      }
    });

    it('updates subscribers reactively after the background load finishes', async () => {
      const service = registerService(fireAndForgetPreloadValueServiceDef);
      const calls: Array<string | null> = [];

      const unsubscribe = service.queries.getPreloadedValue.subscribe(
        { entryId: 'entry-a' },
        (value) => {
          calls.push(value);
        }
      );

      await vi.waitFor(() => expect(calls).toEqual([null, 'preloaded']));

      unsubscribe();
    });
  });

  describe('cross-service query composition', () => {
    it('reads a child query synchronously from another service', async () => {
      const sourceService = registerService(mutableRecordLookupServiceDef);
      const derivedService = registerService(createDerivedBooleanFromChildQueryServiceDef());

      expect(derivedService.queries.isEntryMarked({ entryId: 'entry-a' })).toBe(false);

      await sourceService.commands.assignRecordField({
        entryId: 'entry-a',
        fieldKey: 'marker',
        fieldValue: 'match',
      });

      expect(derivedService.queries.isEntryMarked({ entryId: 'entry-a' })).toBe(true);
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
              const value = sourceService.queries.getPreloadedValue({ entryId: input.entryId });
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
      const loadSpy = vi.fn(
        async (
          _input: unknown,
          ctx: {
            self: { commands: { preloadValue: (input: { entryId: string }) => Promise<void> } };
          }
        ) => {
          await ctx.self.commands.preloadValue({ entryId: 'entry-a' });
        }
      );
      const sourceDef = defineService({
        id: 'internal-fixture/source-with-spied-load',
        description: 'Source query whose load body is spied for refire detection.',
        initialState: {} as Record<string, string | undefined>,
        queries: {
          getPreloadedValue: {
            input: entryIdInputSchema,
            output: preloadedValueOutputSchema,
            handler: (input, ctx) => ctx.self.state[input.entryId] ?? null,
            load: loadSpy,
          },
        },
        commands: {
          preloadValue: {
            input: entryIdInputSchema,
            output: voidOutputSchema,
            handler: async (input, ctx) => {
              await Promise.resolve();
              ctx.self.setState((draft) => {
                draft[input.entryId] = 'preloaded';
              });
            },
          },
        },
      });
      const sourceService = registerService(sourceDef);
      const derivedDef = defineService({
        id: 'internal-fixture/derived-loaded-from-spied-source',
        description: 'Reads the spied source query from a sync handler.',
        initialState: {} as Record<string, never>,
        queries: {
          getLength: {
            input: v.object({ entryId: v.string() }),
            output: v.number(),
            handler: (input) => {
              const value = sourceService.queries.getPreloadedValue({ entryId: input.entryId });
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
      expect(loadSpy).toHaveBeenCalledTimes(1);
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
              ctx.self.queries.b(undefined);
              await ctx.self.commands.markA(undefined);
            },
          },
          b: {
            input: v.undefined(),
            output: v.boolean(),
            handler: (_input, ctx) => ctx.self.state.bDone,
            load: async (_input, ctx) => {
              ctx.self.queries.a(undefined);
              await ctx.self.commands.markB(undefined);
            },
          },
        },
        commands: {
          markA: {
            input: v.undefined(),
            output: v.void(),
            handler: (_input, ctx) => {
              ctx.self.setState((draft) => {
                draft.aDone = true;
              });
            },
          },
          markB: {
            input: v.undefined(),
            output: v.void(),
            handler: (_input, ctx) => {
              ctx.self.setState((draft) => {
                draft.bDone = true;
              });
            },
          },
        },
      });
      const service = registerService(cycleDef);

      await expect(service.queries.a.loaded(undefined)).resolves.toBe(true);
      expect(service.queries.b(undefined)).toBe(true);
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
              ctx.self.queries.dynamic({ tick: ctx.self.state.counter });
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
              ctx.self.setState((draft) => {
                draft.counter += 1;
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
              ctx.self.queries[queryName](undefined);
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
              ctx.self.setState((draft) => {
                draft.count += 1;
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
      expect(buildRuntime.stateSignal().count).toBe(1);
      expect(loadBodySpy).toHaveBeenCalledTimes(1);
      expect(bumpCommandSpy).toHaveBeenCalledTimes(1);
    });
  });
});
