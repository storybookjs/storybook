/**
 * Canonical install/read surface for Storybook's shared addons channel.
 *
 * Each runtime (manager, preview, dev server) installs one channel instance here. The module slot
 * is the source of truth; {@link setChannel} also mirrors to `globalThis.__STORYBOOK_ADDONS_CHANNEL__`
 * so legacy code and builder preamble that read the global slot stay in sync.
 */
import { global } from '@storybook/global';

import { Channel } from './main.ts';
import type { ChannelLike } from './types.ts';

type ChannelSlotGlobal = {
  __STORYBOOK_ADDONS_CHANNEL__?: ChannelLike;
};

let channel: ChannelLike | undefined;

function readGlobalSlot(): ChannelLike | undefined {
  const fromGlobal = (global as ChannelSlotGlobal).__STORYBOOK_ADDONS_CHANNEL__;
  if (fromGlobal) {
    return fromGlobal;
  }

  return (globalThis as ChannelSlotGlobal).__STORYBOOK_ADDONS_CHANNEL__;
}

function syncGlobalSlot(next: ChannelLike | undefined): void {
  const g = global as ChannelSlotGlobal;
  const gt = globalThis as ChannelSlotGlobal;

  if (next === undefined) {
    delete g.__STORYBOOK_ADDONS_CHANNEL__;
    delete gt.__STORYBOOK_ADDONS_CHANNEL__;
    return;
  }

  g.__STORYBOOK_ADDONS_CHANNEL__ = next;
  gt.__STORYBOOK_ADDONS_CHANNEL__ = next;
}

/** Returns the installed addons channel, or `null` before one exists. */
export function getChannel(): ChannelLike | null {
  if (channel) {
    return channel;
  }

  const fromGlobal = readGlobalSlot();
  if (fromGlobal) {
    channel = fromGlobal;
  }

  return channel ?? null;
}

/** Installs (or replaces) the shared addons channel. Pass `null` to clear. */
export function setChannel(next: ChannelLike | null): void {
  channel = next ?? undefined;
  syncGlobalSlot(channel);
}

/** Clears the shared channel slot. Alias for `setChannel(null)`. */
export function clearChannel(): void {
  setChannel(null);
}

/** Installs a noop in-process channel — used by server presets and unit tests. */
export function installNoopChannel(): void {
  setChannel(new Channel({}));
}

// Node entrypoints that register services before runtime bootstrap (e.g. unit tests).
if (!getChannel()) {
  installNoopChannel();
}
