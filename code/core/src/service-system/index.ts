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
import {
  computed,
  effect,
  endBatch,
  setActiveSub,
  signal,
  startBatch,
} from 'alien-signals';

// ------------------------------------------------------------------ types --

type CommandCtx<TState> = {
  readonly state: TState;
  setState(updater: (prev: TState) => TState): void;
};

/** Map of command name -> executor, passed to prefetch so queries can trigger loads. */
type CommandExecutors = Record<string, (input: any) => Promise<void>>;

export type QueryDef<TState, TInput, TOutput> = {
  /** Pure function: derives output from (input, state). No side effects. */
  handler: (input: TInput, state: TState) => TOutput;
  /**
   * Optional. Called once when subscribe() is set up AND on direct calls.
   *
   * - **Fire-and-forget** (`void` return): state is loaded in the background.
   *   `subscribe()` will be notified reactively when it arrives.
   *   Direct calls resolve immediately with whatever is in state right now.
   *
   * - **Awaitable** (`Promise<void>` return): direct calls wait for the
   *   prefetch to finish before returning the loaded value. `subscribe()` still
   *   works reactively regardless of which form you use.
   *
   * @example fire-and-forget (subscribe only)
   * prefetch: (input, state, commands) => {
   *   if (!state[input.storyId]) commands.loadStatus(input);
   * }
   *
   * @example awaitable (direct call waits for the load)
   * prefetch: (input, state, commands) => {
   *   if (!state[input.storyId]) return commands.loadStatus(input);
   * }
   */
  prefetch?: (
    input: TInput,
    state: TState,
    commands: CommandExecutors
  ) => void | Promise<void>;
};

