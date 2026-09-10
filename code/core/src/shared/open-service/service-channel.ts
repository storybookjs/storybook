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
import { isReservedKey } from './plain-object.ts';
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
export const SERVICE_ENTRY = 'services:entry' as const;
export const SERVICE_COMMAND_INVOKE = 'services:command-invoke' as const;
export const SERVICE_COMMAND_ACK = 'services:command-ack' as const;
export const SERVICE_COMMAND_RESULT = 'services:command-result' as const;
export const SERVICE_COMMAND_ERROR = 'services:command-error' as const;
export const SERVICE_COMMAND_UNHANDLED = 'services:command-unhandled' as const;

/**
 * Channel payloads are untrusted input, so each event has a Valibot schema. Listeners narrow with
 * `v.safeParse(schema, payload)`; the payload *types* are derived from the schemas so the wire shape
 * and the static type can never drift. Field-level notes:
 *
 * - `state` must be a *plain* object: `v.record` accepts arrays, so a custom check rejects them
 *   (an array snapshot would corrupt the structural merge in `service-sync.ts`).
 * - `version` is a non-negative safe integer — the last-write-wins logical clock for bootstrap
 *   snapshots. Command broadcasts use `services:entry` and `{ seq, runtimeId, counter }` instead.
 * - `input` / `result` are optional: a `void` command input or output serializes to `undefined`,
 *   which JSON / telejson transports drop entirely, so the key is legitimately absent on the wire.
 * - Unknown fields on `services:entry` are ignored so a later envelope field is not a protocol break.
 */

/** A plain (non-array, non-null) object — the shape every synced state snapshot must take. */
const stateSnapshotSchema = v.custom<Record<string, unknown>>(
  (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
);

const nonNegativeSafeInteger = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const RFC_6901_ENCODED_SEGMENT = /^(?:[^~]|~[01])*$/;

/** RFC 6901 JSON Pointer: `~0` encodes `~`, `~1` encodes `/`. */
export function encodePointer(segments: readonly string[]): string {
  return `/${segments.map((segment) => segment.replaceAll('~', '~0').replaceAll('/', '~1')).join('/')}`;
}

/** Inverse of {@link encodePointer}. `pointer` must be empty or start with `/`. */
export function decodePointer(pointer: string): string[] {
  if (pointer === '') {
    return [];
  }
  return pointer
    .slice(1)
    .split('/')
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'));
}

export const isRfc6901Pointer = (pointer: string): boolean => {
  if (!pointer.startsWith('/')) {
    return false;
  }
  return pointer
    .slice(1)
    .split('/')
    .every((encoded) => {
      if (!RFC_6901_ENCODED_SEGMENT.test(encoded)) {
        return false;
      }
      const decoded = encoded.replaceAll('~1', '/').replaceAll('~0', '~');
      return !isReservedKey(decoded);
    });
};

/** RFC 6901 pointer: starts with `/`, valid `~0`/`~1` escapes, no reserved decoded segment. */
export const jsonPointerSchema = v.pipe(v.string(), v.check(isRfc6901Pointer));

export const jsonPatchOperationSchema = v.variant('op', [
  v.object({ op: v.literal('add'), path: jsonPointerSchema, value: v.unknown() }),
  v.object({ op: v.literal('replace'), path: jsonPointerSchema, value: v.unknown() }),
  v.object({ op: v.literal('remove'), path: jsonPointerSchema }),
]);
export type JsonPatchOperation = v.InferOutput<typeof jsonPatchOperationSchema>;

export const entryStampSchema = v.object({
  seq: v.pipe(nonNegativeSafeInteger, v.minValue(1)),
  runtimeId: v.string(),
  counter: v.pipe(nonNegativeSafeInteger, v.minValue(1)),
});
export type EntryStamp = v.InferOutput<typeof entryStampSchema>;

/** Canonical log key and warning label: `seq:runtimeId:counter`. */
export function entryStampKey(stamp: EntryStamp): string {
  return `${stamp.seq}:${stamp.runtimeId}:${stamp.counter}`;
}

/** `services:entry` — one per outer command invocation, never empty. */
export const entrySchema = v.object({
  serviceId: v.string(),
  stamp: entryStampSchema,
  command: v.string(),
  patch: v.pipe(v.array(jsonPatchOperationSchema), v.minLength(1)),
});
export type EntryPayload = v.InferOutput<typeof entrySchema>;

/** Sent by a newly-registered peer to initialize its state from any existing peer. */
export const syncStartSchema = v.object({
  serviceId: v.string(),
  runtimeId: v.string(),
});
export type SyncStartPayload = v.InferOutput<typeof syncStartSchema>;

/**
 * A full state snapshot stamped for last-write-wins ordering. Used by `services:sync-start-reply`
 * to bootstrap a freshly registered peer. Recipients apply it only when it is strictly newer than
 * their own (see `isNewer` in `service-sync.ts`). Command broadcasts use `services:entry` instead.
 */
export const stampedSnapshotSchema = v.object({
  serviceId: v.string(),
  state: stateSnapshotSchema,
  version: nonNegativeSafeInteger,
  runtimeId: v.string(),
});
export type StampedSnapshotPayload = v.InferOutput<typeof stampedSnapshotSchema>;
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
  runtimeId: v.string(),
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
  runtimeId: v.string(),
});
export type CommandAckPayload = v.InferOutput<typeof commandAckSchema>;

/**
 * Emitted by a non-delegated peer that received a `services:command-invoke` it cannot dispatch —
 * a positive config-drift report that only a delegated requester acts on (see
 * `connectCommandTransport`).
 */
export const commandUnhandledSchema = v.object({
  serviceId: v.string(),
  callId: v.string(),
});
export type CommandUnhandledPayload = v.InferOutput<typeof commandUnhandledSchema>;

/** Sent by an implementing peer after a remote command resolves successfully. */
export const commandResultSchema = v.object({
  serviceId: v.string(),
  callId: v.string(),
  result: v.optional(v.unknown()),
  runtimeId: v.string(),
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
  runtimeId: v.string(),
});
export type CommandErrorPayload = v.InferOutput<typeof commandErrorSchema>;

/**
 * Unique id for one service registration.
 *
 * It is the last-write-wins tiebreak for equal versions and the loop guard that drops a runtime's
 * own `services:sync-start`. `nanoid` is used (over `Math.random`) so collisions cannot silently
 * break that determinism.
 */
export function generateRuntimeId(): string {
  return nanoid();
}

/** Unique id for one remote-command invocation. Replies correlate on this, not on `runtimeId`. */
export function generateCallId(): string {
  return nanoid();
}
