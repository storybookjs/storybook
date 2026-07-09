/// <reference path="../../typings.d.ts" />
import * as EVENTS from 'storybook/internal/core-events';

import { isJSON, parse, stringify } from 'telejson';
import invariant from 'tiny-invariant';

import type { ChannelHandler, ChannelTransport, Config } from '../types.ts';

type OnError = (message: Event) => void;

interface WebsocketTransportArgs extends Partial<Config> {
  url: string;
  onError: OnError;
}

export const HEARTBEAT_INTERVAL = 15000;
export const HEARTBEAT_MAX_LATENCY = 5000;
const HEARTBEAT_TIMEOUT = HEARTBEAT_INTERVAL + HEARTBEAT_MAX_LATENCY;

/**
 * If the heartbeat timer fires this much later than scheduled, the main thread was blocked at the
 * deadline (e.g. a message backlog draining, a GC pause, or a heavy render). Queued messages —
 * including the server's pings — may not have been processed yet, so the silence is not evidence
 * of a dead connection.
 */
export const HEARTBEAT_STARVATION_SLACK = 1000;

const CHANNEL_OPTIONS = globalThis.CHANNEL_OPTIONS || {};

export class WebsocketTransport implements ChannelTransport {
  private buffer: string[] = [];

  private handler?: ChannelHandler;

  private socket: WebSocket;

  private isReady = false;

  private isClosed = false;

  private pingTimeout: number | NodeJS.Timeout = 0;

  private heartbeat(isGraceWindow = false) {
    clearTimeout(this.pingTimeout);

    const armedAt = performance.now();
    this.pingTimeout = setTimeout(() => {
      const firedLate =
        performance.now() - armedAt > HEARTBEAT_TIMEOUT + HEARTBEAT_STARVATION_SLACK;
      if (firedLate && !isGraceWindow) {
        // The main thread was blocked past the deadline, so incoming messages (including the
        // server's pings) may still be queued behind this callback. Grant one full extra window
        // instead of killing a likely-healthy connection. Any message received in the meantime
        // re-arms the heartbeat with a fresh grace allowance.
        this.heartbeat(true);
        return;
      }
      this.socket.close(3008, 'timeout');
    }, HEARTBEAT_TIMEOUT);
  }

  constructor({ url, onError, page }: WebsocketTransportArgs) {
    // eslint-disable-next-line compat/compat
    this.socket = new WebSocket(url);
    this.socket.onopen = () => {
      this.isReady = true;
      this.heartbeat();
      this.flush();
    };
    this.socket.onmessage = ({ data }) => {
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
    this.socket.onerror = (e) => {
      if (onError) {
        onError(e);
      }
    };
    this.socket.onclose = (ev) => {
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
