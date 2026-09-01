// results:compare — compares a control case against treatment cases over
// recorded run artifacts and produces estimates, FDR verdicts, and curves.
// Orchestration only: resolution/gating/emission logic lives in
// lib/agentic-reference/comparison/, statistics in scripts/compare_stats.py.
// --plan scopes the comparison to one collection plan's cases and workflows.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AGENTIC_REF_EVAL_REGISTRY,
  DEFAULT_CONTROL_CASE,
  knownExperimentNames,
} from '#lib/agentic-reference/cases';
import { COMPARISON_METRICS } from '#lib/agentic-reference/comparison-metrics';
import { autoSelectWorkflows, buildCells } from '#lib/agentic-reference/comparison/cells';
import {
  cellStatuses,
  formatCellTable,
  remediationCommands,
} from '#lib/agentic-reference/comparison/commands';
import {
  datasetCsv,
  manifestJson,
  type ComparisonSpec,
} from '#lib/agentic-reference/comparison/emit';
import { writeHtmlReport, type EstimateRow } from '#lib/agentic-reference/comparison/html-report';
import {
  collectMisusePanel,
  collectMisuseStatuses,
  formatMisuseStatusTable,
} from '#lib/agentic-reference/comparison/misuse';
import { parseCompareArgs } from '#lib/agentic-reference/comparison/options';
import {
  comparisonSlug,
  knownWorkflows,
  resolveCase,
  resolvePlanScope,
  resolveTreatments,
  resolveWorkflows,
  type ResolvedCase,
} from '#lib/agentic-reference/comparison/resolve';
import { ansiStyle } from '#lib/agentic-reference/style';
import { findUv } from '#lib/agentic-reference/comparison/uv';
import { tallyVerdicts } from '#lib/agentic-reference/comparison/verdict-tally';
import { resolvePlanFlag, resolvePlanPath } from '#lib/agentic-reference/plan-config';
import { postAnalysis } from '#lib/agentic-reference/post-analysis';
import { findRuns } from '#lib/post-analysis/discovery';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RESULTS_DIR = process.env.AGENT_EVAL_RESULTS_DIR ?? join(ROOT, 'results');
const EVALS_DIR = process.env.AGENT_EVAL_EVALS_DIR ?? join(ROOT, 'evals');
const STATS_SCRIPT = join(ROOT, 'scripts', 'compare_stats.py');
const errStyle = ansiStyle(process.stderr);
const outStyle = ansiStyle(process.stdout);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function main() {
  const options = parseCompareArgs(process.argv.slice(2));
  const metricsVersion = postAnalysis.metricsVersion;
  // Runs without a project tree hold nothing to measure (see
  // lib/agentic-reference/collected-runs.ts).
  const runs = findRuns(RESULTS_DIR).filter((run) => run.collected);

  const control = resolveCase(options.control ?? DEFAULT_CONTROL_CASE);

  let plan: { treatments: ResolvedCase[]; workflows: string[]; runs: number; path: string } | null =
    null;
  const resolved = await resolvePlanFlag(
    { plan: options.plan, experiments: options.cases, evals: options.workflows },
    { experiments: knownExperimentNames(), evals: AGENTIC_REF_EVAL_REGISTRY },
    '--cases/--workflows'
  );
  if (resolved !== null) {
    const path = resolvePlanPath(options.plan!);
    const repoRelative = relative(ROOT, path);
    plan = {
      ...resolvePlanScope(resolved, control),
      runs: resolved.plan.runs,
      path: repoRelative.startsWith('..') ? path : repoRelative,
    };
  }
  // The plan's target sample size is the gate it was collected for.
  const minRuns = options.minRuns ?? plan?.runs ?? 10;

  let treatments: ResolvedCase[];
  if (plan !== null) {
    treatments = plan.treatments;
  } else {
    const experimentsWithData = [...new Set(runs.map((run) => run.experiment))];
    treatments = resolveTreatments(options.cases, control, experimentsWithData);
  }
  if (treatments.length === 0) {
    fail(
      'No treatment cases with recorded data. Collect runs first: yarn workspace agent-eval run eval:agentic-ref'
    );
  }
  const cases = [control, ...treatments];

  let workflows: string[];
  if (plan !== null) {
    workflows = plan.workflows;
  } else {
    const known = knownWorkflows(EVALS_DIR);
    const explicit = resolveWorkflows(options.workflows, known);
    if (explicit === null) {
      const candidates = [...new Set(runs.map((run) => run.evalName))]
        .filter((name) => /^7\d\d-/.test(name))
        .sort();
      const auto = autoSelectWorkflows({ runs, cases, candidates, minRuns, metricsVersion });
      if (auto.skipped.length > 0) {
        console.log(outStyle.bold('Skipping the following workflows:'));
        for (const { workflow } of auto.skipped) console.log(`  ${workflow}`);
      }
      if (auto.selected.length === 0) {
        const gaps = auto.skipped.flatMap((s) => s.gaps);
        console.error(`${errStyle.bold('No workflow has enough data for every selected case.')}\n`);
        console.error(formatCellTable(gaps, errStyle));
        console.error(`\n${errStyle.bold('Collect the missing data:')}\n`);
        for (const command of remediationCommands(gaps)) console.error(`  ${command}`);
        process.exit(1);
      }
      workflows = auto.selected;
      console.log(`${outStyle.bold('Auto-selected workflows:')} ${workflows.join(', ')}`);
    } else {
      workflows = explicit;
    }
  }

  const { cells, gaps } = buildCells({ runs, cases, workflows, minRuns, metricsVersion });
  if (gaps.length > 0) {
    console.error(`${errStyle.bold('Comparison impossible: insufficient usable data.')}\n`);
    console.error(formatCellTable(cellStatuses(cells, gaps, minRuns), errStyle));
    console.error(`\n${errStyle.bold('Collect the missing data, then re-run this command:')}\n`);
    for (const command of remediationCommands(gaps)) console.error(`  ${command}`);
    process.exit(1);
  }

  const spec: ComparisonSpec = {
    control,
    treatments,
    workflows,
    mode: workflows.length > 1 ? 'aggregate' : 'single-workflow',
    minRuns,
    ...(plan === null ? {} : { plan: plan.path }),
  };
  console.log(
    `\nComparing ${outStyle.caseName(control.shortName)} vs ${treatments
      .map((t) => outStyle.caseName(t.shortName))
      .join(' + ')} — ${workflows.join(', ')} (${spec.mode}, ${minRuns}+ runs/cell)`
  );
  const outDir = resolve(
    options.out ?? join(ROOT, 'comparisons', comparisonSlug(control, treatments, workflows))
  );
  const stagingDir = `${outDir}.staging`;
  rmSync(stagingDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });

  let gitSha: string | null = null;
  try {
    gitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim();
  } catch {
    // Not fatal: provenance only.
  }
  writeFileSync(join(stagingDir, 'dataset.csv'), datasetCsv(cells, COMPARISON_METRICS, spec));
  // Cached judge artifacts only — free, and simply sparse when judging hasn't run.
  const misusePanel = collectMisusePanel(cells, spec, { repoRoot: resolve(ROOT, '..') });
  writeFileSync(join(stagingDir, 'misuse.json'), JSON.stringify(misusePanel, null, 2) + '\n');
  if (misusePanel.judgedRuns === misusePanel.usableRuns) {
    console.log(`DS misuse: all ${misusePanel.usableRuns} usable runs judged.`);
  } else {
    console.log(outStyle.bold('DS misuse judge status:'));
    console.log(formatMisuseStatusTable(collectMisuseStatuses(cells, spec), outStyle));
    if (misusePanel.judgedRuns === 0) console.log('The misuse metrics will be empty.');
    console.log(
      `Judge the rest: yarn workspace agent-eval run judge:ds-misuse${plan === null ? '' : ` --plan ${plan.path}`}`
    );
  }
  console.log('');
  writeFileSync(
    join(stagingDir, 'manifest.json'),
    manifestJson({
      spec,
      metrics: COMPARISON_METRICS,
      cells,
      agentEvalRoot: ROOT,
      provenance: {
        generatedAt: new Date().toISOString(),
        gitSha,
        metricsVersion: metricsVersion ?? null,
      },
    })
  );

  const uv = findUv();
  if (uv === null) {
    console.error(`Dataset and manifest written to ${stagingDir}.`);
    console.error('uv is missing, so the statistics stage cannot run here.');
    console.error('Run `yarn workspace agent-eval run results:compare:setup`, or elsewhere:');
    console.error(`  uv run --frozen scripts/compare_stats.py ${stagingDir}`);
    process.exit(1);
  }
  try {
    execFileSync(uv, ['run', '--frozen', STATS_SCRIPT, stagingDir], {
      stdio: 'inherit',
      cwd: ROOT,
    });
  } catch {
    fail(
      `Statistics stage failed; staging kept at ${stagingDir}. Previous outputs (if any) at ${outDir} are untouched.`
    );
  }

  writeHtmlReport(stagingDir);
  printVerdictDigest(stagingDir);

  rmSync(outDir, { recursive: true, force: true });
  renameSync(stagingDir, outDir);
  console.log(`\nComparison written to ${outDir}`);
  // file:// spellings so a terminal renders them as clickable links.
  console.log(`Report: file://${join(outDir, 'report.md')}`);
  console.log(`HTML report: ${outStyle.bold(`file://${join(outDir, 'report.html')}`)}`);
}

