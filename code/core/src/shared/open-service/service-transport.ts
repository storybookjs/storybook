/**
 * Shared channel-transport helpers for the open-service multi-master protocol.
 *
 * Every runtime that participates in cross-peer sync — the manager (top window), a preview iframe,
 * and the dev server (Node) — does the same two things with its channel: it broadcasts the state its
 * own commands author, and it listens for peers' snapshots so it can reconcile. This module owns both
 * halves so leaf registration (`service-registry.ts`, `relay: false`) and hub registration
 * (`server.ts`, `relay: true`) cannot drift apart in how they wrap commands, gate echoes, or relay
 * adopted state.
 *
 * - {@link connectServiceToChannel} is the single entry point `registerService` uses. It wires all
 *   three halves below against one channel so they can never be assembled inconsistently, and returns
 *   the command map callers expose plus a combined teardown.
 * - {@link wrapCommandsForBroadcast} wraps a runtime's commands so each local call, after it resolves,
 *   advances the last-write-wins stamp and broadcasts the full post-mutation snapshot.
 * - {@link connectRuntimeToChannel} attaches the sync-start initialization and patch listeners, emits
 *   the bootstrap sync-start, and returns a teardown. A `relay` hub re-broadcasts every snapshot it
 *   adopts so peers on its *other* transports converge; leaves keep `relay: false`.
 * - {@link connectCommandTransport} bridges the gap where a command is only implemented in *some*
 *   runtimes (e.g. a handler supplied at server registration). A runtime without a local handler
 *   requests remote execution; a runtime that has one listens for those requests, runs the command,
 *   and replies. See its docs for the request/ack/result/error protocol.
 *
 * The merge and ordering rules themselves live in `service-sync.ts`; this module only moves snapshots
 * on and off the channel.
 */

import { OpenServiceRemoteCommandDisconnectedError } from '../../server-errors.ts';
import {
  SERVICE_COMMAND_ACK,
  SERVICE_COMMAND_ERROR,
  SERVICE_COMMAND_INVOKE,
  SERVICE_COMMAND_RESULT,
  SERVICE_PATCHES,
  SERVICE_SYNC_START,
  SERVICE_SYNC_START_REPLY,
  type CommandAckPayload,
  type CommandErrorPayload,
  type CommandInvokePayload,
  type CommandResultPayload,
  type PatchesPayload,
  type ServiceChannel,
  type SyncStartPayload,
  type SyncStartReplyPayload,
  generateClientId,
} from './service-channel.ts';
import {
  type SerializedError,
  deserializeError,
  serializeError,
} from './service-error-serialization.ts';
import { parseStampedSnapshot, parseSyncStart, type SnapshotReconciler } from './service-sync.ts';
import type { ServiceId } from './types.ts';

/** A runtime command as seen by the transport layer: `(input) => Promise<result>`. */
type RuntimeCommand = (input: unknown) => Promise<unknown>;

/** The shared bits both helpers need: which service, who we are, and our sync state. */
interface RuntimeTransportContext {
  /** Id of the service these helpers act for; stamped on every emitted envelope. */
  serviceId: ServiceId;
  /** This runtime's stable id, used to drop its own bootstrap request and its own echoes. */
  ownClientId: string;
  /** The reconciler owning this runtime's LWW stamp and its adopt/advance transitions. */
  reconciler: SnapshotReconciler;
  /** Reads the runtime's current live state at emit time. */
  getSnapshot: () => Record<string, unknown>;
}

/**
 * Wraps each command so a successful local call broadcasts the full post-mutation snapshot.
 *
 * After the wrapped command resolves we advance the stamp (making this runtime the new author) and
 * emit `services:patches`. Advancing BEFORE emitting is what makes the echo safe: the copy that
 * bounces back carries our just-advanced stamp and fails `isNewer`, so it is dropped instead of
 * re-applied. State adopted from peers flows through the reconciler's `setState`, never through these
 * wrappers, so an adopted snapshot never triggers a re-broadcast.
 */
export function wrapCommandsForBroadcast(
  commands: Record<string, RuntimeCommand>,
  context: RuntimeTransportContext & { channel: ServiceChannel }
): Record<string, RuntimeCommand> {
  const { serviceId, ownClientId, reconciler, getSnapshot, channel } = context;

  return Object.fromEntries(
    Object.entries(commands).map(([name, cmd]) => [
      name,
      async (input: unknown): Promise<unknown> => {
        const result = await cmd(input);

        // A local command makes this runtime the new author: advance the stamp BEFORE emitting so the
        // broadcast bouncing back to us is recognized as not-newer (equal stamp) and dropped.
        const stamp = reconciler.advanceLocal(ownClientId);

        channel.emit(SERVICE_PATCHES, {
          serviceId,
          state: getSnapshot(),
          version: stamp.version,
          clientId: stamp.clientId,
        } satisfies PatchesPayload);

        return result;
      },
    ])
  );
}

