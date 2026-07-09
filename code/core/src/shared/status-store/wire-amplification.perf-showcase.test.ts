// PERF SHOWCASE: status-store wire amplification
//
// Bottleneck: code/core/src/shared/status-store/index.ts:229-262 (StatusStoreByTypeId.set; the
// same pattern exists in fullStatusStore.set at index.ts:177-190). The public API is
// delta-shaped — set() receives only the changed statuses — but the implementation merges the
// delta into the FULL accumulated map and calls universalStatusStore.setState() with it. The
// UniversalStore leader then broadcasts a SET_STATE channel frame containing the ENTIRE new map
// PLUS the entire previous map (code/core/src/shared/universal-store/index.ts:426-435).
//
// Why it matters at scale: with N accumulated statuses, every single-status update (e.g. one
// story finishing in a test run) serializes ~2N statuses onto the websocket. Frame size grows
// linearly with N per event, so a full test run over N stories transfers O(N^2) bytes.
//
// This test demonstrates, deterministically (fixed 250-byte statuses, mocked actor id):
// 1. After 3,000 accumulated statuses, setting ONE 250-byte status emits a single channel frame
//    that is >= 1000x the size of the delta itself (measured: ~7000x, ~1.8 MB per frame).
// 2. Single-status frame bytes at ~500 / ~1500 / ~3000 accumulated statuses grow linearly
//    (ratios ~3x and ~6x for 3x and 6x the accumulated statuses).
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UniversalStore } from '../universal-store/index.ts';
import type { ChannelLike } from '../universal-store/types.ts';
import {
  type Status,
  type StatusStoreEvent,
  type StatusesByStoryIdAndTypeId,
  UNIVERSAL_STATUS_STORE_OPTIONS,
  createStatusStore,
} from './index.ts';

const TYPE_ID = 'storybook/perf-showcase';
const STATUS_JSON_BYTES = 250;
const byteLength = (value: string) => new TextEncoder().encode(value).length;

/** Builds a status whose JSON.stringify size is exactly STATUS_JSON_BYTES (250 bytes). */
const makeStatus = (storyId: string): Status => {
  const base: Status = {
    storyId,
    typeId: TYPE_ID,
    value: 'status-value:success',
    title: 'Perf',
    description: '',
  };
  const padding = STATUS_JSON_BYTES - byteLength(JSON.stringify(base));
  expect(padding).toBeGreaterThanOrEqual(0);
  return { ...base, description: 'x'.repeat(padding) };
};

// Fixed-width story ids keep every status at exactly STATUS_JSON_BYTES.
const storyId = (i: number) => `story-${String(i).padStart(6, '0')}`;

describe('status-store wire amplification (perf showcase)', () => {
  beforeEach(() => {
    // Deterministic actor id (same technique as universal-store/index.test.ts), so channel frame
    // byte counts are exact and reproducible.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-02-14'));
    let randomNumberCounter = 1;
    vi.spyOn(Math, 'random').mockImplementation(() => randomNumberCounter++ / 10);

    return () => {
      vi.clearAllTimers();
      vi.useRealTimers();
      vi.restoreAllMocks();
      UniversalStore.__reset();
    };
  });

  it('re-broadcasts the entire accumulated map for a single-status set()', () => {
    // Byte-counting transport: record the serialized size of every SET_STATE frame the leader
    // emits onto the channel (this is what would hit the websocket in a real server).
    const setStateFrameBytes: number[] = [];
    const channel: ChannelLike = {
      on: () => {},
      off: () => {},
      emit: (_eventName: string, ...args: any[]) => {
        const frame = args[0];
        if (frame?.event?.type === UniversalStore.InternalEventType.SET_STATE) {
          setStateFrameBytes.push(byteLength(JSON.stringify(frame)));
        }
      },
    };

    // Construction mirrors production: core-server/stores/status.ts creates a leader
    // UniversalStore and wraps it with createStatusStore({ environment: 'server' }).
    UniversalStore.__prepare(channel, UniversalStore.Environment.SERVER);
    const universalStatusStore = UniversalStore.create<
      StatusesByStoryIdAndTypeId,
      StatusStoreEvent
    >({ ...UNIVERSAL_STATUS_STORE_OPTIONS, leader: true });
    const { getStatusStoreByTypeId } = createStatusStore({
      universalStatusStore,
      environment: 'server',
    });
    const statusStore = getStatusStoreByTypeId(TYPE_ID);

    const lastFrameBytes = () => setStateFrameBytes[setStateFrameBytes.length - 1];
    let seeded = 0;
    const seedUpTo = (count: number) => {
      const BATCH_SIZE = 500;
      while (seeded < count) {
        const batch = Math.min(BATCH_SIZE, count - seeded);
        statusStore.set(Array.from({ length: batch }, (_, i) => makeStatus(storyId(seeded + i))));
        seeded += batch;
      }
    };

    // Probe: a single-status set() — the delta an addon reports when ONE story's status changes.
    const probe = (label: string) => {
      const status = makeStatus(`probe-${label}`);
      const deltaBytes = byteLength(JSON.stringify([status]));
      statusStore.set([status]);
      return { deltaBytes, frameBytes: lastFrameBytes() };
    };

    // Seed 3,000 statuses in batches, probing single-status frame size along the way.
    seedUpTo(500);
    const at500 = probe('a');
    seedUpTo(1500);
    const at1500 = probe('b');
    seedUpTo(3000);
    // The headline measurement: ONE new 250-byte status after 3,000 accumulated statuses.
    const at3000 = probe('c');

    expect(universalStatusStore.getState()[storyId(2999)]).toBeDefined();
    expect(at3000.deltaBytes).toBe(STATUS_JSON_BYTES + 2); // the status itself + array brackets

    // 1. Amplification: the single frame carrying the 1-status delta is >= 1000x the delta,
    //    because it contains the full 3,001-entry map twice (state + previousState).
    const amplification = at3000.frameBytes / at3000.deltaBytes;
    expect(amplification).toBeGreaterThanOrEqual(1000);
    expect(at3000.frameBytes).toBeGreaterThanOrEqual(1_000_000); // > 1 MB for one status change

    // 2. Linear per-event growth: frame bytes scale with the accumulated status count
    //    (state + previousState ≈ 2N statuses), so 3x/6x the statuses ≈ 3x/6x the frame.
    expect(at1500.frameBytes / at500.frameBytes).toBeGreaterThanOrEqual(2.5);
    expect(at1500.frameBytes / at500.frameBytes).toBeLessThanOrEqual(3.5);
    expect(at3000.frameBytes / at500.frameBytes).toBeGreaterThanOrEqual(5.5);
    expect(at3000.frameBytes / at500.frameBytes).toBeLessThanOrEqual(6.5);

    console.log(
      `[perf-showcase] status-store single-status set() frame bytes: ` +
        `@500 statuses=${at500.frameBytes.toLocaleString()}B, ` +
        `@1500=${at1500.frameBytes.toLocaleString()}B, ` +
        `@3000=${at3000.frameBytes.toLocaleString()}B (linear per-event growth)`
    );
    console.log(
      `[perf-showcase] delta=${at3000.deltaBytes}B, broadcast frame=${at3000.frameBytes.toLocaleString()}B ` +
        `=> ${Math.round(amplification).toLocaleString()}x amplification for one status update ` +
        `after 3,000 accumulated statuses`
    );
  });
});
