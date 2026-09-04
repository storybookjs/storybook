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
local with no notice. Unexpected factory-time gate failures print the facts of the failed check
plus generic recovery guidance (restart Storybook from the project, re-run from there) — never a
constructed path, and never a path in executable-command position — and then fall back. A later
`tools.call` failure (disconnect, remote ack timeout) stays on the attached host.

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

## Installation match

Attached mode requires the caller and the instance to run the exact same `storybook`
installation. The dev server records `storybookPath` in its instance record: the realpathed root
of the `storybook` package it actually runs, derived from its own module location (walk up to the
`package.json` named `storybook`). The caller derives its own root the same way and attach gates
on exact equality. The server points at itself, so the value cannot be wrong regardless of how or
from where the process was started — and every unreliable input (cwd defaults) sits on the
discovery side, where its worst case is an honest miss, never a false match.

`cwd` plays no part in the gate: the same installation attaches in-process even when the server
was started from an unrelated directory. A different installation (for example `npx
storybook@latest tools` against a project-local server, or a project-local CLI against a server
started via `npx storybook@latest dev`) respawns instead: a child host is started from the
*recorded* installation — `record.storybookPath` → its own manifest → its host entry, a
deterministic lookup, never a guessed bin — with the record's `cwd` as working directory and the
paired record's port pinned so the child re-resolves to that exact instance. The child is the
server's installation, so it attaches as the twin the caller is not; the parent proxies
`describe` / `call` / `close`. Two processes never attach across installations.

The gate refuses — `EnvironmentMismatchError { reason }` — when it cannot verify or may not
respawn: a record without `storybookPath` (older server) or a recorded root gone from disk (wiped
`node_modules`) gets restart guidance; a mismatch under `autoSpawn: false`, or seen by a process
that is already a child host, gets the symmetric message with both roots, both versions, and the
instance's config dir. The gate never guesses.

Neither attached nor local mode `chdir`s this process. A foreign `cwd` in local mode starts a
child host the same way, resolved from the `storybook` package under that directory with
`createRequire(join(cwd, 'package.json'))`. `autoSpawn: false` errors instead. A child does not
spawn another child. Resolution failure is `SpawnFailedError`. `close()` kills the child. The
child exits when the parent IPC channel closes. Child logs are piped and re-emitted by the
parent.

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
2. **Gate.** Token present (else "restart Storybook" + fallback). Same `storybook` installation
   (the record's `storybookPath` realpath-equals the caller's own package root) → in-process; a
   different installation → child host from the recorded installation; unverifiable or may not
   respawn → `EnvironmentMismatchError`.
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

Messages show only facts from the failed check plus generic recovery guidance. No message
constructs a path or places one in executable-command position.

| Failure                           | Detection                                      | Message must include                                                                                          |
| --------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| No instance for this project      | No cwd/configDir match                         | `--attach` only: how to start Storybook; other running instances with `cwd` + `url`. `auto` falls back with no notice |
| Port mismatch                     | No running instance on `--port`                | Running instances with their `port` + `url`; `--port <port>`                                                  |
| Old server                        | Token absent                                   | Restart Storybook (vX.Y+) to enable attach                                                                    |
| Stale record / connection refused | WS connect fails                               | Registry cleanup; fallback note                                                                               |
| Different installation, no spawn  | Mismatch with `autoSpawn: false` / in a child  | Both roots, both versions, the instance's config dir; restart guidance (with `autoSpawn`, this respawns instead) |
| Unverifiable installation         | No `storybookPath`, or its root gone from disk | Restart guidance                                                                                              |
| Config drift                      | Instance reports command unhandled             | Attached Storybook has no handler for the command — restart it with a matching configuration                  |
| Unacknowledged command            | Remote command ack timeout                     | Attached Storybook did not acknowledge in time; the command may still have executed — retry                   |

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
  pid-liveness-checked; carries the channel token and the server's `storybookPath`.
- **Tools SDK**: `storybook/internal/tools` — owns both modes. `createTools` → `{ describe, call,
close, mode, storybook }`.
- **Installation gate**: whether this process runs the exact same `storybook` installation as the
  instance (`storybookPath` equality). A match attaches in-process; a mismatch respawns from the
  recorded installation; unverifiable refuses.
- **Child host**: the child serving the SDK API over parent-child Node IPC (the parent `Tools` is
  a proxy) — spawned from the recorded installation on an attached-mode mismatch, or from the
  target directory's installation for a foreign local-mode `cwd`.
