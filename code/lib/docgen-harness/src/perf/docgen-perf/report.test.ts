import { describe, expect, it } from 'vitest';

import { renderComparisons, renderResults } from './report.ts';
import type { EngineResult, ScenarioResult, SuiteResults } from './types.ts';

const block = (lines: string[]) => lines.join('\n');

function scenario(cold = 10, warm = 2, scan?: number): ScenarioResult {
  return {
    params: {},
    repetitions: [
      {
        cold: { durationMs: cold, members: 10 },
        warm: [{ save: 1, durationMs: warm, members: 2 }],
        ...(scan === undefined ? {} : { scan: { durationMs: scan, members: 10 } }),
      },
    ],
    summary: {
      cold: { processSamplesMs: [cold], medianMs: cold },
      warm: { processSamplesMs: [warm], medianMs: warm },
      ...(scan === undefined ? {} : { scan: { processSamplesMs: [scan], medianMs: scan } }),
    },
  };
}

const measured = (scenarios: Record<string, ScenarioResult>): EngineResult => ({
  status: 'measured',
  scenarios,
});

describe('renderResults', () => {
  it('renders latency-only process summaries and operational statuses', () => {
    const { table, statusLines } = renderResults(
      ['react-legacy', 'compodoc', 'vue-docgen-api', 'vue-component-meta'],
      {
        'react-legacy': measured({ default: scenario(12.34, 1.23) }),
        compodoc: measured({ default: scenario(80, 75, 80) }),
        'vue-docgen-api': { status: 'skipped', reason: 'not installed' },
        'vue-component-meta': { status: 'failed', reason: 'child failed\nstack' },
      }
    );
    expect(block(table)).toMatchInlineSnapshot(`
      "  engine/scenario       cold    warm trajectory  scan    processes
        react-legacy/default  12.3ms  1.2ms            n/a     1
        compodoc/default      80.0ms  75.0ms           80.0ms  1"
    `);
    expect(block(statusLines)).toMatchInlineSnapshot(`
      "  vue-docgen-api: SKIPPED - not installed
        vue-component-meta: FAILED - child failed"
    `);
  });

  it('renders every scenario and the header alone when none measured', () => {
    expect(
      block(
        renderResults(['vue-component-meta'], {
          'vue-component-meta': measured({ flat: scenario(), workspace: scenario() }),
        }).table
      )
    ).toContain('vue-component-meta/workspace');
    expect(
      block(
        renderResults(['compodoc'], { compodoc: { status: 'skipped', reason: 'missing' } }).table
      )
    ).toBe('  engine/scenario  cold  warm trajectory  scan  processes');
  });
});

describe('renderComparisons', () => {
  it('renders a paired estimate with work and gate status', () => {
    const comparisons: SuiteResults['comparisons'] = {
      'vue-component-meta-version': {
        mode: 'paired-gate',
        control: 'vue-component-meta',
        candidate: 'vue-component-meta-next',
        controlVersion: '3.3.9',
        candidateVersion: '3.3.8',
        scenarios: {
          flat: {
            seed: 42,
            blocks: [],
            cold: {
              work: { status: 'same-work', reason: 'matching-signatures' },
              effect: {
                status: 'measured',
                pairs: 10,
                logRatios: [],
                meanLogRatio: 0,
                standardError: 0,
                criticalValue95: 2.26,
                candidateOverControl: { estimate: 1.02, lower95: 0.98, upper95: 1.06 },
              },
              gate: {
                status: 'inconclusive',
                maxRegression: 0.05,
                maxCandidateOverControl: 1.05,
              },
            },
            warm: {
              work: { status: 'same-work', reason: 'matching-signatures' },
              gate: { status: 'not-configured' },
            },
          },
        },
      },
    };
    expect(block(renderComparisons(comparisons))).toMatchInlineSnapshot(`
      "  vue-component-meta-version/flat cold: candidate/control=1.020 95%=[0.980,1.060] pairs=10 work=same-work(matching-signatures) versions=3.3.9/3.3.8 gate=inconclusive limit=1.050
        vue-component-meta-version/flat warm: work=same-work(matching-signatures) versions=3.3.9/3.3.8 gate=not-configured"
    `);
  });

  it('keeps unknown work effect-free and explains an empty comparison set', () => {
    const comparisons: SuiteResults['comparisons'] = {
      react: {
        mode: 'descriptive',
        control: 'react-legacy',
        candidate: 'react-osa',
        scenarios: {
          default: {
            blocks: [],
            cold: {
              work: { status: 'unknown-work', reason: 'missing-signature' },
              gate: { status: 'not-configured' },
            },
            warm: {
              work: { status: 'unknown-work', reason: 'missing-signature' },
              gate: { status: 'not-configured' },
            },
          },
        },
      },
    };
    expect(block(renderComparisons(comparisons))).not.toContain('candidate/control');
    expect(block(renderComparisons({}))).toBe(
      '  no comparison: both sides of a configured pair must measure'
    );
  });
});