/**
 * Attaches the channel listeners that keep one runtime in sync with its peers, and returns a teardown.
 *
 * Wires three handlers and emits a bootstrap `services:sync-start` so a freshly-registered runtime
 * catches up to state authored before it joined:
 * - sync-start → reply with our current snapshot+stamp (ignoring our own request);
 * - sync-start-reply / patches → adopt iff strictly newer (and, on a relay hub, re-broadcast).
 *
 * A `relay` hub re-emits every snapshot it adopts under the SAME adopted stamp, so peers reachable on
 * its *other* transports converge while the copy bouncing back fails `isNewer` and stops the loop.
 * Leaves (a preview iframe) keep `relay: false`: with a single transport there is nothing to forward.
 */
export function connectRuntimeToChannel(
  context: RuntimeTransportContext & { channel: ServiceChannel; relay: boolean }
): () => void {
  const { serviceId, ownClientId, reconciler, getSnapshot, channel, relay } = context;

  const emitSyncStart = (): void => {
    channel.emit(SERVICE_SYNC_START, {
      serviceId,
      clientId: ownClientId,
    } satisfies SyncStartPayload);
  };

  // Relay hub only: forward an adopted snapshot to peers on our OTHER transports. We re-emit the
  // canonical post-merge snapshot under the SAME adopted stamp, so the copy that bounces back fails
  // `isNewer` and is dropped instead of looping.
  const relayAdopted = (): void => {
    channel.emit(SERVICE_PATCHES, {
      serviceId,
      state: getSnapshot(),
      version: reconciler.stamp.version,
      clientId: reconciler.stamp.clientId,
    } satisfies PatchesPayload);
  };

  const adoptPeerSnapshot = (snapshot: {
    version: number;
    clientId: string;
    state: Record<string, unknown>;
  }): boolean => {
    const adopted = reconciler.tryAdopt(
      { version: snapshot.version, clientId: snapshot.clientId },
      snapshot.state
    );

    if (adopted && relay) {
      relayAdopted();
    }

    return adopted;
  };

  // Reply to a peer's sync-start with our current snapshot+stamp (which may be one we adopted from yet
  // another peer, not necessarily our own clientId). Skip our own bootstrap request.
  const onSyncStart = (payload: unknown): void => {
    const request = parseSyncStart(payload);
    if (!request || request.serviceId !== serviceId || request.clientId === ownClientId) {
      return;
    }

    channel.emit(SERVICE_SYNC_START_REPLY, {
      serviceId,
      state: getSnapshot(),
      version: reconciler.stamp.version,
      clientId: reconciler.stamp.clientId,
    } satisfies SyncStartReplyPayload);
  };

  // Bootstrap from a peer's sync-start-reply. Version-gating (not a first-reply-only guard) is what
  // makes this converge when several peers reply: each reply is adopted only if strictly newer.
  const onSyncStartReply = (payload: unknown): void => {
    const snapshot = parseStampedSnapshot(payload);
    if (!snapshot || snapshot.serviceId !== serviceId) {
      return;
    }
    adoptPeerSnapshot(snapshot);
  };

  // Apply patches from peers. The version gate drops echoes of our own broadcast and any
  // already-applied snapshot, so no explicit self-clientId check is needed here.
  const onPatches = (payload: unknown): void => {
    const snapshot = parseStampedSnapshot(payload);
    if (!snapshot || snapshot.serviceId !== serviceId) {
      return;
    }
    adoptPeerSnapshot(snapshot);
  };

  channel.on(SERVICE_SYNC_START, onSyncStart);
  channel.on(SERVICE_SYNC_START_REPLY, onSyncStartReply);
  channel.on(SERVICE_PATCHES, onPatches);

  // Ask any existing peer for the current state so we catch up to changes authored before we joined.
  emitSyncStart();

  // A hub that already holds peer-adopted state (e.g. after a hot reload) pushes once so late
  // joiners on other transports can converge without waiting for another mutation.
  if (relay && reconciler.stamp.version > 0) {
    relayAdopted();
  }

  return (): void => {
    channel.off(SERVICE_SYNC_START, onSyncStart);
    channel.off(SERVICE_SYNC_START_REPLY, onSyncStartReply);
    channel.off(SERVICE_PATCHES, onPatches);
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Narrows an untrusted `services:command-invoke` payload, returning `null` when malformed. */
function parseCommandInvoke(payload: unknown): CommandInvokePayload | null {
  if (!isRecord(payload)) {
    return null;
  }

  const { serviceId, commandName, callId, clientId } = payload;
  if (
    typeof serviceId !== 'string' ||
    typeof commandName !== 'string' ||
    typeof callId !== 'string' ||
    typeof clientId !== 'string'
  ) {
    return null;
  }

  return { serviceId, commandName, callId, clientId, input: payload.input };
}

/** Narrows an untrusted `services:command-result` payload, returning `null` when malformed. */
function parseCommandResult(payload: unknown): CommandResultPayload | null {
  if (!isRecord(payload)) {
    return null;
  }

  const { serviceId, callId, clientId } = payload;
  if (typeof serviceId !== 'string' || typeof callId !== 'string' || typeof clientId !== 'string') {
    return null;
  }

  return { serviceId, callId, clientId, result: payload.result };
}

/** Narrows an untrusted `services:command-error` payload, returning `null` when malformed. */
function parseCommandError(payload: unknown): CommandErrorPayload | null {
  if (!isRecord(payload)) {
    return null;
  }

  const { serviceId, callId, clientId, error } = payload;
  if (
    typeof serviceId !== 'string' ||
    typeof callId !== 'string' ||
    typeof clientId !== 'string' ||
    !isRecord(error)
  ) {
    return null;
  }

  return { serviceId, callId, clientId, error: error as unknown as SerializedError };
}

/**
 * Wires the remote-command-execution protocol for one service runtime, returning the command map
 * callers should use plus a teardown.
 *
 * ## Why this exists
 *
 * A command handler can be supplied at registration in only *some* runtimes — the canonical case is
 * a server-only handler that needs Node APIs or server context. Runtimes without a local handler
 * still expose the command (so `useServiceCommand`, tests, and other services can call it), but they
 * cannot run it themselves; they must ask a peer that can.
 *
 * ## Protocol
 *
 * - **Requester** (no local handler): the returned command emits `services:command-invoke` with a
 *   unique `callId` and returns a promise. The promise resolves with the first
 *   `services:command-result` for that `callId`, or rejects with the (deserialized) error from the
 *   first `services:command-error`.
 * - **Responder** (has a local handler): on a matching `services:command-invoke` it emits
 *   `services:command-ack` immediately, runs the command locally (which also broadcasts the
 *   post-mutation state via the broadcast wrappers, so peers converge as usual), then emits
 *   `services:command-result` or `services:command-error`.
 *
 * Both roles coexist on one runtime: it responds for the commands it implements and requests the
 * ones it does not. A runtime never requests a command it implements (it runs that locally), so it
 * never answers its own invoke echo.
 *
 * ## Multiple implementers
 *
 * If several peers implement the same command they will each run it and reply. The requester keeps
 * only the first reply per `callId` and ignores the rest. Running a command in more than one runtime
 * is therefore possible by construction; it is constrained by usage conventions and documentation
 * rather than enforced here.
 *
 * ## Topology
 *
 * Replies travel back over the same channel the invoke went out on. A request reaches every peer on
 * the requester's transports; the manager is connected to both the dev server and the preview, so it
 * can invoke a command implemented in either. Command events are *not* relayed across a hub's other
 * transports, so a preview cannot directly invoke a server-only command (and vice versa) — route such
 * calls through the manager or implement the command on a directly-connected peer.
 */
export function connectCommandTransport(context: {
  /** Id of the service these commands belong to; stamped on every emitted envelope. */
  serviceId: ServiceId;
  /** This runtime's stable id, stamped on replies so peers know who answered. */
  ownClientId: string;
  channel: ServiceChannel;
  /**
   * Broadcast-wrapped local commands keyed by name. Only entries in {@link implementedCommandNames}
   * are runnable; the rest are present only so the map is complete.
   */
  localCommands: Record<string, RuntimeCommand>;
  /** Command names that have a local handler in this runtime. */
  implementedCommandNames: ReadonlySet<string>;
  /** Every command name declared by the service definition. */
  commandNames: readonly string[];
}): { commands: Record<string, RuntimeCommand>; disconnect: () => void } {
  const { serviceId, ownClientId, channel, localCommands, implementedCommandNames, commandNames } =
    context;

  // Requester bookkeeping: in-flight remote calls keyed by callId, settled by the first reply.
  const pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: unknown) => void }
  >();

  const settle = (
    callId: string,
    apply: (entry: { resolve: (v: unknown) => void; reject: (e: unknown) => void }) => void
  ): void => {
    const entry = pending.get(callId);
    if (!entry) {
      return;
    }
    pending.delete(callId);
    apply(entry);
  };

  // Responder: run a locally-implemented command on a peer's request and reply with the outcome.
  const onInvoke = (payload: unknown): void => {
    const invoke = parseCommandInvoke(payload);
    if (
      !invoke ||
      invoke.serviceId !== serviceId ||
      !implementedCommandNames.has(invoke.commandName)
    ) {
      return;
    }

    channel.emit(SERVICE_COMMAND_ACK, {
      serviceId,
      callId: invoke.callId,
      clientId: ownClientId,
    } satisfies CommandAckPayload);

    void Promise.resolve()
      .then(() => localCommands[invoke.commandName](invoke.input))
      .then(
        (result) => {
          channel.emit(SERVICE_COMMAND_RESULT, {
            serviceId,
            callId: invoke.callId,
            result,
            clientId: ownClientId,
          } satisfies CommandResultPayload);
        },
        (error: unknown) => {
          channel.emit(SERVICE_COMMAND_ERROR, {
            serviceId,
            callId: invoke.callId,
            error: serializeError(error),
            clientId: ownClientId,
          } satisfies CommandErrorPayload);
        }
      );
  };

  // Requester: resolve/reject the pending promise for a reply addressed to one of our calls.
  const onResult = (payload: unknown): void => {
    const result = parseCommandResult(payload);
    if (!result || result.serviceId !== serviceId) {
      return;
    }
    settle(result.callId, (entry) => entry.resolve(result.result));
  };

  const onError = (payload: unknown): void => {
    const failure = parseCommandError(payload);
    if (!failure || failure.serviceId !== serviceId) {
      return;
    }
    settle(failure.callId, (entry) => entry.reject(deserializeError(failure.error)));
  };

  channel.on(SERVICE_COMMAND_INVOKE, onInvoke);
  channel.on(SERVICE_COMMAND_RESULT, onResult);
  channel.on(SERVICE_COMMAND_ERROR, onError);

  const requestRemote = (commandName: string, input: unknown): Promise<unknown> => {
    const callId = generateClientId();

    return new Promise<unknown>((resolve, reject) => {
      pending.set(callId, { resolve, reject });
      channel.emit(SERVICE_COMMAND_INVOKE, {
        serviceId,
        commandName,
        input,
        callId,
        clientId: ownClientId,
      } satisfies CommandInvokePayload);
    });
  };

  const commands: Record<string, RuntimeCommand> = {};
  for (const name of commandNames) {
    commands[name] = implementedCommandNames.has(name)
      ? localCommands[name]
      : (input: unknown) => requestRemote(name, input);
  }

  return {
    commands,
    disconnect: (): void => {
      channel.off(SERVICE_COMMAND_INVOKE, onInvoke);
      channel.off(SERVICE_COMMAND_RESULT, onResult);
      channel.off(SERVICE_COMMAND_ERROR, onError);

      // Fail any still-pending remote calls so awaiters don't hang forever past teardown.
      for (const [, entry] of pending) {
        entry.reject(new OpenServiceRemoteCommandDisconnectedError({ serviceId }));
      }
      pending.clear();
    },
  };
}

