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
import { nanoid } from 'nanoid';
import * as v from 'valibot';

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

/**
 * Channel payloads are untrusted input, so each event has a Valibot schema. Listeners narrow with
 * `v.safeParse(schema, payload)`; the payload *types* are derived from the schemas so the wire shape
 * and the static type can never drift. Field-level notes:
 *
 * - `state` must be a *plain* object: `v.record` accepts arrays, so a custom check rejects them
 *   (an array snapshot would corrupt the structural merge in `service-sync.ts`).
 * - `version` is a non-negative safe integer — the last-write-wins logical clock.
 * - `input` / `result` are optional: a `void` command input or output serializes to `undefined`,
 *   which JSON / telejson transports drop entirely, so the key is legitimately absent on the wire.
 */

/** A plain (non-array, non-null) object — the shape every synced state snapshot must take. */
const stateSnapshotSchema = v.custom<Record<string, unknown>>(
  (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
);

/** Sent by a newly-registered peer to initialize its state from any existing peer. */
export const syncStartSchema = v.object({
  serviceId: v.string(),
  clientId: v.string(),
});
export type SyncStartPayload = v.InferOutput<typeof syncStartSchema>;

/**
 * A full state snapshot stamped for last-write-wins ordering. Shared by `services:patches` (broadcast
 * after every local command) and `services:sync-start-reply` (the response that bootstraps a freshly
 * registered peer). Recipients apply it only when it is strictly newer than their own (see `isNewer`
 * in `service-sync.ts`), which suppresses echoes, breaks relay cycles, and converges concurrent writes.
 */
export const stampedSnapshotSchema = v.object({
  serviceId: v.string(),
  state: stateSnapshotSchema,
  version: v.pipe(v.number(), v.safeInteger(), v.minValue(0)),
  clientId: v.string(),
});
export type StampedSnapshotPayload = v.InferOutput<typeof stampedSnapshotSchema>;
export type PatchesPayload = StampedSnapshotPayload;
export type SyncStartReplyPayload = StampedSnapshotPayload;

/**
 * Sent by a runtime that wants a command executed but has no local handler for it.
 *
 * Any peer that *does* implement the command runs it and replies with an ack, then a result or
 * error carrying the same `callId`. The requester awaits its promise until one of those arrives.
 * `input` is the raw (unvalidated) command input; the implementing peer validates it before running.
 */
export const commandInvokeSchema = v.object({
  serviceId: v.string(),
  commandName: v.string(),
  input: v.optional(v.unknown()),
  callId: v.string(),
  clientId: v.string(),
});
export type CommandInvokePayload = v.InferOutput<typeof commandInvokeSchema>;

/**
 * Emitted by an implementing peer the moment it accepts a `services:command-invoke`.
 *
 * Requesters use this to detect that at least one peer will run the command; if no ack arrives
 * within a short window, the request rejects as unhandled. The requester still resolves/rejects on
 * the result/error reply once a peer has acknowledged.
 */
export const commandAckSchema = v.object({
  serviceId: v.string(),
  callId: v.string(),
  clientId: v.string(),
});
export type CommandAckPayload = v.InferOutput<typeof commandAckSchema>;

/** Sent by an implementing peer after a remote command resolves successfully. */
export const commandResultSchema = v.object({
  serviceId: v.string(),
  callId: v.string(),
  result: v.optional(v.unknown()),
  clientId: v.string(),
});
export type CommandResultPayload = v.InferOutput<typeof commandResultSchema>;

/**
 * Sent by an implementing peer after a remote command throws. `error` is a serialized error
 * (including its `cause` chain) so the requester can rethrow a real `Error`; it is only checked for
 * "is a plain object" here and reconstructed in `service-error-serialization.ts`.
 */
export const commandErrorSchema = v.object({
  serviceId: v.string(),
  callId: v.string(),
  error: v.custom<SerializedError>(
    (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
  ),
  clientId: v.string(),
});
export type CommandErrorPayload = v.InferOutput<typeof commandErrorSchema>;

/**
 * Generates a unique id for one runtime instance (and for one remote-command `callId`).
 *
 * The id is identity-critical: it is the last-write-wins tiebreak for equal versions, the loop guard
 * that drops a peer's own echoes, and the correlation key matching command replies to their calls.
 * `nanoid` is used (over `Math.random`) so collisions cannot silently break that determinism.
 */
export function generateClientId(): string {
  return nanoid();
}
