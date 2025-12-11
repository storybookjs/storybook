import type { MockInstance } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cache } from 'storybook/internal/common';

import type { CacheEntry } from './event-cache';
import { getLastEvents, getPrecedingUpgrade, set } from './event-cache';
import type { TelemetryEvent } from './types';

vi.mock('storybook/internal/common', { spy: true });

expect.addSnapshotSerializer({
  print: (val: unknown) => JSON.stringify(val, null, 2),
  test: (val) => typeof val !== 'string',
});

// Helper to create valid TelemetryEvent objects
const createTelemetryEvent = (
  eventType: TelemetryEvent['eventType'],
  eventId: string,
  overrides?: Partial<TelemetryEvent>
): TelemetryEvent => ({
  eventType,
  eventId,
  sessionId: 'test-session',
  context: {},
  payload: {},
  ...overrides,
});

describe('event-cache', () => {
  const init: CacheEntry = {
    body: createTelemetryEvent('init', 'init'),
    timestamp: 1,
  };
  const upgrade: CacheEntry = {
    body: createTelemetryEvent('upgrade', 'upgrade'),
    timestamp: 2,
  };
  const dev: CacheEntry = {
    body: createTelemetryEvent('dev', 'dev'),
    timestamp: 3,
  };
  const build: CacheEntry = {
    body: createTelemetryEvent('build', 'build'),
    timestamp: 3,
  };
  const error: CacheEntry = {
    body: createTelemetryEvent('build', 'error'),
    timestamp: 4,
  };
  const versionUpdate: CacheEntry = {
    body: createTelemetryEvent('version-update', 'version-update'),
    timestamp: 5,
  };

  describe('data handling', () => {
    it('errors', async () => {
      const preceding = await getPrecedingUpgrade({
        init: {
          timestamp: 1,
          body: { ...init.body, error: {} } as TelemetryEvent & { error: unknown },
        },
      });
      expect(preceding).toMatchInlineSnapshot(`
        {
          "timestamp": 1,
          "eventType": "init",
          "eventId": "init",
          "sessionId": "test-session"
        }
      `);
    });

    it('session IDs', async () => {
      const preceding = await getPrecedingUpgrade({
        init: {
          timestamp: 1,
          body: { ...init.body, sessionId: '100' },
        },
      });
      expect(preceding).toMatchInlineSnapshot(`
        {
          "timestamp": 1,
          "eventType": "init",
          "eventId": "init",
          "sessionId": "100"
        }
      `);
    });

    it('extra fields', async () => {
      const preceding = await getPrecedingUpgrade({
        init: {
          timestamp: 1,
          body: { ...init.body, foobar: 'baz' } as TelemetryEvent & { foobar: string },
        },
      });
      expect(preceding).toMatchInlineSnapshot(`
        {
          "timestamp": 1,
          "eventType": "init",
          "eventId": "init",
          "sessionId": "test-session"
        }
      `);
    });
  });

  describe('no intervening dev events', () => {
    it('no upgrade events', async () => {
      const preceding = await getPrecedingUpgrade({});
      expect(preceding).toBeUndefined();
    });

    it('init', async () => {
      const preceding = await getPrecedingUpgrade({ init });
      expect(preceding).toMatchInlineSnapshot(`
        {
          "timestamp": 1,
          "eventType": "init",
          "eventId": "init",
          "sessionId": "test-session"
        }
      `);
    });

    it('upgrade', async () => {
      const preceding = await getPrecedingUpgrade({ upgrade });
      expect(preceding).toMatchInlineSnapshot(`
        {
          "timestamp": 2,
          "eventType": "upgrade",
          "eventId": "upgrade",
          "sessionId": "test-session"
        }
      `);
    });

    it('both init and upgrade', async () => {
      const preceding = await getPrecedingUpgrade({ init, upgrade });
      expect(preceding).toMatchInlineSnapshot(`
        {
          "timestamp": 2,
          "eventType": "upgrade",
          "eventId": "upgrade",
          "sessionId": "test-session"
        }
      `);
    });
  });

  describe('intervening dev events', () => {
    it('no upgrade events', async () => {
      const preceding = await getPrecedingUpgrade({ dev });
      expect(preceding).toBeUndefined();
    });

    it('init', async () => {
      const preceding = await getPrecedingUpgrade({ init, dev });
      expect(preceding).toBeUndefined();
    });

    it('upgrade', async () => {
      const preceding = await getPrecedingUpgrade({ upgrade, dev });
      expect(preceding).toBeUndefined();
    });

    it('init followed by upgrade', async () => {
      const preceding = await getPrecedingUpgrade({ init, upgrade, dev });
      expect(preceding).toBeUndefined();
    });

    it('both init and upgrade with intervening dev', async () => {
      const secondUpgrade: CacheEntry = {
        body: createTelemetryEvent('upgrade', 'secondUpgrade'),
        timestamp: 4,
      };
      const preceding = await getPrecedingUpgrade({ init, dev, upgrade: secondUpgrade });
      expect(preceding).toMatchInlineSnapshot(`
        {
          "timestamp": 4,
          "eventType": "upgrade",
          "eventId": "secondUpgrade",
          "sessionId": "test-session"
        }
      `);
    });

    it('both init and upgrade with non-intervening dev', async () => {
      const earlyDev: CacheEntry = {
        body: createTelemetryEvent('dev', 'earlyDev'),
        timestamp: -1,
      };
      const preceding = await getPrecedingUpgrade({ dev: earlyDev, init, upgrade });
      expect(preceding).toMatchInlineSnapshot(`
        {
          "timestamp": 2,
          "eventType": "upgrade",
          "eventId": "upgrade",
          "sessionId": "test-session"
        }
      `);
    });
  });

  describe('intervening other events', () => {
    it('build', async () => {
      const preceding = await getPrecedingUpgrade({ upgrade, build });
      expect(preceding).toBeUndefined();
    });

    it('error', async () => {
      const preceding = await getPrecedingUpgrade({ upgrade, error });
      expect(preceding).toBeUndefined();
    });

    it('version-update', async () => {
      const preceding = await getPrecedingUpgrade({ upgrade, 'version-update': versionUpdate });
      expect(preceding).toMatchInlineSnapshot(`
        {
          "timestamp": 2,
          "eventType": "upgrade",
          "eventId": "upgrade",
          "sessionId": "test-session"
        }
      `);
    });
  });

  describe('race condition prevention', () => {
    let cacheGetMock: MockInstance;
    let cacheSetMock: MockInstance;

    beforeEach(() => {
      vi.clearAllMocks();
      cacheGetMock = vi.mocked(cache.get);
      cacheSetMock = vi.mocked(cache.set);
    });

    it('getLastEvents waits for pending set operations to complete', async () => {
      const initialData = {
        init: { timestamp: 1, body: createTelemetryEvent('init', 'init-1') },
      };
      const updatedData = {
        init: { timestamp: 1, body: createTelemetryEvent('init', 'init-1') },
        upgrade: { timestamp: 2, body: createTelemetryEvent('upgrade', 'upgrade-1') },
      };

      // Mock cache.get to return initial data first, then updated data
      cacheGetMock
        .mockResolvedValueOnce(initialData) // First call in setHelper
        .mockResolvedValueOnce(updatedData); // Second call in getLastEvents

      // Mock cache.set to resolve immediately
      cacheSetMock.mockResolvedValue(undefined);

      // Start a set operation (this will be queued and processed)
      const setPromiseResult = set('upgrade', createTelemetryEvent('upgrade', 'upgrade-1'));

      // Immediately call getLastEvents() - it should wait for set() to complete
      const getPromise = getLastEvents();

      // Wait for set operation to complete
      await setPromiseResult;

      // Now getLastEvents should complete and return the updated data
      const result = await getPromise;

      // Verify that getLastEvents waited for set to complete and got the updated data
      expect(result).toEqual(updatedData);
      expect(cacheGetMock).toHaveBeenCalledTimes(2); // Once in setHelper, once in getLastEvents
      expect(cacheSetMock).toHaveBeenCalledTimes(1);
    });

    it('queues multiple set operations sequentially', async () => {
      const initialData = {};
      const afterFirst = {
        init: { timestamp: 1, body: createTelemetryEvent('init', 'init-1') },
      };
      const afterSecond = {
        init: { timestamp: 1, body: createTelemetryEvent('init', 'init-1') },
        upgrade: { timestamp: 2, body: createTelemetryEvent('upgrade', 'upgrade-1') },
      };
      const afterThird = {
        init: { timestamp: 1, body: createTelemetryEvent('init', 'init-1') },
        upgrade: { timestamp: 2, body: createTelemetryEvent('upgrade', 'upgrade-1') },
        dev: { timestamp: 3, body: createTelemetryEvent('dev', 'dev-1') },
      };

      // Mock cache.get to return data in sequence
      cacheGetMock
        .mockResolvedValueOnce(initialData) // First set: get initial
        .mockResolvedValueOnce(afterFirst) // Second set: get after first
        .mockResolvedValueOnce(afterSecond) // Third set: get after second
        .mockResolvedValueOnce(afterThird); // getLastEvents: get after third

      // Mock cache.set to resolve immediately
      cacheSetMock.mockResolvedValue(undefined);

      // Queue multiple set operations
      const set1 = set('init', createTelemetryEvent('init', 'init-1'));
      const set2 = set('upgrade', createTelemetryEvent('upgrade', 'upgrade-1'));
      const set3 = set('dev', createTelemetryEvent('dev', 'dev-1'));

      // Wait for all operations to complete
      await Promise.all([set1, set2, set3]);

      // Now getLastEvents should return the final state
      const result = await getLastEvents();

      // Verify all operations were processed sequentially
      expect(result).toEqual(afterThird);
      expect(cacheGetMock).toHaveBeenCalledTimes(4); // 3 sets + 1 getLastEvents
      expect(cacheSetMock).toHaveBeenCalledTimes(3); // One for each set
    });

    it('handles errors in queued operations', async () => {
      const initialData = {
        init: { timestamp: 1, body: createTelemetryEvent('init', 'init-1') },
      };
      const afterDev = {
        init: { timestamp: 1, body: createTelemetryEvent('init', 'init-1') },
        dev: { timestamp: 3, body: createTelemetryEvent('dev', 'dev-1') },
      };

      // First operation will fail
      cacheGetMock.mockResolvedValueOnce(initialData);
      cacheSetMock.mockRejectedValueOnce(new Error('Cache write failed'));

      // Queue an operation that will fail
      const failedOperation = set('upgrade', createTelemetryEvent('upgrade', 'upgrade-1'));
      await expect(failedOperation).rejects.toThrow('Cache write failed');

      // Wait a bit to ensure queue processing completes
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify subsequent operations can still be queued and succeed
      cacheGetMock.mockResolvedValueOnce(initialData);
      cacheSetMock.mockResolvedValueOnce(undefined);
      cacheGetMock.mockResolvedValueOnce(afterDev);

      await expect(set('dev', createTelemetryEvent('dev', 'dev-1'))).resolves.toBeUndefined();

      // Verify the successful operation was processed
      const result = await getLastEvents();
      expect(result).toEqual(afterDev);
    });
  });
});
