# Open Service Architecture

A primitive for declaring stateful features whose state can be read, mutated, subscribed to, and persisted across the dev/static-build divide.

APIs are not yet stable. Used by the docgen-server project; will widen over time.

## Where to start

1. [CONCEPTS.md](./CONCEPTS.md) — the three primitives (state, queries, commands), the encapsulation rule, the definition/registration split, the `defineService<S>()` forms.
2. [STATIC-BUILD.md](./STATIC-BUILD.md) — how the build writes JSON artifacts and how the runtime loads them back lazily.
3. [`__examples__/docgen-service.ts`](./__examples__/docgen-service.ts) — a worked example.

## File map

| File | Purpose |
| --- | --- |
| `types.ts` | All public types. |
| `define-service.ts` | `defineService` (curried and inferred forms). |
| `service-validation.ts` | Standard Schema validation + `ServiceValidationError`. |
| `service-runtime.ts` | The `ServiceRuntime` class. Owns state, runs commands, fires query preloads, drives subscriptions. |
| `register-service.ts` | `registerService`, `getService`. |
| `instances.ts` | Global registry. Separate module so it can be mocked in tests. |
| `build-artifacts.ts` | `buildServiceArtifacts`. The static-build writer. |
| `static-transport.ts` | The global transport. `setStaticTransport`, `clearStaticTransport`, `createBrowserStaticTransport`. Services do not configure transports; the app installs one at startup. |
| `channel-transport.ts` | Optional cross-runtime channel: `setServiceChannel`, `clearServiceChannel`. Carries welcome-handshake + ongoing patch broadcast so peers in the same app stay in sync. |
| `use-service-query.ts` | `useServiceQuery` React hook (signals-backed `useSyncExternalStore` wrapper). |
| `index.ts` | Public entry point. |
| `*.test.ts` | Vitest suites. Written against the public API only. |

## What works today

- Services with state, queries, and commands.
- Queries and commands are inline objects: `{ input, output, select | handler, preload?, inputs?, path? }`. Every operation declares Standard Schema v1 `input` and `output` schemas; the runtime validates at the boundary.
- A command without `handler` is **abstract** — its body must be supplied at registration via `registerService(def, { commands: { … } })`.
- `defineService` forms: `defineService<S>(({ query, command }) => ({ … }))` (recommended), `defineService<S>()({ … })` (bare object), and `defineService()({ … })` (state inferred from the literal).
- Immer-backed `setState` with patch capture.
- Per-query subscriptions powered by `alien-signals`: a `computed(() => select(state, input))` per (query, input) memoises by reference equality, so subscribers re-fire only when this query's result actually changes. The React hook `useServiceQuery` is built on top.
- Queries with `preload`+`inputs`+`path` are the persistence mechanism. The build writes one JSON file per enumerated input; the runtime fetches lazily when the query is first subscribed. Queries without those fields have no static artifacts and run purely in session-local mode.

## Not yet

- Cross-service composition via `ctx.runtime[serviceId]`. Handlers only see `ctx.self` today.
- Channel-based command forwarding for abstract commands (so a client without the override can invoke a command on a client that has it). Today abstract command bodies are local to whichever client supplied them at registration.
- Env-specific entry points (`service/browser.ts`, `service/node.ts`) bundling the right transport setup so apps don't call `setStaticTransport` directly.
