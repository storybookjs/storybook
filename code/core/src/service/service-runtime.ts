import { enablePatches, produceWithPatches, type Patch } from 'immer';

import { isEqual } from 'es-toolkit/predicate';

import { isAbstractCommand } from './define-service.ts';
import { getStaticTransport } from './static-transport.ts';
import type {
  BuildCtx,
  CallableCommands,
  CommandHandler,
  LoaderDefinition,
  QueryDef,
  QueryEntry,
  SelfHandle,
  ServiceCtx,
  ServiceDefinition,
  ServiceRegistration,
  StateMutator,
  SubscribableQueries,
  SubscribableQuery,
} from './types.ts';

/**
 * Normalise a query entry to its object form. A bare selector function becomes
 * `{ select: fn }`; an object passes through unchanged.
 */
function unwrapQuery(entry: QueryEntry): QueryDef {
  if (typeof entry === 'function') {
    return { select: entry as QueryDef['select'] };
  }
  return entry as QueryDef;
}

// Immer's patch tracking is opt-in. Enabling once at module load is fine — it's a global flag.
enablePatches();

/**
 * Deep-merge `source` onto `target`. Plain-object slices recurse; everything else (primitives,
 * arrays, class instances, null) is overwritten by `source`. Used when applying a fetched
 * state-shaped diff (the on-disk format for loader artifacts).
 *
 * Array semantics are "replace whole array" — service authors who want fine-grained array
 * updates should normalise to a record keyed by id.
 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
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

export { deepMerge };

type StateListener<TState> = (
  state: TState,
  previousState: TState,
  patches: readonly Patch[]
) => void;
type QueryListener = (value: unknown) => void;

/**
 * Normalised "this query has a preload to fire" entry. Either the query-as-object form
 * (`definition.queries[name] = { select, preload, inputs?, path? }`) or the legacy loader
 * form (`definition.load[name] = LoaderDefinition`) collapses into this shape.
 */
interface NormalizedPreload {
  readonly handler: (...args: any[]) => void | Promise<void>;
  readonly inputs?: readonly any[] | ((ctx: BuildCtx) => readonly any[] | Promise<readonly any[]>);
  readonly path?: (...args: any[]) => string;
}

/**
 * Stable string key for a query/loader input.
 */
function keyOfInput(input: unknown): string {
  if (input === undefined) return '';
  if (typeof input === 'string') return input;
  return JSON.stringify(input);
}

/**
 * The in-memory runtime for a single registered service.
 *
 * State and state-mutation APIs (`getState`, `setState`, `subscribe`) live on this class but
 * are NOT part of the public `ServiceStore` interface — they're for infrastructure layers
 * (build pipeline, channel transport) that need raw state access. Application code talks to
 * services via queries and commands only.
 *
 * State mutation goes through `immer.produceWithPatches`. The `setState` API takes a draft-style
 * mutator (`(draft) => { draft.foo = bar; }`); the runtime hands a real Immer draft to the
 * recipe and gets back the new immutable state plus the minimal patch list.
 */
export class ServiceRuntime<TDef extends ServiceDefinition<any, any, any, any>> {
  private _state: TDef extends ServiceDefinition<infer S, any, any, any> ? S : never;
  private _stateListeners = new Set<StateListener<unknown>>();
  private _queryListeners = new Map<string, Map<string, Set<QueryListener>>>();
  private _queryResultCache = new Map<string, Map<string, unknown>>();
  private _firedLoaderInputs = new Map<string, Set<string>>();
  private _inflightLoaders = new Map<string, Map<string, Promise<void>>>();
  /** Patches accumulated for the most recent setState call. */
  private _lastPatches: readonly Patch[] = [];
  /** Resolved command handlers: definition handler or registration override. */
  private _commandHandlers: Record<string, (...args: any[]) => any>;

  public readonly definition: TDef;
  public readonly id: string;
  public readonly queries: SubscribableQueries<TDef['queries']>;
  public readonly commands: CallableCommands<TDef['commands']>;
  /** Public-facing view of this runtime. Stable reference across calls to `registerService`/`getService`. */
  public readonly publicStore: {
    readonly id: string;
    readonly definition: TDef;
    readonly queries: SubscribableQueries<TDef['queries']>;
    readonly commands: CallableCommands<TDef['commands']>;
  };

