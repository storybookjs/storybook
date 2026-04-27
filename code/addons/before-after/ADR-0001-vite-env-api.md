# ADR-0001 — Use the Vite Environment API for the "before" iframe

| Status | Accepted (gated, opt-in) |
|---|---|
| Date | 2026-04-27 |
| Plan | `.omc/plans/before-after-vite-env-api.md` (iteration 3) |
| Audit | `code/addons/before-after/AUDIT.md` |

## Context

`@storybook/addon-before-after` shows two side-by-side previews of a story —
"before" (HEAD blob content) and "after" (working-tree content). The shipping
implementation boots a **second Storybook subprocess** to serve the "before"
iframe: full Node bootstrap, second config resolution, second Vite dev server,
IPC over a channel. This is heavy and fragile.

Vite 7 ships the **Environment API** as a stable feature for hosting multiple
independent module graphs in a single dev server. Each environment has its own
`moduleGraph`, its own plugin pipeline (filtered via `applyToEnvironment`), and
its own dependency optimiser cache, while sharing the underlying HTTP server
and connection.

## Decision

Replace the subprocess design with a single-process design that registers a
`storybookBefore` environment in the main Vite dev server. Route requests
carrying `?env=before` through that environment. Rewrite imports at transform
time to propagate the marker. Gate the new path behind
`STORYBOOK_BEFORE_AFTER_ENV_API=1`. Keep the subprocess code in tree, untouched,
as the default path until the env-API path soaks for one minor release.

## Decision drivers

1. Match the user's explicit ask: use the Vite Environment API.
2. Eliminate subprocess overhead (Node bootstrap, second config resolution, IPC).
3. Preserve plugin correctness via Vite-native per-environment moduleGraph
   rather than addon-level `(id, env)` rekeying.

## Alternatives considered

- **Option B — keep the subprocess.** Pros: maximal OS isolation. Cons: heavy
  bootstrap; fragile IPC; doubled Vite memory; configuration drift between the
  two servers. Acknowledged but rejected.
- **Option C — single environment, query-only routing.** Same `?env=before`
  marker, but a single moduleGraph with per-id branching at `load()`. Rejected
  because plugin-cache pollution becomes structural: every plugin in the chain
  would need `(id, env)` keying. The Environment API exists precisely to solve
  this; using anything else duplicates work.
- **URL-prefix routing (`/__before/...`).** Removed from consideration in an
  earlier ralplan iteration; not relitigated here.

## Consequences

1. **Loss of OS-level isolation.** The before environment runs in the same Node
   process as the after environment. A hard crash inside HEAD-content code can
   in principle take the whole dev server down. Mitigated — not eliminated — by
   AsyncLocalStorage-scoped `unhandledRejection` swallow + structured channel
   error event (verified by `crash-containment.test.ts`).
2. **Per-environment moduleGraph is Vite-native.** Memory cost is real and
   bounded; it is the idiomatic primitive for this exact problem. We do **not**
   invent a parallel `(id, env)` key.
3. **Vite < 6 unsupported on the env-API path.** A circuit breaker at
   `viteFinal` entry throws `BeforeAfterUnsupportedViteError` with a clear,
   actionable error. Vite 5 users keep the subprocess path until the flag is
   default-on.
4. **Plugin compatibility surface.** Any plugin that asserts `env.name === 'client'`
   needs upstream fixing or a dual-instance workaround. The audit
   (`AUDIT.md`) documents the current chain; none of the active plugins assert
   that today.
5. **Toggle requires Storybook restart.** `STORYBOOK_BEFORE_AFTER_ENV_API` is
   read once at boot. Documented in the addon README.

## Implementation summary

- `before-environment-plugin` registers `config.environments.storybookBefore`,
  middleware that routes `?env=before` requests through that env's
  `transformRequest`, an `index.html` URL rewriter, an `oxc-parser` +
  `magic-string` import-specifier rewriter (gated to the before env),
  per-config `WeakSet<InlineConfig>` re-entrance, and an
  `AsyncLocalStorage`-scoped unhandled-rejection swallow.
- `before-content-plugin` is `applyToEnvironment`-scoped to `storybookBefore`
  on the env-API path; its `load()` returns the HEAD blob via
  `git-file-at-head.ts`.
- Channel events: legacy `SERVER_READY { port }` retained for one deprecation
  cycle; new `SERVER_READY_V2 { url, environment }` is preferred.
  `REQUEST_SERVER_STATUS` is an idempotent polling endpoint that mitigates the
  sync-emit-before-listener race.
- `code/builders/builder-vite/` is **not** modified. The addon's `viteFinal`
  hook adds `config.environments.storybookBefore`; Vite 7 honours it natively.

## Follow-ups

1. Delete the subprocess code (`before-server.ts`, `before-server-subprocess.ts`,
   `before-server-launcher.ts`) after probes pass on `react-vite/default-ts`
   AND `vue3-vite/default-ts` and the env-API path soaks for one minor release.
2. File any upstream plugin bugs surfaced by the Step 5 audit (none required at
   ADR acceptance).
3. Consider promoting the flag to default-on after one minor release of soak.
