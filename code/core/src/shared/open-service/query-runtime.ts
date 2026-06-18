/**
 * # query-runtime
 *
 * The synchronous query surface and the asynchronous `load` machinery for one registered service:
 * `.get()` / `.loaded()` / `.subscribe()`, the in-flight load registry, and the `.loaded()` drain
 * loop. Split out of `service-runtime.ts` (which assembles the full runtime — state signal, commands,
 * static loader) to keep each file focused.
 *
 * See `service-runtime.ts` for the end-to-end mental model and the dependency-tracking algorithm; the
 * functions referenced there (`runLoaded`, `buildLoadWrappedQueries`, `inFlightLoads`, `LoadedSession`)
 * all live here.
 */
import { computed, effect, signal, untracked } from '@preact/signals-core';
import { isEqual } from 'es-toolkit/predicate';

import {
  OpenServiceLoadedDrainExceededError,
  OpenServiceUnimplementedOperationError,
} from '../../server-errors.ts';
import { buildQueryState, toError } from './query-state.ts';
import type { QueryLifecycle } from './query-state.ts';
import { rethrowAsync, validateSchemaSync } from './service-validation.ts';
import type {
  AnySchema,
  CommandSelf,
  LoadCtx,
  LoadSelf,
  Query,
  QueryCtx,
  QueryDefinition,
  QuerySelf,
  QueryState,
  ServiceId,
  ServiceRegistryApi,
} from './types.ts';

export type RuntimeQueryDefinition<TState> = QueryDefinition<TState, AnySchema, AnySchema>;

/** The runtime's concrete query object, with input/output erased to `unknown`. */
type RuntimeQuery = Query<unknown, unknown>;
/** Max number of drain iterations before `.loaded()` gives up to avoid infinite oscillation. */
const MAX_DRAIN_ITERATIONS = 32;

/**
 * One pending load promise plus the load key that identifies it for cycle and dedup checks.
 *
 * The key is stored alongside the promise so collectors can be drained and marked settled in one
 * pass without re-deriving the key from the promise after the fact.
 */
type CollectorEntry = { key: string; promise: Promise<unknown> };

/**
 * State shared by every sync handler call inside one `.loaded()` invocation.
 *
 * The session tracks the set of load keys that are ancestors in the call chain (for cycle
 * detection), the loads collected during this iteration (waiting to be drained), and the load
 * keys that have already settled in this session so re-running the handler does not refire them.
 */
type LoadedSession = {
  ancestorChain: ReadonlySet<string>;
  collector: Set<CollectorEntry>;
  settledKeys: Set<string>;
};

/**
 * Process-global registry of in-flight `load` promises keyed by `${serviceId}::${queryName}::${hash}`.
 *
 * The dedup is in-flight only: once a load settles, its entry is removed so a subsequent call can
 * refire it. The same registry is consulted by both same-service and cross-service callers so two
 * queries that depend on the same dependency share one load.
 */
export const inFlightLoads = new Map<string, Promise<unknown>>();

/**
 * Active session for `.loaded()` while a sync handler is being re-run for dependency discovery.
 *
 * Default query functions consult this variable to know whether to register their load promise
 * into a caller-owned collector. Sync handlers don't `await`, so the variable is stable for the
 * duration of one handler call and can safely live at module scope.
 */
let activeHandlerLoadSession: LoadedSession | undefined;

const EMPTY_SET: ReadonlySet<string> = new Set();

/**
 * Returns a deterministic JSON encoding so the same logical input always produces the same key.
 *
 * Object keys are sorted recursively so `{a:1, b:2}` and `{b:2, a:1}` hash identically. Inputs are
 * expected to be JSON-safe; non-serializable values like `Date`, `Map`, or functions fall back to
 * `JSON.stringify`'s defaults and may produce ambiguous keys.
 */
