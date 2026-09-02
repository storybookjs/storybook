import type { IncomingMessage } from 'node:http';

import type { ChannelHandler } from 'storybook/internal/channels';
import {
  Channel,
  HEARTBEAT_INTERVAL,
  SERVER_CHANNEL_PATH,
  setChannel,
} from 'storybook/internal/channels';

import { isJSON, parse, stringify } from 'telejson';
import WebSocket, { WebSocketServer } from 'ws';

import { logger } from '../../node-logger/index.ts';
import { UniversalStore } from '../../shared/universal-store/index.ts';
import { type HostValidationOptions, isValidHost } from './getHostValidationMiddleware.ts';
import { isValidToken } from './validate-token.ts';

type Server = NonNullable<NonNullable<ConstructorParameters<typeof WebSocketServer>[0]>['server']>;

type ServerChannelTransportOptions = HostValidationOptions & {
  skipValidation?: boolean;
  token: string;
};

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

  private readonly onSigterm = () => {
    this.socket.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1001, 'Server is shutting down');
      }
    });
    this.socket.close(() => process.exit(0));
  };

  constructor(server: Server, options: ServerChannelTransportOptions) {
    this.socket = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request: IncomingMessage, socket, head) => {
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

        this.socket.handleUpgrade(request, socket, head, (ws) => {
          this.socket.emit('connection', ws, request);
        });
      } catch (error) {
        logger.warn(`Rejecting WebSocket connection: ${error}`);
        socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
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

    process.on('SIGTERM', this.onSigterm);
  }

  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    process.removeListener('SIGTERM', this.onSigterm);
    this.socket.close();
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

export function getServerChannel(server: Server, options: ServerChannelTransportOptions) {
  const transports = [new ServerChannelTransport(server, options)];

  const channel = new Channel({ transports, async: true });

  setChannel(channel);

  UniversalStore.__prepare(channel, UniversalStore.Environment.SERVER);

  return channel;
}

/**
 * Prepare the UniversalStore singleton for a server realm without a dev server (the `storybook
 * tools` CLI). Leader stores only become ready — and accept writes — once prepared, which the dev
 * server does above with its live channel; a headless realm has no followers to synchronize, so a
 * transport-less channel is correct. The channel is returned so the caller can hand the same bus
 * to configuration loading: stores only hear events on the channel they were prepared with, and
 * addon responders (addon-vitest's test runner among them) relay child-process store events onto
 * the channel their preset hooks received. Lives here (not in the CLI) so the preparation call
 * stays next to the class it configures instead of reaching through an internal static from
 * another entry, which the published type declarations strip.
 */
export function prepareHeadlessUniversalStores(): Channel {
  const channel = new Channel({});
  UniversalStore.__prepare(channel, UniversalStore.Environment.SERVER);
  return channel;
}

// for backwards compatibility
export type ServerChannel = ReturnType<typeof getServerChannel>;
