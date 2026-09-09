import { CHANNEL_WS_DISCONNECT } from 'storybook/internal/core-events';

import { WebSocket } from 'ws';

import { StorybookDevServerDisconnectedError } from '../../../server-errors.ts';
import { UniversalStore } from '../../../shared/universal-store/index.ts';
import { getChannel, setChannel } from '../../../channels/channel-slot.ts';
import { Channel } from '../../../channels/main.ts';
import { SERVER_CHANNEL_PATH, WebsocketTransport } from '../../../channels/websocket/index.ts';

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export interface NodeChannelOptions {
  url: string;
  token: string;
}

export interface NodeChannelConnection {
  channel: Channel;
  connected: Promise<void>;
  disconnected: Promise<never>;
  close(): void;
}

const installedNodeChannels: Channel[] = [];
let displacedSlot:
  | {
      channel: ReturnType<typeof getChannel>;
      environment: typeof UniversalStore.preparedEnvironment;
    }
  | undefined;

function installNodeChannel(channel: Channel): void {
  if (installedNodeChannels.length === 0) {
    displacedSlot = {
      channel: getChannel(),
      environment: UniversalStore.preparedEnvironment,
    };
  }
  installedNodeChannels.push(channel);
  setChannel(channel);
  UniversalStore.__prepare(channel, UniversalStore.Environment.UNKNOWN);
}

function uninstallNodeChannel(channel: Channel): void {
  const index = installedNodeChannels.indexOf(channel);
  if (index >= 0) {
    installedNodeChannels.splice(index, 1);
  }
  if (getChannel() !== channel) {
    if (installedNodeChannels.length === 0) {
      displacedSlot = undefined;
    }
    return;
  }
  const remaining = installedNodeChannels.at(-1);
  if (remaining) {
    setChannel(remaining);
    UniversalStore.__prepare(remaining, UniversalStore.Environment.UNKNOWN);
    return;
  }
  const previous = displacedSlot;
  displacedSlot = undefined;
  setChannel(previous?.channel ?? null);
  if (previous?.channel && previous.environment) {
    UniversalStore.__prepare(previous.channel, previous.environment);
  } else {
    UniversalStore.__reset();
  }
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
    // Config load and tool calls occupy this event loop longer than the 20s receive watchdog.
    enableHeartbeat: false,
  });

  const channel = new Channel({ transports: [transport] });
  installNodeChannel(channel);

  const disconnected = new Promise<never>((_, reject) => {
    channel.once(CHANNEL_WS_DISCONNECT, ({ code, reason }: { code?: number; reason?: string }) => {
      reject(new StorybookDevServerDisconnectedError({ code, reason }));
    });
  });
  // A caller that never races `disconnected` must not get an unhandled rejection on server shutdown.
  void disconnected.catch(() => {});

  const close = () => {
    socket.close();
    uninstallNodeChannel(channel);
  };

  return {
    channel,
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
