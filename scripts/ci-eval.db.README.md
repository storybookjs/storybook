# CI Evaluation Database (`ci-eval.db`)

SQLite cache for the NX Cloud vs CircleCI evaluation. Every number in the
companion canvases (`canvases/nx-vs-circleci-findings.canvas.tsx`,
`canvases/next-merged-runs.canvas.tsx`) comes out of this file.

- **Location**: `scripts/ci-eval.db` (git-ignored)
- **Populated by**: `scripts/evaluate-ci.ts`
- **Ignored by**: `.gitignore`

## Running the sync

```bash
# Last 14 days (default)
yarn jiti scripts/evaluate-ci.ts

# Last 30 days
yarn jiti scripts/evaluate-ci.ts --days 30

# Since a specific point (experiment start)
yarn jiti scripts/evaluate-ci.ts --since 2026-03-23T13:54:53Z

# Report only (no API calls — read from cache)
yarn jiti scripts/evaluate-ci.ts --report-only

# Single workflow
yarn jiti scripts/evaluate-ci.ts --workflow normal:prs --days 30

# Custom flaky-analytics window
yarn jiti scripts/evaluate-ci.ts --flaky-range 7
```

## Regenerating the canvas from the DB

The `canvases/nx-vs-circleci-findings.canvas.tsx` file embeds its data as inline
TypeScript constants (canvas files cannot import from anywhere outside
`cursor/canvas`). To refresh those constants from the DB:

```bash
yarn jiti scripts/generate-canvas-data.ts
yarn jiti scripts/generate-canvas-data.ts --since 2026-03-23T13:54:53Z
yarn jiti scripts/generate-canvas-data.ts --flaky-range 7
```

The script reads the DB, computes: `NEXT_MERGED`, `NORMAL_PRS`, `PAIRED_NEXT`,
`PAIRED_PRS`, `NX_AUTORETRIES_30D`, `TOP_FLAKY_PRS`, `CCI_ONLY_JOBS`, and rewrites
the corresponding `const NAME = {...};` blocks in place (preserving the type
annotations and surrounding code). Inline comments inside the replaced blocks
are not preserved — document intent in the surrounding code instead.

Typical workflow:

```bash
# 1. Pull fresh data from the APIs into the DB (or skip if already synced today)
yarn jiti scripts/evaluate-ci.ts --since 2026-03-23T13:54:53Z

# 2. Regenerate the canvas from the DB
yarn jiti scripts/generate-canvas-data.ts --since 2026-03-23T13:54:53Z
```

The sync is **fully incremental**:

- Runs are keyed by `id` and inserted with `INSERT OR IGNORE`. Re-syncing a
  known run is a no-op.
- Flaky-task analytics are snapshotted once per calendar day per `--flaky-range`
  value. Running the sync twice on the same day does not hit the dashboard
  endpoints a second time.

## Required environment variables

| Env var                 | Purpose                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| `NX_CLOUD_ACCESS_TOKEN` | Public NX Cloud API (pipeline-executions, runs). Required.       |
| `CIRCLE_TOKEN`          | Optional. CircleCI Insights works anonymously for OSS projects.  |
| `NX_CLOUD_SESSION`      | `_nxCloudSession` cookie. Enables exact credits + flaky analytics (Enterprise). |
| `NX_CLOUD_PAT`          | Read from `~/.config/nxcloud/nxcloud.ini` if unset.              |

## Tables

### `runs` — one row per CI workflow / CIPE

| Column         | Type    | Notes                                                           |
| -------------- | ------- | --------------------------------------------------------------- |
| `id`           | TEXT PK | CircleCI workflow id or NX pipeline-execution id                |
| `system`       | TEXT    | `'circleci'` or `'nx'`                                          |
| `workflow`     | TEXT    | `normal`, `merged`, `daily`, `next:merged`, `next:daily`, `normal:prs`, `merged:prs`, `daily:prs`, `base (nx-ai)` |
| `branch`       | TEXT    | Git branch or PR number (NX uses PR numbers for PR runs)        |
| `status`       | TEXT    | `success` / `failed` / `canceled` (CCI) or `SUCCEEDED` / `FAILED` / `CANCELED` (NX) |
| `created_at`   | TEXT    | ISO 8601 timestamp                                              |
| `duration_sec` | REAL    | Wall-clock duration of the main run / workflow                  |
| `credits_used` | INTEGER | Raw credits consumed                                            |
| `cost_usd`     | REAL    | `credits_used * credit_to_usd_rate`                             |
| `commit_sha`   | TEXT    | Git SHA; enables paired-commit comparison                       |

