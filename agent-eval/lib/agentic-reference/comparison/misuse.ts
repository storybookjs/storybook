// Pooling per-run ds-misuse judgements into one panel for the report.
//
// The judge writes one ds-misuse.json per run (see ../metrics/ds-misuse), and
// nothing in the comparison pipeline reads it: the tables carry the means and
// the reasons stay on disk. This module inverts that — the reasons are the
// data, so the panel carries every judged answer verbatim, perfect scores
// included, so charts get true denominators; below-perfect answers
// additionally carry a source excerpt. The summary keeps whole distributions
// rather than collapsing to a mean a reader cannot interrogate.
//
// Judging is a separate, paid step, so partial coverage is the normal state of
// a bundle, not an error: the panel reports judged-vs-usable per cell and the
// report renders what exists.
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { MISUSE_FACETS, UNCATEGORISED } from '../facets.ts';

import { formatStatusTable } from './commands.ts';
import { dsDocsRefLabel } from '../metrics/ds-misuse/ds-docs.ts';
import { hasMisuseArtifact, isStale, readMisuseReport } from '../metrics/ds-misuse/index.ts';
import { PLAIN_STYLE } from '../style.ts';

import type { Cell } from './cells.ts';
import type { ComparisonSpec } from './emit.ts';
import type {
  JudgedNode,
  JudgeReason,
  JudgeScore,
  ScoredAnswer,
} from '../metrics/ds-misuse/types.ts';
import type { OutputStyle, Tone } from '../style.ts';

export const MISUSE_QUESTIONS = [
  'correctDsDecision',
  'correctDsUsage',
  'correctLocalDecision',
] as const;
export type MisuseQuestion = (typeof MISUSE_QUESTIONS)[number];

/** How many nodes landed on each of the three allowed scores. */
export interface ScoreDistribution {
  ones: number;
  halves: number;
  zeros: number;
}

export interface MisuseCellSummary {
  case: string;
  workflow: string;
  /** Runs the comparison counts for this cell. */
  usable: number;
  /** Of those, runs carrying a current ds-misuse.json. */
  judged: number;
  /** Runs with a missing or outdated version, or unreadable artifacts. */
  stale: number;
  /** Pooled over every judged run's nodes; null when no node got the question. */
  questions: Record<MisuseQuestion, ScoreDistribution | null>;
  evaluated: { ds: number; local: number };
  /**
   * Per-facet score distributions, keyed by qualified facet id plus
   * 'uncategorised'. An answer citing two facets counts once in each; an
   * answer with any facet-less reason also counts in 'uncategorised'.
   */
  facetTallies: Record<string, ScoreDistribution>;
}

/** One scored answer, kept whole — perfect scores included, so charts get true denominators. */
export interface MisuseDecision {
  case: string;
  workflow: string;
  /** `<batch>/run-<n>`, matching how the CLI names runs. */
  runLabel: string;
  file: string;
  line: number;
  tag: string;
  kind: 'ds' | 'local';
  question: MisuseQuestion;
  score: JudgeScore;
  reasons: JudgeReason[];
  /** The run's collected tree, relative to the repo root, posix-separated. */
  projectPath: string;
  /**
   * Whether the flagged file exists in the cached baseline tree; undefined
   * when the cache is not materialized, so absence of the cache never reads
   * as "the run created this file".
   */
  inBaseline?: boolean;
  /** Only read for below-perfect scores; a clean usage needs no source context. */
  excerpt?: { start: number; lines: string[] };
}

const EXCERPT_CONTEXT = 3;

/**
 * A few lines of the flagged source, so a decision can be read without opening
 * the run's tree. Free and retroactive: this reads the collected project on
 * disk, never the model, so it works for every judgement ever cached.
 */
function excerptOf(
  projectDir: string,
  file: string,
  line: number,
  cache: Map<string, string[] | null>
): MisuseDecision['excerpt'] {
  let lines = cache.get(file);
  if (lines === undefined) {
    try {
      lines = readFileSync(join(projectDir, file), 'utf8').split('\n');
    } catch {
      lines = null;
    }
    cache.set(file, lines);
  }
  if (lines === null || line < 1 || line > lines.length) return undefined;
  const start = Math.max(1, line - EXCERPT_CONTEXT);
  return { start, lines: lines.slice(start - 1, Math.min(lines.length, line + EXCERPT_CONTEXT)) };
}

