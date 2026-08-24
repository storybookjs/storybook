# Tools CLI attachment architecture

The `storybook tools` CLI attaches to a running Storybook dev server as another Open Service
runtime. The Node SDK `storybook/internal/tools` is the core; the CLI is a slim shell. MCP is not
on the tools dispatch path.

**Caller** = the temporary tools CLI/SDK process. **Instance** = the long-running dev server.

Open-service contract: [README.md](../../shared/open-service/README.md). Operational usage:
[README.md](./README.md).

## Context

Toolsets are the public agent surface (MCP and `storybook tools`). Attached mode joins the single
Open Service environment as another runtime, like the manager UI: it loads the instance's config
and presets (registering every service), connects to the instance channel over WebSocket, syncs
service state, runs the toolset handler caller-side, and **always dispatches service commands to
the instance**. Cold-boot-heavy work (docgen, tests) runs where the warm resources already live.

Accepted constraints:

- Connect over WebSocket to `/storybook-server-channel`. No UDS/named-pipe IPC.
- The instance writes its channel token into `~/.storybook/instances/<id>.json` (file `0600`, dir
  `0700`). The endpoint is `record.url` plus the channel path constant.
- The upgrade handler accepts a missing `Origin` when the token is valid. Browser rules stay
  unchanged.
- CLI default is attach-preferred. `--attach` requires attachment. `--no-attach` forces local.
- Factory-time gate failures print the exact corrective command. In `auto` they then fall back to
  local. Post-attach `tools.call` failures (disconnect, remote ack timeout) do not fall back.
- `storybook tools` consumes the SDK. There is no `PROXY_VIA_MCP_METHODS` on this path.
- Attach coverage lives in `code/e2e-internal/`. Filesystem unit tests use memfs.

## ADRs

### ADR-A1: Delegation is a dispatch-time runtime mode, not registration stripping

The caller registers services through the same `services` preset the server runs. Implementations
stay registered. A per-runtime **delegated mode**, set once at the attached entry before the first
`registerService`, makes command dispatch skip local handlers and route every command over the
channel (`services:command-invoke` → `command-ack` → `command-result` / `command-error`). Errors
rebuild through `service-error-serialization.ts`. No remote implementer within the ack timeout →
`OpenServiceRemoteCommandUnhandledError` with attach-specific guidance.

