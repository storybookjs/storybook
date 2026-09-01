import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { deltaToBaseline, analyzeRun, summarize } from './post-analysis.ts';
import goldenResult from './__fixtures__/golden-run/result.json' with { type: 'json' };
import goldenTranscript from './__fixtures__/golden-run/transcript.json' with { type: 'json' };

import type {
  BaselineContext,
  DeltaToBaselineContext,
  RunContext,
  SummarizeOptions,
} from '../post-analysis/types.ts';

// A pin DS_PACKAGES_BY_PIN maps to ['@base-ui/react', '@droppy/*'], so these
// tests exercise the real table rather than a stand-in for it.
const PIN = { repo: 'yannbf/mealdrop', ref: 'ce507b345666ea8678101fccac580186b2b69b1f' };
/** A pin nobody has mapped: the "this tree has no design system" case. */
const UNMAPPED_PIN = { repo: 'example/app', ref: '0000000000000000000000000000000000000000' };
/** A tree whose only component element comes from the mapped DS. */
const DS_TREE = {
  'src/C.tsx':
    "import { Button } from '@base-ui/react';\nexport const C = () => <div><Button /></div>;\n",
};
/** The same shape with no DS in it at all. */
const HOST_TREE = { 'src/C.tsx': 'export const C = () => <div><button /></div>;\n' };

let root: string;

