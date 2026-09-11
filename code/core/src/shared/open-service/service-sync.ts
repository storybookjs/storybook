/**
 * Shared sync primitives for the open-service multi-master protocol.
 *
 * Every runtime — server (Node), manager (top window), preview (iframe) — runs a full
 * `ServiceRuntime` and reconciles incoming state here. Command broadcasts carry a Lamport stamp
 * `{ seq, runtimeId, counter }` and an RFC 6902 patch. Each replica keeps an ordered Log, a
 * per-writer Vector, and a Clock. Snapshots are bootstrap and repair only. The transport that
 * moves entries and snapshots lives in `service-transport.ts`.
 *
 * ## 1. Entries — Clock, Vector, ordered Log
 *
 * Each `services:entry` carries `{ seq, runtimeId, counter }`. `seq` is the Lamport order key.
 * One comparator orders the Log ascending on `seq`, then on `runtimeId` by plain string
 * comparison. Incoming cases, in order: duplicate (in the Log, or counter at or below the Vector)
 * drops but still advances the Clock; later appends; earlier undoes newest-first, applies, and
 * redoes from stored forward ops inside one `setState` batch; a gap still places but does not
 * advance the Vector, and warns; beyond-window (sorts before the oldest retained entry, or `seq`
 * at or below the last installed frontier clock) drops and warns. Gap, beyond-window, and
 * missing-parent all ask the transport to send `sync-request`. The Vector never evicts. Log
 * eviction is lazy on append: an entry is retained while younger than 15 s or among the newest 256.
 *
 * ## 2. Snapshots — Frontier install
 *
 * A `services:sync-reply` carries `{ frontier: { vector, clock }, state }`. Install iff the
 * reply's vector dominates the replica's: every counter at least equal, at least one greater, or
 * the replica's vector is empty and the reply's is not. Inside one `setState` batch: merge
 * `state` onto the live proxy; `clock = max(clock, reply.clock)`; take the reply's vector;
 * drop log entries that vector covers; re-apply the rest in canonical order, recomputing
 * inverses (which also fills in writers the snapshot lacked). Keep the installed clock as
 * an ordering floor so a delayed concurrent entry at or below that clock cannot apply over
 * snapshot state. A concurrent reply — each side has writes the other lacks — is dropped with a
 * warning naming both frontiers.
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
import {
  entryStampKey,
  type EntryStamp,
  type JsonPatchOperation,
  type SyncFrontier,
} from './service-channel.ts';

export const DEFAULT_LOG_MAX_AGE_MS = 15_000;
export const DEFAULT_LOG_MAX_ENTRIES = 256;

export type { SyncFrontier };

export type LogWindow = {
  maxAgeMs: number;
  maxEntries: number;
};

export type AdoptEntryOutcome =
  | 'accepted'
  | 'gap'
  | 'duplicate'
  | 'beyond-window'
  | 'missing-parent';

function vectorCounter(vector: Record<string, number>, runtimeId: string): number {
  return vector[runtimeId] ?? 0;
}

export function isEmptyVector(vector: Record<string, number>): boolean {
  for (const value of Object.values(vector)) {
    if (value > 0) {
      return false;
    }
  }
  return true;
}

/**
 * Returns whether `left` dominates `right`.
 *
 * Every counter in `left` is at least the matching counter in `right`, and at least one is
 * greater. An empty `right` is dominated by any non-empty `left`, so a fresh joiner hears from
 * every peer that has writes. Two empty vectors do not dominate each other.
 */
export function vectorDominates(
  left: Record<string, number>,
  right: Record<string, number>
): boolean {
  if (isEmptyVector(right)) {
    return !isEmptyVector(left);
  }

  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  let greater = false;
  for (const key of keys) {
    const leftCount = vectorCounter(left, key);
    const rightCount = vectorCounter(right, key);
    if (leftCount < rightCount) {
      return false;
    }
    if (leftCount > rightCount) {
      greater = true;
    }
  }
  return greater;
}

export function vectorsEqual(left: Record<string, number>, right: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (vectorCounter(left, key) !== vectorCounter(right, key)) {
      return false;
    }
  }
  return true;
}

export function vectorsConcurrent(
  left: Record<string, number>,
  right: Record<string, number>
): boolean {
  return (
    !vectorDominates(left, right) && !vectorDominates(right, left) && !vectorsEqual(left, right)
  );
}

export function formatFrontier(frontier: SyncFrontier): string {
  const keys = Object.keys(frontier.vector).sort();
  const body = keys.map((key) => `${key}:${frontier.vector[key]}`).join(',');
  return `{clock:${frontier.clock} vector:{${body}}}`;
}

/**
 * Canonical entry order: ascending `seq`, then ascending `runtimeId` with plain string comparison.
 *
 * "Later in the log", "greater stamp", and "wins the path" coincide.
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
    for (const key of Object.keys(target)) {
      if (FORBIDDEN_KEYS.has(key)) {
        continue;
      }

      if (!hasOwn(source, key)) {
        delete target[key];
      }
    }
  }

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
 * It owns the Clock, the per-writer Vector, and the ordered Log. Local commands call
 * {@link SnapshotReconciler.advanceLocal} before emitting. Incoming entries go through
 * {@link SnapshotReconciler.tryAdoptEntry}. Incoming snapshot replies go through
 * {@link SnapshotReconciler.tryAdopt}.
 */
