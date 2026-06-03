/**
 * Channel transport constants and helpers for the open-service peer-to-peer sync protocol.
 *
 * Services use Storybook's existing manager↔preview channel so that a service registered
 * in the manager or preview can automatically synchronise its state with other connected
 * peers. The `services:` prefix keeps service events trivially filterable from other
 * channel traffic.
 *
 * The channel is read from the ambient `globalThis.__STORYBOOK_ADDONS_CHANNEL__` slot that every
 * Storybook runtime already exposes — the manager sets it in its runtime, both builders inject it
 * into the preview iframe, and the dev server installs it in the `services` preset. Until that slot
 * is populated, {@link getServiceChannel} returns `null`. Writes go through {@link setServiceChannel}
 * so tests can mock the reader without touching the global slot from other modules.
 */
import { global } from '@storybook/global';
import { Channel } from 'storybook/internal/channels';

/**
 * Minimal channel contract needed for service sync.
 *
 * Structurally matches `Pick<Channel, 'on' | 'off' | 'emit'>` from Storybook's existing
 * channel implementation so this module does not need to import from
 * `storybook/internal/channels`.
 */
export interface ServiceChannel {
  on(event: string, listener: (data: unknown) => void): void;
  off(event: string, listener: (data: unknown) => void): void;
  emit(event: string, data: unknown): void;
}

export const SERVICE_SYNC_START = 'services:sync-start' as const;
export const SERVICE_SYNC_START_REPLY = 'services:sync-start-reply' as const;
export const SERVICE_PATCHES = 'services:patches' as const;
export const SERVICE_COMMAND_INVOKE = 'services:command-invoke' as const;
export const SERVICE_COMMAND_RESULT = 'services:command-result' as const;
export const SERVICE_COMMAND_ERROR = 'services:command-error' as const;

/** Sent by a newly-registered peer to initialize its state from any existing peer. */
export interface SyncStartPayload {
  serviceId: string;
  clientId: string;
}

/** Sent in reply to a `services:sync-start` with the responding peer's current state. */
export interface SyncStartReplyPayload {
  serviceId: string;
  /** Full state snapshot at the time of reply. */
  state: Record<string, unknown>;
  /** Version of the replied snapshot, paired with `clientId` for last-write-wins ordering. */
  version: number;
  clientId: string;
}

/**
 * Broadcast by a peer after every local command execution.
 *
 * Contains the full post-mutation state snapshot so peers can apply it without tracking
 * individual mutations. The `(version, clientId)` pair is a last-write-wins stamp: recipients
 * apply the snapshot only when it is strictly newer than their own (see `isNewer` in
 * `service-sync.ts`), which suppresses echoes, breaks relay cycles, and converges concurrent
 * writes deterministically.
 */
export interface PatchesPayload {
  serviceId: string;
  /** Full state snapshot after the mutation. */
  state: Record<string, unknown>;
  /** Version of the snapshot, paired with `clientId` for last-write-wins ordering. */
  version: number;
  clientId: string;
}

/** Payload for `services:command-invoke` (Option-A/hybrid reserved; unused in multi-master). */
export interface CommandInvokePayload {
  serviceId: string;
  commandName: string;
  input: unknown;
  callId: string;
}

/** Payload for `services:command-result`. */
export interface CommandResultPayload {
  callId: string;
  result: unknown;
}

/** Payload for `services:command-error`. */
export interface CommandErrorPayload {
  callId: string;
  error: unknown;
}

type ChannelSlotGlobal = {
  __STORYBOOK_ADDONS_CHANNEL__?: ServiceChannel;
};

/** Storybook uses both `@storybook/global` and bare `globalThis` (e.g. Vitest setup, Vite preview preamble). */
function readChannelSlot(): ServiceChannel | undefined {
  const fromGlobal = (global as ChannelSlotGlobal).__STORYBOOK_ADDONS_CHANNEL__;
  if (fromGlobal) {
    return fromGlobal;
  }

  return (globalThis as ChannelSlotGlobal).__STORYBOOK_ADDONS_CHANNEL__;
}

function writeChannelSlot(channel: ServiceChannel | undefined): void {
  const g = global as ChannelSlotGlobal;
  const gt = globalThis as ChannelSlotGlobal;

  if (channel === undefined) {
    delete g.__STORYBOOK_ADDONS_CHANNEL__;
    delete gt.__STORYBOOK_ADDONS_CHANNEL__;
    return;
  }

  g.__STORYBOOK_ADDONS_CHANNEL__ = channel;
  gt.__STORYBOOK_ADDONS_CHANNEL__ = channel;
}

/**
 * Returns the live Storybook channel shared by every service runtime, or `null` before it exists.
 *
 * Reads the ambient `__STORYBOOK_ADDONS_CHANNEL__` slot on `@storybook/global` and `globalThis` so
 * manager, preview builders, Vitest setup, and the dev server `services` preset all converge. Unit
 * tests can assign the slot via {@link setServiceChannel} or module-mock this function.
 */
export function getServiceChannel(): ServiceChannel | null {
  return readChannelSlot() ?? null;
}

/**
 * Installs (or replaces) the ambient addons channel used by {@link getServiceChannel}.
 *
 * Pass `null` to clear the slot — e.g. tests asserting registration fails without a channel.
 */
export function setServiceChannel(channel: ServiceChannel | null): void {
  writeChannelSlot(channel ?? undefined);
}

/** Clears the ambient channel slot. Alias for `setServiceChannel(null)`. */
export function clearServiceChannel(): void {
  setServiceChannel(null);
}

/** Installs a noop in-process channel, matching server presets that pass `new Channel({})`. */
export function installNoopServiceChannel(): void {
  setServiceChannel(new Channel({}));
}

/**
 * Generates a unique id for one runtime instance.
 *
 * Used to suppress looped channel events: when a peer receives an event with its own
 * `clientId`, it ignores it rather than applying state it already has.
 */
export function generateClientId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Node entrypoints that register services before the `services` preset runs (e.g. unit tests).
if (!getServiceChannel()) {
  installNoopServiceChannel();
}
