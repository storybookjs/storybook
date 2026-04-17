/**
 * Regenerate the inline constants in `nx-vs-circleci-findings.canvas.tsx` from
 * the SQLite cache. Canvas files must embed all data inline (no relative
 * imports per the canvas SDK), so instead of importing we rewrite the
 * constants in place.
 *
 * Usage:
 *   yarn jiti scripts/generate-canvas-data.ts
 *   yarn jiti scripts/generate-canvas-data.ts --since 2026-03-23T13:54:53Z
 *
 * The script:
 *  1. Queries `ci-eval.db` for workflow stats, paired-commit analysis,
 *     auto-retry analytics, and flake leaderboards.
 *  2. Serializes each result to a TypeScript object literal.
 *  3. Finds `const NAME: ... = { ... };` blocks in the canvas by name and
 *     replaces the value (keeping the type annotation intact).
 *
 * If the DB is empty or missing data, the constant is left untouched.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DB_PATH = join(import.meta.dirname, 'ci-eval.db');
const CANVAS_PATH = join(
  process.env.HOME!,
  '.cursor/projects/Users-kasperpeulen-cursor-worktrees-storybook-jafl/canvases/nx-vs-circleci-findings.canvas.tsx'
);

const NX_CREDITS_PER_CIPE = 500;
const NX_CREDIT_TO_USD = 0.0005;
const DOWNGRADE_TEMPLATES = new Set(['linux-browsers-js']);
const TARGET_RATE = 15;

// ─── Argument parsing ────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const sinceArg = args.includes('--since') ? args[args.indexOf('--since') + 1] : '2026-03-23T13:54:53Z';
const flakyRange = args.includes('--flaky-range')
  ? parseInt(args[args.indexOf('--flaky-range') + 1], 10)
  : 30;

// ─── DB helpers ──────────────────────────────────────────────────────────────

type Db = InstanceType<typeof DatabaseSync>;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

interface WorkflowStats {
  runs: number;
  passed: number;
  failed: number;
  flakeRate: number;
  avgDurSec: number;
  p50Sec: number;
  p90Sec: number;
  avgCost: number;
  totalCost: number;
  avgCostMP?: number;
  totalCostMP?: number;
  // NX only: CIPEs that succeeded because auto-retry rescued at least one task.
  // Without retry these would have failed — so rawFailed = failed + rescuedByRetry.
  rescuedByRetry?: number;
  rawFailed?: number;
  rawFlakeRate?: number;
  // NX only: total task-level retry attempts across all CIPEs in this workflow.
  // Lets us estimate retry compute cost.
  taskRetries?: number;
  // NX only: successful retries (sum of nx_cipe_retry_stats.successful_retries).
  // Usually > rescuedByRetry because one rescued CIPE can have multiple task rescues.
  successfulRetries?: number;
  // NX only: estimated USD spent on retry compute in this workflow.
  // Uses workspace-wide avg retry duration × agent credit rate × taskRetries.
  retryCostUsd?: number;
  // NX only: avg cost per run with retry compute subtracted.
  avgCostWithoutRetry?: number;
  // NX only: weighted avg cache hit rate across runs that have cache data
  // (excluding continuous serve/registry tasks which aren't cacheable).
  cacheHitRate?: number;
  cacheRuns?: number;
  // NX only: total USD that would have been spent without the cache.
  //
  // Derived by valuing each cache-hit task by the avg duration of the *same*
  // task-id when it actually ran fresh (cache-miss samples from nx_run_tasks),
  // then multiplying by that CIPE's credits/min. No cross-task averaging —
  // each cache-hit is priced by its own task-id's fresh-run history.
  costSavedByCacheUsd?: number;
}

/**
 * Companion cross-check value: cache savings sourced from NX Cloud's direct
 * `ciPipelineExecution.duration.hypotheticalNoCacheMs` field. Computed
 * alongside `costSavedByCacheUsd` but kept out of `WorkflowStats` because
 * it's noise in the canvas — same semantic, less-precise conversion (per-CIPE
 * weighted rate instead of true per-task accounting). Useful only for
 * methodology sanity-checks printed at generation time.
 */
