// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Channel } from 'storybook/internal/channels';

import { clearChannel, getChannel as readInstalledChannel } from '../../channels/channel-slot.ts';
import { AddonStore } from './addons.ts';

describe('AddonStore channel', () => {
  beforeEach(() => {
    clearChannel();
  });

  afterEach(() => {
    clearChannel();
  });

  it('returns a throwaway mock before a channel is installed, without poisoning the shared slot', () => {
    const store = new AddonStore();

    // Reading early must not crash...
    expect(store.getChannel()).toBeDefined();

    // ...but it must not install anything into the shared slot, so the real channel installed later
    // at the runtime entry point can still take over.
    expect(readInstalledChannel()).toBeNull();
    expect(store.hasChannel()).toBe(false);
  });

  it('lets a real setChannel() take over after an early getChannel() fallback', async () => {
    const store = new AddonStore();

    // Simulate an errant early read (e.g. at manager module-eval before the channel is installed).
    store.getChannel();

    const real = new Channel({});
    store.setChannel(real);

    expect(store.getChannel()).toBe(real);
    expect(readInstalledChannel()).toBe(real);
    await expect(store.ready()).resolves.toBe(real);
  });
});