  constructor(definition: TDef, registration?: ServiceRegistration<TDef>) {
    this.definition = definition;
    this.id = definition.id;

    const [initial] = produceWithPatches(definition.state as unknown as object, () => {}) as [
      typeof definition.state,
      Patch[],
      Patch[],
    ];
    this._state = initial as typeof this._state;

    // Resolve command handlers: registration override beats definition handler. Abstract
    // commands MUST be overridden — we throw at registration time if they aren't.
    this._commandHandlers = this._resolveCommandHandlers(definition, registration);

    this.queries = this._buildQueriesApi();
    this.commands = this._buildCommandsApi();

    // Build the public-facing view once and keep a stable reference. State-mutation hooks
    // (getState/setState/subscribe/getLastPatches) are deliberately omitted — they remain on
    // the runtime class for the build pipeline and the planned channel transport.
    this.publicStore = Object.freeze({
      id: this.id,
      definition: this.definition,
      queries: this.queries,
      commands: this.commands,
    });
  }

  // ------------------------------ infrastructure-facing API ------------------------------
  // These methods exist on the runtime class but are NOT part of the public ServiceStore.
  // The build pipeline, transport, and tests-for-infrastructure use them deliberately.

  /** @internal Read raw state. Application code should use a query instead. */
  getState = (): TDef extends ServiceDefinition<infer S, any, any, any> ? S : never => {
    return this._state;
  };

