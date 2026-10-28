import { CHANNEL_WS_DISCONNECT } from '@storybook/core/internal/core-events';

import { WebSocket } from 'ws';

import { StorybookDevServerDisconnectedError } from '@storybook/core/internal/server-errors';
import type { ChannelHandler, ChannelTransport } from '@storybook/core/internal/channels';
import { SERVER_CHANNEL_PATH, WebsocketTransport } from '@storybook/core/internal/channels';

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export interface NodeChannelOptions {
  url: string;
  token: string;
}

export interface NodeChannelConnection {
  transport: ChannelTransport;
  connected: Promise<void>;
  disconnected: Promise<never>;
  close(): void;
}

export function createNodeChannel({ url, token }: NodeChannelOptions): NodeChannelConnection {
  const socketUrl = new URL(url);
  socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  socketUrl.pathname = SERVER_CHANNEL_PATH;
  socketUrl.search = new URLSearchParams({ token }).toString();

  // Loopback only: a local `wss://` Storybook often uses a self-signed dev certificate.
  const rejectUnauthorized = !LOOPBACK_HOSTNAMES.has(socketUrl.hostname);
  const socket = new WebSocket(socketUrl.href, { rejectUnauthorized });
  const connected = waitUntilOpen(socket);
  // A caller that never awaits `connected` must not get an unhandled rejection on a dead URL.
  void connected.catch(() => {});

  const transport = new WebsocketTransport({
    url: socketUrl.href,
    onError: () => {},
    createSocket: () => socket,
  });

  let receive: ChannelHandler | undefined;
  const disconnected = new Promise<never>((_, reject) => {
    transport.setHandler((event) => {
      if (event.type === CHANNEL_WS_DISCONNECT) {
        const { code, reason } = event.args[0] as { code?: number; reason?: string };
        reject(new StorybookDevServerDisconnectedError({ code, reason }));
      }
      receive?.(event);
    });
  });
  // A caller that never races `disconnected` must not get an unhandled rejection on server shutdown.
  void disconnected.catch(() => {});

  const close = (): void => {
    socket.close();
  };

  return {
    transport: {
      send: (event) => transport.send(event),
      setHandler: (handler) => {
        receive = handler;
      },
    },
    connected,
    disconnected,
    close,
  };
}

function waitUntilOpen(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }
    const fail = (reason?: string) => reject(new StorybookDevServerDisconnectedError({ reason }));
    if (socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
      fail('WebSocket closed before the Storybook channel opened');
      return;
    }
    const settle = (action: () => void) => {
      socket.off('open', onOpen);
      socket.off('error', onError);
      socket.off('close', onClose);
      action();
    };
    const onOpen = () => settle(resolve);
    const onError = (error: Error) => settle(() => fail(error.message));
    const onClose = () =>
      settle(() => fail('WebSocket closed before the Storybook channel opened'));
    socket.once('open', onOpen);
    socket.once('error', onError);
    socket.once('close', onClose);
  });
}
