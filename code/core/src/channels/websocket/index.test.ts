import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parse, stringify } from 'telejson';

import { HEARTBEAT_INTERVAL, HEARTBEAT_MAX_LATENCY, WebsocketTransport } from './index.ts';

const TIMEOUT = HEARTBEAT_INTERVAL + HEARTBEAT_MAX_LATENCY;

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

vi.stubGlobal('WebSocket', MockWebSocket);

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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
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
