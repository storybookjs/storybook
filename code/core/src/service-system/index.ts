/**
 * Signal-based service system — reactivity layer
 *
 * Uses alien-signals for automatic fine-grained reactivity.
 *
 * Why not deepsignal?
 *   deepsignal lets you write mutable-style updates (state.x = ...) and tracks
 *   at the individual property level. We use immutable updates instead
 *   (setState(s => ({...s, x: ...}))). computed() already memoizes by reference
 *   equality: when storyA changes, the computed for storyB re-evaluates but
 *   returns the same reference, so its effect does NOT fire. Fine-grained
 *   reactivity falls out of computed memoization for free.
 *
 * alien-signals API:
 *   s()     read a signal
 *   s(x)    write a signal
 *   comp()  read a computed
 *   startBatch() / endBatch()       batch writes into one notification flush
 *   setActiveSub(undefined) → read → setActiveSub(prev)  untracked read
 */

import { toMerged } from 'es-toolkit';
import { computed, effect, endBatch, setActiveSub, signal, startBatch } from 'alien-signals';

// ------------------------------------------------------------------ types --

type CommandExecutors = Record<string, (input: any) => Promise<void>>;

export type AsyncQueryAccessor<TInput, TOutput> = {
  (input: TInput): Promise<TOutput>;
  subscribe(input: TInput, callback: (value: TOutput) => void): () => void;
};

type ReadonlySelf<TState = any> = {
  readonly state: TState;
  queries: Record<string, AsyncQueryAccessor<any, any>>;
  commands: CommandExecutors;
};

type WritableSelf<TState = any> = ReadonlySelf<TState> & {
  setState(updater: (prev: TState) => TState): void;
};

export type QueryCtx<TState> = {
  self: ReadonlySelf<TState>;
};

export type CommandCtx<TState> = {
  self: WritableSelf<TState>;
};

export type QueryDef<TState, TInput, TOutput> = {
  /** Derives output from (input, ctx) where ctx.self.state is the current state snapshot. */
  handler: (input: TInput, ctx: QueryCtx<TState>) => TOutput;
  /**
   * Optional. Called once when subscribe() is set up AND on direct calls.
   *
   * - **Fire-and-forget** (`void` return): state is loaded in the background.
   *   `subscribe()` will be notified reactively when it arrives.
   *   Direct calls resolve immediately with whatever is in state right now.
   *
   * - **Awaitable** (`Promise<void>` return): direct calls wait for the
   *   preload to finish before returning the loaded value. `subscribe()` still
   *   works reactively regardless of which form you use.
   *
   * @example fire-and-forget (subscribe only)
   * preload: (input, ctx) => {
  *   if (!ctx.self.state[input.storyId]) ctx.self.commands.loadStatus(input);
   * }
   *
   * @example awaitable (direct call waits for the load)
   * preload: (input, ctx) => {
  *   if (!ctx.self.state[input.storyId]) return ctx.self.commands.loadStatus(input);
   * }
   */
  preload?: (input: TInput, ctx: QueryCtx<TState>) => void | Promise<void>;
  /**
   * Optional. Enables static-mode support for this query.
   *
   * At build time, `inputs()` enumerates the query inputs to precompute. For
   * each input, `preload` is run against a fresh copy of `initialState` and the
   * resulting state is written to `path(input)`.
   *
   * At runtime in static mode, the query accessor loads the captured state
   * slice from the static store and deep-merges it into the service signal
   * before running the query handler.
   */
  static?: {
    path?: (input: TInput, ctx: QueryCtx<TState>) => string;
    inputs: (ctx: QueryCtx<TState>) => TInput[] | Promise<TInput[]>;
  };
};

export type CommandDef<TState, TInput> = {
  /**
   * May be sync or async. The executor always returns Promise<void> so callers
   * can uniformly `await service.commands.anything()` regardless.
   */
  handler: (input: TInput, ctx: CommandCtx<TState>) => void | Promise<void>;
};