function writeTree(name: string, files: Record<string, string>): string {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

function runContext(overrides: Partial<RunContext> = {}): RunContext {
  return {
    mode: 'run',
    runDir: join(root, 'run'),
    projectDir: writeTree('project', {
      'src/a.ts': 'function a(x){ if (x) return 1; return 0; }\n',
    }),
    fixtureDir: join(root, 'fixture'),
    experiment: 'agentic-ref-reuse-component-cc-mcp-opus-high',
    model: 'opus',
    timestamp: '2026-07-28T12-21-43.772Z',
    evalName: '701-agentic-ref-reuse-component-mcp',
    run: 1,
    result: goldenResult,
    transcript: goldenTranscript,
    pin: PIN,
    ...overrides,
  };
}

/**
 * A run tree plus the baseline analysis the runner would have loaded for it.
 * `runAnalysis` is the real thing rather than a stub: coverageDelta reads the
 * run's own coverage out of it instead of re-measuring the tree.
 */
function deltaContext(
  baselineFiles: Record<string, string>,
  projectFiles: Record<string, string>
): DeltaToBaselineContext {
  const baselineDir = writeTree('baseline', baselineFiles);
  const context = runContext({ projectDir: writeTree('after', projectFiles) });
  return {
    ...context,
    pin: PIN,
    runAnalysis: analyzeRun(context),
    baselineDir,
    baselineAnalysis: analyzeRun({
      mode: 'baseline',
      projectDir: baselineDir,
      pin: PIN,
    } satisfies BaselineContext),
  };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'post-analysis-'));
  mkdirSync(join(root, 'run'), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('analyzeRun in run mode', () => {
  it('reports the golden run speed, cost and tool-use figures', () => {
    const row = analyzeRun(runContext());

    expect(row.speed).toEqual({ durationSeconds: 403.365, turns: 12 });
    expect(row.cost).toMatchObject({
      inputTokens: 53157,
      outputTokens: 8239,
      totalTokens: 1208645,
      estimatedCostUsd: 1.89273325,
      totalToolCalls: 25,
    });
    expect((row.cost as { cacheHitRate: number }).cacheHitRate).toBeCloseTo(0.833, 4);
    expect(row.toolUse).toMatchObject({
      buckets: { docs: 1, exploration: 14, edit: 8, verification: 7, other: 0 },
    });
    expect((row.churn as { perFile: Record<string, number> }).perFile).toMatchObject({
      'src/components/Footer/Footer.tsx': 3,
    });
  });

  it('carries run identity through to the record', () => {
    expect(analyzeRun(runContext())).toMatchObject({
      experiment: 'agentic-ref-reuse-component-cc-mcp-opus-high',
      eval: '701-agentic-ref-reuse-component-mcp',
      run: 1,
      model: 'opus',
      status: 'failed',
      fixtureRef: 'yannbf/mealdrop@ce507b345666',
    });
  });

  it('measures a run that recorded no pin, leaving fixtureRef null', () => {
    // Nothing here reads the upstream tree, so a missing pin costs only the
    // label; the runner is what refuses to compute a delta without one.
    const row = analyzeRun(runContext({ pin: null }));
    expect(row.fixtureRef).toBeNull();
    expect(row.speed).toEqual({ durationSeconds: 403.365, turns: 12 });
  });

  it('nulls transcript metrics when the transcript has no events', () => {
    const row = analyzeRun(runContext({ transcript: {} }));
    expect(row.toolUse).toBeNull();
    expect(row.churn).toBeNull();
    // Non-transcript metrics still computed.
    expect(row.speed).toEqual({ durationSeconds: 403.365, turns: 12 });
  });

  it('reports nothing comparative, which is deltaToBaseline’s job', () => {
    const row = analyzeRun(runContext());
    expect(row.diff).toBeUndefined();
    expect(row.complexity).toBeUndefined();
    expect(row.coverageDelta).toBeUndefined();
  });

  it('measures the DS coverage of the tree the run left behind', () => {
    const row = analyzeRun(runContext({ projectDir: writeTree('project-ds', DS_TREE) }));

    expect(row.dsCoverage).toMatchObject({
      dsPackages: ['@base-ui/react', '@droppy/*'],
      files: 1,
      nodes: { all: 2, host: 1, component: 1, ds: 1, external: 0, local: 0, unresolved: 0 },
      dsShareOfAllNodes: 0.5,
      dsShareOfComponentNodes: 1,
    });
  });

  // The pin, not the fixture: this eval's directory no longer exists under
  // evals/, and its runs are still measured.
  it('measures coverage from the pin even when the eval fixture is gone', () => {
    const row = analyzeRun(
      runContext({
        projectDir: writeTree('project-ds', DS_TREE),
        fixtureDir: join(root, 'evals', 'deleted-eval'),
      })
    );
    expect((row.dsCoverage as { nodes: { ds: number } }).nodes.ds).toBe(1);
  });

  // Nothing else in the analysis needs the pin's DS list, so a tree with no
  // design system still gets every other metric rather than failing outright.
  it('nulls dsCoverage for a pin that declares no DS packages', () => {
    const row = analyzeRun(runContext({ pin: UNMAPPED_PIN }));
    expect(row.dsCoverage).toBeNull();
    expect(row.speed).toEqual({ durationSeconds: 403.365, turns: 12 });
  });

  it('nulls dsCoverage for a run that recorded no pin at all', () => {
    expect(analyzeRun(runContext({ pin: null })).dsCoverage).toBeNull();
  });
});

describe('analyzeRun in baseline mode', () => {
  it('returns per-file complexity for the whole pinned tree', () => {
    const projectDir = writeTree('ref', {
      'src/a.ts': 'function a(x){ if (x) return 1; return 0; }\n',
      'src/b.ts': 'function b(){ return 0; }\n',
    });
    const baseline = analyzeRun({
      mode: 'baseline',
      projectDir,
      pin: UNMAPPED_PIN,
    });

    const noJsx = { jsxLength: 0, jsxBindings: 0, jsxDepthTotal: 0, jsxTrees: 0 };
    expect(baseline).toEqual({
      files: {
        'src/a.ts': { cyclomatic: 2, cognitive: 1, jsxCyclomatic: 2, jsxCognitive: 1, ...noJsx },
        'src/b.ts': { cyclomatic: 1, cognitive: 0, jsxCyclomatic: 1, jsxCognitive: 0, ...noJsx },
      },
      parseFailures: [],
      dsCoverage: null,
    });
  });

  // This is what gets committed under baselines/ and reused across every run of
  // every arm on the pin, so the pinned tree is measured once rather than N times.
  it('stores the pinned tree’s coverage for the committed baseline to carry', () => {
    const baseline = analyzeRun({
      mode: 'baseline',
      projectDir: writeTree('ref-ds', HOST_TREE),
      pin: PIN,
    });

    expect(baseline.dsCoverage).toMatchObject({
      dsPackages: ['@base-ui/react', '@droppy/*'],
      nodes: { all: 2, host: 2, component: 0, ds: 0 },
      dsShareOfAllNodes: 0,
      // No component-typed element at all, so the ratio has no denominator.
      dsShareOfComponentNodes: null,
    });
  });

  // The judge compares a run's nodes against the pinned tree's, so the baseline
  // half has to exist. baseline.ts splits this into baselines/ds-nodes/ rather
  // than committing it inside the baseline file.
  it('censuses the pinned tree’s nodes for the census file to carry', () => {
    const baseline = analyzeRun({
      mode: 'baseline',
      projectDir: writeTree('ref-nodes', DS_TREE),
      pin: PIN,
    });

    expect(baseline.nodeList).toMatchObject([
      { file: 'src/C.tsx', tag: 'Button', category: 'ds', module: '@base-ui/react' },
    ]);
  });

  // A pin declaring no DS packages has nothing to census, and an empty list
  // would read as "measured, found nothing" rather than "not measured".
  it('emits no node list for a pin with no design system', () => {
    const baseline = analyzeRun({
      mode: 'baseline',
      projectDir: writeTree('ref-nodes-unmapped', DS_TREE),
      pin: UNMAPPED_PIN,
    });

    expect(baseline.nodeList).toBeUndefined();
  });
});

describe('deltaToBaseline', () => {
  it('computes a complexity delta against the baseline', () => {
    // baseline: `function a(){ return 0; }` is cyclomatic 1, cognitive 0.
    // project: adds an `if`, so cyclomatic 2, cognitive 1.
    const delta = deltaToBaseline(
      deltaContext(
        { 'src/a.ts': 'function a(){ return 0; }\n' },
        { 'src/a.ts': 'function a(x){ if (x) return 1; return 0; }\n' }
      )
    );

    expect(delta.complexity).toMatchObject({
      cyclomatic: { before: 1, after: 2, delta: 1 },
      cognitive: { before: 0, after: 1, delta: 1 },
      parseFailures: [],
    });
    expect((delta.diff as { files: string[] }).files).toEqual(['src/a.ts']);
  });

  it('excludes test files from the complexity delta while the sloc diff keeps them', () => {
    // The agent added a branchy regression test but touched no production
    // code: complexity must not move, or every unprompted test file reads as
    // the agent making the codebase worse.
    const delta = deltaToBaseline(
      deltaContext(
        { 'src/a.ts': 'function a(){ return 0; }\n' },
        {
          'src/a.ts': 'function a(){ return 0; }\n',
          'src/a.test.ts': 'function t(x){ if (x) return 1; return 0; }\n',
        }
      )
    );

    expect(delta.complexity).toMatchObject({
      cyclomatic: { delta: 0 },
      cognitive: { delta: 0 },
      densityPerSloc: null,
    });
    expect((delta.diff as { files: string[] }).files).toEqual(['src/a.test.ts']);
    expect((delta.diff as { sloc: { added: number } }).sloc.added).toBe(1);
  });

  it('keeps baseline test complexity out of the before and after totals', () => {
    // The baseline tree ships its own test files; leaving their scores in
    // `before` and `after` inflates both totals (and skews the jsxDepth
    // ratio) even though the delta cancels.
    const delta = deltaToBaseline(
      deltaContext(
        {
          'src/a.ts': 'function a(){ return 0; }\n',
          'src/a.test.ts': 'function t(x){ if (x) return 1; return 0; }\n',
        },
        {
          'src/a.ts': 'function a(x){ if (x) return 1; return 0; }\n',
          'src/a.test.ts': 'function t(x){ if (x) return 1; return 0; }\n',
        }
      )
    );

    expect(delta.complexity).toMatchObject({
      cyclomatic: { before: 1, after: 2, delta: 1 },
    });
  });

  it('divides density by production sloc only, not test sloc', () => {
    const delta = deltaToBaseline(
      deltaContext(
        { 'src/a.ts': 'function a(){ return 0; }\n' },
        {
          // +1 cognitive over three net production lines.
          'src/a.ts': 'function a(x){\nif (x) return 1;\nreturn 0;\n}\n',
          // Two test lines that must not dilute the ratio.
          'src/a.test.ts': 'const t = 1\nconst u = 2\n',
        }
      )
    );

    const complexity = delta.complexity as { cognitive: { delta: number }; densityPerSloc: number };
    expect(complexity.cognitive.delta).toBe(1);
    expect(complexity.densityPerSloc).toBeCloseTo(1 / 3);
  });

  it('prices grown markup through the jsx family where the classic metrics barely move', () => {
    const delta = deltaToBaseline(
      deltaContext(
        { 'src/C.tsx': 'export const C = () => <div>hi</div>;\n' },
        {
          'src/C.tsx': 'export const C = (x) => <div><section>{x ? <A/> : <B/>}</section></div>;\n',
        }
      )
    );

    // The classic metrics see one new ternary. jsxCognitive sees it two
    // elements deep; jsx-structure sees three new tags, a binding, and the
    // tree going from depth 1 to depth 3.
    expect(delta.complexity).toMatchObject({
      cyclomatic: { before: 1, after: 2, delta: 1 },
      cognitive: { before: 0, after: 1, delta: 1 },
      jsxCyclomatic: { before: 1, after: 2, delta: 1 },
      jsxCognitive: { before: 0, after: 4, delta: 4 },
      jsxLength: { before: 1, after: 4, delta: 3 },
      jsxBindings: { before: 0, after: 1, delta: 1 },
      jsxDepth: { before: 1, after: 3, delta: 2 },
    });
  });

  it('nulls jsxDepth when a side has no markup at all', () => {
    const delta = deltaToBaseline(
      deltaContext(
        { 'src/a.ts': 'function a(){ return 0; }\n' },
        { 'src/a.ts': 'function a(x){ if (x) return 1; return 0; }\n' }
      )
    );

    expect(delta.complexity).toMatchObject({
      jsxDepth: { before: null, after: null, delta: null },
    });
  });

  it('scores a file the agent created as zero before', () => {
    // baseline src/a.ts is cyclomatic 1; the added src/new.ts is 2 and has no
    // baseline entry, so the whole-project total goes 1 -> 3.
    const delta = deltaToBaseline(
      deltaContext(
        { 'src/a.ts': 'function a(){ return 0; }\n' },
        {
          'src/a.ts': 'function a(){ return 0; }\n',
          'src/new.ts': 'function n(x){ if (x) return 1; return 0; }\n',
        }
      )
    );

    expect(delta.complexity).toMatchObject({
      cyclomatic: { before: 1, after: 3, delta: 2 },
      cognitive: { before: 0, after: 1, delta: 1 },
    });
  });

  // before/after are whole-project totals, not sums over the touched subset:
  // summed over changed files alone they are two arbitrary numbers whose only
  // meaningful content is their difference, and they cannot be compared to
  // another run that happened to touch different files.
  it('reports whole-project totals, counting files the run never touched', () => {
    const untouched = { 'src/untouched.ts': 'function u(x){ if (x) return 1; return 0; }\n' };
    const delta = deltaToBaseline(
      deltaContext(
        { ...untouched, 'src/a.ts': 'function a(){ return 0; }\n' },
        { ...untouched, 'src/a.ts': 'function a(x){ if (x) return 1; return 0; }\n' }
      )
    );

    // untouched is cyclomatic 2 / cognitive 1 on both sides; a.ts goes 1 -> 2
    // and 0 -> 1. Totals carry untouched; the delta does not.
    expect(delta.complexity).toMatchObject({
      cyclomatic: { before: 3, after: 4, delta: 1 },
      cognitive: { before: 1, after: 2, delta: 1 },
    });
    expect((delta.diff as { files: string[] }).files).toEqual(['src/a.ts']);
  });

  it('drops a deleted file from the after total', () => {
    const delta = deltaToBaseline(
      deltaContext(
        {
          'src/a.ts': 'function a(){ return 0; }\n',
          'src/gone.ts': 'function g(x){ if (x) return 1; return 0; }\n',
        },
        { 'src/a.ts': 'function a(){ return 0; }\n' }
      )
    );

    expect(delta.complexity).toMatchObject({
      cyclomatic: { before: 3, after: 1, delta: -2 },
      cognitive: { before: 1, after: 0, delta: -1 },
    });
  });

  it('nulls densityPerSloc when no lines changed', () => {
    // Identical trees: sloc.net is 0, so the ratio has no denominator.
    const identical = { 'src/a.ts': 'function a(x){ if (x) return 1; return 0; }\n' };
    const delta = deltaToBaseline(deltaContext(identical, identical));

    expect((delta.complexity as { densityPerSloc: number | null }).densityPerSloc).toBeNull();
    expect((delta.diff as { sloc: { net: number } }).sloc.net).toBe(0);
  });

  it('reports how the DS share moved between the two trees', () => {
    const delta = deltaToBaseline(deltaContext(HOST_TREE, DS_TREE));

    expect(delta.coverageDelta).toMatchObject({
      dsPackages: ['@base-ui/react', '@droppy/*'],
      nodes: {
        all: { before: 2, after: 2, delta: 0 },
        host: { before: 2, after: 1, delta: -1 },
        component: { before: 0, after: 1, delta: 1 },
        ds: { before: 0, after: 1, delta: 1 },
      },
      dsShareOfAllNodes: { before: 0, after: 0.5, delta: 0.5 },
      // The baseline has no component-typed element, so its share of them is
      // undefined and so is the movement — 1 is not "up from zero" here.
      dsShareOfComponentNodes: { before: null, after: 1, delta: null },
    });
  });

  it('nulls coverageDelta for a pin that declares no DS packages', () => {
    const identical = { 'src/C.tsx': 'export const C = () => <div />;\n' };
    const context = { ...deltaContext(identical, identical), pin: UNMAPPED_PIN };
    expect(
      deltaToBaseline({ ...context, runAnalysis: analyzeRun(context) }).coverageDelta
    ).toBeNull();
  });

  // metricsVersion invalidates a baseline when a metric definition moves, but
  // DS_PACKAGES_BY_PIN can gain or change an entry without it.
  it('re-measures the baseline when its stored coverage counted other packages', () => {
    const context = deltaContext(HOST_TREE, DS_TREE);
    const stale = {
      ...context,
      baselineAnalysis: {
        dsCoverage: {
          dsPackages: ['@other/*'],
          files: 1,
          nodes: { all: 99, host: 99, component: 0, ds: 0, external: 0, local: 0, unresolved: 0 },
          dsShareOfAllNodes: 0,
          dsShareOfComponentNodes: null,
          parseFailures: [],
          readFailures: [],
        },
      },
    };

    // 2, not 99: the stale numbers were discarded and baselineDir re-measured.
    expect(deltaToBaseline(stale).coverageDelta).toMatchObject({
      nodes: { all: { before: 2, after: 2 } },
    });
  });

  // The whole point of committing baselines: measuring the pinned tree once per
  // pin rather than once per run of every arm.
  it('reuses the committed baseline coverage when it counted the same packages', () => {
    const context = deltaContext(HOST_TREE, DS_TREE);
    const committed = {
      ...context,
      baselineAnalysis: {
        dsCoverage: {
          dsPackages: ['@base-ui/react', '@droppy/*'],
          files: 1,
          nodes: { all: 8, host: 6, component: 2, ds: 1, external: 1, local: 0, unresolved: 0 },
          dsShareOfAllNodes: 0.125,
          dsShareOfComponentNodes: 0.5,
          parseFailures: [],
          readFailures: [],
        },
      },
    };

    expect(deltaToBaseline(committed).coverageDelta).toMatchObject({
      nodes: { all: { before: 8, after: 2, delta: -6 } },
      dsShareOfAllNodes: { before: 0.125, after: 0.5, delta: 0.375 },
      dsShareOfComponentNodes: { before: 0.5, after: 1, delta: 0.5 },
    });
  });

  it('never stores Infinity or NaN', () => {
    const serialised = JSON.stringify(
      deltaToBaseline(
        deltaContext(
          { 'src/a.ts': 'function a(){ return 0; }\n' },
          { 'src/a.ts': 'function a(x){ if (x) return 1; return 0; }\n' }
        )
      )
    );
    expect(serialised).not.toContain('Infinity');
    expect(serialised).not.toContain('NaN');
  });
});

describe('summarize', () => {
  // summarize prints per-run and grouped vitals, then — only when a run
  // carries a baseline delta — a per-run and a grouped complexity table, then
  // — only when a run measured DS coverage — a per-run and a grouped coverage
  // table, and returns the grouped rows for the runner to persist. These tests
  // read the printed tables in order: vitals at 0 and 1, the complexity pair
  // at 2 and 3, the coverage pair after whichever ran.
  //
  // The tables are read back out of what was printed rather than out of the
  // values handed to a renderer, because how a cell reads — a bare 29.59%, a
  // signed delta, the label a row carries — is the whole point of these views.
  function printed(
    rows: Array<Record<string, unknown>>,
    options?: SummarizeOptions
  ): Array<string> {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      summarize(rows, options);
      return spy.mock.calls
        .map((call) => String(call[0]))
        .filter((output) => output.startsWith('┌'));
    } finally {
      spy.mockRestore();
    }
  }

  /** One rendered table as its cells, keyed by column header. */
  function readTable(rendered: string): Array<Record<string, string>> {
    const [header, ...body] = rendered
      .split('\n')
      .filter((line) => line.startsWith('│'))
      .map((line) =>
        line
          .split('│')
          .slice(1, -1)
          .map((cell) => cell.trim())
      );
    return body.map((cells) =>
      Object.fromEntries(cells.map((cell, index) => [header![index]!, cell]))
    );
  }

  function tables(
    rows: Array<Record<string, unknown>>,
    options?: SummarizeOptions
  ): Array<Array<Record<string, string>>> {
    return printed(rows, options).map(readTable);
  }

  function groupedRows(rows: Array<Record<string, unknown>>): Array<Record<string, string>> {
    return tables(rows)[1] ?? [];
  }

  // A run is labelled in the reader's own timezone, so these tests fix one
  // rather than passing wherever they happen to run.
  const localZone = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = 'Europe/Paris';
  });
  afterAll(() => {
    process.env.TZ = localZone;
  });

  // run-3 stopped identifying a row once the tables started aggregating every
  // comparable collection of a cell: three result directories each hold one.
  it('labels a run with the local minute it was collected and its number', () => {
    // The row was stamped 13:20 UTC, which is 15:20 where this is read.
    expect(tables(armRows())[0]?.[0]?.run).toBe('2026-08-15 15:20 #1');
  });

  // Naming the arm is the grouped table's job: a per-run row never spends a
  // column on it, and a set spanning arms stays tellable-apart one table down.
  it('leaves arm naming to the grouped table', () => {
    expect(tables(armRows())[0]?.[0]).not.toHaveProperty('experiment');

    const mixed = tables([...armRows(), { ...armRows()[0], experiment: 'y' }]);
    expect(mixed[0]?.[0]).not.toHaveProperty('experiment');
    expect(mixed[1]?.map((row) => row.experiment)).toEqual(['x', 'y']);
  });

  // Returning these is what puts them in results/analysis-summary.json; a
  // summarize that only printed would silently empty that file.
  it('returns the grouped rows, not just printing them', () => {
    const rows = [
      {
        experiment: 'x',
        eval: 'e',
        status: 'passed',
        fixtureRef: 'r@1',
        cost: { estimatedCostUsd: 1 },
        speed: { durationSeconds: 10 },
        toolUse: null,
      },
    ];
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(summarize(rows)).toEqual(groupedRowsShape());
    } finally {
      spy.mockRestore();
    }

    function groupedRowsShape() {
      return [
        expect.objectContaining({
          experiment: 'x',
          eval: 'e',
          runs: 1,
          passed: 1,
          fixtureRefs: ['r@1'],
        }),
      ];
    }
  });

  /** Two runs of one arm carrying every complexity measure. */
  function armRows(): Array<Record<string, unknown>> {
    return [
      {
        experiment: 'x',
        eval: 'e',
        run: 1,
        timestamp: '2026-08-15T13-20-41.492Z',
        status: 'passed',
        fixtureRef: 'r@1',
        cost: { estimatedCostUsd: 1 },
        speed: { durationSeconds: 10 },
        toolUse: { buckets: { docs: 2, exploration: 4 } },
        deltaToBaseline: {
          diff: { sloc: { added: 10, net: 8 } },
          complexity: {
            cyclomatic: { delta: 2 },
            cognitive: { delta: 3 },
            jsxCyclomatic: { delta: 4 },
            jsxCognitive: { delta: 7 },
            jsxLength: { delta: 4 },
            jsxBindings: { delta: 2 },
            jsxDepth: { delta: 1 },
            densityPerSloc: 0.375,
            parseFailures: [],
          },
        },
      },
      {
        experiment: 'x',
        eval: 'e',
        run: 2,
        timestamp: '2026-08-16T09-02-00.000Z',
        status: 'failed',
        fixtureRef: 'r@1',
        cost: { estimatedCostUsd: 3 },
        speed: { durationSeconds: 20 },
        toolUse: { buckets: { docs: 0, exploration: 8 } },
        deltaToBaseline: {
          diff: { sloc: { added: 20, net: 16 } },
          complexity: {
            cyclomatic: { delta: 4 },
            cognitive: { delta: 5 },
            jsxCyclomatic: { delta: 6 },
            jsxCognitive: { delta: 11 },
            jsxLength: { delta: 8 },
            jsxBindings: { delta: 4 },
            jsxDepth: { delta: 3 },
            densityPerSloc: 0.3125,
            parseFailures: ['src/broken.ts'],
          },
        },
      },
    ];
  }

  it('groups by experiment and eval, and reports means', () => {
    const [group] = groupedRows(armRows());
    expect(group).toMatchObject({
      experiment: 'x',
      case: 'e',
      fixtureRef: 'r@1',
      runs: '2',
      passed: '1',
      costUsd: '4',
      'μ seconds': '15',
      'μ docs': '1',
      'μ sloc': '15',
    });
    // Complexity moved to its own tables; the vitals stay lean.
    expect(group).not.toHaveProperty('μ cog');
  });

  it('prints a per-run complexity table with the whole family', () => {
    const [, , perRun] = tables(armRows());
    expect(perRun?.[0]).toEqual({
      run: '2026-08-15 15:20 #1',
      slocNet: '8',
      cyclo: '2',
      cog: '3',
      jsxCyclo: '4',
      jsxCog: '7',
      jsxLen: '4',
      jsxBind: '2',
      jsxDepth: '1',
      density: '0.375',
      parseFails: '0',
    });
    // A run whose delta skirted unparseable files is flagged, not hidden.
    expect(perRun?.[1]).toMatchObject({ run: '2026-08-16 11:02 #2', parseFails: '1' });
  });

  it('prints a grouped complexity table with the family means', () => {
    const [, , , grouped] = tables(armRows());
    expect(grouped?.[0]).toEqual({
      experiment: 'x',
      case: 'e',
      'μ cyclo': '3',
      'μ cog': '4',
      'μ jsxCyclo': '5',
      'μ jsxCog': '9',
      'μ jsxLen': '6',
      'μ jsxBind': '3',
      'μ jsxDepth': '2',
      'μ density': '0.344',
      parseFailRuns: '1',
    });
  });

  it('returns the complexity means in the stored rows', () => {
    const rows = [
      {
        experiment: 'x',
        eval: 'e',
        status: 'passed',
        fixtureRef: 'r@1',
        cost: {},
        speed: {},
        deltaToBaseline: {
          complexity: {
            cyclomatic: { delta: 2 },
            jsxCyclomatic: { delta: 5 },
            jsxCognitive: { delta: 7 },
            jsxLength: { delta: 4 },
            jsxBindings: { delta: 3 },
            jsxDepth: { delta: 1.5 },
            densityPerSloc: 0.25,
            parseFailures: ['a.tsx'],
          },
        },
      },
    ];
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(summarize(rows)[0]).toMatchObject({
        cyclomaticDelta: { mean: 2 },
        jsxCyclomaticDelta: { mean: 5 },
        jsxCognitiveDelta: { mean: 7 },
        jsxLengthDelta: { mean: 4 },
        jsxBindingsDelta: { mean: 3 },
        jsxDepthDelta: { mean: 1.5 },
        densityPerSloc: { mean: 0.25 },
        parseFailures: { runs: 1 },
      });
    } finally {
      spy.mockRestore();
    }
  });

  /** Two runs of one arm carrying absolute coverage and its delta. */
  function coverageRows(): Array<Record<string, unknown>> {
    const coverage = (ds: number, component: number, all: number) => ({
      dsPackages: ['@ds/*'],
      files: 3,
      nodes: {
        all,
        host: all - component,
        component,
        ds,
        external: 0,
        local: component - ds,
        unresolved: 0,
      },
      dsShareOfAllNodes: ds / all,
      dsShareOfComponentNodes: ds / component,
      instances: {
        nodes: {
          all,
          host: all - component - 2,
          component: component + 2,
          ds: ds + 2,
          external: 0,
          local: component - ds,
          unresolved: 0,
        },
        dsShareOfAllNodes: (ds + 2) / all,
        dsShareOfComponentNodes: (ds + 2) / (component + 2),
      },
      parseFailures: [],
      readFailures: [],
    });
    const row = (run: number, ds: number, component: number, all: number, dsBefore: number) => ({
      experiment: 'x',
      eval: 'e',
      run,
      timestamp: '2026-08-15T13-20-41.492Z',
      status: 'passed',
      fixtureRef: 'r@1',
      cost: {},
      speed: {},
      dsCoverage: coverage(ds, component, all),
      deltaToBaseline: {
        coverageDelta: {
          dsPackages: ['@ds/*'],
          nodes: { ds: { before: dsBefore, after: ds, delta: ds - dsBefore } },
          dsShareOfAllNodes: {
            before: dsBefore / all,
            after: ds / all,
            delta: (ds - dsBefore) / all,
          },
          dsShareOfComponentNodes: {
            before: dsBefore / component,
            after: ds / component,
            delta: (ds - dsBefore) / component,
          },
          instances: {
            nodes: { ds: { before: dsBefore + 1, after: ds + 2, delta: ds + 1 - dsBefore } },
            dsShareOfAllNodes: {
              before: (dsBefore + 1) / all,
              after: (ds + 2) / all,
              delta: (ds + 1 - dsBefore) / all,
            },
            dsShareOfComponentNodes: {
              before: (dsBefore + 1) / (component + 2),
              after: (ds + 2) / (component + 2),
              delta: (ds + 1 - dsBefore) / (component + 2),
            },
          },
        },
      },
    });
    return [row(1, 6, 8, 20, 4), row(2, 10, 12, 20, 4)];
  }

  // Shares print as percentages and their deltas as percentage points: the
  // difference between two percentages is not itself a percentage, and `+10%`
  // against a shareAll of `30%` would read as a relative change.
  it('prints a per-run coverage table with absolutes beside the delta', () => {
    const [, , perRun] = tables(coverageRows());
    expect(perRun?.[0]).toEqual({
      run: '2026-08-15 15:20 #1',
      nodes: '20',
      dsNodes: '6',
      compNodes: '8',
      shareAll: '30%',
      shareComp: '75%',
      iShareAll: '40%',
      iShareComp: '80%',
      unres: '0',
      dsNodesΔ: '2',
      shareAllΔ: '+10%',
      shareCompΔ: '+25%',
      iShareAllΔ: '+15%',
      iShareCompΔ: '+30%',
    });
  });

  it('prints a grouped coverage table with the family means', () => {
    const [, , , grouped] = tables(coverageRows());
    expect(grouped?.[0]).toEqual({
      experiment: 'x',
      case: 'e',
      'μ dsNodes': '8',
      'μ compNodes': '10',
      'μ iShareAll': '50%',
      'μ iShareComp': '82.86%',
      'μ unres': '0',
      'μ dsNodesΔ': '4',
      'μ iShareAllΔ': '+25%',
      'μ iShareCompΔ': '+40%',
    });
  });

  // The percentages are for reading; what gets persisted stays the fraction it
  // was measured as, so a later reader can do arithmetic on it.
  it('returns the coverage means in the stored rows', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      expect(summarize(coverageRows())[0]).toMatchObject({
        dsNodes: { mean: 8 },
        componentNodes: { mean: 10 },
        dsShareOfAllNodes: { mean: 0.4 },
        dsShareOfComponentNodes: { mean: 0.7917 },
        dsNodesDelta: { mean: 4 },
        dsShareOfAllNodesDelta: { mean: 0.2 },
        dsShareOfComponentNodesDelta: { mean: 0.375 },
        dsShareOfAllInstances: { mean: 0.5 },
        dsShareOfComponentInstances: { mean: 0.8286 },
        dsShareOfAllInstancesDelta: { mean: 0.25 },
        dsShareOfComponentInstancesDelta: { mean: 0.4 },
      });
    } finally {
      spy.mockRestore();
    }
  });

  // A run measured before metricsVersion 8 has no instance block anywhere;
  // the columns say null rather than crashing or dragging a mean.
  it('tolerates runs measured before instance weighting', () => {
    const legacy = coverageRows().map((row) => {
      const coverage = { ...(row.dsCoverage as Record<string, unknown>) };
      delete coverage.instances;
      const delta = {
        ...(row.deltaToBaseline as { coverageDelta: Record<string, unknown> }).coverageDelta,
      };
      delete delta.instances;
      return { ...row, dsCoverage: coverage, deltaToBaseline: { coverageDelta: delta } };
    });
    const [, , perRun, grouped] = tables(legacy);
    expect(perRun?.[0]).toMatchObject({ iShareAll: 'null', iShareAllΔ: 'null' });
    expect(grouped?.[0]).toMatchObject({ 'μ iShareAll': 'null' });
  });

  it('signs a coverage share that fell', () => {
    const [fallen] = coverageRows();
    const delta = (fallen as { deltaToBaseline: { coverageDelta: Record<string, unknown> } })
      .deltaToBaseline.coverageDelta;
    delta.dsShareOfAllNodes = { before: 0.4, after: 0.3, delta: -0.1 };
    const [, , perRun] = tables([fallen!]);
    expect(perRun?.[0]?.shareAllΔ).toBe('-10%');
  });

  it('skips the coverage tables for an eval that measures no DS', () => {
    // armRows carries complexity deltas but no dsCoverage: vitals pair plus
    // complexity pair, and nothing more.
    expect(tables(armRows())).toHaveLength(4);
  });

  describe('table selection', () => {
    /** Rows carrying every family, so only the options decide what prints. */
    function everything(): Array<Record<string, unknown>> {
      return coverageRows().map((row, index) => ({
        ...row,
        ...armRows()[index],
        dsCoverage: row.dsCoverage,
        deltaToBaseline: {
          ...(armRows()[index]?.deltaToBaseline as Record<string, unknown>),
          ...(row.deltaToBaseline as Record<string, unknown>),
        },
      }));
    }

    it('prints every family when the caller asks for none in particular', () => {
      expect(tables(everything())).toHaveLength(6);
    });

    it('prints only the families the runner selected', () => {
      expect(
        tables(everything(), { general: false, complexity: false, coverage: true, misuse: false })
      ).toHaveLength(2);
      expect(
        tables(everything(), { general: true, complexity: false, coverage: false, misuse: false })
      ).toHaveLength(2);
      expect(
        tables(everything(), { general: false, complexity: true, coverage: true, misuse: false })
      ).toHaveLength(4);
    });

    // A bare eval-directory header with nothing under it reads as a broken
    // analysis rather than "this eval measures none of what you asked for".
    it('says why nothing printed when the selected family has no data', () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        // armRows carries complexity but no coverage.
        summarize(armRows(), { general: false, complexity: false, coverage: true, misuse: false });
        expect(log.mock.calls.map(String).filter((line) => line.startsWith('┌'))).toEqual([]);
        // The one thing that stops a run being measured is an unmapped pin,
        // so the note names the table to edit rather than shrugging.
        expect(log).toHaveBeenCalledWith(expect.stringContaining('DS_PACKAGES_BY_PIN'));
      } finally {
        log.mockRestore();
      }
    });

    it('says nothing beyond the tables when a selected family does have data', () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        summarize(coverageRows(), {
          general: false,
          complexity: false,
          coverage: true,
          misuse: false,
        });
        // coverageRows carries no DS misuse judgement, so the judged-runs hint
        // is expected here too — it is covered separately in its own describe.
        expect(
          log.mock.calls
            .map(String)
            .filter((line) => !line.startsWith('┌') && !line.includes('DS misuse:'))
        ).toEqual([]);
      } finally {
        log.mockRestore();
      }
    });

    // The runner folds each result directory on its own to keep that
    // directory's summary.json scoped to it, and prints the comparable set
    // those runs belong to instead — so folding has to be able to say nothing.
    it('prints nothing at all when the caller asks to be quiet', () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        const quiet = summarize(everything(), {
          general: true,
          complexity: true,
          coverage: true,
          misuse: false,
          quiet: true,
        });
        expect(log).not.toHaveBeenCalled();
        expect(quiet).toEqual(
          summarize(everything(), {
            general: false,
            complexity: false,
            coverage: false,
            misuse: false,
          })
        );
      } finally {
        log.mockRestore();
      }
    });

    // The rows are what lands in summary.json and analysis-summary.json; which
    // tables were printed must not touch them.
    it('returns the same rows whatever prints', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      try {
        const all = summarize(everything(), {
          general: true,
          complexity: true,
          coverage: true,
          misuse: false,
        });
        const none = summarize(everything(), {
          general: false,
          complexity: false,
          coverage: false,
          misuse: false,
        });
        expect(none).toEqual(all);
      } finally {
        spy.mockRestore();
      }
    });
  });

  it('reports null cost rather than zero when no run priced', () => {
    const rows = [
      {
        experiment: 'x',
        eval: 'e',
        status: 'passed',
        fixtureRef: 'r@1',
        cost: { estimatedCostUsd: null },
        speed: {},
        toolUse: null,
      },
    ];
    expect(groupedRows(rows)[0]?.costUsd).toBe('null');
  });

  it('survives a row with no delta, e.g. an eval with no baseline', () => {
    const rows = [
      { experiment: 'x', eval: 'e', status: 'passed', fixtureRef: 'r@1', cost: {}, speed: {} },
    ];
    const printed = tables(rows);
    // No baseline delta anywhere: the complexity tables are not printed.
    expect(printed).toHaveLength(2);
    expect(printed[1]?.[0]).toMatchObject({ runs: '1', 'μ sloc': 'null' });
  });

  it('flags a group spanning more than one fixture pin', () => {
    const rows = [
      { experiment: 'x', eval: 'e', status: 'passed', fixtureRef: 'r@1', cost: {}, speed: {} },
      { experiment: 'x', eval: 'e', status: 'passed', fixtureRef: 'r@2', cost: {}, speed: {} },
    ];
    expect(groupedRows(rows)[0]?.fixtureRef).toBe('mixed (2)');
  });
});

