# Tools CLI attachment architecture

`storybook tools` attaches to a running Storybook, or loads the project on its own.
The Node SDK `@storybook/open-service` owns both modes.
The CLI parses flags, renders help and outcomes, and sets exit codes.

- **Caller**: the short-lived tools CLI or SDK process.
- **Instance**: the long-running dev server.

Related docs:

- Toolset and service contract, toolset RPC messages: [open-service README](../../../../../../core/src/shared/open-service/README.md).
- SDK usage: [`@storybook/open-service` README](../../../../../open-service/README.md).
- CLI flags: [README.md](./README.md).
- Dev server side of the RPC and the instance registry: [server README](../../server/README.md).

This doc owns the attach flow, the installation match, the failure matrix and tools telemetry.

## Hosts

The SDK picks one host per `Tools` object, reported as `tools.host`.

- `remote`: attached over the toolset RPC; handlers run in the dev server.
- `in-process`: handlers run in the caller, either attached as a delegated runtime or loaded locally.
- `child`: a child host from another installation does the `in-process` work; the caller proxies it.

`tools.host === 'in-process'` is unrelated to the preview transport `'in-process'` in the server README.

## Modes

- `auto` (CLI default): attach when a matching instance is running, otherwise load locally.
- `attached` (`--attach`): attach or fail.
- `local` (`--no-attach`): never attach.

`auto` falls back only at factory time.
A missing instance falls back silently.
Any other gate failure falls back with `fallbackNotice`.
A later `call` failure (disconnect, ack timeout) stays on the attached host.

## Attach flow

### Discover

- Read `~/.storybook/instances/*.json`, pid-liveness-checked.
- Match by cwd and config dir.
- With `--port`, match by port alone across all projects; an explicit `--config-dir` still restricts.
- Several matches: prefer the invoking agent's bucket, then the most recently started; the others become `siblings` and a stderr warning naming `--port`.
- No match: `no-instance`, or `port-mismatch` with `--port`.

### Gate

