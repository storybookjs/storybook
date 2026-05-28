import { produce } from 'immer';
import { computed, effect, endBatch, signal, startBatch } from 'alien-signals';

import {
  OpenServiceInvalidStaticPathError,
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

/**
 * Process-global registry of in-flight `load` promises keyed by `${serviceId}::${queryName}::${hash}`.
 *
 * The dedup is in-flight only: once a load settles, its entry is removed so a subsequent call can
 * refire it. The same registry is consulted by both same-service and cross-service callers so two
 * queries that depend on the same dependency share one load.
 */
const inFlightLoads = new Map<string, Promise<unknown>>();

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
 * Bundling the references lets `createDefaultQuery`, `runLoadBody`, and `runLoaded` share the
 * same closure shape without each one re-deriving the per-service callbacks.
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
 * Handlers always see `refs.defaultQueries` on `ctx.self.queries`; load bodies do not get a
 * different map here because dependency tracking is explicit in this branch (authors chain
 * `.loaded()` themselves).
 */
function runHandlerSync<TState>(
  refs: QueryRuntimeRefs<TState>,
  queryName: string,
  queryDef: RuntimeQueryDefinition<TState>,
  validatedInput: unknown
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
    queries: refs.defaultQueries,
  };
  const handlerCtx: QueryCtx<TState> = {
    self: handlerSelf,
    getService: refs.registryApi.getService,
  };
  const result = queryDef.handler(validatedInput, handlerCtx);

  return validateQueryOutput(refs, queryName, queryDef, result);
}

/**
 * Triggers a `load` if one is not already in flight for the same key.
 *
 * Returns the in-flight promise (whether newly created or reused). The promise is registered into
 * `inFlightLoads` before the body runs so synchronous reentrant calls during the body's prefix
 * observe the load as in-flight and share the same promise. There is no cycle detection; authors
 * who write self-awaiting load chains (`a.load` calls `b.loaded()` which calls `a.loaded()`) will
 * deadlock — surface those bugs through tests.
 */
function triggerLoad<TState>(
  refs: QueryRuntimeRefs<TState>,
  queryName: string,
  queryDef: RuntimeQueryDefinition<TState>,
  validatedInput: unknown,
  loadKey: string
): Promise<unknown> {
  const existing = inFlightLoads.get(loadKey);
  if (existing) {
    return existing;
  }

  // Register the promise into `inFlightLoads` BEFORE the body runs so any reentrant query call
  // made inside the body's synchronous prefix sees this load as in-flight and reuses the same
  // promise instead of starting a duplicate run. The body is wrapped in `Promise.resolve().then`
  // to enforce a microtask boundary between registration and execution.
  const promise = Promise.resolve()
    .then(() => runLoadBody(refs, queryName, queryDef, validatedInput))
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
 * Executes one `load` invocation against the runtime's default `self`.
 *
 * The load body sees the same query map as a handler, with one difference: the load is async and
 * may call `await ctx.self.queries.foo.loaded(input)` (or `ctx.getService(id).queries.foo.loaded()`)
 * to explicitly await a dependency it needs settled. Sync reads inside the body fire dependent
 * loads in the background just like any other call site, but they are not awaited automatically.
 */
async function runLoadBody<TState>(
  refs: QueryRuntimeRefs<TState>,
  queryName: string,
  queryDef: RuntimeQueryDefinition<TState>,
  validatedInput: unknown
): Promise<void> {
  if (!queryDef.load) {
    return;
  }

  const loadSelf: LoadSelf<TState> = {
    get state() {
      return refs.stateSignal();
    },
    queries: refs.defaultQueries,
    commands: refs.commandSelf.commands as LoadSelf<TState>['commands'],
  };
  const loadCtx: LoadCtx<TState> = { self: loadSelf, getService: refs.registryApi.getService };

  await queryDef.load(validatedInput, loadCtx);
}

/**
 * Implements `query.loaded(input)`: await this query's own `load`, then return the handler result.
 *
 * Dependencies are *not* discovered automatically. A query whose handler reads another query is
 * responsible for awaiting that dependency inside its own `load` (`await ctx.self.queries.foo
 * .loaded(input)`). If it does not, `.loaded()` returns whatever the handler can read from the
 * current state — possibly a partial value. Authors should add a test that asserts the loaded
 * value to catch missing dependency awaits.
 */
async function runLoaded<TState>(
  refs: QueryRuntimeRefs<TState>,
  queryName: string,
  queryDef: RuntimeQueryDefinition<TState>,
  rawInput: unknown
): Promise<unknown> {
  const validatedInput = validateQueryInput(refs, queryName, queryDef, rawInput);

  if (queryDef.load) {
    const loadKey = makeLoadKey(refs.serviceId, queryName, validatedInput);
    await triggerLoad(refs, queryName, queryDef, validatedInput, loadKey);
  }

  return runHandlerSync(refs, queryName, queryDef, validatedInput);
}

/**
 * Creates the default query function exposed on the service runtime.
 *
 * Every call validates input, fires the dependency's `load` in the background (deduped while in
 * flight), and returns the handler result synchronously. The background load is fire-and-forget;
 * rejections are surfaced via `rethrowAsync` so they are not silently swallowed.
 */
function createDefaultQuery<TState>(
  refs: QueryRuntimeRefs<TState>,
  queryName: string,
  queryDef: RuntimeQueryDefinition<TState>
): Query<unknown, unknown> {
  const query = ((input: unknown) => {
    const validatedInput = validateQueryInput(refs, queryName, queryDef, input);

    if (queryDef.load) {
      const loadKey = makeLoadKey(refs.serviceId, queryName, validatedInput);
      // Background fire-and-forget: surface failures so they are not silently swallowed.
      triggerLoad(refs, queryName, queryDef, validatedInput, loadKey).catch(rethrowAsync);
    }

    return runHandlerSync(refs, queryName, queryDef, validatedInput);
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
      // Subscribers do not block on rejections, but we still want them visible to global handlers.
      triggerLoad(refs, queryName, queryDef, validatedInput, loadKey).catch(rethrowAsync);
    }

    const comp = computed(() => runHandlerSync(refs, queryName, queryDef, validatedInput));
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

  // Build queries after commands so handler and load ctx surfaces resolve the same command map.
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
   * Runs one query's `load` body against this runtime instance.
   *
   * Used by the static build pipeline to populate state for a single input without holding the
   * load in the process-global in-flight registry afterwards. Dependencies inside the load body
   * are awaited if (and only if) the author explicitly chained them via `.loaded()`.
   */
  const runLoadOnce = async (queryName: string, validatedInput: unknown): Promise<void> => {
    const queryDef = queryDefinitions.get(queryName);

    if (!queryDef || !queryDef.load) {
      return;
    }

    await runLoadBody(refs, queryName, queryDef, validatedInput);
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

/** Type referenced from the registry surface for cross-service callers. */
export type { RuntimeService };