function stableHash(value: unknown): string {
  return JSON.stringify(value, (_key, raw) => {
    if (raw === undefined) {
      // `JSON.stringify` would otherwise drop `undefined` from object values silently.
      return '__undefined__';
    }
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(raw as Record<string, unknown>).sort()) {
        sorted[k] = (raw as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return raw;
  });
}

export function makeLoadKey(
  serviceId: ServiceId,
  queryName: string,
  validatedInput: unknown
): string {
  return `${serviceId}::${queryName}::${stableHash(validatedInput)}`;
}
/**
 * Surfaces the first rejected settlement as the thrown error, aggregating the rest under `cause`.
 *
 * Drainers use `Promise.allSettled` so one rejected dependency does not prevent siblings from
 * finishing their work; this helper preserves all rejections without losing the primary one.
 */
function surfaceRejections(settlements: PromiseSettledResult<unknown>[]): void {
  const rejections = settlements.filter((s): s is PromiseRejectedResult => s.status === 'rejected');

  if (rejections.length === 0) {
    return;
  }

  const [first, ...rest] = rejections.map((r) => r.reason);

  if (rest.length > 0) {
    if (first instanceof Error) {
      const aggregated = Reflect.get(first, 'cause');

      if (aggregated === undefined) {
        try {
          Reflect.set(first, 'cause', { aggregated: rest });
        } catch {
          // Frozen errors keep their primary message; aggregated rejections are still observable
          // through the `rest` array if a caller decides to traverse it themselves.
        }
      }
    }
  }

  throw first;
}

/**
 * Drains a collector of pending load promises until no new entries appear.
 *
 * Each iteration snapshots the current entries, clears the collector, awaits them with
 * `Promise.allSettled`, marks their keys as settled (for caller bookkeeping), then loops if the
 * settled loads' bodies surfaced more entries. Caps at `MAX_DRAIN_ITERATIONS` to avoid hanging on
 * pathological oscillation.
 */
async function drainCollector(
  collector: Set<CollectorEntry>,
  settledKeys: Set<string> | undefined,
  serviceId: ServiceId,
  queryName: string
): Promise<void> {
  let iterations = 0;

  while (collector.size > 0) {
    if (iterations++ > MAX_DRAIN_ITERATIONS) {
      throw new OpenServiceLoadedDrainExceededError({
        serviceId,
        name: queryName,
        iterations: MAX_DRAIN_ITERATIONS,
      });
    }

    const pending = [...collector];
    collector.clear();

    const settlements = await Promise.allSettled(pending.map((entry) => entry.promise));

    if (settledKeys) {
      // Mark keys as settled even for rejected loads so the discovery loop does not refire them.
      for (const entry of pending) {
        settledKeys.add(entry.key);
      }
    }

    surfaceRejections(settlements);
  }
}
/**
 * Detaches a value from the reactive deep-signal proxy into a plain snapshot.
 *
 * Used for `selector` results on the subscription path: a selector can return a live proxy slice,
 * which we strip so consumers get plain, comparable data (and reads inside the `computed` register
 * only the fields the selector actually touched). Primitives pass through untouched.
 *
 * `structuredClone` cannot clone a `Proxy`, so this uses a JSON round-trip. That is sufficient
 * because open-service state is required to be JSON-serializable (the same constraint the
 * static-build pipeline relies on). For plain (already-detached) values such as the whole-state
 * snapshot, the runtime uses `structuredClone` directly instead.
 */
function detachSnapshot<TValue>(value: TValue): TValue {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as TValue;
}
/**
 * Captures the per-runtime data needed by query helpers that operate across multiple queries.
 *
 * Bundling the references lets `createDefaultQuery`, the load body wrapper, and `.loaded()` share
 * the same closure shape without each one re-deriving the per-service callbacks.
 */
export type QueryRuntimeRefs<TState> = {
  serviceId: ServiceId;
  commandSelf: CommandSelf<TState>;
  /** Deep reactive proxy backing this service's state; reads inside a computed track fine-grained. */
  state: TState;
  registryApi: ServiceRegistryApi;
  queryDefinitions: Map<string, RuntimeQueryDefinition<TState>>;
  defaultQueries: Record<string, Query<unknown, unknown>>;
  /**
   * Fire-and-forget query wrappers used inside reactive subscription load bodies so reading a
   * dependency keeps its load warm. Populated once the default queries exist (see
   * {@link buildReactiveLoadQueries}).
   */
  reactiveLoadQueries: Record<string, Query<unknown, unknown>>;
  /**
   * Returns the command map load bodies should call. After the runtime is wired to the channel this
   * is the channel-routed map, so a load can invoke a peer-implemented (remote) command; before that
   * (and in channel-free contexts like the static build) it is the raw local map.
   */
  getLoadCommands: () => CommandSelf<TState>['commands'];
  /**
   * Builds a command map whose `setState` writes are dropped once `isCurrent()` returns false.
   * Used by reactive subscription loads so a superseded (stale) re-run cannot overwrite the state
   * produced by a newer run. Remote commands are routed through the channel map unchanged, since they
   * carry no local `setState` to gate.
   */
  buildGatedCommands: (isCurrent: () => boolean) => CommandSelf<TState>['commands'];
};

/**
 * Validates query input synchronously, falling through to the dedicated async-schema error if a
 * schema returns a Promise.
 */
function validateQueryInput<TState>(
  refs: QueryRuntimeRefs<TState>,
  queryName: string,
  queryDef: RuntimeQueryDefinition<TState>,
  input: unknown
): unknown {
  return validateSchemaSync(queryDef.input, input, {
    kind: 'query',
    serviceId: refs.serviceId,
    name: queryName,
    phase: 'input',
  });
}

function validateQueryOutput<TState>(
  refs: QueryRuntimeRefs<TState>,
  queryName: string,
  queryDef: RuntimeQueryDefinition<TState>,
  output: unknown
): unknown {
  return validateSchemaSync(queryDef.output, output, {
    kind: 'query',
    serviceId: refs.serviceId,
    name: queryName,
    phase: 'output',
  });
}

/**
 * Runs the query handler synchronously and returns its raw result (no output validation).
 *
 * The `selfQueries` parameter lets the caller swap in load-aware wrappers when running inside a
 * load body or a `.loaded()` discovery pass; ordinary handler calls pass the default queries.
 */
function runHandlerSync<TState>(
  refs: QueryRuntimeRefs<TState>,
  queryName: string,
  queryDef: RuntimeQueryDefinition<TState>,
  validatedInput: unknown,
  selfQueries: Record<string, Query<unknown, unknown>>,
  getService: ServiceRegistryApi['getService']
): unknown {
  if (!queryDef.handler) {
    throw new OpenServiceUnimplementedOperationError({
      kind: 'query',
      serviceId: refs.serviceId,
      name: queryName,
    });
  }

  const handlerSelf: QuerySelf<TState> = {
    get state() {
      return refs.state;
    },
    queries: selfQueries,
  };
  const handlerCtx: QueryCtx<TState> = { self: handlerSelf, getService };

  // The handler result is returned raw. Output validation is intentionally *not* run here: this
  // function executes inside the subscription `computed`, where reading the whole value to validate
  // it would broaden the reactive dependency footprint. Validation runs at the call sites instead —
  // see `validateQueryOutput` usages.
  return queryDef.handler(validatedInput, handlerCtx);
}

/**
 * Builds the shared synchronous `get(input)` for a query: validate input → fire the load per the
 * caller's policy → run the handler against `selfQueries` → validate output.
 *
 * The three query surfaces — the default consumer query ({@link createDefaultQuery}), the reactive
 * subscription-load wrappers ({@link buildReactiveLoadQueries}), and the awaited load-body wrappers
 * ({@link buildLoadWrappedQueries}) — differ only in (a) which `self.queries` map the handler sees
 * and (b) how a load-backed read fires its `load`. Everything else (the validate → run → validate
 * skeleton, the zero-arg input resolution) is identical, so each surface passes its own `selfQueries`
 * map and `fireLoad` policy and shares this body.
 *
 * `fireLoad` is invoked only for queries that declare a `load`; queries without one skip it. Pass
 * `selfQueries` by reference even when it is the same map being populated by the caller — `get`
 * closes over the reference, which is fully built by the time any handler runs.
 */
function createQueryGet<TState>(
  refs: QueryRuntimeRefs<TState>,
  queryName: string,
  queryDef: RuntimeQueryDefinition<TState>,
  selfQueries: Record<string, Query<unknown, unknown>>,
  fireLoad: ((validatedInput: unknown) => void) | undefined
): (input?: unknown) => unknown {
  return function get(input?: unknown) {
    const validatedInput = validateQueryInput(
      refs,
      queryName,
      queryDef,
      arguments.length === 0 ? undefined : input
    );

    if (queryDef.load) {
      fireLoad?.(validatedInput);
    }

    // Validate the output on this pull boundary. Validation runs off the reactive path, so it never
    // affects the deep-signal dependency graph; the validated value is what the consumer receives.
    return validateQueryOutput(
      refs,
      queryName,
      queryDef,
      runHandlerSync(
        refs,
        queryName,
        queryDef,
        validatedInput,
        selfQueries,
        refs.registryApi.getService
      )
    );
  };
}

/**
 * Triggers a `load` if one is not already in flight for the same key, or returns the existing
 * promise so concurrent callers share the work.
 *
 * Returns the in-flight promise (whether newly created or reused). The body runs through
 * {@link runLoadBody} and its promise is registered into {@link inFlightLoads} **before** that
 * body starts; see the "register before run" comment below for why.
 *
 * ### Ancestor chain
 *
 * The parent caller passes its own ancestor chain (the load keys it is currently nested
 * inside). This function extends that chain with the dependency's own key before kicking off the
 * body, so any transitive read of an ancestor — e.g. `a.load` calls `b.load` which calls `a.load`
 * again — short-circuits via cycle detection in {@link createDefaultQuery} and
 * {@link buildLoadWrappedQueries}, rather than deadlocking on its own ancestor's promise.
 *
 * ### Cycle example
 *
 * Service exposes queries `a` and `b`; `a.load` reads `b`, `b.load` reads `a`.
 *
 * 1. `a.loaded()` → `triggerLoad(a, parentChain={})` → body runs with chain `{a}`.
 * 2. `a.load` body calls `ctx.self.queries.b.get(...)` → wrapper calls
 *    `triggerLoad(b, parentChain={a})` → body runs with chain `{a, b}`.
 * 3. `b.load` body calls `ctx.self.queries.a.get(...)` → wrapper calls
 *    `triggerLoad(a, parentChain={a, b})`. `a` is already in flight, so the existing promise is
 *    reused. But the wrapper sees `aKey ∈ ancestorChain` and **skips** adding it to b's local
 *    collector — `b` does not wait on `a`'s promise.
 * 4. Both load bodies progress past their sync reads, await their commands, settle.
 */
function triggerLoad<TState>(
  refs: QueryRuntimeRefs<TState>,
  queryName: string,
  queryDef: RuntimeQueryDefinition<TState>,
  validatedInput: unknown,
  loadKey: string,
  parentAncestorChain: ReadonlySet<string>
): Promise<unknown> {
  const existing = inFlightLoads.get(loadKey);
  if (existing) {
    return existing;
  }

  const extendedChain = new Set(parentAncestorChain);
  extendedChain.add(loadKey);

  // Register the promise into `inFlightLoads` BEFORE the load body starts so any reentrant query
  // call made inside the body's synchronous prefix (the part before the body's first `await`)
  // sees this load as in-flight and reuses the same promise instead of starting a duplicate run.
  // The body itself is wrapped in `Promise.resolve().then(...)` to enforce a microtask boundary
  // between registration and execution, which guarantees this ordering even if `runLoadBody`
  // happened to be synchronous up to its first await.
  const promise = Promise.resolve()
    .then(() => runLoadBody(refs, queryName, queryDef, validatedInput, extendedChain))
    .finally(() => {
      // Only clear the entry if it still points at this promise — another caller may have already
      // overwritten it with a fresh in-flight load for the next round.
      if (inFlightLoads.get(loadKey) === promise) {
        inFlightLoads.delete(loadKey);
      }
    });

  inFlightLoads.set(loadKey, promise);
  return promise;
}

/**
 * Executes one `load` invocation with its own local collector and a wrapped `self`.
 *
 * Each `load` invocation gets its **own** collector and its **own** map of wrapped queries. This
 * matters because the wrappers close over the collector and ancestor chain that belong to this
 * particular load — a different load running concurrently for a different key has a different
 * collector and a different chain, so the same `defaultQuery` cannot serve both.
 *
 * The wrapper around `self.queries` registers transitively triggered loads into the local
 * collector. After the user's load body resolves, we still await that collector via
 * {@link drainCollector} so the returned promise only resolves once every dependency the load
 * body touched has also settled. That is what gives `.loaded()` its transitive guarantee through
 * async load bodies: an outer caller awaiting this load promise is, by construction, also
 * waiting for all descendant loads triggered by self.queries reads.
 *
 * Cross-service `ctx.getService(id).queries.*` calls are intentionally **not** wrapped — that
 * would require recursively wrapping the registry's runtime services and would entangle load
 * scoping across service boundaries. Authors must use `.loaded()` explicitly when they need a
 * cross-service dependency awaited from inside a load body.
 */
export async function runLoadBody<TState>(
  refs: QueryRuntimeRefs<TState>,
  queryName: string,
  queryDef: RuntimeQueryDefinition<TState>,
  validatedInput: unknown,
  ancestorChain: ReadonlySet<string>
): Promise<void> {
  if (!queryDef.load) {
    return;
  }

  const collector = new Set<CollectorEntry>();
  const wrappedQueries = buildLoadWrappedQueries(refs, ancestorChain, collector);
  const loadSelf: LoadSelf<TState> = {
    get state() {
      return refs.state;
    },
    queries: wrappedQueries,
    commands: refs.getLoadCommands() as LoadSelf<TState>['commands'],
  };
  const loadCtx: LoadCtx<TState> = { self: loadSelf, getService: refs.registryApi.getService };

  await Promise.resolve(queryDef.load(validatedInput, loadCtx));
  await drainCollector(collector, undefined, refs.serviceId, queryName);
}

/**
 * Runs a query's `load` as the body of a subscription's reactive effect.
 *
 * Unlike {@link runLoadBody}, this is invoked synchronously inside an `effect()`, so the external
 * signals the load reads in its synchronous prefix are tracked — when they later change, the effect
 * re-runs and the load re-fires, turning it into a reactive async resource. Loads are therefore an
 * idempotent warming step (the documented guideline, now a hard contract); one-shot side effects
 * belong in a command.
 *
 * Writes go through gated commands: if `isCurrent()` flips to false because a newer run started
 * (deps changed again), this run's later writes are dropped, so a slow stale load cannot clobber the
 * newer result. Sibling reads use the default queries — their loads fire-and-forget — so transitive
 * dependencies stay warm without the `.loaded()` drain, which is only meaningful for awaited pulls.
 */
async function runReactiveLoad<TState>(
  refs: QueryRuntimeRefs<TState>,
  queryName: string,
  queryDef: RuntimeQueryDefinition<TState>,
  validatedInput: unknown,
  isCurrent: () => boolean
): Promise<void> {
  if (!queryDef.load) {
    return;
  }

  const loadSelf: LoadSelf<TState> = {
    get state() {
      return refs.state;
    },
    // Reactive-load reads must keep dependency loads warm. `.get()` on a default query is a pure
    // read and never fires a load, so the body sees fire-and-forget wrappers instead: reading a
    // dependency triggers its load (deduped while in flight) without awaiting a drain.
    queries: refs.reactiveLoadQueries,
    commands: refs.buildGatedCommands(isCurrent) as LoadSelf<TState>['commands'],
  };
  const loadCtx: LoadCtx<TState> = { self: loadSelf, getService: refs.registryApi.getService };

  await Promise.resolve(queryDef.load(validatedInput, loadCtx));
}

/**
 * Builds the `ctx.self.queries` map used inside a *reactive subscription load* body.
 *
 * `.get()` here fires the dependency's `load` fire-and-forget (deduped via {@link inFlightLoads}),
 * mirroring how a bare query call used to warm dependencies — but scoped to the reactive-load
 * context only, so a plain consumer `.get()` stays a pure read. There is no drain: a subscription
 * does not await its dependencies, it re-fires reactively when their tracked state changes.
 */
export function buildReactiveLoadQueries<TState>(
  refs: QueryRuntimeRefs<TState>
): Record<string, Query<unknown, unknown>> {
  const wrappedQueries: Record<string, Query<unknown, unknown>> = {};

  for (const [name, queryDef] of refs.queryDefinitions) {
    const defaultQuery = refs.defaultQueries[name] as RuntimeQuery;
    // Fire-and-forget: reading a dependency warms its load (deduped while in flight) but the
    // reactive load never awaits it — there is no collector and no ancestor chain to extend.
    const get = createQueryGet(refs, name, queryDef, wrappedQueries, (validatedInput) => {
      const loadKey = makeLoadKey(refs.serviceId, name, validatedInput);
      triggerLoad(refs, name, queryDef, validatedInput, loadKey, EMPTY_SET).catch(rethrowAsync);
    });

    wrappedQueries[name] = {
      get,
      loaded: defaultQuery.loaded,
      subscribe: defaultQuery.subscribe,
    } as RuntimeQuery;
  }

  return wrappedQueries;
}

/**
 * Builds the wrapped `self.queries` map exposed inside one load body.
 *
 * The returned map shadows the runtime's default query map. Each wrapped call still validates
 * input, fires the dependency's `load` via {@link triggerLoad}, and runs the same sync handler —
 * but it also **registers the dependency's load promise into the load-local collector** so
 * `runLoadBody`'s drain can await it before returning. The wrappers therefore turn an ordinary
 * sync read of a dependency into "fire load + remember it for the outer drain to wait on."
 *
 * ### Why one map per load invocation?
 *
 * Two separate `load` calls (different keys, possibly different services) have different
 * `ancestorChain` sets and different `collector` instances. Each wrapped function closes over
 * those values, so the maps cannot be reused — they are recreated cheaply per invocation. Inside
 * a single load body, all nested handler reads share **this same** wrapped map (the closure
 * captures `wrappedQueries` from this scope), so transitive dependency reads continue to register
 * against the same collector.
 *
 * ### Cycle detection
 *
 * If the dependency's load key is already on this load's ancestor chain, we still call
 * `triggerLoad` (it returns the in-flight promise) but we **skip** adding it to the collector.
 * Adding it would deadlock: the outer load's drain would wait on its own ancestor's promise,
 * which is itself waiting on this load. See {@link triggerLoad}'s walkthrough for a concrete
 * `a → b → a` example.
 *
 * ### `.loaded()` and `.subscribe` on the wrapped queries
 *
 * `.loaded()` on a wrapped query forwards the **current** ancestor chain so a load body author
 * can write `await ctx.self.queries.foo.loaded(input)` and trust that the resulting drain
 * inherits the right cycle-protection set. `.subscribe` is passed through unchanged because
 * subscriptions are never part of a load drain — they have their own lifecycle.
 */
function buildLoadWrappedQueries<TState>(
  refs: QueryRuntimeRefs<TState>,
  ancestorChain: ReadonlySet<string>,
  collector: Set<CollectorEntry>
): Record<string, Query<unknown, unknown>> {
  const wrappedQueries: Record<string, Query<unknown, unknown>> = {};

  for (const [name, queryDef] of refs.queryDefinitions) {
    const defaultQuery = refs.defaultQueries[name] as RuntimeQuery;
    // Fire the dependency's load and register it into this load body's collector so the outer
    // `runLoadBody` drain awaits it — unless the key is already on the ancestor chain, in which case
    // adding it would deadlock the drain on its own ancestor (see `triggerLoad`'s cycle walkthrough).
    const get = createQueryGet(refs, name, queryDef, wrappedQueries, (validatedInput) => {
      const loadKey = makeLoadKey(refs.serviceId, name, validatedInput);
      const promise = triggerLoad(refs, name, queryDef, validatedInput, loadKey, ancestorChain);
      if (!ancestorChain.has(loadKey)) {
        collector.add({ key: loadKey, promise });
      }
    });

    const wrapped = {
      get,
      loaded(input?: unknown) {
        return runLoaded(
          refs,
          name,
          queryDef,
          arguments.length === 0 ? undefined : input,
          ancestorChain
        ) as Promise<unknown>;
      },
      subscribe: defaultQuery.subscribe,
    } as RuntimeQuery;

    wrappedQueries[name] = wrapped;
  }

  return wrappedQueries;
}

/**
 * Implements `query.loaded(input)`.
 *
 * Returns a promise that resolves to the validated handler output once this query's `load` and
 * every dependency the handler transitively reads has settled.
 *
 * ### Algorithm
 *
 * 1. **Setup** — validate input, build the session (`ancestorChain` extended with this load key,
 *    an empty `collector`, an empty `settledKeys`). The ancestor chain inherits from
 *    `parentAncestorChain` when this is called from inside a wrapped query (so the inner
 *    `.loaded()` shares cycle protection with the outer load body).
 *
 * 2. **Fire own load** — if this query has a `load` hook, push its in-flight promise into
 *    `session.collector`. Skip if the key is already on the parent's ancestor chain (we are
 *    inside that load already; we cannot deadlock on ourselves).
 *
 * 3. **Drain + discover loop**, up to {@link MAX_DRAIN_ITERATIONS} times:
 *    - Inner loop: while `session.collector` has entries, snapshot them, clear, await with
 *      `Promise.allSettled`, mark their keys in `session.settledKeys`, surface rejections.
 *    - Run the handler synchronously under `activeHandlerLoadSession = session` (a discovery
 *      pass). Sync reads of dependencies inside the handler go through {@link createDefaultQuery}
 *      and register any non-settled, non-ancestor load into `session.collector`.
 *    - If the handler threw, swallow (state might still be partial; a later iteration may fix it).
 *    - If the handler added nothing to the collector, we have converged — exit the loop.
 *
 * 4. **Return** — run the handler one final time under the same session (so dependency reads
 *    respect `settledKeys` and do not refire loads) and return the validated output. This is the
 *    value the caller sees. If state is still incomplete at this point the handler may throw, and
 *    that throw propagates.
 *
 * ### Worked example: `bar.loaded(input)` where `bar.handler` reads `foo`
 *
 * Assume `bar` has no `load` of its own; `foo` does.
 *
 * - **Setup**: session = `{ ancestorChain: {barKey}, collector: ∅, settledKeys: ∅ }`. No own load
 *   to fire (`bar.load` is undefined).
 * - **Iteration 1**:
 *   - Inner drain: collector is empty, skip.
 *   - Discovery pass: handler runs, reads `ctx.self.queries.foo.get(...)`. The default `foo` query
 *     sees `activeHandlerLoadSession === session`, sees that `fooKey` is neither in
 *     `ancestorChain` nor in `settledKeys`, and fires + registers foo's load into
 *     `session.collector`. The handler returns (possibly with stale state).
 *   - `hasMoreWork = true` (collector now has one entry).
 * - **Iteration 2**:
 *   - Inner drain: `await Promise.allSettled([fooPromise])`, mark `fooKey` settled, surface any
 *     rejection.
 *   - Discovery pass: handler runs again. The default `foo` query is now in `settledKeys`, so
 *     it fires nothing and the collector stays empty.
 *   - `hasMoreWork = false`; exit.
 * - **Final**: run handler once more (state is now populated by foo's load), validate, return.
 *
 * The same machinery handles deeper chains — every settled load may have populated state that
 * causes the handler to read **more** queries on the next iteration. The loop keeps draining
 * until the read set stabilizes.
 */
async function runLoaded<TState>(
  refs: QueryRuntimeRefs<TState>,
  queryName: string,
  queryDef: RuntimeQueryDefinition<TState>,
  rawInput: unknown,
  parentAncestorChain: ReadonlySet<string> = EMPTY_SET
): Promise<unknown> {
  const validatedInput = validateQueryInput(refs, queryName, queryDef, rawInput);
  const loadKey = makeLoadKey(refs.serviceId, queryName, validatedInput);
  const ancestorChain = new Set<string>(parentAncestorChain);
  ancestorChain.add(loadKey);

  const session: LoadedSession = {
    ancestorChain,
    collector: new Set<CollectorEntry>(),
    settledKeys: new Set<string>(),
  };

  if (queryDef.load && !parentAncestorChain.has(loadKey)) {
    const promise = triggerLoad(
      refs,
      queryName,
      queryDef,
      validatedInput,
      loadKey,
      parentAncestorChain
    );
    session.collector.add({ key: loadKey, promise });
  }

  let iterations = 0;
  let hasMoreWork = true;

  // Always run at least one discovery pass even when this query has no `load` of its own — the
  // handler may still call other queries whose loads need to be awaited.
  while (hasMoreWork) {
    if (iterations++ > MAX_DRAIN_ITERATIONS) {
      throw new OpenServiceLoadedDrainExceededError({
        serviceId: refs.serviceId,
        name: queryName,
        iterations: MAX_DRAIN_ITERATIONS,
      });
    }

    while (session.collector.size > 0) {
      const pending = [...session.collector];
      session.collector.clear();

      const settlements = await Promise.allSettled(pending.map((entry) => entry.promise));

      // Mark keys as settled before surfacing rejections so the discovery pass below does not
      // refire them even when the very first load failed.
      for (const entry of pending) {
        session.settledKeys.add(entry.key);
      }

      surfaceRejections(settlements);
    }

    // Discovery: run the handler under the session so each sync read of a dependency that is not
    // settled yet (and not on the ancestor chain) gets registered into the session collector.
    const previousSession = activeHandlerLoadSession;
    activeHandlerLoadSession = session;

    try {
      runHandlerSync(
        refs,
        queryName,
        queryDef,
        validatedInput,
        refs.defaultQueries,
        refs.registryApi.getService
      );
    } catch {
      // Handlers may throw when state isn't fully populated yet; the next drain iteration may fix
      // it. The final post-loop handler call propagates any persistent failure.
    } finally {
      activeHandlerLoadSession = previousSession;
    }

    hasMoreWork = session.collector.size > 0;
  }

  // Run the final handler call under the session so already-settled dependency loads are not
  // refired during this last evaluation, and validate the output at this pull boundary (validation
  // is intentionally kept out of the reactive `runHandlerSync` path).
  const previousSession = activeHandlerLoadSession;
  activeHandlerLoadSession = session;

  try {
    return validateQueryOutput(
      refs,
      queryName,
      queryDef,
      runHandlerSync(
        refs,
        queryName,
        queryDef,
        validatedInput,
        refs.defaultQueries,
        refs.registryApi.getService
      )
    );
  } finally {
    activeHandlerLoadSession = previousSession;
  }
}

/**
 * Creates the default query object exposed on the service runtime as `service.queries.foo`.
 *
 * The returned object is what consumers use directly **and** what handlers see in
 * `ctx.self.queries.foo` (load bodies see a different, wrapped version — see
 * {@link buildLoadWrappedQueries}). Its surface:
 *
 * - **`get(input)`** validates input synchronously, runs the handler against current state, and
 *   returns the validated result. It does **not** fire this query's `load` for an ordinary consumer
 *   read — that was the confusing implicit-background-load behavior of the old bare call, now
 *   removed. The one exception is dependency tracking: when a `.get()` runs inside a `.loaded()`
 *   discovery pass (`activeHandlerLoadSession` set), it fires + registers the load into the session
 *   collector so the outer drain awaits it (skipping cycles and already-settled keys). Reactive
 *   subscription loads warm dependencies through {@link buildReactiveLoadQueries} instead.
 * - **`loaded(input)`** drives the full `.loaded()` drain.
 * - **`subscribe(...)`** sets up a reactive subscription (this is what fires the reactive `load`).
 */
function createDefaultQuery<TState>(
  refs: QueryRuntimeRefs<TState>,
  queryName: string,
  queryDef: RuntimeQueryDefinition<TState>
): RuntimeQuery {
  const resolveInput = (input: unknown, argsLength: number) =>
    argsLength === 0 ? undefined : input;

  // A bare consumer `.get()` never fires the load. The only firing path is a `.loaded()` discovery
  // pass: when one is active (`activeHandlerLoadSession` set), register this dependency's load into
  // the session collector so the outer drain awaits it — skipping keys on the ancestor chain (cycle)
  // or already settled this session.
  const get = createQueryGet(refs, queryName, queryDef, refs.defaultQueries, (validatedInput) => {
    const session = activeHandlerLoadSession;
    if (!session) {
      return;
    }
    const loadKey = makeLoadKey(refs.serviceId, queryName, validatedInput);
    if (!session.ancestorChain.has(loadKey) && !session.settledKeys.has(loadKey)) {
      const promise = triggerLoad(
        refs,
        queryName,
        queryDef,
        validatedInput,
        loadKey,
        session.ancestorChain
      );
      session.collector.add({ key: loadKey, promise });
    }
  });

  const subscribe = ((...args: unknown[]): (() => void) => {
    if (args.length === 1 && typeof args[0] === 'function') {
      return subscribeToQuery(
        refs,
        queryName,
        queryDef,
        undefined,
        undefined,
        args[0] as (state: QueryState<unknown>) => void
      );
    }

    if (args.length === 2 && typeof args[0] === 'function' && typeof args[1] === 'function') {
      return subscribeToQuery(
        refs,
        queryName,
        queryDef,
        undefined,
        args[0] as (value: unknown) => unknown,
        args[1] as (state: QueryState<unknown>) => void
      );
    }

    const [input, selectorOrCallback, maybeCallback] = args;

    return subscribeToQuery(
      refs,
      queryName,
      queryDef,
      input,
      maybeCallback ? (selectorOrCallback as (value: unknown) => unknown) : undefined,
      (maybeCallback ?? selectorOrCallback) as (state: QueryState<unknown>) => void
    );
  }) as RuntimeQuery['subscribe'];

  return {
    get,
    loaded(input?: unknown) {
      return runLoaded(refs, queryName, queryDef, resolveInput(input, arguments.length));
    },
    subscribe,
  } as RuntimeQuery;
}

/**
 * Subscribes to a query by running its handler inside a deep-signal-aware `computed()` and
 * notifying through an `effect()`. The callback receives a {@link QueryState} combining the current
 * `data` (the synchronous handler result, or the selected slice) with the per-subscription `load`
 * lifecycle (`status` / `loadStatus` / `error`).
 *
 * The first emission is **synchronous**: `subscribe()` invokes the callback once with the current
 * {@link QueryState} before it returns the unsubscribe handle. The runtime kicks `load` off in the
 * background but does not wait for it — subscribers see the current state immediately (a load-backed
 * query already reads `loading`, since the reactive-load effect runs synchronously here) and
 * follow-up emissions as the load settles (or re-fires) and tracked state changes.
 *
 * Three layers keep emissions precise:
 *
 * 1. **Fine-grained reads** — the handler (and the optional `selector`) read through the deep-signal
 *    proxy, so the computed only re-runs when the exact fields it touched change. A write to an
 *    unrelated key or field never re-runs the handler.
 * 2. **Lifecycle signal** — a separate per-subscription signal carries `status`/`loadStatus`/`error`,
 *    updated by the reactive-load effect. The emit effect reads both it and the data computed, so a
 *    status change (e.g. a background re-load) fires the callback even when the selected slice is
 *    unchanged.
 * 3. **Object dedup** — the whole emitted `QueryState` is compared with the previously emitted one via
 *    `isEqual`; a re-run that produces a deeply-equal state (e.g. a load rewriting an equal payload
 *    with no status change) does not fire the callback.
 *
 * Error sources all surface as `status: 'error'` (keeping the last successful `data`): input
 * validation failure, a synchronous handler / output-validation throw, and a `load` rejection.
 */
function subscribeToQuery<TState>(
  refs: QueryRuntimeRefs<TState>,
  queryName: string,
  queryDef: RuntimeQueryDefinition<TState>,
  rawInput: unknown,
  selector: ((value: unknown) => unknown) | undefined,
  callback: (state: QueryState<unknown>) => void
): () => void {
  let active = true;

  let validatedInput: unknown;
  try {
    validatedInput = validateQueryInput(refs, queryName, queryDef, rawInput);
  } catch (error) {
    // Bad input is a programmer error, but surfacing it as an error state is more debuggable than
    // a silently dead subscription. The subscription still "exists", reporting the failure.
    callback(
      buildQueryState(undefined, { status: 'error', error: toError(error), loadStatus: 'idle' })
    );
    return () => {
      active = false;
    };
  }

  // Per-subscription lifecycle. A query with no `load` has nothing to load, so it starts (and
  // stays) `success`/`idle` unless its synchronous handler throws; a query with a `load` starts
  // `pending` and flips to `loading` as soon as the reactive-load effect fires below.
  const lifecycle = signal<QueryLifecycle>({
    status: queryDef.load ? 'pending' : 'success',
    error: undefined,
    loadStatus: 'idle',
  });

  let loadTeardown: (() => void) | undefined;
  if (queryDef.load) {
    // Reactive load: run the load inside an effect so the external signals it reads synchronously
    // are tracked. When they change, the effect re-runs and the load re-fires, keeping an
    // asynchronously-produced value fresh. `epoch` gates writes so a superseded run can't clobber
    // a newer one (the lifecycle updates below are gated the same way). Loads with no external
    // synchronous reads (the existing ones) track nothing and therefore fire exactly once. Because
    // this effect runs synchronously now, the first emission already reads `loading`.
    let epoch = 0;
    loadTeardown = effect(() => {
      const myEpoch = ++epoch;
      const isCurrent = () => myEpoch === epoch;

      // Mark this run in flight, preserving the current `status` (so the first load reads
      // `pending` → `isInitialLoading`, while a re-load over existing data reads `success` →
      // `isRefreshing`). Read untracked so the load effect does not depend on its own writes.
      const previous = untracked(() => lifecycle.value);
      lifecycle.value = {
        status: previous.status,
        error: previous.error,
        loadStatus: 'loading',
      };

      runReactiveLoad(refs, queryName, queryDef, validatedInput, isCurrent).then(
        () => {
          if (!isCurrent()) {
            return;
          }
          lifecycle.value = { status: 'success', error: undefined, loadStatus: 'idle' };
        },
        (error) => {
          if (!isCurrent()) {
            return;
          }
          lifecycle.value = { status: 'error', error: toError(error), loadStatus: 'idle' };
        }
      );
    });
  }

  // The output is always validated, but the computed's dependency footprint must match only what
  // the subscriber consumes:
  //   - With a `selector`, validation runs untracked (so reading the whole value to validate it
  //     does not register dependencies), and only the selected fields the selector reads are
  //     tracked. A sibling field the selector ignores never re-runs this computed.
  //   - Without a selector, validation runs tracked: reading the whole value is the correct
  //     footprint for a whole-output subscriber, and the validated value is emitted (identical to
  //     what a direct `.get()` / `.loaded()` pull returns).
  const comp = computed(() => {
    const output = runHandlerSync(
      refs,
      queryName,
      queryDef,
      validatedInput,
      refs.defaultQueries,
      refs.registryApi.getService
    );
    if (selector) {
      const validated = untracked(() => validateQueryOutput(refs, queryName, queryDef, output));
      // Read the live handler output so the selector's field accesses stay on the reactive
      // proxy; validation returns a plain parsed value that cannot carry those dependencies.
      selector(output);
      return detachSnapshot(selector(validated));
    }
    return detachSnapshot(validateQueryOutput(refs, queryName, queryDef, output));
  });

  let hasEmitted = false;
  let lastEmitted: QueryState<unknown> | undefined;
  // Last successfully produced `data`, retained so an error (load rejection or handler throw)
  // keeps the most recent good value visible instead of dropping it.
  let lastData: unknown;
  // Creating the effect runs it synchronously, so the first callback fires before `subscribe`
  // returns its unsubscribe handle.
  const teardown = effect(() => {
    // Read the lifecycle first so a status-only change (e.g. a background re-load over an
    // unchanged selected slice) still re-runs this effect and re-emits.
    const life = lifecycle.value;

    let data: unknown;
    let status = life.status;
    let error = life.error;
    try {
      data = comp.value;
      lastData = data;
    } catch (handlerError) {
      // A synchronous handler / output-validation throw becomes an error state while keeping the
      // last good data; this also covers no-`load` queries whose handler throws.
      data = lastData;
      status = 'error';
      error = toError(handlerError);
    }

    if (!active) {
      return;
    }

    const state = buildQueryState(data, { status, error, loadStatus: life.loadStatus });

    // Skip re-runs that produced a deeply-equal state (data and lifecycle both unchanged).
    if (hasEmitted && isEqual(state, lastEmitted)) {
      return;
    }

    hasEmitted = true;
    lastEmitted = state;
    callback(state);
  });

  return () => {
    active = false;
    teardown();
    loadTeardown?.();
  };
}
/** Builds the runtime query map for one service runtime. */
export function buildQueries<TState>(
  refs: QueryRuntimeRefs<TState>
): Record<string, Query<unknown, unknown>> {
  const result: Record<string, Query<unknown, unknown>> = {};

  for (const [name, queryDef] of refs.queryDefinitions) {
    result[name] = createDefaultQuery(refs, name, queryDef);
  }

  return result;
}
