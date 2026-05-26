import { computed, effect, endBatch, signal, startBatch } from 'alien-signals';
import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer';

import {
  SERVICE_PATCHES,
  SERVICE_WELCOME_REPLY,
  SERVICE_WELCOME_REQUEST,
  getServiceChannel,
  type PatchesPayload,
  type ServiceChannel,
  type WelcomeReplyPayload,
  type WelcomeRequestPayload,
} from './channel-transport.ts';
import { isAbstractCommand } from './define-service.ts';
import { validateAsync, validateSync } from './service-validation.ts';
import { getStaticTransport } from './static-transport.ts';
import type {
  AnyCommandDef,
  AnyQueryDef,
  BuildCtx,
  CallableCommands,
  SelfHandle,
  ServiceCtx,
  ServiceDefinition,
  ServiceRegistration,
  StateMutator,
  SubscribableQueries,
  SubscribableQuery,
} from './types.ts';

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

/** Minimal shape of an alien-signals writable signal — `()` reads, `(v)` writes. */
type StateSignal<T> = { (): T; (value: T): void };

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
 * are NOT part of the public `ServiceStore` interface — they're for infrastructure layers
 * (build pipeline, channel transport) that need raw state access. Application code talks to
 * services via queries and commands only.
 *
 * State mutation goes through `immer.produceWithPatches`. The `setState` API takes a draft-style
 * mutator (`(draft) => { draft.foo = bar; }`); the runtime hands a real Immer draft to the
 * recipe and gets back the new immutable state plus the minimal patch list. Reactivity is
 * powered by `alien-signals`: the whole state is held in a single `signal<TState>`, and each
 * `query.subscribe(input, listener)` builds a `computed(() => select(state, input))` whose
 * value is observed by an `effect(() => listener(...))`. Reference-equality memoisation on
 * the computed gives "fire only when the selected slice actually changes" for free.
 */
export class ServiceRuntime<TDef extends ServiceDefinition<any, any, any>> {
  /**
   * Source of truth for service state. Read it via `()`, write a new value via `(next)`.
   * `setState` and the channel-sync paths both end up writing here; every active `computed`
   * created in `_subscribeToQuery` re-evaluates automatically when the signal changes.
   */
  private _stateSignal: StateSignal<TDef extends ServiceDefinition<infer S, any, any> ? S : never>;
  private _stateListeners = new Set<StateListener<unknown>>();
  private _firedLoaderInputs = new Map<string, Set<string>>();
  private _inflightLoaders = new Map<string, Map<string, Promise<void>>>();
  /** Patches accumulated for the most recent setState call. */
  private _lastPatches: readonly Patch[] = [];
  /** Resolved command handlers: definition handler or registration override. */
  private _commandHandlers: Record<string, (...args: any[]) => any>;
  /**
   * Set to true while applying state that arrived from outside (welcome reply, ongoing patch
   * from a peer, JSON file fetch). Suppresses re-broadcast of the resulting setState so we
   * don't loop. Always reset in a try/finally to survive thrown handlers.
   */
  private _applyingRemote = false;
  /**
   * Channel listeners we own, kept here so they can be detached in `dispose()`. Null when no
   * channel was installed at construction time.
   */
  private _channelBindings: {
    readonly channel: ServiceChannel;
    readonly onWelcomeRequest: (data: WelcomeRequestPayload) => void;
    readonly onWelcomeReply: (data: WelcomeReplyPayload) => void;
    readonly onPatches: (data: PatchesPayload) => void;
  } | null = null;

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
    this._stateSignal = signal(initial) as typeof this._stateSignal;

    // Resolve command handlers: registration override beats definition handler. Abstract
    // commands MUST be overridden — we throw at registration time if they aren't.
    this._commandHandlers = this._resolveCommandHandlers(definition, registration);

    this.queries = this._buildQueriesApi();
    this.commands = this._buildCommandsApi();

    // Wire channel-based sync if a channel has been installed at the architecture level.
    // No-op if no channel exists (isolation case: tests, popped-out iframes, CLI scripts).
    this._wireChannel();

