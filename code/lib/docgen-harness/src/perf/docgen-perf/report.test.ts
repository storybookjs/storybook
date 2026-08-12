import { describe, expect, it } from 'vitest';

import { renderRatios, renderResults } from './report.ts';
import { type EngineMetrics, type EngineResult, NOT_APPLICABLE, type Ratios } from './types.ts';

/**
 * The report is read as a block of terminal output, not as an array of strings, so the snapshots
 * below join it back into one. Column alignment and the notes that travel beside a ratio are the
 * whole point of this module, and neither survives a per-line assertion.
 */
const block = (lines: string[]) => lines.join('\n');

/** A series engine: per-component, so it has no whole-project scan. */
const seriesMetrics: EngineMetrics = {
  coldExtractionMs: { status: 'measured', samples: [1204, 1180, 1191], value: 1191 },
  warmExtractionMs: { status: 'measured', samples: [42.4, 39.8, 41.1], value: 41.1 },
  wholeProjectScanMs: NOT_APPLICABLE,
  peakTransientMb: { status: 'measured', samples: [61, 58, 63], value: 60.7 },
  retainedGrowthMb: { status: 'measured', value: 12.4 },
  retainedSlopeMbPerSave: { status: 'measured', value: 0.62 },
};

/** A one-shot CLI engine: a fresh process per run, so no retained series to report. */
const oneShotMetrics: EngineMetrics = {
  coldExtractionMs: { status: 'measured', samples: [8420, 8110, 8300], value: 8300 },
  warmExtractionMs: { status: 'measured', samples: [8290, 8050, 8180], value: 8180 },
  wholeProjectScanMs: { status: 'measured', samples: [8420, 8110, 8300], value: 8300 },
  peakTransientMb: { status: 'measured', samples: [980, 1010, 995], value: 995 },
  retainedGrowthMb: NOT_APPLICABLE,
  retainedSlopeMbPerSave: NOT_APPLICABLE,
};

const measured = (metrics: EngineMetrics): EngineResult => ({
  status: 'measured',
  scenarios: { default: { params: {}, metrics } },
});

