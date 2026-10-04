import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { collectMisusePanel, collectMisuseStatuses, formatMisuseStatusTable } from './misuse.ts';
import { dsDocsRefLabel } from '../metrics/ds-misuse/ds-docs.ts';
import { DS_MISUSE_JUDGE_VERSION, JUDGE_MODEL } from '../metrics/ds-misuse/context.ts';
import { PLAIN_STYLE } from '../style.ts';
import type { OutputStyle } from '../style.ts';

import type { Run } from '../../post-analysis/discovery.ts';
import type { Cell } from './cells.ts';
import type { ComparisonSpec } from './emit.ts';
import type { ResolvedCase } from './resolve.ts';
import type { DsMisuseReport, JudgedNode } from '../metrics/ds-misuse/types.ts';

/** Distinct, greppable markers (not ANSI) so alignment assertions are deterministic. */
const MARKER_STYLE: OutputStyle = {
  bold: (s) => `[B]${s}[/B]`,
  caseName: (s) => `[C]${s}[/C]`,
  tone: (t, s) => `[T:${t}]${s}[/T]`,
  dim: (s) => `[D]${s}[/D]`,
  reason: (r, s) => `[R:${r}]${s}[/R]`,
};

const CONTROL: ResolvedCase = {
  caseName: 'cc-control-none-opus-high',
  experiment: 'agentic-ref-cc-control-none-opus-high',
  shortName: 'control-none',
};
const TREATMENT: ResolvedCase = {
  caseName: 'cc-docs-full-opus-high',
  experiment: 'agentic-ref-cc-docs-full-opus-high',
  shortName: 'docs-full',
};
const WF = '701-new-ui-flow';
const TS = '2026-08-01T00-00-00.000Z';

const SPEC: ComparisonSpec = {
  control: CONTROL,
  treatments: [TREATMENT],
  workflows: [WF],
  mode: 'single-workflow',
  minRuns: 1,
};

let results: string;

beforeEach(() => {
  results = mkdtempSync(join(tmpdir(), 'compare-misuse-'));
});
afterEach(() => {
  rmSync(results, { recursive: true, force: true });
});

function judgedNode(overrides: Partial<JudgedNode>): JudgedNode {
  return {
    path: 'App/Card[0]',
    file: 'src/App.tsx',
    line: 10,
    tag: 'Card',
    kind: 'ds',
    ...overrides,
  };
}

function misuseReport(
  nodes: JudgedNode[],
  dsGuidelinesRef = 'org/ds@abc',
  overrides: Partial<DsMisuseReport> = {}
): DsMisuseReport {
  const scored = (key: 'correctDsDecision' | 'correctDsUsage' | 'correctLocalDecision') =>
    nodes.flatMap((node) => (node[key] ? [node[key].score] : []));
  const meanOf = (scores: number[]) =>
    scores.length === 0 ? null : scores.reduce((a, b) => a + b, 0) / scores.length;
  return {
    metricsVersion: 1,
    judgeVersion: DS_MISUSE_JUDGE_VERSION,
    judgedAt: '2026-08-01T00:00:00.000Z',
    model: JUDGE_MODEL,
    dsGuidelinesRef,
    fixtureRef: 'org/app@ref',
    diffTruncated: false,
    summary: {
      correctDsDecision: meanOf(scored('correctDsDecision')),
      correctDsUsage: meanOf(scored('correctDsUsage')),
      correctLocalDecision: meanOf(scored('correctLocalDecision')),
      evaluated: {
        ds: nodes.filter((n) => n.kind === 'ds').length,
        local: nodes.filter((n) => n.kind === 'local').length,
      },
    },
    nodes,
    ...overrides,
  };
}

function usableRun(
  resolved: ResolvedCase,
  run: number,
  report: DsMisuseReport | null
): Cell['runs'][number] {
  const runDir = join(results, resolved.experiment, TS, WF, `run-${run}`);
  mkdirSync(runDir, { recursive: true });
  if (report !== null) {
    writeFileSync(join(runDir, 'ds-misuse.json'), JSON.stringify(report));
  }
  const runRecord: Run = {
    runDir,
    projectDir: join(runDir, 'project'),
    experiment: resolved.experiment,
    model: 'test-model',
    timestamp: TS,
    evalName: WF,
    run,
    collected: true,
  };
  return { run: runRecord, analysis: {} };
}