  /** @internal Mutate state directly. Application code should use a command instead. */
  setState = (mutator: StateMutator<any>): void => {
    const previous = this._state;
    const [next, patches] = produceWithPatches(previous as object, (draft: any) => {
      mutator(draft);
    }) as unknown as [typeof previous, Patch[], Patch[]];

    if (patches.length === 0) return;

    this._state = next;
    this._lastPatches = patches;

    for (const listener of this._stateListeners) {
      listener(next, previous, patches);
    }
    this._reRunSubscribedQueries();
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

  // ------------------------------ command resolution ------------------------------

  private _resolveCommandHandlers(
    definition: TDef,
    registration?: ServiceRegistration<TDef>
  ): Record<string, (...args: any[]) => any> {
    const out: Record<string, (...args: any[]) => any> = {};
    const overrides = (registration?.commands ?? {}) as Record<string, (...args: any[]) => any>;

    for (const [name, entry] of Object.entries(definition.commands)) {
      const override = overrides[name];
      if (override) {
        out[name] = override;
        continue;
      }
      if (isAbstractCommand(entry)) {
        throw new Error(
          `[service ${definition.id}] command "${name}" is abstract and has no implementation at registration. ` +
            `Provide one via registerService(def, { commands: { ${name}: (input, ctx) => ... } }).`
        );
      }
      // Concrete handler — use as-is.
      out[name] = entry as (...args: any[]) => any;
    }
    return out;
  }

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

  private _runQuery(queryName: string, input: unknown): unknown {
    const entry = this.definition.queries[queryName];
    if (!entry) {
      throw new Error(`[${this.id}] Unknown query: ${queryName}`);
    }
    const select = unwrapQuery(entry).select;
    if (select.length <= 1) {
      return (select as (state: unknown) => unknown)(this._state);
    }
    return (select as (state: unknown, input: unknown) => unknown)(this._state, input);
  }

  private _queryHasInput(queryName: string): boolean {
    return unwrapQuery(this.definition.queries[queryName]).select.length > 1;
  }

  private _buildQueriesApi(): SubscribableQueries<TDef['queries']> {
    const out: Record<string, SubscribableQuery<any, any>> = {};

    for (const queryName of Object.keys(this.definition.queries)) {
      const hasInput = this._queryHasInput(queryName);

      const callable = (...args: unknown[]): unknown => {
        const input = hasInput ? args[0] : undefined;
        void this._maybeFireLoader(queryName, input);
        return this._runQuery(queryName, input);
      };

      const subscribe = (...args: unknown[]): (() => void) => {
        const input = hasInput ? args[0] : undefined;
        const listener = (hasInput ? args[1] : args[0]) as QueryListener;
        return this._subscribeToQuery(queryName, input, listener);
      };

      (callable as any).subscribe = subscribe;
      out[queryName] = callable as SubscribableQuery<any, any>;
    }

    return out as SubscribableQueries<TDef['queries']>;
  }

  private _subscribeToQuery(
    queryName: string,
    input: unknown,
    listener: QueryListener
  ): () => void {
    const inputKey = keyOfInput(input);

    let byInput = this._queryListeners.get(queryName);
    if (!byInput) {
      byInput = new Map();
      this._queryListeners.set(queryName, byInput);
    }
    let listenerSet = byInput.get(inputKey);
    if (!listenerSet) {
      listenerSet = new Set();
      byInput.set(inputKey, listenerSet);
    }
    listenerSet.add(listener);

    let resultByInput = this._queryResultCache.get(queryName);
    if (!resultByInput) {
      resultByInput = new Map();
      this._queryResultCache.set(queryName, resultByInput);
    }
    if (!resultByInput.has(inputKey)) {
      resultByInput.set(inputKey, this._runQuery(queryName, input));
    }

    void this._maybeFireLoader(queryName, input);

    return () => {
      const ls = this._queryListeners.get(queryName)?.get(inputKey);
      ls?.delete(listener);
      if (ls && ls.size === 0) {
        this._queryListeners.get(queryName)?.delete(inputKey);
      }
    };
  }

  private _reRunSubscribedQueries(): void {
    for (const [queryName, byInput] of this._queryListeners) {
      const resultByInput = this._queryResultCache.get(queryName) ?? new Map();
      this._queryResultCache.set(queryName, resultByInput);

      for (const [inputKey, listenerSet] of byInput) {
        if (listenerSet.size === 0) continue;
        const input = this._inputFromKey(queryName, inputKey);
        const next = this._runQuery(queryName, input);
        const prev = resultByInput.get(inputKey);
        if (!isEqual(prev, next)) {
          resultByInput.set(inputKey, next);
          for (const listener of listenerSet) listener(next);
        }
      }
    }
  }

  private _inputFromKey(queryName: string, inputKey: string): unknown {
    if (!this._queryHasInput(queryName)) return undefined;
    if (inputKey === '') return undefined;
    try {
      return JSON.parse(inputKey);
    } catch {
      return inputKey;
    }
  }

  // ------------------------------ commands ------------------------------

  private _commandHasInput(commandName: string): boolean {
    const resolved = this._commandHandlers[commandName];
    return resolved.length > 1;
  }

  private _buildCommandsApi(): CallableCommands<TDef['commands']> {
    const out: Record<string, (...args: any[]) => Promise<void>> = {};
    for (const commandName of Object.keys(this.definition.commands)) {
      const hasInput = this._commandHasInput(commandName);
      const handler = this._commandHandlers[commandName] as CommandHandler<unknown, unknown>;
      out[commandName] = async (input?: unknown): Promise<void> => {
        const ctx = this._getCtx();
        if (hasInput) {
          await (handler as (i: unknown, c: ServiceCtx<unknown>) => unknown | Promise<unknown>)(
            input,
            ctx
          );
        } else {
          await (handler as (c: ServiceCtx<unknown>) => unknown | Promise<unknown>)(ctx);
        }
      };
    }
    return out as CallableCommands<TDef['commands']>;
  }

  // ------------------------------ preloads (query-backed + legacy loader-backed) ------------------------------

  /**
   * Normalised preload entry. Either source — `definition.queries[name].preload` (the new
   * query-as-object form) or `definition.load[name]` (the legacy loader map) — produces this
   * shape. The rest of the runtime treats them identically.
   */
  private _preloadsMap(): Record<string, NormalizedPreload> | undefined {
    if (this._preloadsCache !== undefined) return this._preloadsCache;
    const map: Record<string, NormalizedPreload> = {};

    // From definition.queries — only query-object entries with a preload contribute.
    for (const [name, entry] of Object.entries(this.definition.queries)) {
      if (typeof entry === 'function') continue;
      const q = entry as QueryDef;
      if (!q.preload) continue;
      map[name] = {
        handler: q.preload,
        inputs: q.inputs,
        path: q.path,
      };
    }

    // From definition.load — the legacy loader-map form. Errors if it overlaps with a query
    // that also has a preload (the two forms must not double-declare the same name).
    if (this.definition.load) {
      for (const [name, loader] of Object.entries(this.definition.load)) {
        if (name in map) {
          throw new Error(
            `[service ${this.id}] "${name}" is declared both as queries.${name}.preload and load.${name}. Pick one.`
          );
        }
        const l = loader as LoaderDefinition<unknown, unknown>;
        map[name] = {
          handler: l.handler,
          inputs: l.enumerateInputs,
          path: l.options.path,
        };
      }
    }

    this._preloadsCache = Object.keys(map).length > 0 ? map : undefined;
    return this._preloadsCache;
  }
  private _preloadsCache: Record<string, NormalizedPreload> | undefined = undefined;

  private _preloadHasInput(name: string): boolean {
    const entry = this._preloadsMap()?.[name];
    return !!entry && entry.handler.length > 1;
  }

  /**
   * Compute the relative filename for a query's JSON artifact (either to emit at build time
   * or to fetch at runtime). Uses the query's `path` callback when provided, otherwise falls
   * back to a sensible default based on the query name and input.
   */
  private _preloadFilename(name: string, entry: NormalizedPreload, input: unknown): string {
    if (entry.path) {
      const buildCtx: BuildCtx = { isBuild: true };
      const hasInput = this._preloadHasInput(name);
      if (hasInput) {
        return (entry.path as (ctx: BuildCtx, input: unknown) => string)(buildCtx, input);
      }
      return (entry.path as (ctx: BuildCtx) => string)(buildCtx);
    }
    // Default: queryName.json for no-input; queryName-<input>.json for string inputs.
    if (input === undefined) return `${name}.json`;
    if (typeof input === 'string') return `${name}-${input}.json`;
    throw new Error(
      `[service ${this.id}] Query "${name}" has non-string inputs (${typeof input}) ` +
        `and no \`path\` callback. Supply one on the query: { path: (_ctx, input) => '...' }`
    );
  }

  /**
   * Apply a state-shaped diff to state. Used when restoring state from a fetched per-loader
   * artifact in static mode — files contain JSON-Merge-Patch-shaped objects (`{a:{b:1}}`) rather
   * than Immer patch lists, so the operation is a deep-merge. Emits the same state/query
   * notifications as a normal `setState`.
   */
  private _applyStateDiff(diff: unknown): void {
    if (diff === null || typeof diff !== 'object' || Array.isArray(diff)) return;
    if (Object.keys(diff as object).length === 0) return;
    this.setState((draft) => {
      deepMerge(draft as Record<string, unknown>, diff as Record<string, unknown>);
    });
  }

  private async _maybeFireLoader(queryName: string, input: unknown): Promise<void> {
    const entry = this._preloadsMap()?.[queryName];
    if (!entry) return;

    const inputKey = keyOfInput(input);

    const fired = this._firedLoaderInputs.get(queryName);
    if (fired?.has(inputKey)) return;

    const inflightForLoader = this._inflightLoaders.get(queryName);
    const existing = inflightForLoader?.get(inputKey);
    if (existing) return existing;

    const ctx = this._getCtx();
    const hasInput = this._preloadHasInput(queryName);
    const promise = (async () => {
      try {
        // Branching rule: if a transport is installed, fetch-first. On a non-null hit,
        // deep-merge the state diff and skip the body. On null (or no transport), run the
        // body live.
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
          if (hasInput) {
            await (entry.handler as (i: unknown, c: ServiceCtx<unknown>) => void | Promise<void>)(
              input,
              ctx
            );
          } else {
            await (entry.handler as (c: ServiceCtx<unknown>) => void | Promise<void>)(ctx);
          }
        }

        let firedSet = this._firedLoaderInputs.get(queryName);
        if (!firedSet) {
          firedSet = new Set();
          this._firedLoaderInputs.set(queryName, firedSet);
        }
        firedSet.add(inputKey);
      } finally {
        this._inflightLoaders.get(queryName)?.delete(inputKey);
      }
    })();

    let inflightMap = this._inflightLoaders.get(queryName);
    if (!inflightMap) {
      inflightMap = new Map();
      this._inflightLoaders.set(queryName, inflightMap);
    }
    inflightMap.set(inputKey, promise);

    return promise;
  }

