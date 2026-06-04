import { afterEach, describe, expect, it, vi } from 'vitest';

import { global } from '@storybook/global';

import { Channel } from './main.ts';
import {
  clearChannel,
  ensureChannel,
  getChannel,
  installNoopChannel,
  setChannel,
} from './channel-slot.ts';

type ChannelSlotGlobal = {
  __STORYBOOK_ADDONS_CHANNEL__?: Channel;
};

function readGlobalSlot(): Channel | undefined {
  return (
    (global as ChannelSlotGlobal).__STORYBOOK_ADDONS_CHANNEL__ ??
    (globalThis as ChannelSlotGlobal).__STORYBOOK_ADDONS_CHANNEL__
  );
}

describe('channel slot', () => {
  afterEach(() => {
    clearChannel();
  });

  it('returns null after clearChannel', () => {
    setChannel(new Channel({}));
    clearChannel();

    expect(getChannel()).toBeNull();
    expect(readGlobalSlot()).toBeUndefined();
  });

  it('mirrors setChannel to the global slot', () => {
    const channel = new Channel({});

    setChannel(channel);

    expect(getChannel()).toBe(channel);
    expect(readGlobalSlot()).toBe(channel);
  });

  it('hydrates the module slot from a pre-existing global assignment', () => {
    const channel = new Channel({});
    clearChannel();
    (global as ChannelSlotGlobal).__STORYBOOK_ADDONS_CHANNEL__ = channel;
    (globalThis as ChannelSlotGlobal).__STORYBOOK_ADDONS_CHANNEL__ = channel;

    expect(getChannel()).toBe(channel);
  });

  it('installNoopChannel provides an in-process channel', () => {
    clearChannel();
    installNoopChannel();

    expect(getChannel()).toBeInstanceOf(Channel);
    expect(getChannel()?.hasTransport).toBe(false);
  });

  it('ensureChannel is a no-op when a channel is already installed', () => {
    const channel = new Channel({});
    setChannel(channel);

    ensureChannel();

    expect(getChannel()).toBe(channel);
  });

  it('ensureChannel installs a noop channel when missing', () => {
    clearChannel();

    ensureChannel();

    expect(getChannel()).toBeInstanceOf(Channel);
  });

  it('setChannel(null) clears both module and global slots', () => {
    const channel = new Channel({});
    setChannel(channel);

    setChannel(null);

    expect(getChannel()).toBeNull();
    expect(readGlobalSlot()).toBeUndefined();
  });

  it('replaces an existing channel on setChannel', () => {
    const first = new Channel({});
    const second = new Channel({ transport: { setHandler: vi.fn(), send: vi.fn() } });

    setChannel(first);
    setChannel(second);

    expect(getChannel()).toBe(second);
    expect(readGlobalSlot()).toBe(second);
  });
});