export type CommandDef<TState, TInput> = {
  /**
   * May be sync or async. The executor always returns Promise<void> so callers
   * can uniformly `await service.commands.anything()` regardless.
   */
  handler: (input: TInput, ctx: CommandCtx<TState>) => void | Promise<void>;
  /**
   * Optional. Enables static-mode support for this command.
   *
   * At **build time**: `inputs()` enumerates every input that needs a
   * pre-computed file. For each input, the command `handler` is run against a
   * fresh copy of `initialState` in a capture context. The resulting state is
   * written to `path(input)`.
   *
   * At **runtime** (static mode): instead of running the live handler, the
   * executor fetches the file at `path(input)` from the static store and deep-
   * merges it into the state signal via `toMerged`. The query handler still
   * executes against the merged signal — identical to live mode.
   *
   * Commands without this field are unavailable in static mode and reject.
   */
  static?: {
    /**
     * Derive the store key / file path for a given input.
     * When omitted, defaults to `{serviceId}/{commandName}/{hash}.json` where
     * `hash` is an 8-char FNV-1a hex digest of the stable-stringified input.
     * The default is always filesystem-safe; override only when you need a
     * specific location (e.g. a human-readable URL for SSG output).
     */
    path?: (input: TInput) => string;
    /** Enumerate all inputs that need a pre-generated file. Called at build time only. */
    inputs: () => TInput[] | Promise<TInput[]>;
  };
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

// --------------------------------------------------------- runtime types --

/** Accessor for a query without prefetch. Direct call is synchronous. */
export type SyncQueryAccessor<TInput, TOutput> = {
  (input: TInput): TOutput;
  subscribe(input: TInput, callback: (value: TOutput) => void): () => void;
};

/**
 * Accessor for a query that has a prefetch. Direct call is async:
 * - If prefetch returns a Promise, the call waits for it before returning.
 * - If prefetch returns void, the call resolves immediately with current state.
 * `subscribe()` is always reactive regardless.
 */
export type AsyncQueryAccessor<TInput, TOutput> = {
  (input: TInput): Promise<TOutput>;
  subscribe(input: TInput, callback: (value: TOutput) => void): () => void;
};

export type ServiceInstance<
  TState,
  TQueries extends Queries<TState>,
  TCommands extends Commands<TState>,
> = {
  queries: {
    [TKey in keyof TQueries]: TQueries[TKey] extends QueryDef<
      TState,
      infer TInput,
      infer TOutput
    >
      ? TQueries[TKey] extends { prefetch: (...args: any[]) => any }
        ? AsyncQueryAccessor<TInput, TOutput>
        : SyncQueryAccessor<TInput, TOutput>
      : never;
  };
  commands: {
    [TKey in keyof TCommands]: TCommands[TKey] extends CommandDef<TState, infer TInput>
      ? (input: TInput) => Promise<void>
      : never;
  };
};

// --------------------------------------------------------------- factory --

// Note: defineQuery uses `<TDef extends QueryDef<...>>(def: TDef): TDef` rather
// than returning the base `QueryDef` type. This preserves whether `prefetch` is
// present in the inferred type, which is what the conditional in
// ServiceInstance uses to decide between SyncQueryAccessor and AsyncQueryAccessor.
export const defineQuery = <
  TState,
  TInput,
  TOutput,
  TDef extends QueryDef<TState, TInput, TOutput>,
>(
  def: TDef
): TDef => def;
export const defineCommand = <TState, TInput>(def: CommandDef<TState, TInput>) => def;
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
 * Returns the store key for a given (service, command, input) triple.
 * When `commandDef.static.path` is provided it is used as-is; otherwise a
 * deterministic default of `{serviceId}/{commandName}/{hash}.json` is
 * generated — where `hash` is an 8-char FNV-1a hex digest of the
 * stable-stringified input — so authors rarely need to specify a path.
 */
function resolveStaticPath(
  serviceId: string,
  commandName: string,
  commandDef: CommandDef<any, any>,
  input: unknown
): string {
  return commandDef.static?.path
    ? commandDef.static.path(input as any)
    : `${serviceId}/${commandName}/${hashInput(input)}.json`;
}

/** Internal registry entry — includes the raw signal for serialization. */
type InternalService = {
  queries: Record<string, SyncQueryAccessor<any, any> | AsyncQueryAccessor<any, any>>;
  commands: CommandExecutors;
  _stateSignal: ReturnType<typeof signal>;
};

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
  commands: CommandExecutors
): SyncQueryAccessor<any, any> | AsyncQueryAccessor<any, any> {
  // subscribe is identical for sync and async queries.
  // Prefetch is always fire-and-forget here: the reactive effect handles updates.
  const subscribeMethod = (input: any, cb: (value: any) => void): (() => void) => {
    const prevSub = setActiveSub(undefined);
    const stateAtSubscribe = stateSignal();
    setActiveSub(prevSub);
    queryDef.prefetch?.(input, stateAtSubscribe, commands);
    // computed() memoizes by reference equality.
    // When storyA changes, the computed for storyB re-evaluates but returns
    // the same value for storyB → its effect does NOT fire.
    const comp = computed(() => queryDef.handler(input, stateSignal()));
    // effect() fires immediately (seeding the initial value) then on each change.
    // Wrapped in a void body so effect never sees a return value as a cleanup fn.
    return effect(() => { cb(comp()); });
  };

  if (queryDef.prefetch) {
    // Async accessor: call prefetch, and if it returns a Promise, await it
    // before reading state. This lets callers do `await query(input)` and
    // get back the fully-loaded value rather than the initial empty state.
    const asyncAccessor = async (input: any): Promise<any> => {
      const prevSub = setActiveSub(undefined);
      const currentState = stateSignal();
      setActiveSub(prevSub);
      const pending = queryDef.prefetch!(input, currentState, commands);
      if (pending instanceof Promise) await pending;
      return queryDef.handler(input, stateSignal());
    };
    asyncAccessor.subscribe = subscribeMethod;
    return asyncAccessor;
  }

  // Sync accessor (no prefetch): direct call reads state synchronously.
  const syncAccessor = (input: any): any => queryDef.handler(input, stateSignal());
  syncAccessor.subscribe = subscribeMethod;
  return syncAccessor;
}

