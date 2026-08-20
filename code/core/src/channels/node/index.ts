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
   * Rejects with `StorybookDevServerDisconnectedError` when the dev server closes the socket. Race
   * it against in-flight work so a dropped connection surfaces as an error instead of a hang.
   */
  disconnected: Promise<never>;
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

  const transport = new WebsocketTransport({
    url: socketUrl.href,
    onError: () => {},
    createSocket: (target) => new WebSocket(target, { rejectUnauthorized }),
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

  return { channel, disconnected };
}