- No channel token in the record: `old-server`.
- `record.toolsetRpc` equals the caller's `TOOLSET_RPC_PROTOCOL_VERSION`: the toolset RPC, with no installation gate.
- Otherwise the [installation match](#installation-match) picks an in-process delegated runtime, a child host, or `EnvironmentMismatchError`.

The record, not a channel handshake, is the capability flag.
The caller picks its path before loading anything.
Older readers drop the unknown field.

### Connect

- Node WebSocket to `record.url` plus `/storybook-server-channel?token=…`, with no `Origin`.
- The upgrade handler accepts a missing `Origin` when the token is valid.
- The handshake times out after 10 seconds.
- A refused connection or a handshake timeout is the `connection-failed` gate, on both paths.

### Toolset RPC path

- `describe` and `call` go over `toolsets:*` messages; the handler runs in the dev server.
- The caller loads no config, no presets and no Storybook instance; it needs only `@storybook/open-service` and the core modules it imports.
- The message list is in [open-service README §Toolset RPC](../../../../../../core/src/shared/open-service/README.md#toolset-rpc).
- The host is `serveToolsetRpc` in `lib/storybook/src/storybook/server/utils/toolset-rpc-host.ts`; the protocol is `core/src/shared/open-service/toolset-rpc.ts`.
- Only token clients without a page (the `server` role) may send the request events; the server transport drops them from browser pages.
- Errors cross as `service-error-serialization.ts` shapes; the caller rebuilds `ToolsRuntimeError` and the other SDK errors, so `instanceof` keeps working.
- Outcomes cross as JSON; a field that is not JSON-safe is lost.

Handler context on the host:

- `ctx.transport` comes from the caller's `clientInfo.kind`: `cli` or `sdk`. The schema also accepts `mcp`, but the SDK never sends it.
- `ctx.origin` is the host's own base URL unless the invoke passes `origin`. The CLI always passes `record.url`.
- `ctx.signal` aborts on `toolsets:call-cancel`, which the caller sends when its `AbortSignal` fires. Handlers may ignore it.

Files stay on the host:

- `outDir` and image paths resolve on the host, against the dev server's cwd.
- Outcomes keep absolute host paths. Attach is loopback-only, so the caller reads the same file system.

### Delegated path

The delegated path serves instances without the toolset RPC.

- The caller creates a headless instance with `createStorybook({ configDir: record.configDir, workingDir: record.cwd, mode: 'headless', attach: { transport } })`.
- It loads the instance's config and presets and registers every service, like the server does.
- `storybook.attached` is `true`, so its inventory runs in delegated mode: every service command goes over the channel, none runs locally.
- `services:sync-request` pulls a snapshot; later writes arrive as `services:entry` patches.
- The toolset handler runs in the caller.

The command protocol, delegated mode and thin-trigger loads are in the open-service README: [Delegated mode](../../../../../../core/src/shared/open-service/README.md#delegated-mode) and [Load](../../../../../../core/src/shared/open-service/README.md#load).

Costs specific to this path:

- Eager registration work (worker spawns, file watchers, index builds) runs in the caller; fix that in core plumbing.
- Each run loads config and presets.
- The caller is a leaf (`relay: false`) with follower UniversalStores in its own realm; neither role installs a global channel.

### Render and close

`ToolsetOutcome` renders as markdown or `--json`; `ok` drives the exit code.

### Debug log

With `--loglevel debug`, the SDK logs the path it took:

- `over the toolset RPC`
- `with an in-process delegated instance`
- `through a child host`
- `locally in this process`
- `locally through a child host`

## Installation match

The toolset RPC carries JSON only, so it skips this match.
Any caller that speaks the record's protocol version attaches, whatever installation either side runs.

The delegated runtime needs the caller and the instance to run the exact same `@storybook/core` installation.

- The dev server records `corePath`: the realpathed root of the `@storybook/core` it runs, resolved from its own module location.
- It also records `storybookPath`, the root of its `storybook` package.
- The caller derives its own core root the same way; the match is exact equality.
- A record without `corePath` (older server) derives it from `storybookPath`.
- A pre-split `storybook` runs no `@storybook/core`; when no core derives from its `storybookPath` but a child host resolves there, it counts as a different installation.

The server points at itself, so its value cannot be wrong.
Every unreliable input (cwd defaults) sits on the discovery side, where the worst case is a miss, never a false match.
`cwd` plays no part: the same installation attaches in-process even when the server started from an unrelated directory.

### Different installation

A different installation spawns a child host instead, for example `npx storybook@latest tools` against a project-local server.

- The child comes from the recorded installation: `record.storybookPath` → `@storybook/open-service/child-host`, else the legacy `storybook/internal/tools/child-host`.
- It runs with the record's `cwd` and the record's port pinned, so it re-resolves to that exact instance.
- The child is the server's installation, so it attaches as the twin the caller is not.
- The parent proxies `describe`, `call` and `close` over IPC.

Two processes never attach across installations.

### Refusals

The match throws `EnvironmentMismatchError` when it cannot verify, or may not spawn:

- A record without a `storybookPath` that yields a core or a child host, or a recorded root gone from disk: restart guidance.
- A mismatch under `autoSpawn: false`, or seen by a process that is already a child host: both roots, both versions and the instance's config dir.
- The instance factory resolved from the recorded installation runs another core: restart guidance.

The match never guesses.

### Child hosts

- A child never spawns another child (`STORYBOOK_TOOLS_CHILD_HOST`).
- A failed spawn is `SpawnFailedError`.
- `close()` kills the child; the child exits when the parent IPC channel closes.
- Child logs are piped and re-emitted by the parent.
- IPC is the serialized SDK API plus a version field in the child's hello; cancellation is a message keyed by call id.
- A parent SIGKILL can leave a config-loaded child running.

Local mode never `chdir`s either.
A foreign `cwd`, or a project whose `storybook` runs another `@storybook/core`, starts a child host resolved with `createRequire(join(cwd, 'package.json'))`.
`autoSpawn: false` throws instead.

## `requiresDevServer`

`stories.preview` and `review.create` set `requiresDevServer`.
`stories.screenshot` does not: locally it starts its own preview host.

- Local mode: those methods throw `AttachUnavailableError` with start-your-Storybook guidance.
- Toolset RPC: they run in the dev server with the server's origin.
- Delegated path: they run in the caller with the origin from the instance record.

## Telemetry

Every run sends one `tools-command` record; help lookups are excluded so they cannot skew success rates.

- The record is the handler's usage report (`toolset` and `tool` in CLI spelling, the generated `event` such as `tool:docs_list`, its payload), returned on the outcome by `invokeToolsetMethod`.
- It adds `success`, `outcome`, `duration` and the attach fields, `attachMode` and `host` among them.

Who sends it:

- CLI: the CLI reports its own runs; the SDK skips `kind: 'cli'`.
- SDK: reports only when `clientInfo.kind === 'sdk'` and the process is not a child host.
- Child host: the report rides inside the outcome over IPC; the parent sends it.
- Toolset RPC: the caller composes the record (`host: 'remote'`) and sends it with `toolsets:telemetry`; the dev server sends it under its own configuration, `core.disableTelemetry` included.

On the RPC path the caller never evaluates `main.ts` for the opt-out.
The SDK exposes the hand-off as a sink on the `Tools` object; the CLI reads it there before the host closes.
The host must ack within 1 second; otherwise the record is dropped, with no local fallback.
The CLI marks it sent either way.

## CLI entry cost

`lib/storybook/src/storybook/bin/core.ts` registers every command without importing the dev server or the instance code.

- `dev`, `build` and `index` import their modules in their actions.
- `tools` and `skills` import their `action.ts` when the command runs.

The tools action reads the instance registry first.

- The matching record serves the toolset RPC: nothing loads the project configuration, no `withTelemetry`, no `main.ts`.
- Every other run goes through `withTelemetry`.
- A run that expected the RPC but ended elsewhere (a fallback or a gate) resolves the opt-out through `withTelemetry` before reporting.
- On the RPC path no `sendTelemetryError` report leaves the caller; the record's `outcome: 'error'` still does.

## Failure matrix

Messages show only facts from the failed check plus generic recovery guidance.
No message constructs a path or places one in executable-command position.
Each gate throws its own remediation, built in `lib/open-service/src/attach-messages.ts`.

### Attach gates

Factory-time failures.
`auto` falls back to local, with `fallbackNotice` unless the reason is `no-instance`.
`attached` throws them.

| Failure | Detection | Error and message |
| --- | --- | --- |
| No instance | No cwd or config dir match | `AttachUnavailableError` `no-instance`, `formatNoInstance`: how to start Storybook, other running instances with `cwd` and `url` |
| Port mismatch | No running instance on `--port` | `AttachUnavailableError` `port-mismatch`, `formatPortMismatch`: running instances with `port` and `url` |
| Old server | Token absent | `AttachUnavailableError` `old-server`, `formatOldServer`: restart Storybook (vX.Y+) |
| Connection failed | WebSocket refused, or no handshake within 10 seconds | `AttachUnavailableError` `connection-failed`, `formatConnectionFailed`: the registry may be stale, start Storybook again |
| Different installation, no spawn | Mismatch under `autoSpawn: false` or in a child | `EnvironmentMismatchError`, `formatInstallationMismatch`: both roots (or "no `@storybook/core`"), both versions, the config dir |
| Unknown installation | No `corePath`, no usable `storybookPath`, or the root gone from disk | `EnvironmentMismatchError`, `formatUnknownInstallation`: restart the running Storybook |
| Instance factory mismatch | The recorded installation's factory runs another core | `EnvironmentMismatchError`, `formatUnknownInstallation` |
| Child host spawn fails | The child host cannot be resolved or started | `SpawnFailedError` |

When the local fallback then fails to spawn or to load, the error carries the attach notice followed by the local failure.

### After the gates

`auto` does not fall back from these.

| Failure | Detection | Error and message |
| --- | --- | --- |
| Delegated config load fails | The headless instance throws while loading | `ToolsRuntimeError` `config-load-failed` |
| Config drift (delegated) | Instance reports the command unhandled | `OpenServiceRemoteCommandConfigDriftError`: restart it with a matching configuration |
| Unacknowledged command (delegated) | No command ack in time | `OpenServiceRemoteCommandUnhandledError`: the command may still have run; retry |
| Unacknowledged tool call (RPC) | No `toolsets:call-ack` within 5 seconds | `ToolsRuntimeError` `command-unhandled`: the tool may still have run; retry or restart |
| Unanswered describe (RPC) | No describe reply within 10 seconds | `ToolsRuntimeError` `command-unhandled`: retry or restart |
| Unknown tool or bad input (RPC) | Host rejects the reference or the input | `ToolsRuntimeError` `unknown-toolset`, `unknown-method` or `invalid-input`, rebuilt from the host |
| Tool threw (RPC) | `toolsets:call-error` from the handler | The handler's error, rebuilt with its fields; agent-facing errors keep `agentFacing` |
| Disconnect mid-call | `CHANNEL_WS_DISCONNECT` | `ToolsRuntimeError` `connection-lost`; pending commands and calls reject |
| Telemetry not acked (RPC) | No `toolsets:telemetry-ack` within 1 second | None; the record is dropped |

After `toolsets:call-ack` there is no timeout.
A hung handler holds the call until disconnect, the caller's abort, or `close()`.
A busy instance event loop can delay acks into the timeouts above.

## Tests

- Attach e2e: `code/e2e-internal/tools-attach.spec.ts`.
- Filesystem unit tests use memfs.

## Glossary

- **Runtime**: a process or realm on the channel bus: server, manager, preview, attached caller.
- **Attached mode**: the caller using a running instance, over the toolset RPC or as a delegated runtime.
- **Toolset RPC**: `toolsets:*` channel messages through which the dev server describes and runs its own toolsets; advertised by `toolsetRpc` in the instance record.
- **Local mode**: the SDK loading the project with no instance.
- **Delegated mode**: caller-side dispatch policy: every service command executes on the instance.
- **Thin-trigger load**: a query `load` hook that only awaits commands, so delegation is transitive.
- **Instance registry**: `~/.storybook/instances/<id>.json`, written by running dev servers; carries the channel token, `corePath`, `storybookPath` and `toolsetRpc`.
- **Tools SDK**: `@storybook/open-service`; `createTools` returns `{ describe, call, close, mode, host, requestedMode, storybook, fallbackNotice?, fallbackReason? }`.
- **Installation match**: whether the caller runs the instance's exact `@storybook/core` installation; a match attaches in-process, a mismatch respawns, unverifiable refuses.
- **Child host**: a child process serving the SDK API over Node IPC, spawned from the recorded installation or from a foreign local-mode `cwd`.
