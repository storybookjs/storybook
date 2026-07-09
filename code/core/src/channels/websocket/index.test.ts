import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parse, stringify } from 'telejson';

import { HEARTBEAT_INTERVAL, HEARTBEAT_MAX_LATENCY, WebsocketTransport } from './index.ts';

const TIMEOUT = HEARTBEAT_INTERVAL + HEARTBEAT_MAX_LATENCY;
// Keep in sync with HEARTBEAT_STARVATION_SLACK in ./index.ts. Defined locally (rather than
// imported) so these tests express the required behavior independently of the implementation.
const STARVATION_SLACK = 1000;

const socketRef = { current: undefined as unknown as MockWebSocket };

/**
 * Minimal WebSocket stub that keeps outgoing `send` calls separate from incoming messages, so tests
 * can assert heartbeat behavior without a pong echoing straight back into the message handler.
 */
class MockWebSocket {
  static OPEN = 1;

  onopen?: () => void;

  onmessage?: (event: { data: string }) => void;

  onerror?: (event: unknown) => void;

  onclose?: (event: { code: number; reason: string }) => void;

  readyState = MockWebSocket.OPEN;

  sent: string[] = [];

  closed?: { code: number; reason: string };

  constructor(public url: string) {
    socketRef.current = this;
  }

  send(data: string) {
    this.sent.push(data);
  }

  close(code: number, reason: string) {
    this.closed = { code, reason };
    this.onclose?.({ code, reason });
  }

  receive(event: unknown) {
    this.onmessage?.({ data: stringify(event) });
  }
}

const createConnectedTransport = () => {
  const handler = vi.fn();
  const onError = vi.fn();
  const transport = new WebsocketTransport({
    url: 'ws://localhost:6006',
    page: 'manager',
    onError,
  });
  transport.setHandler(handler);
  // onopen marks the transport ready and starts the heartbeat watchdog
  socketRef.current.onopen?.();
  return { transport, handler, socket: socketRef.current };
};

const sentEvents = (socket: MockWebSocket) => socket.sent.map((data) => parse(data));

describe('WebsocketTransport heartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('closes with code 3008 when no message is received within the timeout window', () => {
    const { socket } = createConnectedTransport();

    vi.advanceTimersByTime(TIMEOUT - 1);
    expect(socket.closed).toBeUndefined();

    vi.advanceTimersByTime(1);
    expect(socket.closed).toEqual({ code: 3008, reason: 'timeout' });
  });

  it('resets the heartbeat and replies with pong when a ping is received', () => {
    const { socket } = createConnectedTransport();

    vi.advanceTimersByTime(TIMEOUT - 1);
    socket.receive({ type: 'ping' });

    expect(sentEvents(socket)).toContainEqual({ type: 'pong' });

    // The heartbeat was reset, so another near-full window can elapse without closing
    vi.advanceTimersByTime(TIMEOUT - 1);
    expect(socket.closed).toBeUndefined();

    vi.advanceTimersByTime(1);
    expect(socket.closed).toEqual({ code: 3008, reason: 'timeout' });
  });

  it('resets the heartbeat when a non-ping event is received', () => {
    const { socket } = createConnectedTransport();

    vi.advanceTimersByTime(TIMEOUT - 1);
    socket.receive({ type: 'test', args: [], from: 'preview' });

    // Any message is evidence the connection is alive, not just a literal ping - so this arrival
    // must reset the watchdog too, even though it's not the `ping` type.
    vi.advanceTimersByTime(TIMEOUT - 1);
    expect(socket.closed).toBeUndefined();

    vi.advanceTimersByTime(1);
    expect(socket.closed).toEqual({ code: 3008, reason: 'timeout' });
  });

  it('does not forward ping events to the channel handler', () => {
    const { handler, socket } = createConnectedTransport();

    socket.receive({ type: 'ping' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('forwards non-ping events to the channel handler', () => {
    const { handler, socket } = createConnectedTransport();

    socket.receive({ type: 'test', args: [], from: 'preview' });

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'test' }));
  });

  it('resets the heartbeat for pings even when the channel handler throws', () => {
    const { transport, socket } = createConnectedTransport();

    // Simulate an overloaded/failing channel handler. Heartbeat processing must not depend on it,
    // otherwise a busy channel could starve the reset and close a healthy connection with code 3008.
    transport.setHandler(() => {
      throw new Error('handler boom');
    });

    vi.advanceTimersByTime(TIMEOUT - 1);
    expect(() => socket.receive({ type: 'ping' })).not.toThrow();
    expect(sentEvents(socket)).toContainEqual({ type: 'pong' });

    vi.advanceTimersByTime(TIMEOUT - 1);
    expect(socket.closed).toBeUndefined();
  });

  it('resets the heartbeat for non-ping events even when the channel handler throws', () => {
    const { transport, socket } = createConnectedTransport();

    transport.setHandler(() => {
      throw new Error('handler boom');
    });

    vi.advanceTimersByTime(TIMEOUT - 1);
    // The handler throwing is expected to propagate to the caller (the socket's own onmessage
    // dispatch), but the heartbeat reset must already have happened before that point.
    expect(() => socket.receive({ type: 'test', args: [], from: 'preview' })).toThrow(
      'handler boom'
    );

    vi.advanceTimersByTime(TIMEOUT - 1);
    expect(socket.closed).toBeUndefined();
  });
});