/**
 * A judge artifact from before versioning existed: no judgeVersion stamp,
 * older model, per-node `reason` strings. readMisuseReport rejects this shape.
 */
function writeV1Artifact(run: Cell['runs'][number]): void {
  writeFileSync(
    join(run.run.runDir, 'ds-misuse.json'),
    JSON.stringify({
      metricsVersion: 7,
      judgedAt: '2026-08-20T18:33:10.461Z',
      model: 'claude-opus-4-8',
      dsGuidelinesRef: 'org/ds@abc',
      fixtureRef: 'org/app@ref',
      summary: { correctDsDecision: 1, evaluated: { ds: 1, local: 0 } },
      nodes: [{ ...judgedNode({}), correctDsDecision: { score: 1, reason: 'fine' } }],
    })
  );
}

function cell(resolved: ResolvedCase, runs: Cell['runs']): Cell {
  return {
    case: resolved,
    workflow: WF,
    runs,
    excluded: [],
    unanalyzed: 0,
    superseded: 0,
    passed: runs.length,
    failed: 0,
  };
}

describe('collectMisusePanel', () => {
  it('pools distributions per cell, carries every decision, and tallies facets', () => {
    const report = misuseReport([
      judgedNode({
        correctDsDecision: {
          score: 1,
          reasons: [{ text: 'This choice is fully documented in BrandGuidelines.mdx.' }],
        },
        correctDsUsage: {
          score: 0.5,
          reasons: [
            { facet: 'mdx.do-dont', text: "Doesn't quite follow the do/don't guidance." },
            { facet: 'general.general-tokens', text: 'Should reference tokens, not raw hex.' },
          ],
        },
      }),
      judgedNode({
        path: 'App/StatusText[0]',
        tag: 'StatusText',
        kind: 'local',
        line: 20,
        correctLocalDecision: {
          score: 0,
          reasons: [{ facet: 'general.general-a11y', text: 'Missing an accessible label.' }],
        },
      }),
    ]);
    const panel = collectMisusePanel([cell(TREATMENT, [usableRun(TREATMENT, 1, report)])], SPEC, {
      repoRoot: results,
    });

    expect(panel.judgedRuns).toBe(1);
    expect(panel.usableRuns).toBe(1);
    expect(panel.guidelinesRefs).toEqual(['org/ds@abc']);

    const summary = panel.cells[0]!;
    expect(summary.case).toBe('docs-full');
    expect(summary.questions.correctDsDecision).toEqual({ ones: 1, halves: 0, zeros: 0 });
    expect(summary.questions.correctDsUsage).toEqual({ ones: 0, halves: 1, zeros: 0 });
    expect(summary.questions.correctLocalDecision).toEqual({ ones: 0, halves: 0, zeros: 1 });
    expect(summary.evaluated).toEqual({ ds: 1, local: 1 });

    // Facet tallies: an answer citing two facets counts once in each; a
    // facet-less reason lands in 'uncategorised'.
    expect(summary.facetTallies['mdx.do-dont']).toEqual({ ones: 0, halves: 1, zeros: 0 });
    expect(summary.facetTallies['general.general-tokens']).toEqual({
      ones: 0,
      halves: 1,
      zeros: 0,
    });
    expect(summary.facetTallies['uncategorised']).toEqual({ ones: 1, halves: 0, zeros: 0 });

    // The catalogue is embedded.
    expect(panel.facets.find((f) => f.id === 'mdx.a11y')?.description).toBe('A11y rules to follow');

    // Every answer is carried — including the perfect one — worst-first.
    expect(panel.decisions.map((d) => [d.score, d.tag])).toEqual([
      [0, 'StatusText'],
      [0.5, 'Card'],
      [1, 'Card'],
    ]);
    expect(panel.decisions.at(0)!.score).toBeLessThan(1);
    expect(panel.decisions[0]!.reasons[0]!.text).toContain('accessible');
    expect(panel.decisions[0]!.runLabel).toBe(`${TS}/run-1`);

    // A perfect answer is carried as a decision, without an excerpt.
    const perfect = panel.decisions.find((d) => d.score === 1);
    expect(perfect).toBeDefined();
    expect(perfect!.excerpt).toBeUndefined();
    expect(perfect!.reasons[0]!.text).toContain('documented');
  });

  it('dedupes a facet cited by two reasons within the same answer', () => {
    const report = misuseReport([
      judgedNode({
        correctDsUsage: {
          score: 1,
          reasons: [
            { facet: 'mdx.do-dont', text: 'Follows the "do" guidance.' },
            { facet: 'mdx.do-dont', text: 'Also follows the "dont" guidance.' },
          ],
        },
      }),
    ]);
    const panel = collectMisusePanel([cell(TREATMENT, [usableRun(TREATMENT, 1, report)])], SPEC, {
      repoRoot: results,
    });
    // Two reasons citing the same facet still count as one tally, not two.
    expect(panel.cells[0]!.facetTallies['mdx.do-dont']).toEqual({ ones: 1, halves: 0, zeros: 0 });
  });

  it('counts unjudged runs into coverage without inventing scores for them', () => {
    const judged = usableRun(CONTROL, 1, misuseReport([]));
    const unjudged = usableRun(CONTROL, 2, null);
    const panel = collectMisusePanel([cell(CONTROL, [judged, unjudged])], SPEC, {
      repoRoot: results,
    });

    expect(panel.judgedRuns).toBe(1);
    expect(panel.usableRuns).toBe(2);
    const summary = panel.cells[0]!;
    expect(summary.judged).toBe(1);
    expect(summary.usable).toBe(2);
    // No node got any question: null throughout, never a zero distribution.
    expect(summary.questions.correctDsDecision).toBeNull();
    expect(summary.questions.correctLocalDecision).toBeNull();
  });

  it('counts an unusable artifact as stale, apart from runs the judge never saw', () => {
    const judged = usableRun(CONTROL, 1, misuseReport([]));
    const outdated = usableRun(CONTROL, 2, null);
    writeV1Artifact(outdated);
    const neverJudged = usableRun(CONTROL, 3, null);
    const panel = collectMisusePanel([cell(CONTROL, [judged, outdated, neverJudged])], SPEC, {
      repoRoot: results,
    });

    expect(panel.judgedRuns).toBe(1);
    expect(panel.staleRuns).toBe(1);
    expect(panel.usableRuns).toBe(3);
    expect(panel.cells[0]).toMatchObject({ judged: 1, stale: 1, usable: 3 });
  });

  it('reports zero stale runs when every artifact is readable', () => {
    const judged = usableRun(CONTROL, 1, misuseReport([]));
    const panel = collectMisusePanel([cell(CONTROL, [judged])], SPEC, { repoRoot: results });
    expect(panel.staleRuns).toBe(0);
    expect(panel.cells[0]!.stale).toBe(0);
  });

  it('attaches the flagged source as an excerpt when the tree holds the file', () => {
    const run = usableRun(
      TREATMENT,
      1,
      misuseReport([
        judgedNode({
          file: 'src/App.tsx',
          line: 3,
          correctDsUsage: { score: 0, reasons: [{ text: 'r' }] },
        }),
      ])
    );
    mkdirSync(join(run.run.projectDir, 'src'), { recursive: true });
    writeFileSync(
      join(run.run.projectDir, 'src/App.tsx'),
      ['a', 'b', 'the flagged line', 'd', 'e'].join('\n')
    );
    const panel = collectMisusePanel([cell(TREATMENT, [run])], SPEC, { repoRoot: results });
    expect(panel.decisions[0]!.excerpt).toEqual({
      start: 1,
      lines: ['a', 'b', 'the flagged line', 'd', 'e'],
    });
  });

  it('omits the excerpt rather than failing when the file is gone', () => {
    const run = usableRun(
      TREATMENT,
      1,
      misuseReport([judgedNode({ correctDsUsage: { score: 0, reasons: [{ text: 'r' }] } })])
    );
    const panel = collectMisusePanel([cell(TREATMENT, [run])], SPEC, { repoRoot: results });
    expect(panel.decisions[0]!.excerpt).toBeUndefined();
  });

  it('surfaces every distinct guideline pin so mixed-standard bundles are visible', () => {
    const a = usableRun(CONTROL, 1, misuseReport([], 'org/ds@old'));
    const b = usableRun(TREATMENT, 1, misuseReport([], 'org/ds@new'));
    const panel = collectMisusePanel([cell(CONTROL, [a]), cell(TREATMENT, [b])], SPEC, {
      repoRoot: results,
    });
    expect(panel.guidelinesRefs).toEqual(['org/ds@new', 'org/ds@old']);
  });
});

