import type { EventEmitter } from 'node:events';
import type { ChannelEvent, ChannelHandler } from 'storybook/internal/channels';
import { Channel, HEARTBEAT_INTERVAL } from 'storybook/internal/channels';
import { experimental_UniversalStore as UniversalStore } from 'storybook/internal/core-server';
import { isJSON, parse, stringify } from 'telejson';
import { WebSocket, WebSocketServer } from 'ws';

class PluginChannelTransport {
  private socket: WebSocketServer;

  private handler?: ChannelHandler;

  constructor(
    server: EventEmitter,
    private channelPath: string,
    private token: string
  ) {
    this.socket = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
      try {
        const url = request.url && new URL(request.url, `http://${request.headers.host}`);
        if (!url || url.pathname !== this.channelPath) {
          return;
        }

        const requestToken = url.searchParams.get('token');
        if (requestToken !== this.token) {
          socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
          socket.destroy();
          return;
        }

        this.socket.handleUpgrade(request, socket, head, (ws) => {
          this.socket.emit('connection', ws, request);
        });
      } catch {
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
      this.send({ type: 'ping', from: 'server', args: [] });
    }, HEARTBEAT_INTERVAL);

    this.socket.on('close', () => {
      clearInterval(interval);
    });
  }

  setHandler(handler: ChannelHandler) {
    this.handler = handler;
  }

  send(event: ChannelEvent) {
    const data = stringify(event, { maxDepth: 15 });
    Array.from(this.socket.clients)
      .filter((c) => c.readyState === WebSocket.OPEN)
      .forEach((client) => client.send(data));
  }
}

export function createServerChannel(
  server: EventEmitter,
  channelPath: string,
  token: string
): Channel {
  const transports = [new PluginChannelTransport(server, channelPath, token)];
  const channel = new Channel({ transports, async: true });
  UniversalStore.__prepare(channel, UniversalStore.Environment.SERVER);
  return channel;
}
