import type { MockInstance } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cache } from 'storybook/internal/common';

import { get, getLastEvents, getPrecedingUpgrade, set } from './event-cache';

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

      // Use a simple delay to simulate async operations
      let setGetResolved = false;
      let setSetResolved = false;

      cacheGetMock.mockImplementationOnce(async () => {
        while (!setGetResolved) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        return initialData;
      });

      cacheSetMock.mockImplementationOnce(async () => {
        while (!setSetResolved) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      });

      // Mock cache.get to return updated data after set completes
      cacheGetMock.mockResolvedValueOnce(updatedData);

      // Start a set operation (this will be pending)
      const setPromiseResult = set('upgrade', { eventType: 'upgrade', eventId: 'upgrade-1' });

      // Immediately call getLastEvents() - it should wait for set() to complete
      const getPromise = getLastEvents();

      // Verify that getLastEvents hasn't resolved yet (it's waiting)
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Resolve the set operations
      setGetResolved = true;
      await new Promise((resolve) => setTimeout(resolve, 50));
      setSetResolved = true;
      await setPromiseResult;

      // Now getLastEvents should complete and return the updated data
      const result = await getPromise;

      // Verify that getLastEvents waited for set to complete and got the updated data
      expect(result).toEqual(updatedData);
      expect(cacheGetMock).toHaveBeenCalledTimes(2); // Once in setHelper, once in getLastEvents
      expect(cacheSetMock).toHaveBeenCalledTimes(1);
    });
  });
});