describe('WebsocketTransport heartbeat starvation', () => {
  let fakeNow: number;

  beforeEach(() => {
    fakeNow = 0;
    // Exclude 'performance' from toFake: vitest's default fake timers advance performance.now in
    // lockstep with advanceTimersByTime, which makes a "late" timer fire impossible to simulate.
    // Stubbing performance.now manually lets wall-clock time move further than the timers were
    // advanced, mimicking a main thread that was blocked past the deadline.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.stubGlobal('performance', { now: () => fakeNow });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('re-arms instead of closing when the timer fires late (starved main thread)', () => {
    const { socket } = createConnectedTransport();

    // Main thread blocked well past the deadline: the timer only runs after the stall, so more
    // wall-clock time has elapsed than the timeout it was armed with.
    fakeNow = TIMEOUT + STARVATION_SLACK + 1;
    vi.advanceTimersByTime(TIMEOUT);
    expect(socket.closed).toBeUndefined();

    // The grace window then elapses on time with no message: genuinely dead, so close.
    fakeNow += TIMEOUT;
    vi.advanceTimersByTime(TIMEOUT);
    expect(socket.closed).toEqual({ code: 3008, reason: 'timeout' });
  });

  it('still closes when the timer fires on time', () => {
    const { socket } = createConnectedTransport();

    fakeNow = TIMEOUT;
    vi.advanceTimersByTime(TIMEOUT);
    expect(socket.closed).toEqual({ code: 3008, reason: 'timeout' });
  });

  it('a message during the grace window restores a fresh grace allowance', () => {
    const { socket } = createConnectedTransport();

    fakeNow = TIMEOUT + STARVATION_SLACK + 1;
    vi.advanceTimersByTime(TIMEOUT);
    expect(socket.closed).toBeUndefined();

    // Backlog drains: a queued ping is finally processed and re-arms with grace available again.
    socket.receive({ type: 'ping' });

    // A second starvation episode is spared again rather than closing.
    fakeNow += TIMEOUT + STARVATION_SLACK + 1;
    vi.advanceTimersByTime(TIMEOUT);
    expect(socket.closed).toBeUndefined();
  });

  it('closes when the grace window itself fires late with no message in between', () => {
    const { socket } = createConnectedTransport();

    fakeNow = TIMEOUT + STARVATION_SLACK + 1;
    vi.advanceTimersByTime(TIMEOUT); // fired late -> grace window granted
    fakeNow += TIMEOUT + STARVATION_SLACK + 1;
    vi.advanceTimersByTime(TIMEOUT); // late again with grace spent -> close
    expect(socket.closed).toEqual({ code: 3008, reason: 'timeout' });
  });
});
