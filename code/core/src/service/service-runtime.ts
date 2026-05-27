import { computed, effect, endBatch, signal, startBatch } from 'alien-signals';
import { enablePatches, produceWithPatches, type Patch } from 'immer';

import { rethrowAsync, validateAsync, validateSync } from './service-validation.ts';
import { getStaticTransport } from './static-transport.ts';
import type {
  AnyCommandDef,
  AnyQueryDef,
  BuildCtx,
  CallableCommands,
  SelfHandle,
  ServiceCtx,
  ServiceDefinition,
  ServiceInstance,
  StateMutator,
  SubscribableQueries,
  SubscribableQuery,
} from './types.ts';

// Immer's patch tracking is opt-in. Enabling once at module load is fine — it's a global flag.
enablePatches();

/**
 * Object keys that can pollute `Object.prototype` if written to a plain object via dynamic
 * assignment. We reject them in `patchesToStateDiff` and skip them in `deepMerge` so a
 * JSON-parsed `{"__proto__": {...}}` from a static artifact can't corrupt the runtime.
 */
export const UNSAFE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Deep-merge `source` onto `target`. Plain-object slices recurse; everything else (primitives,
 * arrays, class instances, null) is overwritten by `source`. Used when applying a fetched
 * state-shaped diff (the on-disk format for loader artifacts).
 *
 * Array semantics are "replace whole array" — service authors who want fine-grained array
 * updates should normalise to a record keyed by id.
 *
 * Keys matching {@link UNSAFE_KEYS} are skipped so static artifacts can't perform a prototype
 * pollution attack on the runtime via a `JSON.parse('{"__proto__":{...}}')` artifact.
 */
export function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    if (UNSAFE_KEYS.has(key)) continue;
    const sv = source[key];
    const tv = target[key];
    if (
      sv !== null &&
      typeof sv === 'object' &&
      !Array.isArray(sv) &&
      tv !== null &&
      typeof tv === 'object' &&
      !Array.isArray(tv)
    ) {
      deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else {
      target[key] = sv;
    }
  }
}

type StateListener<TState> = (
  state: TState,
  previousState: TState,
  patches: readonly Patch[]
) => void;
type QueryListener = (value: unknown) => void;

/** Minimal shape of an alien-signals writable signal — `()` reads, `(v)` writes. */
type StateSignal<T> = { (): T; (value: T): void };

/** Stable string key for a query input. */
function keyOfInput(input: unknown): string {
  if (input === undefined) return '';
  if (typeof input === 'string') return input;
  return JSON.stringify(input);
}

/**
 * 32-bit FNV-1a hash of a string, encoded as 8 lowercase hex chars. Non-cryptographic; used
 * only to derive deterministic filenames from non-string inputs when the query author didn't
 * supply a `path` callback. Fast, no dependencies, stable across runs.
 */
function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * The in-memory runtime for a single registered service.
 *
 * State and state-mutation APIs (`getState`, `setState`, `subscribe`) live on this class but
 * are NOT part of the public `ServiceInstance` interface — they're for infrastructure layers
 * (build pipeline, transport) that need raw state access. Application code talks to
 * services via queries and commands only.
 *
 * State mutation goes through `immer.produceWithPatches`. The `setState` API takes a draft-style
 * mutator (`(draft) => { draft.foo = bar; }`); the runtime hands a real Immer draft to the
 * recipe and gets back the new immutable state plus the minimal patch list. Reactivity is
 * powered by `alien-signals`: the whole state is held in a single `signal<TState>`, and each
 * `query.subscribe(input, listener)` builds a `computed(() => handler(state, input))` whose
 * value is observed by an `effect(() => listener(...))`. Reference-equality memoisation on
 * the computed gives "fire only when the selected slice actually changes" for free.
 */
export class ServiceRuntime<TDef extends ServiceDefinition<any, any, any>> {
  private _stateSignal: StateSignal<TDef extends ServiceDefinition<infer S, any, any> ? S : never>;
  private _stateListeners = new Set<StateListener<unknown>>();
  private _firedPreloadInputs = new Map<string, Set<string>>();
  private _inflightPreloads = new Map<string, Map<string, Promise<void>>>();
  /** Patches accumulated for the most recent setState call. */
  private _lastPatches: readonly Patch[] = [];

