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
- CircleCI's default per-job pipeline does not use NX Cloud (`--skip-nx-cache` on CI); the opt-in NX DTE pipeline below does
- A target on the `code` project must hash `code-all` (or `code-internal`, for the internal Storybook's targets), not `default`: `{projectRoot}/**/*` only covers the files no nested project owns, so a change in `code/core` would restore a stale result
- Inputs decide what a pull request runs (`nx affected`), not only what the cache restores: a file a task reads but does not hash is a test that silently does not run. These tests guard the known gaps: `scripts/ci/nx/compile-inputs.test.ts` fails when a package bundles another package's file that its `compile` does not hash (add the file to `namedInputs.production` in its project.json), `scripts/ci/nx/check-inputs.test.ts` when a type check loads a workspace file its `check` does not hash, `scripts/create-nx-sandbox-projects.test.ts` when a sandbox does not depend on every workspace package its template installs, and `scripts/ci/nx-shared-globals.test.ts` when a task imports a script outside `sharedGlobals`, a target misses a file of `ci-environment`, or a test reads a file that the unit-test targets do not hash or that a focused run does not answer with the whole suite (`needsAllUnitTests` in `scripts/ci/global-inputs.ts`)
- `check` hashes its package's files, its dependencies' `own-production`, and every other workspace file its TypeScript program loads, which `scripts/ci/nx/check-inputs.ts` writes into the project.json files (run it after `yarn nx run-many -t compile -c production`; a development compile writes no declarations). `check` runs after every `compile`, so the program loads other packages' `dist` declarations, which Nx does not hash; their package's `production`, which its `compile` builds them from, is hashed instead
- Only `next` writes to the shared remote cache, with the read-write token from the `nx-cloud-write` environment: `.github/workflows/nx-cache.yml` fills `compile` and `check` on every push. Pull requests use the read-only token, so they read that cache and write only to a cache NX Cloud scopes to the pull request
- On CI, NX Cloud prints only a link for a failed task. Pass `--output-style=stream` (or set `NX_DEFAULT_OUTPUT_STYLE=stream`) to keep the task's own errors in the log
- `sharedGlobals` hashes the `OS` environment variable (`Windows_NT` on Windows, unset elsewhere), so every task keeps its Windows results apart from Linux's, while macOS and Linux share theirs
- To force a rebuild, pass `--skip-nx-cache` (or `yarn task compile --skip-cache`). Do not bump a field in `nx.json` to bust the cache: that invalidates every task in the workspace

## NX on CircleCI agents (experiment)

The same NX task graph can also run distributed over CircleCI machines (NX Cloud's manual distributed task execution). NX Cloud schedules the tasks and holds the cache; CircleCI provides the machines. The per-job CircleCI pipeline is unchanged and stays the default.

- Opt in with the `nxDte` pipeline parameter: a pull request labelled `nx:<workflow>` (`nx:focus`, `nx:normal`, `nx:docs`, `nx:daily`, `nx:windows`) triggers it through `.github/workflows/trigger-circleci-nx-dte.yml`
- On a pull request the run is one `nx affected` command per OS: Nx's task-level affected (nx.json has no `affected.legacy`) selects a task only when the diff since the merge base (`NX_BASE`, as the `nx/set-shas` orb command of Nx's CircleCI recipe finds it) reaches one of its inputs. Anywhere else, or with the `nxDteAffected` parameter set to `false`, it is `nx run-many` with the same targets and projects. A missing input therefore no longer only restores a stale result: the task does not run at all. `nx affected -t <targets> --files=<file> --explain=out.json` says why each task was selected
- Which projects belong to a workflow is in the graph: `--projects=tag:library,tag:ci:<workflow>` (`affected` has no `--projects`, so it excludes the rest). The targets come from `scripts/ci/nx/plan.ts`, which maps every CircleCI job to its NX tasks. `run.ts` checks that the tags select exactly the planned projects and names them one by one when they do not (always for `focus`)
- The setup job (`.circleci/config.yml`) checks out one commit, restores node_modules and works out the run's work (`scripts/ci/nx/select.ts`, stored as the `nx-dte-selection.json` artifact). While node_modules restores, `scripts/ci/nx/merge-base.sh` finds the merge base in a bare repository of only the commits, the same 100 commits of the default, the pull request's and the base branch that the job used to check out, and fetches that one commit into the checkout: the checkout of 100 commits took 15 s, against 7 s for one. A focused run (`nx:focus`) still checks out 100 commits, since select.ts and main.ts diff it against the base branch in the checkout. select.ts builds the project graph once, in-process, makes both OSes' Nx commands from it (`run.ts` `nxCommands`; `run.test.ts` keeps its targets and project patterns equal to the Nx CLI's), and starts only the `nx … --graph` commands, at the same time: about 3 s locally, against 6 s with a `run.ts` process per OS. It works out which tasks Nx will run, each task's hash (Nx's own hasher, `task-hashes.ts`; for Windows with the npm packages named as on Windows, `windows-graph.ts`), whether the pull request's latest NX Cloud runs on that OS or the base branch's latest runs (nx-cache.yml's among them) already stored that hash, and how long the task takes (the longest of the pull request's latest three runs on that OS, before its first one the latest three runs on that OS on any branch, and NX Cloud's CI average over every OS; `nx-cloud-history.ts`, the NX Cloud Public API with the CI token, at most four requests at a time; after a 429 it waits as long as asked, up to 30 seconds, and otherwise goes on without that request). A base-branch hash counts only where it equals the one the setup job works out: a run with Ultracache (the default in CI on Nx 24, unless `NX_CLOUD_USE_ULTRACACHE=false`, which the NX DTE jobs set) hashes from its recorded reads, so its hashes never match. Nx's manual DTE cannot scale the agents to a run (its dynamic changesets are for NX Cloud's own agents, and only look at the share of projects a change affects), so `agent-sizing.ts` simulates the run for every number of agents, handing out the task that has been ready longest as NX Cloud does (not the longest chain first), and starts the one with the lowest cost: the agent-seconds it bills plus `WAIT_WORTH` (60) agent-seconds for each second it takes: speed first. All agents start at once. A cached task counts as the restore it is, so a rerun or a follow-up push starts few agents. With the longest chain first, a weight of 20 and the latest time of each task, the model started 33 agents for a cold core run, which was green 46 s later than with 44: NX Cloud hands out the task ready longest, a weight of 20 never pays for the last agents, and the latest times left out 17% of the work. A count of one agent per 4 uncached tasks was measured against it: a rerun got 4 agents and was 55 s slower. Without the token (a fork) or when NX Cloud does not answer, every task counts as one that runs. The setup job writes the agent count into the selection, and `main.ts` starts that many; `nxDteMaxAgents` caps the Linux agents
- `scripts/ci/nx/circleci-dte.ts` generates the jobs: `nx-main` starts the NX Cloud run with `start-ci-run --distribute-on=manual` in a background step, then runs the Nx commands the setup job worked out (select.ts writes them into the selection; without one, `nx-main` runs `run.ts`); `nx-agent` runs as parallel containers, each `nx start-agent`. The Node 26 smoke job stays a plain CircleCI job. `circleci-completion` waits for the main jobs (which fail when a task fails), not for the agents
- What the tasks on an agent see, its executor, environment variables and Chromium, is in `scripts/ci/nx/agent-environment.ts`. The `ci-environment` named input hashes it, with `scripts/ci/utils/executors.ts` and `orbs.ts`, so a change to them runs every task again. `circleci-dte.ts` only schedules, so a change to it keeps the cache
- The Windows tests (`WINDOWS_TASKS` in `plan.ts`: the same `code:test-1`/`-2`, `e2e-tests`, `e2e-tests-dev-1`/`-2` and `init-empty` targets as on Linux, on the `ci:windows` projects) run in a second run of the same NX Cloud pipeline: `nx-main-windows` (a Windows `medium`, which hashes the tasks on the OS that runs them) and `nx-agent-windows` (`large`), with `NX_CI_EXECUTION_ENV=windows` and `.nx/workflows/circleci-windows-assignment-rules.yaml`. NX Cloud shows the two runs side by side. A Windows agent boots in about four minutes (about 500 credits), which the same simulation weighs, with at most 4 (`MAX_AGENTS`). Its hashes are worked out on Linux with Windows' `OS` and npm package names (`windows-graph.ts`). A `nx:windows` run has no Linux part: CircleCI's own Windows jobs needed the Linux sandbox, the agents build their own
- Every main job and agent ends within a hard `timeout` (45 minutes on Linux, 75 on Windows): on NX Cloud's own Windows agents a run once never ended and held its machines for six hours. Each main job ends with `nx stop-all-agents`, as Nx's manual DTE recipes do. An agent also stops a minute after its main job ended (`scripts/ci/nx/run-agent.sh`, which asks CircleCI's public API every 30 seconds; on Windows it ends the agent's whole process tree with `taskkill`): it waits for its NX Cloud run, also for one the main job never started, as when that failed to check out. Such a stop exits 0, since the main job already shows how the run ended
- Assignment rules for the agents are in `.nx/workflows/circleci-assignment-rules.yaml`. Every agent is `large`: an `xlarge` pool for the sandbox tasks ran the dev-server E2E tests only a quarter faster at twice the credits per minute
- `start-ci-run --stop-workers-after=<every target of the run>`, not `--require-explicit-completion`: only when NX Cloud knows no more tasks can come does it stop each agent that has nothing left ("no further tasks for this worker"). With explicit completion every agent idled until the main job ended, a third of the run's credits
- After the install, use the workspace's Nx (`yarn nx start-agent`). `npx nx-cloud …` loads a client that cannot find the workspace's Nx
- Each failed task shows on the pull request as a commit status `nx run <task>`, linked to its log on NX Cloud. On CircleCI only `nx-main` turns red, and the agent that ran the task stays green. CircleCI has no token that may write statuses, so the `report` job of `trigger-circleci-nx-dte.yml` waits for `nx-main` and writes them (`scripts/ci/nx/dte-task-statuses.ts`, which reads the failed tasks from the `Run nx` log). A green run of the same `nx:` workflow on the same commit turns those failures green
- Rerun a failed NX DTE pipeline on GitHub: "Re-run all jobs" on the `Trigger CircleCI NX DTE` run starts a new pipeline and updates the task statuses. A rerun in CircleCI leaves the task statuses as they were, and must start from the beginning, not "from failed": rerunning only `nx-main` starts a new NX Cloud run that no agent joins, and it waits until its no-output timeout
- `nx-main` turns off the `NX_VERBOSE_LOGGING` that the CircleCI project sets: it buried the summary under some 4,000 lines
- A pull request with a `ci:<workflow>` label does not get the NX DTE pipeline, even with an `nx:` label: both would run on the same branch and CircleCI would cancel one. The trigger's log says so
- The `sandbox` target skips `storybook init`'s Playwright install (`STORYBOOK_CLI_SKIP_PLAYWRIGHT_INSTALLATION` in `nx.json`), as CircleCI's create jobs do: it installed Chromium with apt packages in every sandbox, and the agents install it once. Set it on that target only: `init-empty/features` and the unit tests of the install need it unset
- The agents set `STORYBOOK_NX_CLOUD_AGENT`, so the sandboxes install from the global yarn cache
- An agent runs its tasks one after another in one checkout, with one folder per sandbox, so no task may see what an earlier one left. Each sandbox task first restores the sandbox from what NX cached for its `sandbox` and `build` tasks, keeping only its node_modules (`scripts/prepare-sandbox.ts`), so a story an E2E test created does not reach the next build. Each task writes its JUnit and Playwright results to `test-results/<project>/<target>` and `code/playwright-results/<project>/<target>` (`nxTaskResultsDirectory` in `scripts/utils/nx.ts`), which its `outputs` name; `scripts/ci/nx/task-results.test.ts` keeps the two in step. A `yarn task` task that leaves a file in the checkout fails (`scripts/task.ts`); the agent's last step lists what any other task left, without failing the agent. The portable stories' `yarn.lock` is not tracked, since every install fills it in; each task creates it empty first. `test-storybooks/mcp:vitest` puts back the tracked `yarn.lock` its install rewrites (the hashes of the `file:` packages change with every build)
- `scripts/ci/nx/circleci-node-modules.sh` caches the whole installed tree as one zstd archive per CPU (4 on Linux, 8 on Windows), extracted at the same time; the setup job stores the Linux tree after an install, and `nx-main` or `nx-main-windows` when no earlier job did, only for trusted authors. The archives leave out Yarn's workspace links (junctions on Windows, which neither tar nor CircleCI's cache keeps), and a restore makes them again with `workspace-links.ts`. On CircleCI's Windows machines Windows' `find`, `sort` and `tar` come first on the PATH, so the script puts `/usr/bin` first
- CircleCI cancels a running pipeline when a newer one starts on the same branch (auto-cancel), a push's own pipeline included. To measure two pipelines side by side, run them on different branches, and trigger after the push's pipeline exists

## Following an NX Cloud pipeline

`gh pr checks <pr>` lists each failed task as a red `nx run <task>` status (`nx run <task> on Windows` for the Windows run), linked to its log. `scripts/ci/nx-cloud-status.ts` says why: it reads a pipeline from the NX Cloud Public API with your `npx nx login`, so you do not need the NX Cloud web page. It needs no dependencies installed.

```bash
# Report the newest pipeline of a pull request (or a branch, a CIPE id, or a cloud.nx.app/cipes link)
node scripts/ci/nx-cloud-status.ts 37221

# Follow the pipeline of the commit you just pushed: one line per change, then the full report
node scripts/ci/nx-cloud-status.ts 37221 --watch --sha HEAD
```

- The report gives the pipeline status, why it was canceled, each run group (Linux and Windows) with its `nx affected` command, and each failed task with the lines that name the failure and the end of its log. Each log is saved as a text file; the report prints its path
- Agents run `--watch` as a background monitor, so each printed line wakes them. It exits with the report once the pipeline is done: 0 when it succeeded, 1 when it failed or was canceled. It exits 2 on an error it cannot retry, or when no pipeline started within 15 minutes (does the pull request have an `nx:` label?)
- Pass `--sha` after a push. Without it, the watch follows the newest pipeline, which is the previous one until NX Cloud registers the push. When the newest pipeline on a branch has already finished, the watch first waits 3 minutes for a new one: a push reaches NX Cloud only once `nx-main` starts. A CIPE id as target skips that wait. Without a target, the script follows the current branch at `HEAD`
- A one-off report on a pipeline that still runs exits 3
- It also follows a GitHub Actions run by its id (`nx-cache.yml`'s), whose GitHub re-runs NX Cloud records no command for (exit 4 when `gh` cannot read their result), and reports worker steps where NX Cloud records them (its own workers, not the CircleCI agents)
- NX Cloud shows each `nx affected` command once it finishes, so the failed tasks show when a run group ends
- A report costs up to about 30 requests of the Public API quota, which the whole organization shares (60 per minute). A watch costs a few per poll, every 30 seconds by default
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
