/**
 * Assembles the runtime for one registered service: the state signal, commands, and the static
 * loader. Queries, loads, and the `.loaded()` drain live in `query-runtime.ts`.
 */
import { batch } from '@preact/signals-core';
import { deepSignal } from 'deepsignal/core';

import {
  OpenServiceInvalidStaticPathError,
  OpenServiceUnimplementedOperationError,
} from '../../server-errors.ts';
import { type RecordedPatch, recordPatch } from './patch-recorder.ts';
import { clonePlain } from './plain-object.ts';
import {
  buildQueries,
  buildReactiveLoadQueries,
  inFlightLoads,
  makeInFlightKey,
  makeLoadKey,
  nextLoadScopeId,
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

/** Receives the ops one `setState` recipe wrote and their inverse, tagged with the command that ran it. */
export type EntryAuthor = (entry: RecordedPatch & { command: string }) => void;

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
  /**
   * Mutates the live state in one batch without recording or authoring an entry.
   *
   * For state that arrives from elsewhere (a peer's snapshot, a static file), never for writes this
   * runtime authors.
   */
  applyLocal(mutate: (state: TState) => void): void;
  /**
   * Installs the receiver for every entry a `setState` recipe on this runtime produces. Before the
   * channel is wired, entries are dropped.
   */
  attachEntryAuthor(author: EntryAuthor): void;
  queryCtx: QueryCtx<TState>;
  loadCtxForStatic: LoadCtx<TState>;
  commands: ServiceInstance<TState, TQueries, TCommands>['commands'];
  queries: ServiceInstance<TState, TQueries, TCommands>['queries'];
  runLoadOnce(queryName: string, validatedInput: unknown): Promise<void>;
  /**
   * Installs the channel-routed command map produced once the runtime is wired to the channel.
   *
   * Load bodies use this map (not the raw local one) so a command implemented only on a peer — e.g. a
   * server-only `extractDocgen` invoked from the manager's `docgen` load — is requested remotely
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
 * Builds the runtime command map from the declarative command definitions.
 *
 * Each runtime command validates raw caller input, invokes the handler with parsed values, and
 * validates the resolved output before returning it to the caller.
 */
function buildCommands<TState>(
  serviceId: ServiceId,
  commands: Commands<TState>,
  createCommandCtx: (commandName: string) => CommandCtx<TState>
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
          const output = await def.handler(validatedInput, createCommandCtx(name));

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
  applyLocal: (mutate: (state: TState) => void) => void
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
            applyLocal((state) => {
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
  // The plain backing object the deep-signal proxy writes through to, and the source for
  // serialization snapshots. Copied by value so the caller's object is never mutated and any
  // reference it shares between two keys becomes two separate objects.
  const rawState = clonePlain(initialState) as TState;
  // The deep reactive proxy is the single source of truth that query computations track, at
  // per-field granularity.
  const state = deepSignal(rawState as object) as TState;
  const getStateSnapshot = (): TState => structuredClone(rawState);
  const { registryApi, staticLoader } = runtimeOptions;

  let author: EntryAuthor = () => {};
  const applyLocal = (mutate: (state: TState) => void): void => {
    batch(() => {
      mutate(state);
    });
  };
  const writeState = (command: string, mutate: (state: TState) => void): void => {
    recordPatch(state as object, mutate as (draft: object) => void, (recorded) =>
      author({ command, ...recorded })
    );
  };

  const defaultQueries: Record<string, Query<unknown, unknown>> = {};
  // Populated after the default queries exist (their wrappers reference the default `getState` /
  // `loaded` / `subscribe`). See `buildReactiveLoadQueries`.
  const reactiveLoadQueries: Record<string, Query<unknown, unknown>> = {};

  const createCommandSelf = (
    setState: CommandSelf<TState>['setState'],
    commandsForSelf: () => CommandSelf<TState>['commands']
  ): CommandSelf<TState> => ({
    get state() {
      return state;
    },
    setState,
    queries: defaultQueries,
    get commands() {
      return commandsForSelf();
    },
  });

  const commands = buildCommands(def.id, def.commands, (commandName) => ({
    self: createCommandSelf(
      (mutate) => writeState(commandName, mutate),
      () => commands as CommandSelf<TState>['commands']
    ),
    getService: registryApi.getService,
  })) as ServiceInstance<TState, TQueries, TCommands>['commands'];

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
        applyLocal
      )
    : new Map<string, RuntimeQueryDefinition<TState>>(
        Object.entries(def.queries) as [string, RuntimeQueryDefinition<TState>][]
      );

  // Gated commands for reactive subscription loads: a stale run's writes are dropped once a newer
  // run has started (`isCurrent()` returns false), so superseded loads cannot clobber fresh state.
  const buildGatedCommands = (isCurrent: () => boolean): CommandSelf<TState>['commands'] => {
    const gated: CommandSelf<TState>['commands'] = buildCommands(
      def.id,
      def.commands,
      (commandName) => ({
        self: createCommandSelf(
          (mutate) => {
            if (isCurrent()) {
              writeState(commandName, mutate);
            }
          },
          () => gated
        ),
        getService: registryApi.getService,
      })
    ) as CommandSelf<TState>['commands'];

    // Route remote commands through the channel map (so a reactive load can invoke a peer command);
    // keep the gated local wrapper for locally-handled commands so stale-write protection holds.
    if (remoteCommandNames.size === 0) {
      return gated;
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

  const loadScopeId = nextLoadScopeId();

  const refs: QueryRuntimeRefs<TState> = {
    serviceId: def.id,
    loadScopeId,
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
    const inFlightKey = makeInFlightKey(loadScopeId, loadKey);

    const promise = Promise.resolve()
      .then(() => runLoadBody(refs, queryName, queryDef, validatedInput, ancestorChain))
      .finally(() => {
        if (inFlightLoads.get(inFlightKey) === promise) {
          inFlightLoads.delete(inFlightKey);
        }
      });

    inFlightLoads.set(inFlightKey, promise);
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
    applyLocal,
    attachEntryAuthor: (next) => {
      author = next;
    },
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
