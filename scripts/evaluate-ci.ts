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
 *   yarn jiti scripts/evaluate-ci.ts
 *   yarn jiti scripts/evaluate-ci.ts --workflow normal
 *   yarn jiti scripts/evaluate-ci.ts --workflow daily --limit 50
 *   yarn jiti scripts/evaluate-ci.ts --report-only
 *   yarn jiti scripts/evaluate-ci.ts --show-runs
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

const WORKSPACE_ROOT = join(import.meta.dirname, '..');
const DB_PATH = join(import.meta.dirname, 'ci-eval.db');

const EVAL_BRANCHES: Record<string, string[]> = {
  normal: ['kasper/nx-eval-normal'],
  merged: ['kasper/nx-eval-merged'],
  daily: ['kasper/nx-eval-daily-1', 'kasper/nx-eval-daily-2'],
  'base (nx-ai)': ['kasper/nx-ai'],
  'next:merged': ['next'],
  'next:daily': ['next'],
};

const WORKFLOW_NAMES: Record<string, string> = {
  normal: 'normal-generated',
  merged: 'merged-generated',
  daily: 'daily-generated',
  'base (nx-ai)': 'daily-generated',
  'next:merged': 'merged-generated',
  'next:daily': 'daily-generated',
};

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
      cost_usd REAL NOT NULL
    );
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
    CREATE INDEX IF NOT EXISTS idx_runs_system_workflow ON runs(system, workflow);
    CREATE INDEX IF NOT EXISTS idx_failed_tasks_run_id ON failed_tasks(run_id);
    CREATE INDEX IF NOT EXISTS idx_nx_template_credits_run_id ON nx_template_credits(run_id);
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
    `INSERT OR IGNORE INTO runs (id, system, workflow, branch, status, created_at, duration_sec, credits_used, cost_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
    run.costUsd
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
      `SELECT id, status, created_at, duration_sec, credits_used, cost_usd
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
      failedJobs: failedRows.map((r) => r.task_name),
      ...(creditRows.length > 0 ? { nxPerTemplate, nxResourceClasses } : {}),
    };
  });
}

// ─── Auth ────────────────────────────────────────────────────────────────────

