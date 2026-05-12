/**
 * Reads every `*.jsonl` (and `css-blast-radius.json`) under
 * `scripts/eval/inner-loop/results/` and renders a single self-contained
 * HTML report that summarises agent-eval results.
 *
 * Sections:
 *   1. Overview — totals, model/prompt mix, summary scores per scenario
 *   2. Per-run detail — every individual JSONL row, with collapsible diff,
 *      payload, raw agent output, message trace, and clusters.
 *   3. Variance analysis — when multiple runs share the same scenario +
 *      model + prompt + effort, compute Jaccard similarity on cluster
 *      content + score deltas.
 *   4. CSS blast-radius synthesis — output of the css-blast experiment.
 *
 * Run with:
 *   node --experimental-transform-types --no-warnings \
 *     scripts/eval/inner-loop/build-report.ts [--out report.html]
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { TranscriptEntry } from './lib/invoke-agent.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = join(HERE, 'results');

interface SignatureQuality {
  variant: string;
  catchAllStoryCount: number;
  catchAllShare: number;
  representativeValidCount: number;
  representativeTotalCount: number;
  representativeValidRate: number;
  avgPrefixLength: number | null;
  avgRegexLength: number | null;
  shadowedClusterCount: number;
  clusterCount: number;
}

interface RunRow {
  timestamp: string;
  scenario: string;
  description: string;
  edit?: { path: string };
  rawDiff?: string;
  signatureQuality?: SignatureQuality | null;
  storyToFile?: Record<string, string>;
  groundTruth: {
    modified: number;
    affected: number;
    new: number;
    total: number;
    withinExpectedRange: boolean;
  };
  payload: {
    totalSizeBytes: number;
    estimatedTokens: number;
    modified?: string[];
    affected?: string[];
    newStories?: string[];
    cssAffected?: string[];
    projectShape?: { totalStories: number; topNamespaces: { name: string; count: number }[] };
    storyToFile?: Record<string, string>;
  };
  agentRun: null | {
    model: string;
    promptVariant?: string;
    effort?: string;
    turns: number;
    costUsd?: number;
    durationS: number;
    durationApiS?: number;
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    messageTrace?: {
      typeCounts: Record<string, number>;
      firstMessageMs?: number;
      lastMessageMs?: number;
      totalMessages: number;
      estimatedOutputTokens: number;
    };
    rawOutput?: string;
    clusterCount: number;
    clusters?: {
      id: string;
      rationale: string;
      representative: string;
      storyCount: number;
      stories: string[];
    }[];
    parseError?: string;
    /** SDK session id (`system.session_id`). Lets readers correlate the
     *  in-report transcript with the local Claude Code session log. */
    sessionId?: string;
    /** Compact, JSON-safe view of every SDK message exchanged with the
     *  agent (text/thinking/tool_use/tool_result/result), with elapsed-time
     *  annotations. Persisted inline so the report renders without spawning
     *  the SDK again. */
    transcript?: TranscriptEntry[];
  };
  scores: null | {
    recall: number;
    precision: number;
    clusterPurity: number;
    groundTruthSize: number;
    agentOutputSize: number;
    duplicateCount: number;
    hallucinationCount: number;
    missingCount: number;
  };
  runIndex?: number;
  runsTotal?: number;
  /** Synthesised at report-build time. */
  _file?: string;
}

interface CssBlastReport {
  timestamp: string;
  projectRoot: string;
  probes: string[];
  results: {
    changedCssFile: string;
    siblingFiles: string[];
    importingStories: string[];
    perSibling: { sibling: string; storyCount: number }[];
  }[];
  caveat: string;
}

function fmtNum(n: number | undefined, digits = 0): string {
  if (n === undefined || n === null) return '-';
  if (digits === 0) return Math.round(n).toLocaleString('en-US');
  return n.toFixed(digits);
}

function fmtCost(n: number | undefined): string {
  if (n === undefined || n === null) return '-';
  return '$' + n.toFixed(4);
}

function fmtPct(n: number | undefined): string {
  if (n === undefined || n === null) return '-';
  return (n * 100).toFixed(1) + '%';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Jaccard similarity for two sets of cluster contents. */
function jaccardClusters(a: string[][], b: string[][]): number {
  if (a.length === 0 && b.length === 0) return 1;
  // Best-pair match: for each cluster in A, find the cluster in B with max
  // Jaccard on stories. Average across A.
  if (a.length === 0 || b.length === 0) return 0;
  const sims: number[] = [];
  for (const ca of a) {
    let best = 0;
    const sa = new Set(ca);
    for (const cb of b) {
      const sb = new Set(cb);
      const inter = [...sa].filter((x) => sb.has(x)).length;
      const uni = new Set([...sa, ...sb]).size;
      const j = uni > 0 ? inter / uni : 0;
      if (j > best) best = j;
    }
    sims.push(best);
  }
  return sims.reduce((s, x) => s + x, 0) / sims.length;
}

function bucketKey(r: RunRow): string {
  return [
    r.scenario,
    r.agentRun?.model ?? 'no-agent',
    r.agentRun?.promptVariant ?? 'enumerate',
    r.agentRun?.effort ?? '-',
  ].join('|');
}

async function loadAllRuns(): Promise<RunRow[]> {
  const entries = await readdir(RESULTS_DIR);
  const out: RunRow[] = [];
  for (const f of entries) {
    if (!f.endsWith('.jsonl')) continue;
    // Replay JSONL has a different shape (commit-replay rows); loaded by loadReplayRows.
    if (f.startsWith('replay-real-') || f === 'replay-real.jsonl') continue;
    const text = await readFile(join(RESULTS_DIR, f), 'utf8');
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line) as RunRow;
        // Defensive — replay rows lack `scenario`; skip if so.
        if (!r.scenario || !r.payload) continue;
        r._file = f;
        out.push(r);
      } catch {}
    }
  }
  return out.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

async function loadCssBlast(): Promise<CssBlastReport | null> {
  try {
    const text = await readFile(join(RESULTS_DIR, 'css-blast-radius.json'), 'utf8');
    return JSON.parse(text) as CssBlastReport;
  } catch {
    return null;
  }
}

interface ModuleGraphReport {
  timestamp: string;
  buildMs: number;
  totalStoryFiles: number;
  totalFilesInGraph: number;
  totalFilesInReverseIndex: number;
  unitsNote?: string;
  forwardEdges?: Record<string, string[]>;
  histogram: { label: string; min: number; max: number; count: number }[];
  summary: {
    lowFanIn_lte10: { count: number; share: number };
    highFanIn_gt100: { count: number; share: number };
    veryHighFanIn_gt500: { count: number; share: number };
  };
  depthHistogram: { depth: number; count: number; share: number }[];
  modifiedSizeHistogram: {
    description: string;
    totalFiles: number;
    buckets: { label: string; count: number }[];
  };
  top50FilesByImporterCount: { file: string; importerCount: number }[];
}

async function loadModuleGraph(): Promise<ModuleGraphReport | null> {
  try {
    const text = await readFile(join(RESULTS_DIR, 'module-graph.json'), 'utf8');
    return JSON.parse(text) as ModuleGraphReport;
  } catch {
    return null;
  }
}

interface DeterministicBaselinesReport {
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
    namespace: { recall: number; precision: number; clusterPurity: number; clusterCount: number };
    sharedFiles: { recall: number; precision: number; clusterPurity: number; clusterCount: number };
  }>;
  interpretation: string;
}

async function loadDeterministicBaselines(): Promise<DeterministicBaselinesReport | null> {
  try {
    const text = await readFile(join(RESULTS_DIR, 'deterministic-baselines.json'), 'utf8');
    return JSON.parse(text) as DeterministicBaselinesReport;
  } catch {
    return null;
  }
}

