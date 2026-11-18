/**
 * Sync primitives for the open-service multi-master protocol: the per-service reconciler (ordered
 * Log, Vector, Clock, snapshot install), vector domination, and `applyStatePatch`, the structural
 * merge for snapshots and static JSON. The rules are in the README's State Sync section; the
 * transport that moves entries and snapshots is `service-transport.ts`.
 */

import { logger } from 'storybook/internal/client-logger';

import { applyJsonPatch } from './json-patch.ts';
import { clonePlain, hasOwn, isPlainObject } from './plain-object.ts';
import {
  entryStampKey,
  type EntryPayload,
  type EntryStamp,
  type JsonPatchOperation,
  type SyncFrontier,
} from './service-channel.ts';

export const DEFAULT_LOG_MAX_AGE_MS = 15_000;
export const DEFAULT_LOG_MAX_ENTRIES = 256;

export type LogWindow = {
  maxAgeMs: number;
  maxEntries: number;
};

export type InstallOutcome = 'installed' | 'concurrent' | 'not-ahead';

export type PlaceEntryOutcome = 'accepted' | 'gap' | 'unapplied' | 'duplicate' | 'beyond-window';

function vectorCounter(vector: Record<string, number>, runtimeId: string): number {
  return vector[runtimeId] ?? 0;
}

function isEmptyVector(vector: Record<string, number>): boolean {
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

function vectorsEqual(left: Record<string, number>, right: Record<string, number>): boolean {
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
 * field changed. This helper instead walks both objects and mutates `target` only where values
 * differ:
 *
 * - Recurses into plain objects so nested deep-signal subscriptions stay attached.
 * - Replaces arrays wholesale, matching the sync contract that arrays are values rather than maps.
 * - Assigns primitives only when changed to avoid spurious signal invalidation.
 * - Copies `source` through `clonePlain` first, like every other value on its way into state, so
 *   untrusted channel payloads and static files cannot pollute prototypes or write deepsignal's
 *   `$` accessors, and state never shares an object with the payload.
 *
 * The `preserveMissingKeys` mode selects the source contract:
 *
 * - `false` means `source` is a full peer snapshot. Keys missing from `source` are deleted from
 *   `target`, allowing deletions to propagate through cross-peer sync.
 * - `true` means `source` is a partial static snapshot. Keys missing from `source` are left alone
 *   so snapshots for one static query input do not erase state populated by other inputs.
 */
export function applyStatePatch(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  options: { preserveMissingKeys: boolean }
): void {
  mergeInto(target, clonePlain(source) as Record<string, unknown>, options.preserveMissingKeys);
}

function mergeInto(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  preserveMissingKeys: boolean
): void {
  if (!preserveMissingKeys) {
    for (const key of Object.keys(target)) {
      if (!hasOwn(source, key)) {
        delete target[key];
      }
    }
  }

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      mergeInto(targetValue, sourceValue, preserveMissingKeys);
    } else if (targetValue !== sourceValue) {
      target[key] = sourceValue;
    }
  }
}

/** In-place mutation of a runtime's live state object, as exposed by the runtime's `applyLocal`. */
export type StateMutator = (state: Record<string, unknown>) => void;

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
 * It owns the Clock, the per-writer Vector, and the ordered Log. The entry author calls
 * {@link Reconciler.advanceLocal} before emitting. Incoming entries go through
 * {@link Reconciler.tryPlaceEntry}. Incoming snapshot replies go through
 * {@link Reconciler.tryInstall}.
 */
export type Reconciler = {
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
   * Installs a snapshot only if `frontier.vector` dominates the local vector; `concurrent` and
   * `not-ahead` leave state untouched. A hub forwards the reply only when `installed`.
   */
  tryInstall(frontier: SyncFrontier, state: Record<string, unknown>): InstallOutcome;
  /**
   * Places an incoming entry into the Log. `accepted`, `gap`, and `unapplied` mean it was logged. A hub
   * forwards the original payload for those and for a first-time `beyond-window`, so a hub that
   * cannot place an entry does not hide it from peers that can; a redelivery of a dropped stamp
   * is `duplicate`. `gap`, `beyond-window`, and `unapplied` mean the transport should send
   * `sync-request`. An `unapplied` entry failed to apply and is kept as a no-op, so every replica
   * folds the same stamps; the request repairs a parent that was lost rather than late.
   */
  tryPlaceEntry(incoming: EntryPayload): PlaceEntryOutcome;
};

