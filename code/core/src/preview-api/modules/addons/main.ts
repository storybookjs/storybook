import type { Channel } from 'storybook/internal/channels';

import { global } from '@storybook/global';

import {
  getChannel as readInstalledChannel,
  setChannel as installStorybookChannel,
} from '../../../channels/channel-slot.ts';
import { mockChannel } from './storybook-channel-mock.ts';

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
    if (!this.channel) {
      const installed = readInstalledChannel();
      if (installed) {
        this.channel = installed as Channel;
        this.resolve();
        return this.channel;
      }

      const channel = mockChannel();
      this.setChannel(channel);
      return channel;
    }

    return this.channel;
  };

  ready = (): Promise<Channel> => this.promise;

  hasChannel = (): boolean => !!this.channel || !!readInstalledChannel();

  setChannel = (channel: Channel): void => {
    this.channel = channel;
    installStorybookChannel(channel);
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
