# Concepts

A service is a unit of state plus the API for reading, mutating, and reacting to it. Every service consists of four things: a private `state`, a set of pure `queries` over that state, a set of `commands` that can mutate the state, and an optional set of `loaders` that bridge queries to async work (most importantly, to JSON files written at build time).

This document walks through each primitive, explains how they fit together, and calls out the rules that make the architecture coherent.

## The encapsulation rule

> **State is private to a service. Everything inside a service operates on the same state interface. The outside world only sees queries and commands.**

This is the load-bearing constraint, and it's worth keeping front of mind because almost every other decision falls out of it.

Concretely:

- The public `ServiceStore` returned by `registerService` exposes `id`, `definition`, `queries`, `commands`, and `ready`. There is no `getState`, no `setState`, no `subscribe(stateListener)` on the consumer-facing handle.
- Inside the service — that is, inside the body of a command, a loader, or (later) the static-build pipeline — `ctx.self.getState()` and `ctx.self.setState(...)` exist and are how those handlers touch state.
- If a service needs to read data from another service, it does so via the other service's queries, not by reading its state directly. (Cross-service composition isn't wired up yet; the `ctx.runtime[serviceId]` shape will be added in a later phase.)
- If a related feature wants to persist a different shape to JSON, that feature must be its own service. There is no mechanism for "a different file format for the same service" — a service's JSON artifacts always match its state interface.

The reason for the rule is that it makes the static-build story tractable. If state is private and the only way to change it is via commands, then "save the state of a service" is a well-defined operation, and "load the state of a service back" is symmetric to it. If state were public and free-form, the same data could end up in multiple shapes and it'd be ambiguous which is canonical.

## The four primitives

### State

A single object per service. Its shape is whatever the service author declares. The runtime stores it as an immutable value (via Immer) and treats every mutation as a transition that produces a new immutable value plus a list of Immer patches describing what changed.

Conventions worth following:

- For a service whose state holds many entries keyed by id, model it as `{ byId: Record<string, ...> }` (or `byComponentId`, `byStoryId`, etc.) rather than as an array. Arrays don't deep-merge cleanly and don't shard cleanly into per-id JSON files. This matters for the static-build story below.
- Don't put functions, class instances, DOM nodes, or anything that doesn't survive `JSON.stringify` into state. State is intended to be serialisable.

### Queries

Pure synchronous selectors over state. Signature is one of:

```ts
// no input
(state) => result

// input-keyed
(state, input) => result
```

Hard rules:

- Queries **must not** call commands, perform I/O, or otherwise side-effect. They're read-only by contract. If a query needs to trigger fetching, that goes in the paired `load.<name>` handler (see Loaders below).
- Queries are synchronous. They return the selector result immediately.

Why this matters: queries are the units of subscription. Every `useServiceQuery` or `service.queries.foo.subscribe(...)` runs the selector against current state, caches the result, and re-runs it on state changes to decide whether to notify. If queries had side effects, subscriptions would become a footgun. Keeping them pure makes "this query's result didn't change, so don't re-render" trivially correct.

### Commands

The write API. Signature is one of:

```ts
// no input
(ctx) => void | Promise<void>

// input-keyed
(input, ctx) => void | Promise<void>
```

`ctx.self` is how a command touches state. The full self-handle has:

- `ctx.self.getState()` — read.
- `ctx.self.setState((draft) => { ... })` — mutate via Immer draft. Assign to fields, push to arrays, delete keys; the runtime produces the new state plus a minimal patch list.
- `ctx.self.commands.<name>(...)` — call another command on this service.
- `ctx.self.queries.<name>(...)` — read via this service's own queries.

Commands can be async and can call into other I/O — that's the whole point of having a separate primitive from queries. They can also produce zero patches if their body decided not to mutate; in that case subscribers won't fire (no-op `setState` is detected and skipped).

#### Abstract vs concrete commands

Commands come in two flavours, and the distinction matters for the definition-vs-registration split that the architecture relies on for multi-environment services.