interface CacheSavingsCrossCheck {
  derivedUsd: number | null;
  directUsd: number | null;
}

/** Populated as a side-effect of `computeWorkflowStats` for NX workflows. */
const cacheCrossCheck: Record<string, CacheSavingsCrossCheck> = {};

function computeWorkflowStats(
  db: Db,
  workflow: string,
  system: 'circleci' | 'nx',
  sinceIso: string
): WorkflowStats {
  const rows = db
    .prepare(
      `SELECT id, status, duration_sec, credits_used, cost_usd
       FROM runs WHERE workflow = ? AND system = ? AND created_at >= ?
       ORDER BY created_at DESC`
    )
    .all(workflow, system, sinceIso) as {
    id: string;
    status: string;
    duration_sec: number;
    credits_used: number;
    cost_usd: number;
  }[];

  const passed = rows.filter((r) => r.status === 'SUCCEEDED' || r.status === 'success').length;
  const failed = rows.filter((r) => r.status === 'FAILED' || r.status === 'failed').length;
  const durs = rows.map((r) => r.duration_sec).sort((a, b) => a - b);
  const totalCost = rows.reduce((s, r) => s + r.cost_usd, 0);

  const stats: WorkflowStats = {
    runs: rows.length,
    passed,
    failed,
    flakeRate: rows.length ? round(failed / rows.length * 100, 1) : 0,
    avgDurSec: rows.length ? Math.round(durs.reduce((a, b) => a + b, 0) / durs.length) : 0,
    p50Sec: Math.round(percentile(durs, 50)),
    p90Sec: Math.round(percentile(durs, 90)),
    avgCost: rows.length ? round(totalCost / rows.length, 2) : 0,
    totalCost: round(totalCost, 2),
  };

  if (system === 'nx' && rows.length > 0) {
    let totalMP = 0;
    const tplStmt = db.prepare(
      'SELECT template, credits, credit_multiplier FROM nx_template_credits WHERE run_id = ?'
    );
    for (const r of rows) {
      const tpls = tplStmt.all(r.id) as {
        template: string;
        credits: number;
        credit_multiplier: number;
      }[];
      if (tpls.length === 0) {
        totalMP += r.cost_usd;
      } else {
        let credits = NX_CREDITS_PER_CIPE;
        for (const t of tpls) {
          if (DOWNGRADE_TEMPLATES.has(t.template) && t.credit_multiplier > TARGET_RATE) {
            credits += (t.credits * TARGET_RATE) / t.credit_multiplier;
          } else {
            credits += t.credits;
          }
        }
        totalMP += credits * NX_CREDIT_TO_USD;
      }
    }
    stats.avgCostMP = round(totalMP / rows.length, 2);
    stats.totalCostMP = round(totalMP, 2);

    // Exact without-retry failure count: count SUCCEEDED CIPEs whose retry stats
    // show at least one successful task-retry. Those CIPEs would have failed
    // had retry been disabled.
    const rescued = db
      .prepare(
        `SELECT COUNT(*) AS n FROM runs r
           JOIN nx_cipe_retry_stats s ON s.run_id = r.id
          WHERE r.system = 'nx' AND r.workflow = ? AND r.created_at >= ?
            AND r.status = 'SUCCEEDED' AND s.successful_retries > 0`
      )
      .get(workflow, sinceIso) as { n: number };

    const retryTotals = db
      .prepare(
        `SELECT
           SUM(s.total_task_retries) AS task_retries,
           SUM(s.successful_retries) AS succ_retries
         FROM runs r JOIN nx_cipe_retry_stats s ON s.run_id = r.id
         WHERE r.system = 'nx' AND r.workflow = ? AND r.created_at >= ?`
      )
      .get(workflow, sinceIso) as { task_retries: number | null; succ_retries: number | null };

    stats.rescuedByRetry = rescued.n;
    stats.rawFailed = stats.failed + rescued.n;
    stats.rawFlakeRate = rows.length ? round((stats.rawFailed / rows.length) * 100, 1) : 0;
    stats.taskRetries = retryTotals.task_retries ?? 0;
    stats.successfulRetries = retryTotals.succ_retries ?? 0;

    // Estimate retry compute cost: task_retries * avg retry duration * credit rate.
    // Workspace-wide weighted avg retry duration ≈ 146s/retry (total retry seconds
    // / total retries from flaky-task analytics). PR/merged branches use the
    // default 60 credits/min on both linux-js and linux-browsers-js.
    const AVG_RETRY_SEC = 146;
    const AVG_CREDITS_PER_MIN = 60;
    const retryCredits =
      (stats.taskRetries * AVG_RETRY_SEC * AVG_CREDITS_PER_MIN) / 60 + 0; // minutes * credits/min
    stats.retryCostUsd = round(retryCredits * NX_CREDIT_TO_USD, 2);
    stats.avgCostWithoutRetry = round(stats.avgCost - stats.retryCostUsd / rows.length, 2);

    // Cache hit rate (unchanged — still from nx_cache_stats, one row per CIPE).
    const cacheAgg = db
      .prepare(
        `SELECT
           COUNT(DISTINCT s.run_id) AS runs,
           SUM(s.cache_hits)   AS hits,
           SUM(s.cache_misses) AS misses
         FROM runs r JOIN nx_cache_stats s ON s.run_id = r.id
         WHERE r.system = 'nx' AND r.workflow = ? AND r.created_at >= ?`
      )
      .get(workflow, sinceIso) as {
      runs: number;
      hits: number | null;
      misses: number | null;
    };

    if (cacheAgg.runs > 0) {
      const hits = cacheAgg.hits ?? 0;
      const misses = cacheAgg.misses ?? 0;
      stats.cacheRuns = cacheAgg.runs;
      stats.cacheHitRate = hits + misses > 0 ? round((hits / (hits + misses)) * 100, 1) : 0;
    }

    // Real per-CIPE cache savings, derived from per-task data in nx_run_tasks.
    //
    // Each cache-hit task is priced as if it had run fresh: avg duration of
    // *the same task-id* across cache-miss observations × this CIPE's actual
    // credits/min. No uniform-per-CIPE averaging — heavy cache-hit tasks
    // (sandbox/build/e2e) are correctly valued by their own fresh-run
    // duration, not blended with light misses (fmt/check).
    //
    // IMPORTANT: the miss profile is scoped to the *same workflow* as the
    // cache-hit. Measurements show test-runner, sandbox, etc. have
    // materially different fresh-run durations on `next:merged` vs
    // `normal:prs` (test-runner 89s vs 124s), so a global miss average
    // produces a ~45% over-count on next:merged and a much larger gap vs
    // NX's own `hypotheticalNoCacheMs` field.
    //
    // Fallback chain for the fresh-run duration:
    //   1. miss-avg for this task-id within THIS workflow
    //   2. miss-avg for this task-id across ALL workflows
    //   3. miss-avg for this target within THIS workflow
    //   4. miss-avg for this target across ALL workflows
    //   5. 0 (rare — task-ids never observed missing anywhere)
    const savedRow = db
      .prepare(
        `WITH miss_task_wf AS (
           SELECT r.workflow, t.task_id, AVG(t.duration_ms) AS avg_ms
           FROM runs r JOIN nx_run_tasks t ON t.run_id = r.id
           WHERE r.system = 'nx' AND t.cache_status = 'cache-miss'
           GROUP BY r.workflow, t.task_id
         ),
         miss_task_global AS (
           SELECT task_id, AVG(duration_ms) AS avg_ms
           FROM nx_run_tasks WHERE cache_status = 'cache-miss'
           GROUP BY task_id
         ),
         miss_target_wf AS (
           SELECT r.workflow, t.target, AVG(t.duration_ms) AS avg_ms
           FROM runs r JOIN nx_run_tasks t ON t.run_id = r.id
           WHERE r.system = 'nx' AND t.cache_status = 'cache-miss'
           GROUP BY r.workflow, t.target
         ),
         miss_target_global AS (
           SELECT target, AVG(duration_ms) AS avg_ms
           FROM nx_run_tasks WHERE cache_status = 'cache-miss'
           GROUP BY target
         )
         SELECT
           SUM(
             CASE WHEN t.cache_status LIKE '%cache-hit%' THEN
               (COALESCE(
                  mtw.avg_ms, mtg.avg_ms,
                  mgw.avg_ms, mgg.avg_ms,
                  0
                ) / 60000.0)
                 * t.credits_per_min
                 * ${NX_CREDIT_TO_USD}
             ELSE 0 END
           ) AS saved_usd,
           COUNT(DISTINCT t.run_id) AS runs_with_tasks
         FROM runs r
         JOIN nx_run_tasks t ON t.run_id = r.id
         LEFT JOIN miss_task_wf     mtw ON mtw.workflow = r.workflow AND mtw.task_id = t.task_id
         LEFT JOIN miss_task_global mtg ON mtg.task_id = t.task_id
         LEFT JOIN miss_target_wf   mgw ON mgw.workflow = r.workflow AND mgw.target = t.target
         LEFT JOIN miss_target_global mgg ON mgg.target = t.target
         WHERE r.system = 'nx' AND r.workflow = ? AND r.created_at >= ?`
      )
      .get(workflow, sinceIso) as {
      saved_usd: number | null;
      runs_with_tasks: number | null;
    };

    const derivedUsd = (savedRow.runs_with_tasks ?? 0) > 0 ? round(savedRow.saved_usd ?? 0, 2) : null;
    if (derivedUsd != null) stats.costSavedByCacheUsd = derivedUsd;

    // Cross-check against NX Cloud's direct
    // `ciPipelineExecution.duration.hypotheticalNoCacheMs` field. This is a
    // DURATION (total task-ms saved), so we convert to credits via a
    // per-CIPE weighted rate from nx_run_tasks cache-miss samples. Falls
    // back to 60 credits/min (extra_large+) if no miss samples exist.
    const directRow = db
      .prepare(
        `WITH cipe_rate AS (
           SELECT run_id,
                  CAST(SUM(duration_ms * credits_per_min) AS REAL)
                    / NULLIF(SUM(duration_ms), 0) AS weighted_rate
           FROM nx_run_tasks
           WHERE cache_status = 'cache-miss'
           GROUP BY run_id
         )
         SELECT SUM(
           s.hypothetical_no_cache_ms / 60000.0
             * COALESCE(cr.weighted_rate, 60)
             * ${NX_CREDIT_TO_USD}
         ) AS saved_usd
         FROM runs r
         JOIN nx_cipe_retry_stats s ON s.run_id = r.id
         LEFT JOIN cipe_rate cr ON cr.run_id = r.id
         WHERE r.system = 'nx' AND r.workflow = ? AND r.created_at >= ?
           AND s.hypothetical_no_cache_ms IS NOT NULL`
      )
      .get(workflow, sinceIso) as { saved_usd: number | null };

    const directUsd = (directRow.saved_usd ?? 0) > 0 ? round(directRow.saved_usd ?? 0, 2) : null;

    cacheCrossCheck[workflow] = { derivedUsd, directUsd };
  }

  return stats;
}