export interface MisusePanel {
  /** Distinct guideline pins seen across artifacts; more than one taints comparison. */
  guidelinesRefs: string[];
  /** Distinct fixture pins, for reconstructing baselines in the help text. */
  fixtureRefs: string[];
  /**
   * The repo root on the machine that built this bundle. A hint, not a fact:
   * the report offers it as the default and lets a reader on another machine
   * override it, since paths in decisions are repo-relative on purpose.
   */
  builtFrom: string;
  judgedRuns: number;
  /** Runs whose judge artifact exists but could not be read; see MisuseCellSummary.stale. */
  staleRuns: number;
  usableRuns: number;
  cells: MisuseCellSummary[];
  decisions: MisuseDecision[];
  /** The facet catalogue this panel's judgements were categorised against. */
  facets: readonly { id: string; description: string }[];
}

/** A cell's case as the report shows it: the spec's shortName, not the raw case registry one. */
function caseShortName(cell: Cell, spec: ComparisonSpec): string {
  return cell.case.caseName === spec.control.caseName
    ? spec.control.shortName
    : (spec.treatments.find((t) => t.caseName === cell.case.caseName)?.shortName ??
        cell.case.shortName);
}

function emptyDistribution(): ScoreDistribution {
  return { ones: 0, halves: 0, zeros: 0 };
}

function tally(distribution: ScoreDistribution, score: number): void {
  if (score === 1) distribution.ones += 1;
  else if (score === 0.5) distribution.halves += 1;
  else distribution.zeros += 1;
}

/** Every distinct facet an answer's reasons cite; a facet-less reason counts as uncategorised. */
function facetsOf(reasons: JudgeReason[]): string[] {
  const cited = new Set<string>();
  for (const reason of reasons) cited.add(reason.facet ?? UNCATEGORISED);
  return [...cited];
}

function poolNode(
  node: JudgedNode,
  summary: MisuseCellSummary,
  push: (question: MisuseQuestion, answer: ScoredAnswer) => void
): void {
  for (const question of MISUSE_QUESTIONS) {
    const answer = node[question];
    if (answer === undefined) continue;
    summary.questions[question] ??= emptyDistribution();
    tally(summary.questions[question], answer.score);
    for (const facet of facetsOf(answer.reasons)) {
      summary.facetTallies[facet] ??= emptyDistribution();
      tally(summary.facetTallies[facet], answer.score);
    }
    push(question, answer);
  }
}

/**
 * Read every usable run's cached judgement and pool it per cell.
 *
 * Reads artifacts only — never the API — so it is free to run on every
 * comparison, judged or not. Cells keep the spec's own ordering upstream;
 * decisions sort worst-first within a cell so the report needs no re-sort.
 */
export function collectMisusePanel(
  cells: Cell[],
  spec: ComparisonSpec,
  options: { repoRoot: string }
): MisusePanel {
  const refs = new Set<string>();
  const fixtures = new Set<string>();
  const toPosix = (value: string) => value.split(sep).join('/');
  const refsRoot = join(options.repoRoot, 'agent-eval', '.eval-cache', 'refs');
  const baselineDirOf = (fixtureRef: string) => {
    const at = fixtureRef.lastIndexOf('@');
    if (at === -1) return null;
    const repo = fixtureRef.slice(0, at).replace('/', '__');
    return `${repo}@${fixtureRef.slice(at + 1).replace(/\//g, '__')}`;
  };
  const summaries: MisuseCellSummary[] = [];
  const decisions: MisuseDecision[] = [];
  let judgedRuns = 0;
  let staleRuns = 0;
  let usableRuns = 0;

  for (const cell of cells) {
    const shortName = caseShortName(cell, spec);

    const summary: MisuseCellSummary = {
      case: shortName,
      workflow: cell.workflow,
      usable: cell.runs.length,
      judged: 0,
      stale: 0,
      questions: {
        correctDsDecision: null,
        correctDsUsage: null,
        correctLocalDecision: null,
      },
      evaluated: { ds: 0, local: 0 },
      facetTallies: {},
    };
    usableRuns += cell.runs.length;

    const cellDecisions: MisuseDecision[] = [];
    for (const usable of cell.runs) {
      const report = readMisuseReport(usable.run.runDir);
      if (report === null) {
        if (hasMisuseArtifact(usable.run.runDir)) {
          summary.stale += 1;
          staleRuns += 1;
        }
        continue;
      }
      summary.judged += 1;
      judgedRuns += 1;
      refs.add(report.dsGuidelinesRef);
      fixtures.add(report.fixtureRef);
      summary.evaluated.ds += report.summary.evaluated.ds;
      summary.evaluated.local += report.summary.evaluated.local;

      const runLabel = `${usable.run.timestamp}/run-${usable.run.run}`;
      const excerpts = new Map<string, string[] | null>();
      const baselineName = baselineDirOf(report.fixtureRef);
      const baselineRoot =
        baselineName !== null && existsSync(join(refsRoot, baselineName))
          ? join(refsRoot, baselineName)
          : null;
      for (const node of report.nodes) {
        poolNode(node, summary, (question, answer) => {
          cellDecisions.push({
            case: shortName,
            workflow: cell.workflow,
            runLabel,
            file: node.file,
            line: node.line,
            tag: node.tag,
            kind: node.kind,
            question,
            score: answer.score,
            reasons: answer.reasons,
            projectPath: toPosix(relative(options.repoRoot, usable.run.projectDir)),
            ...(baselineRoot === null
              ? {}
              : { inBaseline: existsSync(join(baselineRoot, node.file)) }),
            ...(answer.score === 1
              ? {}
              : { excerpt: excerptOf(usable.run.projectDir, node.file, node.line, excerpts) }),
          });
        });
      }
    }

    cellDecisions.sort((a, b) => a.score - b.score || a.file.localeCompare(b.file));
    decisions.push(...cellDecisions);
    summaries.push(summary);
  }

  return {
    guidelinesRefs: [...refs].sort(),
    fixtureRefs: [...fixtures].sort(),
    builtFrom: toPosix(options.repoRoot),
    judgedRuns,
    staleRuns,
    usableRuns,
    cells: summaries,
    decisions,
    facets: MISUSE_FACETS.map(({ id, description }) => ({ id, description })),
  };
}