describe('misuse summary', () => {
  function row(overrides: Record<string, unknown> = {}) {
    return {
      experiment: 'agentic-ref-arm-a',
      eval: '701-new-ui-flow',
      run: 1,
      status: 'passed',
      fixtureRef: 'yannbf/mealdrop@refs/tags/x',
      dsMisuse: {
        summary: {
          correctDsDecision: 1,
          correctDsUsage: 0.5,
          correctLocalDecision: null,
          evaluated: { ds: 2, local: 0 },
        },
      },
      ...overrides,
    };
  }

  const SILENT = { general: false, complexity: false, coverage: false, misuse: false };

  it('means each score across an arm', () => {
    const [group] = summarize([row(), row({ run: 2 })], SILENT);
    expect(group).toMatchObject({
      misuseDecision: { mean: 1 },
      misuseUsage: { mean: 0.5 },
      misuseEvaluated: { ds: 4, local: 0 },
    });
  });

  // An unjudged run must not read as a zero — that is the difference between
  // "not measured" and "measured badly".
  it('excludes unjudged runs from the means', () => {
    const [group] = summarize([row(), row({ run: 2, dsMisuse: undefined })], SILENT);
    expect(group).toMatchObject({ misuseDecision: { mean: 1 }, misuseJudged: 1, runs: 2 });
  });

  it('leaves a score no run measured as null', () => {
    expect(summarize([row()], SILENT)[0]).toMatchObject({ misuseLocalDecision: { mean: null } });
  });
});

