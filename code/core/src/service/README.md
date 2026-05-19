# Open Service Architecture

This folder is the runtime, build helpers, and type system for Storybook's Open Service Architecture — a generic primitive for declaring stateful features whose state can be read, mutated, subscribed to, and persisted across the dev/static-build divide.

Status: **research preview**. APIs are not yet stable. Used today by the docgen-server project; will widen over time.

## Where to start

If you're new, read in this order:

1. **[CONCEPTS.md](./CONCEPTS.md)** — the architecture itself. The four primitives (state, queries, commands, loaders), the encapsulation rule, the definition-vs-registration split, the ctx model, subscriptions, the curried `defineService<S>()` form.
2. **[STATIC-BUILD.md](./STATIC-BUILD.md)** — how the build pipeline writes a service's state to JSON and how registration loads it back. Includes the mock-transport pattern used in tests.
3. **[`__examples__/docgen-service.ts`](./__examples__/docgen-service.ts)** — a worked example exercising the full public API.

## File map

| File | Purpose |
| --- | --- |
| `types.ts` | All public type definitions. The conceptual overview lives at the top. |
| `define-service.ts` | `defineService`, `defineCommand`, `defineLoader`. Authoring helpers. |
| `service-runtime.ts` | The `ServiceRuntime` class. Owns state, runs commands, fires loaders, drives subscriptions. State is private to the runtime; only `ctx.self` can read or write it. |
| `register-service.ts` | `registerService(def, registration?)`, `getService(idOrDef)`, `getServiceRuntime(idOrDef)` (infrastructure-only). |
| `instances.ts` | The global service registry. Separate module so it can be mocked in tests. |
| `build-artifacts.ts` | `buildServiceArtifacts(def)` / `buildServiceArtifactsFromRuntime(runtime)`. The static-build writer. |
| `static-transport.ts` | The architecture-global transport. `setStaticTransport` / `clearStaticTransport` / `createBrowserStaticTransport`. Services never see or configure a transport themselves — it's installed once at app startup. |
| `use-service-query.ts` | `useServiceQuery(store, name, input?)` React hook. |
| `index.ts` | Public entry point. Re-exports everything stable. |
| `*.test.ts` | Vitest suites. The tests are written exclusively against the public API — they're the canonical answer to "how do I exercise this from outside?" |

## What's implemented

- Service definitions with state, queries, commands, and optional loaders.
- Two ways to author commands: inline functions for concrete cases, `defineCommand<TInput>()` for abstract cases that are implemented at registration.
- Two `defineService` forms: `defineService<S>()(...)` (curried, explicit state interface) and `defineService(...)` (inferred from `state:`).
- Immer-backed `setState` with patch capture.
- Query subscriptions that only fire when the selector result actually changes (structural equality).
- Loaders that fire once per distinct input, with in-flight dedup, on query subscribe or callable read.
- A static-build writer (`buildServiceArtifacts`) that emits `state.json` plus per-loader-input patch files; matching load-on-registration via an architecture-global transport that's installed once per app (or once per test). State and loader files are deep-merged / patch-applied in the runtime so the consumer-side API is identical across dev and static-build modes.
- Per-service opt-out via `load: false`.

## What's planned (not yet)

- Cross-service composition via `ctx.runtime[serviceId]`. Today handlers only see `ctx.self`.
- Channel-based multi-runtime synchronisation. The patch list already produced by `setState` is the unit of sync that this will use.
- Env-specific entry points (`service/browser.ts`, `service/node.ts`) bundling the right transport setup so apps don't have to call `setStaticTransport` themselves.

## How the tests are organised

- `service-runtime.test.ts` — exercises queries, commands, loaders, subscriptions, abstract commands, and encapsulation. Uses only the public `ServiceStore` surface.
- `build-artifacts.test.ts` — exercises the write side (`buildServiceArtifacts`), the load side (transport on registration), and the full round trip.

Both suites use a Map-backed mock transport when the test needs to simulate the browser-side fetch of static artifacts. See STATIC-BUILD.md for the pattern.