  public readonly definition: TDef;
  public readonly id: string;
  public readonly queries: SubscribableQueries<TDef['queries']>;
  public readonly commands: CallableCommands<TDef['commands']>;

  constructor(definition: TDef) {
    this.definition = definition;
    this.id = definition.id;

    // structuredClone breaks the reference to `definition.state` so post-hoc mutation of the
    // definition object can't leak into runtime state. (`produceWithPatches(x, () => {})` returns
    // the original reference when the recipe is a no-op, which is what we used to do.)
    this._stateSignal = signal(
      structuredClone(definition.state) as TDef extends ServiceDefinition<infer S, any, any>
        ? S
        : never
    );

    this.queries = this._buildQueriesApi();
    this.commands = this._buildCommandsApi();
  }

  // ------------------------------ infrastructure-facing API ------------------------------
  // These methods exist on the runtime class but are NOT part of the public ServiceInstance.
  // The build pipeline and tests-for-infrastructure use them deliberately.

  /** @internal Read raw state. Application code should use a query instead. */
  getState = (): TDef extends ServiceDefinition<infer S, any, any> ? S : never => {
    return this._stateSignal();
  };

  /** @internal Mutate state directly. Application code should use a command instead. */
  setState = (mutator: StateMutator<any>): void => {
    const previous = this._stateSignal();
    const [next, patches] = produceWithPatches(previous as object, (draft: any) => {
      mutator(draft);
    }) as unknown as [typeof previous, Patch[], Patch[]];

    if (patches.length === 0) return;

    this._lastPatches = patches;
    // Wrap the signal write in startBatch/endBatch so a command that touches several keys
    // still fans out a single notification flush to subscribers.
    startBatch();
    try {
      this._stateSignal(next);
    } finally {
      endBatch();
    }

    for (const listener of this._stateListeners) {
      listener(next, previous, patches);
    }
  };

  /** @internal Subscribe to whole-state changes. Receives patches alongside state. */
  subscribe = (listener: StateListener<unknown>): (() => void) => {
    this._stateListeners.add(listener);
    return () => {
      this._stateListeners.delete(listener);
    };
  };

  /** @internal The patch list produced by the most recent setState call. */
  getLastPatches = (): readonly Patch[] => this._lastPatches;

  // ------------------------------ ctx + self handle ------------------------------

  private _ctx: ServiceCtx<unknown> | null = null;
  private _getCtx(): ServiceCtx<unknown> {
    if (this._ctx) return this._ctx;
    const self: SelfHandle<unknown> = {
      getState: this.getState,
      setState: this.setState,
      commands: this.commands as unknown as Record<string, (...args: any[]) => Promise<void>>,
      queries: this._buildSelfQueriesApi(),
    };
    this._ctx = { self };
    return this._ctx;
  }

  private _buildSelfQueriesApi(): Record<string, (...args: any[]) => unknown> {
    const out: Record<string, (...args: any[]) => unknown> = {};
    for (const queryName of Object.keys(this.definition.queries)) {
      out[queryName] = (input?: unknown) => this._runQuery(queryName, input);
    }
    return out;
  }

  // ------------------------------ queries ------------------------------

  /**
   * Run a query and return its (output-validated) result.
   *
   * `input` is the already-validated (parsed) input — callers pass it through `_validateQueryInput`
   * first when receiving from the outside. This separation keeps validation off the inner
   * computed re-evaluation path: the validated input is captured by closure in
   * `_subscribeToQuery`, so re-running the computed never re-validates the input.
   */
  private _runQuery(queryName: string, parsedInput: unknown): unknown {
    const entry = this.definition.queries[queryName];
    if (!entry) {
      throw new Error(`[${this.id}] Unknown query: ${queryName}`);
    }
    const state = this._stateSignal();
    const raw = (entry.handler as (s: unknown, i: unknown) => unknown)(state, parsedInput);
    return validateSync(entry.output, raw, {
      serviceId: this.id,
      kind: 'query',
      name: queryName,
      phase: 'output',
    });
  }

  /** Validate a raw caller-facing input against the query's input schema. */
  private _validateQueryInput(queryName: string, rawInput: unknown): unknown {
    const entry = this.definition.queries[queryName];
    return validateSync(entry.input, rawInput, {
      serviceId: this.id,
      kind: 'query',
      name: queryName,
      phase: 'input',
    });
  }

