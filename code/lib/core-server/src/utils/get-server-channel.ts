import WebSocket, { WebSocketServer } from 'ws';
import { isJSON, parse, stringify } from 'telejson';
import type { ChannelHandler } from '@storybook/channels';
import { Channel } from '@storybook/channels';
import type { IncomingMessage } from 'node:http';

import { isValidToken } from './validate-websocket-token';

type Server = NonNullable<NonNullable<ConstructorParameters<typeof WebSocketServer>[0]>['server']>;

/**
 * This class represents a channel transport that allows for a one-to-many relationship between the server and clients.
 * Unlike other channels such as the postmessage and websocket channel implementations, this channel will receive from many clients and any events emitted will be sent out to all connected clients.
 */
export class ServerChannelTransport {
  private socket: WebSocketServer;

  private handler?: ChannelHandler;

  private token: string;

  constructor(server: Server, token: string) {
    this.token = token;
    this.socket = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request: IncomingMessage, socket, head) => {
      if (request.url) {
        const url = new URL(request.url, 'http://localhost');
        if (url.pathname === '/storybook-server-channel') {
          const requestToken = url.searchParams.get('token');
          if (!isValidToken(requestToken, this.token)) {
            socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
            socket.destroy();
            return;
          }

          this.socket.handleUpgrade(request, socket, head, (ws) => {
            this.socket.emit('connection', ws, request);
          });
        }
      }
    });
    this.socket.on('connection', (wss) => {
      wss.on('message', (raw) => {
        const data = raw.toString();
        const event =
          typeof data === 'string' && isJSON(data)
            ? parse(data, { allowFunction: false, allowClass: false })
            : data;
        this.handler?.(event);
      });
    });
  }

  setHandler(handler: ChannelHandler) {
    this.handler = handler;
  }

  send(event: any) {
    const data = stringify(event, { maxDepth: 15, allowFunction: false, allowClass: false });

    Array.from(this.socket.clients)
      .filter((c) => c.readyState === WebSocket.OPEN)
      .forEach((client) => client.send(data));
  }
}

export function getServerChannel(server: Server, token: string) {
  const transports = [new ServerChannelTransport(server, token)];

  return new Channel({ transports, async: true });
}

// for backwards compatibility
export type ServerChannel = ReturnType<typeof getServerChannel>;
