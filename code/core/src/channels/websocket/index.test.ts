import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parse, stringify } from 'telejson';

import { HEARTBEAT_INTERVAL, WebsocketTransport } from './index.ts';

const socketRef = { current: undefined as unknown as MockWebSocket };

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

  it('does not close the socket when no message arrives', () => {
    const { socket } = createConnectedTransport();

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL * 4);
    expect(socket.closed).toBeUndefined();
  });

  it('replies with pong when a ping is received', () => {
    const { socket } = createConnectedTransport();

    socket.receive({ type: 'ping' });

    expect(sentEvents(socket)).toContainEqual({ type: 'pong' });
    expect(socket.closed).toBeUndefined();
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

  it('replies with pong even when the channel handler throws', () => {
    const { transport, socket } = createConnectedTransport();

    transport.setHandler(() => {
      throw new Error('handler boom');
    });

    expect(() => socket.receive({ type: 'ping' })).not.toThrow();
    expect(sentEvents(socket)).toContainEqual({ type: 'pong' });
  });
});