/** A cell's judge coverage, boiled down to one status word for the table. */
export type MisuseJudgeStatus = 'complete' | 'partial' | 'unjudged' | 'stale';

export interface MisuseCellStatus {
  case: string;
  workflow: string;
  usable: number;
  judged: number;
  /** Runs with a ds-misuse.json file but that are stale or unreadable. */
  stale: number;
  status: MisuseJudgeStatus;
  label: string;
}

const JUDGE_STATUS_TONE: Record<MisuseJudgeStatus, Tone> = {
  complete: 'good',
  partial: 'caution',
  unjudged: 'action',
  stale: 'action',
};

function judgeStatusOf(
  usable: number,
  judged: number,
  stale: number
): { status: MisuseJudgeStatus; label: string } {
  if (judged === usable) return { status: 'complete', label: 'complete' };
  if (stale > 0) return { status: 'stale', label: `stale (${stale} stale)` };
  if (judged === 0) return { status: 'unjudged', label: 'unjudged' };
  return { status: 'partial', label: `partial (${judged}/${usable} judged)` };
}

/**
 * Per-cell judge coverage: judged against the current guideline pin, stale
 * (a ds-misuse.json present but disqualified — see isStale), or never
 * judged. Unlike collectMisusePanel, which pools every report it finds
 * regardless of standard, this checks each report against the current pin,
 * because the status table's job is telling the reader what still needs
 * `yarn workspace agent-eval run judge:ds-misuse`.
 */
export function collectMisuseStatuses(cells: Cell[], spec: ComparisonSpec): MisuseCellStatus[] {
  const current = { dsGuidelinesRef: dsDocsRefLabel() };
  return cells.map((cell) => {
    let judged = 0;
    let stale = 0;
    for (const usable of cell.runs) {
      const report = readMisuseReport(usable.run.runDir);
      if (report === null) {
        // An artifact that exists but cannot be read was judged once, under
        // a standard readMisuseReport no longer accepts. Filed under stale,
        // or it reads as never-judged — which hid 80 paid judgements.
        if (hasMisuseArtifact(usable.run.runDir)) stale += 1;
        continue;
      }
      if (isStale(report, current)) stale += 1;
      else judged += 1;
    }
    const usable = cell.runs.length;
    return {
      case: caseShortName(cell, spec),
      workflow: cell.workflow,
      usable,
      judged,
      stale,
      ...judgeStatusOf(usable, judged, stale),
    };
  });
}

export function formatMisuseStatusTable(
  statuses: readonly MisuseCellStatus[],
  style: OutputStyle = PLAIN_STYLE
): string {
  return formatStatusTable(
    ['case', 'workflow', 'judged', 'status'],
    statuses.map((status) => [
      status.case,
      status.workflow,
      `${status.judged}/${status.usable}`,
      status.label,
    ]),
    (rowIndex, col, cell) => {
      if (col === 0) return style.caseName(cell);
      if (col === 3) return style.tone(JUDGE_STATUS_TONE[statuses[rowIndex]!.status], cell);
      return cell;
    },
    style
  );
}