interface PairedAnalysis {
  commits: number;
  bothPassed: number;
  bothFailed: number;
  onlyCCIFailed: number;
  onlyNXFailed: number;
}

function computePaired(db: Db, workflow: string, sinceIso: string): PairedAnalysis {
  const rows = db
    .prepare(
      `SELECT DISTINCT c.commit_sha AS sha, c.status AS cst, n.status AS nst
       FROM runs c JOIN runs n ON c.commit_sha = n.commit_sha
       WHERE c.workflow = ? AND c.system = 'circleci' AND c.created_at >= ?
         AND n.workflow = ? AND n.system = 'nx' AND n.created_at >= ?
         AND c.commit_sha IS NOT NULL`
    )
    .all(workflow, sinceIso, workflow, sinceIso) as { sha: string; cst: string; nst: string }[];

  // Dedupe by commit (take first hit per commit).
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    if (seen.has(r.sha)) return false;
    seen.add(r.sha);
    return true;
  });

  return {
    commits: unique.length,
    bothPassed: unique.filter((r) => r.cst === 'success' && r.nst === 'SUCCEEDED').length,
    bothFailed: unique.filter((r) => r.cst === 'failed' && r.nst === 'FAILED').length,
    onlyCCIFailed: unique.filter((r) => r.cst === 'failed' && r.nst === 'SUCCEEDED').length,
    onlyNXFailed: unique.filter((r) => r.cst === 'success' && r.nst === 'FAILED').length,
  };
}

