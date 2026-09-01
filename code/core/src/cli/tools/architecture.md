# Tools CLI attachment architecture

The `storybook tools` CLI attaches to a running Storybook as another Open Service runtime. The
Node SDK `storybook/internal/tools` owns both runtimes. The CLI parses flags, renders help and
outcomes, and sets exit codes.

**Caller** = the temporary tools CLI/SDK process. **Instance** = the long-running dev server.

Open-service contract: [README.md](../../shared/open-service/README.md). Operational usage:
[README.md](./README.md).

## How attached mode works

Toolsets are the public agent surface for MCP and `storybook tools`. Attached mode joins the
instance's Open Service environment as another runtime, like the manager UI. It loads the instance
config and presets (registering every service), connects to the instance channel over WebSocket,
syncs service state, runs the toolset handler in the caller, and dispatches every service command
to the instance. Cold-boot work (docgen, tests) runs where the warm resources already live.

The caller connects to `/storybook-server-channel` over WebSocket. The instance writes its channel
token into `~/.storybook/instances/<id>.json` (file `0600`, dir `0700`). The endpoint is
`record.url` plus that path. The upgrade handler accepts a missing `Origin` when the token is
valid.

CLI default is `auto`: attach when a matching instance is running, otherwise load locally.
`--attach` requires attachment. `--no-attach` forces local. A missing instance falls back to
local with no notice. Unexpected factory-time gate failures print the exact corrective command
and then fall back. A later `tools.call` failure (disconnect, remote ack timeout) stays on the
attached host.

Attach coverage lives in `code/e2e-internal/`. Filesystem unit tests use memfs.

## Delegation