### `failed_tasks` — one row per failing task inside a failed run

| Column      | Type | Notes                                         |
| ----------- | ---- | --------------------------------------------- |
| `run_id`    | TEXT | FK → `runs.id`                                |
| `task_name` | TEXT | `format-check`, `code:fmt`, `react-vite/default-ts:e2e-tests-dev`, ... |

### `nx_template_credits` — per-run agent/credit breakdown (NX only)

| Column              | Type    | Notes                                                |
| ------------------- | ------- | ---------------------------------------------------- |
| `run_id`            | TEXT    | FK → `runs.id`                                       |
| `template`          | TEXT    | `linux-js`, `linux-browsers-js`, `windows-js`        |
| `credits`           | INTEGER | Credits consumed by this template                    |
| `credit_multiplier` | INTEGER | Credits per minute (15 = medium+, 60 = extra_large+) |

Used to compute the "NX if downgraded to medium+" cost projection.

### `nx_cipe_retry_stats` — per-CIPE retry data (NX only)

One row per NX CIPE, from `ttgImpactMetadata.taskRetryStats` on the dashboard
analysis endpoint. Used to compute the **exact** "without retry" failure count
per workflow — no proportional scaling.

| Column                      | Type    | Notes                                                    |
| --------------------------- | ------- | -------------------------------------------------------- |
| `run_id`                    | TEXT PK | FK → `runs.id`                                           |
| `total_tasks`               | INTEGER | Tasks in the CIPE                                        |
| `total_task_retries`        | INTEGER | Reruns attempted (all attempts)                          |
| `successful_retries`        | INTEGER | Reruns that succeeded (task-level)                       |
| `failed_retries`            | INTEGER | Reruns that still failed after retry                     |
| `hypothetical_no_cache_ms`  | INTEGER | `ciPipelineExecution.duration.hypotheticalNoCacheMs` — total task-duration saved by the remote cache on this CIPE. Used as a cross-check against the per-task derivation in `nx_run_tasks`. NULL on pre-migration rows until the backfill catches up. |

**Rescued CIPE** = `runs.status = 'SUCCEEDED'` AND
`nx_cipe_retry_stats.successful_retries > 0`. Without retry these CIPEs would
have been reported as FAILED.

The sync fills this table two ways, both idempotent:

1. **Inline** — every new NX CIPE fetched by `syncNxCloudRuns` also pulls the
   analysis endpoint (a call we already need for exact credits) and stores
   retry stats in the same HTTP round-trip.
2. **Backfill** — after the main sync, `backfillNxCipeRetryStats` looks for
   NX CIPEs in `runs` that have no matching row in `nx_cipe_retry_stats` and
   fetches the analysis endpoint for each. Once everything is filled, re-runs
   print `NX retry backfill: up to date` and make zero API calls.

### `nx_cache_stats` — per-CIPE cache hit counts (NX only)

Used to quantify how much the NX remote cache saves on each workflow. Excludes
non-cacheable `continuous-*` tasks (`serve`, `run-registry`).

| Column         | Type    | Notes                                                    |
| -------------- | ------- | -------------------------------------------------------- |
| `run_id`       | TEXT PK | FK → `runs.id`                                           |
| `cache_hits`   | INTEGER | Tasks whose cacheStatus contained `cache-hit`            |
| `cache_misses` | INTEGER | Tasks with `cacheStatus = cache-miss`                    |
| `total_tasks`  | INTEGER | `cache_hits + cache_misses`                              |

