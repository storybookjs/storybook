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
 * is populated, {@link getServiceChannel} returns `null` and service runtimes operate in isolation
 * (all reads and writes are local only) — which is also the default in unit tests.
 */
import { global } from '@storybook/global';

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

/**
 * Returns the live Storybook channel shared by every service runtime, or `null` before it exists.
 *
 * Reads the ambient `globalThis.__STORYBOOK_ADDONS_CHANNEL__` slot rather than a private one: the
 * manager, both preview builders, and the dev server's `services` preset all populate it, so every
 * runtime converges on the same channel with no install step. The transport re-reads this at call
 * time, so a runtime registered before the channel exists still starts broadcasting once it does.
 * Unit tests can assign the slot directly or module-mock this function.
 */
export function getServiceChannel(): ServiceChannel | null {
  return (global.__STORYBOOK_ADDONS_CHANNEL__ as ServiceChannel | undefined) ?? null;
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