- **Concrete command** — a plain function in the `commands:` map. The body is defined inline.
- **Abstract command** — declared via `defineCommand<TInput>()` in the `commands:` map. No body; it's a placeholder. The implementation must be supplied at registration time via `registerService(def, { commands: { foo: handler } })`. If you forget, registration throws with an actionable error message.

The use case is: the same service definition is imported into multiple environments (manager, preview, server) and one or more commands have environment-specific bodies. The definition declares the command's existence and input type; each environment's registration supplies the body. This lets the shared definition stay environment-agnostic.

Concrete commands can also be overridden at registration if needed. That's useful when the same definition is mostly shared but one environment needs to swap in a different implementation.

### Loaders

The read-triggered backing for a query. Optional; only relevant for queries whose data is computed on demand (lazily generated or fetched from JSON in static-build mode).

Declared as a `load:` map keyed by query name. `load.getX` is the loader for `queries.getX`. The 1:1 mapping is structural, not enforced — but it's the contract the runtime is built around.

A loader has three pieces:

1. A handler — like a command, takes optional input and `ctx`, returns void/Promise. Typically calls one or more commands to populate state.
2. An enumeration — the list of inputs the static build should pre-render for this loader. Either a literal array or an async function that produces one. Pass `undefined` for no-input loaders.
3. Options — currently just a `path` callback that controls the per-input JSON filename in the static build. If absent, a default is used (`<name>.json` for no-input, `<name>-<input>.json` for string inputs; non-string inputs require an explicit `path`).

What the runtime does with loaders:

- On a query subscription (or callable read) for a given input, if the paired loader hasn't fired yet for that input, the runtime fires it. Subsequent reads with the same input don't re-fire — there's a "loader has fired for this input" tracking set per loader.
- Concurrent subscriptions for the same input dedupe to a single loader run. If three components subscribe to `getComponentDocgenInfo('Button')` simultaneously and the loader is still in flight, only one loader call happens; all three subscribers receive the eventual result.
- If an architecture-global static transport is installed (static-build deployment), the runtime fetches the loader's pre-rendered JSON file from the transport first. On a hit, the fetched Immer patches are applied to state and the loader body is *not* called. On null (no file for this input), the runtime falls through to running the loader body live. See `STATIC-BUILD.md` for details.
- The loader's return value is intentionally ignored. After the loader resolves, the runtime invokes the same-named query with the same input and that's what the subscriber sees. This enforces the "loader populates state, query reads state" pattern.

## Definition vs registration

A service is split into two phases.

### Definition

```ts
const DocgenService = defineService<DocgenState>()({
  id: 'core/docgen',
  state: { byComponentId: {}, somethingElse: 42 },
  queries: { ... },
  commands: {
    generateDocgen: defineCommand<string>(),
    modifySomethingElse: (ctx) => { ctx.self.setState((draft: DocgenState) => { ... }) },
  },
  load: { ... },
});
```

The definition is environment-agnostic. It declares the shape — state, query signatures, command signatures, loader plumbing — but isn't itself running. It's a description that can be imported into manager, preview, server, or test code.

A service definition is a singleton across the bundle: re-importing the same module yields the same definition reference. The registry's identity check is based on definition reference (not just id) — registering a different definition under the same id throws.

### Registration

```ts
const store = registerService(DocgenService, {
  commands: {
    generateDocgen: async (componentId, ctx) => {
      const result = await callTheAnalyzer(componentId);
      ctx.self.setState((d: DocgenState) => { d.byComponentId[componentId] = result });
    },
  },
});
```

Registration activates the definition in the current environment and returns the consumer-facing `ServiceStore`. It supplies anything the definition deferred:

- **Abstract command implementations** — any command declared via `defineCommand()` without a handler must be implemented here.
- **Concrete command overrides** — optional; lets a definition's inline command body be replaced per environment.

Note that there's no static-mode transport on the registration. Whether a service loads from JSON at boot is decided architecture-wide via `setStaticTransport`, not per-service — see STATIC-BUILD.md.

If you register the same definition twice with the same arguments, you get back the same `ServiceStore` reference. The registry de-duplicates by `definition.id`.

## ctx and the self-handle

Every command and loader receives a `ctx` argument. Today `ctx` has one field, `ctx.self`, which is the service's own handle. Inside a handler you can:

- Read state directly: `ctx.self.getState()`. Useful for read-modify-write logic before calling setState.
- Mutate state: `ctx.self.setState((draft) => { ... })`. Draft is a real Immer draft — assign, push, delete; the runtime captures the minimal patch list.
- Call another command or query on this service: `ctx.self.commands.foo(input)` / `ctx.self.queries.bar(input)`. Same self-handle, just nested.

The `setState` draft inside a command body is typed as the service's state. The `ctx` parameter itself is typed as `ServiceCtx<S>` when you use the curried `defineService<S>()(...)` form — see the next section for the trade-off.

There's deliberately no `ctx.runtime[otherServiceId]` yet — cross-service composition is a future addition. When it lands, the shape will be that handlers can read from other services via their public query API, but can never write to or read the raw state of another service. The encapsulation rule applies even across service boundaries.

## defineService — curried vs inferred

Two equivalent ways to declare a service:

### Curried form

```ts
defineService<DocgenState>()({ id, state, queries, commands, load })
```

Pass the state interface as the outer generic. Inside, the `state` parameter of every query and the `ctx` parameter of every command/loader is inferred for you — no annotation needed. Use this whenever you have a named state interface and would otherwise be writing `(state: DocgenState, ...)` repeatedly.

One quirk worth knowing: contextual typing of the `draft` parameter inside a `ctx.self.setState((draft) => ...)` callback doesn't propagate through the command-type's union, so `draft` still needs an explicit `(draft: DocgenState) => ...` annotation. This is a TypeScript limitation, not ours — we verified it on a minimal reproduction. Future workaround possibilities are noted in the JSDoc above `defineService`.

A second quirk: 2-arg inline commands (`(input: T, ctx) => ...`) under the curried form get the contextual type "collapsed" by TS in a way that produces wrong `Parameters` inference. For those commands, drop to the inferred form below, or use the abstract `defineCommand<T>()` and supply the body at registration (recommended anyway for environment-specific commands).

### Inferred form

```ts
defineService({ id, state, queries, commands, load })
```

State is inferred from the `state:` literal. Queries still get contextual typing for `state` (because the query map's type references the state generic). Commands lose contextual typing for `ctx` because of TS union-overload limits, so authors annotate `ctx: ServiceCtx<MyState>` on each command body. With-input inline commands work fine in this form.

Both forms produce the same `ServiceDefinition`. Pick whichever is more ergonomic for the specific service. The codebase uses the curried form in the docgen example and the inferred form in tests that have 2-arg inline commands.

## Subscriptions

Every query is subscribable:

```ts
const unsub = store.queries.getComponentDocgenInfo.subscribe('Button', (value) => {
  // value is the new selector result; this fires only when it actually changes
});
```

The runtime maintains a per-(queryName, input) cache of the last result seen by subscribers. On every `setState`, it re-runs each subscribed query against the new state, structurally compares the result against the cache, and notifies only the subscribers whose result actually changed. A no-op setState (zero patches) is detected upstream and skips all this work.

The implication that matters most for service authors: design queries to return narrow data. If a subscriber on `getStorybook()` returns the whole state, every mutation triggers a re-render. If it returns `state.title`, only title changes do.

The React hook `useServiceQuery(store, queryName, input?)` is a thin wrapper around `useSyncExternalStore` with this subscription. It re-renders only on result changes.

`store.subscribe(stateListener)` exists on the runtime class for infrastructure use (build pipeline, transport sync) but is **not** part of the public `ServiceStore` surface. Application code should subscribe to queries, not to whole-state changes — that's the encapsulation rule again.

## Worked example

See [`__examples__/docgen-service.ts`](./__examples__/docgen-service.ts) for the docgen service implemented against the current API. It exercises: the curried definition form; a no-input and an input-keyed query; an abstract command implemented at registration; a concrete inline command; a loader with both an enumeration and a per-input file path.

Read the example alongside the tests in `service-runtime.test.ts` and `build-artifacts.test.ts` — they're written exclusively against the public surface, so they double as documentation for "how do I exercise this from outside?"
