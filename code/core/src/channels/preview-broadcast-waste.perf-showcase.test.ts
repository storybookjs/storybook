// @vitest-environment node
/**
 * Perf showcase: the preview iframe telejson-parses every server broadcast, even though it has no
 * listener for the vast majority of them.
 *
 * Bottleneck chain:
 *
 * - `channels/index.ts:44-51` — in dev (`CONFIG_TYPE === 'DEVELOPMENT'`) the preview opens its own
 *   `WebsocketTransport` to `/storybook-server-channel`.
 * - `core-server/utils/get-server-channel.ts:94-100` — `ServerChannelTransport.send` broadcasts
 *   every event to EVERY connected client, unfiltered.
 * - `channels/websocket/index.ts:51` — `socket.onmessage` calls telejson `parse(data)` for every
 *   frame BEFORE any listener-count check; the parsed event is then dropped by
 *   `Channel.handleEvent` (`channels/main.ts:130-138`) when `listeners(event.type)` is empty.
 * - `preview-api/index.ts:30-33` — universal stores are disabled in the preview, so the preview has
 *   ZERO consumers for `UNIVERSAL_STORE:*` traffic. Yet the store used by addon-test
 *   (`UNIVERSAL_STORE:storybook/test`) broadcasts full-state `SET_STATE` frames that grow with the
 *   number of stories.
 *
 * At scale (thousands of stories, testing addon active) this means the preview parses hundreds of
 * KB per frame, thousands of times, for zero consumed bytes — measured at ~1.4GB parsed per test
 * run in a real project — competing on the main thread with story rendering.
 *
 * This test demonstrates the number: 50 synthetic `SET_STATE` frames (each a fixed ~500KB payload
 * built from a 1,000-entry index fixture) fed to a preview-shaped channel result in 50/50 telejson
 * `parse` invocations totalling >20MB, while `listenerCount('UNIVERSAL_STORE:storybook/test')` is
 * 0 and none of the listeners the preview actually registers ever fire. Bytes parsed : bytes
 * consumed = N : 0.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ARGTYPES_INFO_REQUEST,
  FORCE_REMOUNT,
  FORCE_RE_RENDER,
  PRELOAD_ENTRIES,
  RESET_STORY_ARGS,
  SET_CURRENT_STORY,
  STORY_HOT_UPDATED,
  STORY_INDEX_INVALIDATED,
  UPDATE_GLOBALS,
  UPDATE_QUERY_PARAMS,
  UPDATE_STORY_ARGS,
} from 'storybook/internal/core-events';

import { stringify } from 'telejson';

import { Channel } from './main.ts';
import { WebsocketTransport } from './websocket/index.ts';

const parseMeter = vi.hoisted(() => ({ calls: 0, bytesIn: 0 }));

// Passthrough mock: real telejson behavior, but count every parse call and its input size.
// `channels/websocket/index.ts:51` is the only production call site exercised here.
vi.mock('telejson', async (importOriginal) => {
  const actual = await importOriginal<typeof import('telejson')>();
  return {
    ...actual,
    parse: (data: string, ...args: unknown[]) => {
      parseMeter.calls += 1;
      parseMeter.bytesIn += data.length;
      return (actual.parse as (...a: unknown[]) => unknown)(data, ...args);
    },
  };
});

const socketRef = { current: undefined as unknown as MockWebSocket };

/** Same minimal WebSocket stub as websocket/index.test.ts, driving `onmessage` directly. */
class MockWebSocket {
  static OPEN = 1;

  onopen?: () => void;

  onmessage?: (event: { data: string }) => void;

  onerror?: (event: unknown) => void;

  onclose?: (event: { code: number; reason: string }) => void;

  readyState = MockWebSocket.OPEN;

  sent: string[] = [];

  constructor(public url: string) {
    socketRef.current = this;
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code: number, reason: string) {
    this.onclose?.({ code, reason });
  }

  /** Deliver a raw, already-serialized frame — exactly what the server broadcast puts on the wire. */
  receiveRaw(data: string) {
    this.onmessage?.({ data });
  }
}

const TEST_STORE_EVENT = 'UNIVERSAL_STORE:storybook/test';
const FRAME_COUNT = 50;
const INDEX_ENTRY_COUNT = 1_000;

/**
 * Fixed 1,000-entry story-index-shaped fixture, mirroring the full-state payload the addon-test
 * universal store broadcasts on every SET_STATE.
 */