function createLiveService<TState>(
  def: ServiceDef<TState, Queries<TState>, Commands<TState>>
): InternalService {
  const stateSignal = signal<TState>(def.initialState);

  const ctx: CommandCtx<TState> = {
    get state() {
      return stateSignal();
    },
    setState(updater) {
      // startBatch/endBatch collapses writes into one notification flush,
      // so commands that touch several keys won't trigger intermediate renders.
      startBatch();
      stateSignal(updater(stateSignal()));
      endBatch();
    },
  };

  const commands = buildCommandExecutors(def.commands, ctx);

  const queries = Object.fromEntries(
    Object.entries(def.queries).map(([name, queryDef]) => [
      name,
      buildQueryAccessor(queryDef, stateSignal, commands),
    ])
  );

  return { queries, commands, _stateSignal: stateSignal };
}

function createStaticService<TState>(
  def: ServiceDef<TState, Queries<TState>, Commands<TState>>,
  store: Record<string, unknown>
): InternalService {
  const stateSignal = signal<TState>(def.initialState);
  // Deduplicate concurrent loads by store key so the same path is only merged once.
  const loadsByPath = new Map<string, Promise<void>>();

  const ctx: CommandCtx<TState> = {
    get state() {
      return stateSignal();
    },
    setState(updater) {
      startBatch();
      stateSignal(updater(stateSignal()));
      endBatch();
    },
  };

  // Commands with static config load from the store and deep-merge into state.
  // Commands without static config are unavailable in static mode.
  const commands: CommandExecutors = Object.fromEntries(
    Object.entries(def.commands).map(([name, commandDef]) => [
      name,
      commandDef.static
        ? async (input: any): Promise<void> => {
            const path = resolveStaticPath(def.id, name, commandDef, input);
            if (!loadsByPath.has(path)) {
              loadsByPath.set(
                path,
                Promise.resolve(store[path]).then((slice) => {
                  if (slice == null) return; // key missing from store — leave state unchanged
                  // Deep-merge the loaded slice into current state so concurrent
                  // loads for different inputs accumulate rather than overwrite.
                  stateSignal(
                    toMerged(stateSignal() as object, slice as object) as TState
                  );
                })
              );
            }
            return loadsByPath.get(path)!;
          }
        : () => Promise.reject(new Error(`Command "${name}" is unavailable in static mode`)),
    ])
  );

  // Reuse buildQueryAccessor unchanged — prefetch calls commands, which in
  // static mode fetch from the store instead of running the live handler.
  // The query handler still executes against the same signal in both modes.
  const queries = Object.fromEntries(
    Object.entries(def.queries).map(([name, queryDef]) => [
      name,
      buildQueryAccessor(queryDef, stateSignal, commands),
    ])
  );

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
  return registry.get(def.id)! as ServiceInstance<TState, TQueries, TCommands>;
}

// --------------------------------------------------------- static support --

/**
 * Switch to static mode. Call this once at app boot — before any `getService()`
 * call — when running a statically-built Storybook.
 *
 * In static mode, commands that define `static.path` load their data from
 * `store` and deep-merge it into the service state via `toMerged`. The query
 * handler then runs against the merged signal, identical to live mode.
 * Commands without `static` config reject immediately.
 *
 * @param options.store  The in-memory key→value store produced by
 *                       `buildStaticFiles()`. Defaults to `{}`.
 */
export function configureStaticMode(options?: { store?: Record<string, unknown> }): void {
  staticModeConfig = { store: options?.store ?? {} };
}

/**
 * Build-time helper. For each service command that defines `static.path` +
 * `static.inputs`, runs the command handler for every input (starting from a
 * clean copy of `initialState`) and captures the resulting state.
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
    for (const [commandName, commandDef] of Object.entries(def.commands)) {
      if (!commandDef.static) continue;

      const inputs = await commandDef.static.inputs();

      for (const input of inputs) {
        // Run the command from a clean copy of initialState in a capture context
        // so each file contains only the data this command produces for this input.
        const snapshot = { current: structuredClone(def.initialState) };
        const buildCtx: CommandCtx<any> = {
          get state() {
            return snapshot.current;
          },
          setState(updater: (s: any) => any) {
            snapshot.current = updater(snapshot.current);
          },
        };
        await commandDef.handler(input, buildCtx);

        store[resolveStaticPath(def.id, commandName, commandDef, input)] = snapshot.current;
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