/**
 * Quick preview of the HTML summary's better/worse tally so the
 * terminal says whether the report is worth opening.
 */
function printVerdictDigest(stagingDir: string): void {
  let rows: EstimateRow[];
  try {
    rows = JSON.parse(readFileSync(join(stagingDir, 'estimates.json'), 'utf8'));
  } catch {
    return;
  }
  const metricLabel = new Map(COMPARISON_METRICS.map((m) => [m.key, m.label]));
  for (const treatment of new Set(rows.map((row) => row.treatment))) {
    const treatmentRows = rows.filter((row) => row.treatment === treatment && !row.context);
    const { better, worse } = tallyVerdicts(treatmentRows, (row) => row.verdict === 'significant');
    const name = (row: { metric: string }) => metricLabel.get(row.metric) ?? row.metric;
    const parts = [
      better.length > 0
        ? outStyle.tone('good', `${better.length} better`) +
          outStyle.dim(` (${better.map(name).join(', ')})`)
        : '',
      worse.length > 0
        ? outStyle.tone('action', `${worse.length} worse`) +
          outStyle.dim(` (${worse.map(name).join(', ')})`)
        : '',
    ].filter(Boolean);
    console.log(
      `  ${outStyle.caseName(treatment.padEnd(16))} ${
        parts.length > 0 ? parts.join(' · ') : outStyle.dim('no significant movement')
      }`
    );
  }
}

main().catch((error) => {
  console.error(messageOf(error));
  process.exit(1);
});
