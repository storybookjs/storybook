/**
 * Performance characterization of the open-service sync wire protocol.
 *
 * Bottlenecks demonstrated (culprits, verified against this revision):
 *
 * 1. `service-transport.ts:126` — `wrapCommandsForBroadcast` emits `services:patches` with the FULL
 *    post-mutation snapshot after EVERY resolved command. "Patches" are not patches: a command that
 *    changes one ~200-byte entry re-ships the entire accumulated state, so per-command frame bytes
 *    grow linearly with state size and total wire traffic grows quadratically with command count.
 * 2. `service-transport.ts:163` — a relay hub (`relayAdopted`) re-broadcasts every adopted snapshot
 *    on ALL its transports, INCLUDING the one the snapshot arrived on. The originating leaf receives
 *    a full copy of state it already holds (dropped by the stamp gate after transfer), doubling
 *    wire traffic: 2 full-snapshot frames cross the wire per command where 1 would suffice.
 * 3. `service-runtime.ts:304` — `getStateSnapshot` is `structuredClone(rawState)`: every broadcast
 *    (leaf authoring at :126 AND hub relaying at :163) deep-clones the ENTIRE state, so CPU per
 *    command also grows linearly with state size (>= 2 full-state clones per command in a
 *    two-runtime topology).
 *
 * At scale (index state, per-story status maps, thousands of stories) this means every keystroke- or
 * story-level mutation serializes, clones, and ships megabytes across postMessage/websocket hops.
 *
 * Numbers demonstrated below, all deterministic (50 commands, one ~215-byte entry each):
 *
 * - Authored `services:patches` frame bytes grow linearly: mean of last 10 frames >= 2x mean of
 *   first 10 (measured ~7x), while the per-command delta is constant.
 * - Wire amplification: 2 full-snapshot frames delivered per command (leaf->hub author + hub->leaf
 *   relay echo back to the source transport) vs the 1 minimally needed; >= 1 echo per command.
 * - `structuredClone` of the full state runs >= 1x per command (measured 2x: author + relay).
 *
 * A fourth known bottleneck — `query-runtime.ts:1008` per-subscriber schema validation + JSON
 * round-trip per state change — is out of scope here (no query subscribers are registered).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearChannel, setChannel } from '../../channels/channel-slot.ts';
import { Channel } from '../../channels/main.ts';
import type { ChannelEvent, ChannelHandler } from '../../channels/types.ts';
import { mutableRecordLookupServiceDef } from './fixtures.ts';
import { SERVICE_PATCHES, generateClientId } from './service-channel.ts';
import { clearRegistry, registerService, serviceRegistryApi } from './service-registry.ts';
import { createServiceRuntime } from './service-runtime.ts';
import { createSnapshotReconciler } from './service-sync.ts';
import { connectServiceToChannel } from './service-transport.ts';

const COMMAND_COUNT = 50;
/** Padding sized so each command's state delta serializes to ~215 bytes of JSON. */
const ENTRY_PADDING = 'v'.repeat(180);

type WireDirection = 'leaf->hub' | 'hub->leaf';

interface WireFrame {
  direction: WireDirection;
  type: string;
  /** JSON-serialized size of the channel event, the deterministic proxy for wire bytes. */
  bytes: number;
  payload: unknown;
}

/**
 * Two `Channel` instances joined by an in-process wire that records every crossing frame, modeling
 * the dev-server (hub) <-> preview (leaf) websocket/postMessage hop. Byte counts use
 * `JSON.stringify` of the full channel event, which is deterministic for the fixture state.
 */
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

/**
 * Assembles a leaf runtime over an explicit channel, mirroring `registerService` line for line. The
 * registry is idempotent by service id per realm, so the second runtime of the same service cannot
 * go through `registerService` in one test process.
 */
function connectLeafRuntime(channel: Channel) {
  const ownClientId = generateClientId();
  const definition = mutableRecordLookupServiceDef;

  const runtime = createServiceRuntime(
    definition,
    { registryApi: serviceRegistryApi },
    structuredClone(definition.initialState)
  );

  const reconciler = createSnapshotReconciler({
    setState: (mutate) =>
      runtime.commandSelf.setState((state) => mutate(state as Record<string, unknown>)),
    initialStamp: { version: 0, clientId: ownClientId },
  });

  const commandNames = Object.keys(definition.commands);
  const { commands, disconnect } = connectServiceToChannel({
    serviceId: definition.id,
    ownClientId,
    reconciler,
    getSnapshot: () => runtime.getStateSnapshot() as Record<string, unknown>,
    channel,
    relay: false,
    commands: runtime.commands as Record<string, (input: unknown) => Promise<unknown>>,
    implementedCommandNames: new Set(commandNames),
    commandNames,
    runtime,
  });

  return { ownClientId, commands, disconnect };
}

