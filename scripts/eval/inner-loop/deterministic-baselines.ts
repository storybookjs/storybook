/**
 * Experiment O — score deterministic clustering baselines against the
 * recorded LLM clusters from previously-run JSONLs. Outputs a JSON the
 * report consumes.
 *
 * For each LLM run with parsed clusters and scores:
 *   - Reconstruct the ChangeContextPayload from the JSONL row.
 *   - Run `clusterByNamespace` and `clusterBySharedChangedFiles`.
 *   - Score them with the SAME `score()` function used for the LLM.
 *   - Compute deltas (e.g. LLM purity − namespace purity).
 *
 * Run with:
 *   node --experimental-transform-types --no-warnings \
 *     scripts/eval/inner-loop/deterministic-baselines.ts
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clusterByNamespace,
  clusterBySharedChangedFiles,
} from './lib/deterministic-clusters.ts';
import { score } from './lib/score.ts';
import type { ChangeContextPayload } from './lib/build-payload.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(HERE, 'results');

interface RunRow {
  timestamp: string;
  scenario: string;
  edit?: { path: string };
  rawDiff?: string;
  payload: {
    modified?: string[];
    affected?: string[];
    newStories?: string[];
    cssAffected?: string[];
    estimatedTokens?: number;
  } & Record<string, unknown>;
  agentRun: null | {
    model: string;
    promptVariant?: string;
    clusters?: { id: string; storyCount: number; stories?: string[] }[];
  };
  scores: null | {
    recall: number;
    precision: number;
    clusterPurity: number;
    groundTruthSize: number;
  };
}

function reconstructPayload(r: RunRow): ChangeContextPayload {
  return {
    modified: r.payload.modified ?? [],
    affected: r.payload.affected ?? [],
    new: r.payload.newStories ?? [],
    cssAffected: r.payload.cssAffected ?? [],
    rawDiff: [{ path: r.edit?.path ?? '?', hunks: r.rawDiff ?? '' }],
    projectShape: { totalStories: 0, topNamespaces: [] },
    reverseIndexSlice: [
      {
        changedFile: r.edit?.path ?? '?',
        importingStories: [...(r.payload.modified ?? []), ...(r.payload.affected ?? [])],
      },
    ],
  };
}

async function main() {
  const entries = await readdir(RESULTS_DIR);
  const rows: RunRow[] = [];
  for (const f of entries) {
    if (!f.endsWith('.jsonl')) continue;
    const text = await readFile(join(RESULTS_DIR, f), 'utf8');
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        rows.push(JSON.parse(line) as RunRow);
      } catch {}
    }
  }

  // Group rows by scenario for per-scenario aggregation. Take the first row
  // per scenario as representative for the deterministic baseline (the
  // payload is identical across runs of the same scenario).
  const byScenario = new Map<string, RunRow[]>();
  for (const r of rows) {
    if (!byScenario.has(r.scenario)) byScenario.set(r.scenario, []);
    byScenario.get(r.scenario)!.push(r);
  }

  const out: {
    timestamp: string;
    perScenario: Array<{
      scenario: string;
      cascadeSize: number;
      llm: {
        runs: number;
        avgPurity: number | null;
        avgClusterCount: number | null;
        promptVariant: string | null;
      };
      namespace: ReturnType<typeof score> & { clusterCount: number };
      sharedFiles: ReturnType<typeof score> & { clusterCount: number };
    }>;
    interpretation: string;
  } = {
    timestamp: new Date().toISOString(),
    perScenario: [],
    interpretation: `For each scenario:
  llm = average across all runs that produced parsed clusters
  namespace = clusterByNamespace(payload) — every story bucketed by storyId.split('--')[0]
  sharedFiles = clusterBySharedChangedFiles(payload) — every story bucketed by which subset of changed files it imports

CRITICAL READING NOTE: \`clusterPurity\` literally measures "fraction of
stories in a cluster sharing the dominant namespace prefix." So the
namespace baseline trivially scores 1.0 — its clusters ARE the namespace.
That doesn't mean it's a better clusterer; it means purity is a circular
metric for this comparison. The honest signal is **cluster count**:

  - Cluster count of 5-12 = UX-usable. User scans a manageable number of
    cards.
  - Cluster count above ~30 = unusable. Reverts to the original sidebar
    problem we set out to solve.
  - Cluster count of 1 = degenerate, no narrowing happened.

For synthetic single-file edits, shared-files always produces 1 cluster
(every story imports the same one file). Real multi-file changesets
(Experiment L) are where shared-files becomes informative.

The LLM's actual value over namespace baseline isn't purity — it's
**consolidating related namespaces** into a UX-usable count. Namespace
gives 118 clusters for medium-cascade; LLM gives 6. That's a 20×
reduction in cognitive load.

The LLM's actual value over shared-files baseline can only be measured
on multi-file changesets (Experiment L).`,
  };

  for (const [scenario, rs] of byScenario.entries()) {
    const cascadeSize = rs[0]?.payload?.modified?.length ?? 0;
    const cascadeAffected = rs[0]?.payload?.affected?.length ?? 0;
    const cascadeTotal = cascadeSize + cascadeAffected;
    if (cascadeTotal === 0) continue; // skip empty scenarios

    const payload = reconstructPayload(rs[0]);
    const nsClusters = clusterByNamespace(payload);
    const sfClusters = clusterBySharedChangedFiles(payload);
    const nsScore = score(payload, nsClusters);
    const sfScore = score(payload, sfClusters);

    // Aggregate LLM stats
    const llmRuns = rs.filter((r) => r.scores && (r.agentRun?.clusters?.length ?? 0) > 0);
    const avg = (xs: number[]) => (xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length);
    const avgPurity = avg(llmRuns.map((r) => r.scores!.clusterPurity));
    const avgClusterCount = avg(llmRuns.map((r) => r.agentRun!.clusters!.length));

    out.perScenario.push({
      scenario,
      cascadeSize: cascadeTotal,
      llm: {
        runs: llmRuns.length,
        avgPurity: avgPurity === null ? null : Math.round(avgPurity * 1000) / 1000,
        avgClusterCount,
        promptVariant: llmRuns[0]?.agentRun?.promptVariant ?? null,
      },
      namespace: { ...nsScore, clusterCount: nsClusters.length },
      sharedFiles: { ...sfScore, clusterCount: sfClusters.length },
    });
  }

  out.perScenario.sort((a, b) => a.cascadeSize - b.cascadeSize);

  await writeFile(
    join(RESULTS_DIR, 'deterministic-baselines.json'),
    JSON.stringify(out, null, 2)
  );
  console.log(`Wrote: ${join(RESULTS_DIR, 'deterministic-baselines.json')}`);
  console.log(`\nPer-scenario comparison (purity is the signal — recall/precision are 1.0 by construction for deterministic):`);
  for (const r of out.perScenario) {
    console.log(`\n  ${r.scenario} (cascade=${r.cascadeSize}):`);
    console.log(
      `    LLM (n=${r.llm.runs}):       purity=${r.llm.avgPurity ?? '-'} clusters=${r.llm.avgClusterCount?.toFixed(1) ?? '-'} (${r.llm.promptVariant ?? '-'})`
    );
    console.log(
      `    Namespace baseline:    purity=${r.namespace.clusterPurity} clusters=${r.namespace.clusterCount}`
    );
    console.log(
      `    Shared-files baseline: purity=${r.sharedFiles.clusterPurity} clusters=${r.sharedFiles.clusterCount}`
    );
  }
}

await main();