Filled by `backfillNxCacheStats`, which makes two API calls per missing CIPE
(`/runs/search` to find the main run id, `/runs/{runId}` for the full task list).
Idempotent: re-runs print `NX cache backfill: up to date`.

### `nx_run_tasks` — per-task detail (NX only)

One row per `(run_id, task_id)` from `/runs/{runId}` task lists. Excludes
continuous `serve` / `run-registry` tasks. Enables **real** per-CIPE cache
savings: each cache-hit task is valued by the avg duration of the *same
task-id* when it actually ran fresh (cache-miss samples), not by a
uniform-per-CIPE average that muddles heavy and light targets.

| Column            | Type    | Notes                                                               |
| ----------------- | ------- | ------------------------------------------------------------------- |
| `run_id`          | TEXT PK | FK → `runs.id` (first half of composite PK)                         |
| `task_id`         | TEXT PK | e.g. `react-vite/default-ts:e2e-tests-dev:production` (second half) |
| `project`         | TEXT    | Nx project name                                                     |
| `target`          | TEXT    | Nx target (`compile`, `test-runner`, `sandbox`, ...)                |
| `duration_ms`     | INTEGER | Task duration as reported in `/runs/{runId}`. For cache hits this is just the cache-restore time (~hundreds of ms). For cache misses it's the real work time. |
| `cache_status`    | TEXT    | `cache-miss`, `remote-cache-hit`, or `local-cache-hit`              |
| `agent_template`  | TEXT    | Inferred from target: `linux-js` for `compile` / `check` / `lint` / `knip` / `fmt`; `linux-browsers-js` otherwise |
| `credits_per_min` | INTEGER | Per-CIPE rate from `nx_template_credits` (60 on extra_large+, 15 on medium+). Defaults to 60 for CIPEs predating the template credits capture. |

Filled by `backfillNxRunTasks`, which makes two API calls per missing CIPE
(`/runs/search` + `/runs/{runId}`). Idempotent on composite PK: re-runs print
`NX run-tasks backfill: up to date`.

Index: `idx_nx_run_tasks_task_id` (task_id) and `idx_nx_run_tasks_run_id`
(run_id).

### `nx_flaky_task_snapshots` — one row per (day, range, task)

Data from NX Cloud Enterprise analytics endpoint:
`/orgs/{org}/workspaces/{ws}/analytics/flaky-tasks/{project}/{target}?range=N`

| Column                 | Type    | Notes                                                           |
| ---------------------- | ------- | --------------------------------------------------------------- |
| `snapshot_date`        | TEXT PK | `YYYY-MM-DD` — day the snapshot was taken                       |
| `range_days`           | INT PK  | Window size requested (typically 30)                            |
| `window_start`         | TEXT    | ISO 8601 start of the window reported by the API                |
| `window_end`           | TEXT    | ISO 8601 end of the window                                      |
| `project`              | TEXT PK | Nx project (e.g. `code`, `core`, `angular-cli/default-ts`)      |
| `target`               | TEXT PK | Nx target (e.g. `test`, `compile`, `e2e-tests-dev`)             |
| `configuration`        | TEXT PK | Usually `production`                                            |
| `total_reruns`         | INT     | Total automatic retries                                         |
| `total_rescues`        | INT     | `totalDeflakedAutomaticallyCount` — retries that succeeded      |
| `total_executions`     | INT     | Non-rerun executions of the task hash                           |
| `total_flaky_hashes`   | INT     | Number of distinct input-hashes flagged as flaky                |
| `retry_time_seconds`   | INT     | Total time spent on retries                                     |
| `avg_time_consumed_ms` | REAL    | Average task duration                                           |
| `flakiness_rate`       | REAL    | `flaky_successes / total_successes` (%)                         |
| `impact_score`         | REAL    | NX Cloud's prioritization metric                                |
| `last_failure_time`    | TEXT    | ISO 8601                                                        |

### `nx_flaky_task_kpis` — one row per (day, range) — workspace-wide totals

