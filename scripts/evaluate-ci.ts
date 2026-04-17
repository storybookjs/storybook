/**
 * CI Evaluation Script: NX Cloud vs CircleCI
 *
 * Compares flakiness, speed, and cost across evaluation branches.
 * Caches all run data in a local SQLite database for fast re-runs.
 *
 * Required env vars:
 *   CIRCLE_TOKEN          — CircleCI personal API token
 *   NX_CLOUD_ACCESS_TOKEN — NX Cloud CI access token (from nx.json or env)
 *   NX_CLOUD_SESSION      — _nxCloudSession cookie value (for exact credit data)
 *
 * Optional env vars:
 *   NX_CLOUD_PAT — NX Cloud Personal Access Token (from ~/.config/nxcloud/nxcloud.ini)
 *
 * Usage:
 *   yarn jiti scripts/evaluate-ci.ts                          # last 14 days
 *   yarn jiti scripts/evaluate-ci.ts --days 30                # last 30 days
 *   yarn jiti scripts/evaluate-ci.ts --since 2026-03-23       # since specific date
 *   yarn jiti scripts/evaluate-ci.ts --workflow normal --days 7
 *   yarn jiti scripts/evaluate-ci.ts --report-only            # no API calls
 *   yarn jiti scripts/evaluate-ci.ts --show-runs              # per-run table
 *   yarn jiti scripts/evaluate-ci.ts --flaky-range 7          # flaky analytics window (default 30)
 *   yarn jiti scripts/evaluate-ci.ts --skip-flaky-analytics
 *
 * The --days / --since flags give both CI systems the same time window, so
 * flake/speed/cost comparisons are apples-to-apples. Both systems paginate until
 * they hit a run older than the cutoff.
 *
 * Sync is fully incremental:
 *  - Runs are keyed by id; re-syncing a known run is a no-op.
 *  - Flaky-task analytics are snapshotted once per calendar day per --flaky-range;
 *    running the sync again the same day doesn't hit the dashboard endpoints.
 *
 * See scripts/ci-eval.db.README.md for the full schema and example SQL queries.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error - no type declarations for ini
import { parse as parseIni } from 'ini';
import { parse as parseYaml } from 'yaml';
import { DatabaseSync } from 'node:sqlite';

// ─── Configuration ───────────────────────────────────────────────────────────

const CIRCLECI_PROJECT = 'gh/storybookjs/storybook';
const NX_CLOUD_URL = 'https://cloud.nx.app';
const NX_CLOUD_ID = '6929fbef73e98d8094d2a343';
const NX_CLOUD_ORG_ID = '606dcb5cdc2a2b00059cc0e9';

const WORKSPACE_ROOT = join(import.meta.dirname, '..');
const DB_PATH = join(import.meta.dirname, 'ci-eval.db');

const EVAL_BRANCHES: Record<string, string[]> = {
  normal: ['kasper/nx-eval-normal'],
  merged: ['kasper/nx-eval-merged'],
  daily: ['kasper/nx-eval-daily-1', 'kasper/nx-eval-daily-2'],
  'base (nx-ai)': ['kasper/nx-ai'],
  'next:merged': ['next'],
  'next:daily': ['next'],
  // Wild-branches workflows: query every branch (empty array = no filter) and
  // drop anything on our experiment/eval branches post-fetch. Used to measure
  // regular PR CI where the default extra_large+ agents are still in effect.
  'normal:prs': [],
  'merged:prs': [],
  'daily:prs': [],
};

const WORKFLOW_NAMES: Record<string, string> = {
  normal: 'normal-generated',
  merged: 'merged-generated',
  daily: 'daily-generated',
  'base (nx-ai)': 'daily-generated',
  'next:merged': 'merged-generated',
  'next:daily': 'daily-generated',
  'normal:prs': 'normal-generated',
  'merged:prs': 'merged-generated',
  'daily:prs': 'daily-generated',
};

/**
 * Branches whose NX config already downgrades linux-browsers-js to medium+.
 * Used by the `*:prs` wild-branch workflows to keep only PRs that use the
 * default extra_large+ agents.
 *
 * NX CIPEs record the branch as the PR number for PRs, so both the branch
 * names (used by CircleCI) and the corresponding PR numbers are listed.
 */
const MEDIUM_PLUS_BRANCHES = new Set([
  'next', // next itself still uses extra_large+, but we have dedicated next:* workflows
  'kasper/nx-ai',
  'kasper/nx-port',
  'kasper/nx-eval-normal',
  'kasper/nx-eval-merged',
  'kasper/nx-eval-daily-1',
  'kasper/nx-eval-daily-2',
  // PR numbers for the above branches (NX reports these in item.branch)
  '34282', // kasper/nx-ai
  '34568', // kasper/nx-port
  '34562', // kasper/nx-eval-normal
  '34563', // kasper/nx-eval-merged
  '34564', // kasper/nx-eval-daily-1
  '34565', // kasper/nx-eval-daily-2
]);

// ─── Pricing ─────────────────────────────────────────────────────────────────

const CIRCLECI_CREDIT_TO_USD = 0.0006;
const NX_CREDIT_TO_USD = 0.0005;
const NX_CREDITS_PER_CIPE = 500;

const NX_RESOURCE_CLASS_CREDITS: Record<string, number> = {
  'docker_linux_amd64/small': 5,
  'docker_linux_amd64/medium': 10,
  'docker_linux_amd64/medium+': 15,
  'docker_linux_amd64/large': 20,
  'docker_linux_amd64/large+': 30,
  'docker_linux_amd64/extra_large': 40,
  'docker_linux_amd64/extra_large+': 60,
  'docker_linux_arm64/medium': 13,
  'docker_linux_arm64/large': 26,
  'docker_linux_arm64/extra_large': 52,
  'docker_windows/medium': 40,
};

function loadNxAgentCreditsPerMin(): Record<string, number> {
  const agentsPath = join(WORKSPACE_ROOT, '.nx/workflows/agents.yaml');
  const yaml = parseYaml(readFileSync(agentsPath, 'utf-8'));
  const templates = yaml['launch-templates'] ?? {};
  const result: Record<string, number> = {};

  for (const [name, config] of Object.entries(templates) as [string, any][]) {
    const resourceClass: string = config['resource-class'] ?? '';
    const credits = NX_RESOURCE_CLASS_CREDITS[resourceClass];
    if (credits) {
      result[name] = credits;
    } else {
      console.warn(
        `  ⚠ Unknown resource class "${resourceClass}" for launch template "${name}", defaulting to 15 credits/min`
      );
      result[name] = 15;
    }
  }

  return result;
}

// ─── SQLite Database ─────────────────────────────────────────────────────────

