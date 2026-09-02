# Tools CLI and SDK

`storybook tools` is a shell over the Node SDK at `storybook/internal/tools`.
The SDK owns both runtimes: **attached** (join a running Storybook as another Open Service
runtime) and **local** (load the project configuration in this process). How attach works is in
[architecture.md](./architecture.md). Delegated command dispatch lives in the
[open-service README](../../shared/open-service/README.md#delegated-mode).

Toolset handlers run in the SDK process. Service commands in attached mode execute on the
instance.

## SDK

```ts
import { createTools } from 'storybook/internal/tools';

const tools = await createTools({
  cwd, // which project; defaults to process.cwd()
  configDir, // --config-dir equivalent; disambiguates monorepos
  port, // --port equivalent; a known port targets that running instance on its own
  mode: 'auto', // 'auto' | 'attached' | 'local'
  autoSpawn: true, // false → error instead of a child host (foreign cwd, foreign installation)
  clientInfo: { name, version, kind: 'sdk' },
});

tools.mode; // 'attached' | 'local'
tools.storybook; // { version, configDir, url?, pid?, port?, cwd?, siblings? }
await tools.describe();
await tools.describe({ toolset: 'docs' });
await tools.call('docs.show', { id: 'button' });
await tools.call('docs.show', { id: 'button' }, { signal: AbortSignal.timeout(5_000) });
await tools.close();
```

Factory vs `call`:

| Mode       | Operation                         | Result                                                                                                                                                                                                 |
| ---------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `attached` | Factory cannot attach or spawn    | Throws `AttachUnavailableError`, `EnvironmentMismatchError` (unverifiable record, or a mismatch that may not spawn), or `SpawnFailedError`                                                              |
| `auto`     | Factory cannot attach or spawn    | Returns a local host. A missing instance is silent. Unexpected gate failures set `fallbackNotice`. Those errors are not thrown unless local load also fails                                             |
| `local`    | Config cannot load                | Throws `ToolsRuntimeError` (`config-load-failed`)                                                                                                                                                      |
| any        | `call` after a successful factory | `ToolsRuntimeError` on SDK faults (`unknown-method`, `invalid-input`, `closed`, `connection-lost`). Local `requiresDevServer` methods throw `AttachUnavailableError`. A tool that ran returns a `ToolsetOutcome` (`ok: false` is not a throw). Open-service dispatch can still throw its own typed errors. |

`auto` fallback is factory-time only. A later `call` failure (disconnect, remote ack timeout) does not switch to local.

`kind` defaults to `sdk`. The `storybook tools` CLI stamps `cli`. Do not value-export
`bootstrapToolsRuntime` from the SDK barrel: a static import of the local runtime loads
`storybook/internal/core-server` and can make UniversalStore a leader before the attached channel
exists.

## CLI flags

Default mode is `auto`: attach when a matching instance is running, otherwise load locally.
Human-readable CLI output prepends `fallbackNotice` to stdout (and to `-o` when `--json` is not
set). `--json` keeps only the tool result.

| Flag          | SDK `mode` | On gate failure                  |
| ------------- | ---------- | -------------------------------- |
| (none)        | `auto`     | Fall back to local. Notice only on unexpected attach failure |
| `--attach`    | `attached` | Hard error (no fallback)         |
| `--no-attach` | `local`    | Never attaches                   |

`--cwd`, `--config-dir`, and `--port` belong **before** the toolset name (after it, they are tool arguments). `--attach` / `--no-attach` cannot
be combined. `requiresDevServer` is a **local-mode intercept** only: when attached, those methods
run caller-side (`stories.preview` reads `origin` from the instance record).

```bash
npx storybook tools docs list
npx storybook tools --attach docs list
npx storybook tools --no-attach docs list
npx storybook tools --cwd /apps/web --config-dir /apps/web/.storybook docs list
npx storybook tools --port 6007 stories preview --stories '[{"storyId":"example-button--primary"}]'
```

## Modes

**Attached.** Discover `~/.storybook/instances/*.json`, connect a Node WebSocket to
`/storybook-server-channel?token=…` (no Origin), load the instance config as a **leaf** and
**follower**, set `setDelegatedMode(true)` before the first `registerService`. This path never
`chdir`s the host process. Two processes never attach across `storybook` installations: when the
caller is the instance's installation (the record's `storybookPath` versus the caller's own
package root), it joins in-process; when it is a different one, it spawns a child host from the
recorded installation instead. A record that cannot prove its installation throws
`EnvironmentMismatchError`.

**Child host.** Attached mode: an installation mismatch spawns a child from the instance's
recorded `storybookPath` (its own manifest resolves the host entry), pinned to the instance's
port. Local mode: a foreign `--cwd` spawns a child from the `storybook` package under that
directory. Both proxy `describe` / `call` / `close` over IPC. `autoSpawn: false` throws instead.
A child never spawns another child (`STORYBOOK_TOOLS_CHILD_HOST`).

**Local.** Load the target configuration in this process when `cwd` already matches. This path
never `chdir`s. A foreign `--cwd` starts a child host from the `storybook` package under that
directory. Do not set `STORYBOOK_ATTACHED_TOOLS` on this path: that env is how the dispatcher
makes UniversalStore a follower before core loads, and local bootstrap must be a leader.

## Tests

- Unit: `yarn test cli/tools` (memfs for the instance registry; no direct `globalThis` assignment)
- Attach e2e: `cd code && yarn playwright test -c e2e-internal/playwright.config.ts e2e-internal/tools-attach.spec.ts`

Run e2e from the same checkout that serves the internal UI. A worktree CLI talking to a
`/workspace` instance will load the wrong `.storybook` and fail on duplicate `core-server`.
