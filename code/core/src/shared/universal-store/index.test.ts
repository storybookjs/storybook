import { afterEach, describe, expect, it, vi } from 'vitest';

import { Channel } from '../../channels/main.ts';
import { UniversalStoreFollowerTimeoutError } from '../../manager-errors.ts';
import { createTestInstanceContext, runInTestInstance } from '../instance-context.test-helpers.ts';
import { UniversalStore } from './index.ts';
import { MockUniversalStore } from './mock.ts';

type State = { count: number; log: string[] };
type CustomEvent = { type: 'PING'; payload: string };

const ID = 'storybook/test';
const INITIAL_STATE: State = { count: 0, log: [] };

const STORES: UniversalStore<any, any>[] = [];

function create(options: { owner?: boolean; channel: Channel; initialState?: State }) {
  const store = UniversalStore.create<State, CustomEvent>({ id: ID, ...options });
  STORES.push(store);
  return store;
}

afterEach(() => {
  STORES.splice(0).forEach((store) => store.__dispose());
  vi.useRealTimers();
});

describe('UniversalStore', () => {
  describe('create', () => {
    it.each([
      { name: 'no options', input: undefined },
      { name: 'no id', input: {} },
    ])('throws with $name', ({ input }) => {
      expect(() => UniversalStore.create(input as any)).toThrowErrorMatchingInlineSnapshot(
        `[TypeError: id is required and must be a string, when creating a UniversalStore]`
      );
    });

    it('stays unprepared without a channel outside an instance on the server', () => {
      const store = UniversalStore.create({ id: ID, owner: true });
      STORES.push(store);
      expect(store.status).toBe('UNPREPARED');
      expect(() => store.setState(INITIAL_STATE)).toThrow(/before store is ready/);
    });

    it("syncs on the current instance's channel and is disposed when it closes", async () => {
      const context = createTestInstanceContext();
      const channel = new Channel({});
      context.channel = channel;
      await runInTestInstance(() => {
        UniversalStore.create({ id: ID, owner: true, initialState: INITIAL_STATE });
        expect(channel.listenerCount(`UNIVERSAL_STORE:${ID}`)).toBe(1);
      }, context);
      expect(channel.listenerCount(`UNIVERSAL_STORE:${ID}`)).toBe(0);
    });
  });

  describe('owner and clients', () => {
    it('makes the owner ready at once and a client ready with the owner state', async () => {
      const channel = new Channel({ async: true });
      const owner = create({ owner: true, channel, initialState: { count: 3, log: [] } });
      const client = create({ channel, initialState: INITIAL_STATE });

      expect({ owner: owner.status, client: client.status }).toMatchInlineSnapshot(`
        {
          "client": "SYNCING",
          "owner": "READY",
        }
      `);
      await client.untilReady();
      expect({ status: client.status, state: client.getState() }).toMatchInlineSnapshot(`
        {
          "state": {
            "count": 3,
            "log": [],
          },
          "status": "READY",
        }
      `);
    });

    it.each([
      {
        name: 'owner writes',
        input: [{ actor: 'owner', count: 1 }],
        expected: { count: 1, log: ['owner'] },
      },
      {
        name: 'a client writes',
        input: [{ actor: 'clientA', count: 1 }],
        expected: { count: 1, log: ['clientA'] },
      },
      {
        name: 'everyone writes in turn',
        input: [
          { actor: 'clientA', count: 1 },
          { actor: 'owner', count: 2 },
          { actor: 'clientB', count: 3 },
        ],
        expected: { count: 3, log: ['clientA', 'owner', 'clientB'] },
      },
      {
        name: 'two clients write in the same tick',
        input: [
          { actor: 'clientA', count: 1, sameTick: true },
          { actor: 'clientB', count: 2 },
        ],
        // The owner applies the later write last, and both clients converge on it.
        expected: { count: 2, log: ['clientB'] },
      },
    ] as const)(
      'keeps the owner and two clients in sync when $name',
      async ({ input, expected }) => {
        const channel = new Channel({ async: true });
        const stores = {
          owner: create({ owner: true, channel, initialState: INITIAL_STATE }),
          clientA: create({ channel }),
          clientB: create({ channel }),
        };
        await Promise.all(Object.values(stores).map((store) => store.untilReady()));

        for (const step of input) {
          stores[step.actor].setState((state) => ({
            count: step.count,
            log: [...state.log, step.actor],
          }));
          if (!('sameTick' in step)) {
            await settle();
          }
        }

        expect(
          Object.fromEntries(
            Object.entries(stores).map(([name, store]) => [name, store.getState()])
          )
        ).toEqual({ owner: expected, clientA: expected, clientB: expected });
      }
    );

    it('notifies each listener once per change, with the actor that caused it', async () => {
      const channel = new Channel({ async: true });
      const owner = create({ owner: true, channel, initialState: INITIAL_STATE });
      const clientA = create({ channel });
      const clientB = create({ channel });
      await Promise.all([clientA.untilReady(), clientB.untilReady()]);
      const seen: string[] = [];
      for (const [name, store] of Object.entries({ owner, clientA, clientB })) {
        store.onStateChange((state, _previous, { actor }) =>
          seen.push(
            `${name} saw ${state.count} from ${actor.id === clientA.actor.id ? 'clientA' : actor.type}`
          )
        );
      }

      clientA.setState((state) => ({ ...state, count: 1 }));
      await settle();

      expect(seen).toMatchInlineSnapshot(`
        [
          "clientA saw 1 from clientA",
          "owner saw 1 from clientA",
          "clientB saw 1 from clientA",
        ]
      `);
    });

    it('delivers custom events from any actor to every other actor', async () => {
      const channel = new Channel({ async: true });
      const owner = create({ owner: true, channel, initialState: INITIAL_STATE });
      const clientA = create({ channel });
      const clientB = create({ channel });
      await Promise.all([clientA.untilReady(), clientB.untilReady()]);
      const seen: string[] = [];
      for (const [name, store] of Object.entries({ owner, clientA, clientB })) {
        store.subscribe('PING', (event) => seen.push(`${name}: ${event.payload}`));
      }

      clientA.send({ type: 'PING', payload: 'from clientA' });
      await settle();
      owner.send({ type: 'PING', payload: 'from owner' });
      await settle();

      expect(seen).toMatchInlineSnapshot(`
        [
          "clientA: from clientA",
          "owner: from clientA",
          "clientB: from clientA",
          "owner: from owner",
          "clientA: from owner",
          "clientB: from owner",
        ]
      `);
    });

    it.each([
      {
        name: 'setState',
        input: (store: UniversalStore<State, CustomEvent>) => store.setState(INITIAL_STATE),
      },
      {
        name: 'send',
        input: (store: UniversalStore<State, CustomEvent>) =>
          store.send({ type: 'PING', payload: '' }),
      },
    ])('throws on $name before a client is ready', ({ input }) => {
      const client = create({ channel: new Channel({}) });
      expect(() => input(client)).toThrow(/before store is ready/);
    });

    it('stops syncing a disposed client', async () => {
      const channel = new Channel({ async: true });
      const owner = create({ owner: true, channel, initialState: INITIAL_STATE });
      const client = create({ channel });
      await client.untilReady();

      client.__dispose();
      owner.setState({ count: 1, log: [] });
      await settle();

      expect(client.getState()).toEqual(INITIAL_STATE);
    });
  });

  describe('without an owner', () => {
    it('rejects after the timeout, then syncs when an owner appears', async () => {
      vi.useFakeTimers();
      const channel = new Channel({});
      const client = create({ channel });
      const timedOut = expect(client.untilReady()).rejects.toBeInstanceOf(
        UniversalStoreFollowerTimeoutError
      );
      await vi.advanceTimersByTimeAsync(1000);
      await timedOut;
      expect(client.status).toBe('ERROR');

      create({ owner: true, channel, initialState: { count: 7, log: [] } });

      expect({ status: client.status, state: client.getState() }).toMatchInlineSnapshot(`
        {
          "state": {
            "count": 7,
            "log": [],
          },
          "status": "READY",
        }
      `);
    });

    it('asks the owner again when awaited after a timeout', async () => {
      vi.useFakeTimers();
      const clientChannel = new Channel({});
      const client = create({ channel: clientChannel });
      const timedOut = expect(client.untilReady()).rejects.toThrow();
      await vi.advanceTimersByTimeAsync(1000);
      await timedOut;
      const requests = vi.spyOn(clientChannel, 'emit');

      const ready = client.untilReady();

      expect(requests).toHaveBeenCalledWith(`UNIVERSAL_STORE:${ID}`, {
        kind: 'state-request',
        from: client.actor,
      });
      clientChannel.emit(`UNIVERSAL_STORE:${ID}`, {
        kind: 'state',
        to: client.actor.id,
        state: { count: 9, log: [] },
        from: { id: 'owner', type: 'OWNER' },
      });
      await expect(ready).resolves.toBeUndefined();
      expect(client.getState().count).toBe(9);
    });
  });

  describe('MockUniversalStore', () => {
    it('owns its state in isolation', () => {
      const mock = new MockUniversalStore<State, CustomEvent>({
        id: ID,
        initialState: INITIAL_STATE,
      });
      mock.setState({ count: 1, log: [] });
      expect({ status: mock.status, type: mock.actor.type, state: mock.getState() })
        .toMatchInlineSnapshot(`
          {
            "state": {
              "count": 1,
              "log": [],
            },
            "status": "READY",
            "type": "OWNER",
          }
        `);
    });

    it('wraps the public methods with spies', () => {
      const mock = new MockUniversalStore<State, CustomEvent>(
        { id: ID, initialState: INITIAL_STATE },
        vi
      );
      const listener = vi.fn();
      mock.subscribe(listener);
      mock.send({ type: 'PING', payload: 'x' });

      expect(mock.send).toHaveBeenCalledWith({ type: 'PING', payload: 'x' });
      expect(listener).toHaveBeenCalledOnce();
      mock.unsubscribeAll();
      mock.send({ type: 'PING', payload: 'y' });
      expect(listener).toHaveBeenCalledOnce();
    });
  });
});

/** Waits until an async channel has delivered everything emitted so far. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}
