# Concepts

A service has three primitives: a private `state`, pure `queries` that read from it, and `commands` that mutate it. A query can optionally carry static-build metadata — a `preload` body, an `inputs` enumeration, and a `path` callback — which together let the build produce per-input JSON files that the runtime fetches lazily.

## The encapsulation rule

> State is private to a service. Everything inside operates on the same state interface. The outside world only sees queries and commands.

Concretely:

- The public `ServiceStore` from `registerService` exposes `id`, `definition`, `queries`, `commands`. No `getState`, no `setState`, no whole-state `subscribe`.
- Inside a command body or a query's `preload`, `ctx.self.getState()` and `ctx.self.setState(...)` are how handlers touch state.
- To read from another service, use its queries — not its state. (Cross-service composition via `ctx.runtime[serviceId]` is planned, not built.)
- A related feature that needs a different on-disk shape is a different service. There is no "different file format for the same service."

The rule is what makes the static-build story tractable. When state is private and only commands mutate it, "save the state" and "load the state" are well-defined symmetric operations. Loosening encapsulation reintroduces ambiguity about which shape is canonical.

## The four primitives

### State

One object per service, shape chosen by the author. The runtime stores it as an immutable value (Immer) and treats every mutation as a transition that produces a new value plus a list of Immer patches describing what changed.

Two conventions:

- Model entries-keyed-by-id as `{ byId: Record<string, ...> }`, not as arrays. Records compose cleanly under patches; arrays don't.
- State must be JSON-serialisable. No functions, class instances, or DOM nodes.

### Queries

Every query is an inline object with required `input` and `output` schemas (Standard Schema v1 — zod, valibot, arktype, etc.) plus a `select` selector. Wrap each entry with `query<State>()({ ... })` so `state`, parsed inputs, and `ctx` (in preloads) infer from the schemas — bare literals inside a `queries` map lose contextual types due to a TypeScript limitation.

```ts
// no input — use z.void() for the input schema
getCount: query<State>()({ input: z.void(), output: z.number(), select: (state) => state.count })

// input-keyed — `id` is inferred from `input: z.string()`
getById: query<State>()({
  input: z.string(),
  output: z.string().optional(),
  select: (state, id) => state.byId[id],
})
```

The runtime validates caller input before calling `select`, and validates the selector result before returning it. `select` must not call commands or perform I/O — it's read-only by contract. If a query needs to trigger loading on first read, add optional `preload`, `inputs`, and `path` fields (see below).

Queries are the unit of subscription. Every `useServiceQuery` or `service.queries.foo.subscribe(...)` builds an alien-signals `computed` over the selector. The computed memoises by reference equality on its output, so subscribers only re-fire when this specific query's result actually changes. Purity is what makes "result didn't change, don't re-render" trivially correct.

### Commands

Commands use the same pattern via `command<State>()({ ... })`:

```ts
bump: command<State>()({
  input: z.void(),
  output: z.void(),
  handler: (ctx) => { ctx.self.setState((d) => { d.count += 1; }); },
}),

generate: command<State>()({ input: z.string(), output: z.void() }), // abstract — handler at registration
```

`ctx.self` is how a command touches state:

- `ctx.self.getState()` — read.
- `ctx.self.setState((draft) => { ... })` — mutate via an Immer draft. Assign, push, delete; the runtime captures a minimal patch list.
- `ctx.self.commands.<name>(...)` — call another command on this service.
- `ctx.self.queries.<name>(...)` — read via this service's own queries.

Commands can be async. A no-op `setState` (empty patch list) is detected and skips all notifications.

#### Abstract vs concrete commands

- **Concrete** — `handler` is present on the definition object. The definition owns the implementation; registration **cannot** override it. The key is excluded from `CommandOverrides` at the type level, and the runtime throws if an override slips through.
- **Abstract** — `handler` is omitted from the definition. A registration **may** supply a handler, but isn't required to: the same definition is registered in multiple runtimes (manager, preview, server) and typically only one of them implements a given abstract command. Calling an abstract command in a runtime that has no local handler throws today; once cross-runtime command routing lands it will defer to a peer runtime that does.

The use case is one shared definition imported into multiple environments, with environment-specific bodies provided per environment for the **abstract** commands. Concrete commands have a single shared body that lives in the definition.

### Query preloads (the static-build mechanism)

Optional, and the only mechanism for static-build persistence. A query without `preload` is just a selector — no static artifact, no load-on-subscribe behaviour. Add `preload` (optionally with `inputs` and `path`) to opt in.

A query's static-build fields:

1. **`preload`** — like a command body, takes optional input and `ctx`. Typically calls one or more commands to populate state for this query.
2. **`inputs`** — the inputs the static build pre-renders. An array, an async function returning an array, or omitted for no-input queries.
3. **`path`** — `(ctx, input?) => string`. Controls the per-input JSON filename. If absent, defaults are `<queryName>.json` (no input) and `<queryName>-<input>.json` (string input). Non-string inputs require an explicit `path`.

Two shapes for the pattern:

- **Per-id chunking.** A query keyed by id (e.g. `getComponentDocgenInfo(componentId)`) with many enumerated inputs and a per-input `path`. One file per id, fetched only when that id is asked about.
- **Single-file whole-service load.** A no-input query (e.g. `allStatuses()`) with `inputs` omitted. One file for the whole service, fetched when any subscriber asks for it.

Both shapes use the same machinery. The choice is whether you have one no-input query with a preload or many input-keyed ones.

