import { afterEach, describe, expect, it, vi } from 'vitest';

import { Channel } from './main.ts';
import {
  clearChannel,
  ensureChannel,
  getChannel,
  installNoopChannel,
  setChannel,
} from './channel-slot.ts';

describe('channel slot', () => {
  afterEach(() => {
    clearChannel();
    vi.unstubAllGlobals();
  });

  it('returns null after clearChannel', () => {
    setChannel(new Channel({}));
    clearChannel();

    expect(getChannel()).toBeNull();
    expect(globalThis.__STORYBOOK_ADDONS_CHANNEL__).toBeUndefined();
  });

  it('mirrors setChannel to the global slot', () => {
    const channel = new Channel({});

    setChannel(channel);

    expect(getChannel()).toBe(channel);
    expect(globalThis.__STORYBOOK_ADDONS_CHANNEL__).toBe(channel);
  });

  it('hydrates the module slot from a pre-existing global assignment', () => {
    const channel = new Channel({});
    clearChannel();
    vi.stubGlobal('__STORYBOOK_ADDONS_CHANNEL__', channel);

    expect(getChannel()).toBe(channel);
  });

  it('prefers the global slot over a stale module-level noop', () => {
    clearChannel();
    installNoopChannel();

    const real = new Channel({ transport: { setHandler: vi.fn(), send: vi.fn() } });
    vi.stubGlobal('__STORYBOOK_ADDONS_CHANNEL__', real);

    expect(getChannel()).toBe(real);
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
    expect(globalThis.__STORYBOOK_ADDONS_CHANNEL__).toBeUndefined();
  });

  it('replaces an existing channel on setChannel', () => {
    const first = new Channel({});
    const second = new Channel({ transport: { setHandler: vi.fn(), send: vi.fn() } });

    setChannel(first);
    setChannel(second);

    expect(getChannel()).toBe(second);
    expect(globalThis.__STORYBOOK_ADDONS_CHANNEL__).toBe(second);
  });
});

describe('module import', () => {
  it('does not auto-install a channel in a browser-like environment', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {});
    vi.stubEnv('VITEST', '');

    vi.resetModules();
    try {
      const { getChannel } = await import('./channel-slot.ts');
      expect(getChannel()).toBeNull();
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
