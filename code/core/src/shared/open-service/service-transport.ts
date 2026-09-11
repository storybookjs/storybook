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
 *   three halves below against one channel, installs the channel-routed command map on the runtime
 *   (so load bodies can invoke peer-implemented commands), and returns the command map callers
 *   expose plus a combined teardown.
 * - {@link wrapCommandsForBroadcast} wraps a runtime's commands so each local call that touched
 *   state, after it resolves, stamps an RFC 6902 `services:entry` and emits it. A command that
 *   writes nothing emits nothing and does not bump the stamp.
 * - {@link connectRuntimeToChannel} attaches the sync-request / sync-reply and entry listeners,
 *   emits a bootstrap `services:sync-request`, and returns a teardown. A `relay` hub re-emits every
 *   `services:entry` it accepted and every `services:sync-reply` it installed, forwarding the
 *   original payload object. It never forwards a request.
 * - {@link connectCommandTransport} bridges the gap where a command is only implemented in *some*
 *   runtimes (e.g. a handler supplied at server registration). A runtime without a local handler
 *   requests remote execution; a runtime that has one listens for those requests, runs the command,
 *   and replies. See its docs for the request/ack/result/error protocol.
 *
 * The merge and ordering rules themselves live in `service-sync.ts`; this module only moves entries
 * and snapshot replies on and off the channel. `getSnapshot()` runs only to answer a dominating
 * request.
 */

import * as v from 'valibot';

import {
  OpenServiceRemoteCommandConfigDriftError,
  OpenServiceRemoteCommandDisconnectedError,
  OpenServiceRemoteCommandUnhandledError,
} from '../../server-errors.ts';
import { createPatchCollector, type PatchCollector } from './patch-recorder.ts';
import {
  SERVICE_COMMAND_ACK,
  SERVICE_COMMAND_ERROR,
  SERVICE_COMMAND_INVOKE,
  SERVICE_COMMAND_RESULT,
  SERVICE_COMMAND_UNHANDLED,
  SERVICE_ENTRY,
  SERVICE_SYNC_REPLY,
  SERVICE_SYNC_REQUEST,
  type CommandAckPayload,
  type CommandErrorPayload,
  type CommandInvokePayload,
  type CommandResultPayload,
  type CommandUnhandledPayload,
  type EntryPayload,
  type ServiceChannel,
  type SyncReplyPayload,
  type SyncRequestPayload,
  commandAckSchema,
  commandErrorSchema,
  commandInvokeSchema,
  commandResultSchema,
  commandUnhandledSchema,
  entrySchema,
  generateCallId,
  syncReplySchema,
  syncRequestSchema,
} from './service-channel.ts';
import { deserializeError, serializeError } from './service-error-serialization.ts';
import { vectorDominates, type SnapshotReconciler } from './service-sync.ts';
import type { ServiceId } from './types.ts';

/** A runtime command as seen by the transport layer: `(input, collector?) => Promise<result>`. */
type RuntimeCommand = (input: unknown, collector?: PatchCollector) => Promise<unknown>;

/**
 * Window for a requester to receive a `services:command-ack` before rejecting as unhandled.
 *
 * Detection is timing-based, not presence-based: there is no peer registry, so "no peer implements
 * this" is inferred from the absence of an ack. The budget covers one manager↔server (or
 * manager↔preview-iframe) round trip; 300ms is comfortably above a healthy postMessage/websocket
 * hop while still failing fast in a static build where no server peer exists at all.
 *
 * Trade-off: a peer that is merely slow (busy iframe, large payload, loaded CI) can ack past this
 * window. The responder acks-then-executes ({@link connectCommandTransport} `onInvoke`), so in that
 * case the requester rejects with `OpenServiceRemoteCommandUnhandledError` even though the command
 * still ran and broadcast its mutation. Remote command execution is therefore best-effort /
 * at-least-once, not exactly-once: callers must not assume a rejection means nothing happened.
 *
 * The window assumes an ack reaches the wire promptly, which ack-then-execute alone does not
 * guarantee: on an async channel the emitted ack needs an event-loop turn, which the responder's
 * own handler can starve for the length of its synchronous prefix. Deferring handler execution to
 * a macrotask (see `onInvoke`) is what keeps acks inside the window regardless of the handler.
 */
