/**
 * # service-runtime
 *
 * Builds the runtime surface for one registered service: state signal, sync queries with
 * `.loaded()` and `.subscribe()`, async commands, and the in-flight load registry that powers
 * dependency tracking for `.loaded()`.
 *
 * ## Mental model in one paragraph
 *
 * A query call is synchronous: it validates input, calls the handler against current state, and
 * returns the result immediately. If the query declares a `load` hook, that hook is fired
 * **fire-and-forget** at the same time so state is gradually populated in the background and
 * later sync calls (or subscribers) see fresher results. The async sugar `query.loaded(input)`
 * is the "wait until fully loaded" form — it must guarantee that **every dependency the handler
 * transitively reads is settled** before returning, even though those dependencies are not
 * declared statically anywhere. That guarantee is what the drain machinery in this file exists
 * to provide.
 *
 * ## Dependency-tracking algorithm
 *
 * `.loaded()` runs a *drain loop*:
 *
 * 1. Fire this query's own `load` and put the promise into a `LoadedSession` collector.
 * 2. Repeat:
 *    - Await everything currently in the collector with `Promise.allSettled`.
 *    - Mark those load keys as `settled` for the session.
 *    - Run the sync handler under the session as a *discovery pass*. Every sync read of a
 *      dependency query (via `ctx.self.queries.*` or `ctx.getService(...).queries.*`) consults
 *      the module-scoped `activeHandlerLoadSession`; if that dep's load is not already
 *      settled or on the ancestor chain, its promise is added to the collector.
 *    - If the discovery pass added new entries, loop again. Otherwise, exit.
 * 3. Final handler call (no session) returns the validated output.
 *
 * Inside a `load` body, `ctx.self.queries.*` are *wrapped* by {@link buildLoadWrappedQueries} so
 * the same registration happens against a load-local collector — the load promise only resolves
 * when its body **and** its own dependencies have settled. This propagates the "wait" through
 * async load bodies without needing AsyncLocalStorage.
 *
 * ## Why each piece exists
 *
 * - **{@link inFlightLoads}** dedups concurrent calls for the same `(service, query, input)` so
 *   two consumers asking for the same data share one load.
 * - **{@link LoadedSession.ancestorChain}** breaks cycles: a dep whose load key is already on the
 *   call chain is skipped (not added to any collector) so two queries that read each other do
 *   not self-deadlock.
 * - **{@link LoadedSession.settledKeys}** prevents the discovery loop from refiring already
 *   completed loads on each iteration — without it, every reread of a dep in the handler would
 *   re-trigger its load and the drain loop would never converge.
 * - **{@link MAX_DRAIN_ITERATIONS}** caps pathological cases (e.g. a handler reading a query with
 *   an ever-changing input key) so a buggy service surfaces a real error instead of hanging.
 *
 * ## Boundaries
 *
 * Cross-service `getService(...).queries.*` calls **inside a load body** are intentionally not
 * tracked into the load-local collector. Authors who need cross-service deps awaited from inside
 * a load should call `.loaded()` explicitly (e.g. `await ctx.getService(id).queries.foo
 * .loaded(input)`). Cross-service calls from a sync handler still go through the session-aware
 * path because handler reads are tracked by `activeHandlerLoadSession`, which is module-scoped
 * and stable for the duration of a sync handler call.
 */
import { batch, computed, effect } from '@preact/signals-core';
import { deepSignal } from 'deepsignal/core';
import { isEqual } from 'es-toolkit/predicate';

import {
  OpenServiceInvalidStaticPathError,
  OpenServiceLoadedDrainExceededError,
  OpenServiceUnimplementedOperationError,
} from '../../server-errors.ts';
import { rethrowAsync, validateSchema, validateSchemaSync } from './service-validation.ts';
import type {
  AnySchema,
  Command,
  CommandCtx,
  CommandSelf,
  Commands,
  LoadCtx,
  LoadSelf,
  Queries,
  Query,
  QueryCtx,
  QueryDefinition,
  QuerySelf,
  RuntimeService,
  ServiceDefinition,
  ServiceId,
  ServiceInstance,
  ServiceRegistryApi,
} from './types.ts';

type RuntimeQueryDefinition<TState> = QueryDefinition<TState, AnySchema, AnySchema>;

/**
 * Internal runtime object returned while a service instance is being assembled.
 *
 * It keeps the raw signal and `self` reference available for static building and registration so
 * callers can capture the post-load state snapshot without rebuilding the runtime.
 */
