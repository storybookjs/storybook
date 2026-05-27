import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildStaticFiles } from './static-build.ts';
import { clearRegistry, createService } from './service-runtime.ts';
import {
  awaitedPreloadValueServiceDef,
  createSharedStaticFileServiceDef,
  mutableRecordLookupServiceDef,
} from './fixtures.ts';

afterEach(() => {
  clearRegistry();
});

describe('static builds', () => {
  describe('buildStaticFiles', () => {
    it('runs preload from initial state for each input and deep-merges by path', async () => {
      await expect(buildStaticFiles([awaitedPreloadValueServiceDef])).resolves.toEqual({
        'test/awaited-preload-value.json': {
          'entry-a': 'preloaded',
          'entry-b': 'preloaded',
        },
      });
    });

    it('uses a single default path per service', async () => {
      const store = await buildStaticFiles([awaitedPreloadValueServiceDef]);

      expect(Object.keys(store)).toEqual(['test/awaited-preload-value.json']);
    });

    it('deep-merges outputs from different queries that resolve to the same custom path', async () => {
      const sharedStaticFileServiceDef = createSharedStaticFileServiceDef();

      await expect(buildStaticFiles([sharedStaticFileServiceDef])).resolves.toEqual({
        'shared.json': { left: 'preloaded', right: 'preloaded' },
      });
    });

    it('skips services and queries without static config', async () => {
      const store = await buildStaticFiles([mutableRecordLookupServiceDef]);

      expect(Object.keys(store)).toHaveLength(0);
    });
  });

  describe('store-backed services', () => {
    it('preloads and merges static state from the store for matching queries', async () => {
      const store = await buildStaticFiles([awaitedPreloadValueServiceDef]);
      const service = createService(awaitedPreloadValueServiceDef, { store });

      await expect(service.queries.getPreloadedValue({ entryId: 'entry-a' })).resolves.toBe(
        'preloaded'
      );
      await expect(service.queries.getPreloadedValue({ entryId: 'entry-b' })).resolves.toBe(
        'preloaded'
      );
    });

    it('returns the preloaded value from a direct query after the store merge', async () => {
      const store = await buildStaticFiles([awaitedPreloadValueServiceDef]);
      const service = createService(awaitedPreloadValueServiceDef, { store });

      await expect(service.queries.getPreloadedValue({ entryId: 'entry-a' })).resolves.toBe(
        'preloaded'
      );
    });

    it('delivers the initial state and merged state after subscription starts', async () => {
      const store = await buildStaticFiles([awaitedPreloadValueServiceDef]);
      const service = createService(awaitedPreloadValueServiceDef, { store });
      const calls: Array<string | null> = [];

      const unsubscribe = service.queries.getPreloadedValue.subscribe(
        { entryId: 'entry-a' },
        (value) => {
          calls.push(value);
        }
      );

      await vi.waitFor(() => expect(calls).toHaveLength(2));
      expect(calls).toEqual([null, 'preloaded']);

      unsubscribe();
    });

    it('deduplicates concurrent store loads for the same path', async () => {
      const baseStore = await buildStaticFiles([awaitedPreloadValueServiceDef]);
      let accessCount = 0;
      const monitoredStore = new Proxy(baseStore, {
        get(target, prop, receiver) {
          if (typeof prop === 'string' && prop.endsWith('.json')) {
            accessCount++;
          }

          return Reflect.get(target, prop, receiver);
        },
      });
      const service = createService(awaitedPreloadValueServiceDef, { store: monitoredStore });

      await Promise.all([
        service.queries.getPreloadedValue({ entryId: 'entry-a' }),
        service.queries.getPreloadedValue({ entryId: 'entry-a' }),
      ]);

      expect(accessCount).toBe(1);
      await expect(service.queries.getPreloadedValue({ entryId: 'entry-a' })).resolves.toBe(
        'preloaded'
      );
    });

    it('preloads different inputs independently and accumulates the merged state', async () => {
      const store = await buildStaticFiles([awaitedPreloadValueServiceDef]);
      const service = createService(awaitedPreloadValueServiceDef, { store });

      const [first, second] = await Promise.all([
        service.queries.getPreloadedValue({ entryId: 'entry-a' }),
        service.queries.getPreloadedValue({ entryId: 'entry-b' }),
      ]);

      expect(first).toBe('preloaded');
      expect(second).toBe('preloaded');
    });

    it('keeps earlier merged values after sequential preloads', async () => {
      const store = await buildStaticFiles([awaitedPreloadValueServiceDef]);
      const service = createService(awaitedPreloadValueServiceDef, { store });

      await service.queries.getPreloadedValue({ entryId: 'entry-a' });
      await service.queries.getPreloadedValue({ entryId: 'entry-b' });

      await expect(service.queries.getPreloadedValue({ entryId: 'entry-a' })).resolves.toBe(
        'preloaded'
      );
      await expect(service.queries.getPreloadedValue({ entryId: 'entry-b' })).resolves.toBe(
        'preloaded'
      );
    });

    it('returns the initial state value when the store key is missing', async () => {
      const service = createService(awaitedPreloadValueServiceDef, { store: {} });

      await expect(service.queries.getPreloadedValue({ entryId: 'entry-a' })).resolves.toBeNull();
    });
  });
});