See [Delegated mode](../../shared/open-service/README.md#delegated-mode).

### ADR-A2: Registration side effects — audit, then accept lazy waste

Running the services preset in the caller executes server-realm registration code. Audit each
registration for eager heavy work (worker spawns, file watchers, index builds). Work that is
already lazy (triggered by commands or loads, which delegate) is harmless registration overhead.
Fix stragglers in core plumbing, never in service-author code.

### ADR-A3: Topology — the caller is a leaf and a follower

Open-service role: leaf (`relay: false`, like preview). The caller talks to the server hub
directly and never relays. UniversalStores prepare against the real channel as followers. The
dispatcher sets `STORYBOOK_ATTACHED_TOOLS` before importing core so those stores are born
followers; local fallback deletes that env before loading the local runtime.

### ADR-A4: Twin enforcement is mechanical — via the SDK's auto-spawn

Attached mode requires the same version, same config, and same cwd as the instance. Enforcement
lives in the SDK, not the CLI: when `createTools` cannot faithfully be the environment
in-process, it spawns a child host from the instance's project-local package.

### ADR-A5: Fidelity check triggers on any cwd mismatch

The child host is used whenever `process.cwd() !== record.cwd`, even when versions match, so
module resolution, `.env`, and relative paths match the instance. A version mismatch with the
invoked package (for example `npx storybook@latest` from the right directory) also triggers the
child via project-local resolution. When the package resolved under the instance cwd **also**
mismatches the record (server started before a dependency upgrade), spawning cannot help: the
error is "restart your Storybook". Attached mode never `chdir`s the host; the child host is the
honest implementation of `cwd`. Local mode does `process.chdir` to the target for the rest of
the one-shot process.

### ADR-A6: Spawn safety rails

Child = the instance-cwd-resolved `storybook` package's host entry, `cwd = record.cwd`, resolved
with `createRequire(join(record.cwd, 'package.json'))` — not `import.meta.url`. Loop guard: a
child host never spawns another host; residual mismatch is a prescriptive error. Resolution
failure → `SpawnFailedError`. The fidelity check runs before config load. Kill the child on
`close()`. The child self-exits when the parent IPC channel closes. Child logs are piped and
re-emitted by the parent.

### ADR-A7: Thin-load discipline by convention

Query `load` hooks must be thin command triggers (the docgen pattern: `load` only awaits
`extractDocgen`). Delegation then lands warm-up work on the instance. Enforcement is the
open-service README, upheld in review; there is no lint rule. State readiness is `query.loaded()`.
A bare `.get()` before snapshots arrive reads initial state — the same semantics the manager has.

### ADR-A8: `requiresDevServer` narrows; telemetry follows execution

(a) The trait name stays (`tools-command` telemetry stability). In local mode it intercepts with
start-your-Storybook guidance. In attached mode it is moot. `stories.preview` runs caller-side
and reads origin from the record.

(b) The CLI fires an outer `tools-command` invocation event after a run. Per-method toolset
telemetry (`ctx.telemetry`) fires caller-side when the CLI passes a sink into `tools.call`.
Command-level side effects and their telemetry still land on the instance. Event name
`tools-command` stays; the payload includes `attachMode`.

### ADR-A9: The SDK is the architecture's core; the CLI is a slim shell over it

`storybook/internal/tools` owns both modes (future public home: `storybook/tools`). Local mode
absorbs in-process bootstrap; attached mode is connect + delegated registration. Mode
(`attached` | `local`) and host (`in-process` | `child`) are orthogonal. The CLI parses flags,
renders help and outcomes, and sets exit codes. It has no process-spawn logic of its own.

### ADR-A10: Loader shim (pending)

An embedder's bundled `storybook` copy must never execute toolset code (version skew). The intended
fix is a thin, forever-stable loader that resolves the real implementation from the project's
installation (`require.resolve('storybook/internal/tools', { paths: [projectDir] })` + dynamic
import) and forwards `createTools` verbatim. The shim chooses **which code**; auto-spawn chooses
**which environment**.

This ADR is accepted as design. The implementation is not in this stack yet; it lives in draft
#35989. Until that lands, `createTools` is the in-repo SDK entry, not a project-local loader.

### ADR-A11: Auto-spawn child host, with rails

When the fidelity check (ADR-A5) fails, `createTools` spawns a child host: a small entry in the
project-local package that boots the runtime in the right cwd and serves describe/call/close over
Node parent-child IPC. The parent `Tools` object is a proxy. Rails:

- `autoSpawn: false` throws `EnvironmentMismatchError { instanceCwd, resolvedBinPath, reason }`.
- IPC is the serialized SDK API plus a version field in the child's hello. Cancellation is a
  message keyed by call id.
- Lifecycle per ADR-A6. The CLI has no respawn of its own.

### ADR-A12: The SDK API

See [README.md](./README.md#sdk). Vocabulary: **tools** for the surface, **toolset** as the
grouping term, dotted method refs matching internal `ToolsetMethodId`. A long-lived consumer
amortizes config load across many calls on the live synced runtime.

## End-to-end flow (attached)

1. **Discover.** Read `~/.storybook/instances/*.json` (pid-liveness-checked). Match by cwd /
   configDir. No record → local fallback, or a hard error under `--attach`.
2. **Gate + fidelity.** Token present (else "restart Storybook" + fallback). Same cwd and
   version, else auto-spawn (or `EnvironmentMismatchError` when `autoSpawn: false`).
3. **Connect.** `createNodeChannel` to `record.url` + `/storybook-server-channel?token=…`, no
   Origin. `UniversalStore.__prepare(channel, follower)`.
4. **Register.** Load config from `record.configDir`. Set delegated mode. `services:sync-start`
   pulls snapshots and patches from the server.
5. **Execute.** Toolset handler runs caller-side (`ctx.transport = 'cli'`). Queries read synced
   state. `.loaded()` warms via delegated commands. Every command goes over the channel.
6. **Render + close.** `ToolsetOutcome` through markdown / `--json`; `ok` drives the exit code.

Local mode (no instance, or `--no-attach`) is in-process bootstrap with no proxy branch.

## Failure matrix

Messages must name the exact corrective command.

| Failure                           | Detection                             | Message must include                                                                             |
| --------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| No instance for this project      | No cwd/configDir match                | How to start Storybook; other running instances with `cwd` + `url`; exact `cd` or `--config-dir` |
| Multiple matches                  | 2+ records match                      | Matched instances with `configDir`; `--config-dir <dir>`                                         |
| Old server                        | Token absent                          | Restart Storybook (vX.Y+) to enable attach                                                       |
| Stale record / connection refused | WS connect fails                      | Registry cleanup; fallback note                                                                  |
| Server started before upgrade     | Instance-cwd package ≠ record version | Both version strings; restart Storybook                                                          |
| Spawn resolution failure          | No `storybook` under `record.cwd`     | `SpawnFailedError` remediation; local fallback                                                   |
| Config drift                      | Remote command ack timeout            | Running Storybook was started with a different configuration — restart it                        |

Rows other than config drift are factory-time attach gates. In `auto`, those return a local host
and a fallback notice (omitted from `--json` output). Under `--attach`, they are hard errors with
the same text. Config drift is a post-attach `tools.call` failure: `auto` does not fall back then.

## Risks

- Shared command-ack timeout: a busy instance event loop can delay acks and surface a spurious
  `OpenServiceRemoteCommandUnhandledError`. Watch this in e2e under load.
- UniversalStore follower hard timeout: same treatment.
- Eager registration side effects (ADR-A2): docgen worker, module-graph watchers, vitest boot,
  story index builds.
- In-flight disconnect must reject pending remote commands (map `CHANNEL_WS_DISCONNECT`), not hang.
- Parent SIGKILL must not leave a config-loaded child running.
- Config/preset load latency per attached CLI call is accepted; keep it visible.

## Glossary

- **Runtime**: a process/realm on the channel bus (server, manager, preview, attached caller).
- **Attached mode**: the caller joining the instance's Open Service environment as a runtime.
- **Local mode**: the SDK bootstrapping the full in-process runtime with no instance.
- **Delegated mode**: caller-side dispatch policy — every service command executes on the instance.
- **Open service**: state + queries + commands. Queries are synchronous local reads over synced
  state; commands do work that produces state.
- **Thin-trigger load**: a query `load` hook that only awaits commands, so delegation is
  transitive.
- **Instance registry**: `~/.storybook/instances/<id>.json`, written by running dev servers,
  pid-liveness-checked; carries the channel token.
- **Tools SDK**: `storybook/internal/tools` — owns both modes. `createTools` → `{ describe, call,
close, mode, storybook }`.
- **Fidelity check**: whether this process can be the instance's twin (cwd + version). Failure
  triggers the child host.
- **Child host**: the project-local, right-cwd child serving the SDK API over parent-child Node
  IPC; the parent `Tools` is a proxy.
- **Loader shim**: (pending, #35989) the thin forever-stable entry that resolves the real SDK from
  the target project's installation. Not shipped on this head.