export type ServiceRuntime<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
> = {
  /** Returns a plain, detached snapshot of the current state for serialization. */
  getStateSnapshot(): TState;
  commandSelf: CommandSelf<TState>;
  queryCtx: QueryCtx<TState>;
  loadCtxForStatic: LoadCtx<TState>;
  commands: ServiceInstance<TState, TQueries, TCommands>['commands'];
  queries: ServiceInstance<TState, TQueries, TCommands>['queries'];
  runLoadOnce(queryName: string, validatedInput: unknown): Promise<void>;
};

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
const inFlightLoads = new Map<string, Promise<unknown>>();

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

function makeLoadKey(serviceId: ServiceId, queryName: string, validatedInput: unknown): string {
  return `${serviceId}::${queryName}::${stableHash(validatedInput)}`;
}

/**
 * Resolves which serialized static-state file should back a query input.
 *
 * The returned value is a logical slash-separated store key scoped under the service id, not a raw
 * filesystem path.
 */
function normalizeStaticStoragePath(serviceId: ServiceId, name: string, rawPath: string): string {
  const segments = rawPath
    .replaceAll('\\', '/')
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.');

  // Keep static snapshot keys relative so server-side writers can always anchor them under the
  // build output, regardless of whether authors used '/', './', or Windows-style separators.
  if (segments.length === 0 || segments.some((segment) => segment === '..')) {
    throw new OpenServiceInvalidStaticPathError({ serviceId, name, path: rawPath });
  }

  return segments.join('/');
}