  private _buildQueriesApi(): SubscribableQueries<TDef['queries']> {
    const out: Record<string, SubscribableQuery<any, any>> = {};

    for (const queryName of Object.keys(this.definition.queries)) {
      const callable = (...args: unknown[]): unknown => {
        const rawInput = args.length > 0 ? args[0] : undefined;
        const parsedInput = this._validateQueryInput(queryName, rawInput);
        void this._maybeFirePreload(queryName, parsedInput).catch(rethrowAsync);
        return this._runQuery(queryName, parsedInput);
      };

      const subscribe = (...args: unknown[]): (() => void) => {
        // Two typed overloads:
        //   subscribe(listener)              — no-input queries
        //   subscribe(input, listener)       — input-keyed queries
        // Dispatch by argument count.
        if (args.length === 1) {
          const parsedInput = this._validateQueryInput(queryName, undefined);
          return this._subscribeToQuery(queryName, parsedInput, args[0] as QueryListener);
        }
        const parsedInput = this._validateQueryInput(queryName, args[0]);
        return this._subscribeToQuery(queryName, parsedInput, args[1] as QueryListener);
      };

      (callable as any).subscribe = subscribe;
      out[queryName] = callable as SubscribableQuery<any, any>;
    }

    return out as SubscribableQueries<TDef['queries']>;
  }

  /**
   * Subscribe a listener to a query/input pair. Built on `alien-signals`:
   *
   *   - `computed(() => handler(state, input))` re-runs whenever the state signal changes,
   *     memoised by reference equality on its output. Two consecutive evaluations that
   *     return `===`-equal values produce no downstream notification — that's where our
   *     "structurally equal? don't re-fire" behaviour for primitive-valued query handlers
   *     comes from automatically.
   *
   *   - `effect(() => listener(comp()))` fires on every change to the computed's value.
   *     `effect` itself fires once synchronously at install time; we swallow that first
   *     fire so existing subscribers retain "fire only on change" semantics. Callers that
   *     want the initial value should read it via the callable form of the query.
   *
   *   - Returns the effect's stop handle: calling it tears down the computed/effect pair.
   */
  private _subscribeToQuery(
    queryName: string,
    input: unknown,
    listener: QueryListener
  ): () => void {
    const comp = computed(() => this._runQuery(queryName, input));
    let initialFire = true;
    const stop = effect(() => {
      const value = comp();
      if (initialFire) {
        initialFire = false;
        return;
      }
      listener(value);
    });

    // Kick off the preload — fire-and-forget, the effect above will re-evaluate when the
    // preload's setState lands. `rethrowAsync` surfaces preload failures on the microtask
    // queue so they're observable but don't reject this synchronous subscribe path.
    void this._maybeFirePreload(queryName, input).catch(rethrowAsync);

    return stop;
  }

  // ------------------------------ commands ------------------------------

  private _buildCommandsApi(): CallableCommands<TDef['commands']> {
    const out: Record<string, (input?: unknown) => Promise<unknown>> = {};
    for (const commandName of Object.keys(this.definition.commands)) {
      const cmdDef = this.definition.commands[commandName] as AnyCommandDef<unknown>;
      const handler = cmdDef.handler as (...args: any[]) => unknown | Promise<unknown>;
      // Dispatch by declared arity: `(ctx)` for no-input handlers, `(input, ctx)` for
      // input-keyed ones.
      const handlerHasInput = handler.length > 1;

      out[commandName] = async (rawInput?: unknown): Promise<unknown> => {
        const parsedInput = await validateAsync(cmdDef.input, rawInput, {
          serviceId: this.id,
          kind: 'command',
          name: commandName,
          phase: 'input',
        });
        const ctx = this._getCtx();
        const rawOutput = await (handlerHasInput ? handler(parsedInput, ctx) : handler(ctx));
        return validateAsync(cmdDef.output, rawOutput, {
          serviceId: this.id,
          kind: 'command',
          name: commandName,
          phase: 'output',
        });
      };
    }
    return out as CallableCommands<TDef['commands']>;
  }

  // ------------------------------ preloads ------------------------------

