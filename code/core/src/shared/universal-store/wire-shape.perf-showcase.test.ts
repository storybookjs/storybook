/**
 * Performance showcase: UniversalStore SET_STATE wire shape.
 *
 * Bottleneck: `setState` in `code/core/src/shared/universal-store/index.ts:427-436` emits a
 * channel event whose payload is `{ state, previousState }` — i.e. TWO full copies of the store
 * state per event. `previousState` is always exactly the `state` of the previous SET_STATE frame,
 * so every receiver could derive it locally; on the wire it is pure redundancy.
 *
 * Why it matters at scale: universal stores hold monotonically growing, index-sized objects (e.g.
 * per-story status maps, one entry per story). Every small update re-sends the entire accumulated
 * object twice, over WebSocket (server <-> manager) and postMessage (manager <-> preview). With N
 * accumulated entries and R updates, cumulative wire traffic is O(N * R) — quadratic over a
 * session where each update also adds an entry — instead of the O(R) a delta/single-copy shape
 * would cost.
 *
 * Numbers demonstrated here (deterministic, byte counts of JSON-serialized channel frames):
 *
 * 1. One SET_STATE frame is >= 1.95x the bytes of the state itself (the 2x-per-event tax).
 * 2. `previousState` of frame k deep-equals `state` of frame k-1 (redundancy is exact).
 * 3. For 100 updates each appending one ~250-byte status entry, calls 51-100 cost >= 2.5x the
 *    bytes of calls 1-50 (quadratic growth signature; theoretical ratio for the linear part is
 *    3.0), totalling megabytes for what is ~25 KB of actual new data.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChannelTransport } from '../../channels/index.ts';
import { Channel } from '../../channels/index.ts';
import { UniversalStore } from './index.ts';
import { instances } from './instances.ts';

const makeIndexEntry = (i: number) => ({
  id: `example-component-${i}--default`,
  title: `Example/Section/Component${i}`,
  name: 'Default',
  importPath: `./src/components/section/Component${i}.stories.tsx`,
  type: 'story',
  tags: ['dev', 'test', 'autodocs'],
});

const makeStoryIndexLike = (count: number) => {
  const entries: Record<string, ReturnType<typeof makeIndexEntry>> = {};
  for (let i = 0; i < count; i += 1) {
    const entry = makeIndexEntry(i);
    entries[entry.id] = entry;
  }
  return { v: 5, entries };
};

// ~250 bytes of JSON per entry, mimicking one story's status (e.g. a11y/test results)
const makeStatusEntry = (i: number) => ({
  storyId: `example-component-${i}--default`,
  typeId: 'storybook/component-test',
  value: 'status-value:success',
  title: 'Component tests',
  description: `All assertions passed for run ${i}`.padEnd(90, '.'),
  sidebarContextMenu: false,
});

type StatusEntry = ReturnType<typeof makeStatusEntry>;

describe('UniversalStore SET_STATE wire shape (perf showcase)', () => {
  const sentFrames: any[] = [];

  const setStateFrames = () =>
    sentFrames.filter(
      (frame) => frame?.args?.[0]?.event?.type === UniversalStore.InternalEventType.SET_STATE
    );

  const frameBytes = (frame: any) => JSON.stringify(frame).length;

  beforeEach(() => {
    sentFrames.length = 0;
    const transport: ChannelTransport = {
      setHandler: vi.fn(),
      send: vi.fn((event) => {
        sentFrames.push(event);
      }),
    };
    const channel = new Channel({ transport });
    UniversalStore.__prepare(channel, UniversalStore.Environment.SERVER);

    return () => {
      instances.clear();
      UniversalStore.__reset();
    };
  });

  it('sends >= 1.95x the state bytes in a single SET_STATE frame (state + previousState)', () => {
    // Arrange - a leader holding a 2,000-entry story-index-like object plus a small counter
    const store = UniversalStore.create({
      id: 'perf-showcase:redundancy',
      leader: true,
      initialState: { index: makeStoryIndexLike(2_000), counter: 0 },
    });
    sentFrames.length = 0;

    // Act - a minimal update: bump the counter, index untouched
    store.setState((current) => ({ ...current, counter: current.counter + 1 }));

    // Assert - the single frame carries the full state twice
    const frames = setStateFrames();
    expect(frames).toHaveLength(1);

    const stateBytes = JSON.stringify(store.getState()).length;
    const wireBytes = frameBytes(frames[0]);
    const ratio = wireBytes / stateBytes;

    expect(stateBytes).toBeGreaterThan(200_000); // sanity: the state is index-sized
    expect(ratio).toBeGreaterThanOrEqual(1.95);
    expect(ratio).toBeLessThan(2.2); // sanity: it is exactly the 2x shape, not something else

    console.log(
      `[perf-showcase] SET_STATE frame is ${(wireBytes / 1024).toFixed(0)} KB for a ` +
        `${(stateBytes / 1024).toFixed(0)} KB state (${ratio.toFixed(2)}x) — one counter bump ` +
        `re-sends a 2,000-entry index twice`
    );
  });

  it('sends a previousState that always deep-equals the previous frame state (pure redundancy)', () => {
    // Arrange
    const store = UniversalStore.create({
      id: 'perf-showcase:derivable',
      leader: true,
      initialState: { index: makeStoryIndexLike(50), counter: 0 },
    });
    sentFrames.length = 0;

    // Act - a sequence of updates
    for (let i = 0; i < 5; i += 1) {
      store.setState((current) => ({ ...current, counter: current.counter + 1 }));
    }

    // Assert - every frame's previousState is byte-for-byte derivable from the frame before it,
    // so shipping it is pure wire redundancy
    const payloads = setStateFrames().map((frame) => frame.args[0].event.payload);
    expect(payloads).toHaveLength(5);
    for (let k = 1; k < payloads.length; k += 1) {
      expect(payloads[k].previousState).toEqual(payloads[k - 1].state);
    }

    console.log(
      '[perf-showcase] previousState of frame k deep-equals state of frame k-1 for all 5 frames — ' +
        'receivers could derive it locally'
    );
  });

  it('shows quadratic cumulative wire bytes when state accumulates one entry per update', () => {
    // Arrange - an empty status store; each update appends one ~250-byte entry
    const store = UniversalStore.create({
      id: 'perf-showcase:quadratic',
      leader: true,
      initialState: { statuses: [] as StatusEntry[] },
    });
    sentFrames.length = 0;
    const entryBytes = JSON.stringify(makeStatusEntry(1)).length;

    // Act - 100 accumulating updates
    for (let i = 1; i <= 100; i += 1) {
      store.setState((current) => ({ statuses: [...current.statuses, makeStatusEntry(i)] }));
    }

    // Assert - later updates dwarf earlier ones despite each adding the same ~250 bytes of data
    const bytesPerFrame = setStateFrames().map(frameBytes);
    expect(bytesPerFrame).toHaveLength(100);

    const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
    const firstHalfBytes = sum(bytesPerFrame.slice(0, 50));
    const secondHalfBytes = sum(bytesPerFrame.slice(50));
    const totalBytes = firstHalfBytes + secondHalfBytes;
    const newDataBytes = entryBytes * 100;

    expect(entryBytes).toBeGreaterThan(200); // sanity: entries are the advertised ~250 bytes
    expect(entryBytes).toBeLessThan(320);
    expect(secondHalfBytes / firstHalfBytes).toBeGreaterThanOrEqual(2.5);
    expect(totalBytes / newDataBytes).toBeGreaterThan(50); // 100x-order amplification overall

    console.log(
      `[perf-showcase] 100 accumulating setState calls: ${(totalBytes / 1_000_000).toFixed(2)} MB ` +
        `on the wire for ${(newDataBytes / 1024).toFixed(1)} KB of new data; calls 51-100 cost ` +
        `${(secondHalfBytes / firstHalfBytes).toFixed(2)}x calls 1-50 (quadratic growth)`
    );
  });
});
