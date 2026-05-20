/**
 * Channel-based transport for service state synchronisation.
 *
 * Services use a single architecture-global channel — typically Storybook's existing
 * manager↔preview↔server channel — to:
 *
 *   1. Announce on registration ("I just registered service X, anyone got state for it?")
 *   2. Reply to other clients' announcements with current state
 *   3. Broadcast ongoing state mutations as patches so peers stay in sync
 *
 * The channel itself is installed once per app via `setServiceChannel()`. Without one, sync is
 * disabled — services run with whatever state local activity produces, plus any static-build
 * JSON the static transport pulls in. That's the "isolation" case: an iframe popout, a unit
 * test, a CLI script.
 *
 * Event names are prefixed with `services:` so a downstream Node SDK or filter can drop them
 * without inspecting payloads.
 */

/**
 * Minimal channel shape we depend on. Matches `Pick<Channel, 'on' | 'off' | 'emit'>` from
 * Storybook's existing channel implementation, but typed structurally so this module doesn't
 * have to import from `storybook/internal/channels`.
 */
export interface ServiceChannel {
  on(event: string, listener: (data: any) => void): void;
  off(event: string, listener: (data: any) => void): void;
  emit(event: string, data: any): void;
}

// Event name prefix and constants. Single source of truth.
export const SERVICE_EVENT_PREFIX = 'services:' as const;
export const SERVICE_WELCOME_REQUEST = `${SERVICE_EVENT_PREFIX}welcome-request` as const;
export const SERVICE_WELCOME_REPLY = `${SERVICE_EVENT_PREFIX}welcome-reply` as const;
export const SERVICE_PATCHES = `${SERVICE_EVENT_PREFIX}patches` as const;

/** Payload of `services:welcome-request`. Scoped to a single service id. */
export interface WelcomeRequestPayload {
  readonly serviceId: string;
}

/** Payload of `services:welcome-reply`. Carries the full current state of the service. */
export interface WelcomeReplyPayload {
  readonly serviceId: string;
  readonly state: Record<string, unknown>;
}

/**
 * Payload of `services:patches`. Carries the Immer patch list that the originating client
 * produced via its `setState`. Peers apply these via Immer's `applyPatches`.
 */
export interface PatchesPayload {
  readonly serviceId: string;
  readonly patches: readonly unknown[]; // Immer Patch[] but kept opaque at this layer.
}

/**
 * The global channel. `null` means "no cross-client sync." This is the right default for
 * unit tests and for hosts that have no channel infrastructure.
 */
let currentChannel: ServiceChannel | null = null;

/**
 * Install the channel used by all service runtimes for sync. Call once at app startup —
 * typically from the manager or preview entry point with Storybook's existing channel.
 */
export function setServiceChannel(channel: ServiceChannel): void {
  currentChannel = channel;
}

/** Remove the channel. Subsequent registrations won't emit or listen. */
export function clearServiceChannel(): void {
  currentChannel = null;
}

/** @internal Used by `ServiceRuntime` to wire its sync handlers. */
export function getServiceChannel(): ServiceChannel | null {
  return currentChannel;
}