const buildStoreState = () => {
  const entries: Record<string, unknown> = {};
  for (let i = 0; i < INDEX_ENTRY_COUNT; i += 1) {
    const id = `example-component-${i}--primary-story-variant`;
    entries[id] = {
      id,
      title: `Example/Deeply/Nested/Component${i}`,
      name: `Primary Story Variant ${i}`,
      importPath: `./src/components/deeply/nested/Component${i}/Component${i}.stories.tsx`,
      componentPath: `./src/components/deeply/nested/Component${i}/Component${i}.tsx`,
      type: 'story',
      tags: ['dev', 'test', 'autodocs', 'play-fn', `custom-tag-${i % 7}`],
      status: {
        value: i % 3 === 0 ? 'status-value:success' : 'status-value:pending',
        typeId: 'storybook/component-test',
        description: `Component test finished for Component${i} with a stable message`,
      },
    };
  }
  return { testProviderState: 'test-provider-state:succeeded', currentRun: null, entries };
};

// The events the preview actually subscribes to in dev:
// - Preview.tsx:145-152 (code/core/src/preview-api/modules/preview-web/Preview.tsx):
//   STORY_INDEX_INVALIDATED, UPDATE_GLOBALS, UPDATE_STORY_ARGS, ARGTYPES_INFO_REQUEST,
//   RESET_STORY_ARGS, FORCE_RE_RENDER, FORCE_REMOUNT, STORY_HOT_UPDATED
// - PreviewWithSelection.tsx:123-125 (same directory):
//   SET_CURRENT_STORY, UPDATE_QUERY_PARAMS, PRELOAD_ENTRIES
const PREVIEW_SUBSCRIBED_EVENTS = [
  STORY_INDEX_INVALIDATED,
  UPDATE_GLOBALS,
  UPDATE_STORY_ARGS,
  ARGTYPES_INFO_REQUEST,
  RESET_STORY_ARGS,
  FORCE_RE_RENDER,
  FORCE_REMOUNT,
  STORY_HOT_UPDATED,
  SET_CURRENT_STORY,
  UPDATE_QUERY_PARAMS,
  PRELOAD_ENTRIES,
] as const;

describe('preview websocket transport parses broadcasts it has no consumer for', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', MockWebSocket);
    parseMeter.calls = 0;
    parseMeter.bytesIn = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it(`parses ${FRAME_COUNT}/${FRAME_COUNT} universal-store frames (>20MB) with zero listeners and zero consumed bytes`, () => {
    // Preview-shaped channel: WebsocketTransport (channels/index.ts:50) + the 11 dev listeners.
    const transport = new WebsocketTransport({
      url: 'ws://localhost:6006/storybook-server-channel?token=test',
      page: 'preview',
      onError: () => {},
    });
    const channel = new Channel({ transport });
    socketRef.current.onopen?.();

    const previewListeners = PREVIEW_SUBSCRIBED_EVENTS.map((eventName) => {
      const listener = vi.fn();
      channel.on(eventName, listener);
      return { eventName, listener };
    });

    // One wire frame, serialized exactly like ServerChannelTransport.send
    // (core-server/utils/get-server-channel.ts:94) serializes before broadcasting.
    const wireFrame = stringify(
      {
        type: TEST_STORE_EVENT,
        args: [{ event: { type: 'SET_STATE', payload: buildStoreState() } }],
        from: 'server',
      },
      { maxDepth: 15 }
    );
    const frameBytes = wireFrame.length;
    // Fixture is fixed, so the frame size is deterministic: ~500KB per frame.
    expect(frameBytes).toBeGreaterThan(400_000);
    expect(frameBytes).toBeLessThan(700_000);

    const parseCallsBefore = parseMeter.calls;
    const parseBytesBefore = parseMeter.bytesIn;
    for (let i = 0; i < FRAME_COUNT; i += 1) {
      socketRef.current.receiveRaw(wireFrame);
    }
    const parseCalls = parseMeter.calls - parseCallsBefore;
    const parsedBytes = parseMeter.bytesIn - parseBytesBefore;

    // (1) Every single frame was telejson-parsed — no listener check happens first.
    expect(parseCalls).toBe(FRAME_COUNT);
    expect(parsedBytes).toBe(FRAME_COUNT * frameBytes);
    expect(parsedBytes).toBeGreaterThan(20_000_000);

    // (2) The preview has zero consumers for the event 100% of those bytes belong to.
    expect(channel.listenerCount(TEST_STORE_EVENT)).toBe(0);

    // (3) Nothing the preview subscribes to fired: all parsed bytes were dropped on the floor.
    for (const { listener } of previewListeners) {
      expect(listener).not.toHaveBeenCalled();
    }

    const mb = (parsedBytes / 1024 / 1024).toFixed(1);
     
    console.log(
      `[perf-showcase] preview parsed ${parseCalls}/${FRAME_COUNT} broadcast frames = ${mb}MB ` +
        `(${frameBytes.toLocaleString()} bytes/frame); bytes parsed vs bytes consumed = ${parsedBytes.toLocaleString()} : 0 ` +
        `(0 listeners for '${TEST_STORE_EVENT}', 0/${PREVIEW_SUBSCRIBED_EVENTS.length} preview listeners fired)`
    );
  });
});