export const REMOTE_COMMAND_ACK_TIMEOUT_MS = 300;

/** A reply, or this much silence, clears the one outstanding `sync-request` per service. */
export const SYNC_REQUEST_SILENCE_MS = 1000;

type PendingRemoteCommand = {
  commandName: string;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  noAckTimer: ReturnType<typeof setTimeout>;
};

/** The shared bits both helpers need: which service, who we are, and our sync state. */
interface RuntimeTransportContext {
  /** Id of the service these helpers act for; stamped on every emitted envelope. */
  serviceId: ServiceId;
  /** This runtime's stable id, used to drop its own bootstrap request and its own echoes. */
  ownRuntimeId: string;
  /** The reconciler owning this runtime's Log, Vector, Clock, and adopt/advance transitions. */
  reconciler: SnapshotReconciler;
  /** Reads the runtime's current live state at emit time. */
  getSnapshot: () => Record<string, unknown>;
}

/**
 * Wraps each command so a successful local call that touched state emits one `services:entry`.
 *
 * The wrapper opens a per-invocation collector and passes it to the runtime command so `setState`
 * records the paths the recipe (and nested `ctx.self.commands.*` calls) touched. After the command
 * resolves, zero recorded paths means no stamp bump and no emit. Otherwise it stamps the entry and
 * emits it. Advancing BEFORE emitting is what makes the echo safe: the copy that bounces back
 * carries our just-recorded stamp and is dropped as a duplicate. State adopted from peers flows
 * through the reconciler's `setState`, never through these wrappers, so an adopted entry never
 * triggers a re-broadcast.
 */
export function wrapCommandsForBroadcast(
  commands: Record<string, RuntimeCommand>,
  context: RuntimeTransportContext & { channel: ServiceChannel }
): Record<string, RuntimeCommand> {
  const { serviceId, ownRuntimeId, reconciler, channel } = context;

  return Object.fromEntries(
    Object.entries(commands).map(([name, cmd]) => [
      name,
      async (input: unknown): Promise<unknown> => {
        const collector = createPatchCollector();
        const result = await cmd(input, collector);
        const { ops, inverse } = collector.flushRecorded();

        if (ops.length === 0) {
          return result;
        }

        const stamp = reconciler.advanceLocal(ownRuntimeId, {
          command: name,
          patch: ops,
          inverse,
        });
        channel.emit(SERVICE_ENTRY, {
          serviceId,
          stamp,
          command: name,
          patch: ops,
        } satisfies EntryPayload);
        return result;
      },
    ])
  );
}

/**
 * Attaches the channel listeners that keep one runtime in sync with its peers, and returns a teardown.
 *
 * Wires three handlers and emits a bootstrap `services:sync-request` so a freshly-registered runtime
 * catches up to state authored before it joined:
 * - sync-request → reply `{ frontier, state }` only when our vector dominates the requester's;
 * - sync-reply → install iff dominating (and, on a relay hub, forward the original payload);
 * - entry → place by the five-case rule (and, on a relay hub, forward when logged).
 *
 * A `relay` hub re-emits every entry it logged and every snapshot reply it installed, using the
 * original payload object so unknown fields survive the hop. It never forwards a request. Leaves
 * keep `relay: false`. At most one outstanding request per service; a reply or
 * {@link SYNC_REQUEST_SILENCE_MS} of silence clears the flag. A gap, beyond-window, or
 * missing-parent during that wait queues one more request, sent when the outstanding request
 * clears, using the frontier at send time. A reply — installed or rejected — sends that queued
 * request.
 */
