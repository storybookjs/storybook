import { afterEach, describe, expect, it, vi } from 'vitest';

import { Channel } from '../../channels/main.ts';
import { instanceContext } from '../../instance/instance-context.ts';
import type { InstanceContext } from '../instance-context.ts';
import { UniversalStore } from './index.ts';
import { createUniversalStoreRealm, getUniversalStoreRealm } from './realm.ts';

afterEach(() => {
  const realm = getUniversalStoreRealm();
  for (const store of realm.instances.values()) {
    store.__dispose();
  }
  realm.instances.clear();
  void realm.preparation.promise.catch(() => {});
  UniversalStore.__reset();
});

describe('UniversalStore realms', () => {
  it.each(['no context', 'context A', 'context B'] as const)(
    '%s → create and prepare only the current realm',
    async (activeContext) => {
      const channel = new Channel({});
      const contextA: InstanceContext = {
        channel,
        universalStoreRealm: createUniversalStoreRealm(),
        workingDir: process.cwd(),
        state: new Map(),
        cleanups: new Set(),
        getStoryIndexGenerator: vi.fn(),
      };
      const contextB: InstanceContext = {
        ...contextA,
        universalStoreRealm: createUniversalStoreRealm(),
        state: new Map(),
        cleanups: new Set(),
      };
      const realms = {
        'no context': getUniversalStoreRealm(),
        'context A': contextA.universalStoreRealm,
        'context B': contextB.universalStoreRealm,
      };
      const run = <T>(fn: () => T): T =>
        activeContext === 'no context'
          ? fn()
          : instanceContext.run(activeContext === 'context A' ? contextA : contextB, fn);
      const store = run(() =>
        UniversalStore.create({ id: 'storybook/test', leader: true, initialState: 0 })
      );
      run(() => UniversalStore.__prepare(channel, UniversalStore.Environment.SERVER));
      await store.untilReady();
      expect(
        Object.entries(realms).map(([name, realm]) => ({
          current: name === activeContext,
          registered: realm.instances.get('storybook/test') === store,
          prepared: realm.channel === channel && realm.environment === 'SERVER',
        }))
      ).toEqual(
        Object.keys(realms).map((name) => ({
          current: name === activeContext,
          registered: name === activeContext,
          prepared: name === activeContext,
        }))
      );
      expect({ status: store.status, environment: store.actor.environment }).toMatchInlineSnapshot(`
        {
          "environment": "SERVER",
          "status": "READY",
        }
      `);
      store.setState(1);
      expect(store.getState()).toBe(1);
      const otherPreparations = Object.values(realms)
        .filter((realm) => realm !== realms[activeContext])
        .map((realm) => realm.preparation);
      run(() => UniversalStore.__reset());
      expect(realms[activeContext].environment).toBeUndefined();
      expect(
        Object.values(realms)
          .filter((realm) => realm !== realms[activeContext])
          .map((realm) => realm.preparation)
      ).toEqual(otherPreparations);
      store.__dispose();
      realms[activeContext].instances.clear();
    }
  );
});
