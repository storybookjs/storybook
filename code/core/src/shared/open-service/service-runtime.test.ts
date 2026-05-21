import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { defineQuery, defineService } from './service-definition.ts';
import { clearRegistry, getService } from './service-runtime.ts';
import {
  awaitedPreloadValueServiceDef,
  createDerivedBooleanFromChildQueryServiceDef,
  fireAndForgetPreloadValueServiceDef,
  mutableRecordLookupServiceDef,
} from './fixtures.ts';

afterEach(() => {
  clearRegistry();
});

describe('service runtime', () => {
  describe('direct query calls', () => {
    it('returns the initial record lookup value', async () => {
      const service = getService(mutableRecordLookupServiceDef);

      expect(await service.queries.getRecordFields({ entryId: 'entry-a' })).toBeNull();
    });

    it('reflects state after a mutating command', async () => {
      const service = getService(mutableRecordLookupServiceDef);

      await service.commands.assignRecordField({
        entryId: 'entry-a',
        fieldKey: 'marker',
        fieldValue: 'match',
      });

      expect(await service.queries.getRecordFields({ entryId: 'entry-a' })).toEqual({
        marker: 'match',
      });
    });
  });

  describe('subscriptions', () => {
    it('delivers the current value after subscription starts', async () => {
      const service = getService(mutableRecordLookupServiceDef);
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
      const service = getService(mutableRecordLookupServiceDef);
      const calls: Array<Record<string, string> | null> = [];

      const unsubscribe = service.queries.getRecordFields.subscribe(
        { entryId: 'entry-a' },
        (value) => {
          calls.push(value);
        }
      );

      await service.commands.assignRecordField({
        entryId: 'entry-a',
        fieldKey: 'marker',
        fieldValue: 'updated',
      });

      expect(calls).toEqual([null, { marker: 'updated' }]);
      unsubscribe();
    });

    it('does not notify subscribers for a different record', async () => {
      const service = getService(mutableRecordLookupServiceDef);
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
      const service = getService(mutableRecordLookupServiceDef);
      const calls: Array<Record<string, string> | null> = [];

      const unsubscribe = service.queries.getRecordFields.subscribe(
        { entryId: 'entry-a' },
        (value) => {
          calls.push(value);
        }
      );

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
      const service = getService(mutableRecordLookupServiceDef);
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

    it('does not notify after unsubscribe when an async query result resolves later', async () => {
      let resolveValue!: () => void;
      let handlerStarted = false;
      let handlerFinished = false;
      const valueReady = new Promise<void>((resolve) => {
        resolveValue = resolve;
      });
      const delayedQueryServiceDef = defineService({
        id: 'test/delayed-subscription-value',
        description: 'Resolves a subscription value after the subscriber has already unsubscribed.',
        initialState: {} as Record<string, never>,
        queries: {
          getValue: defineQuery<Record<string, never>>()({
            input: v.undefined(),
            output: v.string(),
            handler: async () => {
              handlerStarted = true;
              await valueReady;
              handlerFinished = true;

              return 'late';
            },
          }),
        },
        commands: {},
      });
      const service = getService(delayedQueryServiceDef);
      const calls: string[] = [];

      const unsubscribe = service.queries.getValue.subscribe(undefined, (value) => {
        calls.push(value);
      });

      await vi.waitFor(() => expect(handlerStarted).toBe(true));
      unsubscribe();
      resolveValue();

      await vi.waitFor(() => expect(handlerFinished).toBe(true));
      expect(calls).toEqual([]);
    });

    it('rethrows async subscription input validation failures through queueMicrotask', async () => {
      const queuedCallbacks: Array<() => void> = [];
      const queueMicrotaskSpy = vi
        .spyOn(globalThis, 'queueMicrotask')
        .mockImplementation((callback: VoidFunction) => {
          queuedCallbacks.push(callback);
        });
      const service = getService(mutableRecordLookupServiceDef);

      service.queries.getRecordFields.subscribe({} as unknown as { entryId: string }, () => {});

      await vi.waitFor(() => expect(queuedCallbacks).toHaveLength(1));
      try {
        queuedCallbacks[0]();
        expect.unreachable('Expected queued validation error to be thrown');
      } catch (error) {
        expect(error).toMatchObject({
          fromStorybook: true,
          code: 1001,
          message:
            'Invalid input for query "test/mutable-record-lookup.getRecordFields":\nentryId: Invalid key: Expected "entryId" but received undefined',
        });
      }

      queueMicrotaskSpy.mockRestore();
    });
  });

  describe('awaited preload', () => {
    it('preloads state when subscribing to an empty query', async () => {
      const service = getService(awaitedPreloadValueServiceDef);
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

    it('does not trigger preload again after the value is already preloaded', async () => {
      const service = getService(awaitedPreloadValueServiceDef);
      const preloadValueSpy = vi.spyOn(
        awaitedPreloadValueServiceDef.commands.preloadValue,
        'handler'
      );

      const unsubscribe = service.queries.getPreloadedValue.subscribe(
        { entryId: 'entry-a' },
        () => {}
      );
      await vi.waitFor(() => expect(preloadValueSpy).toHaveBeenCalledTimes(1));

      const secondCalls: Array<string | null> = [];
      const secondUnsubscribe = service.queries.getPreloadedValue.subscribe(
        { entryId: 'entry-a' },
        (value) => {
          secondCalls.push(value);
        }
      );

      await vi.waitFor(() => expect(secondCalls).toEqual(['preloaded']));

      unsubscribe();
      secondUnsubscribe();
      preloadValueSpy.mockRestore();
    });

    it('preloads distinct values independently by input', async () => {
      const service = getService(awaitedPreloadValueServiceDef);
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

    it('awaits preload before returning a direct query result', async () => {
      const service = getService(awaitedPreloadValueServiceDef);

      await expect(service.queries.getPreloadedValue({ entryId: 'entry-a' })).resolves.toBe(
        'preloaded'
      );
    });

    it('resolves immediately when state is already preloaded', async () => {
      const service = getService(awaitedPreloadValueServiceDef);
      const preloadValueSpy = vi.spyOn(
        awaitedPreloadValueServiceDef.commands.preloadValue,
        'handler'
      );

      await service.queries.getPreloadedValue({ entryId: 'entry-a' });
      preloadValueSpy.mockClear();

      await expect(service.queries.getPreloadedValue({ entryId: 'entry-a' })).resolves.toBe(
        'preloaded'
      );
      expect(preloadValueSpy).not.toHaveBeenCalled();

      preloadValueSpy.mockRestore();
    });

    it('resolves correctly for concurrent awaits of the same key', async () => {
      const service = getService(awaitedPreloadValueServiceDef);

      const [first, second] = await Promise.all([
        service.queries.getPreloadedValue({ entryId: 'entry-a' }),
        service.queries.getPreloadedValue({ entryId: 'entry-a' }),
      ]);

      expect(first).toBe('preloaded');
      expect(second).toBe('preloaded');
    });
  });

  describe('fire-and-forget preload', () => {
    it('returns the current value immediately when preload does not await', async () => {
      const service = getService(fireAndForgetPreloadValueServiceDef);

      await expect(service.queries.getPreloadedValue({ entryId: 'entry-a' })).resolves.toBeNull();
    });

    it('still updates subscribers reactively after the background preload finishes', async () => {
      const service = getService(fireAndForgetPreloadValueServiceDef);
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
    it('supports awaiting a child query from another service', async () => {
      const sourceService = getService(mutableRecordLookupServiceDef);
      const derivedServiceDef = createDerivedBooleanFromChildQueryServiceDef(sourceService);
      const derivedService = getService(derivedServiceDef);

      await expect(derivedService.queries.isEntryMarked({ entryId: 'entry-a' })).resolves.toBe(
        false
      );

      await sourceService.commands.assignRecordField({
        entryId: 'entry-a',
        fieldKey: 'marker',
        fieldValue: 'match',
      });

      await expect(derivedService.queries.isEntryMarked({ entryId: 'entry-a' })).resolves.toBe(
        true
      );
    });
  });
});
