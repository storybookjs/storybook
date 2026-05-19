# Concepts

A service has four parts: a private `state`, pure `queries` that read from it, `commands` that mutate it, and optional `loaders` that bridge queries to async work (mainly: to JSON files written at build time).

## The encapsulation rule

> State is private to a service. Everything inside operates on the same state interface. The outside world only sees queries and commands.

Concretely:

- The public `ServiceStore` from `registerService` exposes `id`, `definition`, `queries`, `commands`, and `ready`. No `getState`, no `setState`, no whole-state `subscribe`.
- Inside a command or loader body, `ctx.self.getState()` and `ctx.self.setState(...)` are how handlers touch state.
- To read from another service, use its queries — not its state. (Cross-service composition via `ctx.runtime[serviceId]` is planned, not built.)
- A related feature that needs a different on-disk shape is a different service. There is no "different file format for the same service."

The rule is what makes the static-build story tractable. When state is private and only commands mutate it, "save the state" and "load the state" are well-defined symmetric operations. Loosening encapsulation reintroduces ambiguity about which shape is canonical.

## The four primitives

### State

One object per service, shape chosen by the author. The runtime stores it as an immutable value (Immer) and treats every mutation as a transition that produces a new value plus a list of Immer patches describing what changed.

Two conventions:

- Model entries-keyed-by-id as `{ byId: Record<string, ...> }`, not as arrays. Records deep-merge cleanly and shard cleanly into per-id files. Arrays don't.
- State must be JSON-serialisable. No functions, class instances, or DOM nodes.

### Queries

Pure synchronous selectors over state:

```ts
(state) => result            // no input
(state, input) => result     // input-keyed
```

Queries must not call commands or perform I/O. They are read-only by contract. If a query needs to trigger loading, that lives in the paired `load.<name>` handler.

Queries are the unit of subscription. Every `useServiceQuery` or `service.queries.foo.subscribe(...)` runs the selector against current state, caches the result, and re-runs it on each state change to decide whether to notify. Purity is what makes "result didn't change, don't re-render" trivially correct.

### Commands

The write API:

```ts
(ctx) => void | Promise<void>            // no input
(input, ctx) => void | Promise<void>     // input-keyed
```

`ctx.self` is how a command touches state:

- `ctx.self.getState()` — read.
- `ctx.self.setState((draft) => { ... })` — mutate via an Immer draft. Assign, push, delete; the runtime captures a minimal patch list.
- `ctx.self.commands.<name>(...)` — call another command on this service.
- `ctx.self.queries.<name>(...)` — read via this service's own queries.

Commands can be async. A no-op `setState` (empty patch list) is detected and skips all notifications.

#### Abstract vs concrete commands

- **Concrete** — a plain function in the `commands:` map. Body inline.
- **Abstract** — `defineCommand<TInput>()`. No body. The implementation must be supplied at registration via `registerService(def, { commands: { foo: handler } })`. If missing, registration throws.

The use case is one definition imported into multiple environments (manager, preview, server) with environment-specific bodies. Concrete commands can also be overridden at registration.

### Loaders

The read-triggered backing for a query. Optional; only needed for queries whose data is fetched lazily or pre-rendered to JSON.

Declared as a `load:` map keyed by query name. `load.getX` is the loader for `queries.getX`. The 1:1 mapping is structural, not enforced — but it's the contract the runtime is built around.

A loader has three pieces:

1. **Handler** — like a command, takes optional input and `ctx`. Typically calls one or more commands to populate state.
2. **Enumeration** — the inputs the static build pre-renders. An array, an async function returning an array, or `undefined` for no-input loaders.
3. **Options** — `path: (ctx, input?) => string` controls the per-input JSON filename. If absent, defaults are `<name>.json` (no input) and `<name>-<input>.json` (string input). Non-string inputs require an explicit `path`.

What the runtime does with loaders:

- On a query subscription (or callable read) for a given input, if the paired loader hasn't fired for that input, it fires now. Subsequent reads with the same input don't re-fire — there's a per-loader, per-input "has fired" set.
- Concurrent subscriptions for the same input dedupe to one loader run via an in-flight map.
- If a static transport is installed, the runtime fetches the loader's pre-rendered JSON first. On a non-null hit, the patches are applied via `applyPatches` and the loader body is *not* called. On null, the runtime runs the body live. See STATIC-BUILD.md.
- The loader's return value is ignored. After it resolves, the runtime invokes the same-named query with the same input and that's what subscribers see.

## Definition vs registration

### Definition

```ts
const DocgenService = defineService<DocgenState>()({
  id: 'core/docgen',
  state: { byComponentId: {}, somethingElse: 42 },
  queries: { ... },
  commands: {
    generateDocgen: defineCommand<string>(),
    modifySomethingElse: (ctx) => {
      ctx.self.setState((draft: DocgenState) => { ... });
    },
  },
  load: { ... },
});
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

- **Abstract command implementations.** Any `defineCommand()` without a handler must be implemented here.
- **Concrete command overrides.** Optional; replace an inline command body per environment.

Whether a service loads from JSON at boot is decided architecture-wide via `setStaticTransport`, not per-service. Re-registering the same definition returns the same `ServiceStore`.

## ctx and the self-handle

Every command and loader receives `ctx`. Today `ctx` has one field, `ctx.self`, which is the service's own handle. Inside a handler you can read state, mutate it, call another command, or invoke a query — all via `ctx.self`.

There is no `ctx.runtime[otherServiceId]` yet. When it lands, handlers will be able to read from other services via their public query API but never touch raw state of another service. The encapsulation rule extends across service boundaries.

## defineService — curried vs inferred

Two equivalent ways to declare a service.

### Curried form

```ts
defineService<DocgenState>()({ id, state, queries, commands, load })
```

State type is fixed by the outer generic. `state` in queries and `ctx` in commands/loaders are inferred for you — no annotations.

Two TypeScript quirks worth knowing:

- `draft` inside `ctx.self.setState((draft) => ...)` does *not* propagate the bound generic through the command-type's overloaded function shape, so it still needs `(draft: DocgenState) => ...` annotation. Reproducible in a minimal isolated example; not specific to our types.
- Two-arg inline commands (`(input: T, ctx) => ...`) trip the same overload-typing limit and produce wrong `Parameters` inference. Switch to the inferred form below, or wrap the body in `defineCommand` and let the registration provide it.

### Inferred form

```ts
defineService({ id, state, queries, commands, load })
```

State is inferred from the `state:` literal. Queries still get contextual `state` typing. Commands need an explicit `ctx: ServiceCtx<MyState>` because the contextual-type union over command arities doesn't pick a single signature for `ctx`. Two-arg inline commands work fine.

Both forms produce the same `ServiceDefinition`. Pick whichever is more ergonomic. The docgen example uses the curried form; tests with two-arg inline commands use the inferred form.

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

[`__examples__/docgen-service.ts`](./__examples__/docgen-service.ts) implements docgen against the current API: curried definition, both query shapes, an abstract command implemented at registration, a concrete inline command, a loader with an enumeration and a per-input file path.

Read it alongside `service-runtime.test.ts` and `build-artifacts.test.ts` — those test against the public surface only, so they double as usage examples.
