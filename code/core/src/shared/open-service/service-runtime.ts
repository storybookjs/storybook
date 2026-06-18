/**
 * # service-runtime
 *
 * Builds the runtime surface for one registered service: state signal, sync queries with
 * `.loaded()` and `.subscribe()`, async commands, and the in-flight load registry that powers
 * dependency tracking for `.loaded()`.
 *
 * ## Mental model in one paragraph
 *
 * `query.get(input)` is a synchronous, pure read: it validates input, calls the handler against
 * current state, and returns the result immediately. It does **not** fire the query's `load` — a
 * read never starts background work. Loads fire only through `query.subscribe(...)` (reactively,
 * re-firing as tracked state changes) and `query.loaded(input)` (the "wait until fully loaded"
 * form). `.loaded()` must guarantee that **every dependency the handler transitively reads is
 * settled** before returning, even though those dependencies are not declared statically anywhere.
 * That guarantee is what the drain machinery in this file exists to provide. When a handler or load
 * body reads a *dependency* via `.get()` inside a `.loaded()` drain or a load body, that read still
 * triggers and awaits the dependency's load; a bare consumer `.get()` does not.
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
import { batch } from '@preact/signals-core';
import { deepSignal } from 'deepsignal/core';

import {
  OpenServiceInvalidStaticPathError,
  OpenServiceUnimplementedOperationError,
} from '../../server-errors.ts';
import {
  buildQueries,
  buildReactiveLoadQueries,
  inFlightLoads,
  makeLoadKey,
  runLoadBody,
} from './query-runtime.ts';
import type { QueryRuntimeRefs, RuntimeQueryDefinition } from './query-runtime.ts';
import { applyStatePatch } from './service-sync.ts';
import { validateSchema } from './service-validation.ts';
import type { StaticLoader } from './static-fetch.ts';
import type {
  Command,
  CommandCtx,
  CommandSelf,
  Commands,
  LoadCtx,
  LoadSelf,
  Queries,
  Query,
  QueryCtx,
  QuerySelf,
  RuntimeService,
  ServiceDefinition,
  ServiceId,
  ServiceInstance,
  ServiceRegistryApi,
} from './types.ts';

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
  /**
   * Installs the channel-routed command map produced once the runtime is wired to the channel.
   *
   * Load bodies use this map (not the raw local one) so a command implemented only on a peer — e.g. a
   * server-only `extractDocgen` invoked from the manager's `getDocgen` load — is requested remotely
   * instead of throwing `OpenServiceUnimplementedOperationError` locally. Command names not in
   * `implementedCommandNames` are treated as remote and routed through this map even inside the
   * stale-write-gated reactive load path (remote calls carry no local `setState` to gate).
   */
  attachChannelCommands(
    commands: Record<string, (input: unknown) => Promise<unknown>>,
    implementedCommandNames: ReadonlySet<string>
  ): void;
};

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
 * Creates the writable `self` object that backs every runtime ctx for one service instance.
 *
 * State is a deep reactive proxy: mutations applied to `state` notify only the fine-grained signals
 * for the fields that actually changed. Writes are wrapped in a batch so one command only notifies
 * subscribers after the full mutation completes.
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
 * When a browser static loader is active, queries with `staticPath` fetch prebuilt JSON instead of
 * running their authored `load` hook (which typically invokes server-only commands).
 */
