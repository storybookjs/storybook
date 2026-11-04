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
- NX Cloud remote-cache auth failures (e.g. HTTP 401 "insufficient access") degrade to the local cache, so they are expected on local runs where `NX_CLOUD_ACCESS_TOKEN` is unset. CI always sets that token, so a 401 there means an invalid or expired token and should be investigated rather than ignored. A read-only token enables cache reads but cannot store artifacts, so the "wasn't able to store" warning is still expected with one
- CircleCI uses the NX Cloud remote cache for `compile` and the affected `check`, so unchanged packages are restored instead of rebuilt. See `nxEnvironment` in `scripts/ci/utils/helpers.ts`
- Only `next` writes to the shared remote cache: `.github/workflows/nx-cache.yml` runs on every push with the read-write token from the `nx-cloud-write` environment. Every other CI token is read-only, so pull request pipelines read the shared cache and write only to a cache NX Cloud scopes to that pull request. CircleCI passes the pull request number as `NX_BRANCH` because API-triggered pipelines don't have it otherwise
- On CI, NX Cloud prints only a link for a failed task. Pass `--output-style=stream` (or set `NX_DEFAULT_OUTPUT_STYLE=stream`) to keep the task's own errors in the log
- `compile` hashes the `OS` environment variable, so Windows and POSIX builds never restore each other's `dist`
- To force a rebuild, pass `--skip-nx-cache` (or `yarn task compile --skip-cache`). Do not bump a field in `nx.json` to bust the cache: that invalidates every task in the workspace

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
| `NX_DEFAULT_OUTPUT_STYLE`     | `stream` on CI: print task output inline        |
