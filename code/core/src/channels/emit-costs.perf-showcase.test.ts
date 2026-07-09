// Performance showcase: hidden per-emit costs in the Channel implementation.
//
// Bottleneck (a) — double, divergent serialization per emit.
// Channel.emit (channels/main.ts:69-74) hands the same event to every transport, and each
// transport runs its own telejson stringify over the full payload:
//   - PostMessageTransport.send (channels/postmessage/index.ts:23,92-109) uses maxDepth 25.
//   - WebsocketTransport.sendNow (channels/websocket/index.ts:100-104) uses maxDepth 15.
// In the manager both transports are installed (websocket + postmessage), so every emit pays
// stringify CPU once per transport (2x for large arg payloads), and — worse — the two option
// sets silently DIVERGE: anything nested deeper than 15 levels reaches postMessage consumers
// but arrives truncated to "[Object]" over the websocket. This test pins the numbers: 2
// stringify invocations per emit, and the exact retained-depth/byte divergence for a
// 30-level-deep payload (websocket keeps 14 levels, postmessage keeps 23).
//
// Bottleneck (b) — unbounded retention of every event's last args.
// Channel.handleEvent (channels/main.ts:137) unconditionally stores `event.args` in
// `channel.data[event.type]` for EVERY event type, even when there are zero listeners.
// High-cardinality event types (e.g. one 'UNIVERSAL_STORE:<id>' type per store instance)
// with large payloads are therefore pinned in memory for the lifetime of the channel. This
// test delivers 3 x 1 MiB events with no listeners and shows all 3 MiB stay reachable via
// channel.last().
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parse, stringify } from 'telejson';

import { Channel } from './main.ts';
import { PostMessageTransport } from './postmessage/index.ts';
import type { ChannelHandler, ChannelTransport } from './types.ts';
import { WebsocketTransport } from './websocket/index.ts';

vi.mock('telejson', async (importOriginal) => {
  const actual = await importOriginal<typeof import('telejson')>();
  return { ...actual, stringify: vi.fn(actual.stringify) };
});

const socketRef = { current: undefined as unknown as MockWebSocket };

/** Minimal WebSocket stub (same shape as websocket/index.test.ts) capturing outgoing frames. */
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

  close() {}
}

const FILLER = 'x'.repeat(1000);

/** A 30-level-deep object chain; each level carries ~1KB so truncated levels cost real bytes. */
const makeDeepFixture = (depth: number) => {
  let node: Record<string, unknown> = { level: depth, filler: FILLER };
  for (let i = depth - 1; i >= 1; i -= 1) {
    node = { level: i, filler: FILLER, child: node };
  }
  return node;
};

/** Counts how many levels of the fixture chain survived serialization (truncation-aware). */
const retainedLevels = (root: unknown): number => {
  let count = 0;
  let node = root;
  while (node && typeof node === 'object' && (node as { filler?: string }).filler === FILLER) {
    count += 1;
    node = (node as { child?: unknown }).child;
  }
  return count;
};

describe('perf-showcase: Channel.emit serializes once per transport with divergent maxDepth', () => {
  beforeEach(() => {
    // Fake timers keep the WebsocketTransport heartbeat setTimeout from leaking real timers.
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('runs telejson stringify once per transport and produces divergent payloads', () => {
    const websocketTransport = new WebsocketTransport({
      url: 'ws://localhost:6006',
      page: 'manager',
      onError: vi.fn(),
    });
    // In node there is no parent window, so PostMessageTransport buffers frames after
    // stringifying them — the serialization cost demonstrated here is still paid in full.
    const postMessageTransport = new PostMessageTransport({ page: 'preview' });
    const channel = new Channel({ transports: [websocketTransport, postMessageTransport] });

    // Mark the websocket open so send() goes through sendNow (the stringify path).
    socketRef.current.onopen?.();

    const stringifySpy = vi.mocked(stringify);
    stringifySpy.mockClear();

    channel.emit('perf-showcase/deep-payload', makeDeepFixture(30));

    // (a1) one full stringify of the payload per transport, on every single emit
    expect(stringifySpy).toHaveBeenCalledTimes(2);
    const maxDepths = stringifySpy.mock.calls
      .map(([, options]) => options?.maxDepth)
      .sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(maxDepths).toEqual([15, 25]); // websocket/index.ts:101 vs postmessage/index.ts:23

    // (a2) the two serialized outputs of the SAME emit diverge
    const wsData = socketRef.current.sent[0];
    const pmData = stringifySpy.mock.results
      .map((result) => result.value as string)
      .find((value) => value.startsWith('{"key":"storybook-channel"'));
    expect(typeof wsData).toBe('string');
    expect(typeof pmData).toBe('string');
    if (typeof pmData !== 'string') {
      throw new Error('postmessage serialization not captured');
    }

    const wsLevels = retainedLevels(parse(wsData).args[0]);
    const pmLevels = retainedLevels(parse(pmData).event.args[0]);
    expect(wsLevels).toBe(14); // maxDepth 15 truncates the 30-level fixture
    expect(pmLevels).toBe(23); // maxDepth 25 keeps 9 more levels of the same event
    expect(pmLevels - wsLevels).toBe(9);

    // Each dropped level carries ~1KB of filler, so the byte gap is substantial.
    const byteGap = pmData.length - wsData.length;
    expect(byteGap).toBeGreaterThan(8000);
    expect(pmData.length / wsData.length).toBeGreaterThan(1.5);

    console.log(
      `[perf-showcase] Channel.emit: ${stringifySpy.mock.calls.length} stringify calls for 1 emit; ` +
        `websocket payload ${wsData.length}B (${wsLevels} levels) vs postmessage payload ` +
        `${pmData.length}B (${pmLevels} levels) — ${byteGap}B silently divergent`
    );
  });
});

describe('perf-showcase: Channel.handleEvent retains last args of every event type forever', () => {
  it('pins ~1MiB args per event type in channel.data despite zero listeners', () => {
    let capturedHandler: ChannelHandler | undefined;
    const transport: ChannelTransport = {
      setHandler: (handler) => {
        capturedHandler = handler;
      },
      send: vi.fn(),
    };
    const channel = new Channel({ transport });
    if (!capturedHandler) {
      throw new Error('transport handler was not set');
    }

    const MIB = 1024 * 1024;
    const types = ['UNIVERSAL_STORE:store-a', 'UNIVERSAL_STORE:store-b', 'UNIVERSAL_STORE:store-c'];
    types.forEach((type, index) => {
      // Deliver through the transport handler, exactly as a remote event arrives.
      capturedHandler?.({ type, args: [{ payload: String(index).repeat(MIB) }], from: 'preview' });
    });

    let retainedBytes = 0;
    types.forEach((type) => {
      // Nothing ever subscribed to these events...
      expect(channel.listenerCount(type)).toBe(0);
      // ...yet the full args are pinned in channel.data (main.ts:137) with no eviction path.
      const lastArgs = channel.last(type);
      expect(lastArgs[0].payload).toHaveLength(MIB);
      retainedBytes += lastArgs[0].payload.length;
    });
    expect(retainedBytes).toBe(3 * MIB);

    console.log(
      `[perf-showcase] Channel.handleEvent: ${(retainedBytes / MIB).toFixed(1)}MiB retained in ` +
        `channel.data across ${types.length} listener-less event types (no eviction API exists)`
    );
  });
});
