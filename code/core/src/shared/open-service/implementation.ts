/**
 * Signal-based service system — reactivity layer
 *
 * Uses alien-signals for automatic fine-grained reactivity.
 *
 * Why not deepsignal?
 *   deepsignal lets you write mutable-style updates (state.x = ...) and tracks
 *   at the individual property level. We use Immer-powered draft updates
 *   instead (setState(draft => { draft.x = ... })). computed() already memoizes by reference
 *   equality: when storyA changes, the computed for storyB re-evaluates but
 *   returns the same reference, so its effect does NOT fire. Fine-grained
 *   reactivity falls out of computed memoization for free.
 *
 * alien-signals API:
 *   s()     read a signal
 *   s(x)    write a signal
 *   comp()  read a computed
 *   startBatch() / endBatch()       batch writes into one notification flush
 */

import { produce } from 'immer';
import { toMerged } from 'es-toolkit/object';
import { computed, effect, endBatch, signal, startBatch } from 'alien-signals';
import type {
  BuildTaskResult,
  CommandCtx,
  CommandDefinition,
  Command,
  Commands,
  CreateServiceOptions,
  Queries,
  Query,
  QueryCtx,
  QueryDefinition,
  ServiceDefinition,
  ServiceInstance,
  StaticStore,
  WritableSelf,
} from './types.ts';

export type {
  CommandCtx,
  CommandDefinition,
  Command,
  CreateServiceOptions,
  Query,
  QueryCtx,
  QueryDefinition,
  ServiceDefinition,
  ServiceInstance,
  StaticStore,
} from './types.ts';

export const defineQuery = <TState, TInput, TOutput>(
  def: QueryDefinition<TState, TInput, TOutput>
): QueryDefinition<TState, TInput, TOutput> => def;

export const defineCommand = <TState, TInput>(
  def: CommandDefinition<TState, TInput>
): CommandDefinition<TState, TInput> => def;

export const defineService = <
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  def: ServiceDefinition<TState, TQueries, TCommands>
) => def;

function resolveStaticPath(
  serviceId: string,
  queryDef: QueryDefinition<any, any, any>,
  input: unknown,
  ctx: QueryCtx<any>
): string {
  return queryDef.static?.path ? queryDef.static.path(input as any, ctx) : `${serviceId}.json`;
}

function createSelfRef<TState>(
  stateSignal: ReturnType<typeof signal<TState>>
): WritableSelf<TState> {
  return {
    get state() {
      return stateSignal();
    },
    setState(mutate) {
      startBatch();
      stateSignal(produce(stateSignal(), mutate));
      endBatch();
    },
    queries: {},
    commands: {},
  };
}

function buildCommands<TState>(
  commands: Commands<TState>,
  ctx: CommandCtx<TState>
): Command {
  return Object.fromEntries(
    Object.entries(commands).map(([name, def]) => [
      name,
      async (input: any) => def.handler(input, ctx),
    ])
  );
}

function createQuery<TState>(
  queryDef: QueryDefinition<TState, any, any>,
  selfRef: WritableSelf<TState>,
  loadStaticState?: (input: any) => Promise<void>
): Query<any, any> {
  const createQueryCtx = (): QueryCtx<TState> => ({ self: selfRef });

  const subscribeMethod = (input: any, cb: (value: any) => void): (() => void) => {
    if (loadStaticState !== undefined) {
      void loadStaticState(input);
    } else {
      void queryDef.preload?.(input, createQueryCtx());
    }

    const comp = computed(() => queryDef.handler(input, createQueryCtx()));
    return effect(() => {
      cb(comp());
    });
  };

  const query = ((input: any): any => {
    if (loadStaticState !== undefined) {
      return loadStaticState(input).then(() => queryDef.handler(input, createQueryCtx()));
    }

    const pending = queryDef.preload?.(input, createQueryCtx());
    if (pending instanceof Promise) {
      return pending.then(() => queryDef.handler(input, createQueryCtx()));
    }

    return queryDef.handler(input, createQueryCtx());
  }) as Query<any, any>;

  query.subscribe = subscribeMethod;
  return query;
}

