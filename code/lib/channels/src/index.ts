/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="./typings.d.ts" />

import { global } from '@storybook/global';
import { Channel } from './main';
import { PostMessageTransport } from './postmessage';
import type { ChannelTransport, Config } from './types';
import { WebsocketTransport } from './websocket';

const { CHANNEL_OPTIONS, CONFIG_TYPE } = global;

export * from './main';

export default Channel;

export { createChannel as createPostMessageChannel, PostMessageTransport } from './postmessage';
export { createChannel as createWebSocketChannel, WebsocketTransport } from './websocket';

type Options = Config & {
  extraTransports?: ChannelTransport[];
};

/**
 * Creates a new browser channel instance.
 * @param {Options} options - The options object.
 * @param {Page} options.page - The puppeteer page instance.
 * @param {ChannelTransport[]} [options.extraTransports=[]] - An optional array of extra channel transports.
 * @returns {Channel} - The new channel instance.
 */
export function createBrowserChannel({ page, extraTransports = [] }: Options): Channel {
  const transports: ChannelTransport[] = [new PostMessageTransport({ page }), ...extraTransports];

  if (CONFIG_TYPE === 'DEVELOPMENT') {
    const protocol = window.location.protocol === 'http:' ? 'ws' : 'wss';
    const { hostname, port } = window.location;
    const { wsToken } = CHANNEL_OPTIONS || {};
    const channelUrl = `${protocol}://${hostname}:${port}/storybook-server-channel?token=${wsToken}`;

    transports.push(new WebsocketTransport({ url: channelUrl, onError: () => {} }));
  }

  return new Channel({ transports });
}

export type { Listener, ChannelEvent, ChannelTransport, ChannelHandler } from './types';
