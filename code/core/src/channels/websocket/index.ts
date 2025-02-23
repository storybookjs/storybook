/// <reference path="../../typings.d.ts" />
import { global } from '@storybook/global';

import * as EVENTS from '@storybook/core/core-events';

import { isJSON, parse, stringify } from 'telejson';
import invariant from 'tiny-invariant';

import type { ChannelHandler, ChannelTransport, Config } from '../types';

const { WebSocket } = global;

type OnError = (message: Event) => void;

interface WebsocketTransportArgs extends Partial<Config> {
  url: string;
  onError: OnError;
}

export const HEARTBEAT_INTERVAL = 15000;
export const HEARTBEAT_MAX_LATENCY = 5000;

export class WebsocketTransport implements ChannelTransport {
  private buffer: string[] = [];

  private handler?: ChannelHandler;

  private socket: WebSocket;

  private isReady = false;

  private isClosed = false;

  private pingTimeout: number | NodeJS.Timeout = 0;

  private heartbeat() {
    clearTimeout(this.pingTimeout);

    this.pingTimeout = setTimeout(() => {
      this.socket.close(3008, 'timeout');
    }, HEARTBEAT_INTERVAL + HEARTBEAT_MAX_LATENCY);
  }

  constructor({ url, onError, page }: WebsocketTransportArgs) {
    this.socket = new WebSocket(url);
    this.socket.onopen = () => {
      this.isReady = true;
      this.heartbeat();
      this.flush();
    };
    this.socket.onmessage = ({ data }) => {
      const event = typeof data === 'string' && isJSON(data) ? parse(data) : data;
      invariant(this.handler, 'WebsocketTransport handler should be set');
      this.handler(event);
      if (event.type === 'ping') {
        this.heartbeat();
        this.send({ type: 'pong' });
      }
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
      allowFunction: false,
      ...global.CHANNEL_OPTIONS,
    });
    this.socket.send(data);
  }

  private flush() {
    const { buffer } = this;
    this.buffer = [];
    buffer.forEach((event) => this.send(event));
  }
}