The caller registers services through the same `services` preset the server runs. Implementations
stay registered. `setDelegatedMode(true)` runs once at the attached entry, before the first
`registerService`. Command dispatch then skips local handlers and routes every command over the
channel (`services:command-invoke` → `command-ack` → `command-result` / `command-error`). Errors
rebuild through `service-error-serialization.ts`. If the instance reports the command unhandled
(`services:command-unhandled` — it does not register the service or the command's handler), the
caller throws `OpenServiceRemoteCommandConfigDriftError` immediately with restart guidance. If no
implementer acknowledges within the ack timeout, the caller throws
`OpenServiceRemoteCommandUnhandledError` with attach-specific guidance.

See [Delegated mode](../../shared/open-service/README.md#delegated-mode).

## Registration cost

The same registration hook runs in the caller, so server-realm constructors run there too. Work
triggered by commands or loads is delegated and stays cheap. Eager work at registration time
(worker spawns, file watchers, index builds) runs in the caller; fix that in core plumbing.

## Topology

The caller is a leaf (`relay: false`, like preview). It talks to the server hub directly.
UniversalStores prepare against the real channel as followers. The dispatcher sets
`STORYBOOK_ATTACHED_TOOLS` before importing core so those stores are born followers. Local
fallback deletes that env before loading the local runtime, which must be a leader.

## Environment match

Attached mode needs the same version, config, and cwd as the instance. When this process cannot be
that environment, `createTools` spawns a child from the `storybook` package under `record.cwd` and
proxies `describe` / `call` / `close` over Node parent-child IPC. The parent `Tools` object is the
proxy.

The child is used whenever `process.cwd() !== record.cwd`, even when versions match, so module
resolution, `.env`, and relative paths match the instance. A version mismatch with the invoked
package (for example `npx storybook@latest` from the right directory) also triggers the child via
project-local resolution. When the package resolved under the instance cwd also mismatches the
record (server started before a dependency upgrade), the error is "restart your Storybook".

Neither attached nor local mode `chdir`s this process. A foreign `cwd` in local mode starts a
child host instead.

`autoSpawn: false` throws `EnvironmentMismatchError { instanceCwd, resolvedBinPath, reason }`.

The child is the instance-cwd-resolved `storybook` package's host entry, `cwd = record.cwd`,
resolved with `createRequire(join(record.cwd, 'package.json'))`. A child does not spawn another
child; residual mismatch is a prescriptive error. Resolution failure is `SpawnFailedError`. The
fidelity check runs before config load. `close()` kills the child. The child exits when the parent
IPC channel closes. Child logs are piped and re-emitted by the parent.

IPC is the serialized SDK API plus a version field in the child's hello. Cancellation is a
message keyed by call id.

## Query loads

Query `load` hooks are thin command triggers (the docgen pattern: `load` only awaits
`extractDocgen`). Delegation then lands warm-up work on the instance. State readiness is
`query.loaded()`. A bare `.get()` before snapshots arrive reads initial state, the same as the
manager. Change-detection scan readiness is the same pattern: `changeDetectionReadiness.load`
awaits `_waitForChangeDetectionReadiness`.

See [Load](../../shared/open-service/README.md#load).

## requiresDevServer and telemetry

In local mode, `requiresDevServer` intercepts with start-your-Storybook guidance. In attached mode
those methods run in the caller. `stories.preview` reads origin from the instance record.

The CLI fires a `tools-command` invocation event after a run. The payload includes `attachMode`.
Per-method toolset telemetry (`ctx.telemetry`) fires in the caller when the CLI passes a sink into
`tools.call`. Command-level side effects and their telemetry run on the instance.

## SDK

`storybook/internal/tools` owns both modes. Mode (`attached` | `local`) and host (`in-process` |
`child`) are orthogonal. See [README.md](./README.md#sdk). Vocabulary: **tools** for the surface,
**toolset** as the grouping term, dotted method refs matching `ToolsetMethodId`. A long-lived
consumer amortizes config load across many calls on the live synced runtime.

## End-to-end flow (attached)

1. **Discover.** Read `~/.storybook/instances/*.json` (pid-liveness-checked). Match by cwd /
   configDir — or, with `--port`, by port alone across all projects (the record supplies the
   project; an explicit `--config-dir` still restricts). Several matches → the invoking agent's
   bucket, then the most recently started; the siblings surface as a stderr warning naming
   `--port`. No record → local fallback, or a hard error under `--attach`.
2. **Gate + fidelity.** Token present (else "restart Storybook" + fallback). Same cwd and
   version, else auto-spawn (or `EnvironmentMismatchError` when `autoSpawn: false`).
3. **Connect.** Node WebSocket to `record.url` + `/storybook-server-channel?token=…`, no
   Origin. `UniversalStore.__prepare(channel, follower)`.
4. **Register.** Load config from `record.configDir`. Set delegated mode. `services:sync-start`
   pulls snapshots and patches from the server.
5. **Execute.** Toolset handler runs caller-side (`ctx.transport = 'cli'`). Queries read synced
   state. `.loaded()` warms via delegated commands. Every command goes over the channel.
6. **Render + close.** `ToolsetOutcome` through markdown / `--json`; `ok` drives the exit code.

Local mode (no instance, or `--no-attach`) loads in-process when `cwd` already matches, and
starts a child host when it does not.

## Failure matrix

Messages name the exact corrective command.

| Failure                           | Detection                             | Message must include                                                                             |
| --------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------ |
| No instance for this project      | No cwd/configDir match                | `--attach` only: how to start Storybook; other running instances with `cwd` + `url`; exact `cd` or `--config-dir`. `auto` falls back with no notice |
| Port mismatch                     | No running instance on `--port`       | Running instances with their `port` + `url`; `--port <port>`                                     |
| Old server                        | Token absent                          | Restart Storybook (vX.Y+) to enable attach                                                       |
| Stale record / connection refused | WS connect fails                      | Registry cleanup; fallback note                                                                  |
| Server started before upgrade     | Instance-cwd package ≠ record version | Both version strings; restart Storybook                                                          |
| Spawn resolution failure          | No `storybook` under `record.cwd`     | `SpawnFailedError` remediation; local fallback                                                   |
| Config drift                      | Instance reports command unhandled    | Attached Storybook has no handler for the command — restart it with a matching configuration     |
| Unacknowledged command            | Remote command ack timeout            | Attached Storybook did not acknowledge in time; the command may still have executed — retry      |

Rows other than the last two are factory-time attach gates. In `auto`, those fall back to a local host. Under `--attach`, they are hard errors with
the same no-instance text. Config drift and an unacknowledged command are post-attach `tools.call` failures:
`auto` does not fall back then.

## Limits

- A busy instance event loop can delay command acks and surface
  `OpenServiceRemoteCommandUnhandledError`.
- UniversalStore follower hard timeout: same treatment.
- Eager registration (workers, watchers, index builds) runs in the caller.
- Disconnect rejects pending remote commands (`CHANNEL_WS_DISCONNECT`).
- A parent SIGKILL can leave a config-loaded child running.
- Each attached call loads config and presets.

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
