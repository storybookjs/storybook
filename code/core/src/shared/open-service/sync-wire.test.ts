// Lifted from Yann's sync-wire.perf-showcase.test.ts on yann/perf-bottleneck-showcase; claims inverted for services:entry.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearChannel, setChannel } from '../../channels/channel-slot.ts';
import { Channel } from '../../channels/main.ts';
import type { ChannelEvent, ChannelHandler } from '../../channels/types.ts';
import { mutableRecordLookupServiceDef } from './fixtures.ts';
import { SERVICE_ENTRY, generateRuntimeId } from './service-channel.ts';
import { clearRegistry, registerService, serviceRegistryApi } from './service-registry.ts';
import { createServiceRuntime } from './service-runtime.ts';
import { createSnapshotReconciler } from './service-sync.ts';
import { connectServiceToChannel } from './service-transport.ts';

const COMMAND_COUNT = 50;
const ENTRY_PADDING = 'v'.repeat(180);

type WireDirection = 'leaf->hub' | 'hub->leaf';

interface WireFrame {
  direction: WireDirection;
  type: string;
  bytes: number;
  payload: unknown;
}

function createRecordedWire() {
  const frames: WireFrame[] = [];
  let hubInbound: ChannelHandler | undefined;
  let leafInbound: ChannelHandler | undefined;

  const record = (direction: WireDirection, event: ChannelEvent): void => {
    frames.push({
      direction,
      type: event.type,
      bytes: JSON.stringify(event).length,
      payload: event.args[0],
    });
  };

  const hubChannel = new Channel({
    transport: {
      setHandler: (handler) => {
        hubInbound = handler;
      },
      send: (event) => {
        record('hub->leaf', event);
        leafInbound?.(event);
      },
    },
  });

  const leafChannel = new Channel({
    transport: {
      setHandler: (handler) => {
        leafInbound = handler;
      },
      send: (event) => {
        record('leaf->hub', event);
        hubInbound?.(event);
      },
    },
  });

  return { hubChannel, leafChannel, frames };
}

function connectLeafRuntime(channel: Channel) {
  const ownRuntimeId = generateRuntimeId();
  const definition = mutableRecordLookupServiceDef;

  const runtime = createServiceRuntime(
    definition,
    { registryApi: serviceRegistryApi },
    structuredClone(definition.initialState)
  );

  const reconciler = createSnapshotReconciler({
    setState: (mutate) =>
      runtime.commandSelf.setState((state) => mutate(state as Record<string, unknown>)),
  });

  const commandNames = Object.keys(definition.commands);
  const { commands, disconnect } = connectServiceToChannel({
    serviceId: definition.id,
    ownRuntimeId,
    reconciler,
    getSnapshot: () => runtime.getStateSnapshot() as Record<string, unknown>,
    channel,
    relay: false,
    commands: runtime.commands as Record<string, (input: unknown) => Promise<unknown>>,
    implementedCommandNames: new Set(commandNames),
    commandNames,
    delegated: false,
    runtime,
  });

  return { ownRuntimeId, commands, disconnect, runtime };
}

const mean = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

describe('open-service sync wire: entry broadcast cost', () => {
  let disconnectLeaf: (() => void) | undefined;

  afterEach(() => {
    disconnectLeaf?.();
    disconnectLeaf = undefined;
    clearRegistry();
    clearChannel();
    vi.restoreAllMocks();
  });

  it('keeps frame bytes constant, relays a small copy, and clones nothing per command', async () => {
    const { hubChannel, leafChannel, frames } = createRecordedWire();

    setChannel(hubChannel);
    registerService(mutableRecordLookupServiceDef, undefined, { relay: true });

    const leaf = connectLeafRuntime(leafChannel);
    disconnectLeaf = leaf.disconnect;

    vi.spyOn(globalThis, 'structuredClone');
    const cloneSpy = vi.mocked(globalThis.structuredClone);

    frames.length = 0;
    cloneSpy.mockClear();

    for (let i = 0; i < COMMAND_COUNT; i += 1) {
      await leaf.commands.assignRecordField({
        entryId: `entry-${String(i).padStart(2, '0')}`,
        fieldKey: 'payload',
        fieldValue: ENTRY_PADDING,
      });
    }

    const entryFrames = frames.filter((frame) => frame.type === SERVICE_ENTRY);
    const authoredFrames = entryFrames.filter((frame) => frame.direction === 'leaf->hub');
    const relayedFrames = entryFrames.filter((frame) => frame.direction === 'hub->leaf');

    expect(authoredFrames).toHaveLength(COMMAND_COUNT);

    const authoredSizes = authoredFrames.map((frame) => frame.bytes);
    const firstTenMean = mean(authoredSizes.slice(0, 10));
    const lastTenMean = mean(authoredSizes.slice(-10));
    expect(lastTenMean).toBeLessThan(firstTenMean * 1.25);

    expect(relayedFrames).toHaveLength(COMMAND_COUNT);
    const relayedSizes = relayedFrames.map((frame) => frame.bytes);
    expect(mean(relayedSizes)).toBeLessThanOrEqual(mean(authoredSizes) * 1.25);

    const cloneCallsAfterCommands = cloneSpy.mock.calls.length;
    const finalStateBytes = JSON.stringify(leaf.runtime.getStateSnapshot()).length;
    expect(authoredSizes[authoredSizes.length - 1]).toBeLessThan(finalStateBytes / 5);

    expect(cloneCallsAfterCommands).toBe(0);
  });
});
