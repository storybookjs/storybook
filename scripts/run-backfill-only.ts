/**
 * One-off: run just the new backfills without a full re-sync.
 * Runs:
 *   1. backfillNxCipeRetryStats  (picks up hypothetical_no_cache_ms on pre-existing rows)
 *   2. backfillNxRunTasks        (populates the new nx_run_tasks table)
 *
 * Safe to re-run — both backfills are idempotent.
 *
 * Usage:
 *   NX_CLOUD_SESSION=... yarn jiti scripts/run-backfill-only.ts
 */
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
// @ts-expect-error - no type declarations for ini
import { parse as parseIni } from 'ini';

const NX_CLOUD_URL = 'https://cloud.nx.app';
const NX_CLOUD_ID = '6929fbef73e98d8094d2a343';
const DB_PATH = join(import.meta.dirname, 'ci-eval.db');

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

async function nxCloudFetch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${NX_CLOUD_URL}/nx-cloud/mcp-context${path}`, {
    method: body ? 'POST' : 'GET',
    headers: getNxCloudHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

interface NxPipelineExecution {
  runGroups: { runGroupName: string }[];
}

async function fetchNxDashboardCipeAnalysis(
  cipeId: string,
  runGroupName: string
): Promise<{
  retryStats: {
    totalTasks: number;
    totalTaskRetries: number;
    successfulRetries: number;
    failedRetries: number;
    hypotheticalNoCacheMs: number | null;
  } | null;
}> {
  const session = process.env.NX_CLOUD_SESSION;
  if (!session) return { retryStats: null };
  try {
    const url = `${NX_CLOUD_URL}/cipes/${cipeId}/analysis?runGroup=${encodeURIComponent(runGroupName)}&_data=routes%2F_auth.cipes.%24cipeId.analysis`;
    const res = await fetch(url, { headers: { Cookie: `_nxCloudSession=${session}` } });
    if (!res.ok) return { retryStats: null };
    const data = await res.json();
    const retryRaw = data?.ciPipelineExecution?.ttgImpactMetadata?.taskRetryStats;
    const hypoMs = data?.ciPipelineExecution?.duration?.hypotheticalNoCacheMs;
    const hypothetical =
      typeof hypoMs === 'number' && Number.isFinite(hypoMs) ? Math.round(hypoMs) : null;
    if (!retryRaw) return { retryStats: null };
    return {
      retryStats: {
        totalTasks: retryRaw.totalTasks ?? 0,
        totalTaskRetries: retryRaw.totalTaskRetries ?? 0,
        successfulRetries: retryRaw.successfulRetries ?? 0,
        failedRetries: retryRaw.failedRetries ?? 0,
        hypotheticalNoCacheMs: hypothetical,
      },
    };
  } catch {
    return { retryStats: null };
  }
}

const LINUX_JS_TARGETS = new Set(['compile', 'check', 'lint', 'knip', 'fmt']);
function inferAgentTemplate(target: string): 'linux-js' | 'linux-browsers-js' {
  return LINUX_JS_TARGETS.has(target) ? 'linux-js' : 'linux-browsers-js';
}

async function backfillNxCipeRetryStats(db: InstanceType<typeof DatabaseSync>) {
  if (!process.env.NX_CLOUD_SESSION) {
    console.log(`NX retry backfill: skipped (NX_CLOUD_SESSION not set)`);
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
    console.log(`NX retry backfill: up to date`);
    return;
  }
  console.log(`NX retry backfill: fetching for ${missing.length} CIPEs...`);

  const upsert = db.prepare(
    `INSERT OR REPLACE INTO nx_cipe_retry_stats
       (run_id, total_tasks, total_task_retries, successful_retries, failed_retries, hypothetical_no_cache_ms)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  let stored = 0,
    apiFailures = 0;
  const startTime = Date.now();
  for (let i = 0; i < missing.length; i++) {
    const { id } = missing[i];
    try {
      const details = await nxCloudFetch<NxPipelineExecution>(`/pipeline-executions/${id}`);
      const rg = details.runGroups[0]?.runGroupName;
      if (!rg) continue;
      const { retryStats: rs } = await fetchNxDashboardCipeAnalysis(id, rg);
      if (!rs) {
        apiFailures++;
        continue;
      }
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
    if (i % 25 === 24) {
      const rate = ((i + 1) / ((Date.now() - startTime) / 1000)).toFixed(1);
      console.log(`  ${i + 1}/${missing.length} (${rate} CIPEs/sec)`);
    }
  }
  console.log(
    `NX retry backfill: stored ${stored} / ${missing.length}` +
      (apiFailures > 0 ? ` (${apiFailures} API failures)` : '')
  );
}

async function backfillNxRunTasks(db: InstanceType<typeof DatabaseSync>) {
  const missing = db
    .prepare(
      `SELECT r.id FROM runs r
        WHERE r.system = 'nx'
          AND NOT EXISTS (SELECT 1 FROM nx_run_tasks t WHERE t.run_id = r.id)
        ORDER BY r.created_at DESC`
    )
    .all() as { id: string }[];

  if (missing.length === 0) {
    console.log(`NX run-tasks backfill: up to date`);
    return;
  }

  console.log(`NX run-tasks backfill: fetching for ${missing.length} CIPEs...`);

  const rateStmt = db.prepare(
    `SELECT template, credit_multiplier FROM nx_template_credits WHERE run_id = ?`
  );

  const insert = db.prepare(
    `INSERT OR IGNORE INTO nx_run_tasks
       (run_id, task_id, project, target, duration_ms, cache_status, agent_template, credits_per_min)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let stored = 0,
    apiFailures = 0,
    skipped = 0,
    totalTaskRows = 0;
  const startTime = Date.now();

  for (let i = 0; i < missing.length; i++) {
    const { id } = missing[i];
    try {
      const runSearch = await nxCloudFetch<{ items: { id: string; command?: string }[] }>(
        '/runs/search',
        { pipelineExecutionId: id, limit: 5 }
      );
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
    if (i % 25 === 24) {
      const rate = ((i + 1) / ((Date.now() - startTime) / 1000)).toFixed(1);
      console.log(
        `  ${i + 1}/${missing.length} (${rate} CIPEs/sec, ${totalTaskRows} task rows so far)`
      );
    }
  }

  console.log(
    `NX run-tasks backfill: stored ${totalTaskRows} task rows across ${stored} / ${missing.length} CIPEs` +
      (skipped > 0 ? `, skipped ${skipped}` : '') +
      (apiFailures > 0 ? ` (${apiFailures} API failures)` : '')
  );
}

async function main() {
  const db = new DatabaseSync(DB_PATH);
  console.log(`DB: ${DB_PATH}\n`);

  console.log('── Retry stats backfill (hypothetical_no_cache_ms) ──');
  await backfillNxCipeRetryStats(db);

  console.log('\n── Run-tasks backfill ──');
  await backfillNxRunTasks(db);

  db.close();
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
