/**
 * CI Evaluation Script: NX Cloud vs CircleCI
 *
 * Compares flakiness, speed, and cost across evaluation branches.
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
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseIni } from 'ini';
import { parse as parseYaml } from 'yaml';

// ─── Configuration ───────────────────────────────────────────────────────────

const CIRCLECI_PROJECT = 'gh/storybookjs/storybook';
const NX_CLOUD_URL = 'https://cloud.nx.app';
const NX_CLOUD_ID = '6929fbef73e98d8094d2a343';

const WORKSPACE_ROOT = join(import.meta.dirname, '..');

const EVAL_BRANCHES: Record<string, string[]> = {
  normal: ['kasper/nx-eval-normal'],
  merged: ['kasper/nx-eval-merged'],
  daily: ['kasper/nx-eval-daily-1', 'kasper/nx-eval-daily-2'],
};

const WORKFLOW_NAMES: Record<string, string> = {
  normal: 'normal-generated',
  merged: 'merged-generated',
  daily: 'daily-generated',
};

// ─── Pricing ─────────────────────────────────────────────────────────────────

// Both platforms use identical credit rates per resource class.
const CREDIT_TO_USD = 0.0006;

const NX_CREDITS_PER_CIPE = 500;

// NX Cloud credits/min per resource class (from https://nx.dev/docs/reference/nx-cloud/credits-pricing)
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

/**
 * Read .nx/workflows/agents.yaml to build a map from launch template name
 * to credits/min based on the actual resource-class configured.
 */
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

// CircleCI Insights API returns credits_used directly — no estimation needed.

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

async function getCircleCIRuns(
  branches: string[],
  workflowName: string,
  limit: number
): Promise<CIRun[]> {
  const runs: CIRun[] = [];

  for (const branch of branches) {
    let pageToken: string | undefined;

    while (runs.length < limit) {
      const params = new URLSearchParams({ branch });
      if (pageToken) params.set('page-token', pageToken);

      const data = await circleFetch<{
        items: CircleInsightsRun[];
        next_page_token: string | null;
      }>(`/insights/${CIRCLECI_PROJECT}/workflows/${workflowName}?${params}`);

      for (const run of data.items) {
        if (runs.length >= limit) break;

        const failedJobs: string[] = [];
        if (run.status === 'failed') {
          try {
            const jobsData = await circleFetch<{ items: CircleJob[] }>(`/workflow/${run.id}/job`);
            for (const job of jobsData.items) {
              if (job.status === 'failed') failedJobs.push(job.name);
            }
          } catch {}
        }

        runs.push({
          id: run.id,
          status: run.status,
          createdAt: run.created_at,
          durationSec: run.duration,
          creditsUsed: run.credits_used,
          costUsd: run.credits_used * CREDIT_TO_USD,
          failedJobs,
        });
      }

      pageToken = data.next_page_token ?? undefined;
      if (!pageToken) break;
    }
  }

  return runs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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

    let total = NX_CREDITS_PER_CIPE;
    const perTemplate: Record<string, number> = {};
    for (const [tmpl, info] of Object.entries(usages)) {
      perTemplate[tmpl] = info.totalCredits;
      total += info.totalCredits;
    }
    return { totalCredits: total, perTemplate };
  } catch {
    return null;
  }
}

async function getNxCloudRuns(
  branches: string[],
  limit: number,
  agentCreditsPerMin: Record<string, number>
): Promise<CIRun[]> {
  const runs: CIRun[] = [];
  const hasDashboardAccess = !!process.env.NX_CLOUD_SESSION;

  const searchResult = await nxCloudFetch<NxPipelineSearchResult>('/pipeline-executions/search', {
    branches: branches.map(branchToPRNumber),
    limit,
  });

  for (const item of searchResult.items) {
    if (!item.completedAtMs) continue;
    if (item.status === 'IN_PROGRESS' || item.status === 'NOT_STARTED') continue;

    const ref = item.vcsContext?.ref ?? '';
    if (!branches.some((b) => ref === b || item.branch === branchToPRNumber(b))) continue;

    const details = await nxCloudFetch<NxPipelineExecution>(`/pipeline-executions/${item.id}`);

    const durationSec = details.durationMs / 1000;
    const failedJobs: string[] = [];

    for (const rg of details.runGroups) {
      if (rg.status === 'FAILED') failedJobs.push(rg.runGroupName);
    }

    // Try exact credits from dashboard API first, fall back to estimation
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

    runs.push({
      id: item.id,
      status: item.status,
      createdAt: new Date(item.createdAtMs).toISOString(),
      durationSec,
      creditsUsed: Math.round(totalNxCredits),
      costUsd: totalNxCredits * CREDIT_TO_USD,
      failedJobs,
    });
  }

  if (hasDashboardAccess) {
    console.log(`    NX Cloud: using exact credits from dashboard API`);
  } else {
    console.log(`    NX Cloud: using estimated credits (set NX_CLOUD_SESSION for exact data)`);
  }

  return runs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

/**
 * NX Cloud stores branch as PR number. We need to resolve branch names
 * to PR numbers for filtering. For now, we return the branch name and
 * also check the vcsContext.ref in the results.
 */
function branchToPRNumber(branch: string): string {
  return branch;
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
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const workflowFilter = args.includes('--workflow')
    ? args[args.indexOf('--workflow') + 1]
    : undefined;
  const limit = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1], 10) : 100;

  const workflows = workflowFilter ? [workflowFilter] : Object.keys(EVAL_BRANCHES);

  const agentCreditsPerMin = loadNxAgentCreditsPerMin();

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║           CI Evaluation: NX Cloud vs CircleCI           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Date: ${new Date().toISOString()}`);
  console.log(`  Workflows: ${workflows.join(', ')}`);
  console.log(`  Limit: ${limit} runs per system per workflow`);
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

    try {
      console.log(`    CircleCI: querying branches ${branches.join(', ')}...`);
      circleRuns = await getCircleCIRuns(branches, workflowName, limit);
      console.log(`    CircleCI: found ${circleRuns.length} completed runs`);
    } catch (e: any) {
      console.log(`    CircleCI: error — ${e.message}`);
    }

    try {
      console.log(`    NX Cloud: querying branches ${branches.join(', ')}...`);
      nxRuns = await getNxCloudRuns(branches, limit, agentCreditsPerMin);
      console.log(`    NX Cloud: found ${nxRuns.length} completed runs`);
    } catch (e: any) {
      console.log(`    NX Cloud: error — ${e.message}`);
    }

    const circleReport = buildReport('CircleCI', workflow, branches, circleRuns);
    const nxReport = buildReport('NX Cloud', workflow, branches, nxRuns);

    printReport(circleReport);
    printReport(nxReport);

    if (circleRuns.length > 0 && nxRuns.length > 0) {
      printComparison(circleReport, nxReport);
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log('  Notes:');
  console.log('  - CircleCI credits: actual credits_used from Insights API');
  console.log(
    `  - NX Cloud credits: ${process.env.NX_CLOUD_SESSION ? 'actual from dashboard API (exact)' : 'estimated from agent timing (~6% overcount)'}`
  );
  console.log('  - Both platforms use identical credits/min per resource class');
  console.log(`  - Dollar estimates use $${CREDIT_TO_USD}/credit for both`);
  console.log(`${'═'.repeat(60)}\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
