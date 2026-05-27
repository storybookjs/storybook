import { produce } from 'immer';
import { computed, effect, endBatch, signal, startBatch } from 'alien-signals';

import {
  OpenServiceInvalidStaticPathError,
  OpenServiceUnimplementedOperationError,
} from '../../server-errors.ts';
import { rethrowAsync, validateSchema } from './service-validation.ts';
import type {
  AnySchema,
  Command,
  CommandCtx,
  Commands,
  CreateServiceRuntimeOptions,
  Queries,
  Query,
  QueryCtx,
  QueryDefinition,
  ServiceDefinition,
  ServiceId,
  ServiceInstance,
  ServiceRegistryApi,
  WritableSelf,
} from './types.ts';

type ServiceSignal<TState> = ReturnType<typeof signal<TState>>;
type RuntimeQueryDefinition<TState> = QueryDefinition<TState, AnySchema, AnySchema>;

/**
 * Internal runtime object returned while a service instance is being assembled.
 *
 * It keeps the raw signal and `self` reference available for static building and registration
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
  ctx: QueryCtx<TState>
): string {
  const rawPath = queryDef.static?.path ? queryDef.static.path(input, ctx) : `${serviceId}.json`;

  return normalizeStaticStoragePath(serviceId, name, rawPath);
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
 * Creates one runtime query function and its subscription API.
 *
 * Queries share the same validation contract as commands, but may also run preload logic and emit
 * reactive updates when subscribed to.
 */
function createQuery<TState>(
  serviceId: ServiceId,
  name: string,
  queryDef: RuntimeQueryDefinition<TState>,
  selfRef: WritableSelf<TState>,
  registryApi: ServiceRegistryApi
): Query<unknown, unknown> {
  const createQueryCtx = (): QueryCtx<TState> => ({
    self: selfRef,
    getService: registryApi.getService,
  });

  const getHandler = () => {
    if (!queryDef.handler) {
      throw new OpenServiceUnimplementedOperationError({
        kind: 'query',
        serviceId,
        name,
      });
    }

    return queryDef.handler;
  };

  /** Runs the query handler and validates the resolved output value. */
  const runHandler = async (input: unknown): Promise<unknown> => {
    const output = await getHandler()(input, createQueryCtx());

    return validateSchema(queryDef.output, output, {
      kind: 'query',
      serviceId,
      name,
      phase: 'output',
    });
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
      void Promise.resolve(queryDef.preload?.(validatedInput, createQueryCtx())).catch(
        rethrowAsync
      );

      // `computed()` tracks which signals the handler reads so the effect can re-run on changes.
      const comp = computed(() => getHandler()(validatedInput, createQueryCtx()));
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

    await queryDef.preload?.(validatedInput, createQueryCtx());

    return runHandler(validatedInput);
  }) as Query<unknown, unknown>;

  query.subscribe = subscribe;
  return query;
}

/** Builds the runtime query map for one service runtime. */
function buildQueries<TState>(
  serviceId: ServiceId,
  queries: Queries<TState>,
  selfRef: WritableSelf<TState>,
  registryApi: ServiceRegistryApi
): WritableSelf<TState>['queries'] {
  return Object.fromEntries(
    (Object.entries(queries) as [string, RuntimeQueryDefinition<TState>][]).map(
      ([name, queryDef]) => [name, createQuery(serviceId, name, queryDef, selfRef, registryApi)]
    )
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
  runtimeOptions: CreateServiceRuntimeOptions,
  initialState: TState = def.initialState
): ServiceRuntime<TState, TQueries, TCommands> {
  // The signal is the single source of truth that query computations subscribe to.
  const stateSignal = signal<TState>(initialState);
  const selfRef = createSelfRef(stateSignal);
  const { registryApi } = runtimeOptions;
  const createCommandCtx = (): CommandCtx<TState> => ({
    self: selfRef,
    getService: registryApi.getService,
  });

  const commands = buildCommands(def.id, def.commands, createCommandCtx) as ServiceInstance<
    TState,
    TQueries,
    TCommands
  >['commands'];
  selfRef.commands = commands;

  // Queries are attached after commands so preload hooks can call into `ctx.self.commands`.
  const queries = buildQueries(def.id, def.queries, selfRef, registryApi) as ServiceInstance<
    TState,
    TQueries,
    TCommands
  >['queries'];
  selfRef.queries = queries;

  return {
    stateSignal,
    selfRef,
    queryCtx: { self: selfRef, getService: registryApi.getService },
    commands,
    queries,
  };
}