interface RetryData {
  totalReruns: number;
  totalRescues: number;
  retryTimeMinutes: number;
  activeFlakyTasks: number;
  topTasks: { task: string; reruns: number; rescues: number; retryMin: number }[];
}

function computeRetryData(db: Db, rangeDays: number): RetryData | null {
  const kpi = db
    .prepare(
      `SELECT * FROM nx_flaky_task_kpis WHERE range_days = ? ORDER BY snapshot_date DESC LIMIT 1`
    )
    .get(rangeDays) as
    | {
        snapshot_date: string;
        total_reruns: number;
        total_rescues: number;
        retry_time_seconds: number;
        active_flaky_tasks: number;
      }
    | undefined;

  if (!kpi) return null;

  const tasks = db
    .prepare(
      `SELECT project, target, total_reruns, total_rescues, retry_time_seconds
       FROM nx_flaky_task_snapshots
       WHERE snapshot_date = ? AND range_days = ?
       ORDER BY total_reruns DESC`
    )
    .all(kpi.snapshot_date, rangeDays) as {
    project: string;
    target: string;
    total_reruns: number;
    total_rescues: number;
    retry_time_seconds: number;
  }[];

  return {
    totalReruns: kpi.total_reruns,
    totalRescues: kpi.total_rescues,
    retryTimeMinutes: Math.round(kpi.retry_time_seconds / 60),
    activeFlakyTasks: kpi.active_flaky_tasks,
    topTasks: tasks.map((t) => ({
      task: `${t.project}:${t.target}`,
      reruns: t.total_reruns,
      rescues: t.total_rescues,
      retryMin: Math.round(t.retry_time_seconds / 60),
    })),
  };
}