  /**
   * Normalised preload entry built from query entries that carry a `preload` field. Queries
   * without `preload` don't contribute. Cached on first access.
   */
  private _preloadsCache: Record<string, AnyQueryDef<unknown>> | undefined = undefined;
  private _preloadsMap(): Record<string, AnyQueryDef<unknown>> | undefined {
    if (this._preloadsCache !== undefined) return this._preloadsCache;
    const map: Record<string, AnyQueryDef<unknown>> = {};
    for (const [name, entry] of Object.entries(this.definition.queries)) {
      const q = entry as AnyQueryDef<unknown>;
      if (!q.preload) continue;
      map[name] = q;
    }
    this._preloadsCache = Object.keys(map).length > 0 ? map : undefined;
    return this._preloadsCache;
  }

  /**
   * Whether a preload's handler expects an input arg, derived from the function's declared
   * arity. The schema-driven type signature is `(ctx) => …` for void inputs and
   * `(input, ctx) => …` otherwise; arity is the cheap, accurate way to dispatch at runtime.
   */
  private _preloadHasInput(name: string): boolean {
    const entry = this._preloadsMap()?.[name];
    return !!entry?.preload && entry.preload.length > 1;
  }

  /**
   * Compute the relative filename for a query's JSON artifact (either to emit at build time
   * or to fetch at runtime). Uses the query's `path` callback when provided, otherwise falls
   * back to a sensible default based on the query name and input.
   */
  private _preloadFilename(name: string, entry: AnyQueryDef<unknown>, input: unknown): string {
    if (entry.path) {
      const buildCtx: BuildCtx = { isBuild: true };
      return (entry.path as (ctx: BuildCtx, input?: unknown) => string)(buildCtx, input);
    }
    // Default filename rules:
    //  - no input         → `${name}.json`
    //  - string input     → `${name}-${input}.json`
    //  - any other input  → `${name}-${fnv1a(JSON.stringify(input))}.json` (8-hex-char hash)
    if (input === undefined) return `${name}.json`;
    if (typeof input === 'string') return `${name}-${input}.json`;
    return `${name}-${fnv1a(JSON.stringify(input))}.json`;
  }

  /**
   * Apply a state-shaped diff to state. Used when restoring state from a fetched static
   * artifact — a JSON-Merge-Patch-flavoured nested object. Operation is a deep-merge.
   */
  private _applyStateDiff(diff: unknown): void {
    if (diff === null || typeof diff !== 'object' || Array.isArray(diff)) return;
    if (Object.keys(diff as object).length === 0) return;
    this.setState((draft) => {
      deepMerge(draft as Record<string, unknown>, diff as Record<string, unknown>);
    });
  }

  /**
   * Fire a preload for one (query, input) pair if it hasn't fired yet. Per-input fired set
   * suppresses duplicates; an in-flight map dedupes concurrent firings against the same input.
   *
   * Branching rule: if a static transport is installed, fetch-first. On a non-null hit,
   * deep-merge the state diff and skip the preload body. On null (or no transport), run the
   * body live.
   */
  private async _maybeFirePreload(queryName: string, input: unknown): Promise<void> {
    const entry = this._preloadsMap()?.[queryName];
    if (!entry?.preload) return;

    const inputKey = keyOfInput(input);

    const fired = this._firedPreloadInputs.get(queryName);
    if (fired?.has(inputKey)) return;

    const inflightForQuery = this._inflightPreloads.get(queryName);
    const existing = inflightForQuery?.get(inputKey);
    if (existing) return existing;

    const ctx = this._getCtx();
    const hasInput = this._preloadHasInput(queryName);
    const promise = (async () => {
      try {
        const transport = getStaticTransport();
        let resolvedFromStatic = false;
        if (transport) {
          const filename = this._preloadFilename(queryName, entry, input);
          const fetched = await transport.fetch(this.id, filename);
          if (fetched != null) {
            this._applyStateDiff(fetched);
            resolvedFromStatic = true;
          }
        }

        if (!resolvedFromStatic) {
          const preload = entry.preload!;
          if (hasInput) {
            await (preload as (i: unknown, c: ServiceCtx<unknown>) => void | Promise<void>)(
              input,
              ctx
            );
          } else {
            await (preload as (c: ServiceCtx<unknown>) => void | Promise<void>)(ctx);
          }
        }

        let firedSet = this._firedPreloadInputs.get(queryName);
        if (!firedSet) {
          firedSet = new Set();
          this._firedPreloadInputs.set(queryName, firedSet);
        }
        firedSet.add(inputKey);
      } finally {
        this._inflightPreloads.get(queryName)?.delete(inputKey);
      }
    })();

    let inflightMap = this._inflightPreloads.get(queryName);
    if (!inflightMap) {
      inflightMap = new Map();
      this._inflightPreloads.set(queryName, inflightMap);
    }
    inflightMap.set(inputKey, promise);

    // Return the raw promise so awaited callers (build pipeline via `firePreload`) observe
    // rejections normally. Fire-and-forget call sites attach their own `.catch(rethrowAsync)`
    // so unhandled rejections still surface on the microtask queue rather than disappearing.
    return promise;
  }