| Column                       | Type    | Notes                                        |
| ---------------------------- | ------- | -------------------------------------------- |
| `snapshot_date`              | TEXT PK | `YYYY-MM-DD`                                 |
| `range_days`                 | INT PK  | Window size                                  |
| `window_start` / `window_end`| TEXT    | API-reported window                          |
| `active_flaky_tasks`         | INT     | Count of tasks with flake rate > 0%          |
| `proportion_tasks_flaky_pct` | REAL    | % of all tasks that are flaky                |
| `high_risk_tasks`            | INT     | Tasks with flake rate > 20%                  |
| `total_reruns`               | INT     | Sum across all flaky tasks                   |
| `total_rescues`              | INT     | Sum across all flaky tasks                   |
| `retry_time_seconds`         | INT     | Sum across all flaky tasks                   |

### Indexes

```sql
idx_runs_system_workflow          (runs.system, runs.workflow)
idx_failed_tasks_run_id           (failed_tasks.run_id)
idx_nx_template_credits_run_id    (nx_template_credits.run_id)
idx_flaky_snapshots_date          (nx_flaky_task_snapshots.snapshot_date, range_days)
```

`nx_cipe_retry_stats` has its PRIMARY KEY on `run_id` which serves as the
lookup index.

## Example queries

All runnable with `sqlite3 scripts/ci-eval.db "..."`.

### Observed flake rate per system / workflow (since PR #34122 merged)

```sql
SELECT
  system,
  workflow,
  COUNT(*) AS runs,
  SUM(CASE WHEN status IN ('FAILED','failed') THEN 1 ELSE 0 END) AS failed,
  ROUND(100.0 * SUM(CASE WHEN status IN ('FAILED','failed') THEN 1 ELSE 0 END) / COUNT(*), 1) AS flake_pct
FROM runs
WHERE created_at >= '2026-03-23T13:54:53Z'
  AND workflow IN ('normal:prs','next:merged')
GROUP BY system, workflow
ORDER BY workflow, system;
```

### Paired-commit analysis (same commit, both providers)

```sql
WITH paired AS (
  SELECT c.commit_sha,
         c.status AS cci_status,
         n.status AS nx_status
  FROM runs c
  JOIN runs n ON c.commit_sha = n.commit_sha
  WHERE c.system='circleci' AND c.workflow='normal:prs'
    AND n.system='nx'       AND n.workflow='normal:prs'
    AND c.commit_sha IS NOT NULL
  GROUP BY c.commit_sha
)
SELECT
  SUM(CASE WHEN cci_status='success' AND nx_status='SUCCEEDED' THEN 1 ELSE 0 END) AS both_passed,
  SUM(CASE WHEN cci_status='failed'  AND nx_status='FAILED'    THEN 1 ELSE 0 END) AS both_failed,
  SUM(CASE WHEN cci_status='failed'  AND nx_status='SUCCEEDED' THEN 1 ELSE 0 END) AS only_cci_failed,
  SUM(CASE WHEN cci_status='success' AND nx_status='FAILED'    THEN 1 ELSE 0 END) AS only_nx_failed
FROM paired;
```

### Top 10 flaky tasks per provider

```sql
SELECT r.system, ft.task_name, COUNT(*) AS fails
FROM failed_tasks ft
JOIN runs r ON ft.run_id = r.id
WHERE r.workflow='normal:prs' AND r.created_at >= '2026-03-23T13:54:53Z'
GROUP BY r.system, ft.task_name
ORDER BY r.system, fails DESC;
```

### Auto-retry rescue analysis (latest snapshot)

```sql
SELECT project, target, total_reruns, total_rescues,
       ROUND(100.0 * total_rescues / total_reruns, 1) AS rescue_pct,
       retry_time_seconds / 60 AS retry_minutes
FROM nx_flaky_task_snapshots
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM nx_flaky_task_snapshots)
  AND range_days = 30
ORDER BY total_reruns DESC;
```

### Workspace KPIs over time

```sql
SELECT snapshot_date, range_days,
       active_flaky_tasks, total_reruns, total_rescues,
       ROUND(100.0 * total_rescues / NULLIF(total_reruns, 0), 1) AS rescue_pct
FROM nx_flaky_task_kpis
ORDER BY snapshot_date DESC;
```

