import { describe, it, expect } from 'vitest';
import { getPrecedingUpgrade } from './event-cache';

expect.addSnapshotSerializer({
  print: (val: any) => JSON.stringify(val, null, 2),
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
});