function initDB() {
  const db = new DatabaseSync(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      system TEXT NOT NULL,
      workflow TEXT NOT NULL,
      branch TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      duration_sec REAL NOT NULL,
      credits_used INTEGER NOT NULL,
      cost_usd REAL NOT NULL,
      commit_sha TEXT
    );`);

  // Migration: add commit_sha column to existing databases
  try {
    db.exec(`ALTER TABLE runs ADD COLUMN commit_sha TEXT`);
  } catch {}

  // Migration: add hypothetical_no_cache_ms to nx_cipe_retry_stats. This is the
  // direct `ciPipelineExecution.duration.hypotheticalNoCacheMs` field from the
  // dashboard analysis endpoint — the ms that cache-hit tasks would have taken
  // if they had run fresh. Stored alongside retry stats because we fetch both
  // from the same endpoint in the same HTTP round-trip. Used as a cross-check
  // against the per-task derivation in nx_run_tasks.
  try {
    db.exec(
      `ALTER TABLE nx_cipe_retry_stats ADD COLUMN hypothetical_no_cache_ms INTEGER`
    );
  } catch {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS failed_tasks (
      run_id TEXT NOT NULL,
      task_name TEXT NOT NULL,
      FOREIGN KEY (run_id) REFERENCES runs(id)
    );
    CREATE TABLE IF NOT EXISTS nx_template_credits (
      run_id TEXT NOT NULL,
      template TEXT NOT NULL,
      credits INTEGER NOT NULL,
      credit_multiplier INTEGER NOT NULL,
      FOREIGN KEY (run_id) REFERENCES runs(id)
    );
    -- Per-CIPE retry data from ttgImpactMetadata.taskRetryStats on the dashboard
    -- analysis endpoint. Lets us compute exact "without retry" failure counts
    -- instead of proportional scaling from workspace-wide totals.
    CREATE TABLE IF NOT EXISTS nx_cipe_retry_stats (
      run_id TEXT PRIMARY KEY,
      total_tasks INTEGER NOT NULL,
      total_task_retries INTEGER NOT NULL,
      successful_retries INTEGER NOT NULL,
      failed_retries INTEGER NOT NULL,
      hypothetical_no_cache_ms INTEGER,
      FOREIGN KEY (run_id) REFERENCES runs(id)
    );
    -- Per-CIPE cache hit counts from the run detail endpoint. Continuous
    -- tasks (serve/run-registry) are excluded because they aren't cacheable.
    CREATE TABLE IF NOT EXISTS nx_cache_stats (
      run_id TEXT PRIMARY KEY,
      cache_hits INTEGER NOT NULL,
      cache_misses INTEGER NOT NULL,
      total_tasks INTEGER NOT NULL,
      FOREIGN KEY (run_id) REFERENCES runs(id)
    );
    -- Per-task detail from /runs/{runId}. One row per (run_id, task_id),
    -- excludes continuous serve/run-registry tasks. Used to compute real
    -- per-CIPE cache savings: value each cache-hit task by the avg duration
    -- of the same task-id when it actually ran fresh (cache-miss samples).
    CREATE TABLE IF NOT EXISTS nx_run_tasks (
      run_id          TEXT    NOT NULL,
      task_id         TEXT    NOT NULL,
      project         TEXT    NOT NULL,
      target          TEXT    NOT NULL,
      duration_ms     INTEGER NOT NULL,
      cache_status    TEXT    NOT NULL,   -- 'cache-miss', 'local-cache-hit', 'remote-cache-hit'
      agent_template  TEXT    NOT NULL,   -- 'linux-js' | 'linux-browsers-js'
      credits_per_min INTEGER NOT NULL,   -- 60 on extra_large+, 15 on medium+; captured per-CIPE
      PRIMARY KEY (run_id, task_id),
      FOREIGN KEY (run_id) REFERENCES runs(id)
    );
    CREATE INDEX IF NOT EXISTS idx_nx_run_tasks_task_id ON nx_run_tasks(task_id);
    CREATE INDEX IF NOT EXISTS idx_nx_run_tasks_run_id ON nx_run_tasks(run_id);
    -- One row per (sync date, time range, task). Snapshots are daily; re-running
    -- the sync on the same day is a no-op for these tables.
    CREATE TABLE IF NOT EXISTS nx_flaky_task_snapshots (
      snapshot_date TEXT NOT NULL,
      range_days INTEGER NOT NULL,
      window_start TEXT NOT NULL,
      window_end TEXT NOT NULL,
      project TEXT NOT NULL,
      target TEXT NOT NULL,
      configuration TEXT NOT NULL,
      total_reruns INTEGER NOT NULL,
      total_rescues INTEGER NOT NULL,
      total_executions INTEGER NOT NULL,
      total_flaky_hashes INTEGER,
      retry_time_seconds INTEGER,
      avg_time_consumed_ms REAL,
      flakiness_rate REAL,
      impact_score REAL,
      last_failure_time TEXT,
      PRIMARY KEY (snapshot_date, range_days, project, target, configuration)
    );
    CREATE TABLE IF NOT EXISTS nx_flaky_task_kpis (
      snapshot_date TEXT NOT NULL,
      range_days INTEGER NOT NULL,
      window_start TEXT NOT NULL,
      window_end TEXT NOT NULL,
      active_flaky_tasks INTEGER,
      proportion_tasks_flaky_pct REAL,
      high_risk_tasks INTEGER,
      total_reruns INTEGER,
      total_rescues INTEGER,
      retry_time_seconds INTEGER,
      PRIMARY KEY (snapshot_date, range_days)
    );
    CREATE INDEX IF NOT EXISTS idx_runs_system_workflow ON runs(system, workflow);
    CREATE INDEX IF NOT EXISTS idx_failed_tasks_run_id ON failed_tasks(run_id);
    CREATE INDEX IF NOT EXISTS idx_nx_template_credits_run_id ON nx_template_credits(run_id);
    CREATE INDEX IF NOT EXISTS idx_flaky_snapshots_date ON nx_flaky_task_snapshots(snapshot_date, range_days);
  `);

  return db;
}