/**
 * Builds a {@link Reconciler} bound to one runtime's state.
 *
 * `setState` is the runtime's `applyLocal` adapted to a plain record, so placing and installing never
 * author an entry. `serviceId` names the service in warnings. `window` bounds the Log.
 */
export function createReconciler(options: {
  serviceId: string;
  setState: (mutate: StateMutator) => void;
  window?: Partial<LogWindow>;
}): Reconciler {
  const { serviceId, setState } = options;
  const logWindow: LogWindow = {
    maxAgeMs: options.window?.maxAgeMs ?? DEFAULT_LOG_MAX_AGE_MS,
    maxEntries: options.window?.maxEntries ?? DEFAULT_LOG_MAX_ENTRIES,
  };
  let clock = 0;
  let snapshotSeq = 0;
  const vector = new Map<string, number>();
  const log: StoredLogEntry[] = [];
  const logKeys = new Set<string>();
  // Stamps dropped as beyond-window, so a redelivery is a duplicate and a hub forwards each
  // dropped stamp once. Cleared on install because install moves both floors. Not bounded: two hubs
  // that each forget a stamp they dropped bounce it between them forever.
  const dropped = new Set<string>();
  let floor: EntryStamp | undefined;

  const vectorRecord = (): Record<string, number> => Object.fromEntries(vector);

  const vectorOf = (runtimeId: string): number => vector.get(runtimeId) ?? 0;

  const hasStamp = (stamp: EntryStamp): boolean => logKeys.has(entryStampKey(stamp));

  const silentMissingRemove = (): void => undefined;

  const patchPaths = (patch: readonly JsonPatchOperation[]): string =>
    patch.map((operation) => operation.path).join(',');

  const undoEntry = (current: Record<string, unknown>, entry: StoredLogEntry): void => {
    const result = applyJsonPatch(current, entry.inverse, silentMissingRemove);
    if (!result.ok) {
      logger.warn(
        `Open-service sync: undo failed. service=${serviceId} stamp=${entryStampKey(entry.stamp)} path=${result.path} command=${entry.command}`
      );
    }
  };

  const redoEntry = (current: Record<string, unknown>, entry: StoredLogEntry): void => {
    const result = applyJsonPatch(current, entry.patch, silentMissingRemove);
    entry.inverse = result.ok ? result.inverse : [];
    if (!result.ok) {
      logger.warn(
        `Open-service sync: replay failed. service=${serviceId} stamp=${entryStampKey(entry.stamp)} path=${result.path} command=${entry.command}`
      );
    }
  };

  const undoToIndex = (current: Record<string, unknown>, index: number): StoredLogEntry[] => {
    const undone: StoredLogEntry[] = [];
    for (let cursor = log.length - 1; cursor >= index; cursor -= 1) {
      const entry = log[cursor];
      undoEntry(current, entry);
      undone.push(entry);
    }
    return undone;
  };

  const redoUndone = (current: Record<string, unknown>, undone: StoredLogEntry[]): void => {
    for (let cursor = undone.length - 1; cursor >= 0; cursor -= 1) {
      redoEntry(current, undone[cursor]);
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
    const minKeepIndex = Math.max(0, log.length - logWindow.maxEntries);
    const kept: StoredLogEntry[] = [];
    for (let index = 0; index < log.length; index += 1) {
      const entry = log[index];
      const amongNewest = index >= minKeepIndex;
      const young = now - entry.appliedAt < logWindow.maxAgeMs;
      if (amongNewest || young) {
        kept.push(entry);
      } else {
        logKeys.delete(entryStampKey(entry.stamp));
        if (floor === undefined || compareStamps(entry.stamp, floor) > 0) {
          floor = entry.stamp;
        }
      }
    }
    if (kept.length === log.length) {
      return;
    }
    log.length = 0;
    log.push(...kept);
  };

  const remember = (entry: StoredLogEntry): void => {
    logKeys.add(entryStampKey(entry.stamp));
    tryAdvanceVector(entry.stamp);
    evict(entry.appliedAt);
  };

  const appendOrInsert = (entry: StoredLogEntry, index: number): void => {
    if (index === log.length) {
      log.push(entry);
    } else {
      log.splice(index, 0, entry);
    }
    remember(entry);
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
      appendOrInsert(entry, log.length);
      return stamp;
    },

    tryInstall(frontier: SyncFrontier, state: Record<string, unknown>): InstallOutcome {
      // Before the dominance check: a runtime that cannot install this reply still learns how far
      // the replier's clock got, so its next write does not stamp below the replier's history.
      advanceClock(frontier.clock);
      const localVector = vectorRecord();
      if (!vectorDominates(frontier.vector, localVector)) {
        return vectorsConcurrent(frontier.vector, localVector) ? 'concurrent' : 'not-ahead';
      }

      // The floor is this reply's clock: after install the state is the replier's fold, so an entry
      // above it sorts after everything in it, even when the local clock is higher.
      snapshotSeq = frontier.clock;

      // An uncovered entry at or below the reply clock belongs inside the snapshot's history,
      // which is not in the Log, so it cannot be placed: same rule as a delayed arrival.
      const remaining: StoredLogEntry[] = [];
      for (const entry of log) {
        if (entry.stamp.counter <= vectorCounter(frontier.vector, entry.stamp.runtimeId)) {
          continue;
        }
        if (entry.stamp.seq <= frontier.clock) {
          logger.warn(
            `Open-service sync: uncovered entry at or below the reply clock dropped on install. service=${serviceId} stamp=${entryStampKey(entry.stamp)} clock=${frontier.clock} paths=${patchPaths(entry.patch)} command=${entry.command}`
          );
          continue;
        }
        remaining.push(entry);
      }

      setState((current) => {
        applyStatePatch(current, state, { preserveMissingKeys: false });

        logKeys.clear();
        dropped.clear();
        log.length = 0;
        floor = undefined;
        // Dominance guarantees every reply counter is at least the local one, so the reply vector
        // can replace ours; re-applying the uncovered entries below adds back the writers it lacks.
        vector.clear();
        for (const [runtimeId, counter] of Object.entries(frontier.vector)) {
          if (counter > 0) {
            vector.set(runtimeId, counter);
          }
        }

        for (const entry of remaining) {
          const replayed: StoredLogEntry = { ...entry };
          redoEntry(current, replayed);
          log.push(replayed);
          remember(replayed);
        }
      });

      return 'installed';
    },

    tryPlaceEntry(incoming: EntryPayload): PlaceEntryOutcome {
      const { stamp, command, patch } = incoming;
      const key = entryStampKey(stamp);

      advanceClock(stamp.seq);

      if (hasStamp(stamp) || dropped.has(key) || stamp.counter <= vectorOf(stamp.runtimeId)) {
        return 'duplicate';
      }

      // Eviction is not a prefix cut: an old entry in the middle can go while a younger entry with
      // a lower stamp stays, so the window floor is the newest evicted stamp, not log[0].
      if (stamp.seq <= snapshotSeq || (floor && compareStamps(stamp, floor) <= 0)) {
        const floorLabel = floor ? `,${entryStampKey(floor)}` : '';
        logger.warn(
          `Open-service sync: entry beyond the log window. service=${serviceId} stamps=${key}${floorLabel} paths=${patchPaths(patch)} command=${command}`
        );
        dropped.add(key);
        return 'beyond-window';
      }

      const gap = stamp.counter > vectorOf(stamp.runtimeId) + 1;
      const index = insertIndexFor(stamp);

      const now = Date.now();
      let failedPath: string | undefined;

      setState((current) => {
        let inverse: JsonPatchOperation[] = [];
        const isLater = index === log.length;
        const undone = isLater ? [] : undoToIndex(current, index);
        const result = applyJsonPatch(current, patch, (path) => {
          logger.debug(
            `Open-service sync: remove of missing key. service=${serviceId} stamp=${key} path=${path} command=${command}`
          );
        });
        if (result.ok) {
          inverse = result.inverse;
        } else {
          failedPath = result.path;
        }
        redoUndone(current, undone);
        // Inside the batch: subscribers run when it ends and may throw, after state has changed.
        appendOrInsert({ stamp, command, patch: [...patch], inverse, appliedAt: now }, index);
      });

      // A failed entry stays in the Log as a no-op, so every replica folds the same entries in the
      // same order. An earlier insert that supplies the parent makes it apply on redo.
      if (failedPath !== undefined) {
        logger.warn(
          `Open-service sync: entry did not apply, kept as a no-op. service=${serviceId} stamp=${key} path=${failedPath} command=${command}`
        );
      }

      if (gap) {
        logger.warn(
          `Open-service sync: gap in writer counters. service=${serviceId} stamps=${key} paths=${patchPaths(patch)} command=${command}`
        );
      }

      return gap ? 'gap' : failedPath !== undefined ? 'unapplied' : 'accepted';
    },
  };
}
