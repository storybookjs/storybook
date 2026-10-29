import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { Channel } from '../../channels/main.ts';
import { createStorybook } from '../../instance/create-storybook.ts';
import { runWithStorybook } from '../../instance/instance-context.ts';
import type { Storybook } from '../../instance/types.ts';
import { UniversalStoreFollowerTimeoutError } from '../../manager-errors.ts';
import type { Status } from '../../shared/status-store/index.ts';
import { type CoreStores, createCoreStores } from './core-stores.ts';
import { getStatusStoreByTypeId, getSyncedStatuses, universalStatusStore } from './status.ts';
import {
  fullTestProviderStore,
  getTestProviderStoreById,
  universalTestProviderStore,
} from './test-provider.ts';

const modified: Status = {
  storyId: 'button--primary',
  typeId: 'storybook/change-detection',
  value: 'status-value:modified',
  title: 'Modified',
  description: '',
};
const passed: Status = {
  storyId: 'button--primary',
  typeId: 'storybook/component-test',
  value: 'status-value:success',
  title: 'Passed',
  description: '',
};

const INSTANCES: Storybook[] = [];
const STORES: CoreStores[] = [];

afterEach(async () => {
  STORES.splice(0).forEach((stores) => stores.dispose());
  await Promise.all(INSTANCES.splice(0).map((storybook) => storybook.close()));
  vi.useRealTimers();
});

async function createInstance({ attached = false } = {}): Promise<Storybook> {
  const storybook = await createStorybook(
    {
      configDir: fileURLToPath(new URL('../../instance/__fixtures__/first', import.meta.url)),
      main: { stories: [] },
      mode: 'headless',
      ...(attached ? { attach: { transport: { send() {}, setHandler() {} } } } : {}),
    },
    { builtInAddons: [] }
  );
  INSTANCES.push(storybook);
  return storybook;
}