  /**
   * @internal Trigger a preload explicitly. Used by the build pipeline to fire each
   * query-input pair against a fresh sandboxed runtime so its patches can be captured.
   */
  firePreload = async (queryName: string, input?: unknown): Promise<void> => {
    await this._maybeFirePreload(queryName, input);
  };

  /** @internal Resolve the relative filename for a query-input pair. */
  preloadFilename = (queryName: string, input?: unknown): string => {
    const entry = this._preloadsMap()?.[queryName];
    if (!entry) {
      throw new Error(`[service ${this.id}] No preload registered for query "${queryName}"`);
    }
    return this._preloadFilename(queryName, entry, input);
  };

  /** @internal The names of queries that have preloads. Used by the build. */
  getPreloadNames = (): string[] => {
    const map = this._preloadsMap();
    return map ? Object.keys(map) : [];
  };

  /** @internal Resolve a preload's enumerated inputs. Used by the build. */
  resolvePreloadInputs = async (queryName: string): Promise<readonly unknown[]> => {
    const entry = this._preloadsMap()?.[queryName];
    if (!entry) return [];
    const e = entry.inputs;
    if (e === undefined) {
      // No-input preloads are correctly served by a single `[undefined]` enumeration that
      // produces one default-named artifact. For input-keyed preloads, an omitted `inputs`
      // is an authoring bug — the build would silently emit one wrong artifact. Throw.
      if (this._preloadHasInput(queryName)) {
        throw new Error(
          `[service ${this.id}] Query "${queryName}" declares an input-keyed preload but no ` +
            `\`inputs\` enumeration. Add \`inputs: [...]\` (or a function returning the list) ` +
            `so the build can pre-render artifacts for each input.`
        );
      }
      return [undefined];
    }
    if (typeof e === 'function') {
      const buildCtx: BuildCtx = { isBuild: true };
      return await (e as (ctx: BuildCtx) => readonly unknown[] | Promise<readonly unknown[]>)(
        buildCtx
      );
    }
    return e as readonly unknown[];
  };
}

// ------------------------------ public entry points ------------------------------

/**
 * Build a fresh runtime instance for the definition. Every call creates a new runtime —
 * callers that need a singleton per service id should use {@link getService} instead.
 */
export function createService<TDef extends ServiceDefinition<any, any, any>>(
  definition: TDef
): ServiceInstance<TDef> {
  const runtime = new ServiceRuntime(definition);
  return runtime as unknown as ServiceInstance<TDef>;
}

const instances = new Map<string, ServiceRuntime<any>>();

/**
 * Returns a shared singleton instance for the given service definition. Lazy: creates on first
 * access via {@link createService}, reuses thereafter.
 *
 * Throws if a different definition is already registered for the same id (`definition.id` is
 * the registry key, so two distinct definitions sharing an id would silently collide).
 */
export function getService<TDef extends ServiceDefinition<any, any, any>>(
  definition: TDef
): ServiceInstance<TDef> {
  const existing = instances.get(definition.id);
  if (existing) {
    if (existing.definition !== definition) {
      throw new Error(
        `[service] A different service definition is already registered for id "${definition.id}". ` +
          `Service definitions must be singletons across the bundle.`
      );
    }
    return existing as unknown as ServiceInstance<TDef>;
  }
  const runtime = new ServiceRuntime(definition);
  instances.set(definition.id, runtime);
  return runtime as unknown as ServiceInstance<TDef>;
}

/** Test-only helper. Clears the global registry. */
export function clearRegistry(): void {
  instances.clear();
}
