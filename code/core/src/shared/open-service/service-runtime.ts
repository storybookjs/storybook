import { produce } from 'immer';
import { toMerged } from 'es-toolkit/object';
import { computed, effect, endBatch, signal, startBatch } from 'alien-signals';

import { rethrowAsync, validateSchema } from './service-validation.ts';
import type {
  AnySchema,
  Command,
  CommandCtx,
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

type ServiceSignal<TState> = ReturnType<typeof signal<TState>>;
type RuntimeQueryDefinition<TState> = QueryDefinition<TState, AnySchema, AnySchema>;
type RegisteredService = ServiceInstance<unknown, Queries<unknown>, Commands<unknown>>;
type StaticStateLoader = (input: unknown) => Promise<void>;

/**
 * Internal runtime object returned while a service instance is being assembled.
 *
 * It keeps the raw signal and `self` reference available for static building and store-backed
 * preloading, while callers typically consume the simpler `ServiceInstance` shape.
 */
export type ServiceRuntime<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
> = {
  stateSignal: ServiceSignal<TState>;
  selfRef: WritableSelf<TState>;
  queryCtx: QueryCtx<TState>;
  commands: ServiceInstance<TState, TQueries, TCommands>['commands'];
  queries: ServiceInstance<TState, TQueries, TCommands>['queries'];
};

/**
 * Resolves which serialized static-state file should back a query input.
 *
 * Queries without a custom `static.path()` share one default file per service.
 */
export function resolveStaticPath<TState>(
  serviceId: string,
  queryDef: RuntimeQueryDefinition<TState>,
  input: unknown,
  ctx: QueryCtx<TState>
): string {
  return queryDef.static?.path ? queryDef.static.path(input, ctx) : `${serviceId}.json`;
}

/**
 * Creates the mutable `self` object shared by runtime contexts.
 *
 * State writes are wrapped in an alien-signals batch so one command can update multiple fields
 * without causing unnecessary intermediate reactive notifications.
 */
function createSelfRef<TState>(stateSignal: ServiceSignal<TState>): WritableSelf<TState> {
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
  serviceId: string,
  commands: Commands<TState>,
  ctx: CommandCtx<TState>
): Command {
  return Object.fromEntries(
    Object.entries(commands).map(([name, def]) => {
      return [
        name,
        async (input: unknown) => {
          const validatedInput = await validateSchema(def.input, input, {
            kind: 'command',
            serviceId,
            name,
            phase: 'input',
          });
          const output = await def.handler(validatedInput, ctx);

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
 * Creates one runtime query function and its subscription API.
 *
 * Queries share the same validation contract as commands, but may also run preload logic and emit
 * reactive updates when subscribed to.
 */
function createQuery<TState>(
  serviceId: string,
  name: string,
  queryDef: RuntimeQueryDefinition<TState>,
  selfRef: WritableSelf<TState>,
  loadStaticState?: StaticStateLoader
): Query<unknown, unknown> {
  const createQueryCtx = (): QueryCtx<TState> => ({ self: selfRef });

  /** Runs the query handler and validates the resolved output value. */
  const runHandler = async (input: unknown): Promise<unknown> => {
    const output = await queryDef.handler(input, createQueryCtx());

    return validateSchema(queryDef.output, output, {
      kind: 'query',
      serviceId,
      name,
      phase: 'output',
    });
  };

  /** Runs either static-store preloading or the query's own preload hook before execution. */
  const prepareQuery = async (input: unknown): Promise<void> => {
    if (loadStaticState !== undefined) {
      await loadStaticState(input);
      return;
    }

    await queryDef.preload?.(input, createQueryCtx());
  };

  /**
   * Subscribes to a query by wiring an alien-signals computed around the handler.
   *
   * The initial emission and every subsequent emission are validated the same way direct query
   * calls are validated.
   */
  const subscribe = (input: unknown, callback: (value: unknown) => void): (() => void) => {
    let unsubscribe = () => {};
    let active = true;

    /** Connects the reactive computation after the caller input has been validated. */
    const connect = async (validatedInput: unknown) => {
      if (!active) {
        return;
      }

      // Kick off preload in parallel so subscriptions can observe the state transition it causes.
      void prepareQuery(validatedInput).catch(rethrowAsync);

      // `computed()` tracks which signals the handler reads so the effect can re-run on changes.
      const comp = computed(() => queryDef.handler(validatedInput, createQueryCtx()));
      unsubscribe = effect(() => {
        // Normalize sync and async handlers before validating and publishing the next value.
        void Promise.resolve(comp()).then(async (output) => {
          const validatedOutput = await validateSchema(queryDef.output, output, {
            kind: 'query',
            serviceId,
            name,
            phase: 'output',
          });

          if (active) {
            // Guard against late async completions after the subscriber has already unsubscribed.
            callback(validatedOutput);
          }
        }, rethrowAsync);
      });
    };

    // Validate once up front so the reactive graph only ever sees parsed query input.
    void validateSchema(queryDef.input, input, {
      kind: 'query',
      serviceId,
      name,
      phase: 'input',
    }).then(connect, rethrowAsync);

    return () => {
      active = false;
      unsubscribe();
    };
  };

  const query = (async (input: unknown) => {
    const validatedInput = await validateSchema(queryDef.input, input, {
      kind: 'query',
      serviceId,
      name,
      phase: 'input',
    });

    await prepareQuery(validatedInput);

    return runHandler(validatedInput);
  }) as Query<unknown, unknown>;

  query.subscribe = subscribe;
  return query;
}

/**
 * Creates a per-query static-state preloader backed by the generated static store map.
 *
 * Multiple requests for the same file path share the same pending merge promise so state is only
 * merged once per snapshot.
 */
function createStaticStateLoader<TState>(
  serviceId: string,
  queryDef: RuntimeQueryDefinition<TState>,
  stateSignal: ServiceSignal<TState>,
  selfRef: WritableSelf<TState>,
  store: StaticStore
): StaticStateLoader {
  const loadsByPath = new Map<string, Promise<void>>();

  return async (input: unknown) => {
    const path = resolveStaticPath(serviceId, queryDef, input, { self: selfRef });

    if (!loadsByPath.has(path)) {
      // Reuse the same in-flight load per path so concurrent callers share one state merge.
      loadsByPath.set(
        path,
        Promise.resolve(store[path]).then((slice) => {
          if (slice == null) {
            return;
          }

          // Merge the prebuilt snapshot into the live signal so later reads/subscriptions see it.
          stateSignal(toMerged(stateSignal() as object, slice as object) as TState);
        })
      );
    }

    return loadsByPath.get(path)!;
  };
}

/** Builds the runtime query map and optionally wires static-store-backed preloaders. */
function buildQueries<TState>(
  serviceId: string,
  queries: Queries<TState>,
  stateSignal: ServiceSignal<TState>,
  selfRef: WritableSelf<TState>,
  store?: StaticStore
): WritableSelf<TState>['queries'] {
  return Object.fromEntries(
    (Object.entries(queries) as [string, RuntimeQueryDefinition<TState>][]).map(
      ([name, queryDef]) => {
        let loadStaticState: StaticStateLoader | undefined;

        if (
          store !== undefined &&
          queryDef.preload !== undefined &&
          queryDef.static?.inputs !== undefined
        ) {
          loadStaticState = createStaticStateLoader(
            serviceId,
            queryDef,
            stateSignal,
            selfRef,
            store
          );
        }

        return [name, createQuery(serviceId, name, queryDef, selfRef, loadStaticState)];
      }
    )
  );
}

/**
 * Creates the full runtime backing for a service definition.
 *
 * This is the lowest-level runtime entry point used by both `createService()` and static builds.
 */
export function createServiceRuntime<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  def: ServiceDefinition<TState, TQueries, TCommands>,
  options?: CreateServiceOptions,
  initialState: TState = def.initialState
): ServiceRuntime<TState, TQueries, TCommands> {
  // The signal is the single source of truth that query computations subscribe to.
  const stateSignal = signal<TState>(initialState);
  const selfRef = createSelfRef(stateSignal);
  const commandCtx: CommandCtx<TState> = { self: selfRef };

  const commands = buildCommands(def.id, def.commands, commandCtx) as ServiceInstance<
    TState,
    TQueries,
    TCommands
  >['commands'];
  selfRef.commands = commands;

  // Queries are attached after commands so preload hooks can call into `ctx.self.commands`.
  const queries = buildQueries(
    def.id,
    def.queries,
    stateSignal,
    selfRef,
    options?.store
  ) as ServiceInstance<TState, TQueries, TCommands>['queries'];
  selfRef.queries = queries;

  return {
    stateSignal,
    selfRef,
    queryCtx: { self: selfRef },
    commands,
    queries,
  };
}

/** Creates a callable service instance from a declarative service definition. */
export function createService<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  def: ServiceDefinition<TState, TQueries, TCommands>,
  options?: CreateServiceOptions
): ServiceInstance<TState, TQueries, TCommands> {
  const runtime = createServiceRuntime(def, options);

  return {
    queries: runtime.queries,
    commands: runtime.commands,
  };
}

const registry = new Map<string, RegisteredService>();

/**
 * Returns a shared singleton instance for the given service definition.
 *
 * This is useful when multiple modules want to refer to the same in-memory service inside one
 * environment.
 */
export function getService<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  def: ServiceDefinition<TState, TQueries, TCommands>
): ServiceInstance<TState, TQueries, TCommands> {
  if (!registry.has(def.id)) {
    registry.set(def.id, createService(def) as RegisteredService);
  }

  return registry.get(def.id)! as ServiceInstance<TState, TQueries, TCommands>;
}

/** Clears the singleton registry, primarily for test isolation. */
export function clearRegistry(): void {
  registry.clear();
}
