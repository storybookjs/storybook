/**
 * Shared sync primitives for the open-service multi-master protocol.
 *
 * Every runtime — server (Node), manager (top window), preview (iframe) — runs a full
 * `ServiceRuntime` and reconciles incoming state here. Command broadcasts apply RFC 6902 patches
 * by path and drop duplicates with a per-writer Vector. Bootstrap still uses last-write-wins snapshot
 * replies. The transport that moves entries and snapshots lives in `service-transport.ts`.
 *
 * ## 1. `isNewer` — last-write-wins ordering for bootstrap snapshots
 *
 * Each bootstrap snapshot carries a `(version, runtimeId)` stamp. `version` is a logical clock
 * bumped on every accepted local or remote change. Equal versions mean concurrent snapshot
 * replies; the lexicographically greater `runtimeId` wins. An *equal* stamp is **not** newer,
 * which drops snapshot echoes.
 *
 * ## 2. Entries — Vector, seen stamps, apply by path
 *
 * Each `services:entry` carries `{ runtimeId, counter }`. A stamp already seen, or with a
 * counter at or below the Vector, is a duplicate and is dropped. Anything else is applied in
 * arrival order. The Vector stores, per writer, the highest *contiguous* counter applied. A gap
 * is applied but does not advance the Vector.
 *
 * ## 3. `applyStatePatch` — structural merge for snapshots
 *
 * Applies incoming snapshot state onto the live state object in place so that deep-signal
 * subscriptions only re-fire for the fields that actually changed. Full peer snapshots delete
 * keys absent from the source so deletions propagate; partial static snapshots preserve missing
 * keys. Arrays are replaced wholesale, primitives are assigned only when changed, and the
 * dangerous `__proto__`/`constructor`/`prototype` keys are skipped on both read and delete.
 */

import { logger } from 'storybook/internal/client-logger';

import { applyJsonPatch } from './json-patch.ts';
import { FORBIDDEN_KEYS, hasOwn, isPlainObject } from './plain-object.ts';
import { entryStampKey, type EntryPayload, type EntryStamp } from './service-channel.ts';

/** Per-service last-write-wins stamp carried on bootstrap snapshot replies. */
export type SyncStamp = {
  /** Logical clock for the state lineage. Bumped on every accepted change, adopted on snapshot accept. */
  version: number;
  /** Id of the runtime that produced this version; the deterministic tiebreak for equal versions. */
  runtimeId: string;
};

/**
 * Returns whether `incoming` should replace `local` under last-write-wins ordering.
 *
 * Higher `version` always wins. At an equal version (concurrent writes) the lexicographically
 * greater `runtimeId` wins so every runtime picks the same winner. An equal stamp is **not** newer —
 * that is precisely what makes echoes and relayed re-broadcasts terminate rather than loop.
 */
export function isNewer(incoming: SyncStamp, local: SyncStamp): boolean {
  if (incoming.version !== local.version) {
    return incoming.version > local.version;
  }

  return incoming.runtimeId > local.runtimeId;
}

/**
 * Applies `source` onto `target` in place while preserving object identity for unchanged branches.
 *
 * Open-service runtimes expose their state through deep-signal proxies. Replacing the whole state
 * object for every incoming snapshot would invalidate all subscriptions, even when only one nested
 * field changed. This helper instead walks both objects and mutates `target` only where values differ:
 *
 * - Recurses into plain objects so nested deep-signal subscriptions stay attached.
 * - Replaces arrays wholesale, matching the sync contract that arrays are values rather than maps.
 * - Assigns primitives only when changed to avoid spurious signal invalidation.
 * - Skips `__proto__`, `constructor`, and `prototype` on both delete and assign paths so untrusted
 *   channel payloads and static files cannot pollute prototypes.
 *
 * The `preserveMissingKeys` mode selects the source contract:
 *
 * - `false` means `source` is a full peer snapshot. Keys missing from `source` are deleted from
 *   `target`, allowing deletions to propagate through cross-peer sync.
 * - `true` means `source` is a partial static snapshot. Keys missing from `source` are left alone so
 *   snapshots for one static query input do not erase state populated by other inputs.
 */
export function applyStatePatch(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  options: { preserveMissingKeys: boolean }
): void {
  if (!options.preserveMissingKeys) {
    // Remove keys the source no longer carries (deletion propagation).
    for (const key of Object.keys(target)) {
      if (FORBIDDEN_KEYS.has(key)) {
        continue;
      }

      if (!hasOwn(source, key)) {
        delete target[key];
      }
    }
  }

  // Merge or assign keys the source provides.
  for (const key of Object.keys(source)) {
    if (FORBIDDEN_KEYS.has(key)) {
      continue;
    }

    const sourceValue = source[key];
    const tarvalue = target[key];

    if (isPlainObject(sourceValue) && isPlainObject(tarvalue)) {
      applyStatePatch(tarvalue, sourceValue, options);
    } else if (tarvalue !== sourceValue) {
      target[key] = sourceValue;
    }
  }
}