export function resolveStaticPath(
  serviceId: ServiceId,
  name: string,
  queryDef: { staticPath: (input: unknown) => string },
  input: unknown
): string {
  const rawPath = queryDef.staticPath(input);
  const relativePath = normalizeStaticStoragePath(serviceId, name, rawPath);

  // Scope every snapshot under the service id so two services cannot collide on disk.
  return `${serviceId}/${relativePath}`;
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
 * Creates the writable `self` object that backs every runtime ctx for one service instance.
 *
 * State is a deep reactive proxy: mutations applied to the draft notify only the fine-grained
 * signals for the fields that actually changed. Writes are wrapped in a batch so one command only
 * notifies subscribers after the full draft mutation completes.
 */
function createCommandSelf<TState>(state: TState): CommandSelf<TState> {
  return {
    get state() {
      return state;
    },
    setState(mutate) {
      batch(() => {
        mutate(state);
      });
    },
    queries: {},
    commands: {},
  };
}

/**
 * Detaches a query value from the reactive deep-signal proxy into a plain, immutable snapshot.
 *
 * The proxy must never escape the runtime: handing it to consumers would leak a live, mutable view
 * of state and bypass the command-only mutation contract. Primitives pass through untouched; objects
 * and arrays are structurally cloned. State is required to be JSON-serializable (the same constraint
 * the static-build pipeline already relies on), so a JSON round-trip is a sufficient deep clone and
 * also reads every field of the value — which, inside a `computed`, registers the precise
 * fine-grained dependencies the subscription should track.
 */
function detachSnapshot<TValue>(value: TValue): TValue {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as TValue;
}

/**
 * Builds the runtime command map from the declarative command definitions.
 *
 * Each runtime command validates raw caller input, invokes the handler with parsed values, and
 * validates the resolved output before returning it to the caller.
 */
function buildCommands<TState>(
  serviceId: ServiceId,
  commands: Commands<TState>,
  createCommandCtx: () => CommandCtx<TState>
): Command {
  return Object.fromEntries(
    Object.entries(commands).map(([name, def]) => {
      return [
        name,
        async (input: unknown) => {
          if (!def.handler) {
            throw new OpenServiceUnimplementedOperationError({
              kind: 'command',
              serviceId,
              name,
            });
          }

          const validatedInput = await validateSchema(def.input, input, {
            kind: 'command',
            serviceId,
            name,
            phase: 'input',
          });
          const output = await def.handler(validatedInput, createCommandCtx());

          return validateSchema(def.output, output, {
            kind: 'command',
            serviceId,
            name,
            phase: 'output',
          });
        },
      ];
    })
  );
}

/**
 * Captures the per-runtime data needed by query helpers that operate across multiple queries.
 *
 * Bundling the references lets `createDefaultQuery`, the load body wrapper, and `.loaded()` share
 * the same closure shape without each one re-deriving the per-service callbacks.
 */
type QueryRuntimeRefs<TState> = {
  serviceId: ServiceId;
  commandSelf: CommandSelf<TState>;
  /** Deep reactive proxy backing this service's state; reads inside a computed track fine-grained. */
  state: TState;
  registryApi: ServiceRegistryApi;
  queryDefinitions: Map<string, RuntimeQueryDefinition<TState>>;
  defaultQueries: Record<string, Query<unknown, unknown>>;
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
 * Runs the query handler synchronously and validates the resolved value.
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
  const result = queryDef.handler(validatedInput, handlerCtx);

  return validateQueryOutput(refs, queryName, queryDef, result);
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
 * 2. `a.load` body calls `ctx.self.queries.b(...)` → wrapper calls
 *    `triggerLoad(b, parentChain={a})` → body runs with chain `{a, b}`.
 * 3. `b.load` body calls `ctx.self.queries.a(...)` → wrapper calls
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
async function runLoadBody<TState>(
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
    commands: refs.commandSelf.commands as LoadSelf<TState>['commands'],
  };
  const loadCtx: LoadCtx<TState> = { self: loadSelf, getService: refs.registryApi.getService };

  await Promise.resolve(queryDef.load(validatedInput, loadCtx));
  await drainCollector(collector, undefined, refs.serviceId, queryName);
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
    const defaultQuery = refs.defaultQueries[name];
    const wrapped = ((input: unknown) => {
      const validatedInput = validateQueryInput(refs, name, queryDef, input);
      const loadKey = makeLoadKey(refs.serviceId, name, validatedInput);

      if (queryDef.load) {
        const promise = triggerLoad(refs, name, queryDef, validatedInput, loadKey, ancestorChain);

        if (!ancestorChain.has(loadKey)) {
          collector.add({ key: loadKey, promise });
        }
      }

      return detachSnapshot(
        runHandlerSync(
          refs,
          name,
          queryDef,
          validatedInput,
          wrappedQueries,
          refs.registryApi.getService
        )
      );
    }) as Query<unknown, unknown>;

    wrapped.loaded = (input: unknown) =>
      runLoaded(refs, name, queryDef, input, ancestorChain) as Promise<unknown>;
    wrapped.subscribe = defaultQuery.subscribe;
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
 * 4. **Return** — run the handler one final time without the session and return the validated
 *    output. This is the value the caller sees. If state is still incomplete at this point the
 *    handler may throw, and that throw propagates.
 *
 * ### Worked example: `bar.loaded(input)` where `bar.handler` reads `foo`
 *
 * Assume `bar` has no `load` of its own; `foo` does.
 *
 * - **Setup**: session = `{ ancestorChain: {barKey}, collector: ∅, settledKeys: ∅ }`. No own load
 *   to fire (`bar.load` is undefined).
 * - **Iteration 1**:
 *   - Inner drain: collector is empty, skip.
 *   - Discovery pass: handler runs, reads `ctx.self.queries.foo(...)`. The default `foo` query
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

  return detachSnapshot(
    runHandlerSync(
      refs,
      queryName,
      queryDef,
      validatedInput,
      refs.defaultQueries,
      refs.registryApi.getService
    )
  );
}

/**
 * Creates the default query function exposed on the service runtime as `service.queries.foo`.
 *
 * The returned function is what consumers call directly **and** what handlers see in
 * `ctx.self.queries.foo` (load bodies see a different, wrapped version — see
 * {@link buildLoadWrappedQueries}). It behaves as follows:
 *
 * 1. Validate input synchronously. Throws on validation failure.
 * 2. If this query has a `load` hook, decide whether to fire it and where to register the
 *    promise:
 *    - If we're inside a `.loaded()` discovery pass (`activeHandlerLoadSession` set) and the
 *      load key is either on the ancestor chain (cycle protection) **or** already in
 *      `settledKeys` (already settled this session, do not refire), **skip** entirely.
 *    - Otherwise, call {@link triggerLoad} to either start a fresh load or join an in-flight one.
 *    - Then, if a session is active, push the promise into `session.collector` so the outer
 *      drain loop awaits it. If no session is active (ordinary consumer call), attach a
 *      `.catch(rethrowAsync)` so the fire-and-forget rejection still surfaces.
 * 3. Run the handler synchronously with the runtime's default queries, validate output, return.
 *
 * The synchronous return is the core API improvement — callers who want "current best" pay no
 * latency, callers who want "fully loaded" use `.loaded()`, and subscribers see emissions as
 * state changes.
 */
function createDefaultQuery<TState>(
  refs: QueryRuntimeRefs<TState>,
  queryName: string,
  queryDef: RuntimeQueryDefinition<TState>
): Query<unknown, unknown> {
  const query = ((input: unknown) => {
    const validatedInput = validateQueryInput(refs, queryName, queryDef, input);
    const loadKey = makeLoadKey(refs.serviceId, queryName, validatedInput);

    if (queryDef.load) {
      const session = activeHandlerLoadSession;
      // Three cases where we skip firing/registering:
      //   - session set and key on ancestor chain: cycle, would deadlock
      //   - session set and key in settledKeys: already loaded this session, refiring would
      //     prevent the discovery loop from ever converging
      //   - (the no-session case is *not* a skip — we still want fire-and-forget below)
      const skip = session
        ? session.ancestorChain.has(loadKey) || session.settledKeys.has(loadKey)
        : false;

      if (!skip) {
        const promise = triggerLoad(
          refs,
          queryName,
          queryDef,
          validatedInput,
          loadKey,
          session?.ancestorChain ?? EMPTY_SET
        );

        if (session) {
          // Inside a `.loaded()` discovery pass: register so the outer drain awaits us.
          session.collector.add({ key: loadKey, promise });
        } else {
          // Ordinary consumer call: fire-and-forget. Surface rejections via the global handler
          // so a buggy load doesn't fail silently.
          promise.catch(rethrowAsync);
        }
      }
    }

    // Detach from the reactive proxy: consumers always receive a plain, immutable snapshot.
    return detachSnapshot(
      runHandlerSync(
        refs,
        queryName,
        queryDef,
        validatedInput,
        refs.defaultQueries,
        refs.registryApi.getService
      )
    );
  }) as Query<unknown, unknown>;

  query.loaded = (input: unknown) => runLoaded(refs, queryName, queryDef, input);
  query.subscribe = ((
    input: unknown,
    selectorOrCallback: ((value: unknown) => unknown) | ((value: unknown) => void),
    maybeCallback?: (value: unknown) => void
  ): (() => void) =>
    subscribeToQuery(
      refs,
      queryName,
      queryDef,
      input,
      maybeCallback ? (selectorOrCallback as (value: unknown) => unknown) : undefined,
      maybeCallback ?? (selectorOrCallback as (value: unknown) => void)
    )) as Query<unknown, unknown>['subscribe'];

  return query;
}

/**
 * Subscribes to a query by running its handler inside a deep-signal-aware `computed()` and
 * notifying through an `effect()`.
 *
 * The first emission is deferred to a microtask so callers always receive their unsubscribe handle
 * before the callback fires. The runtime kicks `load` off in the background but does not wait for
 * it — subscribers see the current state immediately and a follow-up emission once the load settles
 * and tracked state changes.
 *
 * Two layers keep emissions precise:
 *
 * 1. **Fine-grained reads** — the handler (and the optional `selector`) read through the deep-signal
 *    proxy, so the computed only re-runs when the exact fields it touched change. A write to an
 *    unrelated key or field never re-runs the handler.
 * 2. **Value dedup** — the emitted value is detached into a plain snapshot and compared with the
 *    previously emitted snapshot via `isEqual`. A re-run that produces a deeply-equal value (e.g. a
 *    load that rewrites an equal payload) does not fire the callback. With a `selector`, only the
 *    selected slice is snapshotted and compared, so subscribers depend on exactly the data they use.
 */
function subscribeToQuery<TState>(
  refs: QueryRuntimeRefs<TState>,
  queryName: string,
  queryDef: RuntimeQueryDefinition<TState>,
  rawInput: unknown,
  selector: ((value: unknown) => unknown) | undefined,
  callback: (value: unknown) => void
): () => void {
  let active = true;
  let teardown: (() => void) | undefined;

  Promise.resolve().then(() => {
    if (!active) {
      return;
    }

    let validatedInput: unknown;
    try {
      validatedInput = validateQueryInput(refs, queryName, queryDef, rawInput);
    } catch (error) {
      rethrowAsync(error);
      return;
    }

    if (queryDef.load) {
      const loadKey = makeLoadKey(refs.serviceId, queryName, validatedInput);
      const pendingLoad = triggerLoad(
        refs,
        queryName,
        queryDef,
        validatedInput,
        loadKey,
        EMPTY_SET
      );
      // Subscribers do not block on rejections, but we still want them visible to global handlers.
      pendingLoad.catch(rethrowAsync);
    }

    // The computed reads through the deep-signal proxy (fine-grained tracking) and returns a
    // detached snapshot of the selected value. `detachSnapshot` reads every field it emits, which is
    // what registers the precise dependency set this subscription should react to.
    const comp = computed(() => {
      const output = runHandlerSync(
        refs,
        queryName,
        queryDef,
        validatedInput,
        refs.defaultQueries,
        refs.registryApi.getService
      );
      return detachSnapshot(selector ? selector(output) : output);
    });

    let hasEmitted = false;
    let lastEmitted: unknown;
    teardown = effect(() => {
      let value: unknown;
      try {
        value = comp.value;
      } catch (error) {
        rethrowAsync(error);
        return;
      }

      if (!active) {
        return;
      }

      // Skip re-runs that did not change the (selected) value. The computed already gates on
      // fine-grained reads; this gates on the rarer case where tracked state changed but the
      // emitted value is deeply equal (e.g. a load rewriting an equal payload).
      if (hasEmitted && isEqual(value, lastEmitted)) {
        return;
      }

      hasEmitted = true;
      lastEmitted = value;
      callback(value);
    });
  });

  return () => {
    active = false;
    teardown?.();
  };
}

/** Builds the runtime query map for one service runtime. */
function buildQueries<TState>(
  refs: QueryRuntimeRefs<TState>
): Record<string, Query<unknown, unknown>> {
  const result: Record<string, Query<unknown, unknown>> = {};

  for (const [name, queryDef] of refs.queryDefinitions) {
    result[name] = createDefaultQuery(refs, name, queryDef);
  }

  return result;
}

/**
 * Creates the full runtime backing for a service definition.
 *
 * Callers must supply the registry API that query and command contexts should expose.
 */
export function createServiceRuntime<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  def: ServiceDefinition<TState, TQueries, TCommands>,
  runtimeOptions: {
    registryApi: ServiceRegistryApi;
  },
  initialState: TState = def.initialState
): ServiceRuntime<TState, TQueries, TCommands> {
  // `rawState` is the plain backing object that the deep-signal proxy writes through to; it stays
  // in sync with every mutation and is the source for serialization snapshots. Cloning the incoming
  // state keeps a service definition's shared `initialState` from being mutated in place.
  const rawState = structuredClone(initialState) as TState;
  // The deep reactive proxy is the single source of truth that query computations track, at
  // per-field granularity.
  const state = deepSignal(rawState as object) as TState;
  const getStateSnapshot = (): TState => structuredClone(rawState);
  const commandSelf = createCommandSelf(state);
  const { registryApi } = runtimeOptions;
  const createCommandCtx = (): CommandCtx<TState> => ({
    self: commandSelf,
    getService: registryApi.getService,
  });

  const commands = buildCommands(def.id, def.commands, createCommandCtx) as ServiceInstance<
    TState,
    TQueries,
    TCommands
  >['commands'];
  commandSelf.commands = commands as CommandSelf<TState>['commands'];

  const queryDefinitions = new Map<string, RuntimeQueryDefinition<TState>>(
    Object.entries(def.queries) as [string, RuntimeQueryDefinition<TState>][]
  );
  const defaultQueries: Record<string, Query<unknown, unknown>> = {};
  const refs: QueryRuntimeRefs<TState> = {
    serviceId: def.id,
    commandSelf,
    state,
    registryApi,
    queryDefinitions,
    defaultQueries,
  };

  // Build queries after commands so handler/load ctx surfaces resolve the same command map.
  const builtQueries = buildQueries(refs);
  for (const [name, query] of Object.entries(builtQueries)) {
    defaultQueries[name] = query;
  }
  commandSelf.queries = defaultQueries;

  const queries = defaultQueries as ServiceInstance<TState, TQueries, TCommands>['queries'];
  const queryCtxSelf: QuerySelf<TState> = {
    get state() {
      return state;
    },
    queries: defaultQueries,
  };
  const queryCtx: QueryCtx<TState> = { self: queryCtxSelf, getService: registryApi.getService };
  const loadCtxForStatic: LoadCtx<TState> = {
    self: {
      get state() {
        return state;
      },
      queries: defaultQueries,
      commands: commands as LoadSelf<TState>['commands'],
    },
    getService: registryApi.getService,
  };

  /**
   * Runs one query's `load` body against this runtime instance, drained to completion.
   *
   * Used by the static build pipeline to populate state for a single input without holding the
   * load in the in-flight registry afterwards.
   */
  const runLoadOnce = async (queryName: string, validatedInput: unknown): Promise<void> => {
    const queryDef = queryDefinitions.get(queryName);

    if (!queryDef || !queryDef.load) {
      return;
    }

    const loadKey = makeLoadKey(def.id, queryName, validatedInput);
    const ancestorChain = new Set<string>([loadKey]) as ReadonlySet<string>;

    await runLoadBody(refs, queryName, queryDef, validatedInput, ancestorChain);
  };

  return {
    getStateSnapshot,
    commandSelf,
    queryCtx,
    loadCtxForStatic,
    commands,
    queries,
    runLoadOnce,
  };
}

/** Re-export so external modules can address the in-flight load registry for tests if needed. */
export const __internalInFlightLoads = inFlightLoads;

/** Type referenced from the registry surface for cross-service callers. */
export type { RuntimeService };
