import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from 'storybook/internal/client-logger';

import {
  entryStampKey,
  SERVICE_ENTRY,
  SERVICE_SYNC_REPLY,
  SERVICE_SYNC_REQUEST,
} from './service-channel.ts';
import { compareStamps } from './service-sync.ts';
import { createWorld, topologies, type TopologyKind, type World } from './sync-simulation/world.ts';

vi.mock('storybook/internal/client-logger', { spy: true });

const formatWorld = (world: World) =>
  `topology=${world.topology.name} replicas=${world.replicas.map((replica) => replica.id).join(',')}`;

const drain = vi.defineHelper((world: World): void => {
  world.network.drain();
});

const assertStateConverged = vi.defineHelper((world: World): void => {
  const expected = world.replicas[0];
  for (const replica of world.replicas) {
    expect(replica.getState(), `State differs on ${replica.id}. ${formatWorld(world)}`).toEqual(
      expected.getState()
    );
  }
});

const assertCoverage = vi.defineHelper((world: World): void => {
  const authored = world.replicas.flatMap((replica) => replica.authored);
  for (const replica of world.replicas) {
    for (const stamp of authored) {
      const covered =
        replica.reconciler.has(stamp) ||
        (replica.reconciler.vector[stamp.runtimeId] ?? 0) >= stamp.counter;
      expect(
        covered,
        `Stamp ${entryStampKey(stamp)} missing on ${replica.id}. ${formatWorld(world)}`
      ).toBe(true);
    }
  }
});

const assertVectorsAgree = vi.defineHelper((world: World): void => {
  const expected = world.replicas[0].reconciler.vector;
  for (const replica of world.replicas) {
    expect(
      replica.reconciler.vector,
      `Vector differs on ${replica.id}. ${formatWorld(world)}`
    ).toEqual(expected);
  }
});

