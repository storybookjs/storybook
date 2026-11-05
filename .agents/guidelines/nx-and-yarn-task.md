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
- `.github/workflows/nx.yml` runs what CircleCI runs for the same `ci:` label (`focus`, `normal`, `docs`, `daily`, `windows`). `scripts/ci/nx/plan.ts` maps every job of the generated CircleCI config to its NX tasks, and `scripts/ci/nx/run.ts` runs them as `nx run-many` commands that run nothing extra. When you add a CircleCI job, add its NX equivalent to `plan.ts`; `plan.test.ts` fails until you do. The Windows and Node 26 jobs run as plain GitHub Actions jobs in the same workflow
- A target on the `code` project must hash `code-all`, not `default`: `{projectRoot}/**/*` only covers the files no nested project owns, so a change in `code/core` would restore a stale result
- Only `next` writes to the shared remote cache and the node_modules caches, with the read-write token from the `nx-cloud-write` environment: `.github/workflows/nx-cache.yml` on every push (task cache, main job's node_modules) and the nightly `nx` run (also the workers' node_modules, so after a lockfile change pull-request workers install from scratch until the next night). Pull requests use the read-only token, so they read those caches and write only to a cache NX Cloud scopes to the pull request
- NX Cloud workers restore the installed node_modules tree that the nightly `nx` run on `next` stored, keyed on the lockfile, every package.json and the prune script, and skip `yarn install`. The cache paths in `.nx/workflows/agents.yaml` are listed without globs (the cache step stores a glob under a key no restore asks for). A node_modules folder missing from that list is noticed and the worker installs normally; add the folder to the list. Before storing, `.nx/workflows/prune-other-platforms.cjs` removes the other platforms' native packages that `.yarnrc.yml` installs (about 2 GB)
- Each worker runs one task at a time (plus the continuous `dev`, `serve` and `run-registry` tasks it needs). Two tasks of the same sandbox on one worker break each other: each restores the sandbox folder from the cache first. Dynamic task packing was tried and left off: it queued an e2e task behind a finished one for minutes
- On NX Cloud workers Playwright runs 6 workers (`PLAYWRIGHT_WORKERS` in the launch template), and 4 for `e2e-tests-dev` (set in `nx.json`): with 6 the dev server fell behind and tests timed out
- On CI, NX Cloud prints only a link for a failed task. Pass `--output-style=stream` (or set `NX_DEFAULT_OUTPUT_STYLE=stream`) to keep the task's own errors in the log
- `compile` hashes the `OS` environment variable, so Windows and POSIX builds never restore each other's `dist`
- To force a rebuild, pass `--skip-nx-cache` (or `yarn task compile --skip-cache`). Do not bump a field in `nx.json` to bust the cache: that invalidates every task in the workspace

## NX on CircleCI agents (experiment)

The same NX task graph can also run distributed over CircleCI machines instead of NX Cloud's own workers (NX Cloud's manual distributed task execution). NX Cloud schedules the tasks and holds the cache; CircleCI provides the machines. The per-job CircleCI pipeline is unchanged and stays the default.

