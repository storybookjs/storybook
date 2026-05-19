# Open Service Architecture

A primitive for declaring stateful features whose state can be read, mutated, subscribed to, and persisted across the dev/static-build divide.

APIs are not yet stable. Used by the docgen-server project; will widen over time.

## Where to start

1. [CONCEPTS.md](./CONCEPTS.md) — the four primitives (state, queries, commands, loaders), the encapsulation rule, the definition/registration split, the `defineService<S>()` forms.
2. [STATIC-BUILD.md](./STATIC-BUILD.md) — how the build writes JSON artifacts and how the runtime loads them back lazily.
3. [`__examples__/docgen-service.ts`](./__examples__/docgen-service.ts) — a worked example.

## File map

| File | Purpose |
| --- | --- |
| `types.ts` | All public types. |
| `define-service.ts` | `defineService`, `defineCommand`, `defineLoader`. |
| `service-runtime.ts` | The `ServiceRuntime` class. Owns state, runs commands, fires loaders, drives subscriptions. |
| `register-service.ts` | `registerService`, `getService`, `getServiceRuntime` (internal). |
| `instances.ts` | Global registry. Separate module so it can be mocked in tests. |
| `build-artifacts.ts` | `buildServiceArtifacts`. The static-build writer. |
| `static-transport.ts` | The global transport. `setStaticTransport`, `clearStaticTransport`, `createBrowserStaticTransport`. Services do not configure transports; the app installs one at startup. |
| `use-service-query.ts` | `useServiceQuery` React hook. |
| `index.ts` | Public entry point. |
| `*.test.ts` | Vitest suites. Written against the public API only. |

## What works today

- Services with state, queries, commands, and optional loaders.
- Two ways to write commands: inline functions for concrete cases, `defineCommand<TInput>()` for abstract cases implemented at registration.
- Two `defineService` forms: `defineService<S>()(...)` (curried, explicit state type) and `defineService(...)` (state inferred from the literal).
- Immer-backed `setState` with patch capture.
- Per-query subscriptions that re-render only when the selector result changes.
- Loaders are the *only* persistence mechanism. A service that declares loaders writes one JSON file per enumerated input at build time and fetches each file lazily when the corresponding query is first subscribed. A service without loaders has no static artifacts and runs purely in session-local mode.

## Not yet

- Cross-service composition via `ctx.runtime[serviceId]`. Handlers only see `ctx.self` today.
- Channel-based multi-runtime sync.
- Env-specific entry points (`service/browser.ts`, `service/node.ts`) bundling the right transport setup so apps don't call `setStaticTransport` directly.