  /**
   * @internal Trigger a preload explicitly. Used by the build pipeline to fire each
   * query-input pair against a fresh sandboxed runtime so its patches can be captured.
   */
  fireLoader = async (queryName: string, input?: unknown): Promise<void> => {
    await this._maybeFireLoader(queryName, input);
  };

  /** @internal Resolve the relative filename for a query-input pair. */
  loaderFilename = (queryName: string, input?: unknown): string => {
    const entry = this._preloadsMap()?.[queryName];
    if (!entry) {
      throw new Error(`[service ${this.id}] No preload registered for query "${queryName}"`);
    }
    return this._preloadFilename(queryName, entry, input);
  };

  /** @internal The names of queries that have preloads (from either source). Used by the build. */
  getPreloadNames = (): string[] => {
    const map = this._preloadsMap();
    return map ? Object.keys(map) : [];
  };

  /** @internal Resolve a preload's enumerated inputs. Used by the build. */
  resolvePreloadInputs = async (queryName: string): Promise<readonly unknown[]> => {
    const entry = this._preloadsMap()?.[queryName];
    if (!entry) return [];
    const e = entry.inputs;
    if (e === undefined) return [undefined];
    if (typeof e === 'function') {
      const buildCtx: BuildCtx = { isBuild: true };
      return await (e as (ctx: BuildCtx) => readonly unknown[] | Promise<readonly unknown[]>)(
        buildCtx
      );
    }
    return e as readonly unknown[];
  };
}