const assertReplicasAgree = vi.defineHelper((world: World): void => {
  assertStateConverged(world);
  assertVectorsAgree(world);
  assertCoverage(world);
  const expected = world.replicas[0];
  const expectedLog = expected.reconciler.log.map((entry) => entryStampKey(entry.stamp));

  for (const replica of world.replicas) {
    expect(
      replica.reconciler.log.map((entry) => entryStampKey(entry.stamp)),
      `Log differs on ${replica.id}. ${formatWorld(world)}`
    ).toEqual(expectedLog);
    expect(replica.reconciler.clock, `Clock differs on ${replica.id}. ${formatWorld(world)}`).toBe(
      expected.reconciler.clock
    );
    for (let index = 1; index < replica.reconciler.log.length; index += 1) {
      expect(
        compareStamps(replica.reconciler.log[index - 1].stamp, replica.reconciler.log[index].stamp),
        `Log is unordered on ${replica.id}. ${formatWorld(world)}`
      ).toBeLessThan(0);
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

const settleWithoutLogParity = vi.defineHelper((world: World): void => {
  drain(world);
  assertStateConverged(world);
  assertCoverage(world);
  assertVectorsAgree(world);
  assertRelayTermination(world);
});

function peersOf(kind: TopologyKind, id: string): string[] {
  return topologies[kind].edges
    .filter(([left, right]) => left === id || right === id)
    .map(([left, right]) => (left === id ? right : left));
}

const twoHubJoins = [
  { kind: 'dev-triangle', hubA: 'server', hubB: 'manager', joiner: 'preview' },
  { kind: 'two-tabs', hubA: 'server', hubB: 'mb', joiner: 'pb' },
] as const;

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
    'places a gap then the skipped earlier counter, warns, and repairs on $kind',
    async ({ kind, writer, lossy, slow }) => {
      const current = boot(kind);
      current.network.setDelay(slow[0], slow[1], 20);
      current.network.dropNext(writer, lossy);
      await current.replica(writer).commands.setSlot({ slot: 'a', value: '1' });
      await current.replica(writer).commands.setSlot({ slot: 'b', value: '2' });
      settleWithoutLogParity(current);
      expect(current.replica(lossy).getState().slots).toEqual({ a: '1', b: '2' });
      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(expect.stringContaining('gap in writer'));
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

  it('keeps a missing parent as a no-op, warns, repairs the gap from a snapshot, and converges', async () => {
    const current = boot('production-fan');
    await vi.advanceTimersByTimeAsync(1000);
    await current.replica('p1').commands.addParent({ parent: 'p' });
    drain(current);
    current.network.dropNext('manager', 'p2');
    await current.replica('p1').commands.addParent({ parent: 'q' });
    drain(current);
    await current.replica('p1').commands.setNested({ parent: 'q', key: 'k', value: 'v' });
    drain(current);
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(expect.stringContaining('kept as a no-op'));
    expect(vi.mocked(logger.warn).mock.calls[0]?.[0]).toContain('command=setNested');

    settleWithoutLogParity(current);
    expect(current.replica('p2').getState().nest).toEqual({ p: {}, q: { k: 'v' } });
    expect(
      current.network.frames.some((frame) => frame.type === SERVICE_SYNC_REPLY && frame.to === 'p2')
    ).toBe(true);
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

  it('keeps entry frames within a small constant of the first; structuredClone runs only inside a reply', async () => {
    world = createWorld(topologies['dev-triangle'], { skip: ['preview'] });
    drain(world);
    vi.spyOn(globalThis, 'structuredClone');
    const cloneSpy = vi.mocked(globalThis.structuredClone);
    cloneSpy.mockClear();
    world.network.frames.length = 0;

    for (let index = 0; index < 20; index += 1) {
      await world.replica('manager').commands.setSlot({
        slot: `s${index}`,
        value: 'v'.repeat(40),
      });
    }
    drain(world);

    const entryFrames = world.network.frames.filter((frame) => frame.type === SERVICE_ENTRY);
    expect(entryFrames.length).toBeGreaterThan(0);
    const first = entryFrames[0].bytes;
    for (const frame of entryFrames) {
      expect(frame.bytes).toBeLessThan(first + 80);
    }
    expect(cloneSpy).not.toHaveBeenCalled();

    cloneSpy.mockClear();
    world.network.frames.length = 0;
    world.join('preview');
    drain(world);
    const repliesAuthored = new Set(
      world.network.frames
        .filter((frame) => frame.type === SERVICE_SYNC_REPLY)
        .map((frame) => frame.payload)
    ).size;
    expect(repliesAuthored).toBeGreaterThan(0);
    expect(cloneSpy).toHaveBeenCalledTimes(repliesAuthored);
    expect(world.replica('preview').getState().slots.s0).toBe('v'.repeat(40));
  });

  it.each(everyTopology)('bootstraps a late joiner with an empty frontier on %s', async (kind) => {
    const { a: writerId, b: lateId } = nodesOf[kind];
    world = createWorld(topologies[kind], { skip: [lateId] });
    drain(world);
    await world.replica(writerId).commands.setSlot({ slot: 'late', value: 'yes' });
    drain(world);

    world.join(lateId);
    settleWithoutLogParity(world);
    expect(world.replica(lateId).getState().slots.late).toBe('yes');
  });

  it.each(everyTopology)(
    'bootstraps a late joiner that writes before its reply arrives on %s',
    async (kind) => {
      const { a: writerId, b: lateId } = nodesOf[kind];
      world = createWorld(topologies[kind], { skip: [lateId] });
      drain(world);
      await world.replica(writerId).commands.setSlot({ slot: 'late', value: 'yes' });
      drain(world);

      for (const peer of peersOf(kind, lateId)) {
        world.network.hold(peer, lateId);
      }
      const joiner = world.join(lateId);
      await joiner.commands.setSlot({ slot: 'mine', value: 'early' });
      drain(world);
      for (const peer of peersOf(kind, lateId)) {
        world.network.release(peer, lateId);
      }

      settleWithoutLogParity(world);
      expect(joiner.getState().slots).toEqual({ late: 'yes', mine: 'early' });
    }
  );

  it.each(everyTopology)(
    'keeps a behind replica own writes while catching up through a snapshot on %s',
    async (kind) => {
      const { a, b } = nodesOf[kind];
      const current = boot(kind);
      await vi.advanceTimersByTimeAsync(1000);
      for (const peer of peersOf(kind, b)) {
        current.network.dropNext(peer, b, 2);
      }
      await current.replica(a).commands.setSlot({ slot: 'a', value: '1' });
      await current.replica(a).commands.setSlot({ slot: 'b', value: '2' });
      await current.replica(b).commands.setSlot({ slot: 'mine', value: 'p' });
      await current.replica(a).commands.setSlot({ slot: 'c', value: '3' });
      settleWithoutLogParity(current);
      expect(current.replica(b).getState().slots).toEqual({ a: '1', b: '2', mine: 'p', c: '3' });
    }
  );

  it.each(twoHubJoins)(
    'installs two dominating replies in arrival order on $kind',
    async ({ kind, hubA, hubB, joiner }) => {
      world = createWorld(topologies[kind], { skip: [joiner] });
      drain(world);
      await world.replica(hubA).commands.setSlot({ slot: 'a', value: '1' });
      drain(world);
      world.network.hold(hubA, hubB);
      world.network.hold(hubB, hubA);
      await world.replica(hubA).commands.setSlot({ slot: 'b', value: '2' });
      drain(world);

      world.network.hold(hubA, joiner);
      world.join(joiner);
      drain(world);
      expect(world.replica(joiner).getState().slots).toEqual({ a: '1' });

      world.network.release(hubA, joiner);
      drain(world);
      expect(world.replica(joiner).getState().slots).toEqual({ a: '1', b: '2' });

      world.network.release(hubA, hubB);
      world.network.release(hubB, hubA);
      settleWithoutLogParity(world);
    }
  );

  it.each(twoHubJoins)(
    'drops a concurrent reply with a warning and does not assert convergence on $kind',
    async ({ kind, hubA, hubB, joiner }) => {
      world = createWorld(topologies[kind], { skip: [joiner] });
      drain(world);
      world.network.hold(hubA, hubB);
      world.network.hold(hubB, hubA);
      await world.replica(hubB).commands.setSlot({ slot: 'a', value: 'from-b' });
      await world.replica(hubA).commands.setSlot({ slot: 'b', value: 'from-a' });
      drain(world);

      world.join(joiner);
      drain(world);
      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        expect.stringContaining('concurrent snapshot reply dropped')
      );
    }
  );

  // A write stamped below every hub's floor is dropped everywhere, but its writer's Vector
  // counts it, so no peer dominates that writer again and no reply ever reaches it. Left unfixed on
  // purpose: on localhost, losing enough entries to leave the window is not expected to happen.
  // Reproduction and the options considered:
  // https://github.com/storybookjs/storybook/pull/36271#discussion_r4081433271
  it.fails('heals a writer that went quiet across a burst and an eviction', async () => {
    world = createWorld(topologies['dev-triangle']);
    drain(world);
    await vi.advanceTimersByTimeAsync(1000);
    world.network.dropNext('manager', 'preview', 301);
    world.network.dropNext('server', 'preview', 301);
    for (let index = 0; index < 300; index += 1) {
      await world.replica('manager').commands.setSlot({ slot: `s${index}`, value: 'v' });
    }
    drain(world);
    await vi.advanceTimersByTimeAsync(16_000);
    await world.replica('manager').commands.setSlot({ slot: 'late', value: 'm' });
    drain(world);

    await world.replica('preview').commands.setSlot({ slot: 'stale', value: 'p' });
    drain(world);
    await vi.advanceTimersByTimeAsync(5000);
    await world.replica('manager').commands.setSlot({ slot: 'after', value: 'x' });
    drain(world);
    await vi.advanceTimersByTimeAsync(5000);

    settleWithoutLogParity(world);
  });

  it.each(everyTopology)(
    'clears a silent request after 1 s so a later gap can ask again on %s',
    async (kind) => {
      const { b } = nodesOf[kind];
      const current = boot(kind);
      const requestsAtBoot = current.network.frames.filter(
        (frame) => frame.type === SERVICE_SYNC_REQUEST
      ).length;
      expect(requestsAtBoot).toBeGreaterThan(0);

      await vi.advanceTimersByTimeAsync(1000);
      current.network.frames.length = 0;
      for (const peer of peersOf(kind, b)) {
        current.network.dropNext(b, peer);
      }
      await current.replica(b).commands.setSlot({ slot: 'a', value: '1' });
      await current.replica(b).commands.setSlot({ slot: 'b', value: '2' });
      drain(current);

      expect(current.network.frames.some((frame) => frame.type === SERVICE_SYNC_REQUEST)).toBe(
        true
      );
      settleWithoutLogParity(current);
    }
  );

  it.each(twoHubJoins)(
    'requests a snapshot after the window shrinks past an incoming entry on $kind',
    async ({ kind, hubA, hubB, joiner }) => {
      world = createWorld(topologies[kind], {
        windows: { [joiner]: { maxAgeMs: 0, maxEntries: 2 } },
      });
      drain(world);
      await vi.advanceTimersByTimeAsync(1000);
      world.network.dropNext(hubB, joiner, 1);
      world.network.setDelay(hubA, joiner, 50);
      await world.replica(hubA).commands.setSlot({ slot: 'old', value: 'from-a' });
      world.network.drainDue();
      world.network.setDelay(hubA, joiner, 0);
      await world.replica(hubB).commands.setSlot({ slot: 'a', value: '1' });
      await world.replica(hubB).commands.setSlot({ slot: 'b', value: '2' });
      await world.replica(hubB).commands.setSlot({ slot: 'c', value: '3' });
      world.network.drainDue();
      settleWithoutLogParity(world);
      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        expect.stringContaining('beyond the log window')
      );
      expect(world.replica(joiner).getState().slots).toEqual({
        old: 'from-a',
        a: '1',
        b: '2',
        c: '3',
      });
    }
  );

  it.each(twoHubJoins)(
    'converges a leaf through a forwarded snapshot after the server drops a beyond-window entry on $kind',
    async ({ kind, hubA, hubB, joiner }) => {
      world = createWorld(topologies[kind], {
        windows: { [hubA]: { maxAgeMs: 0, maxEntries: 2 } },
      });
      drain(world);
      await vi.advanceTimersByTimeAsync(1000);
      world.network.dropNext(hubB, hubA, 1);
      world.network.dropNext(hubB, joiner, 10);
      world.network.dropNext(hubA, joiner, 3);
      world.network.setDelay(joiner, hubA, 50);

      await world.replica(joiner).commands.setSlot({ slot: 'early', value: 'yes' });
      world.network.drainDue();
      await world.replica(hubB).commands.setSlot({ slot: 'a', value: '1' });
      await world.replica(hubB).commands.setSlot({ slot: 'b', value: '2' });
      await world.replica(hubB).commands.setSlot({ slot: 'c', value: '3' });
      world.network.drainDue();
      settleWithoutLogParity(world);
      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        expect.stringContaining('beyond the log window')
      );
      expect(world.replica(joiner).getState().slots).toEqual({
        early: 'yes',
        a: '1',
        b: '2',
        c: '3',
      });
      // hubA forwards the beyond-window entry, so any peer that placed it may be the first to
      // answer hubA's request; the joiner heals through whichever reply hubA installed.
      const repliesToHubA = new Set(
        world.network.frames
          .filter((frame) => frame.type === SERVICE_SYNC_REPLY && frame.to === hubA)
          .map((frame) => frame.payload)
      );
      expect(
        world.network.frames.some(
          (frame) =>
            frame.type === SERVICE_SYNC_REPLY &&
            frame.from === hubA &&
            frame.to === joiner &&
            repliesToHubA.has(frame.payload)
        )
      ).toBe(true);
    }
  );

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

  it.each(twoHubJoins)(
    'repairs a delayed concurrent entry that arrives after snapshot bootstrap on $kind',
    async ({ kind, hubA, hubB, joiner }) => {
      world = createWorld(topologies[kind], { skip: [joiner] });
      drain(world);

      world.network.hold(hubB, hubA);
      world.network.hold(hubB, joiner);

      await world.replica(hubA).commands.setSlot({ slot: 'shared', value: 'a' });
      await world.replica(hubB).commands.setSlot({ slot: 'shared', value: 'b' });
      drain(world);

      expect(world.replica(hubA).getState().slots.shared).toBe('a');
      expect(world.replica(hubB).getState().slots.shared).toBe('a');

      world.join(joiner);
      drain(world);
      expect(world.replica(joiner).getState().slots.shared).toBe('a');
      expect(world.replica(joiner).reconciler.vector).toEqual({ [hubA]: 1 });

      world.network.release(hubB, hubA);
      settleWithoutLogParity(world);
      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        expect.stringContaining('beyond the log window')
      );
      expect(world.replica(joiner).getState().slots.shared).toBe('a');
      expect(world.replica(joiner).reconciler.vector).toEqual({ [hubB]: 1, [hubA]: 1 });
    }
  );

  it.each(twoHubJoins)(
    'installs the first write of a command and applies the second as an entry when a replica joins in between on $kind',
    async ({ kind, hubB, joiner }) => {
      world = createWorld(topologies[kind], { skip: [joiner] });
      drain(world);
      const twoWrites = world.replica(hubB).commands.writeWaitWrite({
        slot: 'count',
        first: '1',
        second: '0',
        holdMs: 10,
      });
      await vi.advanceTimersByTimeAsync(0);
      drain(world);

      world.join(joiner);
      drain(world);
      expect(world.replica(joiner).getState().slots).toEqual({ count: '1' });

      await vi.advanceTimersByTimeAsync(10);
      await twoWrites;
      settleWithoutLogParity(world);
      expect(world.replica(joiner).getState().slots).toEqual({ count: '0' });
      expect(vi.mocked(logger.warn)).not.toHaveBeenCalled();
    }
  );

  it.each(twoHubJoins)(
    'repairs through the clock floor when a joiner installs a snapshot ahead of a command still writing on $kind',
    async ({ kind, hubA, hubB, joiner }) => {
      world = createWorld(topologies[kind], { skip: [joiner] });
      drain(world);
      const twoWrites = world.replica(hubB).commands.writeWaitWrite({
        slot: 'count',
        first: '1',
        second: '0',
        holdMs: 10,
      });
      await vi.advanceTimersByTimeAsync(0);
      drain(world);

      // hubA moves the clock past hubB without hubB hearing it, so hubB's second write stamps a
      // seq at or below the clock the joiner installs.
      world.network.hold(hubA, hubB);
      await world.replica(hubA).commands.setSlot({ slot: 'other', value: 'x' });
      drain(world);

      world.join(joiner);
      drain(world);
      expect(world.replica(joiner).getState().slots).toEqual({ count: '1', other: 'x' });

      await vi.advanceTimersByTimeAsync(10);
      await twoWrites;
      world.network.release(hubA, hubB);
      settleWithoutLogParity(world);
      expect(world.replica(joiner).getState().slots).toEqual({ count: '0', other: 'x' });
      expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
        expect.stringContaining('beyond the log window')
      );
    }
  );

  it('drops a held gap entry below the reply clock on install so a closed tab cannot split two tabs', async () => {
    const current = boot('two-tabs');
    await vi.advanceTimersByTimeAsync(1000);

    // pa's first write is lost on both links, its second reaches everyone as a gap, and the tab
    // closes, so no peer can ever fill the gap.
    current.network.dropNext('pa', 'server');
    current.network.dropNext('pa', 'ma');
    await current.replica('pa').commands.setSlot({ slot: 'x', value: 'a' });
    await current.replica('pa').commands.setSlot({ slot: 'x', value: 'g' });
    current.replica('pa').disconnect();
    drain(current);
    await vi.advanceTimersByTimeAsync(1000);

    // mb writes the same slot later; the server's forward to ma is lost. mb's next write reaches
    // ma as a gap, ma asks, and the server replies with a vector that does not cover pa.
    current.network.dropNext('server', 'ma');
    await current.replica('mb').commands.setSlot({ slot: 'x', value: 'L' });
    drain(current);
    await current.replica('mb').commands.setSlot({ slot: 'y', value: '2' });
    drain(current);
    await vi.advanceTimersByTimeAsync(1000);
    drain(current);

    const live = ['server', 'ma', 'mb', 'pb'];
    for (const id of live) {
      expect(current.replica(id).reconciler.vector, id).toEqual({ mb: 2 });
      expect(current.replica(id).getState().slots, id).toEqual({ x: 'L', y: '2' });
    }
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('dropped on install')
    );
  });

  it('forwards a beyond-window entry from the hub so a lagging writer can still be dominated and repaired', async () => {
    const current = boot('two-tabs');
    await vi.advanceTimersByTimeAsync(1000);

    // pa's first entry never reaches the server; ma holds it.
    current.network.dropNext('pa', 'server');
    current.network.dropNext('ma', 'server');
    await current.replica('pa').commands.setSlot({ slot: 'a', value: 'a' });
    drain(current);

    // mb writes at clock 0 while the entry sits in flight; meanwhile pa's second entry reaches
    // the server as a gap and the server installs a snapshot whose clock is 2.
    current.network.hold('mb', 'server');
    current.network.hold('mb', 'pb');
    await current.replica('mb').commands.setSlot({ slot: 'm', value: 'm' });
    await current.replica('pa').commands.setSlot({ slot: 'x', value: 'g' });
    drain(current);

    // mb's entry (seq 1) now lands at or below the server's reply-clock floor.
    current.network.release('mb', 'server');
    current.network.release('mb', 'pb');
    drain(current);
    await vi.advanceTimersByTimeAsync(1000);
    settleWithoutLogParity(current);
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('beyond the log window')
    );
    expect(current.replica('mb').getState().slots).toEqual({ a: 'a', x: 'g', m: 'm' });
  });

  it.each(twoHubJoins)(
    'lets a subscriber on a joiner react to the installed snapshot with one derived entry on $kind',
    async ({ kind, hubA, joiner }) => {
      world = createWorld(topologies[kind], { skip: [joiner] });
      drain(world);
      await world.replica(hubA).commands.setSlot({ slot: 'trigger', value: 't' });
      drain(world);

      const late = world.join(joiner);
      let reacted = false;
      const unsubscribe = late.queries.snapshot.subscribe(undefined, (state) => {
        if (state.data?.slots.trigger && !reacted) {
          reacted = true;
          void late.commands.setSlot({
            slot: 'reaction',
            value: `saw ${state.data.slots.trigger}`,
          });
        }
      });
      drain(world);
      await vi.advanceTimersByTimeAsync(1);
      settleWithoutLogParity(world);
      unsubscribe();

      expect(late.authored).toHaveLength(1);
      expect(world.replica(hubA).getState().slots).toEqual({ trigger: 't', reaction: 'saw t' });
    }
  );

  it('forwards each beyond-window stamp once when more are in flight than the window keeps', async () => {
    const current = boot('two-tabs');
    await vi.advanceTimersByTimeAsync(1000);

    // mb is cut off from the server in both directions, so its burst and ma's burst are concurrent.
    current.network.hold('mb', 'server');
    current.network.hold('mb', 'pb');
    current.network.hold('server', 'mb');
    for (let index = 0; index < 600; index += 1) {
      await current.replica('ma').commands.setSlot({ slot: `a${index}`, value: 'a' });
    }
    drain(current);
    for (let index = 0; index < 600; index += 1) {
      await current.replica('mb').commands.setSlot({ slot: `b${index}`, value: 'b' });
    }
    // One more write after 15 s evicts ma's oldest 345 entries on the server and on ma, so mb's
    // entries up to seq 344 land below both floors: more dropped stamps than the window keeps.
    await vi.advanceTimersByTimeAsync(16_000);
    await current.replica('ma').commands.setSlot({ slot: 'last', value: 'a' });
    drain(current);

    current.network.release('mb', 'server');
    drain(current);
    assertRelayTermination(current);
  }, 30_000);

  it('converges after two concurrent bursts longer than the entry count on the production fan', async () => {
    const current = boot('production-fan');
    await vi.advanceTimersByTimeAsync(1000);
    for (let index = 0; index < 258; index += 1) {
      await current.replica('p1').commands.setSlot({ slot: `a${index}`, value: 'a' });
    }
    for (let index = 0; index < 257; index += 1) {
      await current.replica('p2').commands.setSlot({ slot: `b${index}`, value: 'b' });
    }
    drain(current);
    await vi.advanceTimersByTimeAsync(1000);
    drain(current);
    await vi.advanceTimersByTimeAsync(1000);

    settleWithoutLogParity(current);
    expect(Object.keys(current.replica('p1').getState().slots)).toHaveLength(515);
  }, 30_000);

  it('converges two tabs after a 16 s partition in which both sides wrote', async () => {
    const current = boot('two-tabs');
    await vi.advanceTimersByTimeAsync(1000);
    const cut = [
      ['server', 'mb'],
      ['mb', 'server'],
      ['server', 'pb'],
      ['pb', 'server'],
    ] as const;
    for (const [from, to] of cut) {
      current.network.hold(from, to);
    }
    for (const slot of ['a0', 'a1']) {
      await current.replica('ma').commands.setSlot({ slot, value: 'a' });
    }
    for (const slot of ['b0', 'b1']) {
      await current.replica('mb').commands.setSlot({ slot, value: 'b' });
    }
    drain(current);
    await vi.advanceTimersByTimeAsync(16_000);
    await current.replica('ma').commands.setSlot({ slot: 'a2', value: 'a' });
    await current.replica('mb').commands.setSlot({ slot: 'b2', value: 'b' });
    drain(current);
    for (const [from, to] of cut) {
      current.network.release(from, to);
    }
    drain(current);
    await vi.advanceTimersByTimeAsync(1000);
    drain(current);
    await vi.advanceTimersByTimeAsync(1000);

    settleWithoutLogParity(current);
    expect(Object.keys(current.replica('pb').getState().slots).sort()).toEqual([
      'a0',
      'a1',
      'a2',
      'b0',
      'b1',
      'b2',
    ]);
  });
});