/** An owner and two clients on one in-process bus, as the dev server, manager, and Vitest child. */
async function createSyncedStores(): Promise<{ owner: CoreStores; a: CoreStores; b: CoreStores }> {
  const channel = new Channel({ async: true });
  const [owner, a, b] = [true, false, false].map((isOwner) => {
    const stores = createCoreStores({ channel, owner: isOwner });
    STORES.push(stores);
    return stores;
  });
  await Promise.all(
    [a, b].flatMap((stores) => [
      stores.status.universalStatusStore.untilReady(),
      stores.testProvider.universalTestProviderStore.untilReady(),
    ])
  );
  return { owner, a, b };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe('core stores', () => {
  describe('storybook/status', () => {
    it.each([
      {
        name: 'the owner sets a status',
        input: [{ actor: 'owner', op: 'set', status: modified }],
        expected: ['storybook/change-detection'],
      },
      {
        name: 'a client sets a status',
        input: [{ actor: 'a', op: 'set', status: passed }],
        expected: ['storybook/component-test'],
      },
      {
        name: 'clients set statuses of two types, then one unsets its type',
        input: [
          { actor: 'a', op: 'set', status: modified },
          { actor: 'b', op: 'set', status: passed },
          { actor: 'a', op: 'unset', status: modified },
        ],
        expected: ['storybook/component-test'],
      },
    ] as const)(
      'keeps the owner and two clients in sync when $name',
      async ({ input, expected }) => {
        const stores = await createSyncedStores();

        for (const { actor, op, status } of input) {
          const typed = stores[actor].status.getStatusStoreByTypeId(status.typeId);
          if (op === 'set') {
            typed.set([status]);
          } else {
            typed.unset();
          }
          await settle();
        }

        const states = Object.values(stores).map((s) => s.status.fullStatusStore.getAll());
        expect(states[1]).toEqual(states[0]);
        expect(states[2]).toEqual(states[0]);
        expect(Object.keys(states[0]['button--primary'] ?? {})).toEqual(expected);
      }
    );

    it('delivers a selection from a client to the owner and the other client', async () => {
      const stores = await createSyncedStores();
      const selected: string[] = [];
      for (const [name, { status }] of Object.entries(stores)) {
        status.fullStatusStore.onSelect((statuses) =>
          selected.push(`${name}: ${statuses.map((s) => s.typeId).join()}`)
        );
      }

      stores.a.status.fullStatusStore.selectStatuses([modified]);
      await settle();

      expect(selected).toMatchInlineSnapshot(`
        [
          "a: storybook/change-detection",
          "owner: storybook/change-detection",
          "b: storybook/change-detection",
        ]
      `);
    });
  });

  describe('storybook/test-provider', () => {
    it.each([
      {
        name: 'the owner reports running',
        input: [{ actor: 'owner', state: 'test-provider-state:running' }],
        expected: { 'storybook/test': 'test-provider-state:running' },
      },
      {
        name: 'a client reports running, then the other reports success',
        input: [
          { actor: 'a', state: 'test-provider-state:running' },
          { actor: 'b', state: 'test-provider-state:succeeded' },
        ],
        expected: { 'storybook/test': 'test-provider-state:succeeded' },
      },
    ] as const)(
      'keeps the owner and two clients in sync when $name',
      async ({ input, expected }) => {
        const stores = await createSyncedStores();

        for (const { actor, state } of input) {
          stores[actor].testProvider.getTestProviderStoreById('storybook/test').setState(state);
          await settle();
        }

        expect(
          Object.values(stores).map((s) => s.testProvider.fullTestProviderStore.getFullState())
        ).toEqual([expected, expected, expected]);
      }
    );

    it('delivers run-all from a client to the owner and the other client', async () => {
      const stores = await createSyncedStores();
      const runs: string[] = [];
      for (const [name, { testProvider }] of Object.entries(stores)) {
        testProvider.getTestProviderStoreById('storybook/test').onRunAll(() => runs.push(name));
      }

      await stores.b.testProvider.fullTestProviderStore.runAll();
      await settle();

      expect(runs).toMatchInlineSnapshot(`
        [
          "b",
          "owner",
          "a",
        ]
      `);
    });
  });

  describe('per instance', () => {
    it('keeps two instances apart, and closing one leaves the other', async () => {
      const [first, second] = await Promise.all([createInstance(), createInstance()]);
      runWithStorybook(first, () => {
        getStatusStoreByTypeId(modified.typeId).set([modified]);
        getTestProviderStoreById('storybook/test').setState('test-provider-state:running');
      });
      await settle();

      const read = (storybook: Storybook) =>
        runWithStorybook(storybook, () => ({
          statuses: Object.keys(getStatusStoreByTypeId(modified.typeId).getAll()),
          testProviders: fullTestProviderStore.getFullState(),
        }));
      expect({ first: read(first), second: read(second) }).toMatchInlineSnapshot(`
        {
          "first": {
            "statuses": [
              "button--primary",
            ],
            "testProviders": {
              "storybook/test": "test-provider-state:running",
            },
          },
          "second": {
            "statuses": [],
            "testProviders": {},
          },
        }
      `);

      await first.close();
      runWithStorybook(second, () =>
        getTestProviderStoreById('storybook/test').setState('test-provider-state:succeeded')
      );
      await settle();
      expect(read(second).testProviders).toEqual({
        'storybook/test': 'test-provider-state:succeeded',
      });
    });

    it('makes an instance the owner, and an attached instance a client', async () => {
      const [owned, attached] = await Promise.all([
        createInstance(),
        createInstance({ attached: true }),
      ]);
      const actorTypes = (storybook: Storybook) =>
        runWithStorybook(storybook, () => [
          universalStatusStore.actor.type,
          universalTestProviderStore.actor.type,
        ]);

      expect({ owned: actorTypes(owned), attached: actorTypes(attached) }).toMatchInlineSnapshot(`
          {
            "attached": [
              "CLIENT",
              "CLIENT",
            ],
            "owned": [
              "OWNER",
              "OWNER",
            ],
          }
        `);
    });

    it('throws outside an instance', () => {
      expect(() => getStatusStoreByTypeId(modified.typeId)).toThrow(/core stores/);
    });
  });

  describe('getSyncedStatuses', () => {
    it("returns an owner's statuses", async () => {
      const storybook = await createInstance();
      runWithStorybook(storybook, () => getStatusStoreByTypeId(modified.typeId).set([modified]));

      await expect(runWithStorybook(storybook, getSyncedStatuses)).resolves.toEqual({
        [modified.storyId]: { [modified.typeId]: modified },
      });
    });

    it('returns the owner state to a client whose owner answers asynchronously', async () => {
      const { owner, a } = await createSyncedStores();
      owner.status.getStatusStoreByTypeId(modified.typeId).set([modified]);
      await settle();

      await a.status.universalStatusStore.untilReady();
      expect(a.status.fullStatusStore.getAll()).toEqual({
        [modified.storyId]: { [modified.typeId]: modified },
      });
    });

    it('rejects instead of returning an empty state when no owner answers, then syncs again', async () => {
      const attached = await createInstance({ attached: true });
      await expect(runWithStorybook(attached, getSyncedStatuses)).rejects.toBeInstanceOf(
        UniversalStoreFollowerTimeoutError
      );

      const resynced = runWithStorybook(attached, getSyncedStatuses);
      const ownerActor = { id: 'dev-server', type: 'OWNER' } as const;
      const clientId = runWithStorybook(attached, () => universalStatusStore.actor.id);
      attached.channel.receive({
        type: 'UNIVERSAL_STORE:storybook/status',
        args: [
          {
            kind: 'state',
            to: clientId,
            state: { [modified.storyId]: { [modified.typeId]: modified } },
            from: ownerActor,
          },
        ],
        from: 'server',
      });

      await expect(resynced).resolves.toEqual({
        [modified.storyId]: { [modified.typeId]: modified },
      });
    });
  });
});
