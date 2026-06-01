/**
 * Channel transport constants and helpers for the open-service peer-to-peer sync protocol.
 *
 * Services use Storybook's existing manager↔preview channel so that a service registered
 * in the manager or preview can automatically synchronise its state with other connected
 * peers. The `services:` prefix keeps service events trivially filterable from other
 * channel traffic.
 *
 * Install the channel once at app startup via {@link setServiceChannel}. Without a channel
 * installed, service runtimes operate in isolation — all reads and writes are local only.
 */

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

export const SERVICE_WELCOME_REQUEST = 'services:welcome-request' as const;
export const SERVICE_WELCOME_REPLY = 'services:welcome-reply' as const;
export const SERVICE_PATCHES = 'services:patches' as const;
export const SERVICE_COMMAND_INVOKE = 'services:command-invoke' as const;
export const SERVICE_COMMAND_RESULT = 'services:command-result' as const;
export const SERVICE_COMMAND_ERROR = 'services:command-error' as const;

/** Sent by a newly-registered client to request the current state from any existing peer. */
export interface WelcomeRequestPayload {
  serviceId: string;
  clientId: string;
}

/** Sent in reply to a `services:welcome-request` with the responding peer's current state. */
export interface WelcomeReplyPayload {
  serviceId: string;
  /** Full state snapshot at the time of reply. */
  state: Record<string, unknown>;
  clientId: string;
}

/**
 * Broadcast by a peer after every local command execution.
 *
 * Contains the full post-mutation state snapshot so peers can apply it without tracking
 * individual mutations. Keyed by `clientId` so recipients suppress their own echo.
 */
export interface PatchesPayload {
  serviceId: string;
  /** Full state snapshot after the mutation. */
  state: Record<string, unknown>;
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

// Use a globalThis slot (via Symbol.for) so the channel is shared across all module
// instances. In Vite dev mode the .storybook/ files and the pre-bundled core package
// resolve to separate module instances of this file; a plain `let` variable would give
// each instance its own copy and setServiceChannel/getServiceChannel would disagree.
const CHANNEL_SYMBOL = Symbol.for('storybook.open-service.channel');

function getChannelStore(): { channel: ServiceChannel | null } {
  const g = globalThis as Record<symbol, { channel: ServiceChannel | null } | undefined>;
  g[CHANNEL_SYMBOL] ??= { channel: null };
  return g[CHANNEL_SYMBOL]!;
}

/**
 * Install the channel used by all service client runtimes for cross-peer state sync.
 *
 * Pass `window.__STORYBOOK_ADDONS_CHANNEL__` (the full bidirectional channel) from the
 * manager or preview entry point. Must be called after the channel is created — inside
 * an `addons.register` callback in manager code, or at module top level in preview code.
 */
export function setServiceChannel(channel: ServiceChannel): void {
  getChannelStore().channel = channel;
}

/** Remove the installed channel. Service runtimes will operate in isolation after this. */
export function clearServiceChannel(): void {
  getChannelStore().channel = null;
}

/** @internal Returns the channel installed by `setServiceChannel`, or `null` if none. */
export function getServiceChannel(): ServiceChannel | null {
  return getChannelStore().channel;
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