function computeTopFlaky(
  db: Db,
  workflow: string,
  system: 'circleci' | 'nx',
  sinceIso: string,
  limit = 10
): { task: string; fails: number }[] {
  const rows = db
    .prepare(
      `SELECT ft.task_name AS task, COUNT(*) AS fails
       FROM failed_tasks ft JOIN runs r ON ft.run_id = r.id
       WHERE r.workflow = ? AND r.system = ? AND r.created_at >= ?
       GROUP BY ft.task_name
       ORDER BY fails DESC, task ASC
       LIMIT ?`
    )
    .all(workflow, system, sinceIso, limit) as { task: string; fails: number }[];
  return rows;
}

function computeCCIOnlyJobs(
  db: Db,
  workflow: string,
  sinceIso: string
): { job: string; fails: number; reason: string }[] {
  const rows = db
    .prepare(
      `SELECT ft.task_name AS task, COUNT(*) AS fails
       FROM failed_tasks ft JOIN runs r ON ft.run_id = r.id
       WHERE r.workflow = ? AND r.system = 'circleci' AND r.created_at >= ?
       GROUP BY ft.task_name`
    )
    .all(workflow, sinceIso) as { task: string; fails: number }[];

  const buckets: Record<string, { fails: number; reason: string }> = {
    '*---chromatic (per-sandbox)': { fails: 0, reason: 'Chromatic disabled on NX side' },
    'benchmark-packages': { fails: 0, reason: 'Benchmark target disabled on NX' },
    'eslint---oxfmt-validation / ---prettier-validation': {
      fails: 0,
      reason: 'CCI-specific eslint sub-jobs',
    },
  };

  for (const r of rows) {
    if (r.task.includes('chromatic')) buckets['*---chromatic (per-sandbox)'].fails += r.fails;
    else if (r.task === 'benchmark-packages') buckets['benchmark-packages'].fails += r.fails;
    else if (r.task.startsWith('eslint---'))
      buckets['eslint---oxfmt-validation / ---prettier-validation'].fails += r.fails;
  }

  return Object.entries(buckets)
    .filter(([, v]) => v.fails > 0)
    .map(([job, { fails, reason }]) => ({ job, fails, reason }));
}

