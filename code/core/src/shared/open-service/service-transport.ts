/**
 * Shared channel-transport helpers for the open-service multi-master protocol.
 *
 * `registerService` in `service-registry.ts` uses this module in every runtime, hub or leaf, so entry
 * authoring, the sync listeners, and the command transport cannot drift apart between runtimes.
 *
 * - {@link connectServiceToChannel} is the single entry point `registerService` uses. It wires the
 *   three parts below against one channel, installs the channel-routed command map on the runtime
 *   (so load bodies can invoke peer-implemented commands), and returns the command map callers
 *   expose plus a combined teardown.
 * - {@link createEntryAuthor} builds the receiver for the runtime's `setState` entries: each one
 *   is stamped and emitted as an RFC 6902 `services:entry`. A recipe that writes nothing produces
 *   no entry, so it emits nothing and does not bump the stamp.
 * - {@link connectRuntimeToChannel} attaches the sync-request / sync-reply and entry listeners,
 *   emits a bootstrap `services:sync-request`, and returns a teardown. A `relay` hub re-emits every
 *   `services:entry` it accepted, each `services:entry` it dropped as beyond-window once, and
 *   every `services:sync-reply` it installed, forwarding the original payload object. It never
 *   forwards a request.
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

import { logger } from 'storybook/internal/client-logger';

import {
  OpenServiceRemoteCommandConfigDriftError,
  OpenServiceRemoteCommandDisconnectedError,
  OpenServiceRemoteCommandUnhandledError,
} from '../../server-errors.ts';
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
import type { EntryAuthor } from './service-runtime.ts';
import {
  formatFrontier,
  vectorDominates,
  type InstallOutcome,
  type PlaceEntryOutcome,
  type Reconciler,
} from './service-sync.ts';
import type { ServiceId } from './types.ts';

/** A runtime command as seen by the transport layer: `(input) => Promise<result>`. */
type RuntimeCommand = (input: unknown) => Promise<unknown>;

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
 * still ran and broadcast its writes. Remote command execution is therefore best-effort /
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
  /** This runtime's stable id; it stamps this runtime's entries and drops its own `sync-request`. */
  ownRuntimeId: string;
  /** The reconciler owning this runtime's Log, Vector, and Clock. */
  reconciler: Reconciler;
  /** Reads the runtime's current live state at emit time. */
  getSnapshot: () => Record<string, unknown>;
}

/**
 * Builds the receiver for the entries a runtime's `setState` recipes author.
 *
 * Each entry is stamped BEFORE it is emitted, so the copy that bounces back carries a stamp this
 * runtime has already seen and is dropped as a duplicate.
 */
export function createEntryAuthor(
  context: Omit<RuntimeTransportContext, 'getSnapshot'> & { channel: ServiceChannel }
): EntryAuthor {
  const { serviceId, ownRuntimeId, reconciler, channel } = context;

  return ({ command, ops, inverse }) => {
    const stamp = reconciler.advanceLocal(ownRuntimeId, { command, patch: ops, inverse });

    channel.emit(SERVICE_ENTRY, {
      serviceId,
      stamp,
      command,
      patch: ops,
    } satisfies EntryPayload);
  };
}

/**
 * Attaches the channel listeners that keep one runtime in sync with its peers, and returns a teardown.
 *
 * Wires three handlers and emits a bootstrap `services:sync-request` so a freshly-registered runtime
 * catches up to state authored before it joined:
 * - sync-request → reply `{ frontier, state }` only when our vector dominates the requester's;
 * - sync-reply → install only if dominating (and, on a relay hub, forward the original payload);
 * - entry → place by the five-case rule (and, on a relay hub, forward when logged or dropped as
 *   beyond-window for the first time).
 *
 * A hub forwards the original payload object so unknown fields survive the hop. Leaves keep
 * `relay: false`. The request policy (one outstanding, {@link SYNC_REQUEST_SILENCE_MS} of silence,
 * one queued repair) is in the README's Bootstrap and repair section.
 */
