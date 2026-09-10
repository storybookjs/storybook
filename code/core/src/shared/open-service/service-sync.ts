/**
 * Shared sync primitives for the open-service multi-master protocol.
 *
 * Every runtime — server (Node), manager (top window), preview (iframe) — runs a full
 * `ServiceRuntime` and reconciles incoming state here. Command broadcasts carry a Lamport stamp
 * `{ seq, runtimeId, counter }` and an RFC 6902 patch. Each replica keeps an ordered Log, a
 * per-writer Vector, and a Clock. Bootstrap still uses last-write-wins snapshot replies. The
 * transport that moves entries and snapshots lives in `service-transport.ts`.
 *
 * ## 1. `isNewer` — last-write-wins ordering for bootstrap snapshots
 *
 * Each bootstrap snapshot carries a `(version, runtimeId)` stamp. `version` stays at least the
 * Lamport Clock after each accepted entry, so a joiner that raises its Clock from `version` cannot
 * author a `seq` into retained history. Equal versions mean concurrent snapshot replies; the
 * lexicographically greater `runtimeId` wins. An *equal* stamp is **not** newer, which drops
 * snapshot echoes. The Clock still moves on every observed snapshot stamp, including those that
 * lose last-write-wins.
 *
 * ## 2. Entries — Clock, Vector, ordered Log
 *
 * Each `services:entry` carries `{ seq, runtimeId, counter }`. `seq` is the Lamport order key.
 * One comparator orders the Log ascending on `seq`, then on `runtimeId` by plain string
 * comparison. Incoming cases, in order: duplicate (in the Log, counter at or below the Vector, or
 * `seq` at or below an adopted snapshot `version`) drops but still advances the Clock; later
 * appends; earlier undoes newest-first, applies, and redoes from stored forward ops inside one
 * `setState` batch; a gap still places but does not advance the Vector; beyond-window (sorts before
 * the oldest retained entry) drops and warns. Adopting a bootstrap snapshot raises the Clock to at
 * least that snapshot's `version`, so a late joiner's next `seq` is later than the peer's accepted
 * history, and retires the Log so old inverses cannot replay across the new state. The Vector stays,
 * so later echoes still drop. The Vector never evicts. Log eviction is lazy on append: an entry is
 * retained while younger than 15 s or among the newest 256.
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
import { entryStampKey, type EntryStamp, type JsonPatchOperation } from './service-channel.ts';

export const DEFAULT_LOG_MAX_AGE_MS = 15_000;
export const DEFAULT_LOG_MAX_ENTRIES = 256;

export type LogWindow = {
  maxAgeMs: number;
  maxEntries: number;
};

/** Per-service last-write-wins stamp carried on bootstrap snapshot replies. */
export type SyncStamp = {
  /** Logical clock for the state lineage. At least the Lamport Clock after each accepted entry. */
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
 * Canonical entry order: ascending `seq`, then ascending `runtimeId` with plain string comparison.
 *
 * "Later in the log", "greater stamp", and "wins the path" coincide. Greater `runtimeId` is later,
 * matching last-write-wins snapshot ties.
 */
export function compareStamps(left: EntryStamp, right: EntryStamp): number {
  if (left.seq !== right.seq) {
    return left.seq < right.seq ? -1 : 1;
  }
  if (left.runtimeId !== right.runtimeId) {
    return left.runtimeId < right.runtimeId ? -1 : 1;
  }
  return 0;
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

/** In-place mutation of a runtime's live state object, as exposed by `commandSelf.setState`. */
export type StateMutator = (state: Record<string, unknown>) => void;

export type AdoptEntryInput = {
  serviceId: string;
  stamp: EntryStamp;
  command: string;
  patch: readonly JsonPatchOperation[];
};

export type AuthoredEntry = {
  command: string;
  patch: readonly JsonPatchOperation[];
  inverse: readonly JsonPatchOperation[];
};

export type ReconcilerLogEntry = {
  stamp: EntryStamp;
  command: string;
  patch: readonly JsonPatchOperation[];
};

type StoredLogEntry = ReconcilerLogEntry & {
  inverse: JsonPatchOperation[];
  appliedAt: number;
};

/**
 * The per-service reconciler shared by every runtime's channel integration.
 *
 * It owns the bootstrap snapshot stamp, the Clock, the per-writer Vector, and the ordered Log.
 * Local commands call {@link SnapshotReconciler.advanceLocal} before emitting. Incoming entries go
 * through {@link SnapshotReconciler.tryAdoptEntry}. Incoming bootstrap snapshots go through
 * {@link SnapshotReconciler.tryAdopt}.
 */
export type SnapshotReconciler = {
  /** The current local snapshot stamp (read for sync-start-reply envelopes). */
  readonly stamp: SyncStamp;
  /**
   * Lamport high-water mark. Moves on incoming stamps (including duplicates), local authoring,
   * observed bootstrap stamps (including LWW rejects), and adopted snapshot `version`.
   */
  readonly clock: number;
  /** Per-writer highest contiguous counter applied. */
  readonly vector: Readonly<Record<string, number>>;
  /** Applied entries in canonical order, after window eviction. */
  readonly log: readonly ReconcilerLogEntry[];
  /** Whether this stamp is in the retained Log. */
  has(stamp: EntryStamp): boolean;
  /**
   * Records a locally authored change: assigns `seq = clock + 1`, increments this writer's
   * counter, appends to the Log with the supplied inverse, and advances the Clock. Call this
   * before emitting so the broadcast's own echo is recognized as a duplicate and dropped.
   */
  advanceLocal(runtimeId: string, authored: AuthoredEntry): EntryStamp;
  /**
   * Adopts an incoming snapshot iff it is strictly newer (LWW). Always raises the Clock to at least
   * `incoming.version`, including when the snapshot loses last-write-wins. An accepted snapshot
   * retires the Log and ignores later arrivals with `seq` at or below that `version`. Returns
   * whether state was adopted, so relay hubs can re-broadcast only on a real advance.
   */
  tryAdopt(incoming: SyncStamp, state: Record<string, unknown>): boolean;
  /**
   * Places an incoming entry into the Log. Returns whether it was accepted, so a hub forwards the
   * original payload only then. Duplicates, entries at or below the last adopted snapshot `version`,
   * and beyond-window entries return false; a gap is accepted without advancing the Vector.
   */
  tryAdoptEntry(incoming: AdoptEntryInput): boolean;
};

/**
 * Builds a {@link SnapshotReconciler} bound to one runtime's state.
 *
 * @param setState - The runtime's batched in-place mutator (`commandSelf.setState`), adapted to a
 *   plain record. Adopting goes through this rather than the wrapped commands so it never triggers
 *   a re-broadcast.
 * @param initialStamp - Starting snapshot stamp, typically `{ version: 0, runtimeId: <own id> }`.
 */
export function createSnapshotReconciler(options: {
  setState: (mutate: StateMutator) => void;
  initialStamp: SyncStamp;
  window?: Partial<LogWindow>;
}): SnapshotReconciler {
  const { setState, initialStamp } = options;
  const window: LogWindow = {
    maxAgeMs: options.window?.maxAgeMs ?? DEFAULT_LOG_MAX_AGE_MS,
    maxEntries: options.window?.maxEntries ?? DEFAULT_LOG_MAX_ENTRIES,
  };
  let localStamp = initialStamp;
  let clock = 0;
  let snapshotSeq = 0;
  const vector = new Map<string, number>();
  const log: StoredLogEntry[] = [];
  const logKeys = new Set<string>();
  let truncated = false;

  const vectorOf = (runtimeId: string): number => vector.get(runtimeId) ?? 0;

  const hasStamp = (stamp: EntryStamp): boolean => logKeys.has(entryStampKey(stamp));

  const silentMissingRemove = (): void => undefined;

  const patchPaths = (patch: readonly JsonPatchOperation[]): string =>
    patch.map((operation) => operation.path).join(',');

  const applyOps = (
    current: Record<string, unknown>,
    patch: readonly JsonPatchOperation[],
    onMissingRemove: (path: string) => void
  ) => applyJsonPatch(current, patch, onMissingRemove);

  const undoEntry = (
    current: Record<string, unknown>,
    entry: StoredLogEntry,
    serviceId: string
  ): void => {
    const result = applyOps(current, entry.inverse, silentMissingRemove);
    if (!result.ok) {
      logger.warn(
        `Open-service sync: undo failed. service=${serviceId} stamp=${entryStampKey(entry.stamp)} path=${result.path} command=${entry.command}`
      );
    }
  };

  const redoEntry = (
    current: Record<string, unknown>,
    entry: StoredLogEntry,
    serviceId: string
  ): void => {
    const result = applyOps(current, entry.patch, silentMissingRemove);
    if (!result.ok) {
      logger.warn(
        `Open-service sync: replay failed. service=${serviceId} stamp=${entryStampKey(entry.stamp)} path=${result.path} command=${entry.command}`
      );
      return;
    }
    entry.inverse = result.inverse;
  };

  // Inclusive of `index`: those entries sit after the incoming stamp and are replayed after it.
  const undoToIndex = (
    current: Record<string, unknown>,
    index: number,
    serviceId: string
  ): StoredLogEntry[] => {
    const undone: StoredLogEntry[] = [];
    for (let cursor = log.length - 1; cursor >= index; cursor -= 1) {
      const entry = log[cursor];
      undoEntry(current, entry, serviceId);
      undone.push(entry);
    }
    return undone;
  };

  const redoUndone = (
    current: Record<string, unknown>,
    undone: StoredLogEntry[],
    serviceId: string
  ): void => {
    for (let cursor = undone.length - 1; cursor >= 0; cursor -= 1) {
      redoEntry(current, undone[cursor], serviceId);
    }
  };

  const insertIndexFor = (stamp: EntryStamp): number => {
    let index = 0;
    while (index < log.length && compareStamps(log[index].stamp, stamp) < 0) {
      index += 1;
    }
    return index;
  };

  const tryAdvanceVector = (stamp: EntryStamp): void => {
    if (stamp.counter !== vectorOf(stamp.runtimeId) + 1) {
      return;
    }
    const counters = new Set<number>();
    for (const entry of log) {
      if (entry.stamp.runtimeId === stamp.runtimeId) {
        counters.add(entry.stamp.counter);
      }
    }
    let next = stamp.counter;
    while (counters.has(next + 1)) {
      next += 1;
    }
    vector.set(stamp.runtimeId, next);
  };

  const evict = (now: number): void => {
    if (log.length === 0) {
      return;
    }
    const minKeepIndex = Math.max(0, log.length - window.maxEntries);
    const kept: StoredLogEntry[] = [];
    for (let index = 0; index < log.length; index += 1) {
      const entry = log[index];
      const amongNewest = index >= minKeepIndex;
      const young = now - entry.appliedAt < window.maxAgeMs;
      if (amongNewest || young) {
        kept.push(entry);
      } else {
        logKeys.delete(entryStampKey(entry.stamp));
      }
    }
    if (kept.length === log.length) {
      return;
    }
    truncated = true;
    log.length = 0;
    log.push(...kept);
  };

  const remember = (entry: StoredLogEntry, advanceVector: boolean): void => {
    logKeys.add(entryStampKey(entry.stamp));
    if (advanceVector) {
      tryAdvanceVector(entry.stamp);
    }
    localStamp = {
      version: Math.max(localStamp.version + 1, clock),
      runtimeId: entry.stamp.runtimeId,
    };
    evict(entry.appliedAt);
  };

  const appendOrInsert = (entry: StoredLogEntry, index: number, advanceVector: boolean): void => {
    if (index === log.length) {
      log.push(entry);
    } else {
      log.splice(index, 0, entry);
    }
    remember(entry, advanceVector);
  };

  const advanceClock = (seq: number): void => {
    if (seq > clock) {
      clock = seq;
    }
  };

  return {
    get stamp(): SyncStamp {
      return localStamp;
    },

    get clock(): number {
      return clock;
    },

    get vector(): Readonly<Record<string, number>> {
      return Object.fromEntries(vector);
    },

    get log(): readonly ReconcilerLogEntry[] {
      return log.map(({ stamp, command, patch }) => ({ stamp, command, patch }));
    },

    has(stamp: EntryStamp): boolean {
      return hasStamp(stamp);
    },

    advanceLocal(runtimeId: string, authored: AuthoredEntry): EntryStamp {
      const stamp: EntryStamp = {
        seq: clock + 1,
        runtimeId,
        counter: vectorOf(runtimeId) + 1,
      };
      advanceClock(stamp.seq);
      const now = Date.now();
      const entry: StoredLogEntry = {
        stamp,
        command: authored.command,
        patch: [...authored.patch],
        inverse: [...authored.inverse],
        appliedAt: now,
      };
      appendOrInsert(entry, log.length, true);
      return stamp;
    },

    tryAdopt(incoming: SyncStamp, state: Record<string, unknown>): boolean {
      advanceClock(incoming.version);
      if (!isNewer(incoming, localStamp)) {
        return false;
      }

      localStamp = { version: incoming.version, runtimeId: incoming.runtimeId };
      snapshotSeq = incoming.version;
      logKeys.clear();
      log.length = 0;
      truncated = false;
      setState((current) => applyStatePatch(current, state, { preserveMissingKeys: false }));

      return true;
    },

    tryAdoptEntry(incoming: AdoptEntryInput): boolean {
      const { serviceId, stamp, command, patch } = incoming;
      const key = entryStampKey(stamp);

      advanceClock(stamp.seq);

      if (
        hasStamp(stamp) ||
        stamp.counter <= vectorOf(stamp.runtimeId) ||
        stamp.seq <= snapshotSeq
      ) {
        return false;
      }

      // log[0] is a window floor only after eviction; until then an earlier stamp inserts at 0.
      if (truncated && log.length > 0 && compareStamps(stamp, log[0].stamp) < 0) {
        logger.warn(
          `Open-service sync: entry beyond the log window. service=${serviceId} stamps=${key},${entryStampKey(log[0].stamp)} paths=${patchPaths(patch)} command=${command}`
        );
        return false;
      }

      const gap = stamp.counter > vectorOf(stamp.runtimeId) + 1;
      const index = insertIndexFor(stamp);
      if (index < log.length && compareStamps(log[index].stamp, stamp) === 0) {
        return false;
      }

      const now = Date.now();
      let failedPath: string | undefined;
      let stored: StoredLogEntry | undefined;

      setState((current) => {
        const isLater = index === log.length;
        const undone = isLater ? [] : undoToIndex(current, index, serviceId);
        const result = applyOps(current, patch, (path) => {
          logger.debug(
            `Open-service sync: remove of missing key. service=${serviceId} stamp=${key} path=${path} command=${command}`
          );
        });
        if (!result.ok) {
          failedPath = result.path;
          redoUndone(current, undone, serviceId);
          return;
        }
        stored = {
          stamp,
          command,
          patch: [...patch],
          inverse: result.inverse,
          appliedAt: now,
        };
        redoUndone(current, undone, serviceId);
      });

      if (failedPath !== undefined) {
        logger.warn(
          `Open-service sync: missing parent while applying entry. service=${serviceId} stamp=${key} path=${failedPath} command=${command}`
        );
        return false;
      }

      if (!stored) {
        return false;
      }

      appendOrInsert(stored, index, !gap);
      return true;
    },
  };
}
