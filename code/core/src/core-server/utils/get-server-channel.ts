import type { IncomingMessage } from 'node:http';

import type { ChannelHandler } from 'storybook/internal/channels';
import { Channel, HEARTBEAT_INTERVAL } from 'storybook/internal/channels';
import type { Options } from 'storybook/internal/types';

import { isJSON, parse, stringify } from 'telejson';
import WebSocket, { WebSocketServer } from 'ws';

import { UniversalStore } from '../../shared/universal-store';
import { isValidOrigin, isValidToken } from './validate-websocket';

type Server = NonNullable<NonNullable<ConstructorParameters<typeof WebSocketServer>[0]>['server']>;

/**
 * This class represents a channel transport that allows for a one-to-many relationship between the
 * server and clients. Unlike other channels such as the postmessage and websocket channel
 * implementations, this channel will receive from many clients and any events emitted will be sent
 * out to all connected clients.
 */
export class ServerChannelTransport {
  private socket: WebSocketServer;

  private handler?: ChannelHandler;

  private token: string;

  constructor(server: Server, options: Options, token: string) {
    this.token = token;
    this.socket = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request: IncomingMessage, socket, head) => {
      try {
        const url = request.url && new URL(request.url, request.headers.origin);
        if (!url || url.pathname !== '/storybook-server-channel') {
          return;
        }

        if (!isValidOrigin(request.headers.origin, options)) {
          throw new Error('Invalid websocket origin');
        }

        const requestToken = url.searchParams.get('token');
        if (!isValidToken(requestToken, this.token)) {
          throw new Error('Invalid websocket token');
        }

        this.socket.handleUpgrade(request, socket, head, (ws) => {
          this.socket.emit('connection', ws, request);
        });
      } catch (error) {
        console.warn('Rejecting WebSocket connection:', error);
        socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        socket.destroy();
      }
    });

    this.socket.on('connection', (wss) => {
      wss.on('message', (raw) => {
        const data = raw.toString();
        const event = typeof data === 'string' && isJSON(data) ? parse(data, {}) : data;
        this.handler?.(event);
      });
    });

    const interval = setInterval(() => {
      this.send({ type: 'ping' });
    }, HEARTBEAT_INTERVAL);

    this.socket.on('close', function close() {
      clearInterval(interval);
    });

    process.on('SIGTERM', () => {
      this.socket.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.close(1001, 'Server is shutting down');
        }
      });
      this.socket.close(() => process.exit(0));
    });
  }

  setHandler(handler: ChannelHandler) {
    this.handler = handler;
  }

  send(event: any) {
    const data = stringify(event, { maxDepth: 15 });

    Array.from(this.socket.clients)
      .filter((c) => c.readyState === WebSocket.OPEN)
      .forEach((client) => client.send(data));
  }
}

export function getServerChannel(server: Server, options: Options, token: string) {
  const transports = [new ServerChannelTransport(server, options, token)];

  const channel = new Channel({ transports, async: true });

  UniversalStore.__prepare(channel, UniversalStore.Environment.SERVER);

  return channel;
}

// for backwards compatibility
export type ServerChannel = ReturnType<typeof getServerChannel>;
