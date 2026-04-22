# Eval Harness

The eval harness benchmarks how well AI coding agents (Claude, Codex) can set up Storybook and write stories for real-world projects. It runs agents against benchmark repos, grades the results, publishes them as draft PRs, and collects the data into a SQLite database for analysis.

## Prerequisites

- `**gh` CLI** — installed and authenticated (`gh auth login`)
- **Claude Code CLI** and/or **Codex CLI** — installed with an active subscription

## How it works

![End-to-End Data Flow](https://github.com/user-attachments/assets/e2f12c18-85f0-4f94-830e-2f4742823fcb)

The system forms a cycle:

1. `**sync-baselines.ts`** pushes a canonical `.storybook` config to each benchmark repo so every trial starts from the same known-good baseline.
2. `**eval.ts**` (single trial) or `**run-batch.ts**` (batch) creates a git worktree from a benchmark repo, runs an agent inside it, grades the output, and publishes a draft PR with structured result data.
3. `**collect-pr-data.ts**` scrapes those draft PRs via the GitHub API and loads the results into a local SQLite database for analysis.

Each trial follows this lifecycle:

1. Clone the benchmark repo (once) and create a lightweight git worktree for the trial
2. Install dependencies
3. Run the agent with the selected prompt
4. Grade the result (build check, TypeScript check, story render pass rate, ghost story coverage)
5. Compute a quality score (normalized preview gain)
6. Commit, push, and open a draft PR on the benchmark repo

## Running a single trial

All commands run from the repo root.

```sh
# Prompt variant is required. Example: pattern-copy-play (the CLI default)
node scripts/eval/eval.ts -p mealdrop --prompt pattern-copy-play

# Specific agent
node scripts/eval/eval.ts -p mealdrop --prompt pattern-copy-play -a codex

# Specific model (agent is inferred)
node scripts/eval/eval.ts -p mealdrop --prompt pattern-copy-play -m opus-4.6

# Specific effort level
node scripts/eval/eval.ts -p mealdrop --prompt pattern-copy-play -a claude -e max

# Different prompt
node scripts/eval/eval.ts -p mealdrop --prompt setup

# Manual mode — prepare workspace, print the command to run yourself
node scripts/eval/eval.ts -p mealdrop --prompt pattern-copy-play --manual

# Verbose output
node scripts/eval/eval.ts -p mealdrop --prompt pattern-copy-play -v

# List available projects, models, or prompts
node scripts/eval/eval.ts --list-projects
node scripts/eval/eval.ts --list-models
node scripts/eval/eval.ts --list-prompts
```

When a trial completes, it prints a summary:

```
Result
  Build:   PASS
  Stories: 8/12 (67%) -> 11/12 (92%)
  Ghost:   5/8 (63%) -> 7/8 (88%)
  TS Err:  0
  Score:   75% (normalized preview gain)
  Cost:    $1.23
  Time:    4m32s
  Turns:   18
  PR:      https://github.com/storybook-tmp/mealdrop/pull/42
```

## Running a batch

```sh
# Prompt is required. Confirms interactively unless you pass --yes (CI / automation).
node scripts/eval/run-batch.ts --prompt pattern-copy-play --yes

# Claude only
node scripts/eval/run-batch.ts --prompt pattern-copy-play --yes --agents claude

# Specific effort levels
node scripts/eval/run-batch.ts --prompt pattern-copy-play --yes --claude-effort max
node scripts/eval/run-batch.ts --prompt pattern-copy-play --yes --claude-efforts max,high
node scripts/eval/run-batch.ts --prompt pattern-copy-play --yes --agents codex --codex-effort xhigh

# Different prompt or concurrency
node scripts/eval/run-batch.ts --prompt setup --yes
node scripts/eval/run-batch.ts --prompt pattern-copy-play --yes --concurrency 4
```

Batch results are written to `storybook-eval/batches/<timestamp>/`, with per-run log files and a `summary.json`.

## Syncing baselines

Before running evals, the benchmark repos need a consistent `.storybook` baseline. `sync-baselines.ts` pushes the canonical baseline config to every benchmark repo.

```sh
# Sync all projects
node scripts/eval/sync-baselines.ts

# Sync specific projects
node scripts/eval/sync-baselines.ts --project mealdrop --project edgy

# Dry run (commit locally but don't push)
node scripts/eval/sync-baselines.ts --skip-push
```

The script ensures each repo is on its default branch with no local changes, fetches the latest from origin, replaces the `.storybook` directory with the canonical baseline, and commits/pushes if anything changed.

## Syncing the Storybook version

`sync-storybook-version.ts` bumps every benchmark repo to a specific Storybook version. It mirrors the shape of `sync-baselines.ts`: for each project it ensures the source clone is present and clean, checks out and fast-forwards the default branch, runs `npx storybook@<version> upgrade --yes --force --skip-check --skip-automigrations -c <projectDir>/.storybook` from the **repo root**, then commits and pushes any resulting changes. Running from the repo root (with `-c` pointing at the project's `.storybook` dir) lets the Storybook CLI discover the correct workspace `package.json` in pnpm/yarn monorepos where the Storybook deps live at the workspace root and the config lives in a sub-package.

```sh
# Upgrade every benchmark repo to a stable version
node scripts/eval/sync-storybook-version.ts --version 9.1.0

# Upgrade to a canary published from a Storybook PR
node scripts/eval/sync-storybook-version.ts --version 0.0.0-pr-34297-sha-abcdef12

# Upgrade a subset of projects
node scripts/eval/sync-storybook-version.ts --version latest --project mealdrop --project edgy

# Commit locally without pushing yet
node scripts/eval/sync-storybook-version.ts --version 9.1.0 --skip-push
```

The upgrade passes the following flags:

- `--yes` — auto-accepts prompts.
- `--force` — skips the autoblocker gate (useful for canary or major-version bumps).
- `--skip-check` — skips the postinstall self-check.
- `--skip-automigrations` — prevents the CLI from rewriting source files (e.g. the `wrap-getAbsolutePath` migration).

The commit message defaults to `Eval: upgrade Storybook to <version>`. If you review a `--skip-push` run first, rerun the same command without `--skip-push` to push the existing local upgrade commits. Run `sync-baselines.ts` afterwards if you also need to refresh the canonical `.storybook` config in every repo.

## Collecting results

After running trials, `collect-pr-data.ts` scrapes the published draft PRs and loads the data into a local SQLite database.

```sh
# Collect from all projects
node scripts/eval/collect-pr-data.ts

# Collect from a specific project
node scripts/eval/collect-pr-data.ts --project mealdrop

# Limit PRs fetched or filter by state
node scripts/eval/collect-pr-data.ts --limit 50
node scripts/eval/collect-pr-data.ts --state open

# Custom database path (default: scripts/eval/.cache/eval-pr-data.sqlite)
node scripts/eval/collect-pr-data.ts --db-path ./my-eval-data.sqlite
```

## Querying results

Open the database with any SQLite client:

```sh
sqlite3 scripts/eval/.cache/eval-pr-data.sqlite
```

The database includes four built-in views:

- `**story_render_summary_by_project_model_effort**` — the go-to view for comparing models. Shows `project`, `model`, `effort`, `trials`, `before`/`after` pass rates, `gain` (normalized preview gain), `avg_cost_usd`, `avg_duration_m_s`, and `avg_turns`.
- `**story_render_scores_by_trial**` — per-trial breakdown with before/after rates, absolute gain, normalized preview gain, and `score`. Useful for inspecting individual results or computing variance.
- `**story_render_rate_by_project_model_effort**` — detailed aggregate view, like the summary but with additional columns (empty render failures, raw counts).
- `**ghost_story_rate_by_project_model_effort**` — ghost story coverage rates with `before_rate`, `after_rate`, `absolute_rate_gain`, and `normalized_rate_gain`.

Common queries:

```sql
-- Compare model performance across all projects
SELECT * FROM story_render_summary_by_project_model_effort;

-- Find the best and worst trials for a project
SELECT project, trial_id, model, score
FROM story_render_scores_by_trial
WHERE project = 'mealdrop'
ORDER BY score DESC;

-- Compare normalized preview gain across models
SELECT project, model, effort, trials, normalized_preview_gain
FROM story_render_rate_by_project_model_effort
ORDER BY normalized_preview_gain DESC;

-- Ghost story coverage
SELECT project, model, effort, before_rate, after_rate, normalized_rate_gain
FROM ghost_story_rate_by_project_model_effort;
```

### Using LLMs to explore the database

The SQLite database is a great target for LLM-assisted analysis. Point Claude or any coding agent at the database file and ask natural language questions like "which model scores best per dollar?" or "what's the score variance for mealdrop?".

## Understanding scores

![grade.ts: Four-dimensional grading](https://github.com/user-attachments/assets/2cb8be16-88cf-4365-846a-f9385e10a0e7)

Each trial produces several metrics:

- **Build** — whether `storybook build` succeeds (pass/fail)
- **TypeScript errors** — number of errors from `tsc --noEmit`
- **Story render (before/after)** — how many stories pass Vitest rendering. The "before" measurement temporarily restores the baseline preview config to isolate the agent's contribution.
- **Ghost stories (before/after)** — auto-generated tests that check whether components render without crashing.

The headline metric is **normalized preview gain** — how much of the remaining room for improvement did the agent capture. It is stored in `data.json` as a **0–1 index**; the CLI, draft PR, and eval summary UI show the same value as a **percentage** for readability.

If the baseline already passes every story (**before_rate = 100%**), there is no remaining gap — the gain and headline score are **0**.

```
gain = (after_rate - before_rate) / (1 - before_rate)
```

For example, if the baseline pass rate is 60% and the agent achieves 80%:

```
gain = (0.80 - 0.60) / (1 - 0.60) = 0.50
```

The agent captured 50% of the possible improvement. A score of 1.0 means the agent achieved a 100% pass rate. A score of 0 means no improvement.

## Projects

Benchmark apps live in repos under the `storybook-tmp` GitHub org. The authoritative list is in `scripts/eval/lib/projects.ts` — use `node scripts/eval/eval.ts --list-projects` to see names and descriptions.

## Adding a new benchmark project

To benchmark a new app, register it in the harness and sync baselines. Follow these steps in order:

1. Create a repo under `storybook-tmp` on GitHub with the app you want to benchmark.
2. Install Storybook with a **fresh** init (for example `npx storybook@latest init`). The repo must not include custom stories yet—only the base example stories that the Storybook CLI creates. Remove or avoid any extra story files beyond that scaffold.
3. Add an entry to `scripts/eval/lib/projects.ts`:

```ts
{
  name: 'my-project',
  repo: 'https://github.com/storybook-tmp/my-project',
  branch: 'main',
  githubSlug: 'storybook-tmp/my-project',
  projectDir: 'packages/app', // if the app lives in a subdirectory
  description: 'Short description of the tech stack',
}
```

4. Add a `vitest:storybook` script to the project's `package.json` that runs the storybook vitest project. The grading harness calls this script and appends `--reporter=json --outputFile=... <storyFiles>`. The exact command depends on the repo's vitest setup:

```jsonc
// Most repos (inline vitest project):
"vitest:storybook": "vitest run --project=storybook"

// Repos with a dedicated config file (e.g. excalidraw):
"vitest:storybook": "vitest run --config vitest.storybook.config.mts"
```

5. Run `node scripts/eval/sync-baselines.ts --project my-project` to push the eval baseline `.storybook` config (this replaces the init scaffold in the benchmark repo).
6. Run a trial to verify: `node scripts/eval/eval.ts -p my-project --prompt pattern-copy-play`

## Prompts

The eval mirrors the real user flow exactly:

1. A real user copies the "Set up Storybook with AI" prompt from the Storybook UI — a one-line nudge (`AI_SETUP_PROMPT`) that just says _"Run `npx storybook ai setup` and follow its instructions precisely."_
2. The user pastes that into their AI agent.
3. The **agent** runs `npx storybook ai setup` itself as a tool call.
4. The agent reads the resulting project-aware markdown and follows it.

The harness hands step (1) to the trial agent as its task. It never spawns `ai setup` itself — that's the agent's job, just like with real users.

### How variant selection works

Prompt variants live in [`code/lib/cli-storybook/src/ai/prompts/`](../../code/lib/cli-storybook/src/ai/prompts/). Each variant is a self-contained `.ts` file that exports an `instructions(projectInfo)` function. The registry in `prompts/index.ts` lists every variant.

The eval selects a variant by injecting the `EVAL_SETUP_PROMPT` env var into the agent's spawn environment. When the agent later runs `npx storybook ai setup`, the CLI reads that env var and returns the matching variant. Real users never set this env var, so they always get the default (`pattern-copy-play`).

```
eval.ts --prompt setup
  → run-trial.ts calls driver.execute({ env: { EVAL_SETUP_PROMPT: 'setup' } })
    → agent spawns with that env
      → agent's `npx storybook ai setup` tool call inherits EVAL_SETUP_PROMPT
        → CLI's getPrompts() picks the 'setup' variant
```

### Available prompts

- `**pattern-copy-play**` *(default)* — analyze the codebase, copy real usage patterns, configure preview with providers and MSW mocks, write ~10 story files with play functions, verify each with Vitest. This is the only prompt users ever see when they run `npx storybook ai setup`.
- `**setup**` — structured step-by-step: analyze, configure preview, write 9 stories (3 simple / 3 medium / 3 complex), verify each with Vitest. Available only to the eval harness for A/B comparison against the default.

### Adding a new prompt variant

1. Create `code/lib/cli-storybook/src/ai/prompts/<name>.ts`. Make it fully self-contained — keep its own `getTypeImportSource`, code-example helpers, and any other private utilities so changing one variant can never accidentally change another. Duplication is deliberate here.
2. Export an `instructions(projectInfo: ProjectInfo): string` function.
3. Register it in `code/lib/cli-storybook/src/ai/prompts/index.ts` by adding an entry to `PROMPT_BUILDERS`.
4. Use it from the eval: `node scripts/eval/eval.ts -p mealdrop --prompt <name>`.

To promote a variant to be the default users see, change `DEFAULT_PROMPT_NAME` in the same registry file.