export type SnapshotReconciler = {
  /** Lamport high-water mark. Moves on incoming stamps (including duplicates) and on install. */
  readonly clock: number;
  /** Per-writer highest contiguous counter applied. */
  readonly vector: Readonly<Record<string, number>>;
  /** `{ vector, clock }` copied for request and reply envelopes. */
  readonly frontier: SyncFrontier;
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
   * Installs a snapshot iff `frontier.vector` dominates the local vector. Concurrent replies
   * warn and return false. Raises an installed-frontier ordering floor to the installed clock
   * so later uncovered arrivals at or below that clock are beyond-window. Returns whether
   * state was installed, so a hub forwards only then.
   */
  tryAdopt(frontier: SyncFrontier, state: Record<string, unknown>, serviceId: string): boolean;
  /**
   * Places an incoming entry into the Log. `accepted` and `gap` mean it was logged, so a hub
   * forwards the original payload. `gap`, `beyond-window`, and `missing-parent` mean the
   * transport should send `sync-request`.
   */
  tryAdoptEntry(incoming: AdoptEntryInput): AdoptEntryOutcome;
};

/**
 * Builds a {@link SnapshotReconciler} bound to one runtime's state.
 *
 * @param setState - The runtime's batched in-place mutator (`commandSelf.setState`), adapted to a
 *   plain record. Adopting goes through this rather than the wrapped commands so it never triggers
 *   a re-broadcast.
 */
export function createSnapshotReconciler(options: {
  setState: (mutate: StateMutator) => void;
  window?: Partial<LogWindow>;
}): SnapshotReconciler {
  const { setState } = options;
  const window: LogWindow = {
    maxAgeMs: options.window?.maxAgeMs ?? DEFAULT_LOG_MAX_AGE_MS,
    maxEntries: options.window?.maxEntries ?? DEFAULT_LOG_MAX_ENTRIES,
  };
  let clock = 0;
  let snapshotSeq = 0;
  const vector = new Map<string, number>();
  const log: StoredLogEntry[] = [];
  const logKeys = new Set<string>();
  let truncated = false;

  const vectorRecord = (): Record<string, number> => Object.fromEntries(vector);

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
    get clock(): number {
      return clock;
    },

    get vector(): Readonly<Record<string, number>> {
      return vectorRecord();
    },

    get frontier(): SyncFrontier {
      return { vector: vectorRecord(), clock };
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

    tryAdopt(frontier: SyncFrontier, state: Record<string, unknown>, serviceId: string): boolean {
      const localVector = vectorRecord();
      if (!vectorDominates(frontier.vector, localVector)) {
        if (vectorsConcurrent(frontier.vector, localVector)) {
          logger.warn(
            `Open-service sync: concurrent snapshot reply dropped. service=${serviceId} local=${formatFrontier({ vector: localVector, clock })} reply=${formatFrontier(frontier)}`
          );
        }
        return false;
      }

      advanceClock(frontier.clock);
      snapshotSeq = Math.max(snapshotSeq, clock);

      const remaining = log.filter(
        (entry) => entry.stamp.counter > vectorCounter(frontier.vector, entry.stamp.runtimeId)
      );

      setState((current) => {
        applyStatePatch(current, state, { preserveMissingKeys: false });

        logKeys.clear();
        log.length = 0;
        truncated = false;
        vector.clear();
        for (const [runtimeId, counter] of Object.entries(frontier.vector)) {
          if (counter > 0) {
            vector.set(runtimeId, counter);
          }
        }

        for (const entry of remaining) {
          const result = applyOps(current, entry.patch, silentMissingRemove);
          if (!result.ok) {
            logger.warn(
              `Open-service sync: replay failed. service=${serviceId} stamp=${entryStampKey(entry.stamp)} path=${result.path} command=${entry.command}`
            );
            continue;
          }
          const stored: StoredLogEntry = {
            stamp: entry.stamp,
            command: entry.command,
            patch: entry.patch,
            inverse: result.inverse,
            appliedAt: entry.appliedAt,
          };
          log.push(stored);
          logKeys.add(entryStampKey(entry.stamp));
          tryAdvanceVector(entry.stamp);
        }
      });

      return true;
    },

    tryAdoptEntry(incoming: AdoptEntryInput): AdoptEntryOutcome {
      const { serviceId, stamp, command, patch } = incoming;
      const key = entryStampKey(stamp);

      advanceClock(stamp.seq);

      if (hasStamp(stamp) || stamp.counter <= vectorOf(stamp.runtimeId)) {
        return 'duplicate';
      }

      if (
        stamp.seq <= snapshotSeq ||
        (truncated && log.length > 0 && compareStamps(stamp, log[0].stamp) < 0)
      ) {
        const floor = log.length > 0 ? `,${entryStampKey(log[0].stamp)}` : '';
        logger.warn(
          `Open-service sync: entry beyond the log window. service=${serviceId} stamps=${key}${floor} paths=${patchPaths(patch)} command=${command}`
        );
        return 'beyond-window';
      }

      const gap = stamp.counter > vectorOf(stamp.runtimeId) + 1;
      const index = insertIndexFor(stamp);
      if (index < log.length && compareStamps(log[index].stamp, stamp) === 0) {
        return 'duplicate';
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
        return 'missing-parent';
      }

      if (!stored) {
        return 'duplicate';
      }

      if (gap) {
        logger.warn(
          `Open-service sync: gap in writer counters. service=${serviceId} stamps=${key} paths=${patchPaths(patch)} command=${command}`
        );
      }

      appendOrInsert(stored, index, !gap);
      return gap ? 'gap' : 'accepted';
    },
  };
}