    // Build the public-facing view once and keep a stable reference. State-mutation hooks
    // (getState/setState/subscribe/getLastPatches) are deliberately omitted — they remain on
    // the runtime class for the build pipeline and channel-sync infrastructure.
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
    // (each producing one Immer patch — but only one setState call) still fans out a single
    // notification flush to subscribers. Today this is equivalent to a bare write since we
    // only write once per setState, but it future-proofs us if setState is ever batched.
    startBatch();
    try {
      this._stateSignal(next);
    } finally {
      endBatch();
    }

    // Broadcast the patches over the channel so peers stay in sync — unless we're applying
    // state that just arrived from outside (welcome reply, ongoing patch from a peer, JSON
    // file fetch). That would cause an infinite re-broadcast loop.
    if (!this._applyingRemote) {
      const channel = getServiceChannel();
      if (channel) {
        const payload: PatchesPayload = { serviceId: this.id, patches };
        channel.emit(SERVICE_PATCHES, payload);
      }
    }

    for (const listener of this._stateListeners) {
      listener(next, previous, patches);
    }
    // No explicit re-run of subscribed queries — the signal write above already triggered
    // every active `computed` to re-evaluate, and `effect()` notifies the subscriber if the
    // computed's reference-equal output changed.
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
    const overrides = (registration?.commands ?? {}) as Record<
      string,
      ((...args: any[]) => any) | undefined
    >;

