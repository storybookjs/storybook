import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from 'storybook/internal/client-logger';

import { entryStampKey, SERVICE_ENTRY } from './service-channel.ts';
import { compareStamps } from './service-sync.ts';
import { createWorld, topologies, type TopologyKind, type World } from './sync-simulation/world.ts';

vi.mock('storybook/internal/client-logger', { spy: true });

const formatWorld = (world: World) =>
  `topology=${world.topology.name} replicas=${world.replicas.map((replica) => replica.id).join(',')}`;

const drain = vi.defineHelper((world: World): void => {
  world.network.drain();
});

const assertReplicasAgree = vi.defineHelper((world: World): void => {
  const expected = world.replicas[0];
  const expectedLog = expected.reconciler.log.map((entry) => entryStampKey(entry.stamp));

  for (const replica of world.replicas) {
    expect(replica.getState(), `State differs on ${replica.id}. ${formatWorld(world)}`).toEqual(
      expected.getState()
    );
    expect(
      replica.reconciler.log.map((entry) => entryStampKey(entry.stamp)),
      `Log differs on ${replica.id}. ${formatWorld(world)}`
    ).toEqual(expectedLog);
    expect(
      replica.reconciler.vector,
      `Vector differs on ${replica.id}. ${formatWorld(world)}`
    ).toEqual(expected.reconciler.vector);
    expect(replica.reconciler.clock, `Clock differs on ${replica.id}. ${formatWorld(world)}`).toBe(
      expected.reconciler.clock
    );

    for (let index = 1; index < replica.reconciler.log.length; index += 1) {
      expect(
        compareStamps(replica.reconciler.log[index - 1].stamp, replica.reconciler.log[index].stamp),
        `Log is unordered on ${replica.id}. ${formatWorld(world)}`
      ).toBeLessThan(0);
    }

    for (const author of world.replicas) {
      for (const authored of author.authored) {
        const covered =
          replica.reconciler.has(authored) ||
          authored.counter <= (replica.reconciler.vector[authored.runtimeId] ?? 0);
        expect(
          covered,
          `${replica.id} holds neither the log entry nor vector cover for ${entryStampKey(authored)}. ${formatWorld(world)}`
        ).toBe(true);
      }
    }
  }
});

// Only for schedules without drops or gaps, where every authored entry is retained everywhere.
const assertClockAndVectorMatchLog = vi.defineHelper((world: World): void => {
  for (const replica of world.replicas) {
    const { log, clock, vector } = replica.reconciler;
    expect(clock, `Clock is not the highest seq held on ${replica.id}`).toBe(
      Math.max(0, ...log.map((entry) => entry.stamp.seq))
    );
    const maxCounter: Record<string, number> = {};
    for (const entry of log) {
      const { runtimeId, counter } = entry.stamp;
      maxCounter[runtimeId] = Math.max(maxCounter[runtimeId] ?? 0, counter);
    }
    expect(vector, `Vector is not the per-writer max counter on ${replica.id}`).toEqual(maxCounter);
  }
});

type Nodes = { hub: string; a: string; b: string };
const nodesOf: Record<TopologyKind, Nodes> = {
  'dev-triangle': { hub: 'server', a: 'manager', b: 'preview' },
  'production-fan': { hub: 'manager', a: 'p1', b: 'p2' },
  'two-tabs': { hub: 'server', a: 'pa', b: 'pb' },
};
const everyTopology = Object.keys(nodesOf) as TopologyKind[];

const assertRelayTermination = vi.defineHelper((world: World): void => {
  for (const replica of world.replicas) {
    if (!replica.relay) {
      continue;
    }
    for (const [key, count] of replica.entryEmits) {
      expect(
        count,
        `Hub ${replica.id} emitted stamp ${key} ${count} times. ${formatWorld(world)}`
      ).toBeLessThanOrEqual(1);
    }
  }
});

const settle = vi.defineHelper((world: World): void => {
  drain(world);
  assertReplicasAgree(world);
});

