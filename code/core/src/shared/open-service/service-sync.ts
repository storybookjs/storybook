/**
 * Shared sync primitives for the open-service multi-master protocol.
 *
 * Every runtime — server (Node), manager (top window), preview (iframe) — runs a full
 * `ServiceRuntime` and reconciles incoming state with the same two rules — last-write-wins ordering
 * and structural merge — so this module is the single source of truth for all of them. The
 * transport that moves snapshots on and off the channel lives in `service-transport.ts`, which every
 * `registerService` entrypoint drives through these primitives (see `service-transport-leaf.test.ts`
 * and `service-registration-sync.test.ts`).
 *
 * ## 1. `isNewer` — last-write-wins ordering
 *
 * Each synced snapshot carries a `(version, clientId)` stamp. `version` is a logical clock for the
 * state lineage: a runtime bumps it on every local command and adopts the incoming value when it
 * accepts a peer's snapshot. Equal versions mean concurrent writes; the lexicographically greater
 * `clientId` wins so every runtime independently converges on the same snapshot regardless of the
 * order events arrive in.
 *
 * Crucially, an *equal* stamp is **not** newer. That single fact is what makes the protocol
 * echo-safe and relay-safe: a snapshot a runtime already holds (its own broadcast bouncing back,
 * or a hub re-emitting an already-applied patch) fails `isNewer` and is dropped instead of
 * re-applied and re-broadcast, so update storms terminate.
 *
 * The stamp lives in the channel envelope, never inside the user state object. Service authors and
 * consumers never declare it, read it, or subscribe to it — whole-state-per-service LWW is a
 * documented semantic of the protocol, not a field anyone has to think about.
 *
 * ## 2. `applyStatePatch` — structural merge
 *
 * Applies incoming state onto the live state object in place so that deep-signal subscriptions only
 * re-fire for the fields that actually changed. Full peer snapshots delete keys absent from the
 * source so deletions propagate; partial static snapshots preserve missing keys. Arrays are replaced
 * wholesale, primitives are assigned only when changed, and the dangerous
 * `__proto__`/`constructor`/`prototype` keys are skipped on both read and delete so hostile payloads
 * cannot pollute the prototype chain.
 */

/** Per-service last-write-wins stamp carried alongside every synced snapshot. */
export type SyncStamp = {
  /** Logical clock for the state lineage. Bumped on every local command, adopted on accept. */
  version: number;
  /** Id of the runtime that produced this version; the deterministic tiebreak for equal versions. */
  clientId: string;
};

/**
 * Returns whether `incoming` should replace `local` under last-write-wins ordering.
 *
 * Higher `version` always wins. At an equal version (concurrent writes) the lexicographically
 * greater `clientId` wins so every runtime picks the same winner. An equal stamp is **not** newer —
 * that is precisely what makes echoes and relayed re-broadcasts terminate rather than loop.
 */
export function isNewer(incoming: SyncStamp, local: SyncStamp): boolean {
  if (incoming.version !== local.version) {
    return incoming.version > local.version;
  }

  return incoming.clientId > local.clientId;
}

/** Keys never copied from an untrusted payload, to block prototype-pollution. */
const FORBIDDEN_KEYS = new Set<string>(['__proto__', 'constructor', 'prototype']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

      if (!Object.prototype.hasOwnProperty.call(source, key)) {
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
    const targetValue = target[key];

    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      applyStatePatch(targetValue, sourceValue, options);
    } else if (targetValue !== sourceValue) {
      target[key] = sourceValue;
    }
  }
}

/** In-place mutation of a runtime's live state object, as exposed by `commandSelf.setState`. */
export type StateMutator = (state: Record<string, unknown>) => void;

/**
 * The per-service reconciler shared by every runtime's channel integration.
 *
 * It owns the last-write-wins stamp and exposes the only two stamp transitions the protocol allows:
 * advancing for a locally authored change, and adopting a strictly-newer peer snapshot. Centralizing
 * this here is deliberate — the client and server transports used to each carry their own copy of
 * the merge logic, which is exactly how they could silently drift apart.
 */
export type SnapshotReconciler = {
  /** The current local stamp (read for sync-start-reply / broadcast envelopes). */
  readonly stamp: SyncStamp;
  /**
   * Records a locally authored change: bumps `version` and re-stamps with `clientId`. Call this
   * before broadcasting so the broadcast's own echo is recognized as not-newer and dropped.
   */
  advanceLocal(clientId: string): SyncStamp;
  /**
   * Adopts an incoming snapshot iff it is strictly newer (LWW). Returns whether it was adopted, so
   * relay hubs can re-broadcast only on a real advance.
   */
  tryAdopt(incoming: SyncStamp, state: Record<string, unknown>): boolean;
};

/**
 * Builds a {@link SnapshotReconciler} bound to one runtime's state.
 *
 * @param setState - The runtime's batched in-place mutator (`commandSelf.setState`), adapted to a
 *   plain record. Adopting goes through this rather than the wrapped commands so it never triggers
 *   a re-broadcast.
 * @param initialStamp - Starting stamp, typically `{ version: 0, clientId: <own id> }`.
 */
export function createSnapshotReconciler(options: {
  setState: (mutate: StateMutator) => void;
  initialStamp: SyncStamp;
}): SnapshotReconciler {
  const { setState, initialStamp } = options;
  let localStamp = initialStamp;

  return {
    get stamp(): SyncStamp {
      return localStamp;
    },

    advanceLocal(clientId: string): SyncStamp {
      localStamp = { version: localStamp.version + 1, clientId };
      return localStamp;
    },

    tryAdopt(incoming: SyncStamp, state: Record<string, unknown>): boolean {
      if (!isNewer(incoming, localStamp)) {
        return false;
      }

      localStamp = { version: incoming.version, clientId: incoming.clientId };
      setState((current) => applyStatePatch(current, state, { preserveMissingKeys: false }));

      return true;
    },
  };
}