/** In-place mutation of a runtime's live state object, as exposed by the runtime's `applyLocal`. */
export type StateMutator = (state: Record<string, unknown>) => void;

/**
 * The per-service reconciler shared by every runtime's channel integration.
 *
 * It owns the bootstrap snapshot stamp, the per-writer Vector, and the seen-stamp set. The entry
 * author calls {@link SnapshotReconciler.advanceLocal} before emitting. Incoming entries go
 * through {@link SnapshotReconciler.tryAdoptEntry}. Incoming bootstrap snapshots go through
 * {@link SnapshotReconciler.tryAdopt}.
 */
export type SnapshotReconciler = {
  /** The current local snapshot stamp (read for sync-start-reply envelopes). */
  readonly stamp: SyncStamp;
  /**
   * Records a locally authored change: bumps the snapshot version, increments this writer's
   * counter, records the stamp as seen, and advances the Vector. Call this before emitting so
   * the broadcast's own echo is recognized as a duplicate and dropped.
   */
  advanceLocal(runtimeId: string): EntryStamp;
  /**
   * Adopts an incoming snapshot iff it is strictly newer (LWW). Returns whether it was adopted, so
   * relay hubs can re-broadcast only on a real advance.
   */
  tryAdopt(incoming: SyncStamp, state: Record<string, unknown>): boolean;
  /**
   * Applies an incoming entry iff it is not a duplicate. Returns whether it was accepted, so a
   * hub forwards the original payload only then. A gap is accepted without advancing the Vector.
   */
  tryAdoptEntry(incoming: EntryPayload): boolean;
};

/**
 * Builds a {@link SnapshotReconciler} bound to one runtime's state.
 *
 * `setState` is the runtime's `applyLocal` adapted to a plain record, so adopting never authors an
 * entry. `initialStamp` is typically `{ version: 0, runtimeId: <own id> }`.
 */
export function createSnapshotReconciler(options: {
  setState: (mutate: StateMutator) => void;
  initialStamp: SyncStamp;
}): SnapshotReconciler {
  const { setState, initialStamp } = options;
  let localStamp = initialStamp;
  const vector = new Map<string, number>();
  const seen = new Set<string>();

  const vectorOf = (runtimeId: string): number => vector.get(runtimeId) ?? 0;

  // Remember a stamp we authored or applied. A contiguous counter advances this writer's vector
  // over it and over any later stamps that arrived as gaps; the vector then covers those stamps, so
  // `seen` keeps only stamps beyond a gap. Bump the snapshot stamp so bootstrap replies stay newer.
  const recordAccepted = (stamp: EntryStamp): void => {
    const { runtimeId } = stamp;
    if (stamp.counter === vectorOf(runtimeId) + 1) {
      let next = stamp.counter;
      while (seen.delete(entryStampKey({ runtimeId, counter: next + 1 }))) {
        next += 1;
      }
      vector.set(runtimeId, next);
    } else {
      seen.add(entryStampKey(stamp));
    }
    localStamp = { version: localStamp.version + 1, runtimeId };
  };

  return {
    get stamp(): SyncStamp {
      return localStamp;
    },

    advanceLocal(runtimeId: string): EntryStamp {
      const stamp = { runtimeId, counter: vectorOf(runtimeId) + 1 };
      recordAccepted(stamp);
      return stamp;
    },

    tryAdopt(incoming: SyncStamp, state: Record<string, unknown>): boolean {
      if (!isNewer(incoming, localStamp)) {
        return false;
      }

      localStamp = { version: incoming.version, runtimeId: incoming.runtimeId };
      setState((current) => applyStatePatch(current, state, { preserveMissingKeys: false }));

      return true;
    },

    tryAdoptEntry(incoming: EntryPayload): boolean {
      const { serviceId, stamp, command, patch } = incoming;
      const key = entryStampKey(stamp);

      if (seen.has(key) || stamp.counter <= vectorOf(stamp.runtimeId)) {
        return false;
      }

      let failedPath: string | undefined;
      setState((current) => {
        const result = applyJsonPatch(current, patch, (path) => {
          logger.debug(
            `Open-service sync: remove of missing key. service=${serviceId} stamp=${key} path=${path} command=${command}`
          );
        });
        if (!result.ok) {
          failedPath = result.path;
        }
      });

      // Not recorded as seen, so a later replay of this stamp can still apply. Until it does, this
      // writer's later counters count as gaps: applied, but the vector does not advance past them.
      if (failedPath !== undefined) {
        logger.warn(
          `Open-service sync: missing parent while applying entry. service=${serviceId} stamp=${key} path=${failedPath} command=${command}`
        );
        return false;
      }

      recordAccepted(stamp);
      return true;
    },
  };
}