export function connectRuntimeToChannel(
  context: RuntimeTransportContext & { channel: ServiceChannel; relay: boolean }
): () => void {
  const { serviceId, ownRuntimeId, reconciler, getSnapshot, channel, relay } = context;

  let requestOutstanding = false;
  // Replies reach every direct peer, so only a concurrent reply inside the silence window after
  // our own request is ours to warn about; outside it the reply was for someone else.
  let withinReplyWindow = false;
  let repairQueued = false;
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;
  // The channel hands a hub its own forward back, in-process or as a copy over the server
  // websocket; that echo is not a reply to anything. Keyed by content so a copy still matches.
  let forwardedReplyKey: string | undefined;

  const clearSilenceTimer = (): void => {
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
    withinReplyWindow = true;
    repairQueued = false;
    channel.emit(SERVICE_SYNC_REQUEST, {
      serviceId,
      runtimeId: ownRuntimeId,
      frontier: reconciler.frontier,
    } satisfies SyncRequestPayload);
    clearSilenceTimer();
    silenceTimer = setTimeout(() => {
      silenceTimer = undefined;
      withinReplyWindow = false;
      settleOutstandingRequest();
    }, SYNC_REQUEST_SILENCE_MS);
  };

  // The outstanding request is over; a repair queued while it was open goes out now, with the
  // frontier as it stands after any install.
  const settleOutstandingRequest = (): void => {
    const queued = repairQueued;
    requestOutstanding = false;
    if (queued) {
      emitSyncRequest();
    }
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
      runtimeId: ownRuntimeId,
      frontier: reconciler.frontier,
      state: getSnapshot(),
    } satisfies SyncReplyPayload);
  };

  const onSyncReply = (payload: unknown): void => {
    const snapshot = v.safeParse(syncReplySchema, payload);
    if (
      !snapshot.success ||
      snapshot.output.serviceId !== serviceId ||
      snapshot.output.runtimeId === ownRuntimeId
    ) {
      return;
    }
    const replyKey = `${snapshot.output.runtimeId}:${formatFrontier(snapshot.output.frontier)}`;
    // A real reply never repeats this key: after installing it, our vector covers that replier's.
    if (replyKey === forwardedReplyKey) {
      return;
    }

    let outcome: InstallOutcome | undefined;
    try {
      outcome = reconciler.tryInstall(snapshot.output.frontier, snapshot.output.state);
    } finally {
      // Only a subscriber throws out of tryInstall, and only after the install ran.
      const settled = outcome ?? 'installed';
      if (settled === 'concurrent' && withinReplyWindow) {
        logger.warn(
          `Open-service sync: concurrent snapshot reply dropped. service=${serviceId} local=${formatFrontier(reconciler.frontier)} reply=${formatFrontier(snapshot.output.frontier)}`
        );
        // The reply answers the frontier we sent. A write of ours since then makes it concurrent,
        // and that write reaches the replier before our next request, so ask again with today's
        // frontier.
        repairQueued = true;
      }
      settleOutstandingRequest();

      if (settled === 'installed' && relay) {
        forwardedReplyKey = replyKey;
        channel.emit(SERVICE_SYNC_REPLY, payload);
      }
    }
  };

  const onEntry = (payload: unknown): void => {
    const parsed = v.safeParse(entrySchema, payload);
    if (!parsed.success || parsed.output.serviceId !== serviceId) {
      return;
    }

    let outcome: PlaceEntryOutcome | undefined;
    try {
      outcome = reconciler.tryPlaceEntry(parsed.output);
    } finally {
      // A subscriber can throw after the entry is logged, and a redelivery is then a duplicate, so
      // forward it now. Whether it was a gap is lost, so ask for repair as for an unapplied entry.
      const placed =
        outcome ?? (reconciler.has(parsed.output.stamp) ? ('unapplied' as const) : undefined);
      const logged = placed === 'accepted' || placed === 'gap' || placed === 'unapplied';
      const needsRepair = placed === 'gap' || placed === 'beyond-window' || placed === 'unapplied';

      // A hub also forwards an entry it dropped as beyond-window: a peer with a different floor may
      // place it, and the writer needs some peer to hold it before any reply can dominate the writer.
      if ((logged || placed === 'beyond-window') && relay) {
        channel.emit(SERVICE_ENTRY, payload);
      }
      if (needsRepair) {
        emitSyncRequest();
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
    requestOutstanding = false;
    withinReplyWindow = false;
    clearSilenceTimer();
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
 *   async channel flushes the ack before any handler work starts (each `setState` write is
 *   broadcast by the entry author, so peers converge as usual) — then emits
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
   * Local runtime commands keyed by name. Only entries in {@link implementedCommandNames}
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

/** Runtime surface the channel wiring installs into: the entry author and the routed command map. */
type ChannelConnectedRuntime = {
  attachEntryAuthor(author: EntryAuthor): void;
  attachChannelCommands(
    commands: Record<string, RuntimeCommand>,
    implementedCommandNames: ReadonlySet<string>
  ): void;
};

/**
 * Wires one service runtime to the channel end to end and returns the command map callers expose plus
 * a single teardown.
 *
 * This is the one entry point `registerService` uses, so the three transport halves — entry
 * authoring, the remote-command protocol, and the sync-request + entry listeners — are always
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

  runtime.attachEntryAuthor(createEntryAuthor({ serviceId, ownRuntimeId, reconciler, channel }));

  // Where a local handler exists, callers run it locally; where it does not, the returned command
  // routes the call to a peer that implements it.
  const commandTransport = connectCommandTransport({
    serviceId,
    ownRuntimeId,
    channel,
    localCommands: commands,
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
