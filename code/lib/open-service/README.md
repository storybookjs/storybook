# @storybook/open-service

The Node client for a Storybook project's toolsets: discover a running Storybook, attach to it or load the project locally, and call its tools.
`storybook tools` is a shell over this package.

## Package rule

This package imports only `@storybook/core` and `@storybook/core/*`.
It never imports `storybook`, `storybook/*`, `@storybook/ui`, or `@storybook/manager`, so it installs and runs without `storybook`.
`local-rules/storybook-monorepo-imports` and the dist check (`src/dist.test.ts`, `yarn nx check open-service`) enforce it.
`storybook` depends on this package; `storybook/internal/tools` and `storybook/internal/tools/child-host` are deprecated re-exports.

Toolset definitions and the contract (`defineToolset`, `ToolsetOutcome`, the registry) stay in `@storybook/core/open-service`, next to the services they wrap.
This package re-exports the client types it needs (`ToolsetOutcome`, `ToolsetMethodId`, `getToolName`, `parseToolsetMethodId`).

## Usage

```ts
import { createTools } from '@storybook/open-service';

const tools = await createTools({
  cwd, // which project; defaults to process.cwd()
  configDir, // --config-dir equivalent; disambiguates monorepos
  port, // --port equivalent; a known port targets that running instance on its own
  mode: 'auto', // 'auto' | 'attached' | 'local'
  autoSpawn: true, // false → error instead of a child host (foreign cwd, foreign installation)
  clientInfo: { name, version, kind: 'sdk' },
  createStorybook, // optional instance factory, see below
});

tools.mode; // 'attached' | 'local'
tools.host; // 'in-process' | 'child' | 'remote'
tools.requestedMode; // the `mode` passed in; 'auto' when omitted
tools.fallbackNotice; // set when 'auto' fell back to local for an unexpected reason
tools.fallbackReason; // why 'auto' fell back: 'no-instance', 'connection-failed', 'environment-mismatch', ...
tools.storybook; // { attached, version, configDir, url?, pid?, port?, cwd?, siblings? }
await tools.describe();
await tools.describe({ toolset: 'docs' });
await tools.call('docs.show', { id: 'button' });
await tools.call('docs.show', { id: 'button' }, { signal: AbortSignal.timeout(5_000) });
await tools.close();
```

Factory vs `call`:

| Mode       | Operation                         | Result                                                                                                                                                                                                 |
| ---------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `attached` | Factory cannot attach or spawn    | Throws `AttachUnavailableError`, `EnvironmentMismatchError` (unverifiable record, a mismatch that may not spawn, or an in-process instance factory on another core), or `SpawnFailedError`               |
| `attached` | Delegated config cannot load      | Throws `ToolsRuntimeError` (`config-load-failed`)                                                                                                                                                      |
| `auto`     | Factory cannot attach or spawn    | Returns a local host. A missing instance is silent. Unexpected gate failures set `fallbackNotice`. Those errors are not thrown unless local load also fails. A delegated `config-load-failed` is not a gate failure: it throws and does not fall back |
| `local`    | Config cannot load                | Throws `ToolsRuntimeError` (`config-load-failed`, or `mode-unavailable` for a foreign `cwd` under `autoSpawn: false`), `EnvironmentMismatchError` (the project's `storybook` runs another core under `autoSpawn: false`), or `SpawnFailedError` |
| any        | `call` after a successful factory | `ToolsRuntimeError` on SDK faults (`unknown-method`, `invalid-input`, `closed`, `connection-lost`, and `command-unhandled` when a `remote` host does not answer in time). Local `requiresDevServer` methods throw `AttachUnavailableError`. A tool that ran returns a `ToolsetOutcome` (`ok: false` is not a throw). Open-service dispatch can still throw its own typed errors. |

`auto` fallback is factory-time only.
A later `call` failure (disconnect, remote ack timeout) does not switch to local.

`kind` defaults to `sdk`. The `storybook tools` CLI stamps `cli`.

## Attached hosts

Which host serves an attached `Tools` depends on the instance record:

- `remote`: the record advertises the toolset RPC (`toolsetRpc` equal to this package's protocol version).
  `describe` and `call` run on the dev server over the channel (`src/remote-tools.ts`).
  This process creates no Storybook instance, loads no configuration, and ignores `createStorybook`.
  Every tool runs in the dev server process, `requiresDevServer` methods such as `stories.preview` included.
- `in-process`: no RPC, same `@storybook/core` installation.
  A headless instance with `attach: { transport }` loads the configuration here and delegates service commands.
- `child`: no RPC, another installation.
  A child host from the recorded installation does the `in-process` work and this process proxies it.

How the record picks the host, and every gate and failure, are in [`cli/tools/architecture.md`](../storybook/src/storybook/cli/tools/architecture.md).

## Telemetry

Every `call` produces at most one `tools-command` record, with `host` set to the path.

- This package reports only when `clientInfo.kind === 'sdk'` and the process is not a child host.
- The `storybook tools` CLI (`kind: 'cli'`) reports its own runs.
- On `remote`, the record is handed to the dev server, which sends it under its own telemetry settings.

## Instance factory

The factory is chosen before any configuration loads, because loading has side effects.
It does not apply to the `remote` host.

1. `createStorybook`, when passed, wins. The `storybook tools` CLI always passes the product one.
2. Otherwise `storybook/internal/instance` is resolved from the project (local mode: `cwd`; attached mode: the record's `storybookPath`).
3. When it resolves and that `storybook` runs this package's `@storybook/core` (realpath-equal roots), its `createStorybook` is used. Full parity with `storybook dev`, legacy presets included.
4. When it resolves on another core, two cores never share one process: local mode spawns a child host from the project, or throws `EnvironmentMismatchError` with `autoSpawn: false`.
5. When it does not resolve, `createStorybook` from `@storybook/core` runs with its defaults (docgen, story-docs, change detection, the core common plugin). That serves the `docs` and `stories` toolsets.
   `review` ships with `storybook`'s built-ins, so it is absent here: discovery does not list it and calling it fails with `unknown-toolset`.
   A configuration with legacy presets throws `ToolsRuntimeError` (`config-load-failed`) that names the `storybook` version to install.

Core-only installs keep `stories.changed`, but builder headless change detection that needs `storybook` surfaces as a toolset error.

## Installation identity

Without the toolset RPC, attach compares `@storybook/core` installations.
Equal roots join in-process; different roots spawn a child host from the record's `storybookPath`; an unknown installation refuses.
`@storybook/open-service/child-host` is the child host entry; `storybook/internal/tools/child-host` serves installs that predate this package.

The match logic is owned by [`cli/tools/architecture.md`](../storybook/src/storybook/cli/tools/architecture.md#installation-match); the CLI flags by [`cli/tools/README.md`](../storybook/src/storybook/cli/tools/README.md).

## Tests

- Unit: `yarn test code/lib/open-service`.
- Core-only fixture: `src/core-only.test.ts` loads `__fixtures__/core-only` with core's factory, explicitly and through the "storybook not found" default.