### Exact "without retry" flake rate per workflow

```sql
SELECT
  r.workflow,
  COUNT(*)                                                      AS runs,
  SUM(CASE WHEN r.status='FAILED' THEN 1 ELSE 0 END)            AS observed_failed,
  SUM(CASE WHEN r.status='SUCCEEDED' AND s.successful_retries > 0 THEN 1 ELSE 0 END) AS rescued_by_retry,
  SUM(CASE WHEN r.status='FAILED' THEN 1 ELSE 0 END) +
    SUM(CASE WHEN r.status='SUCCEEDED' AND s.successful_retries > 0 THEN 1 ELSE 0 END) AS raw_failed
FROM runs r
LEFT JOIN nx_cipe_retry_stats s ON s.run_id = r.id
WHERE r.system='nx' AND r.created_at >= '2026-03-23T13:54:53Z'
GROUP BY r.workflow;
```

### Cache hit rate per workflow

```sql
SELECT
  r.workflow,
  COUNT(DISTINCT r.id) AS runs,
  ROUND(100.0 * SUM(s.cache_hits) / NULLIF(SUM(s.cache_hits + s.cache_misses), 0), 1) AS hit_pct,
  ROUND(AVG(s.cache_hits), 1)   AS avg_hits_per_run,
  ROUND(AVG(s.cache_misses), 1) AS avg_misses_per_run
FROM runs r
JOIN nx_cache_stats s ON s.run_id = r.id
WHERE r.system='nx' AND r.created_at >= '2026-03-23T13:54:53Z'
GROUP BY r.workflow;
```

### Real cost the NX cache saved per workflow

Values each cache-hit task by the avg duration of the *same task-id* when it
actually ran fresh elsewhere (cache-miss samples in `nx_run_tasks`). No
uniform-per-CIPE averaging — heavy targets like `sandbox`, `build`, and
`e2e-tests-dev` are priced by their own historical fresh-run duration rather
than blended with light misses like `fmt` or `check`.

The CTE `miss_profile_task` gives the per-task-id avg; `miss_profile_target`
is a fallback for task-ids that never missed in the DB (rare); a final 0
fallback means task-ids with zero miss samples contribute nothing.

```sql
WITH miss_profile_task AS (
  SELECT task_id, AVG(duration_ms) AS avg_ms
  FROM nx_run_tasks
  WHERE cache_status = 'cache-miss'
  GROUP BY task_id
),
miss_profile_target AS (
  SELECT target, AVG(duration_ms) AS avg_ms
  FROM nx_run_tasks
  WHERE cache_status = 'cache-miss'
  GROUP BY target
)
SELECT
  r.workflow,
  COUNT(DISTINCT r.id)                                                   AS runs,
  SUM(CASE WHEN t.cache_status LIKE '%cache-hit%' THEN 1 ELSE 0 END)     AS hit_tasks,
  SUM(CASE WHEN t.cache_status = 'cache-miss'   THEN 1 ELSE 0 END)       AS miss_tasks,
  ROUND(SUM(
    CASE WHEN t.cache_status LIKE '%cache-hit%' THEN
      (COALESCE(mt.avg_ms, tg.avg_ms, 0) / 60000.0)
        * t.credits_per_min * 0.0005
    ELSE 0 END
  ), 2) AS real_cost_saved_usd
FROM runs r
JOIN nx_run_tasks t ON t.run_id = r.id
LEFT JOIN miss_profile_task   mt ON mt.task_id = t.task_id
LEFT JOIN miss_profile_target tg ON tg.target  = t.target
WHERE r.system = 'nx' AND r.created_at >= '2026-03-23T13:54:53Z'
GROUP BY r.workflow;
```

### Cross-check: direct `hypotheticalNoCacheMs` → USD

