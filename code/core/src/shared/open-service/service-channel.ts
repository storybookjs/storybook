/**
 * Channel transport constants and helpers for the open-service peer-to-peer sync protocol.
 *
 * Services use Storybook's existing manager↔preview channel so that a service registered
 * in the manager or preview can automatically synchronise its state with other connected
 * peers. The `services:` prefix keeps service events trivially filterable from other
 * channel traffic.
 *
 * The live channel is read via {@link getChannel} from `storybook/internal/channels`.
 */
import type { ChannelLike } from '../../channels/types.ts';
import type { SerializedError } from './service-error-serialization.ts';

/**
 * Minimal channel contract needed for service sync.
 *
 * Structurally matches `Pick<ChannelLike, 'on' | 'off' | 'emit'>` so test mocks and the full
 * {@link Channel} class both satisfy this type.
 */
export type ServiceChannel = Pick<ChannelLike, 'on' | 'off' | 'emit'>;

export const SERVICE_SYNC_START = 'services:sync-start' as const;
export const SERVICE_SYNC_START_REPLY = 'services:sync-start-reply' as const;
export const SERVICE_PATCHES = 'services:patches' as const;
export const SERVICE_COMMAND_INVOKE = 'services:command-invoke' as const;
export const SERVICE_COMMAND_ACK = 'services:command-ack' as const;
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

/**
 * Sent by a runtime that wants a command executed but has no local handler for it.
 *
 * Any peer that *does* implement the command runs it and replies with an ack, then a result or
 * error carrying the same `callId`. The requester awaits its promise until one of those arrives.
 */
export interface CommandInvokePayload {
  serviceId: string;
  commandName: string;
  /** Raw (unvalidated) command input; the implementing peer validates it before running. */
  input: unknown;
  /** Unique id correlating this invocation with its ack/result/error replies. */
  callId: string;
  /** Id of the requesting runtime. */
  clientId: string;
}

/**
 * Emitted by an implementing peer the moment it accepts a `services:command-invoke`.
 *
 * Purely informational: it tells observers (and the requester) that at least one peer has picked
 * the call up. The requester still resolves/rejects only on the result/error reply.
 */
export interface CommandAckPayload {
  serviceId: string;
  callId: string;
  /** Id of the runtime that accepted the invocation. */
  clientId: string;
}

/** Sent by an implementing peer after a remote command resolves successfully. */
export interface CommandResultPayload {
  serviceId: string;
  callId: string;
  /** Validated command output. */
  result: unknown;
  /** Id of the runtime that executed the command. */
  clientId: string;
}

/** Sent by an implementing peer after a remote command throws. */
export interface CommandErrorPayload {
  serviceId: string;
  callId: string;
  /** Serialized error (including its `cause` chain) so the requester can rethrow a real Error. */
  error: SerializedError;
  /** Id of the runtime that executed the command. */
  clientId: string;
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