type Queries<TState> = Record<string, QueryDef<TState, any, any>>;
type Commands<TState> = Record<string, CommandDef<TState, any>>;

export type ServiceDef<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
> = {
  id: string;
  initialState: TState;
  queries: TQueries;
  commands: TCommands;
};

export type ServiceInstance<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
> = {
  queries: {
    [TKey in keyof TQueries]: TQueries[TKey] extends QueryDef<TState, infer TInput, infer TOutput>
      ? AsyncQueryAccessor<TInput, TOutput>
      : never;
  };
  commands: {
    [TKey in keyof TCommands]: TCommands[TKey] extends CommandDef<TState, infer TInput>
      ? (input: TInput) => Promise<void>
      : never;
  };
};

// --------------------------------------------------------------- factory --

export const defineQuery = <TState, TInput, TOutput>(
  def: QueryDef<TState, TInput, TOutput>
): QueryDef<TState, TInput, TOutput> => def;
export const defineCommand = <TState, TInput>(
  def: CommandDef<TState, TInput>
): CommandDef<TState, TInput> => def;
export const defineService = <
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(
  def: ServiceDef<TState, TQueries, TCommands>
) => def;

// --------------------------------------------------------- internal impl --

/**
 * Serialises a value with sorted object keys so the result is consistent
 * regardless of property insertion order. Used as input to hashInput.
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      return Object.fromEntries(Object.entries(val as object).sort());
    }
    return val;
  });
}

/**
 * FNV-1a 32-bit hash. Returns an 8-character lowercase hex string.
 *
 * Used to derive filesystem-safe, deterministic store key segments from
 * arbitrary input objects. Pure JS — works in Node.js and browser without
 * any crypto API dependency.
 */
