# Tools CLI and SDK

`storybook tools` and `storybook ai` are shells over the Node SDK at `storybook/internal/tools`.
The SDK owns both runtimes: **attached** (join a running Storybook as another Open Service
runtime) and **local** (load the project configuration in this process). Decisions live in
[architecture.md](./architecture.md). Delegated command dispatch lives in the
[open-service README](../../shared/open-service/README.md#delegated-mode).

There is no MCP proxy in this CLI. Toolset handlers run in the SDK process. Service commands in
attached mode execute on the instance.

## SDK

```ts
import { createTools } from 'storybook/internal/tools';

const tools = await createTools({
  cwd, // which project; defaults to process.cwd()
  configDir, // --config-dir equivalent; disambiguates monorepos
  port, // pick one instance when several match the project
  mode: 'auto', // 'auto' | 'attached' | 'local'
  autoSpawn: true, // false → EnvironmentMismatchError instead of a child host
  clientInfo: { name, version, kind: 'sdk' },
});

tools.mode; // 'attached' | 'local'
tools.storybook; // { version, configDir, url?, pid? }
await tools.describe({ toolset? });
await tools.call('docs.show', { id: 'button' }, { signal? });
await tools.close();
```

`createTools` throws `AttachUnavailableError`, `EnvironmentMismatchError`, or `SpawnFailedError`.
`call` throws `ToolsRuntimeError` on faults and returns a `ToolsetOutcome` when the tool ran
(including `ok: false`).

`kind` defaults to `sdk`. The `storybook tools` CLI stamps `cli`. Do not value-export
`bootstrapToolsRuntime` from the SDK barrel: a static import of the local runtime loads
`storybook/internal/core-server` and can make UniversalStore a leader before the attached channel
exists.

## CLI flags

Default mode is `auto`: attach when a matching instance is running, otherwise load locally and
print a fallback notice.

| Flag          | SDK `mode` | On gate failure                  |
| ------------- | ---------- | -------------------------------- |
| (none)        | `auto`     | Fall back to local with a notice |
| `--attach`    | `attached` | Hard error (no fallback)         |
| `--no-attach` | `local`    | Never attaches                   |

`--cwd`, `--config-dir`, and `--port` belong **before** the toolset name. `--attach` /
`--no-attach` cannot be combined. `requiresDevServer` is a **local-mode intercept** only: when
attached, those methods run caller-side (`stories.preview` reads `origin` from the instance
record).

```bash
npx storybook tools docs list
npx storybook tools --attach docs list
npx storybook tools --no-attach docs list
npx storybook tools --cwd /apps/web --config-dir /apps/web/.storybook docs list
npx storybook tools --port 6007 docs list
```

`storybook ai` calls `createTools({ mode: 'attached', autoSpawn: false, clientInfo: { kind: 'cli' } })`.

## Modes

**Attached.** Discover `~/.storybook/instances/*.json`, connect with `createNodeChannel` to
`/storybook-server-channel?token=…` (no Origin), load the instance config as a **leaf** and
**follower**, set `setDelegatedMode(true)` before the first `registerService`. The SDK never
`chdir`s the host process.

**Child host.** When `process.cwd()` or the resolved `storybook` version does not match the
record, `createTools` spawns a child from the `storybook` package under `record.cwd` and proxies
`describe` / `call` / `close` over IPC. `autoSpawn: false` throws `EnvironmentMismatchError`
instead. A child never spawns another child (`STORYBOOK_TOOLS_CHILD_HOST`).

**Local.** Load the target configuration in this process. This path **does** `chdir` to the
target for the rest of the one-shot process. Capture the launch directory first if an embedder
still needs it. Do not set `STORYBOOK_ATTACHED_TOOLS` on this path: that env is how the dispatcher
makes UniversalStore a follower before core loads, and local bootstrap must be a leader.

## Tests

- Unit: `yarn test cli/tools` (memfs for the instance registry; no direct `globalThis` assignment)
- Attach e2e: `cd code && yarn playwright test e2e-internal/tools-attach.spec.ts --config playwright.config.ts`

Run e2e from the same checkout that serves the internal UI. A worktree CLI talking to a
`/workspace` instance will load the wrong `.storybook` and fail on duplicate `core-server`.