What the runtime does with preloads:

- On a query subscription (or callable read) for a given input, if the query's preload hasn't fired for that input, it fires now. Subsequent reads with the same input don't re-fire — there's a per-query, per-input "has fired" set.
- Concurrent subscriptions for the same input dedupe to one preload run via an in-flight map.
- If a static transport is installed, the runtime fetches the pre-rendered JSON first. On a non-null hit, the fetched state diff is deep-merged into state and the preload body is *not* called. On null, the runtime runs the body live. See STATIC-BUILD.md.
- The preload's return value is ignored. Subscribers see whatever the query's `select` returns once state has settled — the preload's job is to populate state, not to produce a value directly.

## Definition vs registration

### Definition

```ts
const DocgenService = defineService<DocgenState>()(({ query, command }) => ({
  id: 'core/docgen',
  state: { byComponentId: {}, somethingElse: 42 },
  queries: {
    getComponentDocgenInfo: query({
      input: z.string(),
      output: docgenSchema.nullable(),
      select: (state, id) => state.byComponentId[id] ?? null,
      preload: async (id, ctx) => { await ctx.self.commands.generateDocgen(id); },
      inputs: async () => listAllComponentIds(),
      path: (_ctx, id) => `docgen-${id}.json`,
    }),
    somethingElse: query({
      input: z.void(),
      output: z.number(),
      select: (state) => state.somethingElse,
    }), // selector only — no static artifact
  },
  commands: {
    generateDocgen: command({ input: z.string(), output: z.void() }), // abstract
    modifySomethingElse: command({
      input: z.void(),
      output: z.void(),
      handler: (ctx) => { ctx.self.setState((d) => { ... }); },
    }),
  },
}));
```

A definition is environment-agnostic — shape only, no running runtime. It can be imported into manager, preview, server, or test code. Definitions are singletons: re-importing the same module yields the same reference, and the registry's identity check is based on definition reference (not just `id`).

### Registration

```ts
const store = registerService(DocgenService, {
  commands: {
    generateDocgen: async (componentId, ctx) => {
      const result = await callTheAnalyzer(componentId);
      ctx.self.setState((d: DocgenState) => {
        d.byComponentId[componentId] = result;
      });
    },
  },
});
```

Registration activates the definition and returns the `ServiceStore`. It supplies:

- **Abstract command implementations.** Any command without a `handler` in the definition must be implemented here.
- **Concrete command overrides.** Optional; replace an inline command body per environment.

Whether a service loads from JSON is decided architecture-wide via `setStaticTransport`, not per-service. Re-registering the same definition returns the same `ServiceStore`.

## ctx and the self-handle

Every command body and query preload receives `ctx`. Today `ctx` has one field, `ctx.self`, which is the service's own handle. Inside a handler you can read state, mutate it, call another command, or invoke a query — all via `ctx.self`.

There is no `ctx.runtime[otherServiceId]` yet. When it lands, handlers will be able to read from other services via their public query API but never touch raw state of another service. The encapsulation rule extends across service boundaries.

## defineService — callback vs bare object

Three ways to declare a service.

### Callback form (recommended)

```ts
defineService<DocgenState>()(({ query, command }) => ({ id, state, queries, commands }))
```

State type is fixed by the outer generic. The inner call receives `query` / `command` helpers (runtime no-ops) so `select`, `preload`, `handler`, and **registration overrides** infer from each entry's schemas. Use the curried `defineService<State>()(setup)` form so TypeScript can infer the full definition object (`const D`); a single-call `defineService<State>(setup)` only passes one type argument and may widen command types.

### Bare object form

```ts
defineService<DocgenState>()({ id, state, queries, commands })
```

Same validation, but handlers inside the `queries` / `commands` map do not get contextual typing — use explicit parameter types or wrap entries with `query()` / `command()` (imported separately or via the callback form above).

### Inferred state

```ts
defineService()({ id, state, queries, commands })
```

State is inferred from the `state:` literal (extra `()`, no `<…>`). Commands often need an explicit `ctx: ServiceCtx<MyState>` when not using the callback form.

All forms produce the same `ServiceDefinition`. The docgen example uses the callback form; many tests use the bare object form with hand-written types.

## Subscriptions

```ts
const unsub = store.queries.getComponentDocgenInfo.subscribe('Button', (value) => {
  // fires only when the selector result changes
});
```

The runtime caches the last result seen by subscribers per (queryName, input). On every `setState`, it re-runs each subscribed selector against the new state, compares structurally against the cache, and notifies only when the result changed. No-op `setState` (zero patches) skips all of this.

Design queries to return narrow data. A selector returning whole state fires on every mutation; a selector returning `state.title` fires only on title changes.

The React hook `useServiceQuery(store, queryName, input?)` is a thin wrapper around `useSyncExternalStore` plus this subscription. It re-renders only on result changes.

`store.subscribe(stateListener)` exists on the `ServiceRuntime` class for the build pipeline and transport sync but is not on the public `ServiceStore`. Application code subscribes to queries, not whole state.

## Worked example

[`__examples__/docgen-service.ts`](./__examples__/docgen-service.ts) implements docgen against the current API: curried definition with schema-validated queries and commands, a selector-only query alongside one with full `preload`/`inputs`/`path` static-build hooks, an abstract command implemented at registration, and a concrete command with an inline handler.

Read it alongside `service-runtime.test.ts` and `build-artifacts.test.ts` — those test against the public surface only, so they double as usage examples.
