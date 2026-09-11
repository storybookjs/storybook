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
import { VirtualNetwork } from './sync-simulation/network.ts';

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
  }
});

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

const settleRepaired = vi.defineHelper((world: World): void => {
  drain(world);
  assertStateConverged(world);
  assertCoverage(world);
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

  it('drops a duplicate echo and still converges', async () => {
    const current = boot('dev-triangle');
    current.network.duplicateNext('preview', 'manager');
    await current.replica('preview').commands.setSlot({ slot: 'a', value: '1' });
    settle(current);
    assertRelayTermination(current);
  });

  it('places a gap then the skipped earlier counter, warns, and repairs', async () => {
    const current = boot('dev-triangle');
    current.network.setDelay('server', 'manager', 20);
    current.network.dropNext('preview', 'manager');
    await current.replica('preview').commands.setSlot({ slot: 'a', value: '1' });
    await current.replica('preview').commands.setSlot({ slot: 'b', value: '2' });
    settleRepaired(current);
    expect(current.replica('manager').getState().slots).toEqual({ a: '1', b: '2' });
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(expect.stringContaining('gap in writer'));
  });

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

  it('attributes two overlapping local commands to separate entries', async () => {
    const current = boot('dev-triangle');
    const slow = current.replica('preview').commands.holdThenSetSlot({
      slot: 'slow',
      value: 'S',
      holdMs: 10,
    });
    const fast = current.replica('preview').commands.holdThenSetSlot({
      slot: 'fast',
      value: 'F',
      holdMs: 5,
    });
    await vi.advanceTimersByTimeAsync(5);
    await fast;
    await vi.advanceTimersByTimeAsync(5);
    await slow;
    settle(current);
    expect(current.replica('preview').authored).toHaveLength(2);
    expect(current.replica('server').getState().slots).toEqual({ fast: 'F', slow: 'S' });
  });

  it('does not emit one stamp twice from a hub on two tabs', async () => {
    const current = boot('two-tabs');
    await current.replica('pa').commands.setSlot({ slot: 'a', value: '1' });
    settle(current);
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
    world.join('preview');
    drain(world);
    expect(cloneSpy).toHaveBeenCalled();
    expect(world.replica('preview').getState().slots.s0).toBe('v'.repeat(40));
  });

  it.each(['dev-triangle', 'production-fan', 'two-tabs'] as const)(
    'bootstraps a late joiner with an empty frontier on %s',
    async (kind) => {
      const lateId = kind === 'dev-triangle' ? 'preview' : kind === 'production-fan' ? 'p2' : 'pb';
      const writerId =
        kind === 'dev-triangle' ? 'manager' : kind === 'production-fan' ? 'p1' : 'pa';
      world = createWorld(topologies[kind], { skip: [lateId] });
      drain(world);
      await world.replica(writerId).commands.setSlot({ slot: 'late', value: 'yes' });
      drain(world);

      world.join(lateId);
      settleRepaired(world);
      expect(world.replica(lateId).getState().slots.late).toBe('yes');
    }
  );

  it('keeps a behind replica own writes while catching up through a snapshot', async () => {
    const current = boot('dev-triangle');
    await vi.advanceTimersByTimeAsync(1000);
    current.network.dropNext('manager', 'preview', 2);
    current.network.dropNext('server', 'preview', 2);
    await current.replica('manager').commands.setSlot({ slot: 'a', value: '1' });
    await current.replica('manager').commands.setSlot({ slot: 'b', value: '2' });
    await current.replica('preview').commands.setSlot({ slot: 'mine', value: 'p' });
    await current.replica('manager').commands.setSlot({ slot: 'c', value: '3' });
    settleRepaired(current);
    expect(current.replica('preview').getState().slots).toEqual({
      a: '1',
      b: '2',
      mine: 'p',
      c: '3',
    });
  });

  it('installs two dominating replies in arrival order', async () => {
    world = createWorld(topologies['dev-triangle'], { skip: ['preview'] });
    drain(world);
    await world.replica('server').commands.setSlot({ slot: 'a', value: '1' });
    drain(world);
    world.network.hold('server', 'manager');
    world.network.hold('manager', 'server');
    await world.replica('server').commands.setSlot({ slot: 'b', value: '2' });
    drain(world);

    world.network.hold('server', 'preview');
    world.join('preview');
    drain(world);
    expect(world.replica('preview').getState().slots).toEqual({ a: '1' });

    world.network.release('server', 'preview');
    drain(world);
    expect(world.replica('preview').getState().slots).toEqual({ a: '1', b: '2' });

    world.network.release('server', 'manager');
    world.network.release('manager', 'server');
    settleRepaired(world);
  });

  it('drops a concurrent reply with a warning and does not assert convergence', async () => {
    world = createWorld(topologies['dev-triangle'], { skip: ['preview'] });
    drain(world);
    world.network.hold('server', 'manager');
    world.network.hold('manager', 'server');
    await world.replica('manager').commands.setSlot({ slot: 'a', value: 'from-manager' });
    await world.replica('server').commands.setSlot({ slot: 'b', value: 'from-server' });
    drain(world);

    world.join('preview');
    drain(world);
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('concurrent snapshot reply dropped')
    );
  });

  it('clears a silent request after 1 s so a later gap can ask again', async () => {
    const current = boot('dev-triangle');
    const requestsAtBoot = current.network.frames.filter(
      (frame) => frame.type === SERVICE_SYNC_REQUEST
    ).length;
    expect(requestsAtBoot).toBeGreaterThan(0);

    await vi.advanceTimersByTimeAsync(1000);
    current.network.frames.length = 0;
    current.network.dropNext('preview', 'manager');
    current.network.dropNext('preview', 'server');
    await current.replica('preview').commands.setSlot({ slot: 'a', value: '1' });
    await current.replica('preview').commands.setSlot({ slot: 'b', value: '2' });
    drain(current);

    expect(current.network.frames.some((frame) => frame.type === SERVICE_SYNC_REQUEST)).toBe(true);
    settleRepaired(current);
  });

  it('requests a snapshot after the window shrinks past an incoming entry', async () => {
    world = createWorld(topologies['dev-triangle'], {
      windows: { preview: { maxAgeMs: 0, maxEntries: 2 } },
    });
    drain(world);
    await vi.advanceTimersByTimeAsync(1000);
    world.network.dropNext('manager', 'preview', 1);
    world.network.setDelay('server', 'preview', 50);
    await world.replica('server').commands.setSlot({ slot: 'old', value: 'from-server' });
    world.network.drainDue();
    world.network.setDelay('server', 'preview', 0);
    await world.replica('manager').commands.setSlot({ slot: 'a', value: '1' });
    await world.replica('manager').commands.setSlot({ slot: 'b', value: '2' });
    await world.replica('manager').commands.setSlot({ slot: 'c', value: '3' });
    world.network.drainDue();
    settleRepaired(world);
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('beyond the log window')
    );
    expect(world.replica('preview').getState().slots).toEqual({
      old: 'from-server',
      a: '1',
      b: '2',
      c: '3',
    });
  });

  it('converges a preview through a forwarded snapshot after the server drops a beyond-window entry', async () => {
    world = createWorld(topologies['dev-triangle'], {
      windows: { server: { maxAgeMs: 0, maxEntries: 2 } },
    });
    drain(world);
    await vi.advanceTimersByTimeAsync(1000);
    world.network.dropNext('manager', 'server', 1);
    world.network.dropNext('manager', 'preview', 10);
    world.network.dropNext('server', 'preview', 3);
    world.network.setDelay('preview', 'server', 50);

    await world.replica('preview').commands.setSlot({ slot: 'early', value: 'yes' });
    world.network.drainDue();
    await world.replica('manager').commands.setSlot({ slot: 'a', value: '1' });
    await world.replica('manager').commands.setSlot({ slot: 'b', value: '2' });
    await world.replica('manager').commands.setSlot({ slot: 'c', value: '3' });
    world.network.drainDue();
    settleRepaired(world);
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('beyond the log window')
    );
    expect(world.replica('preview').getState().slots).toEqual({
      early: 'yes',
      a: '1',
      b: '2',
      c: '3',
    });
    expect(
      world.network.frames.some(
        (frame) =>
          frame.type === SERVICE_SYNC_REPLY && frame.from === 'server' && frame.to === 'preview'
      )
    ).toBe(true);
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
    assertRelayTermination(current);
  });

  it('repairs a delayed concurrent entry that arrives after snapshot bootstrap', async () => {
    world = createWorld(topologies['dev-triangle'], { skip: ['preview'] });
    drain(world);

    world.network.hold('manager', 'server');
    world.network.hold('manager', 'preview');

    await world.replica('server').commands.setSlot({ slot: 'shared', value: 'server' });
    await world.replica('manager').commands.setSlot({ slot: 'shared', value: 'manager' });
    drain(world);

    expect(world.replica('server').getState().slots.shared).toBe('server');
    expect(world.replica('manager').getState().slots.shared).toBe('server');

    world.join('preview');
    drain(world);
    expect(world.replica('preview').getState().slots.shared).toBe('server');
    expect(world.replica('preview').reconciler.vector).toEqual({ server: 1 });

    world.network.release('manager', 'server');
    settleRepaired(world);
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('beyond the log window')
    );
    expect(world.replica('preview').getState().slots.shared).toBe('server');
    expect(world.replica('preview').reconciler.vector).toEqual({ manager: 1, server: 1 });
  });
});

describe('VirtualNetwork time', () => {
  it('does not move now backward when delivering a released earlier frame', () => {
    const network = new VirtualNetwork(
      ['a', 'b', 'c'],
      [
        ['a', 'b'],
        ['b', 'c'],
      ]
    );
    network.hold('a', 'b');
    network.channel('a').emit(SERVICE_ENTRY, { n: 1 });
    network.setDelay('b', 'c', 50);
    network.channel('b').emit(SERVICE_ENTRY, { n: 2 });
    network.drain();

    network.release('a', 'b');
    network.setDelay('b', 'c', 0);
    network.channel('b').emit(SERVICE_ENTRY, { n: 3 });
    network.drainDue();

    expect(
      network.frames.some(
        (frame) =>
          frame.from === 'b' && frame.to === 'c' && (frame.payload as { n: number }).n === 3
      )
    ).toBe(true);
  });
});
