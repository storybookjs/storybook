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

/**
 * Returns the installed addons channel, or `null` before one exists.
 *
 * The global slot wins over the module cache so duplicate copies of this module (e.g. dev-server
 * preset code and `.storybook` service registration loading different bundles) still observe
 * `setChannel` from whichever copy installed the live websocket channel.
 */
export function getChannel(): ChannelLike | null {
  const fromGlobal = readGlobalSlot();
  if (fromGlobal) {
    channel = fromGlobal;
  }

  return channel ?? null;
}

/**
 * Returns the installed addons channel.
 *
 * Callers assume each runtime has installed a channel at its entry boundary (builder iframe setup,
 * manager boot, server `services` preset, or Node module bootstrap). Prefer this over nullable
 * `getChannel()` when the channel must exist.
 */
export function requireChannel(): ChannelLike {
  const installed = getChannel();
  if (!installed) {
    throw new Error(
      'Storybook addons channel is not installed in this runtime. Install it via setChannel() or addons.setChannel() at the runtime entry point before registering services or emitting events.'
    );
  }

  return installed;
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

/**
 * Installs a noop channel when none is present yet.
 *
 * Prefer explicit `setChannel` / `installNoopChannel` at runtime entry points. This helper remains for
 * tests and tooling that need an in-process channel without a mock transport.
 */
export function ensureChannel(): void {
  if (!getChannel()) {
    installNoopChannel();
  }
}

// Non-browser realms (Node server, Vitest without a DOM) bootstrap a noop channel at import so
// presets and tests can register services when no websocket transport exists (e.g. static build).
// Browser preview must not bootstrap here — builders install the real channel before preview config.
if (typeof window === 'undefined') {
  ensureChannel();
}