    for (const [name, entry] of Object.entries(definition.commands)) {
      const cmdDef = entry as AnyCommandDef<unknown>;
      const override = overrides[name];
      if (isAbstractCommand(cmdDef)) {
        // Abstract command. A local handler is optional — when absent, the runtime will fail
        // the call with an actionable error today, and (once the cross-runtime command-routing
        // layer lands) will defer execution to a peer runtime that does have a handler.
        if (override) {
          out[name] = override;
        }
        continue;
      }
      // Concrete command. Overrides are forbidden — definitions own the implementation.
      if (override) {
        throw new Error(
          `[service ${definition.id}] command "${name}" is concrete (its definition has a \`handler\`) ` +
            `and cannot be overridden at registration. ` +
            `Remove the override, or change the definition to abstract by removing its \`handler\`.`
        );
      }
      out[name] = cmdDef.handler as (...args: any[]) => any;
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

  /**
   * Run a query and return its (output-validated) result.
   *
   * `input` is the already-validated (parsed) input — callers pass it through `_validateQueryInput`
   * first when receiving from the outside. This separation keeps validation off the inner
   * computed re-evaluation path: the validated input is captured by closure in
   * `_subscribeToQuery`, so re-running the computed never re-validates the input. Output
   * validation, however, runs on every read — selectors are pure, so revalidating is cheap and
   * catches schema regressions at the place that produced them.
   */
  private _runQuery(queryName: string, parsedInput: unknown): unknown {
    const entry = this.definition.queries[queryName];
    if (!entry) {
      throw new Error(`[${this.id}] Unknown query: ${queryName}`);
    }
    // Read via the signal: when this method is invoked from inside a `computed` (the
    // subscribe path), this read registers the dependency; from a plain callable read
    // it's just a synchronous value fetch.
    const state = this._stateSignal();
    // `select` is typed (state) | (state, input). JS lets us call either with both args —
    // a 1-arg selector just ignores `parsedInput`.
    const raw = (entry.select as (s: unknown, i: unknown) => unknown)(state, parsedInput);
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
      // The callable accepts `(input?)` — for no-input queries declared via `input: z.void()`,
      // the schema validates `undefined` and selectors that take only `(state)` simply ignore
      // the second positional. Dispatch by `args.length`, matching the typed overloads.
      const callable = (...args: unknown[]): unknown => {
        const rawInput = args.length > 0 ? args[0] : undefined;
        const parsedInput = this._validateQueryInput(queryName, rawInput);
        void this._maybeFireLoader(queryName, parsedInput);
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
   *   - `computed(() => select(state, input))` re-runs whenever the state signal changes,
   *     memoised by reference equality on its output. Two consecutive evaluations that
   *     return `===`-equal values produce no downstream notification — that's where our
   *     "structurally equal? don't re-fire" behaviour for primitive-valued selectors comes
   *     from automatically.
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
    // loader's setState lands.
    void this._maybeFireLoader(queryName, input);

    return stop;
  }

  // ------------------------------ commands ------------------------------

  private _buildCommandsApi(): CallableCommands<TDef['commands']> {
    const out: Record<string, (input?: unknown) => Promise<unknown>> = {};
    for (const commandName of Object.keys(this.definition.commands)) {
      const cmdDef = this.definition.commands[commandName] as AnyCommandDef<unknown>;
      const handler = this._commandHandlers[commandName] as
        | ((...args: any[]) => unknown | Promise<unknown>)
        | undefined;
      // Dispatch by declared arity: `(ctx)` for no-input handlers, `(input, ctx)` for
      // input-keyed ones. We can't unconditionally call `(input, ctx)` because a no-input
      // handler would receive `input` as its first arg — which it expects to be `ctx`.
      const handlerHasInput = !!handler && handler.length > 1;

      out[commandName] = async (rawInput?: unknown): Promise<unknown> => {
        // Validate the caller-facing input against the command's input schema. Throws
        // ServiceValidationError on mismatch.
        const parsedInput = await validateAsync(cmdDef.input, rawInput, {
          serviceId: this.id,
          kind: 'command',
          name: commandName,
          phase: 'input',
        });
        if (!handler) {
          // No local handler — definition is abstract and registration didn't supply one.
          // TODO(cross-runtime): once command-routing lands, defer to a peer runtime that
          // has registered a handler instead of throwing here.
          throw new Error(
            `[service ${this.id}] command "${commandName}" has no handler in this runtime. ` +
              `Provide one at registration via ` +
              `registerService(def, { commands: { ${commandName}: (input, ctx) => ... } }), ` +
              `or run the call against a runtime that has the handler.`
          );
        }
        const ctx = this._getCtx();
        const rawOutput = await (handlerHasInput ? handler(parsedInput, ctx) : handler(ctx));
        // Validate the handler's return value against the output schema before handing it back.
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

  // ------------------------------ preloads (query-backed + legacy loader-backed) ------------------------------

  /**
   * Normalised preload entry built from query entries that carry a `preload` field. Queries
   * without `preload` don't contribute. Cached on first access.
   */
  private _preloadsMap(): Record<string, NormalizedPreload> | undefined {
    if (this._preloadsCache !== undefined) return this._preloadsCache;
    const map: Record<string, NormalizedPreload> = {};

    for (const [name, entry] of Object.entries(this.definition.queries)) {
      const q = entry as AnyQueryDef<unknown>;
      if (!q.preload) continue;
      map[name] = {
        handler: q.preload,
        inputs: q.inputs,
        path: q.path,
      };
    }

    this._preloadsCache = Object.keys(map).length > 0 ? map : undefined;
    return this._preloadsCache;
  }
  private _preloadsCache: Record<string, NormalizedPreload> | undefined = undefined;

  /**
   * Whether a preload's handler expects an input arg, derived from the function's declared
   * arity. The schema-driven type signature is `(ctx) => …` for void inputs and
   * `(input, ctx) => …` otherwise; arity is the cheap, accurate way to dispatch at runtime.
   */
  private _preloadHasInput(name: string): boolean {
    const entry = this._preloadsMap()?.[name];
    return !!entry && entry.handler.length > 1;
  }

  /**
   * Compute the relative filename for a query's JSON artifact (either to emit at build time
   * or to fetch at runtime). Uses the query's `path` callback when provided, otherwise falls
   * back to a sensible default based on the query name and input.
   *
   * The `path` callback always takes `ctx` first (`(ctx) => string` for no-input,
   * `(ctx, input) => string` for input-keyed), so we can always call it with both positionals
   * — JS quietly drops the extra arg in the no-input case.
   */
  private _preloadFilename(name: string, entry: NormalizedPreload, input: unknown): string {
    if (entry.path) {
      const buildCtx: BuildCtx = { isBuild: true };
      return (entry.path as (ctx: BuildCtx, input?: unknown) => string)(buildCtx, input);
    }
    // Default filename rules:
    //  - no input         → `${name}.json`
    //  - string input     → `${name}-${input}.json`
    //  - any other input  → `${name}-${fnv1a(JSON.stringify(input))}.json` (8-hex-char hash)
    // Authors who want pretty URLs for non-string inputs supply a `path` callback explicitly.
    if (input === undefined) return `${name}.json`;
    if (typeof input === 'string') return `${name}-${input}.json`;
    return `${name}-${fnv1a(JSON.stringify(input))}.json`;
  }

  /**
   * Apply a state-shaped diff to state. Used both when restoring state from a fetched static
   * artifact AND when applying a welcome reply from a peer — files and welcome replies share
   * the same on-the-wire shape (a JSON-Merge-Patch-flavoured nested object). Operation is a
   * deep-merge. Sets `_applyingRemote` so the resulting `setState` doesn't re-broadcast.
   */
  private _applyStateDiff(diff: unknown): void {
    if (diff === null || typeof diff !== 'object' || Array.isArray(diff)) return;
    if (Object.keys(diff as object).length === 0) return;
    this._applyingRemote = true;
    try {
      this.setState((draft) => {
        deepMerge(draft as Record<string, unknown>, diff as Record<string, unknown>);
      });
    } finally {
      this._applyingRemote = false;
    }
  }

  /**
   * Apply a list of Immer patches received from a peer over the channel. Uses Immer's
   * `applyPatches` directly so removals and other patch ops are preserved (the state-shaped
   * diff format loses removals). Sets `_applyingRemote` to suppress re-broadcast. The new
   * state is written through the signal so every active `computed` re-evaluates.
   */
  private _applyExternalPatches(patches: readonly Patch[]): void {
    if (patches.length === 0) return;
    this._applyingRemote = true;
    try {
      const previous = this._stateSignal();
      const next = applyPatches(previous as object, patches as Patch[]) as typeof previous;
      if (next === previous) return;
      this._lastPatches = patches;
      startBatch();
      try {
        this._stateSignal(next);
      } finally {
        endBatch();
      }
      for (const listener of this._stateListeners) {
        listener(next, previous, patches);
      }
    } finally {
      this._applyingRemote = false;
    }
  }

  /**
   * Subscribe to channel events for this service's id, and emit the initial welcome-request.
   * Listeners are stored on `_channelBindings` so they can be detached in `dispose()`.
   */
  private _wireChannel(): void {
    const channel = getServiceChannel();
    if (!channel) return;

    const onWelcomeRequest = (data: WelcomeRequestPayload) => {
      if (data.serviceId !== this.id) return;
      const payload: WelcomeReplyPayload = {
        serviceId: this.id,
        state: this._stateSignal() as Record<string, unknown>,
      };
      channel.emit(SERVICE_WELCOME_REPLY, payload);
    };
    const onWelcomeReply = (data: WelcomeReplyPayload) => {
      if (data.serviceId !== this.id) return;
      this._applyStateDiff(data.state);
    };
    const onPatches = (data: PatchesPayload) => {
      if (data.serviceId !== this.id) return;
      this._applyExternalPatches(data.patches as readonly Patch[]);
    };

    channel.on(SERVICE_WELCOME_REQUEST, onWelcomeRequest);
    channel.on(SERVICE_WELCOME_REPLY, onWelcomeReply);
    channel.on(SERVICE_PATCHES, onPatches);

    this._channelBindings = { channel, onWelcomeRequest, onWelcomeReply, onPatches };

    // Announce that we just joined. Any peer with state for this service replies; the rest
    // ignore the event because the serviceId doesn't match theirs.
    const requestPayload: WelcomeRequestPayload = { serviceId: this.id };
    channel.emit(SERVICE_WELCOME_REQUEST, requestPayload);
  }

  /**
   * @internal Detach channel listeners. Used by tests that swap out the channel between
   * runs; not part of the application-facing API.
   */
  dispose(): void {
    if (!this._channelBindings) return;
    const { channel, onWelcomeRequest, onWelcomeReply, onPatches } = this._channelBindings;
    channel.off(SERVICE_WELCOME_REQUEST, onWelcomeRequest);
    channel.off(SERVICE_WELCOME_REPLY, onWelcomeReply);
    channel.off(SERVICE_PATCHES, onPatches);
    this._channelBindings = null;
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
