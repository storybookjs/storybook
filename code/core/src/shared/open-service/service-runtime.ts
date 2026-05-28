import { produce } from 'immer';
import { computed, effect, endBatch, signal, startBatch } from 'alien-signals';

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

type ServiceSignal<TState> = ReturnType<typeof signal<TState>>;
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
  stateSignal: ServiceSignal<TState>;
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
 * Queries without a custom `static.path()` share one default file per service. The returned value
 * is a logical slash-separated store key, not a raw filesystem path.
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

export function resolveStaticPath<TState>(
  serviceId: ServiceId,
  name: string,
  queryDef: RuntimeQueryDefinition<TState>,
  input: unknown,
  ctx: LoadCtx<TState>
): string {
  const rawPath = queryDef.static?.path ? queryDef.static.path(input, ctx) : `${serviceId}.json`;

  return normalizeStaticStoragePath(serviceId, name, rawPath);
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
 * State writes are wrapped in an alien-signals batch so one command can update multiple fields
 * without causing intermediate reactive notifications between writes.
 */
function createCommandSelf<TState>(stateSignal: ServiceSignal<TState>): CommandSelf<TState> {
  return {
    get state() {
      return stateSignal();
    },
    setState(mutate) {
      // Batch signal writes so one command only triggers subscribers after the full draft update.
      startBatch();
      try {
        stateSignal(produce(stateSignal(), mutate));
      } finally {
        endBatch();
      }
    },
    queries: {},
    commands: {},
  };
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
  stateSignal: ServiceSignal<TState>;
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
      return refs.stateSignal();
    },
    queries: selfQueries,
  };
  const handlerCtx: QueryCtx<TState> = { self: handlerSelf, getService };
  const result = queryDef.handler(validatedInput, handlerCtx);

  return validateQueryOutput(refs, queryName, queryDef, result);
}

/**
 * Triggers a `load` if one is not already in flight for the same key.
 *
 * Returns the in-flight promise (whether newly created or reused). The parent caller passes its
 * own ancestor chain; the dependency runs with that chain extended by its own load key so any
 * transitive read of an ancestor's load short-circuits via cycle detection instead of deadlocking.
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

  // Register the promise into `inFlightLoads` BEFORE the load body starts so any recursive query
  // call made inside the body's synchronous prefix sees this load as in-flight and short-circuits
  // via cycle detection instead of starting a duplicate run.
  const promise = Promise.resolve()
    .then(() => runLoadBody(refs, queryName, queryDef, validatedInput, extendedChain))
    .finally(() => {
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
 * The wrapper around `self.queries` registers transitively triggered loads into the local
 * collector so the returned promise only resolves once every dependency the load body touched has
 * also settled. Cross-service `getService(...).queries.*` calls are intentionally not wrapped —
 * authors must use `.loaded()` when they need to await cross-service dependencies inside a load.
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
      return refs.stateSignal();
    },
    queries: wrappedQueries,
    commands: refs.commandSelf.commands as LoadSelf<TState>['commands'],
  };
  const loadCtx: LoadCtx<TState> = { self: loadSelf, getService: refs.registryApi.getService };

  await Promise.resolve(queryDef.load(validatedInput, loadCtx));
  await drainCollector(collector, undefined, refs.serviceId, queryName);
}

/**
 * Wraps each query so calls inside a load body register the dependency's load into the load-local
 * collector.
 *
 * Wrappers honor cycle detection: a dependency whose key is already in the caller's ancestor chain
 * is skipped (not added to the collector) to prevent self-awaiting deadlocks. Nested handler reads
 * use the same wrappers so transitive dependencies also flow into the same collector. `.loaded()`
 * inherits the ancestor chain so a load-body author can still write `await ctx.self.queries.foo
 * .loaded(input)` without risking deadlock against itself. `.subscribe` passes through unchanged
 * because subscriptions never participate in the load drain.
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

      return runHandlerSync(
        refs,
        name,
        queryDef,
        validatedInput,
        wrappedQueries,
        refs.registryApi.getService
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
 * Implements `query.loaded(input)` by draining all transitively triggered loads before reading.
 *
 * The discovery loop alternates draining the collector with re-running the sync handler. The
 * handler reveals freshly-callable dependencies after each state change; once a discovery pass
 * adds nothing new, the loop terminates and the function returns the final validated output.
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

  return runHandlerSync(
    refs,
    queryName,
    queryDef,
    validatedInput,
    refs.defaultQueries,
    refs.registryApi.getService
  );
}

/**
 * Creates the default query function exposed on the service runtime.
 *
 * Every call validates input, fires the dependency's `load` in the background (deduped while in
 * flight), and returns the handler result synchronously. If the call runs inside a `.loaded()`
 * discovery pass, the load promise is also registered into the session collector so the caller
 * can await it before returning.
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
          session.collector.add({ key: loadKey, promise });
        } else {
          // Background fire-and-forget: surface failures so they are not silently swallowed.
          promise.catch(rethrowAsync);
        }
      }
    }

    return runHandlerSync(
      refs,
      queryName,
      queryDef,
      validatedInput,
      refs.defaultQueries,
      refs.registryApi.getService
    );
  }) as Query<unknown, unknown>;

  query.loaded = (input: unknown) => runLoaded(refs, queryName, queryDef, input);
  query.subscribe = (input: unknown, callback: (value: unknown) => void): (() => void) =>
    subscribeToQuery(refs, queryName, queryDef, input, callback);

  return query;
}

/**
 * Subscribes to a query by running its handler under an alien-signals `computed()` and `effect()`.
 *
 * The first emission is deferred to a microtask so callers always receive their unsubscribe handle
 * before the callback fires. The runtime kicks `load` off in the background but does not wait for
 * it — subscribers see the current state immediately and a follow-up emission once the load
 * settles and tracked state changes.
 */
function subscribeToQuery<TState>(
  refs: QueryRuntimeRefs<TState>,
  queryName: string,
  queryDef: RuntimeQueryDefinition<TState>,
  rawInput: unknown,
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

    const comp = computed(() =>
      runHandlerSync(
        refs,
        queryName,
        queryDef,
        validatedInput,
        refs.defaultQueries,
        refs.registryApi.getService
      )
    );
    teardown = effect(() => {
      let value: unknown;
      try {
        value = comp();
      } catch (error) {
        rethrowAsync(error);
        return;
      }

      if (active) {
        callback(value);
      }
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
  // The signal is the single source of truth that query computations subscribe to.
  const stateSignal = signal<TState>(initialState);
  const commandSelf = createCommandSelf(stateSignal);
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
    stateSignal,
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
      return stateSignal();
    },
    queries: defaultQueries,
  };
  const queryCtx: QueryCtx<TState> = { self: queryCtxSelf, getService: registryApi.getService };
  const loadCtxForStatic: LoadCtx<TState> = {
    self: {
      get state() {
        return stateSignal();
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
    stateSignal,
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
