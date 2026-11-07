# NX and `pnpm task`

This document is canonical for NX and the `pnpm task` runner: caching, task dependencies, sandbox and CI-parity flags, and the environment variable reference. `AGENTS.md` owns the pointer to this file; everyday commands live in [Development workflow](./development.md).

Use NX when you want better caching and dependency tracking. Prefer these faster defaults first, and only add `-c production` or `--no-link` when you specifically need sandbox parity or CI-like behavior.

```bash
# Compile all packages
pnpm task compile
pnpm exec nx run-many -t compile

# Check all packages
pnpm task check
pnpm exec nx run-many -t check

# Run E2E tests for a template
pnpm task e2e-tests-dev --template react-vite/default-ts --start-from auto
pnpm exec nx e2e-tests-dev react-vite/default-ts -c production

# Jump to a later step
pnpm task e2e-tests-dev --start-from e2e-tests --template react-vite/default-ts
pnpm exec nx e2e-tests-dev -c production --exclude-task-dependencies
```

Key points:

- `pnpm task` works from the repository root and from `code/`; both forward to `scripts/task.ts`. NX has no root script, so run it through `pnpm exec nx`
- `-c production` is required for sandbox-related NX commands and CI-parity runs
- `react-vite/default-ts` is the default sandbox template
- `--no-link` is opt-in, not the default. See [Sandboxes](./sandboxes.md) for how a linked sandbox picks up rebuilt packages
- NX handles task dependencies via `nx.json`
- NX target commands use Nx project names (from `project.json` / Nx graph), not `package.json` names
- Example: `pnpm exec nx compile core` (project `core` is published as package `storybook`)
- NX Cloud remote-cache auth failures (e.g. HTTP 401 "insufficient access") degrade to the local cache, so they are expected on local runs where `NX_CLOUD_ACCESS_TOKEN` is unset. CI always sets that token, so a 401 there means an invalid or expired token and should be investigated rather than ignored. A read-only token enables cache reads but cannot store artifacts, so the "wasn't able to store" warning is still expected with one

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