function round(n: number, digits = 2): number {
  const m = Math.pow(10, digits);
  return Math.round(n * m) / m;
}

// ─── Object literal serialization ────────────────────────────────────────────

/** Serialize a JS value to a TypeScript object literal with stable key order. */
function serialize(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);
  const innerPad = '  '.repeat(indent + 1);

  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const inner = value.map((v) => innerPad + serialize(v, indent + 1)).join(',\n');
    return `[\n${inner},\n${pad}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const inner = entries
      .map(([k, v]) => `${innerPad}${k}: ${serialize(v, indent + 1)}`)
      .join(',\n');
    return `{\n${inner},\n${pad}}`;
  }
  return 'undefined';
}

// ─── Canvas rewrite ──────────────────────────────────────────────────────────

/**
 * Replace the value of `const NAME: ... = <value>;` in `src`. Matches the
 * first `{` or `[` after `= ` and finds its balanced close while ignoring
 * characters inside string literals. Returns unchanged `src` if `NAME` is
 * not found.
 */
function replaceConstValue(src: string, name: string, newLiteral: string): string {
  // Match both `const NAME:` (typed) and `const NAME =` (inferred).
  const typedIdx = src.indexOf(`const ${name}:`);
  const inferredIdx = src.indexOf(`const ${name} =`);
  const declIdx =
    typedIdx !== -1 && (inferredIdx === -1 || typedIdx < inferredIdx) ? typedIdx : inferredIdx;
  if (declIdx === -1) {
    console.warn(`  ⚠ const ${name} not found — skipped`);
    return src;
  }

  // Find `= ` after the declaration.
  const eqIdx = src.indexOf('=', declIdx);
  if (eqIdx === -1) return src;

  // Find the first `{` or `[` after `=`.
  let valueStart = eqIdx + 1;
  while (valueStart < src.length && src[valueStart] !== '{' && src[valueStart] !== '[') {
    valueStart++;
  }
  if (valueStart >= src.length) return src;

  const open = src[valueStart];
  const close = open === '{' ? '}' : ']';

  // Walk forward matching balanced braces, skipping string literals.
  let depth = 1;
  let i = valueStart + 1;
  let inString: string | null = null;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (inString) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === inString) inString = null;
    } else {
      if (c === '"' || c === "'" || c === '`') inString = c;
      else if (c === open) depth++;
      else if (c === close) depth--;
    }
    i++;
  }
  if (depth !== 0) throw new Error(`unbalanced braces after const ${name}`);

  const valueEnd = i; // position just past the closing brace
  return src.slice(0, valueStart) + newLiteral + src.slice(valueEnd);
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const db = new DatabaseSync(DB_PATH);

  console.log(`Reading from ${DB_PATH}`);
  console.log(`Since:        ${sinceArg}`);
  console.log(`Flaky range:  ${flakyRange}d\n`);

  const nextMerged = {
    circleci: computeWorkflowStats(db, 'next:merged', 'circleci', sinceArg),
    nx: computeWorkflowStats(db, 'next:merged', 'nx', sinceArg),
  };
  const normalPrs = {
    circleci: computeWorkflowStats(db, 'normal:prs', 'circleci', sinceArg),
    nx: computeWorkflowStats(db, 'normal:prs', 'nx', sinceArg),
  };
  const pairedNext = computePaired(db, 'next:merged', sinceArg);
  const pairedPrs = computePaired(db, 'normal:prs', sinceArg);
  const retryData = computeRetryData(db, flakyRange);
  const topFlakyPrs = {
    circleci: computeTopFlaky(db, 'normal:prs', 'circleci', sinceArg),
    nx: computeTopFlaky(db, 'normal:prs', 'nx', sinceArg),
  };
  const cciOnlyJobs = computeCCIOnlyJobs(db, 'normal:prs', sinceArg);

  console.log(`Computed:`);
  console.log(`  next:merged — CCI ${nextMerged.circleci.runs} runs, NX ${nextMerged.nx.runs} runs`);
  console.log(`  normal:prs  — CCI ${normalPrs.circleci.runs} runs, NX ${normalPrs.nx.runs} runs`);
  console.log(`  paired      — ${pairedPrs.commits} on PRs, ${pairedNext.commits} on next:merged`);
  console.log(
    `  retry data  — ${retryData ? `${retryData.totalRescues}/${retryData.totalReruns} rescues` : 'no snapshot found'}`
  );
  console.log(
    `  top flaky   — ${topFlakyPrs.circleci.length} CCI tasks, ${topFlakyPrs.nx.length} NX tasks`
  );
  console.log(`  CCI-only    — ${cciOnlyJobs.length} job categories\n`);

  // Cross-check real (derived) vs direct cache savings. Derived value is
  // what ships into the canvas; the direct `hypotheticalNoCacheMs` value is
  // shown for methodology sanity only.
  console.log(`Cache savings cross-check (derived vs direct NX field):`);
  for (const workflow of ['next:merged', 'normal:prs']) {
    const { derivedUsd: d, directUsd: x } = cacheCrossCheck[workflow] ?? {};
    if (d == null || x == null) {
      console.log(
        `  ${workflow.padEnd(12)} — ${d == null ? 'no derived' : 'no direct'} value (backfill may be incomplete)`
      );
      continue;
    }
    const pct = (Math.abs(x - d) / Math.max(d, 1)) * 100;
    const flag = pct > 10 ? ' ⚠ delta >10%' : '';
    console.log(
      `  ${workflow.padEnd(12)} derived $${d.toFixed(2)}  direct $${x.toFixed(2)}  Δ${pct.toFixed(1)}%${flag}`
    );
  }
  console.log('');

  db.close();

  console.log(`Rewriting ${CANVAS_PATH}`);
  let canvas = readFileSync(CANVAS_PATH, 'utf-8');

  canvas = replaceConstValue(canvas, 'NEXT_MERGED', serialize(nextMerged));
  canvas = replaceConstValue(canvas, 'NORMAL_PRS', serialize(normalPrs));
  canvas = replaceConstValue(canvas, 'PAIRED_NEXT', serialize(pairedNext));
  canvas = replaceConstValue(canvas, 'PAIRED_PRS', serialize(pairedPrs));
  if (retryData) {
    canvas = replaceConstValue(canvas, 'NX_AUTORETRIES_30D', serialize(retryData));
  }
  canvas = replaceConstValue(canvas, 'TOP_FLAKY_PRS', serialize(topFlakyPrs));
  canvas = replaceConstValue(canvas, 'CCI_ONLY_JOBS', serialize(cciOnlyJobs));

  writeFileSync(CANVAS_PATH, canvas);
  console.log('Done.');
}

main();