export function connectRuntimeToChannel(
  context: RuntimeTransportContext & { channel: ServiceChannel; relay: boolean }
): () => void {
  const { serviceId, ownRuntimeId, reconciler, getSnapshot, channel, relay } = context;

  let requestOutstanding = false;
  let repairQueued = false;
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;

  const clearOutstandingRequest = (): void => {
    requestOutstanding = false;
    if (silenceTimer !== undefined) {
      clearTimeout(silenceTimer);
      silenceTimer = undefined;
    }
  };

  const emitSyncRequest = (): void => {
    if (requestOutstanding) {
      repairQueued = true;
      return;
    }
    requestOutstanding = true;
    repairQueued = false;
    channel.emit(SERVICE_SYNC_REQUEST, {
      serviceId,
      runtimeId: ownRuntimeId,
      frontier: reconciler.frontier,
    } satisfies SyncRequestPayload);
    silenceTimer = setTimeout(() => {
      requestOutstanding = false;
      silenceTimer = undefined;
      if (repairQueued) {
        emitSyncRequest();
      }
    }, SYNC_REQUEST_SILENCE_MS);
  };

  const onSyncRequest = (payload: unknown): void => {
    const request = v.safeParse(syncRequestSchema, payload);
    if (
      !request.success ||
      request.output.serviceId !== serviceId ||
      request.output.runtimeId === ownRuntimeId
    ) {
      return;
    }

    if (!vectorDominates(reconciler.vector, request.output.frontier.vector)) {
      return;
    }

    channel.emit(SERVICE_SYNC_REPLY, {
      serviceId,
      frontier: reconciler.frontier,
      state: getSnapshot(),
    } satisfies SyncReplyPayload);
  };

  const onSyncReply = (payload: unknown): void => {
    const snapshot = v.safeParse(syncReplySchema, payload);
    if (!snapshot.success || snapshot.output.serviceId !== serviceId) {
      return;
    }

    const installed = reconciler.tryAdopt(
      snapshot.output.frontier,
      snapshot.output.state,
      serviceId
    );
    const queued = repairQueued;
    clearOutstandingRequest();

    if (queued) {
      emitSyncRequest();
    }

    if (installed && relay) {
      channel.emit(SERVICE_SYNC_REPLY, payload);
    }
  };

  const onEntry = (payload: unknown): void => {
    const parsed = v.safeParse(entrySchema, payload);
    if (!parsed.success || parsed.output.serviceId !== serviceId) {
      return;
    }

    const outcome = reconciler.tryAdoptEntry({
      serviceId: parsed.output.serviceId,
      stamp: parsed.output.stamp,
      command: parsed.output.command,
      patch: parsed.output.patch,
    });

    switch (outcome) {
      case 'accepted':
        if (relay) {
          channel.emit(SERVICE_ENTRY, payload);
        }
        break;
      case 'gap':
        if (relay) {
          channel.emit(SERVICE_ENTRY, payload);
        }
        emitSyncRequest();
        break;
      case 'beyond-window':
      case 'missing-parent':
        emitSyncRequest();
        break;
      case 'duplicate':
        break;
      default: {
        const exhaustive: never = outcome;
        void exhaustive;
        break;
      }
    }
  };

  channel.on(SERVICE_SYNC_REQUEST, onSyncRequest);
  channel.on(SERVICE_SYNC_REPLY, onSyncReply);
  channel.on(SERVICE_ENTRY, onEntry);

  emitSyncRequest();

  return (): void => {
    channel.off(SERVICE_SYNC_REQUEST, onSyncRequest);
    channel.off(SERVICE_SYNC_REPLY, onSyncReply);
    channel.off(SERVICE_ENTRY, onEntry);
    repairQueued = false;
    clearOutstandingRequest();
  };
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
 *   `services:command-ack` immediately, runs the command locally on a deferred macrotask — so an
 *   async channel flushes the ack before any handler work starts (which also broadcasts the
 *   post-mutation state via the broadcast wrappers, so peers converge as usual) — then emits
 *   `services:command-result` or `services:command-error`.
 * - **Non-implementer**: a non-delegated runtime that hosts the service but not the invoked
 *   command's handler replies `services:command-unhandled` instead of staying silent. Only a
 *   delegated requester acts on that reply (rejecting with config-drift guidance, since the
 *   Storybook it attached to is the only runtime that sees its invokes); other requesters ignore
 *   it, because one peer's report cannot speak for the others.
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
 *
 * ## Delegated mode
 *
 * A delegated runtime (one attached to an already-running Storybook) owns no dispatch at all: it
 * requests *every* command over the channel and answers no invoke, because the runtime it attached
 * to is the implementer. Local handlers stay registered and inspectable but never run, so a service
 * author writes the same definition either way.
 */
export function connectCommandTransport(context: {
  /** Id of the service these commands belong to; stamped on every emitted envelope. */
  serviceId: ServiceId;
  /** This runtime's stable id, stamped on replies so peers know who answered. */
  ownRuntimeId: string;
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
  /** Whether this runtime delegates all dispatch to the peer it is attached to. */
  delegated: boolean;
}): { commands: Record<string, RuntimeCommand>; disconnect: () => void } {
  const {
    serviceId,
    ownRuntimeId,
    channel,
    localCommands,
    implementedCommandNames,
    commandNames,
    delegated,
  } = context;

  // A delegated runtime dispatches nothing itself, so its local handlers are inert on both sides of
  // the protocol: it requests every command and answers no invoke.
  const dispatchesLocally = (commandName: string): boolean =>
    !delegated && implementedCommandNames.has(commandName);

  // Requester bookkeeping: in-flight remote calls keyed by callId, settled by the first reply.
  const pending = new Map<string, PendingRemoteCommand>();

  const settle = (callId: string, apply: (entry: PendingRemoteCommand) => void): void => {
    const entry = pending.get(callId);
    if (!entry) {
      return;
    }
    pending.delete(callId);
    clearTimeout(entry.noAckTimer);
    apply(entry);
  };

  // Responder: run a locally-implemented command on a peer's request and reply with the outcome.
  const onInvoke = (payload: unknown): void => {
    const parsed = v.safeParse(commandInvokeSchema, payload);
    if (!parsed.success || parsed.output.serviceId !== serviceId) {
      return;
    }
    const invoke = parsed.output;

    if (!dispatchesLocally(invoke.commandName)) {
      // A hosted service without this command's handler is a positive config-drift signal for a
      // delegated caller. A delegated runtime answers no invokes, and a runtime that requested a
      // command remotely must not report its own echo.
      if (!delegated && invoke.runtimeId !== ownRuntimeId) {
        channel.emit(SERVICE_COMMAND_UNHANDLED, {
          serviceId,
          callId: invoke.callId,
        } satisfies CommandUnhandledPayload);
      }
      return;
    }

    channel.emit(SERVICE_COMMAND_ACK, {
      serviceId,
      callId: invoke.callId,
      runtimeId: ownRuntimeId,
    } satisfies CommandAckPayload);

    // On an async channel the emitted ack still needs an event-loop turn to reach the wire, so the
    // handler starts on a macrotask: a microtask start would starve that turn for as long as the
    // handler's synchronous prefix runs (a fan-out over hundreds of components outlives the window).
    // A timer, not `setImmediate`: an immediate would glue the handler to the same check phase as
    // the deferred ack sends, starving the acks of sibling invokes read in the same poll batch (a
    // docs listing issues the docgen and mdx fan-outs together); the timer waits one full turn.
    setTimeout(() => {
      void Promise.resolve()
        .then(() => localCommands[invoke.commandName](invoke.input))
        .then(
          (result) => {
            channel.emit(SERVICE_COMMAND_RESULT, {
              serviceId,
              callId: invoke.callId,
              result,
              runtimeId: ownRuntimeId,
            } satisfies CommandResultPayload);
          },
          (error: unknown) => {
            channel.emit(SERVICE_COMMAND_ERROR, {
              serviceId,
              callId: invoke.callId,
              error: serializeError(error),
              runtimeId: ownRuntimeId,
            } satisfies CommandErrorPayload);
          }
        );
    }, 0);
  };

  // Requester: resolve/reject the pending promise for a reply addressed to one of our calls.
  const onResult = (payload: unknown): void => {
    const result = v.safeParse(commandResultSchema, payload);
    if (!result.success || result.output.serviceId !== serviceId) {
      return;
    }
    settle(result.output.callId, (entry) => entry.resolve(result.output.result));
  };

  const onError = (payload: unknown): void => {
    const failure = v.safeParse(commandErrorSchema, payload);
    if (!failure.success || failure.output.serviceId !== serviceId) {
      return;
    }
    settle(failure.output.callId, (entry) => entry.reject(deserializeError(failure.output.error)));
  };

  const onAck = (payload: unknown): void => {
    const ack = v.safeParse(commandAckSchema, payload);
    if (!ack.success || ack.output.serviceId !== serviceId) {
      return;
    }

    const entry = pending.get(ack.output.callId);
    if (!entry) {
      return;
    }

    clearTimeout(entry.noAckTimer);
  };

  // Only for a delegated requester is one peer's report authoritative (the attached Storybook is
  // the only runtime that sees its invokes); elsewhere absence-of-ack stays the only signal.
  const onUnhandled = (payload: unknown): void => {
    const report = v.safeParse(commandUnhandledSchema, payload);
    if (!report.success || report.output.serviceId !== serviceId || !delegated) {
      return;
    }

    settle(report.output.callId, (entry) =>
      entry.reject(
        new OpenServiceRemoteCommandConfigDriftError({
          serviceId,
          commandName: entry.commandName,
        })
      )
    );
  };

  channel.on(SERVICE_COMMAND_INVOKE, onInvoke);
  channel.on(SERVICE_COMMAND_RESULT, onResult);
  channel.on(SERVICE_COMMAND_ERROR, onError);
  channel.on(SERVICE_COMMAND_ACK, onAck);
  channel.on(SERVICE_COMMAND_UNHANDLED, onUnhandled);

  const requestRemote = (commandName: string, input: unknown): Promise<unknown> => {
    const callId = generateCallId();

    return new Promise<unknown>((resolve, reject) => {
      // Reject if no peer acknowledges in time. See REMOTE_COMMAND_ACK_TIMEOUT_MS for the
      // best-effort semantics: a slow peer may still execute the command after we reject here.
      const noAckTimer = setTimeout(() => {
        settle(callId, (entry) =>
          entry.reject(
            new OpenServiceRemoteCommandUnhandledError({
              serviceId,
              commandName: entry.commandName,
              delegated,
            })
          )
        );
      }, REMOTE_COMMAND_ACK_TIMEOUT_MS);

      pending.set(callId, { commandName, resolve, reject, noAckTimer });
      channel.emit(SERVICE_COMMAND_INVOKE, {
        serviceId,
        commandName,
        input,
        callId,
        runtimeId: ownRuntimeId,
      } satisfies CommandInvokePayload);
    });
  };

  const commands: Record<string, RuntimeCommand> = {};
  for (const name of commandNames) {
    commands[name] = dispatchesLocally(name)
      ? localCommands[name]
      : (input: unknown) => requestRemote(name, input);
  }

  return {
    commands,
    disconnect: (): void => {
      channel.off(SERVICE_COMMAND_INVOKE, onInvoke);
      channel.off(SERVICE_COMMAND_RESULT, onResult);
      channel.off(SERVICE_COMMAND_ERROR, onError);
      channel.off(SERVICE_COMMAND_ACK, onAck);
      channel.off(SERVICE_COMMAND_UNHANDLED, onUnhandled);

      // Fail any still-pending remote calls so awaiters don't hang forever past teardown.
      for (const [, entry] of pending) {
        clearTimeout(entry.noAckTimer);
        entry.reject(new OpenServiceRemoteCommandDisconnectedError({ serviceId }));
      }
      pending.clear();
    },
  };
}

/**
 * Reports invokes for service ids this realm does not register at all.
 *
 * The per-service transport can only speak for services it hosts, but the common config-drift
 * shape — a feature flag gating a whole service — leaves the invoke with no listener at all. One
 * realm-global listener closes that gap: a non-delegated realm replies `services:command-unhandled`
 * for any invoke whose service id it has never registered, so a delegated caller learns the drift
 * positively instead of waiting out the ack window. Delegated realms answer nothing, a realm never
 * reports its own invokes (they are only ever for services it registers), and an id that was
 * registered before (mid-HMR re-registration) is not reported — staying silent degrades to the
 * retryable timeout error, while a false report would hand out restart guidance for a transient.
 */
export function connectUnknownServiceReporter(context: {
  channel: ServiceChannel;
  isServiceRegistered: (serviceId: ServiceId) => boolean;
  isDelegated: () => boolean;
}): () => void {
  const { channel, isServiceRegistered, isDelegated } = context;

  const onInvoke = (payload: unknown): void => {
    const parsed = v.safeParse(commandInvokeSchema, payload);
    if (!parsed.success || isDelegated() || isServiceRegistered(parsed.output.serviceId)) {
      return;
    }

    channel.emit(SERVICE_COMMAND_UNHANDLED, {
      serviceId: parsed.output.serviceId,
      callId: parsed.output.callId,
    } satisfies CommandUnhandledPayload);
  };

  channel.on(SERVICE_COMMAND_INVOKE, onInvoke);
  return (): void => {
    channel.off(SERVICE_COMMAND_INVOKE, onInvoke);
  };
}

/** Runtime surface needed to install the channel-routed command map for load bodies. */
type ChannelConnectedRuntime = {
  attachChannelCommands(
    commands: Record<string, RuntimeCommand>,
    implementedCommandNames: ReadonlySet<string>
  ): void;
};

/**
 * Wires one service runtime to the channel end to end and returns the command map callers expose plus
 * a single teardown.
 *
 * This is the one entry point `registerService` uses, so the three transport halves — command
 * broadcasting, the remote-command protocol, and the sync-request + entry listeners — are always
 * assembled together against the same `channel` and can never drift into using different channels.
 * The channel-routed command map is also installed on the runtime so load bodies invoke
 * peer-implemented commands remotely instead of throwing locally.
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
    /** Whether this runtime delegates all dispatch to the peer it is attached to. */
    delegated: boolean;
    /** Runtime to wire with the channel-routed command map for load bodies. */
    runtime: ChannelConnectedRuntime;
  }
): { commands: Record<string, RuntimeCommand>; disconnect: () => void } {
  const {
    serviceId,
    ownRuntimeId,
    reconciler,
    getSnapshot,
    channel,
    relay,
    commands,
    implementedCommandNames,
    commandNames,
    delegated,
    runtime,
  } = context;

  // Wrap commands so a local mutation emits a `services:entry`. State adopted from peers
  // flows through the reconciler's `setState`, never these wrappers, so it never re-broadcasts.
  const broadcastCommands = wrapCommandsForBroadcast(commands, {
    serviceId,
    ownRuntimeId,
    reconciler,
    getSnapshot,
    channel,
  });

  // Where a local handler exists, callers run it (and broadcast) via `broadcastCommands`; where it
  // does not, the returned command routes the call to a peer that implements it.
  const commandTransport = connectCommandTransport({
    serviceId,
    ownRuntimeId,
    channel,
    localCommands: broadcastCommands,
    implementedCommandNames,
    commandNames,
    delegated,
  });

  const disconnectSync = connectRuntimeToChannel({
    serviceId,
    ownRuntimeId,
    reconciler,
    getSnapshot,
    channel,
    relay,
  });

  // Load bodies call commands through the channel-routed map so a command implemented only on a peer
  // is requested remotely instead of throwing locally. A delegated runtime dispatches none of its
  // commands, so every name counts as remote here too.
  runtime.attachChannelCommands(
    commandTransport.commands,
    delegated ? new Set<string>() : implementedCommandNames
  );

  return {
    commands: commandTransport.commands,
    disconnect: (): void => {
      disconnectSync();
      commandTransport.disconnect();
    },
  };
}