describe('misuse findings', () => {
  function misuseRow(nodes: Array<Record<string, unknown>>): Record<string, unknown> {
    return {
      experiment: 'agentic-ref-cc-x-opus-high',
      eval: 'e',
      run: 1,
      timestamp: '2026-08-15T13-20-41.492Z',
      status: 'passed',
      fixtureRef: 'r@1',
      cost: { estimatedCostUsd: 1 },
      speed: { durationSeconds: 10 },
      toolUse: { buckets: { docs: 0, exploration: 0 } },
      dsMisuse: {
        summary: {
          correctDsDecision: 0.5,
          correctDsUsage: 1,
          correctLocalDecision: null,
          evaluated: { ds: nodes.length, local: 0 },
        },
        nodes,
      },
    };
  }

  function loggedLines(rows: Array<Record<string, unknown>>): string {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      summarize(rows, { general: false, complexity: false, coverage: false, misuse: true });
      return spy.mock.calls.map((call) => String(call[0])).join('\n');
    } finally {
      spy.mockRestore();
    }
  }

  it('prints every judged verdict, including a perfect one, with its file, question, and reason', () => {
    const output = loggedLines([
      misuseRow([
        {
          path: 'App/Badge[0]',
          file: 'src/OrderStatus.tsx',
          line: 12,
          tag: 'Badge',
          kind: 'ds',
          correctDsDecision: {
            score: 0,
            reasons: [{ text: 'Badge.mdx rules out Badge for a live status; use status text.' }],
          },
          correctDsUsage: { score: 1, reasons: [{ text: 'No violation.' }] },
        },
      ]),
    ]);
    expect(output).toContain('Judged nodes (every verdict, with reason)');
    expect(output).toContain('<Badge>');
    expect(output).toContain('right component');
    expect(output).toContain('src/OrderStatus.tsx:12');
    expect(output).toContain('Badge.mdx rules out Badge for a live status');
    // The perfect answer on the same node prints too, not only the below-perfect one.
    expect(output).toContain('No violation.');
  });

  it('prints a verdict line for every judged node, even when every score is 1', () => {
    const output = loggedLines([
      misuseRow([
        {
          path: 'App/Card[0]',
          file: 'src/App.tsx',
          line: 3,
          tag: 'Card',
          kind: 'ds',
          correctDsDecision: { score: 1, reasons: [{ text: 'Right fit.' }] },
        },
      ]),
    ]);
    expect(output).toContain('Judged nodes (every verdict, with reason)');
    expect(output).toContain('<Card>');
    expect(output).toContain('Right fit.');
    expect(output).not.toContain('No findings');
  });

  it('reports a distinct message for a row with summary scores but no nodes array', () => {
    const output = loggedLines([
      {
        experiment: 'agentic-ref-cc-x-opus-high',
        eval: 'e',
        run: 1,
        status: 'passed',
        fixtureRef: 'r@1',
        cost: { estimatedCostUsd: 1 },
        speed: { durationSeconds: 10 },
        toolUse: { buckets: { docs: 0, exploration: 0 } },
        dsMisuse: {
          summary: {
            correctDsDecision: 1,
            correctDsUsage: 1,
            correctLocalDecision: null,
            evaluated: { ds: 2, local: 0 },
          },
        },
      },
    ]);
    expect(output).toContain(
      'No per-node verdicts: these runs carry summary scores but no judged node detail.'
    );
    expect(output).not.toContain('No findings: every judged node scored 1');
  });

  it('reports the same distinct message for a row with an empty nodes array', () => {
    const output = loggedLines([misuseRow([])]);
    expect(output).toContain(
      'No per-node verdicts: these runs carry summary scores but no judged node detail.'
    );
  });
});