/** A report that passes isStale's check against the current guideline pin, judge version, and model. */
function currentReport(nodes: JudgedNode[] = []): DsMisuseReport {
  return misuseReport(nodes, dsDocsRefLabel());
}

describe('collectMisuseStatuses', () => {
  it('reports complete when every usable run carries a current judgement', () => {
    const run = usableRun(TREATMENT, 1, currentReport());
    const [status] = collectMisuseStatuses([cell(TREATMENT, [run])], SPEC);
    expect(status).toMatchObject({
      case: 'docs-full',
      workflow: WF,
      usable: 1,
      judged: 1,
      stale: 0,
      status: 'complete',
      label: 'complete',
    });
  });

  it('reports unjudged when no run carries a ds-misuse.json', () => {
    const run = usableRun(TREATMENT, 1, null);
    const [status] = collectMisuseStatuses([cell(TREATMENT, [run])], SPEC);
    expect(status).toMatchObject({ judged: 0, stale: 0, status: 'unjudged', label: 'unjudged' });
  });

  it('reports partial with a j/n label when some but not all runs are judged', () => {
    const judged = usableRun(TREATMENT, 1, currentReport());
    const unjudged = usableRun(TREATMENT, 2, null);
    const [status] = collectMisuseStatuses([cell(TREATMENT, [judged, unjudged])], SPEC);
    expect(status).toMatchObject({
      usable: 2,
      judged: 1,
      stale: 0,
      status: 'partial',
      label: 'partial (1/2 judged)',
    });
  });

  it('reports stale when a ds-misuse.json is present but disqualified by isStale', () => {
    // Judged against a guideline pin other than the current one.
    const run = usableRun(TREATMENT, 1, misuseReport([], 'org/ds@old'));
    const [status] = collectMisuseStatuses([cell(TREATMENT, [run])], SPEC);
    expect(status).toMatchObject({
      usable: 1,
      judged: 0,
      stale: 1,
      status: 'stale',
      label: 'stale (1 stale)',
    });
  });

  it('reports a pre-versioning artifact as stale, not unjudged', () => {
    // 80 real runs carried v1 artifacts (no judgeVersion stamp, judged by an
    // older model); readMisuseReport rejects them, and they read as
    // never-judged — silently identical to runs the judge never saw.
    const run = usableRun(TREATMENT, 1, null);
    writeV1Artifact(run);
    const [status] = collectMisuseStatuses([cell(TREATMENT, [run])], SPEC);
    expect(status).toMatchObject({
      usable: 1,
      judged: 0,
      stale: 1,
      status: 'stale',
      label: 'stale (1 stale)',
    });
  });
});

describe('formatMisuseStatusTable', () => {
  it('renders one aligned, styled row per cell', () => {
    const statuses = collectMisuseStatuses(
      [
        cell(CONTROL, [usableRun(CONTROL, 1, currentReport())]),
        cell(TREATMENT, [usableRun(TREATMENT, 1, null)]),
      ],
      SPEC
    );
    const table = formatMisuseStatusTable(statuses, MARKER_STYLE);
    expect(table).toContain('[C]control-none[/C]');
    expect(table).toContain('[T:good]complete[/T]');
    expect(table).toContain('[C]docs-full   [/C]');
    expect(table).toContain('[T:action]unjudged[/T]');
  });

  it('defaults to PLAIN_STYLE, so an unstyled call matches an explicit one', () => {
    const statuses = collectMisuseStatuses(
      [cell(TREATMENT, [usableRun(TREATMENT, 1, null)])],
      SPEC
    );
    expect(formatMisuseStatusTable(statuses)).toBe(formatMisuseStatusTable(statuses, PLAIN_STYLE));
  });
});
