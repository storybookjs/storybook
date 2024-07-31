import { global } from '@storybook/global';

import type { Channel } from '@storybook/core/channels';
import { mockChannel } from './storybook-channel-mock';

export class AddonStore {
  constructor() {
    this.promise = new Promise((res) => {
      this.resolve = () => res(this.getChannel());
    }) as Promise<Channel>;
  }

  private channel: Channel | undefined;

  private promise: any;

  private resolve: any;

  getChannel = (): Channel => {
    // this.channel should get overwritten by setChannel. If it wasn't called (e.g. in non-browser environment), set a mock instead.
    if (!this.channel) {
      const channel = mockChannel();
      this.setChannel(channel);
      return channel;
    }

    return this.channel;
  };

  ready = (): Promise<Channel> => this.promise;

  hasChannel = (): boolean => !!this.channel;

  setChannel = (channel: Channel): void => {
    this.channel = channel;
    this.resolve();
  };
}

// Enforce addons store to be a singleton
const KEY = '__STORYBOOK_ADDONS_PREVIEW';

function getAddonsStore(): AddonStore {
  if (!global[KEY]) {
    global[KEY] = new AddonStore();
  }
  return global[KEY];
}

export const addons = getAddonsStore();