describe('renderRatios', () => {
  it('spells out which side documented more, on the cold line and the warm one', () => {
    // The warm line needs the note more than the cold one: the legacy Vue parser documents nothing
    // on the save it is timed on, so a bare 22.50 would read as a clean win over identical work.
    expect(
      block(
        renderRatios({
          vue: {
            flat: {
              legacyEngine: 'vue-docgen-api',
              nextEngine: 'vue-component-meta',
              cold: 18.48,
              warm: 22.5,
              legacyColdMembers: 6,
              nextColdMembers: 320,
              legacyWarmMembers: 0,
              nextWarmMembers: 32,
              coldComparability: 'next-documents-more',
              warmComparability: 'next-documents-more',
            },
          },
        })
      )
    ).toMatchInlineSnapshot(`
      "  each ratio divides the first engine's median by the second's, so above 1.00 means the second is faster
        ratio cold (vue-docgen-api over vue-component-meta, flat): 18.48  [documented members 6 vs 320 - NOT like-for-like - new engine documented more, so this ratio undersells it]
        ratio warm (vue-docgen-api over vue-component-meta, flat): 22.50  [documented members 0 vs 32 - NOT like-for-like - new engine documented more, so this ratio undersells it]"
    `);
  });

  it('reads a ratio the other way when the new engine documented less', () => {
    // The same shape of mismatch, the opposite meaning: this one is fast for the wrong reason.
    expect(
      block(
        renderRatios({
          vue: {
            flat: {
              legacyEngine: 'vue-docgen-api',
              nextEngine: 'vue-component-meta',
              cold: 0.05,
              legacyColdMembers: 320,
              nextColdMembers: 6,
              coldComparability: 'next-documents-less',
              warmComparability: 'unknown',
            },
          },
        })
      )
    ).toMatchInlineSnapshot(
      `
      "  each ratio divides the first engine's median by the second's, so above 1.00 means the second is faster
        ratio cold (vue-docgen-api over vue-component-meta, flat): 0.05  [documented members 320 vs 6 - NOT like-for-like - new engine documented less, so it is fast for the wrong reason]"
    `
    );
  });

  it('warns when the counts agree but the resolution work did not', () => {
    // Equal member counts off unequal work, which is the case a count alone cannot see.
    expect(
      block(
        renderRatios({
          vue: {
            flat: {
              legacyEngine: 'vue-docgen-api',
              nextEngine: 'vue-component-meta',
              cold: 4.1,
              legacyColdMembers: 90,
              nextColdMembers: 90,
              coldComparability: 'next-resolves-less',
              warmComparability: 'like-for-like',
            },
          },
        })
      )
    ).toMatchInlineSnapshot(
      `
      "  each ratio divides the first engine's median by the second's, so above 1.00 means the second is faster
        ratio cold (vue-docgen-api over vue-component-meta, flat): 4.10  [documented members 90 vs 90 - NOT like-for-like - same members, but the new engine left more types unresolved]"
    `
    );
  });

  it('prints the counts without a warning when both sides did the same work', () => {
    expect(
      block(
        renderRatios({
          vue: {
            flat: {
              legacyEngine: 'vue-docgen-api',
              nextEngine: 'vue-component-meta',
              cold: 1.2,
              warm: 1.1,
              legacyColdMembers: 50,
              nextColdMembers: 50,
              coldComparability: 'like-for-like',
              warmComparability: 'like-for-like',
            },
          },
        })
      )
    ).toMatchInlineSnapshot(`
      "  each ratio divides the first engine's median by the second's, so above 1.00 means the second is faster
        ratio cold (vue-docgen-api over vue-component-meta, flat): 1.20  [documented members 50 vs 50]
        ratio warm (vue-docgen-api over vue-component-meta, flat): 1.10"
    `);
  });

  it('prints a bare ratio when neither engine reports member counts', () => {
    // Unknown earns no warning: it is not a claim of inequality, only an absence of counts.
    expect(
      block(
        renderRatios({
          react: {
            default: {
              legacyEngine: 'react-legacy',
              nextEngine: 'react-osa',
              cold: 4,
              warm: 2,
              coldComparability: 'unknown',
              warmComparability: 'unknown',
            },
          },
        })
      )
    ).toMatchInlineSnapshot(`
      "  each ratio divides the first engine's median by the second's, so above 1.00 means the second is faster
        ratio cold (react-legacy over react-osa, default): 4.00
        ratio warm (react-legacy over react-osa, default): 2.00"
    `);
  });

  it('renders every scenario of every pair', () => {
    const ratios: Ratios = {
      react: {
        default: {
          legacyEngine: 'react-legacy',
          nextEngine: 'react-osa',
          cold: 3.9,
          warm: 2.1,
          coldComparability: 'unknown',
          warmComparability: 'unknown',
        },
      },
      vue: {
        flat: {
          legacyEngine: 'vue-docgen-api',
          nextEngine: 'vue-component-meta',
          cold: 18.5,
          coldComparability: 'unknown',
          warmComparability: 'unknown',
        },
        workspace: {
          legacyEngine: 'vue-docgen-api',
          nextEngine: 'vue-component-meta',
          cold: 21.2,
          coldComparability: 'unknown',
          warmComparability: 'unknown',
        },
      },
    };
    expect(block(renderRatios(ratios))).toMatchInlineSnapshot(`
      "  each ratio divides the first engine's median by the second's, so above 1.00 means the second is faster
        ratio cold (react-legacy over react-osa, default): 3.90
        ratio warm (react-legacy over react-osa, default): 2.10
        ratio cold (vue-docgen-api over vue-component-meta, flat): 18.50
        ratio cold (vue-docgen-api over vue-component-meta, workspace): 21.20"
    `);
  });

  it('says so when there is no ratio at all', () => {
    expect(block(renderRatios({}))).toMatchInlineSnapshot(
      `"  no calibration ratio: it needs both sides of a control pair measured in one run"`
    );
  });

  it('says a pair measured nothing when both sides resolved the same version', () => {
    // A range on the current side is enough to let both land on one release. The ratio is then 1.00
    // against itself, which is the one failure a version pair must never report as a clean result.
    expect(
      block(
        renderRatios({
          'vue-component-meta-version': {
            flat: {
              legacyEngine: 'vue-docgen-api',
              nextEngine: 'vue-component-meta',
              cold: 1.0,
              legacyVersion: '3.3.8',
              nextVersion: '3.3.8',
              coldComparability: 'like-for-like',
              warmComparability: 'like-for-like',
            },
          },
        })
      )
    ).toMatchInlineSnapshot(
      `
      "  each ratio divides the first engine's median by the second's, so above 1.00 means the second is faster
        ratio cold (vue-docgen-api over vue-component-meta, flat): 1.00  [both sides resolved 3.3.8 - NOT a comparison]"
    `
    );
  });

  it('carries the versions onto the warm line as well as the cold one', () => {
    expect(
      block(
        renderRatios({
          'vue-component-meta-version': {
            flat: {
              legacyEngine: 'vue-docgen-api',
              nextEngine: 'vue-component-meta',
              cold: 1.08,
              warm: 0.97,
              legacyColdMembers: 320,
              nextColdMembers: 320,
              legacyVersion: '3.3.2',
              nextVersion: '3.3.8',
              coldComparability: 'like-for-like',
              warmComparability: 'unknown',
            },
          },
        })
      )
    ).toMatchInlineSnapshot(`
      "  each ratio divides the first engine's median by the second's, so above 1.00 means the second is faster
        ratio cold (vue-docgen-api over vue-component-meta, flat): 1.08  [documented members 320 vs 320]  [3.3.2 vs 3.3.8]
        ratio warm (vue-docgen-api over vue-component-meta, flat): 0.97  [3.3.2 vs 3.3.8]"
    `);
  });
});