function buildQueryDefinitionsWithStaticLoader<TState>(
  serviceId: ServiceId,
  queries: Record<string, RuntimeQueryDefinition<TState>>,
  staticLoader: StaticLoader,
  setState: CommandSelf<TState>['setState']
): Map<string, RuntimeQueryDefinition<TState>> {
  return new Map(
    Object.entries(queries).map(([name, queryDef]) => {
      if (!queryDef.staticPath) {
        return [name, queryDef] as [string, RuntimeQueryDefinition<TState>];
      }

      const { staticPath } = queryDef;

      return [
        name,
        {
          ...queryDef,
          load: async (input: unknown) => {
            const logicalPath = resolveStaticPath(serviceId, name, { staticPath }, input);
            const snapshot = await staticLoader(logicalPath, {
              serviceId,
              queryName: name,
              input,
            });

            // Unlike reactive loads (which gate writes through `buildGatedCommands` so a superseded
            // run cannot clobber a newer one), this write is ungated. Static snapshots are immutable
            // and keyed per input via `staticPath(input)`, so re-running the same input produces
            // identical data and `preserveMissingKeys: true` never erases a sibling input's state —
            // there is no stale-write race to guard against.
            setState((state) => {
              applyStatePatch(state as Record<string, unknown>, snapshot, {
                preserveMissingKeys: true,
              });
            });
          },
        },
      ] as [string, RuntimeQueryDefinition<TState>];
    })
  );
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
    staticLoader?: StaticLoader;
  },
  initialState: TState = def.initialState
): ServiceRuntime<TState, TQueries, TCommands> {
  // `initialState` is the plain backing object that the deep-signal proxy writes through to; it
  // stays in sync with every mutation and is the source for serialization snapshots. The runtime
  // mutates it in place, so callers that share an object (e.g. a definition's `initialState`) must
  // pass their own copy — `registerService` and the static build each do.
  const rawState = initialState;
  // The deep reactive proxy is the single source of truth that query computations track, at
  // per-field granularity.
  const state = deepSignal(rawState as object) as TState;
  const getStateSnapshot = (): TState => structuredClone(rawState);
  const commandSelf = createCommandSelf(state);
  const { registryApi, staticLoader } = runtimeOptions;
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

  // The command map load bodies should call. Defaults to the raw local map (used by the static build
  // and before the channel is wired); `attachChannelCommands` swaps in the channel-routed map so
  // loads can invoke peer-implemented commands remotely. `remoteCommandNames` is the set of commands
  // with no local handler in this runtime, which the gated reactive-load path routes through the
  // channel map directly (they have no local `setState` to gate).
  let loadCommands = commands as CommandSelf<TState>['commands'];
  const remoteCommandNames = new Set<string>();

  const queryDefinitions = staticLoader
    ? buildQueryDefinitionsWithStaticLoader(
        def.id,
        def.queries as Record<string, RuntimeQueryDefinition<TState>>,
        staticLoader,
        commandSelf.setState
      )
    : new Map<string, RuntimeQueryDefinition<TState>>(
        Object.entries(def.queries) as [string, RuntimeQueryDefinition<TState>][]
      );
  const defaultQueries: Record<string, Query<unknown, unknown>> = {};
  // Populated after the default queries exist (their wrappers reference the default `getState` /
  // `loaded` / `subscribe`). See `buildReactiveLoadQueries`.
  const reactiveLoadQueries: Record<string, Query<unknown, unknown>> = {};

  // Gated commands for reactive subscription loads: a stale run's writes are dropped once a newer
  // run has started (`isCurrent()` returns false), so superseded loads cannot clobber fresh state.
  const buildGatedCommands = (isCurrent: () => boolean): CommandSelf<TState>['commands'] => {
    const gatedSelf: CommandSelf<TState> = {
      get state() {
        return state;
      },
      setState(mutate) {
        if (!isCurrent()) {
          return;
        }
        batch(() => {
          mutate(state);
        });
      },
      queries: defaultQueries,
      commands: {},
    };
    const gated = buildCommands(def.id, def.commands, () => ({
      self: gatedSelf,
      getService: registryApi.getService,
    }));
    gatedSelf.commands = gated as CommandSelf<TState>['commands'];

    // Route remote commands through the channel map (so a reactive load can invoke a peer command);
    // keep the gated local wrapper for locally-handled commands so stale-write protection holds.
    if (remoteCommandNames.size === 0) {
      return gated as CommandSelf<TState>['commands'];
    }
    const routed = Object.fromEntries(
      Object.keys(def.commands).map((name) => [
        name,
        remoteCommandNames.has(name)
          ? (loadCommands as Record<string, unknown>)[name]
          : (gated as Record<string, unknown>)[name],
      ])
    );
    return routed as CommandSelf<TState>['commands'];
  };

  const refs: QueryRuntimeRefs<TState> = {
    serviceId: def.id,
    commandSelf,
    state,
    registryApi,
    queryDefinitions,
    defaultQueries,
    reactiveLoadQueries,
    getLoadCommands: () => loadCommands,
    buildGatedCommands,
  };

  // Build queries after commands so handler/load ctx surfaces resolve the same command map.
  const builtQueries = buildQueries(refs);
  for (const [name, query] of Object.entries(builtQueries)) {
    defaultQueries[name] = query;
  }
  // Reactive-load wrappers reference the default queries, so build them once those exist.
  for (const [name, query] of Object.entries(buildReactiveLoadQueries(refs))) {
    reactiveLoadQueries[name] = query;
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

    // Register this runtime's root load without joining an unrelated in-flight entry from another
    // runtime instance (e.g. the live singleton during parallel staticInputs resolution).
    const previous = inFlightLoads.get(loadKey);
    const promise = Promise.resolve()
      .then(() => runLoadBody(refs, queryName, queryDef, validatedInput, ancestorChain))
      .finally(() => {
        if (inFlightLoads.get(loadKey) === promise) {
          if (previous) {
            inFlightLoads.set(loadKey, previous);
          } else {
            inFlightLoads.delete(loadKey);
          }
        }
      });

    inFlightLoads.set(loadKey, promise);
    await promise;
  };

  const attachChannelCommands = (
    channelCommands: Record<string, (input: unknown) => Promise<unknown>>,
    implementedCommandNames: ReadonlySet<string>
  ): void => {
    loadCommands = channelCommands as CommandSelf<TState>['commands'];
    remoteCommandNames.clear();
    for (const name of Object.keys(def.commands)) {
      if (!implementedCommandNames.has(name)) {
        remoteCommandNames.add(name);
      }
    }
  };

  return {
    getStateSnapshot,
    commandSelf,
    queryCtx,
    loadCtxForStatic,
    commands,
    queries,
    runLoadOnce,
    attachChannelCommands,
  };
}

/** Re-export so external modules can address the in-flight load registry for tests if needed. */
export const __internalInFlightLoads = inFlightLoads;

/** Type referenced from the registry surface for cross-service callers. */
export type { RuntimeService };