function buildQueries<TState>(
  serviceId: string,
  queries: Queries<TState>,
  stateSignal: ReturnType<typeof signal<TState>>,
  selfRef: WritableSelf<TState>,
  store?: StaticStore
): WritableSelf<TState>['queries'] {
  return Object.fromEntries(
    (Object.entries(queries) as [string, QueryDefinition<TState, any, any>][]).map(
      ([name, queryDef]) => {
        let loadStaticState: ((input: any) => Promise<void>) | undefined;

        if (
          store !== undefined &&
          queryDef.preload !== undefined &&
          queryDef.static?.inputs !== undefined
        ) {
          loadStaticState = createStaticStateLoader(serviceId, queryDef, stateSignal, selfRef, store);
        }

        return [name, createQuery(queryDef, selfRef, loadStaticState)];
      }
    )
  );
}

function createStaticStateLoader<TState>(
  serviceId: string,
  queryDef: QueryDefinition<TState, any, any>,
  stateSignal: ReturnType<typeof signal<TState>>,
  selfRef: WritableSelf<TState>,
  store: StaticStore
): (input: any) => Promise<void> {
  const loadsByPath = new Map<string, Promise<void>>();

  return async (input: any) => {
    const path = resolveStaticPath(serviceId, queryDef, input, { self: selfRef });

    if (!loadsByPath.has(path)) {
      loadsByPath.set(
        path,
        Promise.resolve(store[path]).then((slice) => {
          if (slice == null) return;
          stateSignal(toMerged(stateSignal() as object, slice as object) as TState);
        })
      );
    }

    return loadsByPath.get(path)!;
  };
}

type BuildRuntime<TState> = {
  stateSignal: ReturnType<typeof signal<TState>>;
  queryCtx: QueryCtx<TState>;
};

function createBuildRuntime<TState>(
  def: ServiceDefinition<TState, Queries<TState>, Commands<TState>>
): BuildRuntime<TState> {
  const stateSignal = signal(structuredClone(def.initialState));
  const selfRef = createSelfRef(stateSignal);
  const commandCtx: CommandCtx<TState> = { self: selfRef };

  selfRef.commands = buildCommands(def.commands, commandCtx);
  selfRef.queries = buildQueries(def.id, def.queries, stateSignal, selfRef);

  return {
    stateSignal,
    queryCtx: { self: selfRef },
  };
}

export function createService<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  def: ServiceDefinition<TState, TQueries, TCommands>,
  options?: CreateServiceOptions
): ServiceInstance<TState, TQueries, TCommands> {
  const stateSignal = signal<TState>(def.initialState);
  const store = options?.store;
  const selfRef = createSelfRef(stateSignal);
  const ctx: CommandCtx<TState> = { self: selfRef };

  const commands = buildCommands(def.commands, ctx);
  selfRef.commands = commands;

  const queries = buildQueries(def.id, def.queries, stateSignal, selfRef, store);
  selfRef.queries = queries;

  return { queries, commands } as ServiceInstance<TState, TQueries, TCommands>;
}

const registry = new Map<string, ServiceInstance<any, any, any>>();

export function getService<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  def: ServiceDefinition<TState, TQueries, TCommands>
): ServiceInstance<TState, TQueries, TCommands> {
  if (!registry.has(def.id)) {
    registry.set(def.id, createService(def));
  }

  return registry.get(def.id)! as ServiceInstance<TState, TQueries, TCommands>;
}

export async function buildStaticFiles(
  services: ServiceDefinition<any, any, any>[]
): Promise<StaticStore> {
  const store: StaticStore = {};
  const buildTasks: Promise<BuildTaskResult>[] = [];

  for (const def of services) {
    for (const [, queryDef] of Object.entries(def.queries) as [
      string,
      QueryDefinition<any, any, any>,
    ][]) {
      if (!queryDef.preload || !queryDef.static?.inputs) continue;

      const inputsRuntime = createBuildRuntime(def);
      const inputs = await queryDef.static.inputs(inputsRuntime.queryCtx);

      buildTasks.push(
        ...inputs.map(async (input) => {
          const buildRuntime = createBuildRuntime(def);
          const path = resolveStaticPath(def.id, queryDef, input, buildRuntime.queryCtx);

          await queryDef.preload!(input, buildRuntime.queryCtx);

          return { path, state: buildRuntime.stateSignal() };
        })
      );
    }
  }

  const builtStates = await Promise.all(buildTasks);

  for (const { path, state } of builtStates) {
    store[path] = path in store ? toMerged(store[path] as object, state as object) : state;
  }

  return store;
}

export function clearRegistry(): void {
  registry.clear();
}
