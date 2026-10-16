import type { Channel } from 'storybook/internal/channels';
import {
  getChannel as readInstalledChannel,
  setChannel as installStorybookChannel,
} from 'storybook/internal/channels';
import { mockChannel } from '../../../channels/mock-channel.ts';

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
    if (this.channel) {
      return this.channel;
    }

    const installed = readInstalledChannel();
    if (installed) {
      this.channel = installed as Channel;
      this.resolve();
      return this.channel;
    }

    // No channel has been installed in this runtime yet. Return a throwaway mock so callers do not
    // crash, but do NOT cache it, mirror it to the shared channel slot, or resolve `ready()` with
    // it. Otherwise a single early read would poison the whole runtime, and the real channel
    // installed later (at the runtime entry point) would never take over.
    return mockChannel() as unknown as Channel;
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
  if (!globalThis[KEY]) {
    globalThis[KEY] = new AddonStore();
  }
  return globalThis[KEY];
}

export const addons = getAddonsStore();