/**
 * Wires one service runtime to the channel end to end and returns the command map callers expose plus
 * a single teardown.
 *
 * This is the one entry point `registerService` uses, so the three transport halves — command
 * broadcasting, the remote-command protocol, and the sync-start + patch listeners — are always
 * assembled together against the same `channel` and can never drift into using different channels.
 */
export function connectServiceToChannel(
  context: RuntimeTransportContext & {
    channel: ServiceChannel;
    relay: boolean;
    /** The runtime's full command map (all names; unimplemented ones throw if run locally). */
    commands: Record<string, RuntimeCommand>;
    /** Command names that have a local handler in this runtime. */
    implementedCommandNames: ReadonlySet<string>;
    /** Every command name declared by the service definition. */
    commandNames: readonly string[];
  }
): { commands: Record<string, RuntimeCommand>; disconnect: () => void } {
  const {
    serviceId,
    ownClientId,
    reconciler,
    getSnapshot,
    channel,
    relay,
    commands,
    implementedCommandNames,
    commandNames,
  } = context;

  // Wrap commands so a local mutation broadcasts its post-mutation snapshot. State adopted from peers
  // flows through the reconciler's `setState`, never these wrappers, so it never re-broadcasts.
  const broadcastCommands = wrapCommandsForBroadcast(commands, {
    serviceId,
    ownClientId,
    reconciler,
    getSnapshot,
    channel,
  });

  // Where a local handler exists, callers run it (and broadcast) via `broadcastCommands`; where it
  // does not, the returned command routes the call to a peer that implements it.
  const commandTransport = connectCommandTransport({
    serviceId,
    ownClientId,
    channel,
    localCommands: broadcastCommands,
    implementedCommandNames,
    commandNames,
  });

  const disconnectSync = connectRuntimeToChannel({
    serviceId,
    ownClientId,
    reconciler,
    getSnapshot,
    channel,
    relay,
  });

  return {
    commands: commandTransport.commands,
    disconnect: (): void => {
      disconnectSync();
      commandTransport.disconnect();
    },
  };
}
