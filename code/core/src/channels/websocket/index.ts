/// <reference path="../../typings.d.ts" />
import * as EVENTS from 'storybook/internal/core-events';

import { isJSON, parse, stringify } from 'telejson';
import invariant from 'tiny-invariant';

import type { ChannelHandler, ChannelTransport, Config } from '../types.ts';

type OnError = (message: Event) => void;

/**
 * The slice of the WebSocket API this transport drives, so a Node runtime can supply a `ws` socket
 * where the DOM `WebSocket` global is unusable.
 */
export interface ChannelWebSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  // The handler parameters stay `any` so both the DOM `WebSocket` and a `ws` socket satisfy this
  // interface: their event types share no common supertype, and property assignment is checked
  // contravariantly.
  onopen: ((event: any) => void) | null;
  onmessage: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onclose: ((event: any) => void) | null;
}

interface WebsocketTransportArgs extends Partial<Config> {
  url: string;
  onError: OnError;
  createSocket?: (url: string) => ChannelWebSocket;
  enableHeartbeat?: boolean;
}

export const HEARTBEAT_INTERVAL = 15000;
export const HEARTBEAT_MAX_LATENCY = 5000;
export const SERVER_CHANNEL_PATH = '/storybook-server-channel';

const CHANNEL_OPTIONS = globalThis.CHANNEL_OPTIONS || {};

export class WebsocketTransport implements ChannelTransport {
  private buffer: string[] = [];

  private handler?: ChannelHandler;

  private socket: ChannelWebSocket;

  private isReady = false;

  private isClosed = false;

  private pingTimeout: number | NodeJS.Timeout = 0;

  private heartbeatPaused = false;

  private enableHeartbeat = true;

  private heartbeat() {
    clearTimeout(this.pingTimeout);
    if (!this.enableHeartbeat || this.heartbeatPaused || this.isClosed) {
      return;
    }

    this.pingTimeout = setTimeout(() => {
      this.socket.close(3008, 'timeout');
    }, HEARTBEAT_INTERVAL + HEARTBEAT_MAX_LATENCY);
  }

  pauseHeartbeat() {
    this.heartbeatPaused = true;
    clearTimeout(this.pingTimeout);
  }

  resumeHeartbeat() {
    this.heartbeatPaused = false;
    if (this.isReady) {
      this.heartbeat();
    }
  }

  constructor({
    url,
    onError,
    page,
    createSocket,
    enableHeartbeat = true,
  }: WebsocketTransportArgs) {
    this.enableHeartbeat = enableHeartbeat;
    // eslint-disable-next-line compat/compat
    this.socket = createSocket ? createSocket(url) : new WebSocket(url);
    this.socket.onopen = () => {
      this.isReady = true;
      this.heartbeat();
      this.flush();
    };
    this.socket.onmessage = ({ data }: { data: any }) => {
      const event = typeof data === 'string' && isJSON(data) ? parse(data) : data;
      invariant(this.handler, 'WebsocketTransport handler should be set');

      this.heartbeat();

      if (event.type === 'ping') {
        // Pings are internal to the transport and have no channel listeners.
        this.send({ type: 'pong' });
        return;
      }

      this.handler(event);
    };
    this.socket.onerror = (e: Event) => {
      if (onError) {
        onError(e);
      }
    };
    this.socket.onclose = (ev: { code: number; reason: string }) => {
      invariant(this.handler, 'WebsocketTransport handler should be set');
      this.handler({
        type: EVENTS.CHANNEL_WS_DISCONNECT,
        args: [{ reason: ev.reason, code: ev.code }],
        from: page || 'preview',
      });
      this.isClosed = true;
      clearTimeout(this.pingTimeout);
    };
  }

  setHandler(handler: ChannelHandler) {
    this.handler = handler;
  }

  send(event: any) {
    if (!this.isClosed) {
      if (!this.isReady) {
        this.sendLater(event);
      } else {
        this.sendNow(event);
      }
    }
  }

  private sendLater(event: any) {
    this.buffer.push(event);
  }

  private sendNow(event: any) {
    const data = stringify(event, {
      maxDepth: 15,
      ...CHANNEL_OPTIONS,
    });
    this.socket.send(data);
  }

  private flush() {
    const { buffer } = this;
    this.buffer = [];
    buffer.forEach((event) => this.send(event));
  }
}