function dbInsertRun(
  db: InstanceType<typeof DatabaseSync>,
  system: string,
  workflow: string,
  branch: string,
  run: CIRun
) {
  const insertRun = db.prepare(
    `INSERT OR IGNORE INTO runs (id, system, workflow, branch, status, created_at, duration_sec, credits_used, cost_usd, commit_sha)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertRun.run(
    run.id,
    system,
    workflow,
    branch,
    run.status,
    run.createdAt,
    run.durationSec,
    run.creditsUsed,
    run.costUsd,
    run.commitSha ?? null
  );

  if (run.failedJobs.length > 0) {
    const insertTask = db.prepare(`INSERT INTO failed_tasks (run_id, task_name) VALUES (?, ?)`);
    for (const task of run.failedJobs) {
      insertTask.run(run.id, task);
    }
  }

  if (run.nxPerTemplate && run.nxResourceClasses) {
    const insertCredit = db.prepare(
      `INSERT INTO nx_template_credits (run_id, template, credits, credit_multiplier) VALUES (?, ?, ?, ?)`
    );
    for (const [tmpl, credits] of Object.entries(run.nxPerTemplate)) {
      const multiplier = run.nxResourceClasses[tmpl] ?? 0;
      insertCredit.run(run.id, tmpl, credits, multiplier);
    }
  }
}

function dbGetExistingIds(
  db: InstanceType<typeof DatabaseSync>,
  system: string,
  workflow: string
): Set<string> {
  const rows = db
    .prepare(`SELECT id FROM runs WHERE system = ? AND workflow = ?`)
    .all(system, workflow) as { id: string }[];
  return new Set(rows.map((r) => r.id));
}

function dbGetRuns(
  db: InstanceType<typeof DatabaseSync>,
  system: string,
  workflow: string
): CIRun[] {
  const rows = db
    .prepare(
      `SELECT id, status, created_at, duration_sec, credits_used, cost_usd, commit_sha
       FROM runs WHERE system = ? AND workflow = ? ORDER BY created_at ASC`
    )
    .all(system, workflow) as any[];

  return rows.map((row) => {
    const failedRows = db
      .prepare(`SELECT task_name FROM failed_tasks WHERE run_id = ?`)
      .all(row.id) as { task_name: string }[];

    const creditRows = db
      .prepare(
        `SELECT template, credits, credit_multiplier FROM nx_template_credits WHERE run_id = ?`
      )
      .all(row.id) as { template: string; credits: number; credit_multiplier: number }[];

    const nxPerTemplate: Record<string, number> = {};
    const nxResourceClasses: Record<string, number> = {};
    for (const cr of creditRows) {
      nxPerTemplate[cr.template] = cr.credits;
      nxResourceClasses[cr.template] = cr.credit_multiplier;
    }

    return {
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      durationSec: row.duration_sec,
      creditsUsed: row.credits_used,
      costUsd: row.cost_usd,
      commitSha: row.commit_sha ?? undefined,
      failedJobs: failedRows.map((r) => r.task_name),
      ...(creditRows.length > 0 ? { nxPerTemplate, nxResourceClasses } : {}),
    };
  });
}

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * CircleCI v2 API. The Insights endpoint is public for open source projects
 * (storybookjs is public), so no token is needed for it. Per-run details
 * (`/workflow/:id`, `/pipeline/:id`) require auth — those lookups silently fall
 * back to no-op on 401, so missing tokens degrade gracefully.
 */
function getCircleToken(): string | undefined {
  const token = process.env.CIRCLE_TOKEN;
  return token && token.length > 0 ? token : undefined;
}

function getNxCloudHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Nx-Cloud-Id': NX_CLOUD_ID,
  };

  const accessToken = process.env.NX_CLOUD_ACCESS_TOKEN;
  if (accessToken) headers['Authorization'] = accessToken;

  let pat = process.env.NX_CLOUD_PAT;
  if (!pat) {
    try {
      const iniPath = process.env.XDG_CONFIG_HOME
        ? join(process.env.XDG_CONFIG_HOME, 'nxcloud', 'nxcloud.ini')
        : join(process.env.HOME!, '.config', 'nxcloud', 'nxcloud.ini');
      const ini = parseIni(readFileSync(iniPath, 'utf-8'));
      pat =
        ini?.[NX_CLOUD_URL]?.personalAccessToken ??
        ini?.['https://cloud.nx.app']?.personalAccessToken;
    } catch {}
  }
  if (pat) headers['Nx-Cloud-Personal-Access-Token'] = pat;

  return headers;
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function circleFetch<T>(path: string): Promise<T> {
  const token = getCircleToken();
  const headers: Record<string, string> = {};
  if (token) headers['Circle-Token'] = token;
  return fetchJSON<T>(`https://circleci.com/api/v2${path}`, { headers });
}

async function nxCloudFetch<T>(path: string, body?: unknown): Promise<T> {
  return fetchJSON<T>(`${NX_CLOUD_URL}/nx-cloud/mcp-context${path}`, {
    method: body ? 'POST' : 'GET',
    headers: getNxCloudHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ─── Data types ──────────────────────────────────────────────────────────────

interface CIRun {
  id: string;
  status: string;
  createdAt: string;
  durationSec: number;
  creditsUsed: number;
  costUsd: number;
  failedJobs: string[];
  commitSha?: string;
  nxPerTemplate?: Record<string, number>;
  nxResourceClasses?: Record<string, number>;
}

interface CIReport {
  system: string;
  workflow: string;
  branches: string[];
  runs: CIRun[];
  summary: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    canceledRuns: number;
    flakeRate: string;
    durationMin: number;
    durationMax: number;
    durationAvg: number;
    durationP50: number;
    durationP95: number;
    totalCredits: number;
    totalCostUsd: number;
    avgCostPerRun: number;
  };
}

// ─── CircleCI Data ───────────────────────────────────────────────────────────

interface CircleInsightsRun {
  id: string;
  duration: number;
  status: string;
  created_at: string;
  stopped_at: string;
  credits_used: number;
  branch: string;
}

interface CircleJob {
  name: string;
  status: string;
}

// Max pages to scan per branch, regardless of time window. Prevents runaway scans.
const CIRCLE_MAX_PAGES = 20;

async function syncCircleCIRuns(
  db: InstanceType<typeof DatabaseSync>,
  workflow: string,
  branches: string[],
  workflowName: string,
  sinceMs: number,
  excludeBranches?: Set<string>
): Promise<CIRun[]> {
  const existingIds = dbGetExistingIds(db, 'circleci', workflow);
  const newRuns: CIRun[] = [];
  let skipped = 0;
  let excluded = 0;
  let hitPageCap = false;

  // Empty branches array → query across all branches (single un-filtered query).
  const branchQueries = branches.length === 0 ? [undefined] : branches;

  for (const branch of branchQueries) {
    let pageToken: string | undefined;

    pages: for (let page = 0; page < CIRCLE_MAX_PAGES; page++) {
      const params = new URLSearchParams();
      if (branch) params.set('branch', branch);
      else params.set('all-branches', 'true');
      if (pageToken) params.set('page-token', pageToken);

      const data = await circleFetch<{
        items: CircleInsightsRun[];
        next_page_token: string | null;
      }>(`/insights/${CIRCLECI_PROJECT}/workflows/${workflowName}?${params}`);

      for (const run of data.items) {
        // Runs come newest-first; once we're past the cutoff we're done.
        if (new Date(run.created_at).getTime() < sinceMs) {
          break pages;
        }
        if (run.status === 'canceled' || run.status === 'not_run') continue;

        if (excludeBranches?.has(run.branch)) {
          excluded++;
          continue;
        }

        if (existingIds.has(run.id)) {
          skipped++;
          continue;
        }

        const failedJobs: string[] = [];
        if (run.status === 'failed') {
          try {
            const jobsData = await circleFetch<{ items: CircleJob[] }>(`/workflow/${run.id}/job`);
            for (const job of jobsData.items) {
              if (job.status === 'failed') failedJobs.push(job.name);
            }
          } catch {}
        }

        // Get commit SHA via workflow → pipeline
        let commitSha: string | undefined;
        try {
          const wf = await circleFetch<{ pipeline_id: string }>(`/workflow/${run.id}`);
          const pipe = await circleFetch<{ vcs: { revision: string } }>(
            `/pipeline/${wf.pipeline_id}`
          );
          commitSha = pipe.vcs?.revision;
        } catch {}

        const ciRun: CIRun = {
          id: run.id,
          status: run.status,
          createdAt: run.created_at,
          durationSec: run.duration,
          creditsUsed: run.credits_used,
          costUsd: run.credits_used * CIRCLECI_CREDIT_TO_USD,
          failedJobs,
          commitSha,
        };

        dbInsertRun(db, 'circleci', workflow, run.branch, ciRun);
        newRuns.push(ciRun);
      }

      pageToken = data.next_page_token ?? undefined;
      if (!pageToken) break;
      if (page === CIRCLE_MAX_PAGES - 1) hitPageCap = true;
    }
  }

  if (skipped > 0) console.log(`    CircleCI: ${skipped} cached, ${newRuns.length} new`);
  else console.log(`    CircleCI: ${newRuns.length} new runs`);
  if (excluded > 0) console.log(`    CircleCI: excluded ${excluded} runs on medium+ branches`);
  if (hitPageCap) {
    console.log(`    CircleCI: ⚠ hit ${CIRCLE_MAX_PAGES}-page cap before cutoff`);
  }

  return dbGetRuns(db, 'circleci', workflow);
}

// ─── NX Cloud Data ───────────────────────────────────────────────────────────

interface NxPipelineExecution {
  id: string;
  branch: string;
  status: string;
  createdAtMs: number;
  completedAtMs: number | null;
  durationMs: number;
  commitSha?: string;
  vcsTitle?: string;
  vcsContext?: { ref?: string; headSha?: string; title?: string };
  runGroups: {
    runGroupName: string;
    status: string;
    agentsMetadataSummary?: Record<
      string,
      { launchTemplate: string; onlineAtMs: number; offlineAtMs: number }
    >;
  }[];
}

interface NxPipelineSearchResult {
  items: {
    id: string;
    branch: string;
    status: string;
    createdAtMs: number;
    completedAtMs: number | null;
    durationMs: number;
    vcsContext?: { ref?: string };
  }[];
  nextPageToken?: string;
}

// Max pages of pipeline executions to scan per branch, regardless of matches.
// With pageSize=50, 20 pages = 1000 CIPEs. Prevents runaway scans.
const NX_MAX_PAGES = 20;
const NX_PAGE_SIZE = 50;

interface NxDashboardCredits {
  totalCredits: number;
  perTemplate: Record<string, number>;
  resourceClasses: Record<string, number>;
}

interface NxCipeRetryStats {
  totalTasks: number;
  totalTaskRetries: number;
  successfulRetries: number;
  failedRetries: number;
  /**
   * Direct NX field `ciPipelineExecution.duration.hypotheticalNoCacheMs` —
   * total task-duration (ms) that the remote cache saved on this CIPE. Null
   * on older CIPEs where the field wasn't present.
   */
  hypotheticalNoCacheMs: number | null;
}

interface NxDashboardCipeAnalysis {
  credits: NxDashboardCredits | null;
  retryStats: NxCipeRetryStats | null;
}

async function fetchNxDashboardCipeAnalysis(
  cipeId: string,
  runGroupName: string
): Promise<NxDashboardCipeAnalysis> {
  const session = process.env.NX_CLOUD_SESSION;
  if (!session) return { credits: null, retryStats: null };

  try {
    const url = `${NX_CLOUD_URL}/cipes/${cipeId}/analysis?runGroup=${encodeURIComponent(runGroupName)}&_data=routes%2F_auth.cipes.%24cipeId.analysis`;
    const res = await fetch(url, {
      headers: { Cookie: `_nxCloudSession=${session}` },
    });
    if (!res.ok) return { credits: null, retryStats: null };

    const data = await res.json();

    // --- Credits (per-template) ---
    let credits: NxDashboardCredits | null = null;
    const usages = data?.computeCreditUsages as
      | Record<string, { totalCredits: number }>
      | undefined;
    if (usages) {
      const rcData = data?.resourceClasses as
        | Record<string, { creditMultiplier: number }>
        | undefined;
      const resourceClasses: Record<string, number> = {};
      if (rcData) {
        for (const [tmpl, info] of Object.entries(rcData)) {
          resourceClasses[tmpl] = info.creditMultiplier;
        }
      }

      let total = NX_CREDITS_PER_CIPE;
      const perTemplate: Record<string, number> = {};
      for (const [tmpl, info] of Object.entries(usages)) {
        perTemplate[tmpl] = info.totalCredits;
        total += info.totalCredits;
      }
      credits = { totalCredits: total, perTemplate, resourceClasses };
    }

    // --- Retry stats (per-CIPE) ---
    const retryRaw = data?.ciPipelineExecution?.ttgImpactMetadata?.taskRetryStats as
      | { totalTasks: number; totalTaskRetries: number; successfulRetries: number; failedRetries: number }
      | undefined;
    const hypoMs = data?.ciPipelineExecution?.duration?.hypotheticalNoCacheMs;
    const hypothetical =
      typeof hypoMs === 'number' && Number.isFinite(hypoMs) ? Math.round(hypoMs) : null;

    const retryStats: NxCipeRetryStats | null = retryRaw
      ? {
          totalTasks: retryRaw.totalTasks ?? 0,
          totalTaskRetries: retryRaw.totalTaskRetries ?? 0,
          successfulRetries: retryRaw.successfulRetries ?? 0,
          failedRetries: retryRaw.failedRetries ?? 0,
          hypotheticalNoCacheMs: hypothetical,
        }
      : null;

    return { credits, retryStats };
  } catch {
    return { credits: null, retryStats: null };
  }
}


const prNumberCache = new Map<string, string>();

async function resolvePRNumber(branch: string): Promise<string> {
  if (prNumberCache.has(branch)) return prNumberCache.get(branch)!;

  try {
    const data = await fetchJSON<{ number: number }[]>(
      `https://api.github.com/repos/storybookjs/storybook/pulls?head=storybookjs:${branch}&state=open&per_page=1`,
      { headers: { Authorization: `token ${process.env.GITHUB_TOKEN ?? ''}` } }
    );
    const num = data[0]?.number?.toString() ?? branch;
    prNumberCache.set(branch, num);
    return num;
  } catch {
    return branch;
  }
}

async function syncNxCloudRuns(
  db: InstanceType<typeof DatabaseSync>,
  workflow: string,
  branches: string[],
  sinceMs: number,
  agentCreditsPerMin: Record<string, number>,
  excludeBranches?: Set<string>
): Promise<CIRun[]> {
  const existingIds = dbGetExistingIds(db, 'nx', workflow);
  const newRuns: CIRun[] = [];
  let skipped = 0;
  let excluded = 0;
  const hasDashboardAccess = !!process.env.NX_CLOUD_SESSION;

  // Empty branches array → query across all branches (no filter).
  const prNumbers = branches.length === 0 ? [] : await Promise.all(branches.map(resolvePRNumber));

  const NX_TAG_MAP: Record<string, string> = {
    normal: 'ci:normal',
    merged: 'ci:merged',
    daily: 'ci:daily',
    'base (nx-ai)': 'ci:daily',
    'next:merged': 'ci:merged',
    'next:daily': 'ci:daily',
    'normal:prs': 'ci:normal',
    'merged:prs': 'ci:merged',
    'daily:prs': 'ci:daily',
  };
  const expectedTag = NX_TAG_MAP[workflow];

  const debug = !!process.env.NX_DEBUG;
  let filteredNoTag = 0;
  let filteredNoRuns = 0;
  let scannedCipes = 0;
  let hitPageCap = false;

  // Paginate pipeline executions until we see a CIPE older than `sinceMs`.
  // Many CIPEs are filtered out (wrong tag, no runs, skip-ci) so the effective
  // match rate on `next` is ~1/4.
  let pageToken: string | undefined;

  outer: for (let page = 0; page < NX_MAX_PAGES; page++) {
    const body: Record<string, unknown> = {
      statuses: ['SUCCEEDED', 'FAILED'],
      limit: NX_PAGE_SIZE,
    };
    if (prNumbers.length > 0) body.branches = prNumbers;
    if (pageToken) body.pageToken = pageToken;

    const searchResult = await nxCloudFetch<NxPipelineSearchResult>(
      '/pipeline-executions/search',
      body
    );

    for (const item of searchResult.items) {
      scannedCipes++;
      if (!item.completedAtMs) continue;
      if (
        item.status === 'IN_PROGRESS' ||
        item.status === 'NOT_STARTED' ||
        item.status === 'CANCELED'
      )
        continue;

      // When explicit branches were requested, keep only matching CIPEs.
      if (prNumbers.length > 0 && !prNumbers.includes(item.branch)) continue;

      // CIPEs are returned newest-first; once we're past the cutoff we're done.
      if (item.createdAtMs < sinceMs) {
        break outer;
      }

      // Skip experiment/eval branches when doing a wild-branch sync.
      if (excludeBranches?.has(item.branch)) {
        excluded++;
        continue;
      }

      if (existingIds.has(item.id)) {
        skipped++;
        continue;
      }

      // Fetch runs FIRST (before details) — used for tag matching. On `next` more
      // than half of CIPEs are skip-ci/compile-only and we can filter them out
      // without paying for the /pipeline-executions/{id} call.
      let runItems: { id: string; status: string; durationMs: number; command: string }[] = [];
      try {
        const runSearch = await nxCloudFetch<{
          items: { id: string; status: string; durationMs: number; command: string }[];
        }>('/runs/search', { pipelineExecutionId: item.id, limit: 50 });
        runItems = runSearch.items;
      } catch {}

      // Match workflow by checking the tag in the nx command (e.g. tag:ci:daily vs tag:ci:merged).
      // CIPEs without any tag filter in their commands are internal/setup runs — skip them.
      if (expectedTag) {
        const mainRun = runItems.find((r) => r.command?.includes(`tag:${expectedTag}`));
        if (!mainRun) {
          if (runItems.length === 0) {
            filteredNoRuns++;
            if (debug)
              console.log(`    [DEBUG] skip ${item.id}: no runs found (probably [skip ci])`);
          } else {
            filteredNoTag++;
            if (debug)
              console.log(
                `    [DEBUG] skip ${item.id}: no tag:${expectedTag} (runs=${runItems.length}, first cmd=${(runItems[0]?.command ?? '').slice(0, 80)})`
              );
          }
          continue;
        }
      }

      const details = await nxCloudFetch<NxPipelineExecution>(`/pipeline-executions/${item.id}`);

      // Use run duration instead of CIPE duration (CIPE includes queueing time)
      const maxRunDuration = Math.max(0, ...runItems.map((r) => r.durationMs || 0));
      const durationSec = maxRunDuration > 0 ? maxRunDuration / 1000 : details.durationMs / 1000;

      const failedJobs: string[] = [];
      for (const run of runItems) {
        if (run.status !== 'Failed') continue;
        try {
          const runDetails = await nxCloudFetch<{
            tasks: { projectName: string; target: string; status: string }[];
          }>(`/runs/${run.id}`);
          for (const task of runDetails.tasks ?? []) {
            if (task.status === 'Failed') {
              failedJobs.push(`${task.projectName}:${task.target}`);
            }
          }
        } catch {
          failedJobs.push(run.id);
        }
      }

      let totalNxCredits: number;
      const firstRunGroup = details.runGroups[0];

      // Single dashboard fetch returns both credits and per-CIPE retry stats.
      const dashboardAnalysis = firstRunGroup
        ? await fetchNxDashboardCipeAnalysis(item.id, firstRunGroup.runGroupName)
        : { credits: null, retryStats: null };
      const dashboardCredits = dashboardAnalysis.credits;

      if (dashboardCredits) {
        totalNxCredits = dashboardCredits.totalCredits;
      } else {
        totalNxCredits = NX_CREDITS_PER_CIPE;
        for (const rg of details.runGroups) {
          if (rg.agentsMetadataSummary) {
            const cipeStartMs = details.createdAtMs;
            for (const [, agent] of Object.entries(rg.agentsMetadataSummary)) {
              const billableMin = (agent.offlineAtMs - cipeStartMs) / 60000;
              const creditsPerMin = agentCreditsPerMin[agent.launchTemplate] ?? 15;
              totalNxCredits += Math.max(0, billableMin) * creditsPerMin;
            }
          }
        }
      }

      const ciRun: CIRun = {
        id: item.id,
        status: item.status,
        createdAt: new Date(item.createdAtMs).toISOString(),
        durationSec,
        creditsUsed: Math.round(totalNxCredits),
        costUsd: totalNxCredits * NX_CREDIT_TO_USD,
        failedJobs,
        commitSha: details.commitSha ?? details.vcsContext?.headSha ?? undefined,
        nxPerTemplate: dashboardCredits?.perTemplate,
        nxResourceClasses: dashboardCredits?.resourceClasses,
      };

      dbInsertRun(db, 'nx', workflow, item.branch, ciRun);
      if (dashboardAnalysis.retryStats) {
        const rs = dashboardAnalysis.retryStats;
        db.prepare(
          `INSERT OR IGNORE INTO nx_cipe_retry_stats
             (run_id, total_tasks, total_task_retries, successful_retries, failed_retries, hypothetical_no_cache_ms)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
          item.id,
          rs.totalTasks,
          rs.totalTaskRetries,
          rs.successfulRetries,
          rs.failedRetries,
          rs.hypotheticalNoCacheMs
        );
      }
      newRuns.push(ciRun);
    }

    if (!searchResult.nextPageToken) break;
    pageToken = searchResult.nextPageToken;
    if (page === NX_MAX_PAGES - 1) hitPageCap = true;
  }

  if (hasDashboardAccess) {
    console.log(`    NX Cloud: exact credits from dashboard API`);
  } else {
    console.log(`    NX Cloud: estimated credits (set NX_CLOUD_SESSION for exact)`);
  }
  if (skipped > 0) console.log(`    NX Cloud: ${skipped} cached, ${newRuns.length} new`);
  else console.log(`    NX Cloud: ${newRuns.length} new runs`);
  if (filteredNoTag > 0 || filteredNoRuns > 0) {
    console.log(
      `    NX Cloud: scanned ${scannedCipes} CIPEs — filtered ${filteredNoTag} (no tag:${expectedTag}) + ${filteredNoRuns} (no runs, e.g. [skip ci])`
    );
  }
  if (excluded > 0) {
    console.log(`    NX Cloud: excluded ${excluded} CIPEs on medium+ branches`);
  }
  if (hitPageCap) {
    console.log(`    NX Cloud: ⚠ hit ${NX_MAX_PAGES}-page cap before cutoff`);
  }

  return dbGetRuns(db, 'nx', workflow);
}

/**
 * Per-CIPE retry stats are fetched inline when a new CIPE is synced, but any
 * CIPE that was already in the `runs` table before this schema existed won't
 * have a row in `nx_cipe_retry_stats`. This backfill fills those gaps.
 *
 * Also re-fetches rows where `hypothetical_no_cache_ms` is still NULL (added
 * in a later migration) so the direct cache-savings field is populated for
 * all CIPEs over time.
 *
 * Idempotent — re-running only hits the API for CIPEs still missing data.
 */
async function backfillNxCipeRetryStats(
  db: InstanceType<typeof DatabaseSync>
): Promise<void> {
  if (!process.env.NX_CLOUD_SESSION) {
    console.log(`    NX retry backfill: skipped (NX_CLOUD_SESSION not set)`);
    return;
  }

  const missing = db
    .prepare(
      `SELECT r.id FROM runs r
         LEFT JOIN nx_cipe_retry_stats s ON s.run_id = r.id
        WHERE r.system = 'nx'
          AND (s.run_id IS NULL OR s.hypothetical_no_cache_ms IS NULL)
        ORDER BY r.created_at DESC`
    )
    .all() as { id: string }[];

  if (missing.length === 0) {
    console.log(`    NX retry backfill: up to date (all CIPEs have retry stats + hypotheticalNoCacheMs)`);
    return;
  }

  console.log(`    NX retry backfill: fetching for ${missing.length} CIPEs...`);

  // INSERT OR REPLACE so rows that pre-date the hypothetical_no_cache_ms
  // column get updated in-place (we always have all four retry columns in
  // hand from the API, so nothing is lost).
  const upsert = db.prepare(
    `INSERT OR REPLACE INTO nx_cipe_retry_stats
       (run_id, total_tasks, total_task_retries, successful_retries, failed_retries, hypothetical_no_cache_ms)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  let stored = 0;
  let apiFailures = 0;
  for (const { id } of missing) {
    try {
      const details = await nxCloudFetch<NxPipelineExecution>(`/pipeline-executions/${id}`);
      const rg = details.runGroups[0]?.runGroupName;
      if (!rg) continue;

      const analysis = await fetchNxDashboardCipeAnalysis(id, rg);
      if (!analysis.retryStats) {
        apiFailures++;
        continue;
      }
      const rs = analysis.retryStats;
      upsert.run(
        id,
        rs.totalTasks,
        rs.totalTaskRetries,
        rs.successfulRetries,
        rs.failedRetries,
        rs.hypotheticalNoCacheMs
      );
      stored++;
    } catch {
      apiFailures++;
    }
  }

  console.log(
    `    NX retry backfill: stored ${stored} / ${missing.length}${apiFailures > 0 ? ` (${apiFailures} API failures — will retry on next sync)` : ''}`
  );
}

/**
 * Per-CIPE cache hit counts from `/runs/{runId}` task listings. Used to
 * quantify how much the NX remote cache saves on each workflow. Excludes
 * `continuous-*` hashed tasks (serve / run-registry) which aren't cacheable.
 * Idempotent backfill — re-run only fetches CIPEs still missing.
 */
async function backfillNxCacheStats(
  db: InstanceType<typeof DatabaseSync>
): Promise<void> {
  const missing = db
    .prepare(
      `SELECT r.id FROM runs r
         LEFT JOIN nx_cache_stats s ON s.run_id = r.id
        WHERE r.system = 'nx' AND s.run_id IS NULL
        ORDER BY r.created_at DESC`
    )
    .all() as { id: string }[];

  if (missing.length === 0) {
    console.log(`    NX cache backfill: up to date (all CIPEs have cache stats)`);
    return;
  }

  console.log(`    NX cache backfill: fetching for ${missing.length} CIPEs...`);

  const insert = db.prepare(
    `INSERT OR IGNORE INTO nx_cache_stats (run_id, cache_hits, cache_misses, total_tasks)
     VALUES (?, ?, ?, ?)`
  );

  let stored = 0;
  let apiFailures = 0;
  let skipped = 0;
  for (const { id } of missing) {
    try {
      // Find the main run inside the CIPE (limit 5 is enough — most CIPEs have 1).
      const runSearch = await nxCloudFetch<{
        items: { id: string; command?: string }[];
      }>('/runs/search', { pipelineExecutionId: id, limit: 5 });
      const mainRun = runSearch.items[0];
      if (!mainRun) {
        skipped++;
        continue;
      }

      const detail = await nxCloudFetch<{
        tasks: { taskId: string; status: string; cacheStatus: string }[];
      }>(`/runs/${mainRun.id}`);
      const tasks = detail.tasks ?? [];
      let hits = 0;
      let misses = 0;
      for (const t of tasks) {
        // Skip non-cacheable continuous tasks (serve / run-registry).
        if (t.taskId.endsWith(':serve:production') || t.taskId.endsWith(':run-registry:production')) {
          continue;
        }
        const cs = t.cacheStatus ?? '';
        if (cs.includes('cache-hit')) hits++;
        else if (cs === 'cache-miss') misses++;
      }
      insert.run(id, hits, misses, hits + misses);
      stored++;
    } catch {
      apiFailures++;
    }
  }

  console.log(
    `    NX cache backfill: stored ${stored} / ${missing.length}${skipped > 0 ? `, skipped ${skipped}` : ''}${apiFailures > 0 ? ` (${apiFailures} API failures — will retry on next sync)` : ''}`
  );
}

/**
 * Infer which agent template a task runs on from its target. Follows
 * `.nx/workflows/distribution-config.yaml`:
 *
 *   - compile / check / lint / knip / fmt → linux-js
 *   - everything else → linux-browsers-js
 *
 * In practice non-core `compile` is also listed on `linux-browsers-js` in
 * the config, but NX assigns each task to exactly one agent and the linux-js
 * pool owns the compile chain, so treating every `compile` as linux-js is
 * accurate enough for credit accounting.
 */
const LINUX_JS_TARGETS = new Set(['compile', 'check', 'lint', 'knip', 'fmt']);

function inferAgentTemplate(target: string): 'linux-js' | 'linux-browsers-js' {
  return LINUX_JS_TARGETS.has(target) ? 'linux-js' : 'linux-browsers-js';
}

/**
 * Per-task detail from `/runs/{runId}` (task-level cache status + duration).
 * One row per (run_id, task_id), excluding non-cacheable continuous tasks.
 *
 * Used to compute **real** per-CIPE cache savings: each cache-hit task is
 * valued by the avg duration of the *same task-id* when it ran fresh
 * (from cache-miss samples), rather than a uniform per-CIPE average.
 *
 * Two API calls per missing CIPE (`/runs/search` then `/runs/{runId}`).
 * Idempotent on `(run_id, task_id)` primary key.
 */
async function backfillNxRunTasks(
  db: InstanceType<typeof DatabaseSync>
): Promise<void> {
  const missing = db
    .prepare(
      `SELECT r.id FROM runs r
        WHERE r.system = 'nx'
          AND NOT EXISTS (SELECT 1 FROM nx_run_tasks t WHERE t.run_id = r.id)
        ORDER BY r.created_at DESC`
    )
    .all() as { id: string }[];

  if (missing.length === 0) {
    console.log(`    NX run-tasks backfill: up to date (all CIPEs have per-task rows)`);
    return;
  }

  console.log(`    NX run-tasks backfill: fetching for ${missing.length} CIPEs...`);

  // Per-CIPE credit rates come from nx_template_credits (captured when the
  // CIPE was first synced). Default to 60 credits/min if we don't have the
  // data — that's the extra_large+ rate and matches the vast majority of
  // CIPEs pre-dating the medium+ eval branches.
  const rateStmt = db.prepare(
    `SELECT template, credit_multiplier FROM nx_template_credits WHERE run_id = ?`
  );

  const insert = db.prepare(
    `INSERT OR IGNORE INTO nx_run_tasks
       (run_id, task_id, project, target, duration_ms, cache_status, agent_template, credits_per_min)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let stored = 0;
  let apiFailures = 0;
  let skipped = 0;
  let totalTaskRows = 0;

  for (const { id } of missing) {
    try {
      const runSearch = await nxCloudFetch<{
        items: { id: string; command?: string }[];
      }>('/runs/search', { pipelineExecutionId: id, limit: 5 });
      const mainRun = runSearch.items[0];
      if (!mainRun) {
        skipped++;
        continue;
      }

      const detail = await nxCloudFetch<{
        tasks: {
          taskId: string;
          projectName: string;
          target: string;
          durationMs: number;
          status: string;
          cacheStatus: string;
          isCacheable: boolean;
        }[];
      }>(`/runs/${mainRun.id}`);

      const rates = rateStmt.all(id) as { template: string; credit_multiplier: number }[];
      const rateByTemplate: Record<string, number> = {};
      for (const r of rates) rateByTemplate[r.template] = r.credit_multiplier;

      for (const t of detail.tasks ?? []) {
        if (
          t.taskId.endsWith(':serve:production') ||
          t.taskId.endsWith(':run-registry:production')
        ) {
          continue;
        }
        const cs = t.cacheStatus ?? '';
        if (!cs.includes('cache-hit') && cs !== 'cache-miss') continue;

        const template = inferAgentTemplate(t.target);
        const creditsPerMin = rateByTemplate[template] ?? 60;

        insert.run(
          id,
          t.taskId,
          t.projectName,
          t.target,
          t.durationMs ?? 0,
          cs,
          template,
          creditsPerMin
        );
        totalTaskRows++;
      }
      stored++;
    } catch {
      apiFailures++;
    }
  }

  console.log(
    `    NX run-tasks backfill: stored ${totalTaskRows} task rows across ${stored} / ${missing.length} CIPEs${skipped > 0 ? `, skipped ${skipped}` : ''}${apiFailures > 0 ? ` (${apiFailures} API failures — will retry on next sync)` : ''}`
  );
}

// ─── NX Flaky Task Analytics (Enterprise) ────────────────────────────────────

interface NxFlakyTaskSummary {
  project: string;
  target: string;
  configuration: string;
  totalReruns: number;
  sampleSizeFlakinessRate: number;
  flakinessRate: number;
  impactScore: number;
  windowStart: string;
  windowEnd: string;
  lastFailureTime?: string;
  timeWastedSeconds?: number;
  avgTimeConsumedMs?: number;
}

interface NxFlakyTaskDetail {
  windowStart: string;
  windowEnd: string;
  sampleSizeFlakinessRate: number;
  totalDeflakedAutomaticallyCount: number;
  totalFlakyHashes: number;
  totalExecutions: number;
  totalReruns: number;
  timeWastedSeconds: number;
  avgTaskDurationMs: number;
  flakinessRate: number;
  lastFailureTime?: string;
}

interface NxFlakyKpis {
  activeFlakyTasks: { current: number };
  proportionTasksFlaky: { current: string };
  highRiskTasks: { current: number };
}

interface NxFlakyAnalyticsResponse {
  recentFlakyTaskMetrics: NxFlakyTaskSummary[];
  flakyTaskKPIs: NxFlakyKpis;
  startDate: string;
  endDate: string;
  range: string;
}

/**
 * Fetch flaky-task analytics via the Enterprise dashboard endpoint.
 * Requires NX_CLOUD_SESSION cookie.
 *
 * Data is snapshotted once per calendar day. Re-running the sync on the same
 * day with the same --range is a no-op.
 */
async function syncNxFlakyAnalytics(
  db: InstanceType<typeof DatabaseSync>,
  rangeDays: number
): Promise<void> {
  const session = process.env.NX_CLOUD_SESSION;
  if (!session) {
    console.log(`    NX flaky analytics: skipped (NX_CLOUD_SESSION not set)`);
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  // Skip if we already took today's snapshot for this range.
  const existing = db
    .prepare(
      `SELECT COUNT(*) AS n FROM nx_flaky_task_snapshots WHERE snapshot_date = ? AND range_days = ?`
    )
    .get(today, rangeDays) as { n: number };
  if (existing.n > 0) {
    console.log(`    NX flaky analytics: already synced today (${existing.n} rows for range=${rangeDays}d)`);
    return;
  }

  // 1. Fetch the summary (lists every flaky task + workspace KPIs).
  const summaryUrl =
    `${NX_CLOUD_URL}/orgs/${NX_CLOUD_ORG_ID}/workspaces/${NX_CLOUD_ID}` +
    `/analytics/flaky-tasks?range=${rangeDays}` +
    `&_data=routes%2F_auth.orgs.%24orgId.workspaces.%24workspaceId.analytics.flaky-tasks`;

  let summary: NxFlakyAnalyticsResponse;
  try {
    const res = await fetch(summaryUrl, { headers: { Cookie: `_nxCloudSession=${session}` } });
    if (!res.ok) {
      console.log(`    NX flaky analytics: summary HTTP ${res.status} — skipped`);
      return;
    }
    summary = (await res.json()) as NxFlakyAnalyticsResponse;
  } catch (e: any) {
    console.log(`    NX flaky analytics: fetch error — ${e.message}`);
    return;
  }

  const tasks = summary.recentFlakyTaskMetrics ?? [];
  console.log(
    `    NX flaky analytics: fetched summary (${tasks.length} flaky tasks, range=${rangeDays}d)`
  );

  // 2. Fetch per-task detail (includes totalDeflakedAutomaticallyCount — the rescue count).
  let totalRescues = 0;
  let totalReruns = 0;
  let totalRetrySec = 0;

  const insertSnapshot = db.prepare(`
    INSERT INTO nx_flaky_task_snapshots (
      snapshot_date, range_days, window_start, window_end,
      project, target, configuration,
      total_reruns, total_rescues, total_executions, total_flaky_hashes,
      retry_time_seconds, avg_time_consumed_ms, flakiness_rate, impact_score,
      last_failure_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const t of tasks) {
    const detailUrl =
      `${NX_CLOUD_URL}/orgs/${NX_CLOUD_ORG_ID}/workspaces/${NX_CLOUD_ID}` +
      `/analytics/flaky-tasks/${encodeURIComponent(t.project)}/${encodeURIComponent(t.target)}` +
      `?range=${rangeDays}`;

    let detail: NxFlakyTaskDetail | null = null;
    try {
      const res = await fetch(detailUrl, {
        headers: { Cookie: `_nxCloudSession=${session}` },
      });
      if (res.ok) detail = (await res.json()) as NxFlakyTaskDetail;
    } catch {}

    const rescues = detail?.totalDeflakedAutomaticallyCount ?? 0;
    const executions = detail?.totalExecutions ?? t.sampleSizeFlakinessRate;
    const flakyHashes = detail?.totalFlakyHashes ?? 0;
    const retrySec = detail?.timeWastedSeconds ?? t.timeWastedSeconds ?? 0;
    const avgMs = detail?.avgTaskDurationMs ?? t.avgTimeConsumedMs ?? 0;

    insertSnapshot.run(
      today,
      rangeDays,
      t.windowStart,
      t.windowEnd,
      t.project,
      t.target,
      t.configuration,
      t.totalReruns,
      rescues,
      executions,
      flakyHashes,
      retrySec,
      avgMs,
      t.flakinessRate,
      t.impactScore,
      t.lastFailureTime ?? null
    );

    totalReruns += t.totalReruns;
    totalRescues += rescues;
    totalRetrySec += retrySec;
  }

  // 3. Store workspace-wide KPIs.
  const kpis = summary.flakyTaskKPIs;
  const proportionPct = parseFloat(String(kpis?.proportionTasksFlaky?.current ?? '0').replace('%', ''));

  db.prepare(
    `INSERT OR REPLACE INTO nx_flaky_task_kpis (
      snapshot_date, range_days, window_start, window_end,
      active_flaky_tasks, proportion_tasks_flaky_pct, high_risk_tasks,
      total_reruns, total_rescues, retry_time_seconds
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    today,
    rangeDays,
    summary.startDate,
    summary.endDate,
    kpis?.activeFlakyTasks?.current ?? tasks.length,
    proportionPct,
    kpis?.highRiskTasks?.current ?? 0,
    totalReruns,
    totalRescues,
    totalRetrySec
  );

  console.log(
    `    NX flaky analytics: ${tasks.length} tasks stored, ${totalRescues} rescues out of ${totalReruns} retries`
  );
}

// ─── Analysis ────────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function buildReport(
  system: string,
  workflow: string,
  branches: string[],
  runs: CIRun[]
): CIReport {
  const completed = runs.filter((r) => r.status !== 'CANCELED');
  const successful = completed.filter((r) => r.status === 'success' || r.status === 'SUCCEEDED');
  const failed = completed.filter((r) => r.status === 'failed' || r.status === 'FAILED');
  const canceled = runs.filter((r) => r.status === 'canceled' || r.status === 'CANCELED');

  const durations = completed.map((r) => r.durationSec).sort((a, b) => a - b);
  const totalCredits = runs.reduce((sum, r) => sum + r.creditsUsed, 0);
  const totalCost = runs.reduce((sum, r) => sum + r.costUsd, 0);

  return {
    system,
    workflow,
    branches,
    runs,
    summary: {
      totalRuns: runs.length,
      successfulRuns: successful.length,
      failedRuns: failed.length,
      canceledRuns: canceled.length,
      flakeRate:
        completed.length > 0 ? `${((failed.length / completed.length) * 100).toFixed(1)}%` : 'N/A',
      durationMin: durations.length > 0 ? Math.round(durations[0]) : 0,
      durationMax: durations.length > 0 ? Math.round(durations[durations.length - 1]) : 0,
      durationAvg:
        durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0,
      durationP50: Math.round(percentile(durations, 50)),
      durationP95: Math.round(percentile(durations, 95)),
      totalCredits: Math.round(totalCredits),
      totalCostUsd: Math.round(totalCost * 100) / 100,
      avgCostPerRun: runs.length > 0 ? Math.round((totalCost / runs.length) * 100) / 100 : 0,
    },
  };
}

// ─── Display ─────────────────────────────────────────────────────────────────

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m${s.toString().padStart(2, '0')}s`;
}

function printReport(report: CIReport) {
  const s = report.summary;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${report.system} — ${report.workflow}`);
  console.log(`  Branches: ${report.branches.join(', ')}`);
  console.log(`${'═'.repeat(60)}`);
  console.log(
    `  Runs: ${s.totalRuns} (✓ ${s.successfulRuns}  ✗ ${s.failedRuns}  ⊘ ${s.canceledRuns})`
  );
  console.log(`  Flake rate: ${s.flakeRate}`);
  console.log(
    `  Duration:  min=${formatDuration(s.durationMin)}  avg=${formatDuration(s.durationAvg)}  p50=${formatDuration(s.durationP50)}  p95=${formatDuration(s.durationP95)}  max=${formatDuration(s.durationMax)}`
  );
  console.log(`  Credits: ${s.totalCredits.toLocaleString()} total`);
  console.log(`  Cost: $${s.totalCostUsd.toFixed(2)} total  ($${s.avgCostPerRun.toFixed(2)}/run)`);

  if (report.runs.some((r) => r.failedJobs.length > 0)) {
    console.log(`\n  Failed jobs breakdown:`);
    const failCounts: Record<string, number> = {};
    for (const run of report.runs) {
      for (const job of run.failedJobs) {
        failCounts[job] = (failCounts[job] ?? 0) + 1;
      }
    }
    const sorted = Object.entries(failCounts).sort(([, a], [, b]) => b - a);
    for (const [job, count] of sorted.slice(0, 10)) {
      console.log(`    ${count}x  ${job}`);
    }
  }
}

function printRunsTable(report: CIReport) {
  console.log(`\n  Individual runs (${report.system} — ${report.workflow}):`);
  console.log(
    `  ${'#'.padStart(3)}  ${'Status'.padEnd(10)}  ${'Duration'.padStart(10)}  ${'Credits'.padStart(10)}  ${'Cost'.padStart(8)}  Created`
  );
  console.log(`  ${'─'.repeat(70)}`);
  for (let i = 0; i < report.runs.length; i++) {
    const r = report.runs[i];
    const status = r.status === 'success' || r.status === 'SUCCEEDED' ? '✓' : '✗';
    console.log(
      `  ${(i + 1).toString().padStart(3)}  ${status.padEnd(10)}  ${formatDuration(r.durationSec).padStart(10)}  ${r.creditsUsed.toLocaleString().padStart(10)}  ${('$' + r.costUsd.toFixed(2)).padStart(8)}  ${r.createdAt.slice(0, 19)}`
    );
  }
}

function computePredictedMediumPlusCost(
  runs: CIRun[]
): { totalCredits: number; avgPerRun: number } | null {
  // Only downgrade linux-browsers-js to medium+ (15 credits/min).
  // linux-js stays at its current rate — it runs 1 agent doing heavy compile,
  // downgrading it doesn't save much and could slow down the bottleneck.
  const TARGET_RATE = 15;
  const DOWNGRADE_TEMPLATES = new Set(['linux-browsers-js']);
  let total = 0;
  let count = 0;

  for (const run of runs) {
    if (!run.nxPerTemplate || !run.nxResourceClasses) continue;
    let predicted = NX_CREDITS_PER_CIPE;
    for (const [tmpl, credits] of Object.entries(run.nxPerTemplate)) {
      const actualRate = run.nxResourceClasses[tmpl];
      if (DOWNGRADE_TEMPLATES.has(tmpl) && actualRate && actualRate > TARGET_RATE) {
        predicted += (credits / actualRate) * TARGET_RATE;
      } else {
        predicted += credits;
      }
    }
    total += predicted;
    count++;
  }

  if (count === 0) return null;
  return { totalCredits: Math.round(total), avgPerRun: Math.round((total / count) * 100) / 100 };
}

function printFlakeAnalysis(circleReport: CIReport, nxReport: CIReport) {
  const circleFlakes: Record<string, number> = {};
  const nxFlakes: Record<string, number> = {};

  for (const run of circleReport.runs) {
    for (const job of run.failedJobs) {
      circleFlakes[job] = (circleFlakes[job] ?? 0) + 1;
    }
  }
  for (const run of nxReport.runs) {
    for (const job of run.failedJobs) {
      nxFlakes[job] = (nxFlakes[job] ?? 0) + 1;
    }
  }

  const circleTotal = circleReport.runs.filter(
    (r) => r.status === 'failed' || r.status === 'FAILED'
  ).length;
  const nxTotal = nxReport.runs.filter(
    (r) => r.status === 'failed' || r.status === 'FAILED'
  ).length;

  if (circleTotal === 0 && nxTotal === 0) return;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  FLAKE ANALYSIS: ${circleReport.workflow}`);
  console.log(`${'─'.repeat(60)}`);

  if (circleTotal > 0) {
    const circleRuns = circleReport.summary.totalRuns;
    console.log(`\n  CircleCI (${circleTotal} failed runs out of ${circleRuns}):`);
    const sorted = Object.entries(circleFlakes).sort(([, a], [, b]) => b - a);
    for (const [job, count] of sorted.slice(0, 15)) {
      const pct = ((count / circleRuns) * 100).toFixed(1);
      console.log(`    ${count.toString().padStart(3)}x (${pct.padStart(5)}%)  ${job}`);
    }
  }

  if (nxTotal > 0) {
    const nxRuns = nxReport.summary.totalRuns;
    console.log(`\n  NX Cloud (${nxTotal} failed runs out of ${nxRuns}):`);
    const sorted = Object.entries(nxFlakes).sort(([, a], [, b]) => b - a);
    for (const [job, count] of sorted.slice(0, 15)) {
      const pct = ((count / nxRuns) * 100).toFixed(1);
      console.log(`    ${count.toString().padStart(3)}x (${pct.padStart(5)}%)  ${job}`);
    }
  }
}

function printComparison(circleReport: CIReport, nxReport: CIReport) {
  const c = circleReport.summary;
  const n = nxReport.summary;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  COMPARISON: ${circleReport.workflow}`);
  console.log(`${'─'.repeat(60)}`);

  const row = (label: string, cVal: string, nVal: string, winner?: string) => {
    const indicator = winner === 'circle' ? ' ◀' : winner === 'nx' ? '  ▶' : '';
    console.log(`  ${label.padEnd(20)} ${cVal.padStart(15)}  ${nVal.padStart(15)} ${indicator}`);
  };

  row('', 'CircleCI', 'NX Cloud');
  row('Runs', String(c.totalRuns), String(n.totalRuns));
  row(
    'Success rate',
    `${c.successfulRuns}/${c.totalRuns - c.canceledRuns}`,
    `${n.successfulRuns}/${n.totalRuns - n.canceledRuns}`
  );
  row(
    'Flake rate',
    c.flakeRate,
    n.flakeRate,
    parseFloat(c.flakeRate) < parseFloat(n.flakeRate)
      ? 'circle'
      : parseFloat(n.flakeRate) < parseFloat(c.flakeRate)
        ? 'nx'
        : undefined
  );
  row(
    'Avg duration',
    formatDuration(c.durationAvg),
    formatDuration(n.durationAvg),
    c.durationAvg < n.durationAvg ? 'circle' : n.durationAvg < c.durationAvg ? 'nx' : undefined
  );
  row('P50 duration', formatDuration(c.durationP50), formatDuration(n.durationP50));
  row('P95 duration', formatDuration(c.durationP95), formatDuration(n.durationP95));
  row(
    'Avg cost/run',
    `$${c.avgCostPerRun.toFixed(2)}`,
    `$${n.avgCostPerRun.toFixed(2)}`,
    c.avgCostPerRun < n.avgCostPerRun
      ? 'circle'
      : n.avgCostPerRun < c.avgCostPerRun
        ? 'nx'
        : undefined
  );
  row('Total cost', `$${c.totalCostUsd.toFixed(2)}`, `$${n.totalCostUsd.toFixed(2)}`);
  row('Total credits', c.totalCredits.toLocaleString(), n.totalCredits.toLocaleString());

  const predicted = computePredictedMediumPlusCost(nxReport.runs);
  if (predicted) {
    const predCostPerRun = predicted.avgPerRun * NX_CREDIT_TO_USD;
    console.log('');
    row(
      'NX if medium+',
      '',
      `$${predCostPerRun.toFixed(2)}/run`,
      predCostPerRun < c.avgCostPerRun ? 'nx' : 'circle'
    );
    row('  total predicted', '', `$${(predicted.totalCredits * NX_CREDIT_TO_USD).toFixed(2)}`);
    row('  credits predicted', '', predicted.totalCredits.toLocaleString());
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const workflowFilter = args.includes('--workflow')
    ? args[args.indexOf('--workflow') + 1]
    : undefined;
  const sinceArg = args.includes('--since') ? args[args.indexOf('--since') + 1] : undefined;
  const days = args.includes('--days') ? parseInt(args[args.indexOf('--days') + 1], 10) : 14;
  const reportOnly = args.includes('--report-only');
  const showRuns = args.includes('--show-runs');
  const flakyRange = args.includes('--flaky-range')
    ? parseInt(args[args.indexOf('--flaky-range') + 1], 10)
    : 30;
  const skipFlakyAnalytics = args.includes('--skip-flaky-analytics');

  const sinceMs = sinceArg ? new Date(sinceArg).getTime() : Date.now() - days * 24 * 60 * 60 * 1000;
  if (Number.isNaN(sinceMs)) {
    console.error(`Invalid --since value: ${sinceArg}`);
    process.exit(1);
  }

  const workflows = workflowFilter ? [workflowFilter] : Object.keys(EVAL_BRANCHES);

  const db = initDB();
  const agentCreditsPerMin = loadNxAgentCreditsPerMin();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           CI Evaluation: NX Cloud vs CircleCI           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Date: ${new Date().toISOString()}`);
  console.log(`  Workflows: ${workflows.join(', ')}`);
  console.log(
    sinceArg
      ? `  Window: since ${sinceArg}`
      : `  Window: last ${days} days (since ${new Date(sinceMs).toISOString().slice(0, 10)})`
  );
  console.log(`  Mode: ${reportOnly ? 'report-only (from cache)' : 'sync + report'}`);
  console.log(`  DB: ${DB_PATH}`);
  console.log(`  NX agent rates (from .nx/workflows/agents.yaml):`);
  for (const [name, rate] of Object.entries(agentCreditsPerMin)) {
    console.log(`    ${name}: ${rate} credits/min`);
  }

  for (const workflow of workflows) {
    const branches = EVAL_BRANCHES[workflow];
    if (!branches) {
      console.log(`\n  ⚠ Unknown workflow: ${workflow}`);
      continue;
    }

    const workflowName = WORKFLOW_NAMES[workflow];

    console.log(`\n  Fetching ${workflow} data...`);

    let circleRuns: CIRun[] = [];
    let nxRuns: CIRun[] = [];

    if (reportOnly) {
      circleRuns = dbGetRuns(db, 'circleci', workflow);
      nxRuns = dbGetRuns(db, 'nx', workflow);
      console.log(`    CircleCI: ${circleRuns.length} runs (from cache)`);
      console.log(`    NX Cloud: ${nxRuns.length} runs (from cache)`);
    } else {
      const isWildBranch = branches.length === 0;
      const excludeBranches = isWildBranch ? MEDIUM_PLUS_BRANCHES : undefined;
      const branchLabel = isWildBranch ? 'ALL branches (excluding eval/medium+)' : branches.join(', ');

      try {
        console.log(`    CircleCI: querying branches ${branchLabel}...`);
        circleRuns = await syncCircleCIRuns(
          db,
          workflow,
          branches,
          workflowName,
          sinceMs,
          excludeBranches
        );
      } catch (e: any) {
        console.log(`    CircleCI: error — ${e.message}`);
        circleRuns = dbGetRuns(db, 'circleci', workflow);
      }

      try {
        console.log(`    NX Cloud: querying branches ${branchLabel}...`);
        nxRuns = await syncNxCloudRuns(
          db,
          workflow,
          branches,
          sinceMs,
          agentCreditsPerMin,
          excludeBranches
        );
      } catch (e: any) {
        console.log(`    NX Cloud: error — ${e.message}`);
        nxRuns = dbGetRuns(db, 'nx', workflow);
      }
    }

    // Scope the report to the time window even if the DB has older cached runs.
    circleRuns = circleRuns.filter((r) => new Date(r.createdAt).getTime() >= sinceMs);
    nxRuns = nxRuns.filter((r) => new Date(r.createdAt).getTime() >= sinceMs);

    const circleReport = buildReport('CircleCI', workflow, branches, circleRuns);
    const nxReport = buildReport('NX Cloud', workflow, branches, nxRuns);

    printReport(circleReport);
    printReport(nxReport);

    if (circleRuns.length > 0 && nxRuns.length > 0) {
      printComparison(circleReport, nxReport);
    }
    if (circleRuns.length > 0 || nxRuns.length > 0) {
      printFlakeAnalysis(circleReport, nxReport);
    }

    if (showRuns) {
      if (circleRuns.length > 0) printRunsTable(circleReport);
      if (nxRuns.length > 0) printRunsTable(nxReport);
    }
  }

  // Backfill per-CIPE retry stats for any NX CIPEs that pre-date this schema.
  // Only hits the API for CIPEs still missing a row — idempotent on re-run.
  if (!reportOnly) {
    console.log(`\n  Backfilling NX per-CIPE retry stats...`);
    try {
      await backfillNxCipeRetryStats(db);
    } catch (e: any) {
      console.log(`    NX retry backfill: error — ${e.message}`);
    }

    console.log(`\n  Backfilling NX per-CIPE cache stats...`);
    try {
      await backfillNxCacheStats(db);
    } catch (e: any) {
      console.log(`    NX cache backfill: error — ${e.message}`);
    }

    console.log(`\n  Backfilling NX per-CIPE task detail (for real cache savings)...`);
    try {
      await backfillNxRunTasks(db);
    } catch (e: any) {
      console.log(`    NX run-tasks backfill: error — ${e.message}`);
    }
  }

  // Workspace-level flaky-task analytics (not per-workflow). Stored once per
  // calendar day so re-running the sync doesn't hit the API again.
  if (!reportOnly && !skipFlakyAnalytics) {
    console.log(`\n  Fetching NX flaky-task analytics (${flakyRange}d)...`);
    try {
      await syncNxFlakyAnalytics(db, flakyRange);
    } catch (e: any) {
      console.log(`    NX flaky analytics: error — ${e.message}`);
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log('  Notes:');
  console.log('  - CircleCI credits: actual credits_used from Insights API');
  console.log(
    `  - NX Cloud credits: ${process.env.NX_CLOUD_SESSION ? 'actual from dashboard API (exact)' : 'estimated from agent timing (~6% overcount)'}`
  );
  console.log('  - Both platforms use identical credits/min per resource class');
  console.log(`  - CircleCI cost: $${CIRCLECI_CREDIT_TO_USD}/credit (Performance plan)`);
  console.log(
    `  - NX Cloud cost: $${NX_CREDIT_TO_USD}/credit + ${NX_CREDITS_PER_CIPE} credits/CIPE (Enterprise plan)`
  );
  console.log(`  - Data cached in ${DB_PATH}`);
  console.log(`${'═'.repeat(60)}\n`);

  db.close();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
