// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Channel } from 'storybook/internal/channels';

import {
  clearChannel,
  getChannel as readInstalledChannel,
} from '../../../channels/channel-slot.ts';
import { AddonStore } from './main.ts';

describe('AddonStore channel', () => {
  beforeEach(() => {
    clearChannel();
  });

  afterEach(() => {
    clearChannel();
  });

  it('returns the same mock on every call before a channel is installed', () => {
    const store = new AddonStore();
    const received: string[] = [];

    store.getChannel().on('ping', (value: string) => received.push(value));
    store.getChannel().emit('ping', 'pong');

    expect(store.getChannel()).toBe(store.getChannel());
    expect(received).toEqual(['pong']);
    expect(readInstalledChannel()).toBeNull();
    expect(store.hasChannel()).toBe(false);
  });

  it('lets a real setChannel() take over after an early getChannel() fallback', async () => {
    const store = new AddonStore();
    store.getChannel();

    const real = new Channel({});
    store.setChannel(real);

    expect(store.getChannel()).toBe(real);
    expect(readInstalledChannel()).toBe(real);
    await expect(store.ready()).resolves.toBe(real);
  });
});
