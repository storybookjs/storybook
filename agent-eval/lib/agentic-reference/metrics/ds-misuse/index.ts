// The ds-misuse metric: how well a run used the design system.
//
// ds-coverage answers how *much* of a run's UI came from the design system.
// This answers whether the agent chose well — right component, used the way the
// guidelines say, and local only where nothing in the system fit.
//
// It is the one metric in this tree that is not a pure function of stored
// artifacts: it calls a model, so it lives behind its own CLI rather than in
// post-analysis, and its result is cached on disk as ds-misuse.json.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { readJson } from '../../../utils/files.ts';
import { isRecord } from '../../../utils/type.ts';

import type { JudgeUsage } from './judge.ts';
import { analyzeDsCoverage } from '../ds-coverage/index.ts';
import { buildJudgeRequest, DS_MISUSE_JUDGE_VERSION, JUDGE_MODEL } from './context.ts';
import { collectDsDocs, dsDocsRefLabel } from './ds-docs.ts';
import { runJudge } from './judge.ts';
import { summariseJudgement } from './score.ts';
import { treePatch } from './tree-patch.ts';

import type { NodeRecord } from '../ds-coverage/types.ts';
import type { DsMisuseReport } from './types.ts';

export const DS_MISUSE_FILENAME = 'ds-misuse.json';

export interface JudgeRunInput {
  /** The run directory; the artifact lands here. */
  runDir: string;
  /** The collected post-run tree. */
  projectDir: string;
  /** The materialized pinned tree the run started from. */
  baselineDir: string;
  /** Whole-tree node census of the pinned tree, from the census file. */
  baselineNodes: NodeRecord[];
  /** DS package patterns for this pin. */
  dsPackages: string[];
  /** `repo@ref` of the pin, recorded in the artifact. */
  fixtureRef: string;
  metricsVersion: number | undefined;
  /** Where prepareRef caches trees. */
  refCacheDir: string;
}

export interface StalenessCheck {
  dsGuidelinesRef: string;
}

function isScoredAnswer(value: unknown): boolean {
  return isRecord(value) && typeof value.score === 'number' && Array.isArray(value.reasons);
}

/**
 * True when the parsed JSON has the shape a reader downstream (isStale,
 * misuseValues) can walk without crashing: a numeric judgeVersion stamp is
 * present, nodes is an array of records, each present per-kind answer is a
 * scored object, and summary is a record. This is not a full schema check —
 * it only guards the fields those readers touch. The judgeVersion check also
 * keeps a v1 artifact (single `reason` string, no stamp) from reaching
 * isStale with a shape it cannot walk.
 */
function isWellFormedReport(value: unknown): value is DsMisuseReport {
  if (!isRecord(value) || typeof value.judgeVersion !== 'number') return false;
  if (!Array.isArray(value.nodes) || !isRecord(value.summary)) return false;
  return value.nodes.every((node) => {
    if (!isRecord(node)) return false;
    for (const key of ['correctDsDecision', 'correctDsUsage', 'correctLocalDecision']) {
      if (node[key] !== undefined && !isScoredAnswer(node[key])) return false;
    }
    return true;
  });
}

/** A malformed artifact is treated exactly like an unjudged run: null, never a throw. */
export function readMisuseReport(runDir: string): DsMisuseReport | null {
  const parsed = readJson<unknown>(join(runDir, DS_MISUSE_FILENAME));
  return isWellFormedReport(parsed) ? parsed : null;
}

/**
 * Whether a judge artifact exists at all, readable or not. Callers pairing
 * this with readMisuseReport can tell a pre-versioning or malformed artifact
 * (present, unusable — the paid judge did run once) from a run the judge
 * never saw, which read identically as null for months.
 */
export function hasMisuseArtifact(runDir: string): boolean {
  return existsSync(join(runDir, DS_MISUSE_FILENAME));
}

export function writeMisuseReport(runDir: string, report: DsMisuseReport): void {
  writeFileSync(join(runDir, DS_MISUSE_FILENAME), JSON.stringify(report, null, 2) + '\n');
}

/**
 * Whether a stored judgement can still be trusted.
 *
 * A moved guidelines pin means the run was scored against a different standard;
 * a moved judge version means the prompt, reference content, model, or judging
 * internals changed under it; a moved model is checked directly too, as a
 * safety net for a model swap that missed a version bump — an LLM judge is its
 * model, and two models' scores in one table are two standards. The
 * deterministic metricsVersion plays no part here: it records which census
 * rules built the node paths, not whether the judgement is still valid, so a
 * metrics-only recompute must not spend the paid judge again.
 */
export function isStale(report: DsMisuseReport, current: StalenessCheck): boolean {
  return (
    report.judgeVersion !== DS_MISUSE_JUDGE_VERSION ||
    report.dsGuidelinesRef !== current.dsGuidelinesRef ||
    report.model !== JUDGE_MODEL
  );
}

/** Judge one run and return its report. Makes exactly one model call. */
export async function judgeRun(
  input: JudgeRunInput
): Promise<{ report: DsMisuseReport; usage: JudgeUsage }> {
  const patch = treePatch(input.baselineDir, input.projectDir);

  // Targeted: the graph is still whole so imports resolve, but only the files
  // the run touched are counted — a new JSX node can appear nowhere else.
  // The judge works on the unweighted node census: one record per source
  // element, in its static identity. Instance weighting never reaches it.
  const treatment = analyzeDsCoverage({
    projectDir: input.projectDir,
    dsPackages: input.dsPackages,
    includeNodes: true,
    censusInclude: patch.files,
  });

  // The before-census is evidence for move-matching only: a real move shows
  // its origin in the diff, so a file the diff never touches has nothing to
  // contribute — feeding it in anyway lets a copied block match a before row
  // it was never actually moved from, and Step 1 waves the copy through as
  // unjudged "moved" code.
  const beforeScope = new Set(patch.beforePaths);
  const { judged, usage } = await runJudge(
    buildJudgeRequest({
      docs: collectDsDocs(input.refCacheDir),
      baselineNodes: input.baselineNodes.filter((node) => beforeScope.has(node.file)),
      treatmentNodes: treatment.nodeList ?? [],
      patch,
      fixtureRef: input.fixtureRef,
    })
  );

  const report: DsMisuseReport = {
    metricsVersion: input.metricsVersion,
    judgeVersion: DS_MISUSE_JUDGE_VERSION,
    judgedAt: new Date().toISOString(),
    model: JUDGE_MODEL,
    dsGuidelinesRef: dsDocsRefLabel(),
    fixtureRef: input.fixtureRef,
    diffTruncated: patch.truncated,
    summary: summariseJudgement(judged.nodes),
    // The buckets travel with the scores: the judge chose them, so a surprising
    // number has to be traceable to what it actually counted.
    nodes: judged.nodes,
  };
  return { report, usage };
}
