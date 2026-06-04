/// <reference path="../typings.d.ts" />
import { global } from '@storybook/global';

import { UniversalStore } from '../shared/universal-store/index.ts';
import { Channel } from './main.ts';
import { PostMessageTransport } from './postmessage/index.ts';
import type { ChannelTransport, Config } from './types.ts';
import { WebsocketTransport } from './websocket/index.ts';

const { CHANNEL_OPTIONS, CONFIG_TYPE } = global;

export * from './main.ts';
export {
  clearChannel,
  ensureChannel,
  getChannel,
  installNoopChannel,
  setChannel,
} from './channel-slot.ts';

export default Channel;

export { PostMessageTransport } from './postmessage/index.ts';
export {
  WebsocketTransport,
  HEARTBEAT_INTERVAL,
  HEARTBEAT_MAX_LATENCY,
} from './websocket/index.ts';

type Options = Config & {
  extraTransports?: ChannelTransport[];
};

/**
 * Creates a new browser channel instance.
 *
 * @param {Options} options - The options object.
 * @param {Page} options.page - Page identifier.
 * @param {ChannelTransport[]} [options.extraTransports=[]] - An optional array of extra channel
 *   transports. Default is `[]`
 * @returns {Channel} - The new channel instance.
 */
export function createBrowserChannel({ page, extraTransports = [] }: Options): Channel {
  const transports: ChannelTransport[] = [new PostMessageTransport({ page }), ...extraTransports];

  if (CONFIG_TYPE === 'DEVELOPMENT') {
    const protocol = window.location.protocol === 'http:' ? 'ws' : 'wss';
    const { hostname, port } = window.location;
    const { wsToken } = CHANNEL_OPTIONS || {};
    const channelUrl = `${protocol}://${hostname}:${port}/storybook-server-channel?token=${wsToken}`;

    transports.push(new WebsocketTransport({ url: channelUrl, onError: () => {}, page }));
  }

  const channel = new Channel({ transports });
  UniversalStore.__prepare(
    channel,
    page === 'manager' ? UniversalStore.Environment.MANAGER : UniversalStore.Environment.PREVIEW
  );

  return channel;
}

export type {
  Listener,
  ChannelEvent,
  ChannelTransport,
  ChannelHandler,
  ChannelLike,
} from './types.ts';
