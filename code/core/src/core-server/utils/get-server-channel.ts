import type { IncomingMessage } from 'node:http';

import type { ChannelHandler } from '@storybook/core/channels';
import { Channel, HEARTBEAT_INTERVAL } from '@storybook/core/channels';

import { isJSON, parse, stringify } from 'telejson';
import WebSocket, { WebSocketServer } from 'ws';

import type events from '../../core-events';
import { logger } from '../../node-logger';
import { UniversalStore } from '../../shared/universal-store';
import { CORE_EVENT_SENDERS } from './event-senders';
import { type HostValidationOptions, isValidHost } from './getHostValidationMiddleware';
import { isValidToken } from './validate-token';

type Server = NonNullable<NonNullable<ConstructorParameters<typeof WebSocketServer>[0]>['server']>;

type ServerChannelTransportOptions = HostValidationOptions & {
  token: string;
};

// A browser client declares its role through the `page` query parameter on the channel URL. Every
// connection the dev server accepts comes from a browser, since an Origin header is required.
type ChannelClientRole = 'manager' | 'preview';

/**
 * This class represents a channel transport that allows for a one-to-many relationship between the
 * server and clients. Unlike other channels such as the postmessage and websocket channel
 * implementations, this channel will receive from many clients and any events emitted will be sent
 * out to all connected clients.
 */
export class ServerChannelTransport {
  private socket: WebSocketServer;

  private handler?: ChannelHandler;

  constructor(server: Server, options: ServerChannelTransportOptions) {
    this.socket = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request: IncomingMessage, socket, head) => {
      try {
        const url = request.url && new URL(request.url, options.localAddress);
        if (!url || url.pathname !== '/storybook-server-channel') {
          return;
        }

        const originHost = request.headers.origin && new URL(request.headers.origin).host;
        if (!isValidHost(originHost, options)) {
          throw new Error('Invalid websocket origin');
        }

        const requestToken = url.searchParams.get('token');
        if (!isValidToken(requestToken, options.token)) {
          throw new Error('Invalid websocket token');
        }

        const page = url.searchParams.get('page');
        if (page !== 'manager' && page !== 'preview') {
          socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
          return;
        }

        this.socket.handleUpgrade(request, socket, head, (ws) => {
          this.addClient(ws, page);
        });
      } catch (error) {
        logger.warn(`Rejecting WebSocket connection: ${error}`);
        socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        socket.destroy();
      }
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

  private addClient(ws: WebSocket, role: ChannelClientRole) {
    ws.on('message', (raw) => {
      const data = raw.toString();
      const event =
        typeof data === 'string' && isJSON(data)
          ? parse(data, { allowFunction: false, allowClass: false })
          : data;
      if (!this.isEventAllowedFrom(event, role)) {
        return;
      }
      this.handler?.(event);
    });
  }

  private readonly rejectedEvents = new Set<string>();

  private isEventAllowedFrom(event: unknown, role: ChannelClientRole): boolean {
    const type = typeof event === 'object' && event && 'type' in event ? event?.type : null;
    if (typeof type !== 'string') {
      return true;
    }
    const sender = CORE_EVENT_SENDERS[type as events];
    if (sender === undefined || sender === 'any' || sender === role) {
      return true;
    }
    const key = `${role}:${type}`;
    if (!this.rejectedEvents.has(key)) {
      this.rejectedEvents.add(key);
      logger.warn(
        `Ignored "${type}" event from a ${role} connection: only the ${sender} sends this event.`
      );
    }
    return false;
  }

  send(event: unknown) {
    const data = stringify(event, { maxDepth: 15, allowFunction: false, allowClass: false });

    Array.from(this.socket.clients)
      .filter((c) => c.readyState === WebSocket.OPEN)
      .forEach((client) => client.send(data));
  }
}

export function getServerChannel(server: Server, options: ServerChannelTransportOptions) {
  const transports = [new ServerChannelTransport(server, options)];

  const channel = new Channel({ transports, async: true });

  // eslint-disable-next-line no-underscore-dangle
  UniversalStore.__prepare(channel, UniversalStore.Environment.SERVER);

  return channel;
}

// for backwards compatibility
export type ServerChannel = ReturnType<typeof getServerChannel>;
