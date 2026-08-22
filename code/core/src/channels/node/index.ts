import { CHANNEL_WS_DISCONNECT } from 'storybook/internal/core-events';

import { WebSocket } from 'ws';

import { StorybookDevServerDisconnectedError } from '../../server-errors.ts';
import { UniversalStore } from '../../shared/universal-store/index.ts';
import { setChannel } from '../channel-slot.ts';
import { Channel } from '../main.ts';
import { SERVER_CHANNEL_PATH, WebsocketTransport } from '../websocket/index.ts';

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export interface NodeChannelOptions {
  /** Base URL a Storybook dev server is listening on, e.g. `http://localhost:6006`. */
  url: string;
  /** The dev server's websocket token, as recorded alongside its URL. */
  token: string;
}

export interface NodeChannelConnection {
  channel: Channel;
  /**
   * Resolves once the WebSocket handshake succeeds. Rejects when the socket errors or closes
   * before opening, so callers can fail fast instead of hanging on a dead URL.
   */
  connected: Promise<void>;
  /**
   * Rejects with `StorybookDevServerDisconnectedError` when the dev server closes the socket. Race
   * it against in-flight work so a dropped connection surfaces as an error instead of a hang.
   */
  disconnected: Promise<never>;
  close(): void;
}

/**
 * Connect this Node process to a running Storybook dev server's channel and install it as the
 * process-wide addons channel.
 *
 * The channel joins as a UniversalStore follower: the dev server leads, this process mirrors. TLS
 * verification is relaxed for loopback hosts only, so a `wss://` dev server using a self-signed
 * development certificate is reachable while remote hosts keep full verification.
 */
export function createNodeChannel({ url, token }: NodeChannelOptions): NodeChannelConnection {
  const socketUrl = new URL(url);
  socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  socketUrl.pathname = SERVER_CHANNEL_PATH;
  socketUrl.search = new URLSearchParams({ token }).toString();

  const rejectUnauthorized = !LOOPBACK_HOSTNAMES.has(socketUrl.hostname);
  const socket = new WebSocket(socketUrl.href, { rejectUnauthorized });
  const connected = waitUntilOpen(socket);
  // A caller that never awaits `connected` must not get an unhandled rejection on a dead URL.
  void connected.catch(() => {});

  const transport = new WebsocketTransport({
    url: socketUrl.href,
    onError: () => {},
    createSocket: () => socket,
    // Config load and tool calls occupy this event loop longer than the 20s receive watchdog.
    enableHeartbeat: false,
  });

  const channel = new Channel({ transports: [transport] });
  setChannel(channel);
  UniversalStore.__prepare(channel, UniversalStore.Environment.UNKNOWN);

  const disconnected = new Promise<never>((_, reject) => {
    channel.once(CHANNEL_WS_DISCONNECT, ({ code, reason }: { code?: number; reason?: string }) => {
      reject(new StorybookDevServerDisconnectedError({ code, reason }));
    });
  });
  // A caller that never races `disconnected` must not get an unhandled rejection on server shutdown.
  void disconnected.catch(() => {});

  return {
    channel,
    connected,
    disconnected,
    close: () => {
      socket.close();
    },
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
