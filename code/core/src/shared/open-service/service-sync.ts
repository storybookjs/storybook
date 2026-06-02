/**
 * Shared sync primitives for the open-service multi-master protocol.
 *
 * Every runtime — server (Node), manager (top window), preview (iframe) — runs a full
 * `ServiceRuntime` and reconciles incoming state with the same two rules, so this module is the
 * single source of truth for all of them. The transport that moves snapshots on and off the channel
 * lives in `service-transport.ts`, which both the client (`service-client.ts`) and the server
 * (`service-registration.ts`) drive through these primitives (replacing the `deepAssign` that used
 * to be duplicated in each).
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
 * ## 2. `deepReconcile` — structural merge
 *
 * Applies a received snapshot onto the live state object in place so that deep-signal subscriptions
 * only re-fire for the fields that actually changed. Keys absent from the source are deleted (so
 * deletions propagate), arrays are replaced wholesale, primitives are assigned only when changed,
 * and the dangerous `__proto__`/`constructor`/`prototype` keys are skipped on both read and delete
 * so a hostile channel payload cannot pollute the prototype chain.
 *
 * ## 3. `validateSyncedState` — interop boundary
 *
 * When a service declares a `state` schema, every received snapshot is validated against it before
 * it is allowed to touch local state. Channel payloads are untrusted input; a peer that sends state
 * violating the contract must never be able to corrupt this runtime (and, on a relay hub, must
 * never be forwarded to other peers). Validation is synchronous on this hot path — an async schema
 * is treated as a misconfiguration and the snapshot is dropped.
 */

import type { AnySchema } from './types.ts';

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

/** Shape of a validated `services:patches` / `services:welcome-reply` payload. */
export type StampedSnapshot = {
  serviceId: string;
  state: Record<string, unknown>;
  version: number;
  clientId: string;
};

/**
 * Narrows an untrusted patches/welcome-reply payload to a known shape before any field is trusted.
 *
 * Returns the typed payload, or `null` when it is malformed. Channel traffic is untrusted input, so
 * every field is checked (and `state` must be a plain object) before the snapshot is applied — and,
 * on a relay hub, before it is forwarded to other peers.
 */
export function parseStampedSnapshot(payload: unknown): StampedSnapshot | null {
  if (!isPlainObject(payload)) {
    return null;
  }

  const { serviceId, state, version, clientId } = payload;

  if (
    typeof serviceId !== 'string' ||
    typeof version !== 'number' ||
    typeof clientId !== 'string' ||
    !isPlainObject(state)
  ) {
    return null;
  }

  return { serviceId, state, version, clientId };
}

/** Shape of a validated `services:welcome-request` payload. */
export type WelcomeRequest = {
  serviceId: string;
  clientId: string;
};

/** Narrows an untrusted welcome-request payload, returning `null` when malformed. */
export function parseWelcomeRequest(payload: unknown): WelcomeRequest | null {
  if (!isPlainObject(payload)) {
    return null;
  }

  const { serviceId, clientId } = payload;

  if (typeof serviceId !== 'string' || typeof clientId !== 'string') {
    return null;
  }

  return { serviceId, clientId };
}

/**
 * Deep-merges `source` onto `target` in place.
 *
 * - Recurses into plain objects so nested deep-signal subscriptions stay intact and only changed
 *   leaves notify.
 * - Deletes keys present in `target` but absent from `source` so deletions propagate between peers
 *   (the old additive-only merge could never remove a key).
 * - Replaces arrays wholesale and assigns primitives directly, writing only when the value actually
 *   changed to avoid spurious signal invalidation.
 * - Skips `__proto__`/`constructor`/`prototype` on both the delete and the assign pass so a
 *   malicious payload cannot walk up the prototype chain.
 */
export function deepReconcile(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): void {
  // Remove keys the source no longer carries (deletion propagation).
  for (const key of Object.keys(target)) {
    if (FORBIDDEN_KEYS.has(key)) {
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      delete target[key];
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
      deepReconcile(targetValue, sourceValue);
    } else if (targetValue !== sourceValue) {
      target[key] = sourceValue;
    }
  }
}

/**
 * Validates a received state snapshot against the service's optional `state` schema.
 *
 * Returns the validated snapshot, or `null` when validation cannot pass so the caller drops the
 * snapshot instead of corrupting (or relaying) bad state. A service without a `state` schema opts
 * out of validation and the snapshot is returned unchanged.
 *
 * Validation runs on the synchronous reconcile path, so a schema that returns a Promise is a
 * misconfiguration and the snapshot is dropped rather than silently applied unvalidated.
 */
export function validateSyncedState(
  schema: AnySchema | undefined,
  state: Record<string, unknown>
): Record<string, unknown> | null {
  if (!schema) {
    return state;
  }

  const result = schema['~standard'].validate(state);

  if (result instanceof Promise || result.issues) {
    return null;
  }

  return result.value as Record<string, unknown>;
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
  /** The current local stamp (read for welcome-reply / broadcast envelopes). */
  readonly stamp: SyncStamp;
  /**
   * Records a locally authored change: bumps `version` and re-stamps with `clientId`. Call this
   * before broadcasting so the broadcast's own echo is recognized as not-newer and dropped.
   */
  advanceLocal(clientId: string): SyncStamp;
  /**
   * Adopts an incoming snapshot iff it is strictly newer (LWW) and passes the optional state
   * schema. Returns whether it was adopted, so relay hubs can re-broadcast only on a real advance.
   */
  tryAdopt(incoming: SyncStamp, state: Record<string, unknown>): boolean;
};

/**
 * Builds a {@link SnapshotReconciler} bound to one runtime's state.
 *
 * @param stateSchema - Optional schema; received snapshots are validated against it before applying.
 * @param setState - The runtime's batched in-place mutator (`commandSelf.setState`), adapted to a
 *   plain record. Adopting goes through this rather than the wrapped commands so it never triggers
 *   a re-broadcast.
 * @param initialStamp - Starting stamp, typically `{ version: 0, clientId: <own id> }`.
 */
export function createSnapshotReconciler(options: {
  stateSchema: AnySchema | undefined;
  setState: (mutate: StateMutator) => void;
  initialStamp: SyncStamp;
}): SnapshotReconciler {
  const { stateSchema, setState, initialStamp } = options;
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

      // Channel payloads are untrusted: validate against the state schema before touching state.
      const validated = validateSyncedState(stateSchema, state);

      if (!validated) {
        return false;
      }

      localStamp = { version: incoming.version, clientId: incoming.clientId };
      setState((current) => deepReconcile(current, validated));

      return true;
    },
  };
}
