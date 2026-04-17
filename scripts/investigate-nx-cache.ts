/**
 * Investigation script (read-only): dumps the full /cipes/{id}/analysis response
 * and /runs/{runId} response for a sample NX CIPE so we can see whether NX
 * exposes a direct "cache savings" field anywhere.
 *
 * Usage:
 *   NX_CLOUD_SESSION=... yarn jiti scripts/investigate-nx-cache.ts [cipeId]
 *
 * Prints the full JSON tree, highlighting any keys that look cache-related.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// @ts-expect-error - no type declarations for ini
import { parse as parseIni } from 'ini';

const NX_CLOUD_URL = 'https://cloud.nx.app';
const NX_CLOUD_ID = '6929fbef73e98d8094d2a343';

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

/** Walk object, return list of paths whose key OR value references 'cache' or 'saving'. */
function findCacheKeys(obj: unknown, path: string[] = [], out: string[] = []): string[] {
  if (obj === null || obj === undefined) return out;
  if (typeof obj !== 'object') return out;
  if (Array.isArray(obj)) {
    // Sample first element only.
    if (obj.length > 0) findCacheKeys(obj[0], [...path, '[0]'], out);
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const lk = k.toLowerCase();
    if (lk.includes('cache') || lk.includes('saving') || lk.includes('saved') || lk.includes('ttg')) {
      const shown = typeof v === 'object' ? `<${Array.isArray(v) ? 'array' : 'object'}>` : JSON.stringify(v);
      out.push(`${[...path, k].join('.')} = ${shown}`);
    }
    findCacheKeys(v, [...path, k], out);
  }
  return out;
}