function getCircleToken(): string {
  const token = process.env.CIRCLE_TOKEN;
  if (!token) throw new Error('CIRCLE_TOKEN env var required');
  return token;
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
  return fetchJSON<T>(`https://circleci.com/api/v2${path}`, {
    headers: { 'Circle-Token': getCircleToken() },
  });
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

async function syncCircleCIRuns(
  db: InstanceType<typeof DatabaseSync>,
  workflow: string,
  branches: string[],
  workflowName: string,
  limit: number
): Promise<CIRun[]> {
  const existingIds = dbGetExistingIds(db, 'circleci', workflow);
  const newRuns: CIRun[] = [];
  let skipped = 0;

  for (const branch of branches) {
    let pageToken: string | undefined;
    let fetched = 0;

    while (fetched < limit) {
      const params = new URLSearchParams({ branch });
      if (pageToken) params.set('page-token', pageToken);

      const data = await circleFetch<{
        items: CircleInsightsRun[];
        next_page_token: string | null;
      }>(`/insights/${CIRCLECI_PROJECT}/workflows/${workflowName}?${params}`);

      for (const run of data.items) {
        if (fetched >= limit) break;
        if (run.status === 'canceled' || run.status === 'not_run') continue;

        if (existingIds.has(run.id)) {
          skipped++;
          fetched++;
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

        const ciRun: CIRun = {
          id: run.id,
          status: run.status,
          createdAt: run.created_at,
          durationSec: run.duration,
          creditsUsed: run.credits_used,
          costUsd: run.credits_used * CIRCLECI_CREDIT_TO_USD,
          failedJobs,
        };

        dbInsertRun(db, 'circleci', workflow, branch, ciRun);
        newRuns.push(ciRun);
        fetched++;
      }

      pageToken = data.next_page_token ?? undefined;
      if (!pageToken) break;
    }
  }

  if (skipped > 0) console.log(`    CircleCI: ${skipped} cached, ${newRuns.length} new`);
  else console.log(`    CircleCI: ${newRuns.length} new runs`);

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
  vcsContext?: { ref?: string };
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

interface NxDashboardCredits {
  totalCredits: number;
  perTemplate: Record<string, number>;
  resourceClasses: Record<string, number>;
}

async function fetchNxDashboardCredits(
  cipeId: string,
  runGroupName: string
): Promise<NxDashboardCredits | null> {
  const session = process.env.NX_CLOUD_SESSION;
  if (!session) return null;

  try {
    const url = `${NX_CLOUD_URL}/cipes/${cipeId}/analysis?runGroup=${encodeURIComponent(runGroupName)}&_data=routes%2F_auth.cipes.%24cipeId.analysis`;
    const res = await fetch(url, {
      headers: { Cookie: `_nxCloudSession=${session}` },
    });
    if (!res.ok) return null;

    const data = await res.json();
    const usages = data?.computeCreditUsages as
      | Record<string, { totalCredits: number }>
      | undefined;
    if (!usages) return null;

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
    return { totalCredits: total, perTemplate, resourceClasses };
  } catch {
    return null;
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
  limit: number,
  agentCreditsPerMin: Record<string, number>
): Promise<CIRun[]> {
  const existingIds = dbGetExistingIds(db, 'nx', workflow);
  const newRuns: CIRun[] = [];
  let skipped = 0;
  const hasDashboardAccess = !!process.env.NX_CLOUD_SESSION;

  const prNumbers = await Promise.all(branches.map(resolvePRNumber));

  const searchResult = await nxCloudFetch<NxPipelineSearchResult>('/pipeline-executions/search', {
    branches: prNumbers,
    statuses: ['SUCCEEDED', 'FAILED'],
    limit,
  });

  for (const item of searchResult.items) {
    if (!item.completedAtMs) continue;
    if (
      item.status === 'IN_PROGRESS' ||
      item.status === 'NOT_STARTED' ||
      item.status === 'CANCELED'
    )
      continue;

    if (!prNumbers.includes(item.branch)) continue;

    if (existingIds.has(item.id)) {
      skipped++;
      continue;
    }

    const details = await nxCloudFetch<NxPipelineExecution>(`/pipeline-executions/${item.id}`);

    // Fetch runs once — used for duration, command tag matching, and failed task names
    let runItems: { id: string; status: string; durationMs: number; command: string }[] = [];
    try {
      const runSearch = await nxCloudFetch<{
        items: { id: string; status: string; durationMs: number; command: string }[];
      }>('/runs/search', { pipelineExecutionId: item.id, limit: 5 });
      runItems = runSearch.items;
    } catch {}

    // Match workflow by checking the tag in the nx command (e.g. tag:ci:daily vs tag:ci:merged)
    const NX_TAG_MAP: Record<string, string> = {
      normal: 'ci:normal',
      merged: 'ci:merged',
      daily: 'ci:daily',
      'base (nx-ai)': 'ci:daily',
      'next:merged': 'ci:merged',
      'next:daily': 'ci:daily',
    };
    const expectedTag = NX_TAG_MAP[workflow];
    if (expectedTag) {
      const mainRun = runItems.find((r) => r.command?.includes('tag:'));
      if (mainRun && !mainRun.command.includes(`tag:${expectedTag}`)) continue;
    }

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

    const dashboardCredits = firstRunGroup
      ? await fetchNxDashboardCredits(item.id, firstRunGroup.runGroupName)
      : null;

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
      nxPerTemplate: dashboardCredits?.perTemplate,
      nxResourceClasses: dashboardCredits?.resourceClasses,
    };

    dbInsertRun(db, 'nx', workflow, branches[0], ciRun);
    newRuns.push(ciRun);
  }

  if (hasDashboardAccess) {
    console.log(`    NX Cloud: exact credits from dashboard API`);
  } else {
    console.log(`    NX Cloud: estimated credits (set NX_CLOUD_SESSION for exact)`);
  }
  if (skipped > 0) console.log(`    NX Cloud: ${skipped} cached, ${newRuns.length} new`);
  else console.log(`    NX Cloud: ${newRuns.length} new runs`);

  return dbGetRuns(db, 'nx', workflow);
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
  const TARGET_RATE = 15;
  let total = 0;
  let count = 0;

  for (const run of runs) {
    if (!run.nxPerTemplate || !run.nxResourceClasses) continue;
    let predicted = NX_CREDITS_PER_CIPE;
    for (const [tmpl, credits] of Object.entries(run.nxPerTemplate)) {
      const actualRate = run.nxResourceClasses[tmpl];
      if (actualRate && actualRate !== TARGET_RATE) {
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
  const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : 100;
  const reportOnly = args.includes('--report-only');
  const showRuns = args.includes('--show-runs');

  const workflows = workflowFilter ? [workflowFilter] : Object.keys(EVAL_BRANCHES);

  const db = initDB();
  const agentCreditsPerMin = loadNxAgentCreditsPerMin();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           CI Evaluation: NX Cloud vs CircleCI           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Date: ${new Date().toISOString()}`);
  console.log(`  Workflows: ${workflows.join(', ')}`);
  console.log(`  Limit: ${limit} runs per system per workflow`);
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
      try {
        console.log(`    CircleCI: querying branches ${branches.join(', ')}...`);
        circleRuns = await syncCircleCIRuns(db, workflow, branches, workflowName, limit);
      } catch (e: any) {
        console.log(`    CircleCI: error — ${e.message}`);
        circleRuns = dbGetRuns(db, 'circleci', workflow);
      }

      try {
        console.log(`    NX Cloud: querying branches ${branches.join(', ')}...`);
        nxRuns = await syncNxCloudRuns(db, workflow, branches, limit, agentCreditsPerMin);
      } catch (e: any) {
        console.log(`    NX Cloud: error — ${e.message}`);
        nxRuns = dbGetRuns(db, 'nx', workflow);
      }
    }

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