const mean = (values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

describe('open-service sync wire: full-snapshot broadcast cost', () => {
  let disconnectLeaf: (() => void) | undefined;

  afterEach(() => {
    disconnectLeaf?.();
    disconnectLeaf = undefined;
    clearRegistry();
    clearChannel();
    vi.restoreAllMocks();
  });

  it('ships and clones the full state per command: linear frame growth, 2x wire amplification, >=1 full clone per command', async () => {
    const { hubChannel, leafChannel, frames } = createRecordedWire();

    // Hub (dev-server role): registered through the public entry point, relay enabled.
    setChannel(hubChannel);
    registerService(mutableRecordLookupServiceDef, undefined, { relay: true });

    // Leaf (preview role): second runtime of the same service on the other end of the wire.
    const leaf = connectLeafRuntime(leafChannel);
    disconnectLeaf = leaf.disconnect;

    const cloneSpy = vi.spyOn(globalThis, 'structuredClone');

    // Discard registration/sync-start handshake traffic; measure steady-state command cost only.
    frames.length = 0;
    cloneSpy.mockClear();

    for (let i = 0; i < COMMAND_COUNT; i += 1) {
      await leaf.commands.assignRecordField({
        entryId: `entry-${String(i).padStart(2, '0')}`,
        fieldKey: 'payload',
        fieldValue: ENTRY_PADDING,
      });
    }

    const patchFrames = frames.filter((frame) => frame.type === SERVICE_PATCHES);
    const authoredFrames = patchFrames.filter((frame) => frame.direction === 'leaf->hub');
    const relayedFrames = patchFrames.filter((frame) => frame.direction === 'hub->leaf');

    // ---- (1) service-transport.ts:126 — full snapshots, not deltas -------------------------------
    // One authored frame per command, each carrying the ENTIRE accumulated state.
    expect(authoredFrames).toHaveLength(COMMAND_COUNT);

    const authoredSizes = authoredFrames.map((frame) => frame.bytes);
    for (let i = 1; i < authoredSizes.length; i += 1) {
      // Every frame is strictly larger than the previous although each command's delta is constant.
      expect(authoredSizes[i]).toBeGreaterThan(authoredSizes[i - 1]);
    }
    const firstTenMean = mean(authoredSizes.slice(0, 10));
    const lastTenMean = mean(authoredSizes.slice(-10));
    expect(lastTenMean).toBeGreaterThanOrEqual(2 * firstTenMean);

    // ---- (2) service-transport.ts:163 — relay echoes the snapshot back to its source -------------
    // The hub adopts each authored snapshot and re-broadcasts it on ALL transports, so the
    // originating leaf gets its own full state back once per command (>= 1 echo per command).
    const echoesToSource = relayedFrames.filter(
      (frame) => (frame.payload as { clientId: string }).clientId === leaf.ownClientId
    );
    expect(echoesToSource.length).toBeGreaterThanOrEqual(COMMAND_COUNT);
    expect(patchFrames).toHaveLength(2 * COMMAND_COUNT);

    const minimumFramesNeeded = COMMAND_COUNT; // one leaf->hub delta per command
    const amplification = patchFrames.length / minimumFramesNeeded;
    expect(amplification).toBeGreaterThanOrEqual(2);

    // ---- (3) service-runtime.ts:304 — structuredClone of the entire state per broadcast ----------
    expect(cloneSpy.mock.calls.length).toBeGreaterThanOrEqual(COMMAND_COUNT);
    const clonesPerCommand = cloneSpy.mock.calls.length / COMMAND_COUNT;

    // ---- Summary ---------------------------------------------------------------------------------
    const totalPatchBytes = patchFrames.reduce((sum, frame) => sum + frame.bytes, 0);
    const finalStateBytes = JSON.stringify(
      (authoredFrames[authoredFrames.length - 1].payload as { state: unknown }).state
    ).length;

    console.log(
      `[perf-showcase] open-service sync wire, ${COMMAND_COUNT} commands x ~215B delta: ` +
        `authored patches frame grew ${authoredSizes[0]}B -> ${authoredSizes[authoredSizes.length - 1]}B ` +
        `(last-10 mean ${Math.round(lastTenMean)}B = ${(lastTenMean / firstTenMean).toFixed(1)}x first-10 mean ${Math.round(firstTenMean)}B); ` +
        `${(totalPatchBytes / 1024).toFixed(1)}KB total snapshot traffic for ${(finalStateBytes / 1024).toFixed(1)}KB of final state; ` +
        `${patchFrames.length} snapshot frames delivered vs ${minimumFramesNeeded} needed (${amplification.toFixed(1)}x amplification, ` +
        `${echoesToSource.length} full-state echoes back to the originating leaf); ` +
        `${cloneSpy.mock.calls.length} structuredClone calls (${clonesPerCommand.toFixed(1)} full-state clones per command)`
    );
  });
});
