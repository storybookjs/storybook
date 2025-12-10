import type { MockInstance } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cache } from 'storybook/internal/common';

import { getLastEvents, getPrecedingUpgrade, set } from './event-cache';

vi.mock('storybook/internal/common', { spy: true });

expect.addSnapshotSerializer({
  print: (val: unknown) => JSON.stringify(val, null, 2),
  test: (val) => typeof val !== 'string',
});

describe('event-cache', () => {
  const init = { body: { eventType: 'init', eventId: 'init' }, timestamp: 1 };
  const upgrade = { body: { eventType: 'upgrade', eventId: 'upgrade' }, timestamp: 2 };
  const dev = { body: { eventType: 'dev', eventId: 'dev' }, timestamp: 3 };
  const build = { body: { eventType: 'build', eventId: 'build' }, timestamp: 3 };
  const error = { body: { eventType: 'build', eventId: 'error' }, timestamp: 4 };
  const versionUpdate = {
    body: { eventType: 'version-update', eventId: 'version-update' },
    timestamp: 5,
  };

  describe('data handling', () => {
    it('errors', async () => {
      const preceding = await getPrecedingUpgrade({
        init: { timestamp: 1, body: { ...init.body, error: {} } },
      });
      expect(preceding).toMatchInlineSnapshot(`
        {
          "timestamp": 1,
          "eventType": "init",
          "eventId": "init"
        }
      `);
    });

    it('session IDs', async () => {
      const preceding = await getPrecedingUpgrade({
        init: { timestamp: 1, body: { ...init.body, sessionId: 100 } },
      });
      expect(preceding).toMatchInlineSnapshot(`
        {
          "timestamp": 1,
          "eventType": "init",
          "eventId": "init",
          "sessionId": 100
        }
      `);
    });

    it('extra fields', async () => {
      const preceding = await getPrecedingUpgrade({
        init: { timestamp: 1, body: { ...init.body, foobar: 'baz' } },
      });
      expect(preceding).toMatchInlineSnapshot(`
        {
          "timestamp": 1,
          "eventType": "init",
          "eventId": "init"
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
          "eventId": "init"
        }
      `);
    });

    it('upgrade', async () => {
      const preceding = await getPrecedingUpgrade({ upgrade });
      expect(preceding).toMatchInlineSnapshot(`
        {
          "timestamp": 2,
          "eventType": "upgrade",
          "eventId": "upgrade"
        }
      `);
    });

    it('both init and upgrade', async () => {
      const preceding = await getPrecedingUpgrade({ init, upgrade });
      expect(preceding).toMatchInlineSnapshot(`
        {
          "timestamp": 2,
          "eventType": "upgrade",
          "eventId": "upgrade"
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
      const secondUpgrade = {
        body: { eventType: 'upgrade', eventId: 'secondUpgrade' },
        timestamp: 4,
      };
      const preceding = await getPrecedingUpgrade({ init, dev, upgrade: secondUpgrade });
      expect(preceding).toMatchInlineSnapshot(`
        {
          "timestamp": 4,
          "eventType": "upgrade",
          "eventId": "secondUpgrade"
        }
      `);
    });

    it('both init and upgrade with non-intervening dev', async () => {
      const earlyDev = {
        body: { eventType: 'dev', eventId: 'earlyDev' },
        timestamp: -1,
      };
      const preceding = await getPrecedingUpgrade({ dev: earlyDev, init, upgrade });
      expect(preceding).toMatchInlineSnapshot(`
        {
          "timestamp": 2,
          "eventType": "upgrade",
          "eventId": "upgrade"
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
          "eventId": "upgrade"
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
        init: { timestamp: 1, body: { eventType: 'init', eventId: 'init-1' } },
      };
      const updatedData = {
        init: { timestamp: 1, body: { eventType: 'init', eventId: 'init-1' } },
        upgrade: { timestamp: 2, body: { eventType: 'upgrade', eventId: 'upgrade-1' } },
      };

      // Mock cache.get to return initial data first, then updated data
      cacheGetMock
        .mockResolvedValueOnce(initialData) // First call in setHelper
        .mockResolvedValueOnce(updatedData); // Second call in getLastEvents

      // Mock cache.set to resolve immediately
      cacheSetMock.mockResolvedValue(undefined);

      // Start a set operation (this will be queued and processed)
      const setPromiseResult = set('upgrade', { eventType: 'upgrade', eventId: 'upgrade-1' });

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
        init: { timestamp: 1, body: { eventType: 'init', eventId: 'init-1' } },
      };
      const afterSecond = {
        init: { timestamp: 1, body: { eventType: 'init', eventId: 'init-1' } },
        upgrade: { timestamp: 2, body: { eventType: 'upgrade', eventId: 'upgrade-1' } },
      };
      const afterThird = {
        init: { timestamp: 1, body: { eventType: 'init', eventId: 'init-1' } },
        upgrade: { timestamp: 2, body: { eventType: 'upgrade', eventId: 'upgrade-1' } },
        dev: { timestamp: 3, body: { eventType: 'dev', eventId: 'dev-1' } },
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
      const set1 = set('init', { eventType: 'init', eventId: 'init-1' });
      const set2 = set('upgrade', { eventType: 'upgrade', eventId: 'upgrade-1' });
      const set3 = set('dev', { eventType: 'dev', eventId: 'dev-1' });

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
        init: { timestamp: 1, body: { eventType: 'init', eventId: 'init-1' } },
      };
      const afterDev = {
        init: { timestamp: 1, body: { eventType: 'init', eventId: 'init-1' } },
        dev: { timestamp: 3, body: { eventType: 'dev', eventId: 'dev-1' } },
      };

      // First operation will fail
      cacheGetMock.mockResolvedValueOnce(initialData);
      cacheSetMock.mockRejectedValueOnce(new Error('Cache write failed'));

      // Queue an operation that will fail
      const failedOperation = set('upgrade', { eventType: 'upgrade', eventId: 'upgrade-1' });
      await expect(failedOperation).rejects.toThrow('Cache write failed');

      // Wait a bit to ensure queue processing completes
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify subsequent operations can still be queued and succeed
      cacheGetMock.mockResolvedValueOnce(initialData);
      cacheSetMock.mockResolvedValueOnce(undefined);
      cacheGetMock.mockResolvedValueOnce(afterDev);

      await expect(set('dev', { eventType: 'dev', eventId: 'dev-1' })).resolves.toBeUndefined();

      // Verify the successful operation was processed
      const result = await getLastEvents();
      expect(result).toEqual(afterDev);
    });
  });
});
