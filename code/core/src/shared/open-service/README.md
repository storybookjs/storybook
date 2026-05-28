# Open Service

`open-service` is a small schema-driven service system for Storybook internals.

Its goals are:

- define stateful services in one declarative object
- expose synchronous queries and async commands with strong TypeScript inference
- validate all query and command input/output through Standard Schema
- support reactive query subscriptions through `alien-signals`
- support server-side static state snapshots driven by query `load` hooks

The main audience for this README is agents and maintainers who need to understand how the pieces
fit together, where behavior lives, and how to define new services correctly.

## Public Surface

External callers should import from one of two entrypoints:

- [index.ts](./index.ts) for environment-agnostic definition helpers and shared types
- [server.ts](./server.ts) for server-only registration, discovery, and static snapshot writing

The environment-agnostic API consists of:

- `defineService`
- the exported type aliases from [types.ts](./types.ts)

The server-only API consists of:

- `registerService`
- `listServices`
- `describeService`
- `getService`
- `getRegisteredServices`
- `buildStaticFiles`
- `writeOpenServiceStaticFiles`

Internal tests and implementation code may import from the individual modules directly.

## File Layout

- [index.ts](./index.ts): environment-agnostic barrel for definition helpers and shared types
- [server.ts](./server.ts): server-only entrypoint that re-exports registration APIs and owns static snapshot building/writing
- [types.ts](./types.ts): core type model for definitions, contexts, runtime instances, and static build data
- [service-definition.ts](./service-definition.ts): `defineService()` typing that preserves inline inference when declaring services
- [service-validation.ts](./service-validation.ts): sync + async schema validation helpers and error wrapping
- [errors.ts](./errors.ts): validation metadata formatting helpers
- [service-runtime.ts](./service-runtime.ts): signal-backed runtime construction, in-flight load registry, drain logic, and subscriptions
- [service-registration.ts](./service-registration.ts): server-side global registry implementation and the shared registry API passed into runtimes
- [fixtures.ts](./fixtures.ts): scenario fixtures used by the test suite
- `*.test.ts`: focused tests for runtime behavior, validation behavior, server registration, and server static builds

## Core Concepts

### Service

A service is a state container with:

- a stable `id`
- an `initialState`
- a `queries` map
- a `commands` map
- optional descriptions on the service and each operation

Use `defineService()` to preserve the concrete query and command map types.

### Query

A query is:

- **synchronous at call time**: `service.queries.foo(input)` returns the validated handler result immediately
- **read-only**: the handler receives `{ state, queries }` and cannot mutate state or call commands
- **load-coupled**: calling a query also fires its optional `load` hook in the background, deduped per `(service, query, input)` while one is already in flight
- **subscribable** through `query.subscribe(input, callback)`
- **awaitable in full** through `query.loaded(input)`, which returns a promise that settles once the load and every transitively touched dependency have completed
- **statically buildable** through `static.inputs`

Query handlers receive a `QueryCtx`:

- `ctx.self.state`
- `ctx.self.queries`
- `ctx.getService(serviceId)` — synchronous

Query handlers do **not** receive `commands` or `setState`. Mutations belong in commands; load-time preparation belongs in `load`.

### Load

`load` is an optional async hook on each query definition. It receives a `LoadCtx`:

- `ctx.self.state`
- `ctx.self.queries` — wrapped versions of the service's own queries; calling them inside `load` registers transitively triggered loads into the current drain
- `ctx.self.commands` — declared commands, used for all state mutation (load contexts do not receive `setState` directly)
- `ctx.getService(serviceId)` — synchronous

`load` mutations must go through commands. Cross-service `getService(...).queries.*` calls inside a load body are not auto-tracked for the drain; use `await ctx.getService(id).queries.foo.loaded(input)` when you need a cross-service dependency awaited before your own load completes.

### Command

A command is:

- always async at call time
- allowed to mutate state through `ctx.self.setState(...)`
- validated on both input and output

Commands receive a `CommandCtx` whose `self` includes `state`, `queries`, `commands`, and `setState`.

### Validation

Every query and command must declare:

- `input`
- `output`

Both must be Standard Schema compatible.

The runtime validates:

- caller input before a handler runs
- handler output before the result is returned or emitted

Queries validate **synchronously**. Their input and output schemas must produce sync results. If a Standard Schema returns a Promise during a query validation, the runtime throws `OpenServiceAsyncSchemaError` immediately.

Commands validate asynchronously and accept async schemas.

Validation failures become `OpenServiceValidationError` with a message that includes:

- whether the failure happened on input or output
- whether the failing operation is a query or command
- the full `serviceId.operationName`
- one line per issue, including path and the schema's expectation text

Handling of extra object fields depends on the schema implementation you choose. The current test fixtures use Valibot `object(...)` schemas, which accept unexpected extra fields rather than rejecting them.

## Server Registration Flow

Server-side registration happens through the `services` preset hook. Storybook calls `await presets.apply('services')` during both dev startup and static builds, and each service author's preset implementation is responsible for calling `registerService(...)` directly.

That split is intentional:

- [index.ts](./index.ts) stays environment-agnostic so preview, manager, and server code can share one definition surface
- [server.ts](./server.ts) owns the concrete global registry and static snapshot writing for the current server process

The internal Storybook config also registers an example debug service through that hook behind a temporary boolean gate in `.storybook/main.ts`.

## Runtime Flow

When a server registers a service definition:

1. [service-registration.ts](./service-registration.ts) merges any registration-time handler overrides.
2. It passes the shared registry API into [service-runtime.ts](./service-runtime.ts).
3. [service-runtime.ts](./service-runtime.ts) creates a signal-backed state container from `initialState`.
4. It builds a writable `commandSelf` reference around that state.
5. It builds commands that validate input, run handlers, and validate output.
6. It builds queries that validate input synchronously, fire any pending `load` in the background (deduped while in flight), run the handler synchronously, and validate the output.
7. [service-registration.ts](./service-registration.ts) stores the resulting runtime behind the server registry entry for later lookup.

## In-flight Load Registry

`service-runtime.ts` owns one process-global in-flight load registry keyed by `${serviceId}::${queryName}::${stableHash(parsedInput)}`. The hash uses stable JSON (sorted keys) computed from the post-validation parsed input, so inputs are expected to be JSON-safe. Two concurrent callers for the same key share one load; once it settles, the entry is removed so future calls can refire it. There is no caller-facing invalidation API.

## `.loaded()` Semantics

`query.loaded(input)` is intentionally narrow: it awaits **only this query's own** `load` (deduped via the in-flight registry), then returns the synchronous handler result.

Dependencies are **not** discovered automatically. A query whose handler reads from another query is responsible for awaiting that dependency inside its own `load`:

```ts
load: async (input, ctx) => {
  // Explicit chain — must mirror what the handler reads.
  await ctx.getService('other-service').queries.someQuery.loaded(input);
}
```

If a load forgets to chain a dependency, `.loaded()` returns whatever the handler can read from the current state — possibly a partial value (often `null`). Author-side tests that assert the loaded value catch missing chains quickly.

There is no cycle detection. Authors who write self-awaiting load chains (`a.load` awaits `b.loaded`, `b.load` awaits `a.loaded`) get a real promise deadlock — surface those bugs through tests.

## Subscription Flow

Subscriptions are implemented with `alien-signals` in [service-runtime.ts](./service-runtime.ts):

1. `subscribe(input, callback)` defers all work to a microtask.
2. The microtask validates the input synchronously and fires the dependency's `load` in the background.
3. A `computed()` value wraps the synchronous handler. An `effect()` runs the handler immediately (delivering the current value to the callback) and re-runs whenever the handler's tracked state dependencies change.
4. Subscribers receive the current state right away, then a follow-up emission once the load settles and state changes. UI consumers that want to suppress the pre-load emission should branch on the value (e.g. show a spinner for `null`).
5. Each emitted value is output-validated before the subscriber callback runs.

Tests should use `vi.waitFor(...)` when asserting the first emission or follow-up emissions.

## Static Snapshot Flow

`buildStaticFiles(services)` in [server.ts](./server.ts) looks for queries that define:

- `load`
- `static.inputs`

For each static input it:

1. creates a fresh runtime from `initialState`
2. validates the static input using the query's `input` schema
3. runs the runtime's `runLoadOnce(queryName, validatedInput)` helper, which drives the load body (and any loads it triggers via wrapped self queries) to completion
4. resolves the normalized logical output path
5. stores the resulting runtime state in the final `StaticStore`

If multiple tasks resolve to the same path, their states are deep-merged.

`writeOpenServiceStaticFiles(outputDir)` then writes those logical paths underneath `<outputDir>/services`, converting slash-separated logical keys into native filesystem paths for the current operating system.

These snapshots are currently only a build artifact for the server-side static build flow. This slice does not implement a separate runtime mode that consumes prebuilt snapshot stores instead of running `load` normally.

Static path rules:

- authors should think in forward-slash logical paths such as `nested/file.json`
- leading `./` and `/` are normalized away
- backslashes are normalized to `/`
- `..` segments are rejected so snapshots cannot escape `<outputDir>/services`

## How To Define A Service

Define queries and commands inline inside `defineService()` so the service-level schema maps can contextually type every handler, load hook, and `ctx.self.commands.*` call:

```ts
import * as v from 'valibot';

import { defineService } from './index.ts';
import { registerService } from './server.ts';

type ExampleState = {
  values: Record<string, string | undefined>;
};

const entryIdSchema = v.object({ entryId: v.string() });
const valueSchema = v.nullable(v.string());

export const exampleServiceDef = defineService({
  id: 'example/service',
  description: 'Example service used in documentation.',
  initialState: { values: {} } satisfies ExampleState,
  queries: {
    getValue: {
      description: 'Returns one value by id.',
      input: entryIdSchema,
      output: valueSchema,
      handler: (input, ctx) => ctx.self.state.values[input.entryId] ?? null,
      load: async (input, ctx) => {
        if (!(input.entryId in ctx.self.state.values)) {
          await ctx.self.commands.preloadValue(input);
        }
      },
      static: {
        inputs: async () => [{ entryId: 'a' }, { entryId: 'b' }],
      },
    },
  },
  commands: {
    preloadValue: {
      description: 'Fills state for one id.',
      input: entryIdSchema,
      output: v.void(),
      handler: async (input, ctx) => {
        ctx.self.setState((draft) => {
          draft.values[input.entryId] = 'ready';
        });
      },
    },
  },
});

const exampleService = registerService(exampleServiceDef);

// Sync read — returns current state (null if load hasn't run yet) and fires load in the background.
const current = exampleService.queries.getValue({ entryId: 'a' });

// Awaited variant — waits for load (and any transitive deps) to settle, then returns the value.
const ready = await exampleService.queries.getValue.loaded({ entryId: 'a' });
```

## Design Rules

- Always declare both `input` and `output` schemas on every query and command.
- Use `load` for read-side warming. The hook is async and must mutate via commands.
- Query handlers are strict readers: sync, no commands, no `setState`.
- Use commands for all state mutation.
- Keep environment-agnostic imports on [index.ts](./index.ts) and server-only imports on [server.ts](./server.ts). Import internal modules directly only from tests or implementation code in this directory.
- Use `.loaded()` when a caller wants to await the full state; use the sync form when "current best" is fine.

## Testing Guidance

- Runtime behavior belongs in [service-runtime.test.ts](./service-runtime.test.ts)
- Validation behavior belongs in [service-validation.test.ts](./service-validation.test.ts)
- Server registration and static snapshot behavior belong in [server.test.ts](./server.test.ts)
- Reusable scenario definitions belong in [fixtures.ts](./fixtures.ts)

When adding validation tests, prefer asserting the full exact error message. That keeps the tests useful as executable documentation for callers and agents.

## Agent Notes

- If you need to change runtime behavior, start in [service-runtime.ts](./service-runtime.ts).
- If you need to change server registration, start in [service-registration.ts](./service-registration.ts).
- If you need to change static snapshot building or writing, start in [server.ts](./server.ts).
- If you need to change validation wording, start in [errors.ts](./errors.ts).
- If you need to change schema handling, start in [service-validation.ts](./service-validation.ts).
- If you need to change service authoring ergonomics, start in [service-definition.ts](./service-definition.ts) and [types.ts](./types.ts).