- Opt in with the `nxDte` pipeline parameter: a pull request labelled `nx-dte:<workflow>` (`nx-dte:focus`, `nx-dte:normal`, `nx-dte:daily`) triggers it through `.github/workflows/trigger-circleci-nx-dte.yml`. `nxDteAgents` (default 40) and `nxDteAgentClass` (`large` or `xlarge`) set the agents
- `scripts/ci/nx/circleci-dte.ts` generates the jobs: `nx-main` starts the NX Cloud run with `start-ci-run --distribute-on=manual`, then runs `run.ts` like `nx.yml`; `nx-agent` runs as parallel containers, each `nx start-agent`. The Windows parts and the Node 26 smoke job stay plain CircleCI jobs. `circleci-completion` waits for `nx-main` (which fails when a task fails), not for the agents
- `.nx/ci-config.yaml` must be out of the way while `start-ci-run` runs: the command refuses to start when it exists. Assignment rules for the agents are in `.nx/workflows/circleci-assignment-rules.yaml`
- After the install, use the workspace's Nx (`yarn nx start-agent`, `yarn nx complete-ci-run`). `npx nx-cloud …` loads a client that cannot find the workspace's Nx
- Rerun a failed NX DTE workflow from the start, not "from failed": rerunning only `nx-main` starts a new NX Cloud run that no agent joins, and it waits until its no-output timeout
- Do not label a pull request with both `ci:<workflow>` and `nx-dte:<workflow>`: both pipelines run on the same branch and CircleCI cancels one of them. The NX DTE trigger skips pull requests that have a `ci:` label
- `scripts/ci/nx/circleci-node-modules.sh` caches the whole installed tree as one zstd archive; only `nx-main` stores it, for trusted authors
- CircleCI cancels a running pipeline when a newer one starts on the same branch (auto-cancel), a push's own pipeline included. To measure two pipelines side by side, run them on different branches, and trigger after the push's pipeline exists
- `CIRCLE_TOKEN=… node scripts/ci/nx/circleci-benchmark.ts <workflow>...` compares workflows: time to the green check, wall time, queue, setup and task phase of `nx-main`, container minutes and credits

## Following an NX Cloud pipeline

`scripts/ci/nx-cloud-status.ts` reads a pipeline from the NX Cloud Public API with your `npx nx login`, so you do not need the NX Cloud web page. It needs no dependencies installed.

```bash
# Report the newest pipeline of a pull request (or a branch, a CIPE id, a cloud.nx.app/cipes link,
# or the NX Cloud link of the pull request's `nx` status)
node scripts/ci/nx-cloud-status.ts 37181

# Follow the pipeline of the commit you just pushed: one line per change, then the full report
node scripts/ci/nx-cloud-status.ts 37181 --watch --sha HEAD

# Follow one GitHub Actions run, such as a workflow_dispatch run on the same branch and commit
node scripts/ci/nx-cloud-status.ts 41939428103 --watch      # or 41939428103-1 (<run id>-<attempt>)
```

- The report gives the pipeline status, why it was canceled, each failed task with the lines that name the failure and the end of its log, and the worker steps that failed or timed out (for example `Restore Node Modules Cache`, or `no_output_timeout after 600s`), with the end of a worker's log. Each log is saved as a text file; the report prints its path
- Agents run `--watch` as a background monitor, so each printed line wakes them. It exits with the report once the pipeline is done: 0 when it succeeded, 1 when it failed or was canceled. It exits 2 on an error it cannot retry, when GitHub says a run finished that NX Cloud never saw, or when no pipeline started within 15 minutes (is the pull request labeled `ci:normal`?)
- Pass `--sha` after a push. Without it, the watch follows the newest pipeline, which is the previous one until NX Cloud registers the push. When the newest pipeline on a branch has already finished, the watch first waits 3 minutes for a new one: a push or `workflow_dispatch` reaches NX Cloud only once its job starts, possibly on the same commit as a finished pipeline. A CIPE id or GitHub run as target skips that wait. Without a target, the script follows the current branch at `HEAD`
- A one-off report on a pipeline that still runs exits 3
- NX Cloud records no `nx` command for a GitHub re-run (attempt 2 or later): the Nx client gets a 404 for the distributed execution summary, and the run group ends by heartbeat with no runs. The report says so and shows GitHub's conclusion, which also decides the exit code (4 when `gh` cannot read it)
- Live, NX Cloud shows the pipeline status and each `nx` command once it finishes. Our pipeline runs one `nx run-many`, so failed tasks show when it ends. Worker details (steps, timeouts, restarts) can follow minutes after the pipeline ends; the watch waits up to 10 minutes for them
- A report costs up to about 30 requests of the Public API quota, which the whole organization shares (60 per minute on the Team plan). A watch costs a few per poll, every 30 seconds by default
- The `nx` and `nx run <task>` commit statuses from `.github/workflows/nx.yml` still say on the pull request whether the run passed; use the script for why
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