NX Cloud exposes a direct time-savings field on the dashboard analysis
endpoint (`ciPipelineExecution.duration.hypotheticalNoCacheMs`). It's a
duration, not credits, so we convert with a per-CIPE weighted credit rate
pulled from `nx_run_tasks` cache-miss samples. If the derived and direct
numbers agree within ~10% the methodology is sound.

```sql
WITH cipe_rate AS (
  SELECT run_id,
         CAST(SUM(duration_ms * credits_per_min) AS REAL)
           / NULLIF(SUM(duration_ms), 0) AS weighted_rate
  FROM nx_run_tasks
  WHERE cache_status = 'cache-miss'
  GROUP BY run_id
)
SELECT r.workflow,
       COUNT(s.run_id) AS cipes_with_direct_value,
       ROUND(SUM(
         s.hypothetical_no_cache_ms / 60000.0
           * COALESCE(cr.weighted_rate, 60) * 0.0005
       ), 2) AS direct_cost_saved_usd
FROM runs r
JOIN nx_cipe_retry_stats s ON s.run_id = r.id
LEFT JOIN cipe_rate cr ON cr.run_id = r.id
WHERE r.system='nx' AND r.created_at >= '2026-03-23T13:54:53Z'
  AND s.hypothetical_no_cache_ms IS NOT NULL
GROUP BY r.workflow;
```

### NX cost broken down by agent template

```sql
SELECT tpl.template,
       COUNT(*) AS runs,
       SUM(tpl.credits) AS total_credits,
       ROUND(SUM(tpl.credits) * 0.0005, 2) AS total_usd,
       AVG(tpl.credit_multiplier) AS avg_multiplier
FROM nx_template_credits tpl
JOIN runs r ON tpl.run_id = r.id
WHERE r.workflow='normal:prs'
GROUP BY tpl.template
ORDER BY total_credits DESC;
```

### NX "if medium+" cost projection

Downgrades only `linux-browsers-js` to 15 credits/min; leaves `linux-js` alone.

```sql
SELECT r.id,
       SUM(
         CASE WHEN tpl.template='linux-browsers-js' AND tpl.credit_multiplier > 15
              THEN tpl.credits * 15.0 / tpl.credit_multiplier
              ELSE tpl.credits
         END
       ) + 500 AS medium_plus_credits
FROM runs r
LEFT JOIN nx_template_credits tpl ON tpl.run_id = r.id
WHERE r.system='nx' AND r.workflow='normal:prs'
GROUP BY r.id;
```

## Data provenance

| What                     | Source                                                                       |
| ------------------------ | ---------------------------------------------------------------------------- |
| CircleCI run list        | `GET /api/v2/insights/{proj}/workflows/{wf}`  (public, no token needed)      |
| CircleCI commit SHA      | `GET /api/v2/workflow/{id}` → pipeline → `vcs.revision`                      |
| CircleCI failed jobs     | `GET /api/v2/workflow/{id}/job` — filter `status='failed'`                   |
| NX pipeline executions   | `POST /nx-cloud/mcp-context/pipeline-executions/search`                      |
| NX run commands / tasks  | `POST /nx-cloud/mcp-context/runs/search` + `GET /runs/{id}`                  |
| NX exact credit breakdown | `GET /cipes/{cipeId}/analysis?runGroup={rg}` (Enterprise dashboard)          |
| NX flaky-task analytics  | `GET /orgs/{org}/workspaces/{ws}/analytics/flaky-tasks?range=N`              |
| NX per-task rescue count | `GET /orgs/{org}/workspaces/{ws}/analytics/flaky-tasks/{proj}/{tgt}?range=N` |

The two `analytics/*` endpoints are Enterprise-only and require the
`_nxCloudSession` cookie.

## Schema stability

Tables are created with `CREATE TABLE IF NOT EXISTS`. If you add a column,
either:

1. Add a `CREATE TABLE IF NOT EXISTS` for a new table, or
2. Add a guarded `ALTER TABLE ... ADD COLUMN` inside a `try/catch` in
   `initDB()` (see the existing `commit_sha` migration for an example).

To reset from scratch: `rm scripts/ci-eval.db && yarn jiti scripts/evaluate-ci.ts`.