async function loadJsonReport<T>(filename: string): Promise<T | null> {
  try {
    const text = await readFile(join(RESULTS_DIR, filename), 'utf8');
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

interface TiedDistanceReport {
  totalFiles: number;
  summary: {
    singleModified: number;
    singleModifiedShare: number;
    mean: number;
    median: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
    meanWhenTied: number;
    medianWhenTied: number;
  };
  takeaway: string;
}

interface BarrelShareReport {
  summary: {
    totalFiles: number;
    barrelFiles: number;
    totalEdges: number;
    barrelEdges: number;
    barrelEdgeShare: number;
    top10BarrelEdgeShare: number;
    top20BarrelEdgeShare: number;
    avgImportersPerBarrel: number;
    avgImportersPerNonBarrel: number;
  };
  topBarrels: { file: string; importerCount: number; directImporters?: number }[];
  takeaway: string;
}

interface FailureModesReport {
  summary: { total: number; pass: number; fail: number; documented: number };
  probes: {
    id: string;
    description: string;
    category: string;
    expected: string;
    status: 'pass' | 'fail' | 'documented';
    notes?: string;
  }[];
  takeaway: string;
}

interface RationaleFidelityReport {
  summary: {
    totalClusters: number;
    correct: number;
    partial: number;
    wrong: number;
    correctRate: number;
    partialRate: number;
    wrongRate: number;
  };
  perCommit: {
    sha: string;
    subject: string;
    clusters: number;
    correct: number;
    partial?: number;
    wrong?: number;
    notes?: string;
    partialReasoning?: string;
  }[];
  conclusion: string;
}

function renderBacklogExperiments(
  tied: TiedDistanceReport | null,
  barrel: BarrelShareReport | null,
  failure: FailureModesReport | null,
  rationale: RationaleFidelityReport | null
): string {
  if (!tied && !barrel && !failure && !rationale) return '';
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  const tiedHtml = tied
    ? `<div class="bldetail">
        <h3>Tied-distance distribution (Round-2 I.3)</h3>
        <p class="muted">${escapeHtml(tied.takeaway)}</p>
        <table class="determ-table">
          <tr><th>files</th><th>single-modified</th><th>median</th><th>mean</th><th>p75</th><th>p90</th><th>p95</th><th>p99</th><th>max</th><th>median (when tied)</th><th>mean (when tied)</th></tr>
          <tr><td>${tied.totalFiles}</td><td>${tied.summary.singleModified} (${pct(tied.summary.singleModifiedShare)})</td><td>${tied.summary.median}</td><td>${tied.summary.mean.toFixed(2)}</td><td>${tied.summary.p75}</td><td>${tied.summary.p90}</td><td>${tied.summary.p95}</td><td>${tied.summary.p99}</td><td>${tied.summary.max}</td><td>${tied.summary.medianWhenTied}</td><td>${tied.summary.meanWhenTied.toFixed(2)}</td></tr>
        </table>
       </div>`
    : '';

  const barrelHtml = barrel
    ? `<div class="bldetail">
        <h3>Barrel-file false-cascade share (Round-2 I.4)</h3>
        <p class="muted">${escapeHtml(barrel.takeaway)}</p>
        <table class="determ-table">
          <tr><th>barrel files</th><th>barrel edges</th><th>top-10 barrels</th><th>top-20 barrels</th><th>avg importers/barrel</th><th>avg importers/non-barrel</th></tr>
          <tr><td>${barrel.summary.barrelFiles}/${barrel.summary.totalFiles}</td><td>${pct(barrel.summary.barrelEdgeShare)}</td><td>${pct(barrel.summary.top10BarrelEdgeShare)}</td><td>${pct(barrel.summary.top20BarrelEdgeShare)}</td><td>${barrel.summary.avgImportersPerBarrel.toFixed(1)}</td><td>${barrel.summary.avgImportersPerNonBarrel.toFixed(1)}</td></tr>
        </table>
        <details><summary>Top 10 barrels</summary>
          <table class="determ-table">
            <tr><th>file</th><th>importers</th><th>direct importers</th></tr>
            ${barrel.topBarrels
              .slice(0, 10)
              .map(
                (b) =>
                  `<tr><td><code>${escapeHtml(b.file)}</code></td><td>${b.importerCount}</td><td>${b.directImporters ?? '-'}</td></tr>`
              )
              .join('')}
          </table>
        </details>
       </div>`
    : '';

  const failureHtml = failure
    ? `<div class="bldetail">
        <h3>Failure-mode taxonomy (Round-2 N)</h3>
        <p class="muted">${escapeHtml(failure.takeaway)}</p>
        <p><strong>${failure.summary.pass}</strong> pass · <strong>${failure.summary.fail}</strong> fail · <strong>${failure.summary.documented}</strong> documented · ${failure.summary.total} total</p>
        <details><summary>All probes</summary>
          <table class="determ-table">
            <tr><th>status</th><th>category</th><th>id</th><th>description</th></tr>
            ${failure.probes
              .map((p) => {
                const icon = p.status === 'pass' ? '✓' : p.status === 'fail' ? '✗' : '·';
                const color = p.status === 'pass' ? '#15803d' : p.status === 'fail' ? '#b91c1c' : '#64748b';
                return `<tr><td style="color:${color};font-weight:600">${icon} ${p.status}</td><td>${escapeHtml(p.category)}</td><td><code>${escapeHtml(p.id)}</code></td><td>${escapeHtml(p.description)}</td></tr>`;
              })
              .join('')}
          </table>
        </details>
       </div>`
    : '';

  const rationaleHtml = rationale
    ? `<div class="bldetail">
        <h3>Cluster rationale fidelity (Round-2 K, hand-labelled)</h3>
        <p class="muted">${escapeHtml(rationale.conclusion)}</p>
        <table class="determ-table">
          <tr><th>total clusters</th><th>correct</th><th>partial</th><th>wrong</th></tr>
          <tr><td>${rationale.summary.totalClusters}</td><td>${rationale.summary.correct} (${pct(rationale.summary.correctRate)})</td><td>${rationale.summary.partial} (${pct(rationale.summary.partialRate)})</td><td>${rationale.summary.wrong} (${pct(rationale.summary.wrongRate)})</td></tr>
        </table>
        <details><summary>Per-commit breakdown</summary>
          <table class="determ-table">
            <tr><th>sha</th><th>subject</th><th>clusters</th><th>correct</th><th>partial</th><th>wrong</th></tr>
            ${rationale.perCommit
              .map(
                (c) =>
                  `<tr><td><code>${escapeHtml(c.sha)}</code></td><td>${escapeHtml(c.subject)}</td><td>${c.clusters}</td><td>${c.correct}</td><td>${c.partial ?? 0}</td><td>${c.wrong ?? 0}</td></tr>`
              )
              .join('')}
          </table>
        </details>
       </div>`
    : '';

  return `<section class="card" id="backlog">
    <h2>Round-2 backlog experiments</h2>
    <p class="muted">Four follow-on experiments completed after the initial A/B/C/O/L/M/J set. Together they answer: does the deterministic baseline already give a usable UX? (yes, 70% of the time); is excluding barrels a useful heuristic? (no, only 7% of cascade); are the agent's rationales trustworthy? (yes, 95% correct); does the harness degrade gracefully? (yes, on every library path).</p>
    ${rationaleHtml}
    ${tiedHtml}
    ${barrelHtml}
    ${failureHtml}
  </section>`;
}

interface ReplayRow {
  timestamp: string;
  commit: {
    sha: string;
    shortSha: string;
    subject: string;
    filesChanged: number;
    insertions: number;
    deletions: number;
    paths: string[];
  };
  outcome: 'success' | 'apply-failed' | 'empty-cascade' | 'agent-failed';
  reason?: string;
  groundTruth?: { modified: number; affected: number; new: number; total: number };
  payloadTokens?: number;
  storyToFile?: Record<string, string>;
  modified?: string[];
  affected?: string[];
  changedFiles?: string[];
  agent?: {
    model: string;
    promptVariant: string;
    durationS: number;
    costUsd?: number;
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    clusterCount: number;
    clusters: { id: string; rationale: string; representative: string; storyCount: number; stories: string[] }[];
  };
  scores?: { recall: number; precision: number; clusterPurity: number };
  signatureQuality?: SignatureQuality;
  deterministicComparison?: {
    namespace: { clusterCount: number; purity: number };
    sharedFiles: { clusterCount: number; purity: number };
  };
}

async function loadReplayRows(): Promise<ReplayRow[]> {
  const entries = await readdir(RESULTS_DIR);
  const out: ReplayRow[] = [];
  for (const f of entries) {
    if (!f.startsWith('replay-real-')) continue;
    if (!f.endsWith('.jsonl')) continue;
    const text = await readFile(join(RESULTS_DIR, f), 'utf8');
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line) as ReplayRow);
      } catch {}
    }
  }
  return out.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function renderOverview(runs: RunRow[]): string {
  const total = runs.length;
  const withAgent = runs.filter((r) => r.agentRun);
  const totalCost = withAgent.reduce((s, r) => s + (r.agentRun?.costUsd || 0), 0);
  // Input tokens reported by the SDK count *cache miss* only. Cache reads are
  // a separate counter; sum both for the true input picture.
  const inTok = withAgent.reduce(
    (s, r) => s + (r.agentRun?.inputTokens || 0) + (r.agentRun?.cacheReadTokens || 0),
    0
  );
  const inTokFresh = withAgent.reduce((s, r) => s + (r.agentRun?.inputTokens || 0), 0);
  const inTokCached = withAgent.reduce((s, r) => s + (r.agentRun?.cacheReadTokens || 0), 0);
  const outTok = withAgent.reduce((s, r) => s + (r.agentRun?.outputTokens || 0), 0);
  const models = new Set(withAgent.map((r) => r.agentRun?.model || '?'));
  const prompts = new Set(withAgent.map((r) => r.agentRun?.promptVariant || 'enumerate'));

  // Per-scenario summary
  const byScenario = new Map<string, RunRow[]>();
  for (const r of runs) {
    if (!byScenario.has(r.scenario)) byScenario.set(r.scenario, []);
    byScenario.get(r.scenario)!.push(r);
  }

  const scenarioRows = [...byScenario.entries()]
    .map(([name, rs]) => {
      // Take max across runs — the oldest baseline run might have total=0
      // because it predates a fix. Use the canonical number from the best
      // available run.
      const cascade = Math.max(0, ...rs.map((r) => r.groundTruth?.total ?? 0));
      const tokens = Math.max(0, ...rs.map((r) => r.payload?.estimatedTokens ?? 0));
      const ar = rs.filter((r) => r.agentRun?.parsed !== null);
      const recalls = rs.map((r) => r.scores?.recall).filter((x): x is number => typeof x === 'number');
      const precisions = rs.map((r) => r.scores?.precision).filter((x): x is number => typeof x === 'number');
      const purities = rs.map((r) => r.scores?.clusterPurity).filter((x): x is number => typeof x === 'number');
      const durations = rs.map((r) => r.agentRun?.durationS).filter((x): x is number => typeof x === 'number');
      const costs = rs.map((r) => r.agentRun?.costUsd).filter((x): x is number => typeof x === 'number');
      const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : undefined);
      return {
        name,
        runs: rs.length,
        cascade,
        tokens,
        recall: avg(recalls),
        precision: avg(precisions),
        purity: avg(purities),
        avgDuration: avg(durations),
        avgCost: avg(costs),
      };
    })
    .sort((a, b) => a.cascade - b.cascade);

  return `<section class="card">
    <h2>Overview</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-value">${total}</div><div class="kpi-label">runs total</div></div>
      <div class="kpi"><div class="kpi-value">${withAgent.length}</div><div class="kpi-label">agent invocations</div></div>
      <div class="kpi"><div class="kpi-value">${fmtCost(totalCost)}</div><div class="kpi-label">total cost</div></div>
      <div class="kpi"><div class="kpi-value">${fmtNum(inTok)}</div><div class="kpi-label">input tokens (sum, fresh+cache)</div></div>
      <div class="kpi"><div class="kpi-value">${fmtNum(inTokFresh)}</div><div class="kpi-label">→ fresh</div></div>
      <div class="kpi"><div class="kpi-value">${fmtNum(inTokCached)}</div><div class="kpi-label">→ cached</div></div>
      <div class="kpi"><div class="kpi-value">${fmtNum(outTok)}</div><div class="kpi-label">output tokens (sum)</div></div>
      <div class="kpi"><div class="kpi-value">${models.size}</div><div class="kpi-label">distinct models</div></div>
    </div>
    <p class="muted">Models: ${[...models].map(escapeHtml).join(', ') || '-'}. Prompt variants: ${[...prompts].map(escapeHtml).join(', ') || '-'}.</p>
    <h3>Per-scenario aggregate</h3>
    <table class="table">
      <thead><tr>
        <th>scenario</th><th>runs</th><th>cascade</th><th>input tokens</th>
        <th>recall</th><th>precision</th><th>purity</th>
        <th>avg duration</th><th>avg cost</th>
      </tr></thead>
      <tbody>
        ${scenarioRows
          .map(
            (s) => `<tr>
            <td><a href="#scenario-${escapeHtml(s.name)}">${escapeHtml(s.name)}</a></td>
            <td>${s.runs}</td>
            <td>${fmtNum(s.cascade)}</td>
            <td>${fmtNum(s.tokens)}</td>
            <td class="${(s.recall ?? 1) >= 0.95 ? 'good' : 'warn'}">${s.recall === undefined ? '-' : fmtPct(s.recall)}</td>
            <td>${s.precision === undefined ? '-' : fmtPct(s.precision)}</td>
            <td class="${(s.purity ?? 0) >= 0.5 ? 'good' : (s.purity ?? 0) >= 0.25 ? 'warn' : 'bad'}">${s.purity === undefined ? '-' : fmtPct(s.purity)}</td>
            <td>${s.avgDuration === undefined ? '-' : fmtNum(s.avgDuration) + 's'}</td>
            <td>${s.avgCost === undefined ? '-' : fmtCost(s.avgCost)}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  </section>`;
}

function renderVariance(runs: RunRow[]): string {
  // Group by bucketKey; for any bucket with ≥2 runs, compute pairwise Jaccard.
  const groups = new Map<string, RunRow[]>();
  for (const r of runs) {
    if (!r.agentRun || !r.scores) continue;
    const key = bucketKey(r);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const multi = [...groups.entries()].filter(([, rs]) => rs.length >= 2);
  if (multi.length === 0) {
    return `<section class="card"><h2>Variance analysis</h2><p class="muted">No bucket has ≥2 runs yet. Re-run with <code>--runs N</code> to populate this.</p></section>`;
  }
  return `<section class="card">
    <h2>Variance analysis</h2>
    <p class="muted">Each row groups runs sharing scenario × model × prompt × effort. <strong>Cluster Jaccard</strong> = best-pair-match similarity averaged across clusters; 1.0 = identical clustering, 0.0 = totally different. <strong>Score range</strong> = max−min across runs.</p>
    ${multi
      .map(([key, rs]) => {
        const [scenario, model, prompt, effort] = key.split('|');
        const clusters = rs
          .map((r) => r.agentRun?.clusters?.map((c) => c.stories) ?? [])
          .filter((cs) => cs.length > 0);
        const pairwise: number[] = [];
        for (let i = 0; i < clusters.length; i++) {
          for (let j = i + 1; j < clusters.length; j++) {
            pairwise.push(jaccardClusters(clusters[i], clusters[j]));
          }
        }
        const avgJac = pairwise.length ? pairwise.reduce((s, x) => s + x, 0) / pairwise.length : 0;
        const recalls = rs.map((r) => r.scores!.recall);
        const precisions = rs.map((r) => r.scores!.precision);
        const purities = rs.map((r) => r.scores!.clusterPurity);
        const durations = rs.map((r) => r.agentRun!.durationS);
        const costs = rs
          .map((r) => r.agentRun?.costUsd)
          .filter((x): x is number => typeof x === 'number');
        const range = (xs: number[]) =>
          xs.length === 0 ? '-' : `${fmtNum(Math.min(...xs), 3)}–${fmtNum(Math.max(...xs), 3)}`;
        const clusterCounts = rs.map((r) => r.agentRun?.clusterCount ?? 0);
        return `<div class="bucket">
          <h3>${escapeHtml(scenario)} · <span class="muted">${escapeHtml(model)} / ${escapeHtml(prompt)} / effort=${escapeHtml(effort)}</span></h3>
          <table class="table">
            <thead><tr><th>metric</th><th>n</th><th>range</th><th>variance flag</th></tr></thead>
            <tbody>
              <tr><td>recall</td><td>${rs.length}</td><td>${range(recalls)}</td><td>${Math.max(...recalls) - Math.min(...recalls) <= 0.02 ? '<span class="good">stable</span>' : '<span class="warn">drifts</span>'}</td></tr>
              <tr><td>precision</td><td>${rs.length}</td><td>${range(precisions)}</td><td>${Math.max(...precisions) - Math.min(...precisions) <= 0.02 ? '<span class="good">stable</span>' : '<span class="warn">drifts</span>'}</td></tr>
              <tr><td>cluster purity</td><td>${rs.length}</td><td>${range(purities)}</td><td>${Math.max(...purities) - Math.min(...purities) <= 0.05 ? '<span class="good">stable</span>' : '<span class="warn">drifts</span>'}</td></tr>
              <tr><td>cluster count</td><td>${rs.length}</td><td>${Math.min(...clusterCounts)}–${Math.max(...clusterCounts)}</td><td>${Math.max(...clusterCounts) - Math.min(...clusterCounts) <= 1 ? '<span class="good">stable</span>' : '<span class="warn">drifts</span>'}</td></tr>
              <tr><td>duration (s)</td><td>${rs.length}</td><td>${range(durations)}</td><td>-</td></tr>
              <tr><td>cost</td><td>${costs.length}</td><td>${costs.length === 0 ? '-' : `$${Math.min(...costs).toFixed(4)}–$${Math.max(...costs).toFixed(4)}`}</td><td>-</td></tr>
              <tr><td><strong>cluster-content Jaccard (pairwise avg)</strong></td><td>${pairwise.length}</td><td>${fmtNum(avgJac, 3)}</td><td>${avgJac >= 0.7 ? '<span class="good">stable</span>' : avgJac >= 0.4 ? '<span class="warn">drifts</span>' : '<span class="bad">unstable</span>'}</td></tr>
            </tbody>
          </table>
        </div>`;
      })
      .join('')}
  </section>`;
}

/** Side-by-side comparison of prompt variants per scenario. */
function renderPromptCompare(runs: RunRow[]): string {
  // Group by scenario × model × effort, then split by promptVariant.
  const groups = new Map<string, RunRow[]>();
  for (const r of runs) {
    if (!r.agentRun || !r.scores) continue;
    const key = `${r.scenario}|${r.agentRun.model || '?'}|${r.agentRun.effort || '?'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const compares: { key: string; byPrompt: Record<string, RunRow[]> }[] = [];
  for (const [key, rs] of groups.entries()) {
    const byPrompt: Record<string, RunRow[]> = {};
    for (const r of rs) {
      const p = r.agentRun?.promptVariant || 'enumerate';
      if (!byPrompt[p]) byPrompt[p] = [];
      byPrompt[p].push(r);
    }
    if (Object.keys(byPrompt).length >= 2) compares.push({ key, byPrompt });
  }
  if (compares.length === 0) {
    return `<section class="card"><h2>Prompt comparison</h2><p class="muted">No scenario has runs from multiple prompt variants yet. Run with <code>--prompt enumerate</code> and <code>--prompt signature</code> to populate.</p></section>`;
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  return `<section class="card">
    <h2>Prompt comparison (enumerate vs signature)</h2>
    <p class="muted">Side-by-side averages for scenarios where both prompt variants have at least one run. Same model, same effort.</p>
    ${compares
      .map(({ key, byPrompt }) => {
        const [scenario, model, effort] = key.split('|');
        const variants = Object.keys(byPrompt);
        return `<div class="bucket">
        <h3>${escapeHtml(scenario)} <span class="muted">— ${escapeHtml(model)}, effort=${escapeHtml(effort)}</span></h3>
        <table class="table">
          <thead><tr>
            <th>variant</th><th>n</th><th>recall</th><th>precision</th><th>purity</th>
            <th>clusters</th><th>output tokens</th><th>duration</th><th>cost</th>
          </tr></thead>
          <tbody>
          ${variants
            .map((v) => {
              const rs = byPrompt[v];
              const recall = avg(rs.map((r) => r.scores!.recall));
              const precision = avg(rs.map((r) => r.scores!.precision));
              const purity = avg(rs.map((r) => r.scores!.clusterPurity));
              const clusters = avg(rs.map((r) => r.agentRun?.clusterCount ?? 0));
              const outTok = avg(rs.map((r) => r.agentRun?.outputTokens ?? 0));
              const dur = avg(rs.map((r) => r.agentRun?.durationS ?? 0));
              const cost = avg(rs.map((r) => r.agentRun?.costUsd ?? 0));
              return `<tr>
              <td><strong>${escapeHtml(v)}</strong></td>
              <td>${rs.length}</td>
              <td>${fmtPct(recall)}</td>
              <td>${fmtPct(precision)}</td>
              <td>${fmtPct(purity)}</td>
              <td>${fmtNum(clusters, 1)}</td>
              <td>${fmtNum(outTok)}</td>
              <td>${fmtNum(dur, 1)}s</td>
              <td>${fmtCost(cost)}</td>
            </tr>`;
            })
            .join('')}
          </tbody>
        </table>
      </div>`;
      })
      .join('')}
  </section>`;
}

/**
 * Per-run FILE-LEVEL dependency graph.
 *
 * Builds a subgraph rooted at the changed file using the forward
 * dependency edges from `module-graph.json`. For every flagged story:
 *   1. Look up its story-file path (from `payload.storyToFile`).
 *   2. Walk down the forward graph from the story-file towards the
 *      changed file, recording each component file along the path.
 *   3. Add the story-file as a leaf node, coloured by its agent cluster.
 *
 * The result shows the actual import chain from changed file → component
 * files → story files, with the agent's clustering applied to story files.
 */
function renderClusterGraph(
  r: RunRow,
  idx: number,
  forwardEdges: Record<string, string[]> | undefined
): string {
  const modified = r.payload.modified ?? [];
  const affected = r.payload.affected ?? [];
  const newStories = r.payload.newStories ?? [];
  const cssAffected = r.payload.cssAffected ?? [];
  const allStories = [...modified, ...affected, ...newStories, ...cssAffected];
  if (allStories.length === 0) return '';

  const storyToFile = r.payload.storyToFile ?? {};
  const changedFile = r.edit?.path?.replace(/^code\//, '') ?? '?';

  // Skip if we don't have file-level data — a graph showing only "Sidebar.tsx"
  // and nothing else is misleading. Older runs predate the storyToFile capture.
  const haveStoryFiles = Object.keys(storyToFile).length > 0 && !!forwardEdges;
  if (!haveStoryFiles) return '';

  // Map story → cluster
  const storyToCluster = new Map<string, number>();
  const clusters = r.agentRun?.clusters ?? [];
  for (let ci = 0; ci < clusters.length; ci++) {
    for (const s of clusters[ci].stories ?? []) {
      if (!storyToCluster.has(s)) storyToCluster.set(s, ci);
    }
  }

  // Map storyFile → set of cluster indices (a story-file can host stories
  // from multiple clusters — we'll show them as a pie or use the dominant).
  const fileToClusters = new Map<string, Map<number, number>>(); // file → cluster → count
  const fileToStatus = new Map<string, 'modified' | 'affected' | 'new' | 'css'>();
  for (const id of modified) {
    const f = storyToFile[id];
    if (!f) continue;
    fileToStatus.set(f, 'modified');
    if (!fileToClusters.has(f)) fileToClusters.set(f, new Map());
    const ci = storyToCluster.get(id);
    if (ci !== undefined) {
      const m = fileToClusters.get(f)!;
      m.set(ci, (m.get(ci) ?? 0) + 1);
    }
  }
  for (const id of affected) {
    const f = storyToFile[id];
    if (!f) continue;
    if (!fileToStatus.has(f)) fileToStatus.set(f, 'affected');
    if (!fileToClusters.has(f)) fileToClusters.set(f, new Map());
    const ci = storyToCluster.get(id);
    if (ci !== undefined) {
      const m = fileToClusters.get(f)!;
      m.set(ci, (m.get(ci) ?? 0) + 1);
    }
  }
  for (const id of newStories) {
    const f = storyToFile[id];
    if (!f) continue;
    if (!fileToStatus.has(f)) fileToStatus.set(f, 'new');
  }
  for (const id of cssAffected) {
    const f = storyToFile[id];
    if (!f) continue;
    if (!fileToStatus.has(f)) fileToStatus.set(f, 'css');
  }

  // Walk the forward graph from each story-file towards the changed file.
  // Capture intermediate (component) files. BFS bounded to depth 8.
  const subgraphFiles = new Set<string>([changedFile]);
  const subgraphEdges = new Set<string>(); // "from->to" strings
  const componentFiles = new Set<string>(); // intermediate non-story files

  if (forwardEdges) {
    const MAX_DEPTH = 8;
    for (const sf of fileToStatus.keys()) {
      // Walk down (forward) from story-file looking for the changed file.
      // BFS but record only paths to reach changedFile.
      const visited = new Map<string, string | null>(); // file → parent
      visited.set(sf, null);
      const queue: { file: string; depth: number }[] = [{ file: sf, depth: 0 }];
      let foundFile: string | null = null;
      while (queue.length > 0) {
        const { file, depth } = queue.shift()!;
        if (depth > MAX_DEPTH) continue;
        if (file === changedFile) {
          foundFile = file;
          break;
        }
        const deps = forwardEdges[file];
        if (!deps) continue;
        for (const d of deps) {
          if (!visited.has(d)) {
            visited.set(d, file);
            queue.push({ file: d, depth: depth + 1 });
          }
        }
      }
      if (foundFile === null) {
        // No path; just add the story-file directly connected to changedFile
        subgraphFiles.add(sf);
        subgraphEdges.add(sf + '->' + changedFile);
      } else {
        // Reconstruct path from sf to changedFile
        const path: string[] = [];
        let cur: string | null = foundFile;
        while (cur !== null) {
          path.push(cur);
          cur = visited.get(cur) ?? null;
        }
        // path is [changedFile, ..., sf]
        for (const f of path) {
          subgraphFiles.add(f);
          if (f !== sf && f !== changedFile) componentFiles.add(f);
        }
        for (let i = 0; i < path.length - 1; i++) {
          subgraphEdges.add(path[i + 1] + '->' + path[i]);
        }
      }
    }
  } else {
    // Fallback: no forward graph available, attach story files directly
    for (const sf of fileToStatus.keys()) {
      subgraphFiles.add(sf);
      subgraphEdges.add(sf + '->' + changedFile);
    }
  }

  // Cluster palette
  const palette = [
    '#2563eb', '#dc2626', '#16a34a', '#d97706',
    '#7c3aed', '#0891b2', '#db2777', '#65a30d',
    '#0284c7', '#a16207', '#475569', '#9333ea',
  ];
  const clusterMeta = clusters.map((c, ci) => ({
    id: c.id,
    rationale: c.rationale,
    representative: c.representative,
    storyCount: c.storyCount ?? c.stories?.length ?? 0,
    color: palette[ci % palette.length],
  }));

  // Build node list
  const nodes: Array<{
    id: string;
    label: string;
    title: string;
    kind: 'changed' | 'component' | 'storyFile';
    status?: string;
    clusterIdx?: number;
    storyCount?: number;
    storyIds?: string[];
  }> = [];

  // Map storyFile → list of story IDs hosted there
  const fileToStoryIds = new Map<string, string[]>();
  for (const id of allStories) {
    const f = storyToFile[id];
    if (!f) continue;
    if (!fileToStoryIds.has(f)) fileToStoryIds.set(f, []);
    fileToStoryIds.get(f)!.push(id);
  }

  // Short labels: drop directory + extension, max 22 chars.
  function shortLabel(p: string): string {
    const base = (p.split('/').pop() ?? p).replace(/\.(stories|tsx?|jsx?|mjs|cjs)(\.tsx?)?$/, '');
    return base.length > 22 ? base.slice(0, 20) + '…' : base;
  }

  for (const f of subgraphFiles) {
    if (f === changedFile) {
      nodes.push({
        id: f,
        label: shortLabel(f),
        title: f, // changed file — full path on hover; click for detail
        kind: 'changed',
      });
    } else if (fileToStoryIds.has(f)) {
      const ids = fileToStoryIds.get(f)!;
      const status = fileToStatus.get(f);
      const clusterMap = fileToClusters.get(f);
      let clusterIdx: number | undefined;
      if (clusterMap && clusterMap.size > 0) {
        let max = -1;
        for (const [ci, n] of clusterMap.entries()) {
          if (n > max) {
            max = n;
            clusterIdx = ci;
          }
        }
      }
      nodes.push({
        id: f,
        label: shortLabel(f),
        title: f,
        kind: 'storyFile',
        status,
        clusterIdx,
        storyCount: ids.length,
        storyIds: ids,
      });
    } else {
      nodes.push({
        id: f,
        label: shortLabel(f),
        title: f,
        kind: 'component',
      });
    }
  }

  const data = {
    changedFile,
    nodes,
    edges: [...subgraphEdges].map((e) => {
      const [from, to] = e.split('->');
      return { from, to };
    }),
    clusters: clusterMeta,
    palette,
    stats: {
      totalFiles: subgraphFiles.size,
      storyFiles: fileToStoryIds.size,
      componentFiles: componentFiles.size,
      totalStories: allStories.length,
    },
  };

  const dataId = `fgraph-data-${idx}`;
  const containerId = `fgraph-${idx}`;
  const legendItems = clusterMeta
    .map(
      (c) =>
        `<span><span class="swatch" style="background:${c.color}"></span>${escapeHtml(c.id)} <span class="muted">(${c.storyCount})</span></span>`
    )
    .join('');

  // Pick default layout mode — same logic mirrored in the inline JS below.
  const defaultMode: 'summary' | 'hierarchical' | 'force' =
    data.stats.totalFiles >= 80 ? 'summary' : data.stats.totalFiles >= 12 ? 'hierarchical' : 'force';

  return `<details${forwardEdges ? ' open' : ''}>
    <summary><strong>File dependency graph</strong> — changed file → component files → story files, coloured by agent cluster <span class="muted">(${data.stats.totalFiles} files: 1 changed, ${data.stats.componentFiles} component, ${data.stats.storyFiles} story · ${data.stats.totalStories} stories)</span></summary>
    <div class="graph-controls">
      <div class="layout-toggle" role="tablist">
        <button id="${containerId}-btn-summary"${defaultMode === 'summary' ? ' class="active"' : ''} onclick="fgraphSetLayout_${idx}('summary')" title="Aggregated view: changed file → cluster bubbles. Best for cascade-scale graphs.">Summary</button>
        <button id="${containerId}-btn-hier"${defaultMode === 'hierarchical' ? ' class="active"' : ''} onclick="fgraphSetLayout_${idx}('hierarchical')" title="Layered DAG with all files (Graphviz/Mermaid style)">Full DAG</button>
        <button id="${containerId}-btn-force"${defaultMode === 'force' ? ' class="active"' : ''} onclick="fgraphSetLayout_${idx}('force')" title="Force-directed (good for small graphs)">Force</button>
      </div>
      <button onclick="fgraphFit_${idx}()">Fit</button>
      <span class="label">Hover a node to highlight its dependency neighbourhood · click a story file for details · click a cluster name to filter</span>
    </div>
    <div id="${containerId}" class="graph-container tall"></div>
    <div class="graph-legend" id="${containerId}-legend">
      <span><span class="swatch" style="background:#dc2626;border-color:#7f1d1d"></span>changed file</span>
      <span><span class="swatch" style="background:#cbd5e1;border-color:#475569"></span>component file (intermediate)</span>
      <span><span class="swatch" style="background:#fcd34d"></span>story file: modified</span>
      <span><span class="swatch" style="background:#c4b5fd"></span>story file: affected</span>
      ${clusterMeta
        .map(
          (c, ci) =>
            `<span class="cluster-toggle" data-cluster="${ci}" data-graph="${idx}" style="cursor:pointer; user-select:none;" title="Click to filter the graph to just this cluster's files"><span class="swatch" style="background:${c.color}"></span>${escapeHtml(c.id)} <span class="muted">(${c.storyCount})</span></span>`
        )
        .join('')}
      <span class="cluster-toggle" data-cluster="all" data-graph="${idx}" style="cursor:pointer; user-select:none;" title="Show all clusters">↻ all</span>
    </div>
    <div id="${containerId}-detail" class="graph-detail-panel"></div>
    <script type="application/json" id="${dataId}">${JSON.stringify(data)}</script>
    <script>
      (function() {
        const data = JSON.parse(document.getElementById('${dataId}').textContent);
        const detail = document.getElementById('${containerId}-detail');

        // Build child→parent and parent→child lookups once. Edges in
        // data.edges go importer → import (story file points back to its
        // dep). So "child" means "depends on"; "parent" means "imported by".
        // The hover handler walks both maps (neighborhoodOf); the cluster
        // filter walks only child→parent (subgraph rooted at the changed
        // file).
        const childToParents = new Map();
        const parentToChildren = new Map();
        for (const e of data.edges) {
          if (!childToParents.has(e.from)) childToParents.set(e.from, []);
          childToParents.get(e.from).push(e.to);
          if (!parentToChildren.has(e.to)) parentToChildren.set(e.to, []);
          parentToChildren.get(e.to).push(e.from);
        }
        // Walk BOTH directions from a node — every transitive ancestor
        // (toward the changed file) AND every transitive descendant
        // (the story files that import it). This is what hover uses so a
        // user can see the full neighbourhood of any node, not just the
        // single path to the cascade root.
        function neighborhoodOf(id) {
          const set = new Set([id]);
          // Up: things this node depends on (toward changed file)
          const upQ = [id];
          while (upQ.length) {
            const cur = upQ.shift();
            for (const p of (childToParents.get(cur) || [])) {
              if (!set.has(p)) { set.add(p); upQ.push(p); }
            }
          }
          // Down: things that depend on this node (toward story files)
          const downQ = [id];
          while (downQ.length) {
            const cur = downQ.shift();
            for (const c of (parentToChildren.get(cur) || [])) {
              if (!set.has(c)) { set.add(c); downQ.push(c); }
            }
          }
          return set;
        }

        // Tailwind-inspired soft palette for kinds + statuses
        const kindStyle = {
          changed: { bg: '#ef4444', border: '#991b1b', text: '#fff', shadowColor: 'rgba(239,68,68,0.4)' },
          component: { bg: '#f1f5f9', border: '#cbd5e1', text: '#475569' },
          modified: { bg: '#fef3c7', border: '#f59e0b', text: '#78350f' },
          affected: { bg: '#ede9fe', border: '#a78bfa', text: '#5b21b6' },
          new: { bg: '#dcfce7', border: '#4ade80', text: '#166534' },
          css: { bg: '#fce7f3', border: '#f472b6', text: '#9f1239' },
        };

        function buildNodeStyle(n) {
          if (n.kind === 'changed') {
            const s = kindStyle.changed;
            return {
              id: n.id, label: n.label, title: n.title,
              shape: 'box',
              shapeProperties: { borderRadius: 6 },
              color: { background: s.bg, border: s.border, highlight: { background: s.bg, border: s.border } },
              font: { color: s.text, size: 13, face: 'ui-monospace, Menlo, monospace', bold: '600' },
              margin: 10,
              widthConstraint: { minimum: 80, maximum: 220 },
              mass: 8,
              borderWidth: 2,
            };
          }
          if (n.kind === 'component') {
            const s = kindStyle.component;
            return {
              id: n.id, label: n.label, title: n.title,
              shape: 'box',
              shapeProperties: { borderRadius: 4 },
              color: { background: s.bg, border: s.border, highlight: { background: s.bg, border: '#94a3b8' } },
              font: { color: s.text, size: 10, face: 'ui-monospace, Menlo, monospace' },
              margin: 6,
              widthConstraint: { minimum: 40, maximum: 180 },
              mass: 2,
              borderWidth: 1,
            };
          }
          // storyFile
          const s = kindStyle[n.status] || kindStyle.affected;
          const clusterColor = (n.clusterIdx !== undefined) ? data.palette[n.clusterIdx % data.palette.length] : null;
          const size = Math.min(28, 10 + Math.sqrt(n.storyCount || 1) * 3);
          return {
            id: n.id, label: n.label, title: n.title,
            shape: 'dot',
            size,
            color: {
              background: s.bg,
              border: clusterColor || s.border,
              highlight: { background: clusterColor || s.bg, border: clusterColor || s.border },
            },
            borderWidth: clusterColor ? 3 : 1.5,
            font: { size: 9, color: s.text, face: 'ui-monospace, Menlo, monospace' },
          };
        }
        const visNodes = data.nodes.map(buildNodeStyle);

        const visEdges = data.edges.map(e => ({
          from: e.from, to: e.to,
          arrows: { to: { enabled: true, scaleFactor: 0.3, type: 'arrow' } },
          color: { color: 'rgba(148,163,184,0.45)', highlight: '#1e293b', hover: '#475569' },
          width: 0.8,
          selectionWidth: 2,
          hoverWidth: 2,
        }));

        // Industry-standard layered DAG layout (Graphviz / Mermaid style).
        // Edges go storyFile → componentFile → changedFile, so:
        //   - direction: 'RL' puts the edge TARGET (changedFile) on the LEFT
        //   - sortMethod: 'directed' uses edge direction for layering
        // Result: changed file at left, components in middle columns, story
        // files at right. Reads naturally as cascade flow.
        function makeOptions(mode) {
          if (mode === 'hierarchical' || mode === 'summary') {
            // Summary mode renders 1 changed file + K cluster bubbles (sized
            // up to ~120px diameter). Hierarchical at full-DAG density uses
            // tighter spacing; Summary needs much more so bubbles don't
            // overlap each other or their labels.
            const isSummary = mode === 'summary';
            const hOpts = {
              enabled: true,
              direction: 'RL',
              sortMethod: 'directed',
              shakeTowards: 'roots',
              levelSeparation: isSummary ? 260 : data.stats.totalFiles > 100 ? 220 : 180,
              nodeSpacing: isSummary ? 140 : data.stats.totalFiles > 100 ? 32 : 60,
              treeSpacing: isSummary ? 80 : 40,
              blockShifting: true,
              edgeMinimization: true,
              parentCentralization: true,
            };
            return {
              physics: { enabled: false },
              interaction: { hover: true, tooltipDelay: 80 },
              edges: {
                smooth: { type: 'cubicBezier', forceDirection: 'horizontal', roundness: 0.5 },
                chosen: false,
              },
              layout: { hierarchical: hOpts, improvedLayout: true },
            };
          }
          // force-directed
          return {
            physics: {
              enabled: true,
              barnesHut: {
                gravitationalConstant: data.stats.totalFiles > 200 ? -2500 : -5000,
                springConstant: 0.05,
                springLength: 90,
                damping: 0.6,
                avoidOverlap: 0.4,
              },
              stabilization: { iterations: data.stats.totalFiles > 200 ? 80 : 250 },
              minVelocity: 0.5,
            },
            interaction: { hover: true, tooltipDelay: 80, hideEdgesOnDrag: data.stats.totalFiles > 150 },
            edges: { smooth: data.stats.totalFiles < 60 ? { type: 'cubicBezier', forceDirection: 'none', roundness: 0.3 } : false, chosen: false },
            layout: { hierarchical: { enabled: false }, improvedLayout: data.stats.totalFiles < 100 },
          };
        }

        let currentMode = '${defaultMode}';
        // ── Summary mode ───────────────────────────────────────────────
        // Aggregates the cascade into one bubble per cluster, sized by
        // story count. Drops every component file and individual story
        // file from the view. Useful for the cascade-scale case where
        // the full file graph is unreadable.
        function buildSummaryData() {
          const clusterTotals = data.clusters.map((c) => ({
            ci: data.clusters.indexOf(c),
            id: c.id,
            color: c.color,
            storyCount: c.storyCount,
            rationale: c.rationale,
            representative: c.representative,
          }));
          const sumNodes = [
            // Changed file (left)
            (function () {
              const baseNode = visNodes.find((n) => n.id === data.changedFile) || visNodes[0];
              return { ...baseNode, id: '__summary_changed__' };
            })(),
            ...clusterTotals.map((c) => {
              const r = Math.max(20, Math.min(60, 10 + Math.sqrt(c.storyCount) * 3));
              return {
                id: 'cluster:' + c.ci,
                label: c.id + '  (' + c.storyCount + ')',
                title: c.id + ' · ' + c.storyCount + ' stor' + (c.storyCount === 1 ? 'y' : 'ies') + (c.rationale ? ' — ' + c.rationale : ''),
                shape: 'dot',
                size: r,
                color: { background: c.color + 'cc', border: c.color, highlight: { background: c.color, border: c.color } },
                font: { size: 12, face: 'ui-monospace, Menlo, monospace', color: '#0f172a', bold: '600' },
                borderWidth: 2,
              };
            }),
          ];
          const sumEdges = clusterTotals.map((c) => ({
            id: 'sume:' + c.ci,
            from: 'cluster:' + c.ci,
            to: '__summary_changed__',
            arrows: { to: { enabled: true, scaleFactor: 0.4 } },
            color: { color: c.color + '99' },
            width: Math.max(1, Math.min(8, Math.sqrt(c.storyCount) * 0.7)),
            smooth: { type: 'cubicBezier', forceDirection: 'horizontal', roundness: 0.5 },
          }));
          return { nodes: sumNodes, edges: sumEdges };
        }

        // Resolve the legend ref once so the layout-switch closure (which
        // clears the cluster-filter active class) doesn't reference it late
        // and race against insertion order. The detail panel ref is already
        // resolved at the top of this IIFE.
        const legend = document.getElementById('${containerId}-legend');

        // Use DataSets so we can mutate colours via .update() without
        // resetting the layout (critical for hierarchical mode).
        const nodesDS = new vis.DataSet(currentMode === 'summary' ? buildSummaryData().nodes : visNodes);
        const edgesDS = new vis.DataSet(
          currentMode === 'summary'
            ? buildSummaryData().edges
            : visEdges.map((e, i) => ({ ...e, id: 'e' + i }))
        );
        const network = new vis.Network(
          document.getElementById('${containerId}'),
          { nodes: nodesDS, edges: edgesDS },
          makeOptions(currentMode)
        );
        let physicsOn = currentMode === 'force';
        window['fgraphFit_${idx}'] = () => network.fit({ animation: { duration: 300, easingFunction: 'easeInOutQuad' } });
        window['fgraphTogglePhysics_${idx}'] = () => {
          physicsOn = !physicsOn;
          network.setOptions({ physics: { enabled: physicsOn } });
        };
        function loadDataForMode(mode) {
          if (mode === 'summary') {
            const sd = buildSummaryData();
            nodesDS.clear();
            nodesDS.add(sd.nodes);
            edgesDS.clear();
            edgesDS.add(sd.edges);
          } else {
            nodesDS.clear();
            nodesDS.add(visNodes);
            edgesDS.clear();
            edgesDS.add(visEdges.map((e, i) => ({ ...e, id: 'e' + i })));
          }
        }
        window['fgraphSetLayout_${idx}'] = (mode) => {
          currentMode = mode;
          // Clear cluster-filter highlight state when switching modes.
          legend.querySelectorAll('.cluster-toggle').forEach(x => x.classList.remove('active'));
          loadDataForMode(mode);
          network.setOptions(makeOptions(mode));
          setTimeout(() => network.fit({ animation: { duration: 300, easingFunction: 'easeInOutQuad' } }), 120);
          physicsOn = mode === 'force';
          const btns = ['hier', 'force', 'summary'];
          for (const b of btns) {
            const el = document.getElementById('${containerId}-btn-' + b);
            if (el) el.classList.toggle('active', mode === (b === 'hier' ? 'hierarchical' : b));
          }
        };
        if (currentMode === 'force' && data.stats.totalFiles > 80) {
          network.once('stabilizationIterationsDone', () => {
            network.setOptions({ physics: { enabled: false } });
            physicsOn = false;
          });
        }

        // ── Hover neighbourhood highlight ──────────────────────────────
        // Hovering any node lights up its full dependency neighbourhood
        // (both ancestors and descendants — see neighborhoodOf above).
        // We store the original styles so we can restore on blur.
        let hovering = null;
        // Original style lookup so we can restore on blur without re-adding
        // filtered-out nodes (vis.DataSet.update is upsert — it would add
        // entries that aren't currently in the set if we naively dumped
        // everything back in).
        const origNodeById = new Map(visNodes.map((n) => [n.id, n]));
        const origEdgeByKey = new Map(visEdges.map((e, i) => ['e' + i, e]));

        function visibleIds() {
          return new Set(nodesDS.getIds());
        }
        function visibleEdgeIds() {
          return new Set(edgesDS.getIds());
        }

        function applyHighlight(set) {
          // Only mutate items that are currently in the DataSet, so we
          // don't accidentally re-add nodes that were filtered out.
          const inSet = visibleIds();
          const nodeUpdates = [];
          for (const id of inSet) {
            const orig = origNodeById.get(id);
            if (!orig) continue;
            if (set.has(id)) {
              nodeUpdates.push({ id, color: orig.color, font: orig.font, opacity: 1 });
            } else {
              nodeUpdates.push({
                id,
                color: { background: '#f8fafc', border: '#e2e8f0' },
                font: { ...(orig.font || {}), color: '#cbd5e1' },
                opacity: 0.25,
              });
            }
          }
          if (nodeUpdates.length) nodesDS.update(nodeUpdates);

          const inEdgeSet = visibleEdgeIds();
          const edgeUpdates = [];
          for (const eid of inEdgeSet) {
            const orig = origEdgeByKey.get(eid) || edgesDS.get(eid);
            if (!orig) continue;
            const path = set.has(orig.from) && set.has(orig.to);
            if (path) {
              edgeUpdates.push({ id: eid, color: { color: '#1e293b' }, width: 2 });
            } else {
              edgeUpdates.push({ id: eid, color: { color: 'rgba(226,232,240,0.45)' }, width: 0.4 });
            }
          }
          if (edgeUpdates.length) edgesDS.update(edgeUpdates);
        }
        function clearHighlight() {
          const inSet = visibleIds();
          const nodeUpdates = [];
          for (const id of inSet) {
            const orig = origNodeById.get(id);
            if (!orig) continue;
            nodeUpdates.push({ id, color: orig.color, font: orig.font, opacity: 1 });
          }
          if (nodeUpdates.length) nodesDS.update(nodeUpdates);

          const inEdgeSet = visibleEdgeIds();
          const edgeUpdates = [];
          for (const eid of inEdgeSet) {
            const orig = origEdgeByKey.get(eid) || edgesDS.get(eid);
            if (!orig) continue;
            edgeUpdates.push({ id: eid, color: orig.color, width: orig.width });
          }
          if (edgeUpdates.length) edgesDS.update(edgeUpdates);
        }
        network.on('hoverNode', (e) => {
          if (hovering === e.node) return;
          hovering = e.node;
          if (currentMode === 'summary') {
            // In Summary the "path" is trivial — every cluster bubble is one
            // hop from the changed file. Highlight just the bubble + edge.
            const isClusterId = String(e.node).startsWith('cluster:');
            const set = new Set();
            if (isClusterId) {
              set.add(e.node);
              set.add('__summary_changed__');
            } else {
              // Hovering the changed file → highlight everything (de-noop).
              for (const id of visibleIds()) set.add(id);
            }
            applyHighlight(set);
          } else {
            // Hovering shows the FULL neighbourhood of a node:
            //   - everything it depends on (path to changed file)
            //   - everything that depends on it (story files downstream)
            // Hovering the changed file is a no-op visually (the whole
            // cascade is its descendants) so we just clear the highlight.
            if (e.node === data.changedFile) {
              clearHighlight();
            } else {
              const set = neighborhoodOf(e.node);
              applyHighlight(set);
            }
          }
        });
        network.on('blurNode', () => {
          hovering = null;
          clearHighlight();
        });

        // ── Click for detail panel ─────────────────────────────────────
        network.on('selectNode', (e) => {
          const id = e.nodes[0];
          const node = data.nodes.find(n => n.id === id);
          if (!node) { detail.style.display = 'none'; return; }
          if (node.kind === 'storyFile' && node.storyIds) {
            const cluster = (node.clusterIdx !== undefined) ? data.clusters[node.clusterIdx] : null;
            const swatchColor = cluster ? data.palette[node.clusterIdx % data.palette.length] : null;
            detail.innerHTML =
              '<div style="font:600 12px ui-monospace,monospace;color:#0f172a;">' + escapeHtmlClient(node.id) + '</div>' +
              (cluster ? '<div style="margin-top:6px;display:flex;align-items:center;gap:8px;font-size:11px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + swatchColor + '"></span><strong>' + escapeHtmlClient(cluster.id) + '</strong> <span style="color:#64748b">' + escapeHtmlClient(cluster.rationale) + '</span></div>' : '') +
              '<div style="margin-top:8px;font-size:11px;color:#475569"><strong>' + node.storyIds.length + ' stor' + (node.storyIds.length === 1 ? 'y' : 'ies') + ':</strong></div>' +
              '<div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:3px">' + node.storyIds.map(s => '<code style="font-size:10px;background:#f1f5f9;padding:1px 5px;border-radius:3px">' + escapeHtmlClient(s) + '</code>').join('') + '</div>';
            detail.style.display = 'block';
          } else if (node.kind === 'component') {
            detail.innerHTML = '<div style="font:600 12px ui-monospace,monospace;color:#0f172a;">' + escapeHtmlClient(node.id) + '</div><div style="margin-top:4px;font-size:11px;color:#64748b">intermediate file on the import chain — hover to highlight the path through it</div>';
            detail.style.display = 'block';
          } else if (node.kind === 'changed') {
            detail.innerHTML = '<div style="font:600 12px ui-monospace,monospace;color:#0f172a;">' + escapeHtmlClient(node.id) + '</div><div style="margin-top:4px;font-size:11px;color:#64748b">changed file (cascade root)</div>';
            detail.style.display = 'block';
          }
        });
        function escapeHtmlClient(s) {
          return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }

        // ── Cluster legend filter ──────────────────────────────────────
        // Clicking a cluster name FILTERS the graph to only that cluster's
        // story files + their import chain back to the changed file. The
        // subgraph re-lays out (hierarchical mode) so it's clean and small.
        // Click 'all' to restore the full graph. The legend element is
        // already resolved above.
        function computeClusterSubset(ci) {
          const inCluster = new Set();
          for (const n of data.nodes) {
            if (n.kind === 'storyFile' && n.clusterIdx === ci) inCluster.add(n.id);
          }
          const reachable = new Set(inCluster);
          reachable.add(data.changedFile);
          const queue = [...inCluster];
          while (queue.length) {
            const f = queue.shift();
            for (const p of (childToParents.get(f) || [])) {
              if (!reachable.has(p)) { reachable.add(p); queue.push(p); }
            }
          }
          return reachable;
        }
        function applyClusterFilter(ci) {
          const reachable = ci === null ? null : computeClusterSubset(ci);
          if (reachable === null) {
            // Restore full graph
            nodesDS.clear();
            nodesDS.add(visNodes);
            edgesDS.clear();
            edgesDS.add(visEdges.map((e, i) => ({ ...e, id: 'e' + i })));
          } else {
            const keepNodes = visNodes.filter(n => reachable.has(n.id));
            const keepEdges = visEdges
              .map((e, i) => ({ ...e, id: 'e' + i }))
              .filter(e => reachable.has(e.from) && reachable.has(e.to));
            nodesDS.clear();
            nodesDS.add(keepNodes);
            edgesDS.clear();
            edgesDS.add(keepEdges);
          }
          // Re-fit so the smaller subgraph fills the canvas.
          setTimeout(() => network.fit({ animation: { duration: 300 } }), 100);
        }
        legend.querySelectorAll('.cluster-toggle').forEach((el) => {
          el.addEventListener('click', () => {
            const target = el.getAttribute('data-cluster');
            legend.querySelectorAll('.cluster-toggle').forEach(x => x.classList.remove('active'));
            if (target === 'all') {
              applyClusterFilter(null);
              return;
            }
            const ci = parseInt(target, 10);
            el.classList.add('active');
            applyClusterFilter(ci);
          });
        });
      })();
    </script>
  </details>`;
}

/** Render the full SDK transcript captured during a run as an expandable
 *  conversation view. The transcript is a compact JSON projection of every
 *  message exchanged with `query()` (see `lib/invoke-agent.ts`), so it can be
 *  reproduced from the JSONL row alone — no need to re-invoke the SDK. */
function renderTranscript(
  transcript: TranscriptEntry[] | undefined,
  sessionId: string | undefined
): string {
  if (!transcript || transcript.length === 0) {
    return '';
  }

  const fmtMs = (ms: number) => `+${(ms / 1000).toFixed(1)}s`;
  const previewText = (text: string, max = 4000) =>
    text.length > max
      ? escapeHtml(text.slice(0, max)) +
        `<span class="muted">… (+${text.length - max} chars truncated; expand JSON view below)</span>`
      : escapeHtml(text);

  const entryHtml = transcript
    .map((e) => {
      const t = `<span class="transcript-time">${fmtMs(e.ms)}</span>`;
      if (e.kind === 'system') {
        const tools = e.tools && e.tools.length > 0 ? ` tools=${e.tools.length}` : '';
        return `<li class="transcript-entry sys">${t}<span class="badge muted">system</span> ${escapeHtml(e.subtype ?? '')} <code>${escapeHtml(e.model ?? '')}</code><span class="muted">${tools}</span></li>`;
      }
      if (e.kind === 'assistant') {
        const blocks = e.content
          .map((b) => {
            if (b.type === 'thinking') {
              return `<div class="block thinking"><span class="block-label">thinking</span><pre>${previewText((b as any).text ?? '')}</pre></div>`;
            }
            if (b.type === 'text') {
              return `<div class="block text"><span class="block-label">text</span><pre>${previewText((b as any).text ?? '')}</pre></div>`;
            }
            if (b.type === 'tool_use') {
              const name = escapeHtml(String((b as any).name ?? ''));
              const input = escapeHtml(JSON.stringify((b as any).input, null, 2));
              return `<div class="block tool-use"><span class="block-label">tool_use</span> <code>${name}</code><pre>${input}</pre></div>`;
            }
            return `<div class="block other"><span class="block-label">${escapeHtml(b.type)}</span></div>`;
          })
          .join('');
        const usage = e.usage
          ? `<span class="muted">in ${fmtNum(e.usage.input_tokens)} / out ${fmtNum(e.usage.output_tokens)}</span>`
          : '';
        return `<li class="transcript-entry assistant">${t}<span class="badge">assistant</span> ${usage}${blocks}</li>`;
      }
      if (e.kind === 'user') {
        const blocks = e.content
          .map((b) => {
            if (b.type === 'tool_result') {
              const c = (b as any).content;
              const text =
                typeof c === 'string'
                  ? c
                  : Array.isArray(c)
                    ? c
                        .map((x: any) =>
                          x?.type === 'text' ? String(x.text ?? '') : JSON.stringify(x)
                        )
                        .join('\n')
                    : JSON.stringify(c);
              const isError = (b as any).is_error ? ' err' : '';
              return `<div class="block tool-result${isError}"><span class="block-label">tool_result</span><pre>${previewText(text)}</pre></div>`;
            }
            return `<div class="block other"><span class="block-label">${escapeHtml(b.type)}</span></div>`;
          })
          .join('');
        return `<li class="transcript-entry user">${t}<span class="badge muted">user</span>${blocks}</li>`;
      }
      if (e.kind === 'result') {
        return `<li class="transcript-entry result">${t}<span class="badge ${e.subtype === 'success' ? 'good' : 'bad'}">result</span> ${escapeHtml(e.subtype ?? '')} <span class="muted">cost ${fmtCost(e.total_cost_usd)} · ${fmtNum(e.num_turns)} turns · ${fmtNum((e.duration_ms ?? 0) / 1000, 1)}s wall / ${fmtNum((e.duration_api_ms ?? 0) / 1000, 1)}s api</span></li>`;
      }
      if (e.kind === 'rate_limit') {
        const reset = e.resetsAt ? new Date(e.resetsAt * 1000).toLocaleString() : '?';
        const overage =
          e.isUsingOverage === true
            ? '<span class="badge bad">using overage</span>'
            : e.overageStatus === 'rejected'
              ? '<span class="muted">overage off</span>'
              : '';
        return `<li class="transcript-entry rate-limit">${t}<span class="badge muted">rate_limit</span> ${escapeHtml(e.rateLimitType ?? '')} status <strong>${escapeHtml(e.status ?? '?')}</strong> · resets ${escapeHtml(reset)} ${overage}</li>`;
      }
      return `<li class="transcript-entry other">${t}<span class="badge muted">${escapeHtml(e.type ?? 'other')}</span></li>`;
    })
    .join('');

  const sessionLabel = sessionId
    ? `session <code>${escapeHtml(sessionId)}</code>`
    : '<span class="muted">no session id</span>';

  return `<details class="transcript-block">
    <summary>Agent conversation <span class="muted">(${transcript.length} messages · ${sessionLabel})</span></summary>
    <ol class="transcript-list">${entryHtml}</ol>
    <details>
      <summary class="muted">Raw transcript JSON</summary>
      <pre class="raw">${escapeHtml(JSON.stringify(transcript, null, 2))}</pre>
    </details>
  </details>`;
}

function renderRunDetail(
  r: RunRow,
  idx: number,
  forwardEdges?: Record<string, string[]>,
  expandedByDefault = true
): string {
  const id = `run-${idx}`;
  const a = r.agentRun;
  const s = r.scores;
  const headBadges = [
    `<span class="badge">${escapeHtml(r.scenario)}</span>`,
    `<span class="badge muted">${new Date(r.timestamp).toLocaleString()}</span>`,
    a ? `<span class="badge">${escapeHtml(a.model)}</span>` : '',
    a?.promptVariant ? `<span class="badge">prompt=${escapeHtml(a.promptVariant)}</span>` : '',
    a?.effort ? `<span class="badge">effort=${escapeHtml(a.effort)}</span>` : '',
    !a ? `<span class="badge muted">baseline-only</span>` : '',
    a?.parseError ? `<span class="badge bad">parse error</span>` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const traceRows = a?.messageTrace
    ? Object.entries(a.messageTrace.typeCounts)
        .map(([t, c]) => `<tr><td>${escapeHtml(t)}</td><td>${c}</td></tr>`)
        .join('')
    : '';

  const clusterBlock = a?.clusters
    ? a.clusters
        .map((c) => {
          const stories = c.stories ?? [];
          return `<details class="cluster">
        <summary>
          <span class="cluster-id">${escapeHtml(c.id)}</span>
          <span class="muted">${c.storyCount} stories</span>
          ${c.representative ? `<span class="muted">repr: <code>${escapeHtml(c.representative)}</code></span>` : ''}
        </summary>
        <div class="rationale">${escapeHtml(c.rationale)}</div>
        ${
          stories.length > 0
            ? `<div class="story-list">${stories.slice(0, 50).map((id) => `<code>${escapeHtml(id)}</code>`).join(' ')}${stories.length > 50 ? `<span class="muted">… +${stories.length - 50} more</span>` : ''}</div>`
            : '<p class="muted">(story list not captured in this run)</p>'
        }
      </details>`;
        })
        .join('')
    : '<p class="muted">No clusters (no agent run or parse failed)</p>';

  // Headline KPIs only — 6 tiles. Everything else collapsed.
  const headlineKpis = `<div class="kpi-grid small">
    <div class="kpi"><div class="kpi-value">${fmtNum(r.groundTruth.total)}</div><div class="kpi-label">cascade</div></div>
    <div class="kpi"><div class="kpi-value">${fmtNum(r.payload.estimatedTokens)}</div><div class="kpi-label">payload tokens</div></div>
    <div class="kpi"><div class="kpi-value">${fmtCost(a?.costUsd)}</div><div class="kpi-label">cost</div></div>
    <div class="kpi"><div class="kpi-value">${fmtNum(a?.durationS)}s</div><div class="kpi-label">duration</div></div>
    <div class="kpi"><div class="kpi-value">${a?.clusterCount ?? '-'}</div><div class="kpi-label">clusters</div></div>
    ${s ? `<div class="kpi"><div class="kpi-value ${s.recall >= 0.95 ? 'good' : 'warn'}">${fmtPct(s.recall)}</div><div class="kpi-label">recall</div></div>` : ''}
    ${s ? `<div class="kpi"><div class="kpi-value ${s.clusterPurity >= 0.5 ? 'good' : s.clusterPurity >= 0.25 ? 'warn' : 'bad'}">${fmtPct(s.clusterPurity)}</div><div class="kpi-label">purity</div></div>` : ''}
  </div>`;

  const detailKpis = `<details>
    <summary>More metrics <span class="muted">(precision, tokens, signature quality)</span></summary>
    <div class="kpi-grid small">
      <div class="kpi"><div class="kpi-value">${fmtNum(a?.inputTokens)}</div><div class="kpi-label">SDK input fresh</div></div>
      <div class="kpi"><div class="kpi-value">${fmtNum(a?.cacheReadTokens)}</div><div class="kpi-label">SDK input cached</div></div>
      <div class="kpi"><div class="kpi-value">${fmtNum(a?.outputTokens)}</div><div class="kpi-label">SDK output</div></div>
      ${s ? `<div class="kpi"><div class="kpi-value">${fmtPct(s.precision)}</div><div class="kpi-label">precision</div></div>` : ''}
      ${r.signatureQuality ? `<div class="kpi"><div class="kpi-value ${r.signatureQuality.catchAllShare <= 0.3 ? 'good' : r.signatureQuality.catchAllShare <= 0.5 ? 'warn' : 'bad'}">${fmtPct(r.signatureQuality.catchAllShare)}</div><div class="kpi-label">catch-all share</div></div>` : ''}
      ${r.signatureQuality ? `<div class="kpi"><div class="kpi-value ${r.signatureQuality.representativeValidRate >= 0.95 ? 'good' : 'warn'}">${r.signatureQuality.representativeValidCount}/${r.signatureQuality.representativeTotalCount}</div><div class="kpi-label">repr valid</div></div>` : ''}
    </div>
  </details>`;

  const isOldRun = !r.payload.storyToFile;
  // Short summary for the collapsed state — quick glance at the run's identity.
  const summaryLine = [
    a?.model && `<code>${escapeHtml(a.model)}</code>`,
    a?.promptVariant && `<span class="muted">prompt=${escapeHtml(a.promptVariant)}</span>`,
    s && `recall <strong>${fmtPct(s.recall)}</strong>`,
    s && `purity <strong>${fmtPct(s.clusterPurity)}</strong>`,
    a && `<strong>${fmtCost(a.costUsd)}</strong>`,
    a && `${Math.round(a.durationS ?? 0)}s`,
  ]
    .filter(Boolean)
    .join(' · ');

  return `<details class="run-wrapper"${expandedByDefault ? ' open' : ''}>
  <summary class="run-summary">
    <span class="run-summary-title">Run #${idx} — <code>${escapeHtml(r.scenario)}</code></span>
    <span class="run-summary-meta">${summaryLine}</span>
  </summary>
  <article class="card run${isOldRun ? ' compact' : ''}" id="${id}">
    <header>
      <div>${headBadges}</div>
    </header>

    ${headlineKpis}
    ${detailKpis}

    ${renderClusterGraph(r, idx, forwardEdges)}

    <details>
      <summary>Edit & raw diff <span class="muted">(${escapeHtml(r.edit?.path ?? '?')})</span></summary>
      <pre class="diff">${escapeHtml(r.rawDiff ?? '<no diff captured for this run>')}</pre>
    </details>

    <details>
      <summary>Change-detection ground truth <span class="muted">(${r.groundTruth.modified} modified · ${r.groundTruth.affected} affected · ${r.groundTruth.new} new)</span></summary>
      <div class="story-list">
        ${(r.payload.modified ?? []).slice(0, 60).map((id) => `<code class="modified">${escapeHtml(id)}</code>`).join(' ')}
        ${(r.payload.affected ?? []).slice(0, 60).map((id) => `<code class="affected">${escapeHtml(id)}</code>`).join(' ')}
        ${(r.payload.modified ?? []).length + (r.payload.affected ?? []).length > 120 ? '<p class="muted">(showing first 60+60 of each)</p>' : ''}
      </div>
    </details>

    <details>
      <summary>Project shape</summary>
      <p>Total stories indexed: <strong>${fmtNum(r.payload.projectShape?.totalStories)}</strong></p>
      <ul>${(r.payload.projectShape?.topNamespaces ?? []).map((n) => `<li><code>${escapeHtml(n.name)}</code> — ${fmtNum(n.count)}</li>`).join('')}</ul>
    </details>

    ${a?.messageTrace ? `<details>
      <summary>SDK message trace (${a.messageTrace.totalMessages} messages, first @ ${fmtNum((a.messageTrace.firstMessageMs ?? 0) / 1000, 1)}s, last @ ${fmtNum((a.messageTrace.lastMessageMs ?? 0) / 1000, 1)}s)</summary>
      <table class="table small"><thead><tr><th>type</th><th>count</th></tr></thead><tbody>${traceRows}</tbody></table>
    </details>` : ''}

    ${renderTranscript(a?.transcript, a?.sessionId)}

    ${a?.rawOutput ? `<details>
      <summary>Raw agent output (${a.rawOutput.length} chars)</summary>
      <pre class="raw">${escapeHtml(a.rawOutput)}</pre>
    </details>` : ''}

    <details open>
      <summary>Clusters (${a?.clusterCount ?? 0})</summary>
      ${clusterBlock}
    </details>

    ${a?.parseError ? `<div class="error">Parse error: ${escapeHtml(a.parseError)}</div>` : ''}
  </article>
</details>`;
}

function renderDeterministicBaselines(rep: DeterministicBaselinesReport | null): string {
  if (!rep) {
    return `<section class="card"><h2>Deterministic clustering baselines (Round-2 §O)</h2><p class="muted">No deterministic-baselines.json found. Run <code>node --experimental-transform-types --no-warnings scripts/eval/inner-loop/deterministic-baselines.ts</code>.</p></section>`;
  }
  return `<section class="card">
    <h2>Deterministic clustering baselines (Round-2 §O)</h2>
    <p class="muted">Generated ${new Date(rep.timestamp).toLocaleString()}. Two cheap deterministic alternatives to the LLM categoriser, scored against the same recall/precision/purity metric.</p>
    <details>
      <summary>How to read this table — IMPORTANT</summary>
      <pre style="white-space:pre-wrap;font:11px/1.5 ui-monospace,monospace;background:#f8f8fa;padding:12px;border-radius:4px;">${escapeHtml(rep.interpretation)}</pre>
    </details>
    <table class="table">
      <thead><tr>
        <th>scenario</th><th>cascade</th>
        <th colspan="3">LLM (signature/low)</th>
        <th colspan="2">namespace baseline</th>
        <th colspan="2">shared-files baseline</th>
      </tr><tr>
        <th></th><th></th>
        <th>n</th><th>purity</th><th>clusters</th>
        <th>purity</th><th>clusters</th>
        <th>purity</th><th>clusters</th>
      </tr></thead>
      <tbody>
        ${rep.perScenario
          .map(
            (s) => `<tr>
            <td><code>${escapeHtml(s.scenario)}</code></td>
            <td>${fmtNum(s.cascadeSize)}</td>
            <td>${s.llm.runs}</td>
            <td>${s.llm.avgPurity === null ? '-' : fmtPct(s.llm.avgPurity)}</td>
            <td class="${(s.llm.avgClusterCount ?? 0) >= 3 && (s.llm.avgClusterCount ?? 0) <= 12 ? 'good' : 'warn'}">${s.llm.avgClusterCount?.toFixed(1) ?? '-'}</td>
            <td>${fmtPct(s.namespace.clusterPurity)}</td>
            <td class="${s.namespace.clusterCount <= 12 ? 'good' : s.namespace.clusterCount <= 30 ? 'warn' : 'bad'}">${s.namespace.clusterCount}</td>
            <td>${fmtPct(s.sharedFiles.clusterPurity)}</td>
            <td class="${s.sharedFiles.clusterCount <= 12 ? 'good' : s.sharedFiles.clusterCount <= 30 ? 'warn' : 'bad'}">${s.sharedFiles.clusterCount}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
    <p class="muted small">Cluster-count colour: green = UX-usable (3–12); amber = borderline (13–30); red = unusable (>30).</p>
  </section>`;
}

/** Convert a replay row to a RunRow-shaped object so renderClusterGraph
 *  can be reused for it. */
function replayToRunShape(r: ReplayRow): RunRow {
  const path = r.commit?.paths?.[0] ?? r.changedFiles?.[0] ?? '?';
  return {
    timestamp: r.timestamp,
    scenario: r.commit.shortSha,
    description: r.commit.subject,
    edit: { path },
    payload: {
      totalSizeBytes: 0,
      estimatedTokens: r.payloadTokens ?? 0,
      modified: r.modified ?? [],
      affected: r.affected ?? [],
      newStories: [],
      cssAffected: [],
      storyToFile: r.storyToFile,
    },
    agentRun: r.agent
      ? {
          model: r.agent.model,
          promptVariant: r.agent.promptVariant,
          turns: 1,
          costUsd: r.agent.costUsd,
          durationS: r.agent.durationS,
          inputTokens: r.agent.inputTokens,
          outputTokens: r.agent.outputTokens,
          cacheReadTokens: r.agent.cacheReadTokens,
          clusterCount: r.agent.clusterCount,
          clusters: r.agent.clusters,
        }
      : null,
    scores: r.scores
      ? {
          ...r.scores,
          groundTruthSize: r.groundTruth?.total ?? 0,
          agentOutputSize: r.groundTruth?.total ?? 0,
          duplicateCount: 0,
          hallucinationCount: 0,
          missingCount: 0,
        }
      : null,
    groundTruth: {
      modified: r.groundTruth?.modified ?? 0,
      affected: r.groundTruth?.affected ?? 0,
      new: 0,
      total: r.groundTruth?.total ?? 0,
      withinExpectedRange: true,
    },
  };
}

function renderReplaySection(
  rows: ReplayRow[],
  forwardEdges?: Record<string, string[]>
): string {
  if (rows.length === 0) {
    return `<section class="card"><h2>Real-world commit replay (Round-2 §L)</h2><p class="muted">No <code>replay-real-*.jsonl</code> found. Run <code>node --experimental-transform-types --no-warnings scripts/eval/inner-loop/replay-real-commits.ts --max 12</code>.</p></section>`;
  }
  const success = rows.filter((r) => r.outcome === 'success');
  const successCount = success.length;
  const skipped = rows.length - successCount;
  const totalStories = success.reduce((s, r) => s + (r.groundTruth?.total ?? 0), 0);
  const avgCascade = successCount ? totalStories / successCount : 0;
  const totalCost = success.reduce((s, r) => s + (r.agent?.costUsd ?? 0), 0);
  const recallStable = success.every((r) => (r.scores?.recall ?? 0) >= 0.99);
  const precStable = success.every((r) => (r.scores?.precision ?? 0) >= 0.99);

  // Bucket by cascade size
  const small = success.filter((r) => (r.groundTruth?.total ?? 0) <= 50);
  const med = success.filter((r) => (r.groundTruth?.total ?? 0) > 50 && (r.groundTruth?.total ?? 0) <= 500);
  const large = success.filter((r) => (r.groundTruth?.total ?? 0) > 500);

  const summarise = (arr: ReplayRow[]) => {
    if (arr.length === 0) return null;
    const purities = arr.map((r) => r.scores!.clusterPurity);
    const clusters = arr.map((r) => r.agent!.clusterCount);
    const durs = arr.map((r) => r.agent!.durationS);
    const costs = arr.map((r) => r.agent!.costUsd ?? 0);
    const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    return {
      n: arr.length,
      avgCascade: avg(arr.map((r) => r.groundTruth!.total)),
      avgPurity: avg(purities),
      avgClusters: avg(clusters),
      avgDuration: avg(durs),
      avgCost: avg(costs),
    };
  };

  const buckets = [
    { name: '≤50 stories', s: summarise(small) },
    { name: '51-500', s: summarise(med) },
    { name: '>500', s: summarise(large) },
  ].filter((b) => b.s !== null);

  return `<section class="card">
    <h2>Real-world commit replay (Round-2 §L)</h2>
    <p class="muted">Replays recent <code>origin/next</code> commits by reverse-applying their patch and measuring the resulting change-detection cascade + categoriser quality. Uses the same signature-prompt + Sonnet/low pipeline as the synthetic scenarios.</p>

    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-value">${rows.length}</div><div class="kpi-label">commits attempted</div></div>
      <div class="kpi"><div class="kpi-value good">${successCount}</div><div class="kpi-label">successful runs</div></div>
      <div class="kpi"><div class="kpi-value ${skipped > rows.length / 2 ? 'warn' : ''}">${skipped}</div><div class="kpi-label">skipped (apply-fail / empty / parse-fail)</div></div>
      <div class="kpi"><div class="kpi-value">${fmtNum(avgCascade)}</div><div class="kpi-label">avg cascade size</div></div>
      <div class="kpi"><div class="kpi-value">${fmtCost(totalCost)}</div><div class="kpi-label">total agent cost</div></div>
      <div class="kpi"><div class="kpi-value ${recallStable ? 'good' : 'warn'}">${recallStable ? 'stable' : 'drifts'}</div><div class="kpi-label">recall ≥0.99 across all</div></div>
      <div class="kpi"><div class="kpi-value ${precStable ? 'good' : 'warn'}">${precStable ? 'stable' : 'drifts'}</div><div class="kpi-label">precision ≥0.99 across all</div></div>
    </div>

    ${buckets.length > 0 ? `<h3>By cascade size bucket</h3>
    <table class="table">
      <thead><tr><th>bucket</th><th>n</th><th>avg cascade</th><th>avg purity</th><th>avg clusters</th><th>avg duration</th><th>avg cost</th></tr></thead>
      <tbody>
        ${buckets
          .map(
            (b) => `<tr>
            <td>${escapeHtml(b.name)}</td>
            <td>${b.s!.n}</td>
            <td>${fmtNum(b.s!.avgCascade)}</td>
            <td>${fmtPct(b.s!.avgPurity)}</td>
            <td>${b.s!.avgClusters.toFixed(1)}</td>
            <td>${b.s!.avgDuration.toFixed(1)}s</td>
            <td>${fmtCost(b.s!.avgCost)}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>` : ''}

    <details>
    <summary><h3 style="display:inline; margin:0">Per-commit detail table</h3> <span class="muted">(${rows.length} rows)</span></summary>
    <table class="table small">
      <thead><tr>
        <th>sha</th><th>subject</th><th>files +/-</th>
        <th>cascade</th><th>tokens</th>
        <th>recall</th><th>precision</th><th>purity</th>
        <th>clusters</th><th>cost</th>
        <th>determ ns / shared-files</th>
        <th>outcome</th>
      </tr></thead>
      <tbody>
        ${rows
          .map((r) => {
            if (r.outcome !== 'success') {
              return `<tr style="opacity:0.6">
                <td><code>${escapeHtml(r.commit.shortSha)}</code></td>
                <td>${escapeHtml(r.commit.subject.slice(0, 60))}</td>
                <td>${r.commit.filesChanged}f +${r.commit.insertions}/-${r.commit.deletions}</td>
                <td colspan="8" class="muted">${escapeHtml(r.outcome)}${r.reason ? ` — ${escapeHtml(r.reason.slice(0, 80))}` : ''}</td>
              </tr>`;
            }
            return `<tr>
              <td><code>${escapeHtml(r.commit.shortSha)}</code></td>
              <td>${escapeHtml(r.commit.subject.slice(0, 60))}</td>
              <td>${r.commit.filesChanged}f +${r.commit.insertions}/-${r.commit.deletions}</td>
              <td>${fmtNum(r.groundTruth!.total)}</td>
              <td>${fmtNum(r.payloadTokens)}</td>
              <td class="${r.scores!.recall >= 0.99 ? 'good' : 'warn'}">${fmtPct(r.scores!.recall)}</td>
              <td>${fmtPct(r.scores!.precision)}</td>
              <td>${fmtPct(r.scores!.clusterPurity)}</td>
              <td>${r.agent!.clusterCount}</td>
              <td>${fmtCost(r.agent!.costUsd)}</td>
              <td class="muted small">ns=${r.deterministicComparison?.namespace.clusterCount ?? '-'} / sf=${r.deterministicComparison?.sharedFiles.clusterCount ?? '-'}</td>
              <td><span class="good">✓</span></td>
            </tr>`;
          })
          .join('')}
      </tbody>
    </table>
    </details>

    <h3 style="margin-top:18px">Visual file graphs per commit</h3>
    ${rows
      .filter((r) => r.outcome === 'success' && r.storyToFile && Object.keys(r.storyToFile).length > 0)
      .map((r, i) => {
        const shaped = replayToRunShape(r);
        return `<details class="run-wrapper"${i === 0 ? ' open' : ''}>
          <summary class="run-summary">
            <span class="run-summary-title"><code>${escapeHtml(r.commit.shortSha)}</code> ${escapeHtml(r.commit.subject.slice(0, 70))}</span>
            <span class="run-summary-meta">cascade <strong>${fmtNum(r.groundTruth?.total)}</strong> · purity <strong>${fmtPct(r.scores?.clusterPurity)}</strong> · ${fmtCost(r.agent?.costUsd)}</span>
          </summary>
          <div class="bucket">
            ${renderClusterGraph(shaped, 1000 + i, forwardEdges)}
          </div>
        </details>`;
      })
      .join('')}
  </section>`;
}

function renderTopFilesGraph(rep: ModuleGraphReport): string {
  // Visual graph for top-50 fan-in files. Shows each file as a node sized by
  // its importer count; edges connect files that share namespace prefixes (a
  // proxy for "co-located" since we don't have file-level edges in the JSON).
  const top = rep.top50FilesByImporterCount;
  const nodes = top.map((e, i) => {
    const dirParts = e.file.split('/').slice(0, 3).join('/');
    return {
      id: e.file,
      label: e.file.split('/').pop() ?? e.file,
      title: `${e.file}\\n${e.importerCount} importing story files`,
      value: e.importerCount,
      group: dirParts,
    };
  });
  // Edges: connect each top-50 file to the next two files sharing the same
  // top-level dir, so the graph clusters visually by directory.
  const edges: { from: string; to: string }[] = [];
  const byTopDir = new Map<string, string[]>();
  for (const e of top) {
    const k = e.file.split('/')[0];
    if (!byTopDir.has(k)) byTopDir.set(k, []);
    byTopDir.get(k)!.push(e.file);
  }
  for (const files of byTopDir.values()) {
    for (let i = 0; i < files.length - 1; i++) {
      edges.push({ from: files[i], to: files[i + 1] });
    }
  }

  return `<details>
    <summary><strong>Visual: top-50 fan-in files (interactive)</strong></summary>
    <div class="graph-controls">
      <button onclick="topFilesFit()">Fit</button>
      <button onclick="topFilesTogglePhysics()">Toggle physics</button>
      <span class="label">Hover for path · scroll to zoom · node size = importer count</span>
    </div>
    <div id="top-files-graph" class="graph-container tall"></div>
    <script type="application/json" id="top-files-data">${JSON.stringify({ nodes, edges })}</script>
    <script>
      (function() {
        const data = JSON.parse(document.getElementById('top-files-data').textContent);
        const network = new vis.Network(
          document.getElementById('top-files-graph'),
          {
            nodes: data.nodes.map(n => ({
              ...n,
              shape: 'dot',
              scaling: { min: 8, max: 40, label: { enabled: true, min: 8, max: 16 } },
            })),
            edges: data.edges.map(e => ({ ...e, color: { color: '#e5e5e7', opacity: 0.4 }, width: 0.5 })),
          },
          {
            physics: {
              enabled: true,
              barnesHut: { gravitationalConstant: -3000, springLength: 100, damping: 0.5 },
              stabilization: { iterations: 150 },
            },
            interaction: { hover: true, tooltipDelay: 100 },
            edges: { smooth: false },
          }
        );
        let physicsOn = true;
        window.topFilesFit = () => network.fit();
        window.topFilesTogglePhysics = () => {
          physicsOn = !physicsOn;
          network.setOptions({ physics: { enabled: physicsOn } });
        };
        network.once('stabilizationIterationsDone', () => {
          network.setOptions({ physics: { enabled: false } });
          physicsOn = false;
        });
      })();
    </script>
  </details>`;
}

function renderModuleGraph(rep: ModuleGraphReport | null): string {
  if (!rep) {
    return `<section class="card"><h2>Module-graph characterisation</h2><p class="muted">No module-graph.json found. Run <code>node --experimental-transform-types --no-warnings scripts/eval/inner-loop/module-graph-experiment.ts</code> to populate.</p></section>`;
  }
  const totalReverseFiles = rep.totalFilesInReverseIndex;
  const maxBucket = Math.max(...rep.histogram.map((b) => b.count));
  const maxDepthShare = Math.max(...rep.depthHistogram.map((r) => r.share));
  const maxModBucketCount = Math.max(...rep.modifiedSizeHistogram.buckets.map((b) => b.count));
  const bar = (frac: number, w = 200) =>
    `<div class="bar" style="width:${Math.max(2, Math.round(frac * w))}px"></div>`;

  return `<section class="card">
    <h2>Module-graph characterisation (Round-2 follow-up I.1)</h2>
    <p class="muted">Generated ${new Date(rep.timestamp).toLocaleString()}. Built in ${rep.buildMs}ms — ${fmtNum(rep.totalStoryFiles)} story files, ${fmtNum(rep.totalFilesInGraph)} files in graph, ${fmtNum(rep.totalFilesInReverseIndex)} files in reverse index.</p>
    ${rep.unitsNote ? `<p class="muted small"><em>${escapeHtml(rep.unitsNote)}</em></p>` : ''}

    <div class="kpi-grid">
      <div class="kpi"><div class="kpi-value good">${fmtPct(rep.summary.lowFanIn_lte10.share)}</div><div class="kpi-label">files with ≤10 importers (good case)</div></div>
      <div class="kpi"><div class="kpi-value warn">${fmtPct(rep.summary.highFanIn_gt100.share)}</div><div class="kpi-label">files with &gt;100 importers (cascade-prone)</div></div>
      <div class="kpi"><div class="kpi-value">${fmtPct(rep.summary.veryHighFanIn_gt500.share)}</div><div class="kpi-label">files with &gt;500 importers (worst case)</div></div>
    </div>

    <h3>Blast-radius histogram (importers per file)</h3>
    <table class="table small">
      <thead><tr><th>importer count</th><th>files</th><th>share</th><th></th></tr></thead>
      <tbody>
        ${rep.histogram
          .map(
            (b) => `<tr>
            <td>${escapeHtml(b.label)}</td>
            <td>${fmtNum(b.count)}</td>
            <td>${fmtPct(b.count / totalReverseFiles)}</td>
            <td>${bar(b.count / maxBucket)}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>

    <h3>Depth distribution (edges between dep and importing story)</h3>
    <p class="muted small">"Depth 0" = the story file itself; depth 1 = a direct import; depth N = N hops through the import graph.</p>
    <table class="table small">
      <thead><tr><th>depth</th><th>edges</th><th>share</th><th></th></tr></thead>
      <tbody>
        ${rep.depthHistogram
          .slice(0, 12)
          .map(
            (r) => `<tr>
            <td>${r.depth}</td>
            <td>${fmtNum(r.count)}</td>
            <td>${fmtPct(r.share)}</td>
            <td>${bar(r.share / maxDepthShare)}</td>
          </tr>`
          )
          .join('')}
        ${rep.depthHistogram.length > 12 ? `<tr><td colspan="4" class="muted">... ${rep.depthHistogram.length - 12} deeper tiers</td></tr>` : ''}
      </tbody>
    </table>

    <h3>"<code>modified</code>" set size — how many stories tie at the lowest distance</h3>
    <p class="muted small">${escapeHtml(rep.modifiedSizeHistogram.description)} <strong>Why this matters:</strong> if 70%+ of edits resolve to a single <code>modified</code> story, the UI can confidently lead with that one card — no narrowing needed. The remaining ~30% is where the agent layer earns its place.</p>
    <table class="table small">
      <thead><tr><th>|modified|</th><th>files</th><th>share</th><th></th></tr></thead>
      <tbody>
        ${rep.modifiedSizeHistogram.buckets
          .map(
            (b) => `<tr>
            <td>${escapeHtml(b.label)}</td>
            <td>${fmtNum(b.count)}</td>
            <td>${fmtPct(b.count / rep.modifiedSizeHistogram.totalFiles)}</td>
            <td>${bar(b.count / maxModBucketCount)}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>

    ${renderTopFilesGraph(rep)}

    <details>
      <summary>Top 50 files by importer count (table)</summary>
      <table class="table small">
        <thead><tr><th>#</th><th>file</th><th>importing story files</th></tr></thead>
        <tbody>
          ${rep.top50FilesByImporterCount
            .map(
              (e, i) =>
                `<tr><td>${i + 1}</td><td><code>${escapeHtml(e.file)}</code></td><td>${fmtNum(e.importerCount)}</td></tr>`
            )
            .join('')}
        </tbody>
      </table>
    </details>
  </section>`;
}

function renderCssBlast(rep: CssBlastReport | null): string {
  if (!rep) {
    return `<section class="card"><h2>CSS blast-radius synthesis</h2><p class="muted">No css-blast-radius.json found. Run <code>node --experimental-transform-types --no-warnings scripts/eval/inner-loop/css-blast-experiment.ts</code> to populate.</p></section>`;
  }
  return `<section class="card">
    <h2>CSS blast-radius synthesis (Experiment C)</h2>
    <p class="muted">Generated ${new Date(rep.timestamp).toLocaleString()}.</p>
    <p>${escapeHtml(rep.caveat)}</p>
    <table class="table">
      <thead><tr><th>changed CSS file</th><th>siblings</th><th>synthesised stories</th></tr></thead>
      <tbody>
        ${rep.results
          .map(
            (r) => `<tr>
            <td><code>${escapeHtml(r.changedCssFile.replace(rep.projectRoot + '/', ''))}</code></td>
            <td>${r.siblingFiles.length}</td>
            <td>${r.importingStories.length}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
    <details>
      <summary>Per-probe detail</summary>
      ${rep.results
        .map(
          (r) => `<div class="bucket">
        <h4><code>${escapeHtml(r.changedCssFile.replace(rep.projectRoot + '/', ''))}</code></h4>
        <p>Siblings (${r.siblingFiles.length}): ${r.siblingFiles.map((s) => `<code>${escapeHtml(s)}</code>`).join(', ') || '<em>none</em>'}</p>
        <p>Importing stories (${r.importingStories.length}):</p>
        <div class="story-list">${r.importingStories.map((s) => `<code>${escapeHtml(s.replace(rep.projectRoot + '/', ''))}</code>`).join(' ') || '<em>none</em>'}</div>
        <table class="table small"><thead><tr><th>sibling</th><th>importers</th></tr></thead><tbody>
          ${r.perSibling
            .map((ps) => `<tr><td><code>${escapeHtml(ps.sibling)}</code></td><td>${ps.storyCount}</td></tr>`)
            .join('')}
        </tbody></table>
      </div>`
        )
        .join('')}
    </details>
  </section>`;
}

function renderHead(): string {
  return `<head>
  <meta charset="utf-8">
  <title>Inner-loop agent eval report</title>
  <script src="https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { font: 13px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #f5f5f7; color: #1a1a1a; }
    h1 { font-size: 20px; margin: 0; }
    h2 { font-size: 16px; margin: 0 0 12px; }
    h3 { font-size: 14px; margin: 16px 0 8px; }
    h4 { font-size: 13px; margin: 12px 0 6px; }
    nav { position: sticky; top: 0; background: #1a1a1a; color: #fff; padding: 12px 24px; z-index: 10; box-shadow: 0 2px 6px rgba(0,0,0,.15); display: flex; gap: 18px; align-items: center; }
    nav a { color: #fff; text-decoration: none; opacity: .8; font-size: 13px; }
    nav a:hover { opacity: 1; }
    main { padding: 24px; max-width: 1280px; margin: 0 auto; }
    .card { background: #fff; border-radius: 8px; padding: 16px 20px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(0,0,0,.05); }
    .card.run { border-left: 3px solid #2563eb; }
    .card.run header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; background: #eef; color: #224; font-size: 11px; }
    .badge.muted { background: #eee; color: #666; }
    .badge.bad { background: #fee; color: #c00; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin: 12px 0; }
    .kpi-grid.small { grid-template-columns: repeat(auto-fit, minmax(96px, 1fr)); }
    .kpi { background: #f8f8fa; padding: 8px 10px; border-radius: 6px; }
    .kpi-value { font-size: 18px; font-weight: 600; line-height: 1.2; }
    .kpi-grid.small .kpi-value { font-size: 14px; }
    .kpi-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: .04em; margin-top: 2px; }
    .good { color: #047857; }
    .warn { color: #b45309; }
    .bad { color: #b91c1c; }
    .table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 8px 0; }
    .table th, .table td { padding: 6px 10px; text-align: left; border-bottom: 1px solid #eee; }
    .table th { background: #f8f8fa; font-weight: 600; }
    .table.small { font-size: 11px; }
    code { background: #f4f4f6; padding: 1px 6px; border-radius: 3px; font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-word; }
    code.modified { background: #fef3c7; color: #78350f; }
    code.affected { background: #ddd6fe; color: #4c1d95; }
    pre { background: #fafafa; border: 1px solid #e5e5e7; border-radius: 4px; padding: 12px; overflow-x: auto; font: 11px/1.5 ui-monospace, monospace; max-height: 500px; }
    pre.diff { font-size: 11px; }
    pre.raw { max-height: 360px; }
    details { margin: 8px 0; padding: 0 4px; }
    summary { cursor: pointer; padding: 6px 0; font-weight: 500; }
    summary:hover { color: #2563eb; }
    .muted { color: #888; font-weight: normal; }
    .rationale { padding: 6px 12px; background: #f0f7ff; border-left: 2px solid #2563eb; margin: 6px 0; border-radius: 3px; }
    .cluster { padding: 6px 8px; border: 1px solid #eee; border-radius: 4px; margin: 6px 0; background: #fafafa; }
    .cluster summary { display: flex; gap: 12px; align-items: center; }
    .cluster-id { font-weight: 600; color: #2563eb; font-family: ui-monospace, monospace; font-size: 12px; }
    .story-list { display: flex; flex-wrap: wrap; gap: 3px; padding: 6px 0; max-height: 240px; overflow-y: auto; }
    .bucket { padding: 8px 12px; border-left: 2px solid #ddd; margin: 12px 0; background: #fafafa; border-radius: 3px; }
    .error { padding: 8px 12px; background: #fee; color: #c00; border-radius: 4px; margin-top: 6px; }
    a { color: #2563eb; }
    .bar { display: inline-block; height: 10px; background: #93c5fd; border-radius: 2px; vertical-align: middle; }
    .muted.small { font-size: 11px; }
    p.muted.small em { font-style: italic; }
    .graph-container { width: 100%; height: 560px; border: 1px solid #e2e8f0; border-radius: 8px; background: linear-gradient(180deg, #fafbfc 0%, #f1f5f9 100%); margin: 8px 0; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02); }
    .graph-container.tall { height: 720px; }
    .graph-legend { display: flex; flex-wrap: wrap; gap: 10px; font-size: 11px; padding: 6px 4px 4px; }
    .graph-legend .swatch { display: inline-block; width: 11px; height: 11px; border-radius: 50%; vertical-align: middle; margin-right: 5px; border: 1px solid rgba(0,0,0,0.1); box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
    .graph-legend .cluster-toggle { padding: 2px 6px; border-radius: 4px; transition: background .15s; }
    .graph-legend .cluster-toggle:hover { background: #f1f5f9; }
    .graph-legend .cluster-toggle.active { background: #e2e8f0; font-weight: 600; }
    .graph-controls { display: flex; gap: 8px; padding: 6px 0; flex-wrap: wrap; align-items: center; }
    .graph-controls button { font: 500 11px/1 -apple-system, sans-serif; padding: 5px 11px; border: 1px solid #cbd5e1; background: #fff; border-radius: 4px; cursor: pointer; color: #1e293b; transition: all .15s; }
    .graph-controls button:hover { background: #f1f5f9; border-color: #94a3b8; }
    .graph-controls .label { font-size: 11px; color: #64748b; }
    .layout-toggle { display: inline-flex; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; }
    .layout-toggle button { border: none; border-radius: 0; border-right: 1px solid #cbd5e1; }
    .layout-toggle button:last-child { border-right: none; }
    .layout-toggle button.active { background: #1e293b; color: #fff; }
    .layout-toggle button.active:hover { background: #0f172a; }
    .graph-detail-panel { margin-top: 8px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; display: none; }
    .run-wrapper { margin: 8px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #fff; }
    .run-wrapper > .run-summary { padding: 10px 14px; cursor: pointer; background: #f8fafc; display: flex; gap: 14px; align-items: center; justify-content: space-between; border-bottom: 1px solid transparent; flex-wrap: wrap; }
    .run-wrapper[open] > .run-summary { border-bottom-color: #e2e8f0; }
    .run-wrapper > .run-summary:hover { background: #f1f5f9; }
    .run-summary-title { font-size: 13px; font-weight: 600; color: #0f172a; }
    .run-summary-meta { font-size: 11px; color: #64748b; }
    .run-summary-meta strong { color: #0f172a; font-weight: 600; }
    .run-wrapper .card.run { box-shadow: none; margin: 0; border-left: none; border-radius: 0; padding: 14px 18px; }
    .run-wrapper .card.run header { margin-bottom: 8px; }
    /* TOC */
    .toc { background: #fff; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; box-shadow: 0 1px 2px rgba(0,0,0,.05); font-size: 12px; }
    .toc h4 { font-size: 11px; text-transform: uppercase; color: #64748b; margin: 0 0 6px; letter-spacing: .05em; }
    .toc-list { display: flex; flex-wrap: wrap; gap: 12px; }
    .toc-list a { color: #2563eb; text-decoration: none; font-weight: 500; padding: 4px 10px; background: #eff6ff; border-radius: 4px; }
    .toc-list a:hover { background: #dbeafe; }
    /* Agent transcript */
    .transcript-block { margin-top: 10px; }
    .transcript-list { list-style: none; padding: 0; margin: 8px 0 0; display: flex; flex-direction: column; gap: 6px; }
    .transcript-entry { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border-radius: 6px; font-size: 12px; }
    .transcript-entry.sys { background: #f8fafc; }
    .transcript-entry.assistant { background: #eef2ff; }
    .transcript-entry.user { background: #f0fdf4; }
    .transcript-entry.result { background: #fdf4ff; }
    .transcript-entry.rate-limit { background: #fef9c3; }
    .transcript-entry.other { background: #f1f5f9; }
    .transcript-time { font-family: ui-monospace, SFMono-Regular, monospace; color: #64748b; margin-right: 6px; }
    .transcript-entry .block { background: #fff; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 8px; }
    .transcript-entry .block.thinking { background: #fffbeb; border-color: #fde68a; }
    .transcript-entry .block.tool-use { background: #f0f9ff; border-color: #bae6fd; }
    .transcript-entry .block.tool-result { background: #f0fdf4; border-color: #bbf7d0; }
    .transcript-entry .block.tool-result.err { background: #fef2f2; border-color: #fecaca; }
    .transcript-entry .block-label { display: inline-block; font-size: 10px; text-transform: uppercase; color: #64748b; letter-spacing: .04em; margin-right: 6px; }
    .transcript-entry .block pre { margin: 4px 0 0; font-size: 11px; line-height: 1.45; max-height: 320px; overflow: auto; white-space: pre-wrap; word-break: break-word; }
  </style>
</head>`;
}

async function main() {
  const argv = process.argv.slice(2);
  let outFile = 'report.html';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') outFile = argv[++i];
  }

  const runs = await loadAllRuns();
  const cssBlast = await loadCssBlast();
  const moduleGraph = await loadModuleGraph();
  const detBaselines = await loadDeterministicBaselines();
  const replayRows = await loadReplayRows();
  const tiedDistance = await loadJsonReport<TiedDistanceReport>('tied-distance.json');
  const barrelShare = await loadJsonReport<BarrelShareReport>('barrel-share.json');
  const failureModes = await loadJsonReport<FailureModesReport>('failure-modes.json');
  const rationaleFidelity = await loadJsonReport<RationaleFidelityReport>('rationale-fidelity.json');

  const overview = renderOverview(runs);
  const variance = renderVariance(runs);
  const promptCompare = renderPromptCompare(runs);
  const cssSection = renderCssBlast(cssBlast);
  const moduleGraphSection = renderModuleGraph(moduleGraph);
  const detSection = renderDeterministicBaselines(detBaselines);
  const replaySection = renderReplaySection(replayRows, moduleGraph?.forwardEdges);
  const backlogSection = renderBacklogExperiments(tiedDistance, barrelShare, failureModes, rationaleFidelity);

  // Group runs by scenario for the detail section.
  const byScenario = new Map<string, RunRow[]>();
  for (const r of runs) {
    if (!byScenario.has(r.scenario)) byScenario.set(r.scenario, []);
    byScenario.get(r.scenario)!.push(r);
  }
  const detailHtml = [...byScenario.entries()]
    .sort(([, a], [, b]) => (a[0]?.groundTruth?.total ?? 0) - (b[0]?.groundTruth?.total ?? 0))
    .map(
      ([name, rs]) => `<section class="card scenario-section" id="scenario-${escapeHtml(name)}">
        <h2>${escapeHtml(name)} <span class="muted">(${rs.length} runs)</span></h2>
        <p class="muted">${escapeHtml(rs[0]?.description ?? '')}</p>
        ${(() => {
          // Expand by default the FIRST RUN WITH AGENT DATA — chronological
          // order would often expand a stale baseline-only run, which
          // shows just empty KPIs.
          const firstUsefulIdx = rs.findIndex(
            (r) => r.agentRun && r.agentRun.clusterCount > 0 && r.payload.storyToFile
          );
          const expandIdx = firstUsefulIdx === -1
            ? rs.findIndex((r) => r.agentRun && r.agentRun.clusterCount > 0)
            : firstUsefulIdx;
          return rs
            .map((r, i) =>
              renderRunDetail(r, runs.indexOf(r) + 1, moduleGraph?.forwardEdges, i === expandIdx)
            )
            .join('');
        })()}
      </section>`
    )
    .join('');

  const html = `<!doctype html>
<html lang="en">
${renderHead()}
<body>
  <nav>
    <h1>Inner-loop agent eval</h1>
    <a href="#overview">Overview</a>
    <a href="#prompt-compare">Prompt compare</a>
    <a href="#variance">Variance</a>
    <a href="#determ">Determ baselines</a>
    <a href="#replay">Real commits</a>
    <a href="#backlog">Backlog</a>
    <a href="#module-graph">Module graph</a>
    <a href="#css-blast">CSS blast</a>
    <a href="#detail">Run detail</a>
    <span class="muted" style="margin-left:auto;font-size:11px;">${new Date().toLocaleString()}</span>
  </nav>
  <main>
    <div id="overview">${overview}</div>
    <div id="prompt-compare">${promptCompare}</div>
    <div id="variance">${variance}</div>
    <div id="determ">${detSection}</div>
    <div id="replay">${replaySection}</div>
    ${backlogSection}
    <div id="module-graph">${moduleGraphSection}</div>
    <div id="css-blast">${cssSection}</div>
    <div id="detail">
      <h2>Run detail</h2>
      ${detailHtml}
    </div>
  </main>
</body>
</html>`;

  const outPath = outFile.startsWith('/') ? outFile : join(RESULTS_DIR, outFile);
  await writeFile(outPath, html);
  console.log(`Wrote: ${outPath}`);
  console.log(`Runs included: ${runs.length}`);
  console.log(`CSS blast section: ${cssBlast ? 'yes' : 'no'}`);
}

await main();