describe('open-service sync simulation', () => {
  let world: World | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(logger.debug).mockReset();
    vi.mocked(logger.warn).mockReset();
    vi.mocked(logger.debug).mockImplementation(() => undefined);
    vi.mocked(logger.warn).mockImplementation(() => undefined);
  });

  afterEach(() => {
    world?.disconnect();
    world = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function boot(kind: TopologyKind): World {
    world = createWorld(topologies[kind]);
    drain(world);
    return world;
  }

  it('advances Lamport time after receiving before authoring', async () => {
    const current = boot('dev-triangle');
    await current.replica('manager').commands.setSlot({ slot: 'a', value: '1' });
    drain(current);
    const before = current.replica('server').subscriberNotifications;

    await current.replica('preview').commands.setSlot({ slot: 'b', value: '2' });
    settle(current);

    expect(current.replica('preview').authored.at(-1)?.seq).toBe(2);
    expect(current.replica('server').getState().slots).toEqual({ a: '1', b: '2' });
    expect(current.replica('server').subscriberNotifications - before).toBe(1);
  });

  it.each(everyTopology)('drops a duplicate echo and still converges on %s', async (kind) => {
    const { hub, b } = nodesOf[kind];
    const current = boot(kind);
    current.network.duplicateNext(b, hub);
    await current.replica(b).commands.setSlot({ slot: 'a', value: '1' });
    settle(current);
    assertClockAndVectorMatchLog(current);
    assertRelayTermination(current);
  });

  it.each([
    { kind: 'dev-triangle', writer: 'preview', lossy: 'manager', slow: ['server', 'manager'] },
    { kind: 'two-tabs', writer: 'pa', lossy: 'ma', slow: ['server', 'ma'] },
  ] as const)(
    'places a gap then the skipped earlier counter without warning on $kind',
    async ({ kind, writer, lossy, slow }) => {
      const current = boot(kind);
      current.network.setDelay(slow[0], slow[1], 20);
      current.network.dropNext(writer, lossy);
      await current.replica(writer).commands.setSlot({ slot: 'a', value: '1' });
      await current.replica(writer).commands.setSlot({ slot: 'b', value: '2' });
      settle(current);
      expect(current.replica(lossy).getState().slots).toEqual({ a: '1', b: '2' });
      expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
    }
  );

  it.each(['dev-triangle', 'production-fan'] as const)(
    'converges when an earlier remove races a later write to the same slot on %s',
    async (kind) => {
      const { a, b } = nodesOf[kind];
      const current = boot(kind);
      await current.replica(a).commands.setSlot({ slot: 'x', value: '1' });
      drain(current);

      await current.replica(b).commands.setSlot({ slot: 'x', value: 'B' });
      await current.replica(a).commands.removeSlot({ slot: 'x' });
      expect(current.replica(a).authored.at(-1)?.seq).toBe(2);
      expect(current.replica(b).authored.at(-1)?.seq).toBe(2);
      settle(current);
      assertClockAndVectorMatchLog(current);

      expect(current.replica(a).getState().slots).toEqual({ x: 'B' });
    }
  );

  it.each(everyTopology)(
    'sends an undefined assignment as a remove and drops the key everywhere on %s',
    async (kind) => {
      const { hub, a, b } = nodesOf[kind];
      const current = boot(kind);
      await current.replica(b).commands.setSlot({ slot: 'x', value: '1' });
      await current.replica(b).commands.unsetSlot({ slot: 'x' });
      settle(current);

      expect(current.replica(hub).reconciler.log.at(-1)?.patch).toEqual([
        { op: 'remove', path: '/slots/x' },
      ]);
      expect(current.replica(a).getState().slots).toEqual({});
    }
  );

  it.each(['dev-triangle', 'production-fan'] as const)(
    'redoes a remove onto a missing key when two replicas remove the same slot concurrently on %s',
    async (kind) => {
      const { a, b } = nodesOf[kind];
      const current = boot(kind);
      await current.replica(a).commands.setSlot({ slot: 'x', value: '1' });
      drain(current);

      await current.replica(b).commands.removeSlot({ slot: 'x' });
      await current.replica(a).commands.removeSlot({ slot: 'x' });
      expect(current.replica(a).authored.at(-1)?.seq).toBe(2);
      expect(current.replica(b).authored.at(-1)?.seq).toBe(2);
      settle(current);
      assertClockAndVectorMatchLog(current);

      expect(current.replica(a).getState().slots).toEqual({});
      expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
    }
  );

  it('undoes through a burst past 256 when a concurrent write is placed earlier', async () => {
    const current = boot('production-fan');
    current.network.setDelay('p1', 'manager', 5);
    const burst = Promise.all(
      Array.from({ length: 260 }, (_, index) =>
        current.replica('p1').commands.setSlot({ slot: `b${index}`, value: `${index}` })
      )
    );
    const concurrent = current.replica('p2').commands.setSlot({ slot: 'other', value: 'x' });
    await burst;
    await concurrent;
    settle(current);
    expect(current.replica('manager').getState().slots.other).toBe('x');
    expect(Object.keys(current.replica('p2').getState().slots)).toHaveLength(261);
  });

  it('rolls back a missing parent and warns with service, stamp, path, and command', async () => {
    const current = boot('production-fan');
    await current.replica('p1').commands.addParent({ parent: 'p' });
    drain(current);
    current.network.dropNext('manager', 'p2');
    await current.replica('p1').commands.addParent({ parent: 'q' });
    drain(current);
    await current.replica('p1').commands.setNested({ parent: 'q', key: 'k', value: 'v' });
    drain(current);
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(expect.stringContaining('missing parent'));
    expect(vi.mocked(logger.warn).mock.calls[0]?.[0]).toContain('command=setNested');
    expect(current.replica('p2').getState().nest.q).toBeUndefined();
  });

  it.each(everyTopology)(
    'attributes two overlapping local commands to separate entries on %s',
    async (kind) => {
      const { hub, b } = nodesOf[kind];
      const current = boot(kind);
      const slow = current.replica(b).commands.holdThenSetSlot({
        slot: 'slow',
        value: 'S',
        holdMs: 10,
      });
      const fast = current.replica(b).commands.holdThenSetSlot({
        slot: 'fast',
        value: 'F',
        holdMs: 5,
      });
      await vi.advanceTimersByTimeAsync(5);
      await fast;
      await vi.advanceTimersByTimeAsync(5);
      await slow;
      settle(current);
      expect(current.replica(b).authored).toHaveLength(2);
      expect(current.replica(hub).getState().slots).toEqual({ fast: 'F', slow: 'S' });
    }
  );

  it('places a peer write between the two writes of one command and converges', async () => {
    const current = boot('dev-triangle');
    const twoWrites = current.replica('preview').commands.writeWaitWrite({
      slot: 'count',
      first: '1',
      second: '0',
      holdMs: 10,
    });
    await vi.advanceTimersByTimeAsync(0);
    drain(current);
    await current.replica('manager').commands.setSlot({ slot: 'count', value: '2' });
    drain(current);
    await vi.advanceTimersByTimeAsync(10);
    await twoWrites;
    settle(current);

    expect(current.replica('preview').authored).toHaveLength(2);
    expect(current.replica('server').reconciler.log.map((entry) => entry.stamp.seq)).toEqual([
      1, 2, 3,
    ]);
    expect(current.replica('server').getState().slots.count).toBe('0');
  });

  it('shares the write made before a command throws and nothing after it', async () => {
    const current = boot('dev-triangle');
    const failing = expect(
      current.replica('preview').commands.writeThenThrow({ slot: 'a', value: '1', holdMs: 10 })
    ).rejects.toThrow('writeThenThrow failed');
    await vi.advanceTimersByTimeAsync(0);
    drain(current);
    expect(current.replica('server').getState().slots).toEqual({ a: '1' });

    await vi.advanceTimersByTimeAsync(10);
    await failing;
    settle(current);

    expect(current.replica('preview').authored).toHaveLength(1);
    expect(current.replica('manager').getState().slots).toEqual({ a: '1' });
  });

  it('lets a subscriber on a receiving replica react with one derived entry that converges', async () => {
    const current = boot('dev-triangle');
    let reacted = false;
    const unsubscribe = current
      .replica('manager')
      .queries.snapshot.subscribe(undefined, (state) => {
        if (state.data?.slots.trigger && !reacted) {
          reacted = true;
          void current.replica('manager').commands.setSlot({
            slot: 'reaction',
            value: `saw ${state.data.slots.trigger}`,
          });
        }
      });

    await current.replica('preview').commands.setSlot({ slot: 'trigger', value: 't' });
    drain(current);
    await vi.advanceTimersByTimeAsync(1);
    settle(current);
    unsubscribe();

    expect(current.replica('manager').authored).toHaveLength(1);
    expect(current.replica('preview').getState().slots).toEqual({
      trigger: 't',
      reaction: 'saw t',
    });
    expect(current.replica('server').reconciler.log.map((entry) => entry.command)).toEqual([
      'setSlot',
      'setSlot',
    ]);
    assertRelayTermination(current);
  });

  it.each(everyTopology)(
    'places an earlier concurrent write through undo and redo in one subscriber transition on %s',
    async (kind) => {
      const { a, b } = nodesOf[kind];
      const current = boot(kind);
      await current.replica(a).commands.setSlot({ slot: 'left', value: 'L' });
      await current.replica(b).commands.setSlot({ slot: 'right', value: 'R' });
      expect(current.replica(a).authored[0]?.seq).toBe(1);
      expect(current.replica(b).authored[0]?.seq).toBe(1);

      const before = current.replica(b).subscriberNotifications;
      settle(current);

      expect(current.replica(b).subscriberNotifications - before).toBe(1);
      expect(current.replica(b).getState().slots).toEqual({ left: 'L', right: 'R' });
    }
  );

  it.each([
    { kind: 'dev-triangle', earlier: 'manager', later: 'preview' },
    { kind: 'production-fan', earlier: 'p1', later: 'p2' },
  ] as const)(
    'undoes a subsuming recipe with the recorder inverse and converges on $kind',
    async ({ kind, earlier, later }) => {
      const current = boot(kind);
      await current.replica(later).commands.addParent({ parent: 'p' });
      drain(current);

      await current.replica(earlier).commands.setNested({ parent: 'p', key: 'e', value: 'E' });
      await current.replica(later).commands.writeChildThenReplaceParent({
        parent: 'p',
        key: 'l',
        value: 'L',
      });
      expect(current.replica(earlier).authored.at(-1)?.seq).toBe(2);
      expect(current.replica(later).authored.at(-1)?.seq).toBe(2);
      settle(current);

      expect(current.replica(earlier).getState().nest.p).toEqual({ only: 'L' });
    }
  );

  it('keeps an assigned copy detached from its source on every replica', async () => {
    const current = boot('dev-triangle');
    await current.replica('preview').commands.addParent({ parent: 'src' });
    await current.replica('preview').commands.setNested({ parent: 'src', key: 'k', value: '1' });
    await current.replica('preview').commands.copyParent({ from: 'src', to: 'copy' });
    await current.replica('preview').commands.setNested({ parent: 'src', key: 'k', value: '2' });
    settle(current);

    expect(current.replica('server').getState().nest).toEqual({
      src: { k: '2' },
      copy: { k: '1' },
    });
  });

  it('does not emit one stamp twice from a hub on two tabs', async () => {
    const current = boot('two-tabs');
    await current.replica('pa').commands.setSlot({ slot: 'a', value: '1' });
    settle(current);
    assertClockAndVectorMatchLog(current);
    assertRelayTermination(current);
    expect(current.replica('pb').getState().slots).toEqual({ a: '1' });
  });

  it('keeps entry frames within a small constant of the first and does not structuredClone on the entry path', async () => {
    const current = boot('dev-triangle');
    vi.spyOn(globalThis, 'structuredClone');
    const cloneSpy = vi.mocked(globalThis.structuredClone);
    cloneSpy.mockClear();
    current.network.frames.length = 0;

    for (let index = 0; index < 20; index += 1) {
      await current.replica('preview').commands.setSlot({
        slot: `s${index}`,
        value: 'v'.repeat(40),
      });
    }
    drain(current);

    const entryFrames = current.network.frames.filter((frame) => frame.type === SERVICE_ENTRY);
    expect(entryFrames.length).toBeGreaterThan(0);
    const first = entryFrames[0].bytes;
    for (const frame of entryFrames) {
      expect(frame.bytes).toBeLessThan(first + 80);
    }
    expect(cloneSpy).not.toHaveBeenCalled();
  });

  it.each([
    { kind: 'dev-triangle', earlier: 'manager', later: 'preview' },
    { kind: 'production-fan', earlier: 'p1', later: 'p2' },
    { kind: 'two-tabs', earlier: 'pa', later: 'pb' },
  ] as const)('orders concurrent same-path writes on $kind', async ({ kind, earlier, later }) => {
    const current = boot(kind);
    await current.replica(earlier).commands.setSlot({ slot: 'shared', value: earlier });
    await current.replica(later).commands.setSlot({ slot: 'shared', value: later });

    expect(current.replica(earlier).authored[0]?.seq).toBe(1);
    expect(current.replica(later).authored[0]?.seq).toBe(1);
    settle(current);

    expect(current.replica(earlier).getState().slots.shared).toBe(later);
    assertClockAndVectorMatchLog(current);
    assertRelayTermination(current);
  });
});