async function main() {
  const session = process.env.NX_CLOUD_SESSION;
  if (!session) {
    console.error('NX_CLOUD_SESSION not set');
    process.exit(1);
  }

  const cipeId = process.argv[2] ?? '69df84f0e9d67243b3604a31';
  console.log(`Investigating CIPE ${cipeId}`);

  // First, find the runGroupName for this CIPE.
  const details = await fetch(`${NX_CLOUD_URL}/nx-cloud/mcp-context/pipeline-executions/${cipeId}`, {
    headers: getNxCloudHeaders(),
  }).then((r) => r.json());
  const rg = details?.runGroups?.[0]?.runGroupName;
  console.log(`  runGroup: ${rg}`);
  console.log(`  CIPE keys: ${Object.keys(details).join(', ')}`);

  // Analysis endpoint.
  console.log(`\n─── /cipes/${cipeId}/analysis ───`);
  const analysisUrl = `${NX_CLOUD_URL}/cipes/${cipeId}/analysis?runGroup=${encodeURIComponent(rg)}&_data=routes%2F_auth.cipes.%24cipeId.analysis`;
  const analysisRes = await fetch(analysisUrl, { headers: { Cookie: `_nxCloudSession=${session}` } });
  if (!analysisRes.ok) {
    console.log(`  HTTP ${analysisRes.status}`);
    process.exit(1);
  }
  const analysis = await analysisRes.json();
  console.log(`  top-level keys: ${Object.keys(analysis).join(', ')}`);
  if (analysis?.ciPipelineExecution) {
    console.log(`  ciPipelineExecution keys: ${Object.keys(analysis.ciPipelineExecution).join(', ')}`);
  }
  if (analysis?.ciPipelineExecution?.ttgImpactMetadata) {
    console.log(`  ttgImpactMetadata keys: ${Object.keys(analysis.ciPipelineExecution.ttgImpactMetadata).join(', ')}`);
    console.log(`  ttgImpactMetadata:`);
    console.log(JSON.stringify(analysis.ciPipelineExecution.ttgImpactMetadata, null, 2).slice(0, 4000));
  }
  if (analysis?.ciPipelineExecution?.duration) {
    console.log(`\n  duration: ${JSON.stringify(analysis.ciPipelineExecution.duration, null, 2)}`);
  }
  if (analysis?.ciPipelineExecution?.runGroups) {
    const rgs = analysis.ciPipelineExecution.runGroups;
    if (Array.isArray(rgs) && rgs[0]) {
      console.log(`\n  runGroups[0] keys: ${Object.keys(rgs[0]).join(', ')}`);
      if (rgs[0].duration) {
        console.log(`  runGroups[0].duration: ${JSON.stringify(rgs[0].duration, null, 2)}`);
      }
    }
  }
  if (analysis?.computeCreditUsages) {
    console.log(`  computeCreditUsages: ${JSON.stringify(analysis.computeCreditUsages)}`);
  }
  if (analysis?.resourceClasses) {
    console.log(`  resourceClasses: ${JSON.stringify(analysis.resourceClasses)}`);
  }

  console.log(`\n  ─── cache-related keys anywhere in /cipes/${cipeId}/analysis ───`);
  for (const line of findCacheKeys(analysis)) {
    console.log(`  ${line}`);
  }

  // Runs search + detail.
  const runSearch = await fetch(`${NX_CLOUD_URL}/nx-cloud/mcp-context/runs/search`, {
    method: 'POST',
    headers: getNxCloudHeaders(),
    body: JSON.stringify({ pipelineExecutionId: cipeId, limit: 5 }),
  }).then((r) => r.json());

  const mainRun = runSearch.items?.[0];
  if (!mainRun) {
    console.log('\n  no runs found');
    return;
  }
  console.log(`\n─── /runs/${mainRun.id} ───`);
  console.log(`  run keys (from search): ${Object.keys(mainRun).join(', ')}`);

  const runDetail = await fetch(`${NX_CLOUD_URL}/nx-cloud/mcp-context/runs/${mainRun.id}`, {
    headers: getNxCloudHeaders(),
  }).then((r) => r.json());
  console.log(`  run detail top-level keys: ${Object.keys(runDetail).join(', ')}`);
  if (Array.isArray(runDetail?.tasks) && runDetail.tasks[0]) {
    console.log(`  tasks[0] keys: ${Object.keys(runDetail.tasks[0]).join(', ')}`);
    console.log(`  tasks[0]: ${JSON.stringify(runDetail.tasks[0], null, 2)}`);
    console.log(`  total tasks: ${runDetail.tasks.length}`);
    const cacheHitCount = runDetail.tasks.filter((t: any) => (t.cacheStatus ?? '').includes('cache-hit')).length;
    const cacheMissCount = runDetail.tasks.filter((t: any) => t.cacheStatus === 'cache-miss').length;
    console.log(`  hits: ${cacheHitCount}, misses: ${cacheMissCount}`);

    const statuses: Record<string, number> = {};
    for (const t of runDetail.tasks) {
      const cs = t.cacheStatus ?? '(none)';
      statuses[cs] = (statuses[cs] ?? 0) + 1;
    }
    console.log(`  cacheStatus distribution: ${JSON.stringify(statuses)}`);

    // Compare durations for cache-hit vs cache-miss.
    const hits = runDetail.tasks.filter((t: any) => (t.cacheStatus ?? '').includes('cache-hit'));
    const misses = runDetail.tasks.filter((t: any) => t.cacheStatus === 'cache-miss');
    const hitsMs = hits.reduce((s: number, t: any) => s + (t.durationMs ?? 0), 0);
    const missMs = misses.reduce((s: number, t: any) => s + (t.durationMs ?? 0), 0);
    console.log(`  sum(durationMs) for hits:   ${hitsMs}  (avg ${Math.round(hitsMs / Math.max(hits.length, 1))}ms)`);
    console.log(`  sum(durationMs) for misses: ${missMs}  (avg ${Math.round(missMs / Math.max(misses.length, 1))}ms)`);
    console.log(
      `  sample hit task: ${JSON.stringify(hits[0] ?? null, null, 2)}`
    );
  }

  console.log(`\n  ─── cache-related keys anywhere in /runs/${mainRun.id} ───`);
  for (const line of findCacheKeys(runDetail)) {
    console.log(`  ${line}`);
  }

  // Dashboard /cipes/{id} page route (sometimes has extra summary data).
  console.log(`\n─── /cipes/${cipeId}?_data=routes/_auth.cipes.$cipeId ───`);
  const summaryUrl = `${NX_CLOUD_URL}/cipes/${cipeId}?_data=routes%2F_auth.cipes.%24cipeId`;
  const summaryRes = await fetch(summaryUrl, { headers: { Cookie: `_nxCloudSession=${session}` } });
  if (summaryRes.ok) {
    const summary = await summaryRes.json();
    console.log(`  top-level keys: ${Object.keys(summary).join(', ')}`);
    console.log(`\n  ─── cache-related keys anywhere in /cipes/${cipeId} ───`);
    for (const line of findCacheKeys(summary)) {
      console.log(`  ${line}`);
    }
  } else {
    console.log(`  HTTP ${summaryRes.status}`);
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