describe('renderResults', () => {
  it('renders the table every run ends with', () => {
    // One engine of each kind, plus a skip and a failure, because the column widths are computed
    // across the whole table and a status line replaces a row rather than joining one.
    const { table, statusLines } = renderResults(
      ['react-legacy', 'react-osa', 'compodoc', 'vue-docgen-api', 'vue-component-meta'],
      {
        'react-legacy': measured(seriesMetrics),
        'react-osa': measured(seriesMetrics),
        compodoc: measured(oneShotMetrics),
        'vue-docgen-api': { status: 'skipped', reason: 'vue-docgen-api did not resolve' },
        'vue-component-meta': {
          status: 'failed',
          reason: 'child exited with status 1:\n    at createChecker (vue-component-meta)',
        },
      }
    );
    expect(block(table)).toMatchInlineSnapshot(`
      "  engine/scenario       cold    warm    scan    peak     ret-growth  ret-slope
        react-legacy/default  1191ms  41ms    n/a     60.7MB   12.4MB      0.62MB/save
        react-osa/default     1191ms  41ms    n/a     60.7MB   12.4MB      0.62MB/save
        compodoc/default      8300ms  8180ms  8300ms  995.0MB  n/a         n/a"
    `);
    // Only the first line of a reason: a stack trace would push the table off the screen.
    expect(block(statusLines)).toMatchInlineSnapshot(`
      "  vue-docgen-api: SKIPPED - vue-docgen-api did not resolve
        vue-component-meta: FAILED - child exited with status 1:"
    `);
  });

  it('renders one engine with several scenarios as a row each', () => {
    const { table } = renderResults(['vue-component-meta'], {
      'vue-component-meta': {
        status: 'measured',
        scenarios: {
          flat: { params: {}, metrics: seriesMetrics },
          workspace: { params: {}, metrics: seriesMetrics },
          'base-type-touch': { params: {}, metrics: seriesMetrics },
        },
      },
    });
    expect(block(table)).toMatchInlineSnapshot(`
      "  engine/scenario                     cold    warm  scan  peak    ret-growth  ret-slope
        vue-component-meta/flat             1191ms  41ms  n/a   60.7MB  12.4MB      0.62MB/save
        vue-component-meta/workspace        1191ms  41ms  n/a   60.7MB  12.4MB      0.62MB/save
        vue-component-meta/base-type-touch  1191ms  41ms  n/a   60.7MB  12.4MB      0.62MB/save"
    `);
  });

  it('renders the header alone when nothing measured', () => {
    const { table, statusLines } = renderResults(['compodoc'], {
      compodoc: { status: 'skipped', reason: '@compodoc/compodoc did not resolve' },
    });
    expect(block(table)).toMatchInlineSnapshot(
      `"  engine/scenario  cold  warm  scan  peak  ret-growth  ret-slope"`
    );
    expect(block(statusLines)).toMatchInlineSnapshot(
      `"  compodoc: SKIPPED - @compodoc/compodoc did not resolve"`
    );
  });
});
