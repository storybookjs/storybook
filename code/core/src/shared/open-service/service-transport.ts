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
 * - {@link wrapCommandsForBroadcast} wraps a runtime's commands so each local call, after it resolves,
 *   advances the last-write-wins stamp and broadcasts the full post-mutation snapshot. The channel is
 *   re-read at call time (not capture time) so a runtime registered before its channel is installed
 *   still broadcasts once the channel arrives, and clearing the channel silently disables broadcasts.
 * - {@link connectRuntimeToChannel} attaches the sync-start initialization and patch listeners, emits
 *   the bootstrap sync-start, and returns a teardown. A `relay` hub re-broadcasts every snapshot it
 *   adopts so peers on its *other* transports converge; leaves keep `relay: false`.
 *
 * The merge and ordering rules themselves live in `service-sync.ts`; this module only moves snapshots
 * on and off the channel.
 */

import {
  SERVICE_PATCHES,
  SERVICE_SYNC_START,
  SERVICE_SYNC_START_REPLY,
  type PatchesPayload,
  type ServiceChannel,
  type SyncStartPayload,
  type SyncStartReplyPayload,
} from './service-channel.ts';
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
 *
 * `getChannel` is read at call time, not capture time: a runtime registered before its channel is
 * installed still broadcasts once the channel arrives, and clearing the channel disables broadcasts.
 */
export function wrapCommandsForBroadcast(
  commands: Record<string, RuntimeCommand>,
  context: RuntimeTransportContext & { getChannel: () => ServiceChannel | null }
): Record<string, RuntimeCommand> {
  const { serviceId, ownClientId, reconciler, getSnapshot, getChannel } = context;

  return Object.fromEntries(
    Object.entries(commands).map(([name, cmd]) => [
      name,
      async (input: unknown): Promise<unknown> => {
        const result = await cmd(input);

        // A local command makes this runtime the new author: advance the stamp BEFORE emitting so the
        // broadcast bouncing back to us is recognized as not-newer (equal stamp) and dropped.
        const stamp = reconciler.advanceLocal(ownClientId);

        const channel = getChannel();

        if (channel) {
          channel.emit(SERVICE_PATCHES, {
            serviceId,
            state: getSnapshot(),
            version: stamp.version,
            clientId: stamp.clientId,
          } satisfies PatchesPayload);
        }

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
