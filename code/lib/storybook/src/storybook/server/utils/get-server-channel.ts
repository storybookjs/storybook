import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

import type { Channel, ChannelHandler } from '@storybook/core/internal/channels';
import {
  HEARTBEAT_INTERVAL,
  SERVER_CHANNEL_PATH,
  parseChannelMessage,
  stringifyChannelMessage,
} from '@storybook/core/internal/channels';

import { WebSocket, WebSocketServer } from 'ws';

import type events from '@storybook/core/internal/core-events';
import { logger } from '@storybook/core/internal/node-logger';
import { TOOLSET_RPC_REQUEST_EVENTS } from '@storybook/core/internal/deep/shared/open-service/toolset-rpc';
import { CORE_EVENT_SENDERS } from './event-senders.ts';
import { type HostValidationOptions, isValidHost } from './getHostValidationMiddleware.ts';
import { isValidToken } from './validate-token.ts';

type Server = NonNullable<NonNullable<ConstructorParameters<typeof WebSocketServer>[0]>['server']>;

type ServerChannelTransportOptions = HostValidationOptions & {
  skipValidation?: boolean;
  token: string;
};

// A browser client declares its role through the `page` query parameter on the channel URL.
// Non-browser clients (the tools SDK among them) send no `page` parameter and are `server`: they
// authenticate with the token alone and may send the events the dev server itself sends.
type ChannelClientRole = 'manager' | 'preview' | 'server';

/**
 * This class represents a channel transport that allows for a one-to-many relationship between the
 * server and clients. Unlike other channels such as the postmessage and websocket channel
 * implementations, this channel will receive from many clients and any events emitted will be sent
 * out to all connected clients.
 */
export class ServerChannelTransport {
  private socket: WebSocketServer;

  private handler?: ChannelHandler;

  private closed = false;

  private readonly removeUpgradeListener: () => void;

  private readonly heartbeat: ReturnType<typeof setInterval>;

  constructor(server: Server, options: ServerChannelTransportOptions) {
    this.socket = new WebSocketServer({ noServer: true });

    const onUpgrade = (request: IncomingMessage, socket: Duplex, head: Buffer): void => {
      try {
        const url = request.url && new URL(request.url, options.localAddress);
        if (!url || url.pathname !== SERVER_CHANNEL_PATH) {
          return;
        }

        if (!options.skipValidation) {
          // Browsers always send Origin on upgrades, so an absent one means a non-browser client,
          // which the token alone authenticates.
          const { origin } = request.headers;
          if (origin && !isValidHost(new URL(origin).host, options)) {
            socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
            return;
          }

          const requestToken = url.searchParams.get('token');
          if (!isValidToken(requestToken, options.token)) {
            socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
            return;
          }
        }

        const page = url.searchParams.get('page');
        if (page !== null && page !== 'manager' && page !== 'preview') {
          socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
          return;
        }
        // Every browser client Storybook ships declares a page, so a browser without one is
        // malformed, and letting it through would hand it the server role.
        if (page === null && request.headers.origin !== undefined) {
          socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
          return;
        }
        const role: ChannelClientRole = page ?? 'server';

        this.socket.handleUpgrade(request, socket, head, (ws) => {
          this.addClient(ws, role);
        });
      } catch (error) {
        logger.warn(`Rejecting WebSocket connection: ${error}`);
        socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      }
    };
    server.on('upgrade', onUpgrade);
    this.removeUpgradeListener = () => server.off('upgrade', onUpgrade);

    this.heartbeat = setInterval(() => {
      this.send({ type: 'ping' });
    }, HEARTBEAT_INTERVAL);

    this.socket.on('close', () => {
      clearInterval(this.heartbeat);
    });
  }

  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.removeUpgradeListener();
    clearInterval(this.heartbeat);
    this.socket.clients.forEach((client) => client.terminate());
    this.handler = undefined;
    this.socket.close();
  }

  setHandler(handler: ChannelHandler) {
    this.handler = handler;
  }

  private addClient(ws: WebSocket, role: ChannelClientRole) {
    ws.on('error', (error) => {
      // Without a listener, Node crashes on 'error' (e.g. oversized frame). ws closes the socket itself.
      logger.warn(`WebSocket error on server channel: ${error}`);
    });

    ws.on('message', (raw) => {
      const data = raw.toString();
      const event = parseChannelMessage(data);
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
    const sender = TOOLSET_RPC_REQUEST_EVENTS.includes(type)
      ? 'server'
      : CORE_EVENT_SENDERS[type as events];
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
    const data = stringifyChannelMessage(event);

    Array.from(this.socket.clients)
      .filter((c) => c.readyState === WebSocket.OPEN)
      .forEach((client) => client.send(data));
  }
}

export function attachServerTransport(
  channel: Channel,
  server: Server,
  options: ServerChannelTransportOptions
): ServerChannelTransport {
  const transport = new ServerChannelTransport(server, options);
  channel.addTransport(transport);
  return transport;
}

// for backwards compatibility
export type ServerChannel = Channel;
