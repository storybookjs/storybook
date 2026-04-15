# Eval Harness

The eval harness benchmarks how well AI coding agents (Claude, Codex) can set up Storybook and write stories for real-world projects. It runs agents against benchmark repos, grades the results, publishes them as draft PRs, and collects the data into a SQLite database for analysis.

## Prerequisites

- `**gh` CLI** — installed and authenticated (`gh auth login`)
- **Claude Code CLI** and/or **Codex CLI** — installed with an active subscription

## How it works

E2E Data Flow

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
# Prompt file is required (scripts/eval/prompts/{name}.md). Example: pattern-copy-play
yarn eval -- -p mealdrop --prompt pattern-copy-play

# Specific agent
yarn eval -- -p mealdrop --prompt pattern-copy-play -a codex

# Specific model (agent is inferred)
yarn eval -- -p mealdrop --prompt pattern-copy-play -m opus-4.6

# Specific effort level
yarn eval -- -p mealdrop --prompt pattern-copy-play -a claude -e max

# Different prompt
yarn eval -- -p mealdrop --prompt setup

# Manual mode — prepare workspace, print the command to run yourself
yarn eval -- -p mealdrop --prompt pattern-copy-play --manual

# Verbose output
yarn eval -- -p mealdrop --prompt pattern-copy-play -v

# List available projects, models, or prompts
yarn eval -- --list-projects
yarn eval -- --list-models
yarn eval -- --list-prompts
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
yarn eval:run-batch -- --prompt pattern-copy-play --yes

# Claude only
yarn eval:run-batch -- --prompt pattern-copy-play --yes --agents claude

# Specific effort levels
yarn eval:run-batch -- --prompt pattern-copy-play --yes --claude-effort max
yarn eval:run-batch -- --prompt pattern-copy-play --yes --claude-efforts max,high
yarn eval:run-batch -- --prompt pattern-copy-play --yes --agents codex --codex-effort xhigh

# Different prompt or concurrency
yarn eval:run-batch -- --prompt setup --yes
yarn eval:run-batch -- --prompt pattern-copy-play --yes --concurrency 4
```

Batch results are written to `storybook-eval/batches/<timestamp>/`, with per-run log files and a `summary.json`.

## Syncing baselines

Before running evals, the benchmark repos need a consistent `.storybook` baseline. `sync-baselines.ts` pushes the canonical baseline config to every benchmark repo.

```sh
# Sync all projects
yarn eval:sync-baselines

# Sync specific projects
yarn eval:sync-baselines -- --project mealdrop --project edgy

# Dry run (commit locally but don't push)
yarn eval:sync-baselines -- --skip-push
```

The script ensures each repo is on its default branch with no local changes, fetches the latest from origin, replaces the `.storybook` directory with the canonical baseline, and commits/pushes if anything changed.

## Collecting results

After running trials, `collect-pr-data.ts` scrapes the published draft PRs and loads the data into a local SQLite database.

```sh
# Collect from all projects
yarn eval:collect-pr-data

# Collect from a specific project
yarn eval:collect-pr-data -- --project mealdrop

# Limit PRs fetched or filter by state
yarn eval:collect-pr-data -- --limit 50
yarn eval:collect-pr-data -- --state open

# Custom database path (default: scripts/eval/.cache/eval-pr-data.sqlite)
yarn eval:collect-pr-data -- --db-path ./my-eval-data.sqlite
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

Benchmark apps live in repos under the `storybook-tmp` GitHub org. The authoritative list is in `scripts/eval/lib/projects.ts` — use `yarn eval -- --list-projects` to see names and descriptions.

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

4. Run `yarn eval:sync-baselines -- --project my-project` to push the eval baseline `.storybook` config (this replaces the init scaffold in the benchmark repo).
5. Run a trial to verify: `yarn eval -- -p my-project --prompt pattern-copy-play`

## Prompts

Prompts are markdown files in `scripts/eval/prompts/` that tell the agent what to do during a trial. The `--prompt` flag selects one by filename (without `.md`).

### Available prompts

- `**pattern-copy-play**` — analyze the codebase, copy real usage patterns, configure preview with providers and MSW mocks, write ~10 story files with play functions, verify each with Vitest.
- `**setup**` — structured step-by-step: analyze, configure preview, write 9 stories (3 simple / 3 medium / 3 complex), verify each with Vitest.

### Writing a new prompt

1. Create a markdown file in `scripts/eval/prompts/`, e.g. `my-strategy.md`.
2. Write the instructions the agent should follow. The prompt is passed directly to the agent as its task.
3. Use it: `yarn eval -- -p mealdrop --prompt my-strategy`

The prompt should tell the agent how to analyze the codebase, configure `.storybook/preview.ts`, write story files matching the `stories` glob, and verify with `npx vitest --project storybook`.