describe('DS misuse judged hint', () => {
  function plainRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      experiment: 'x',
      eval: 'e',
      run: 1,
      status: 'passed',
      fixtureRef: 'r@1',
      cost: { estimatedCostUsd: 1 },
      speed: { durationSeconds: 10 },
      toolUse: null,
      ...overrides,
    };
  }

  const judgedRow = plainRow({
    dsMisuse: {
      summary: {
        correctDsDecision: 1,
        correctDsUsage: 1,
        correctLocalDecision: null,
        evaluated: { ds: 1, local: 0 },
      },
    },
  });

  function loggedLines(rows: Array<Record<string, unknown>>, options?: SummarizeOptions): string {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      summarize(rows, options);
      return spy.mock.calls.map((call) => String(call[0])).join('\n');
    } finally {
      spy.mockRestore();
    }
  }

  it('tells the reader how many runs are judged even when --misuse is off', () => {
    const output = loggedLines([plainRow({ run: 1 }), plainRow({ run: 2 })], {
      general: false,
      complexity: false,
      coverage: false,
      misuse: false,
    });
    expect(output).toContain(
      'DS misuse: 0/2 runs judged — run: yarn workspace agent-eval run judge:ds-misuse'
    );
  });

  it('counts partially judged runs', () => {
    const output = loggedLines([judgedRow, plainRow({ run: 2 })], {
      general: false,
      complexity: false,
      coverage: false,
      misuse: false,
    });
    expect(output).toContain(
      'DS misuse: 1/2 runs judged — run: yarn workspace agent-eval run judge:ds-misuse'
    );
  });

  it('prints nothing extra when every run is judged and --misuse is off', () => {
    const output = loggedLines([judgedRow], {
      general: false,
      complexity: false,
      coverage: false,
      misuse: false,
    });
    expect(output).not.toContain('DS misuse:');
    expect(output).not.toContain('judge:ds-misuse');
  });

  it('does not double up with the no-table-families fallback', () => {
    const output = loggedLines([plainRow({ run: 1 })], {
      general: false,
      complexity: false,
      coverage: false,
      misuse: false,
    });
    expect(output).toContain(
      'DS misuse: 0/1 runs judged — run: yarn workspace agent-eval run judge:ds-misuse'
    );
    expect(output).not.toContain('No table families selected.');
  });
});
