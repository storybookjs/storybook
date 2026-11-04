# NX and `yarn task`

This document is canonical for NX and the `yarn task` runner: caching, task dependencies, sandbox and CI-parity flags, and the environment variable reference. `AGENTS.md` owns the pointer to this file; everyday commands live in [Development workflow](./development.md).

Use NX when you want better caching and dependency tracking. Prefer these faster defaults first, and only add `-c production` or `--no-link` when you specifically need sandbox parity or CI-like behavior.

```bash
# Compile all packages
yarn task compile
yarn nx run-many -t compile

# Check all packages
yarn task check
yarn nx run-many -t check

# Run E2E tests for a template
yarn task e2e-tests-dev --template react-vite/default-ts --start-from auto
yarn nx e2e-tests-dev react-vite/default-ts -c production

# Jump to a later step
yarn task e2e-tests-dev --start-from e2e-tests --template react-vite/default-ts
yarn nx e2e-tests-dev -c production --exclude-task-dependencies
```

Key points:

- `-c production` is required for sandbox-related NX commands and CI-parity runs
- `react-vite/default-ts` is the default sandbox template
- `--no-link` is opt-in, not the default
- NX handles task dependencies via `nx.json`
- NX target commands use Nx project names (from `project.json` / Nx graph), not `package.json` names
- Example: `yarn nx compile core` (project `core` is published as package `storybook`)
- NX Cloud remote-cache auth failures (e.g. HTTP 401 "insufficient access") degrade to the local cache, so they are expected on local runs where `NX_CLOUD_ACCESS_TOKEN` is unset. CI always sets that token, so a 401 there means an invalid or expired token and should be investigated rather than ignored. Locally, a read-only token or an `nx login` session reads the shared cache but stores nothing, so the "Skipping storing" message is expected. On CI, a read-only token also writes to a cache NX Cloud scopes to the pull request (see below)
- CircleCI does not use NX Cloud (`--skip-nx-cache` on CI). NX Cloud runs in `.github/workflows/nx.yml`: it starts workers with `npx nx-cloud start-workers` before installing dependencies, and `.nx/ci-config.yaml` sets how tasks are distributed. Worker machines and their setup steps are in `.nx/workflows/agents.yaml`
- Only `next` writes to the shared remote cache and the workers' node_modules cache: `.github/workflows/nx-cache.yml` on every push, and the nightly `nx` run, use the read-write token from the `nx-cloud-write` environment. Pull requests use the read-only token, so they read those caches and write only to a cache NX Cloud scopes to the pull request
- On CI, NX Cloud prints only a link for a failed task. Pass `--output-style=stream` (or set `NX_DEFAULT_OUTPUT_STYLE=stream`) to keep the task's own errors in the log
- `compile` hashes the `OS` environment variable, so Windows and POSIX builds never restore each other's `dist`
- To force a rebuild, pass `--skip-nx-cache` (or `yarn task compile --skip-cache`). Do not bump a field in `nx.json` to bust the cache: that invalidates every task in the workspace

## Following an NX Cloud pipeline

`scripts/nx-cloud-status.ts` reads a pipeline from the NX Cloud Public API with your `npx nx login`, so you do not need the NX Cloud web page. It needs no dependencies installed.

```bash
# Report the newest pipeline of a pull request (or a branch, a CIPE id, a cloud.nx.app/cipes link,
# or the NX Cloud link of the pull request's `nx: normal` status)
node scripts/nx-cloud-status.ts 37181

# Follow the pipeline of the commit you just pushed: one line per change, then the full report
node scripts/nx-cloud-status.ts 37181 --watch --sha HEAD
```

- The report gives the pipeline status, why it was canceled, each failed task with the lines that name the failure and the end of its log, and the worker steps that failed or timed out (for example `Restore Node Modules Cache`, or `no_output_timeout after 600s`), with the end of a worker's log. Each log is saved as a text file; the report prints its path
- Agents run `--watch` as a background monitor, so each printed line wakes them. It exits with the report once the pipeline is done: 0 when it succeeded, 1 when it failed or was canceled. It exits 2 on an error it cannot retry, or when no pipeline started within 15 minutes (is the pull request labeled `ci:normal`?)
- Pass `--sha` after a push. Without it, the watch follows the newest pipeline, which is the previous one until NX Cloud registers the push. Without a target, the script follows the current branch at `HEAD`
- A one-off report on a pipeline that still runs exits 3
- Live, NX Cloud shows the pipeline status and each `nx` command once it finishes. Our pipeline runs one `nx run-many`, so failed tasks show when it ends. Worker details (steps, timeouts, restarts) can follow minutes after the pipeline ends; the watch waits up to 10 minutes for them
- A report costs up to about 30 requests of the Public API quota, which the whole organization shares (60 per minute on the Team plan). A watch costs a few per poll, every 30 seconds by default
- The `nx: normal` and `nx run <task>` commit statuses from `.github/workflows/nx.yml` still say on the pull request whether the run passed; use the script for why
- A workspace token in `NX_CLOUD_ACCESS_TOKEN` overrides your login in `nx-cloud api`. When NX Cloud rejects that token, the script retries with your login

## Environment Variables

| Variable                      | Purpose                                         |
| ----------------------------- | ----------------------------------------------- |
| `IN_STORYBOOK_SANDBOX`        | Set during sandbox creation                     |
| `STORYBOOK_DISABLE_TELEMETRY` | Disable telemetry                               |
| `STORYBOOK_TELEMETRY_DEBUG`   | Log telemetry events                            |
| `DEBUG`                       | Enable debug logging                            |
| `FIX_ON_COMMIT`               | Force autofix for fmt & lint in pre-commit hook |
| `NX_CLOUD_ACCESS_TOKEN`       | Authenticate the NX Cloud remote cache          |
| `NX_ISOLATE_PLUGINS`          | `false` in `.env`: plugins load in-process      |
| `NX_NO_CLOUD`                 | Run without NX Cloud (local cache only)         |