function hashInput(value: unknown): string {
  const str = stableStringify(value);
  let h = 0x811c9dc5; // FNV-1a offset basis
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0; // FNV prime, keep unsigned 32-bit
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Returns the store key for a given (service, query, input) triple.
 * When `queryDef.static.path` is provided it is used as-is; otherwise a
 * deterministic default of `{serviceId}/{queryName}/{hash}.json` is
 * generated — where `hash` is an 8-char FNV-1a hex digest of the
 * stable-stringified input — so authors rarely need to specify a path.
 */
function resolveStaticPath(
  serviceId: string,
  queryName: string,
  queryDef: QueryDef<any, any, any>,
  input: unknown,
  ctx: QueryCtx<any>
): string {
  return queryDef.static?.path
    ? queryDef.static.path(input as any, ctx)
    : `${serviceId}/${queryName}/${hashInput(input)}.json`;
}

/** Internal registry entry — includes the raw signal for serialization. */
type InternalService = {
  queries: Record<string, AsyncQueryAccessor<any, any>>;
  commands: CommandExecutors;
  _stateSignal: ReturnType<typeof signal<any>>;
};

function createSelfRef<TState>(stateSignal: ReturnType<typeof signal<TState>>): WritableSelf<TState> {
  return {
    get state() {
      return stateSignal();
    },
    setState(updater) {
      startBatch();
      stateSignal(updater(stateSignal()));
      endBatch();
    },
    queries: {},
    commands: {},
  };
}

function buildCommandExecutors<TState>(
  commands: Commands<TState>,
  ctx: CommandCtx<TState>
): CommandExecutors {
  return Object.fromEntries(
    Object.entries(commands).map(([name, def]) => [
      name,
      // async wrapper: normalises sync and async handlers to Promise<void>.
      // A sync handler (void) is still awaitable at call sites this way,
      // and async handlers already return a Promise — async covers both cases.
      async (input: any) => def.handler(input, ctx),
    ])
  );
}

function buildQueryAccessor<TState>(
  queryDef: QueryDef<TState, any, any>,
  stateSignal: ReturnType<typeof signal<TState>>,
  selfRef: WritableSelf<TState>,
  loadStaticState?: (input: any) => Promise<void>
): AsyncQueryAccessor<any, any> {
  const createQueryCtx = (_state: TState): QueryCtx<TState> => ({ self: selfRef });

  // Subscriptions always fire immediately, then update reactively.
  // Any preload/static load is kicked off in the background.
  const subscribeMethod = (input: any, cb: (value: any) => void): (() => void) => {
    const prevSub = setActiveSub(undefined);
    const stateAtSubscribe = stateSignal();
    setActiveSub(prevSub);
    if (loadStaticState) {
      void loadStaticState(input);
    } else {
      void queryDef.preload?.(input, createQueryCtx(stateAtSubscribe));
    }
    // computed() memoizes by reference equality.
    // When storyA changes, the computed for storyB re-evaluates but returns
    // the same value for storyB → its effect does NOT fire.
    const comp = computed(() => queryDef.handler(input, createQueryCtx(stateSignal())));
    // effect() fires immediately (seeding the initial value) then on each change.
    // Wrapped in a void body so effect never sees a return value as a cleanup fn.
    return effect(() => {
      cb(comp());
    });
  };

  const asyncAccessor = ((input: any): any => {
    const prevSub = setActiveSub(undefined);
    const currentState = stateSignal();
    setActiveSub(prevSub);

    if (loadStaticState) {
      return loadStaticState(input).then(() =>
        queryDef.handler(input, createQueryCtx(stateSignal()))
      );
    }

    const pending = queryDef.preload?.(input, createQueryCtx(currentState));
    if (pending instanceof Promise) {
      return pending.then(() => queryDef.handler(input, createQueryCtx(stateSignal())));
    }

    return queryDef.handler(input, createQueryCtx(stateSignal()));
  }) as AsyncQueryAccessor<any, any>;

  asyncAccessor.subscribe = subscribeMethod;
  return asyncAccessor;
}

function createLiveService<TState>(
  def: ServiceDef<TState, Queries<TState>, Commands<TState>>
): InternalService {
  const stateSignal = signal<TState>(def.initialState);
  const selfRef = createSelfRef(stateSignal);
  const ctx: CommandCtx<TState> = {
    self: selfRef,
  };

  const commands = buildCommandExecutors(def.commands, ctx);
  selfRef.commands = commands;

  const queries = Object.fromEntries(
    Object.entries(def.queries).map(([name, queryDef]) => [
      name,
      buildQueryAccessor(queryDef, stateSignal, selfRef),
    ])
  );
  selfRef.queries = queries;

  return { queries, commands, _stateSignal: stateSignal };
}

function createStaticService<TState>(
  def: ServiceDef<TState, Queries<TState>, Commands<TState>>,
  store: Record<string, unknown>
): InternalService {
  const stateSignal = signal<TState>(def.initialState);
  // Deduplicate concurrent loads by store key so the same path is only merged once.
  const loadsByPath = new Map<string, Promise<void>>();
  const selfRef = createSelfRef(stateSignal);

  // Commands are unavailable in static mode. Queries load their pre-built state
  // slices directly from the store instead.
  const commands: CommandExecutors = Object.fromEntries(
    Object.keys(def.commands).map((name) => [
      name,
      () => Promise.reject(new Error(`Command "${name}" is unavailable in static mode`)),
    ])
  );
  selfRef.commands = commands;

  // In static mode, queries with static config load from the store. Queries
  // without static config still run, but any preload that calls commands will
  // reject because commands are unavailable.
  const queries = Object.fromEntries(
    (Object.entries(def.queries) as [string, QueryDef<TState, any, any>][]).map(
      ([name, queryDef]) => [
        name,
        buildQueryAccessor(
          queryDef,
          stateSignal,
          selfRef,
          queryDef.static
            ? async (input: any) => {
                const path = resolveStaticPath(def.id, name, queryDef, input, {
                  self: selfRef,
                });
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
              }
            : undefined
        ),
      ]
    )
  );
  selfRef.queries = queries;

  return { queries, commands, _stateSignal: stateSignal };
}

// ---------------------------------------------------------------- registry --

let staticModeConfig: { store: Record<string, unknown> } | null = null;
const registry = new Map<string, InternalService>();

export function getService<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
>(def: ServiceDef<TState, TQueries, TCommands>): ServiceInstance<TState, TQueries, TCommands> {
  if (!registry.has(def.id)) {
    const service =
      staticModeConfig !== null
        ? createStaticService(def, staticModeConfig.store)
        : createLiveService(def);
    registry.set(def.id, service);
  }
  return registry.get(def.id)! as unknown as ServiceInstance<TState, TQueries, TCommands>;
}

// --------------------------------------------------------- static support --

/**
 * Switch to static mode. Call this once at app boot — before any `getService()`
 * call — when running a statically-built Storybook.
 *
 * In static mode, queries that define `static.path` load their data from
 * `store` and deep-merge it into the service state via `toMerged`. Commands
 * are unavailable and reject immediately.
 *
 * @param options.store  The in-memory key→value store produced by
 *                       `buildStaticFiles()`. Defaults to `{}`.
 */
export function configureStaticMode(options?: { store?: Record<string, unknown> }): void {
  staticModeConfig = { store: options?.store ?? {} };
}

/**
 * Build-time helper. For each service query that defines `static.path` +
 * `static.inputs`, runs that query's preload phase for every input (starting
 * from a clean copy of `initialState`) and captures the resulting state.
 *
 * Returns a **store** — a plain `Record<string, unknown>` mapping
 * `path(input) → capturedState` — that can be passed directly to
 * `configureStaticMode({ store })` at runtime.
 *
 * @example
 * const store = await buildStaticFiles([auditServiceDef]);
 * // At app boot:
 * configureStaticMode({ store });
 */
export async function buildStaticFiles(
  services: ServiceDef<any, any, any>[]
): Promise<Record<string, unknown>> {
  const store: Record<string, unknown> = {};

  for (const def of services) {
    for (const [queryName, queryDef] of Object.entries(def.queries) as [
      string,
      QueryDef<any, any, any>,
    ][]) {
      if (!queryDef.static) continue;

      const createBuildRuntime = () => {
        const stateSignal = signal(structuredClone(def.initialState));
        const buildSelfRef = createSelfRef(stateSignal);
        const buildCtx: CommandCtx<any> = { self: buildSelfRef };

        buildSelfRef.commands = Object.fromEntries(
          (Object.entries(def.commands) as [string, CommandDef<any, any>][]).map(
            ([cmdName, cmdDef]) => [
              cmdName,
              async (cmdInput: any) => cmdDef.handler(cmdInput, buildCtx),
            ]
          )
        );
        buildSelfRef.queries = Object.fromEntries(
          (Object.entries(def.queries) as [string, QueryDef<any, any, any>][]).map(
            ([qName, qDef]) => [qName, buildQueryAccessor(qDef, stateSignal, buildSelfRef)]
          )
        );

        return { stateSignal, buildSelfRef, queryCtx: { self: buildSelfRef } as QueryCtx<any> };
      };

      const inputsRuntime = createBuildRuntime();
      const inputs = await queryDef.static.inputs(inputsRuntime.queryCtx);

      for (const input of inputs) {
        // Run preload from a clean copy of initialState in a capture context so
        // each file contains only the data this query input produces.
        const buildRuntime = createBuildRuntime();

        if (queryDef.preload) {
          await queryDef.preload(input, buildRuntime.queryCtx);
        }

        store[
          resolveStaticPath(def.id, queryName, queryDef, input, buildRuntime.queryCtx)
        ] = buildRuntime.stateSignal();
      }
    }
  }

  return store;
}

/** Clear all registered services and reset static mode. Intended for tests only. */
export function clearRegistry(): void {
  registry.clear();
  staticModeConfig = null;
}
