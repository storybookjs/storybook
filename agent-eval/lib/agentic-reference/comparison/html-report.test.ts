import { describe, expect, it } from 'vitest';

import {
  formatBeta,
  formatMetricValue,
  formatPQ,
  renderHtmlReport,
  type CurveInput,
  type DatasetRow,
  type EstimateRow,
  type ManifestJson,
} from './html-report.ts';
import type { MisusePanel } from './misuse.ts';

const CONTROL = {
  caseName: 'cc-control',
  experiment: 'agentic-ref-cc-control',
  shortName: 'control-none',
  description: 'No design-system support at all.',
};
const TREATMENT_A = {
  caseName: 'cc-a',
  experiment: 'agentic-ref-cc-a',
  shortName: 'full',
  description: 'The complete corpus.',
};
const TREATMENT_B = {
  caseName: 'cc-b',
  experiment: 'agentic-ref-cc-b',
  shortName: 'empty',
  description: 'A stripped corpus.',
};

/** The same case without its definition, as manifests from before them. */
function withoutDefinition(c: { caseName: string; experiment: string; shortName: string }): {
  caseName: string;
  experiment: string;
  shortName: string;
} {
  return { caseName: c.caseName, experiment: c.experiment, shortName: c.shortName };
}

function manifest(overrides: Partial<ManifestJson> = {}): ManifestJson {
  return {
    spec: {
      control: CONTROL,
      treatments: [TREATMENT_A, TREATMENT_B],
      workflows: ['701-new-ui-flow'],
      mode: 'single-workflow',
      minRuns: 10,
      plan: null,
    },
    metrics: [
      {
        key: 'durationSeconds',
        label: 'Duration (s)',
        path: 'speed.durationSeconds',
        family: 'speed',
        transform: 'log',
        direction: 'lower-better',
      },
      {
        key: 'slocAdded',
        label: 'SLOC added',
        path: 'diff.slocAdded',
        family: 'diff',
        transform: 'log',
        direction: 'neutral',
      },
      {
        key: 'docsCalls',
        label: 'Docs tool calls',
        path: 'toolUse.docsCalls',
        family: 'toolUse',
        transform: 'none',
        direction: 'neutral',
      },
      {
        key: 'dsShareOfAllNodes',
        label: 'DS share of all nodes',
        path: 'dsCoverage.dsShareOfAllNodes',
        family: 'dsCoverage',
        transform: 'none',
        direction: 'higher-better',
      },
    ],
    cells: [
      {
        case: 'control-none',
        workflow: '701-new-ui-flow',
        usableRuns: 10,
        passed: 10,
        failed: 0,
        unanalyzed: 0,
        superseded: 0,
      },
      {
        case: 'full',
        workflow: '701-new-ui-flow',
        usableRuns: 10,
        passed: 10,
        failed: 0,
        unanalyzed: 0,
        superseded: 3,
      },
    ],
    excludedRuns: [],
    provenance: {
      generatedAt: '2026-08-19T13:17:30.749Z',
      gitSha: 'd428141de68c0eeeb17518f3f25b046c0fa65835',
      metricsVersion: 7,
    },
    ...overrides,
  };
}

function aggregateManifest(): ManifestJson {
  const base = manifest();
  return {
    ...base,
    spec: {
      ...base.spec,
      workflows: ['701-new-ui-flow', '703-fix-bug-flow'],
      mode: 'aggregate',
    },
  };
}

function row(overrides: Partial<EstimateRow>): EstimateRow {
  return {
    metric: 'durationSeconds',
    treatment: 'full',
    scope: '701-new-ui-flow',
    context: false,
    nControl: 10,
    nTreatment: 10,
    beta: -0.2,
    se: 0.05,
    ciLow: -0.3,
    ciHigh: -0.1,
    p: 0.001,
    pctChange: -0.18,
    q: 0.01,
    verdict: 'significant',
    direction: 'lower-better',
    transform: 'log',
    anomalies: 0,
    ...overrides,
  };
}

function datasetRow(overrides: Partial<DatasetRow> = {}): DatasetRow {
  return {
    case: 'control-none',
    workflow: '701-new-ui-flow',
    values: {
      durationSeconds: 1281,
      docsCalls: 4,
      dsShareOfAllNodes: 0.465,
      slocAdded: 1200,
    },
    ...overrides,
  };
}

function render(overrides: {
  estimates?: EstimateRow[];
  manifest?: ManifestJson;
  curves?: CurveInput[];
  dataset?: DatasetRow[];
  misuse?: MisusePanel;
}): string {
  return renderHtmlReport({
    estimates: overrides.estimates ?? [row({})],
    manifest: overrides.manifest ?? manifest(),
    curves: overrides.curves ?? [],
    dataset: overrides.dataset ?? [datasetRow()],
    misuse: overrides.misuse,
  });
}

function misusePanel(overrides: Partial<MisusePanel> = {}): MisusePanel {
  return {
    guidelinesRefs: ['org/ds@abc'],
    fixtureRefs: ['org/app@ref'],
    builtFrom: '/builder/mcp',
    judgedRuns: 2,
    staleRuns: 0,
    usableRuns: 2,
    cells: [
      {
        case: 'control-none',
        workflow: '701-new-ui-flow',
        usable: 1,
        judged: 1,
        questions: {
          correctDsDecision: { ones: 3, halves: 1, zeros: 1 },
          correctDsUsage: { ones: 5, halves: 0, zeros: 0 },
          correctLocalDecision: null,
        },
        stale: 0,
        evaluated: { ds: 5, local: 0 },
        facetTallies: {},
      },
      {
        case: 'full',
        workflow: '701-new-ui-flow',
        usable: 1,
        judged: 1,
        questions: {
          correctDsDecision: { ones: 4, halves: 0, zeros: 0 },
          correctDsUsage: { ones: 4, halves: 0, zeros: 0 },
          correctLocalDecision: { ones: 2, halves: 0, zeros: 0 },
        },
        stale: 0,
        evaluated: { ds: 4, local: 2 },
        facetTallies: {},
      },
    ],
    decisions: [
      {
        case: 'control-none',
        workflow: '701-new-ui-flow',
        runLabel: '2026-08-01T00-00-00.000Z/run-1',
        file: 'src/OrderStatus.tsx',
        line: 12,
        tag: 'Badge',
        kind: 'ds',
        question: 'correctDsDecision',
        score: 0,
        reasons: [
          { text: 'Badge.mdx rules out Badge for a live status; status text was the fit.' },
        ],
        projectPath: 'agent-eval/results/x/b/701-new-ui-flow/run-1/project',
      },
    ],
    facets: [],
    ...overrides,
  };
}

describe('formatMetricValue', () => {
  it('humanizes durations into s, m, and h forms', () => {
    expect(formatMetricValue('durationSeconds', 42)).toBe('42s');
    expect(formatMetricValue('durationSeconds', 1281)).toBe('21m 21s');
    expect(formatMetricValue('durationSeconds', 3700)).toBe('1h 02m');
  });

  it('formats dollars, tokens, rates, and counts per metric', () => {
    expect(formatMetricValue('estimatedCostUsd', 9.853)).toBe('$9.85');
    expect(formatMetricValue('inputTokens', 226)).toBe('226');
    expect(formatMetricValue('outputTokens', 86000)).toBe('86.0k');
    expect(formatMetricValue('outputTokens', 1200000)).toBe('1.2M');
    expect(formatMetricValue('cacheHitRate', 0.988)).toBe('98.8%');
    expect(formatMetricValue('dsShareOfAllNodes', 0.465)).toBe('46.5%');
    expect(formatMetricValue('turns', 14.55)).toBe('14.6');
    expect(formatMetricValue('slocNet', 1342)).toBe('1,342');
  });
});

describe('formatBeta / formatPQ', () => {
  it('renders three decimals and never exponent form', () => {
    expect(formatBeta(-0.24656040212469432)).toBe('−0.247');
    expect(formatBeta(1.9000000000000006)).toBe('1.900');
    expect(formatPQ(0.0005718250301111768)).toBe('0.001');
  });

  it('floors tiny p/q values instead of using exponents', () => {
    expect(formatPQ(0.0003)).toBe('< 0.001');
    expect(formatPQ(8.577375451667651e-9)).toBe('< 0.001');
  });
});

describe('renderHtmlReport structure', () => {
  it('renders five tabs with Findings first', () => {
    const html = render({});
    const tabs = html.match(/role="tab"/g) ?? [];
    expect(tabs).toHaveLength(5);
    expect(html).toContain('>Findings<');
    expect(html).toContain('Full report');
    expect(html).toContain('DS misuse');
    expect(html).toContain('ECDF curves');
    expect(html.indexOf('id="tab-effects"')).toBeLessThan(html.indexOf('id="tab-summary"'));
    // The first panel is the visible one.
    expect(html).toMatch(/id="panel-effects" role="tabpanel" aria-labelledby="tab-effects">/);
    expect(html).toMatch(/id="panel-summary" role="tabpanel" aria-labelledby="tab-summary" hidden/);
  });

  it('places the merged Cases list before Sample in the summary tab', () => {
    const html = render({});
    expect(html.indexOf('>Cases</h2>')).toBeGreaterThan(-1);
    expect(html.indexOf('>Cases</h2>')).toBeLessThan(html.indexOf('>Sample</h2>'));
    expect(html).not.toContain('>Summary</h2>');
  });

  it('slims the sample table to runs used and highlights the control row', () => {
    const html = render({});
    expect(html).not.toContain('<th>Failed</th>');
    expect(html).not.toContain('<th>Superseded</th>');
    expect(html).not.toContain('<th>Passed</th>');
    expect(html).toContain('<th>Runs used</th>');
    expect(html).toMatch(/class="control-row"/);
    expect(html).toContain('>control<');
  });

  it('explains BH-FDR: multiple tests, false-discovery control, the q rule', () => {
    const html = render({
      estimates: [row({}), row({ treatment: 'empty', q: 0.2, verdict: 'not-significant' })],
    });
    expect(html).toContain('Benjamini');
    expect(html).toMatch(/false/i);
    expect(html).toContain('2 tests');
    expect(html).toContain('q &le; 0.05');
  });

  it('renders the statistics explainer as a plain section below Sample', () => {
    const html = render({});
    expect(html).toContain('<h2>How the statistics work</h2>');
    expect(html).not.toContain('<details class="statsbox"');
    expect(html.indexOf('>Sample</h2>')).toBeLessThan(html.indexOf('How the statistics work'));
  });

  it('renders one merged Cases definition list with verdicts and definitions', () => {
    const html = render({});
    expect(html).toContain('<dl class="deflist cases">');
    expect(html).not.toContain('deflist summary');
    // A treatment entry pairs its verdict tally with its definition.
    expect(html).toMatch(/class="caseverdicts"[\s\S]*?class="casedef"/);
  });

  it('groups the sample table by workflow with a spanning cell', () => {
    const html = render({});
    expect(html).toMatch(/<thead><tr><th>Workflow<\/th><th>Case<\/th><th>Runs used<\/th>/);
    // Two cases under the single workflow: one spanning cell, one hidden.
    expect(html).toContain('<td class="wfcell" rowspan="2">701-new-ui-flow</td>');
    expect(html).toContain('<td class="wfcell" hidden>701-new-ui-flow</td>');
    // Content-hugging, not justified across the page.
    expect(html).toMatch(/#sampleTable \{ width:auto/);
  });

  it('keeps the filter bar and tab strip sticky', () => {
    const html = render({});
    expect(html).toMatch(/\.filterbar \{[^}]*position:sticky/);
    expect(html).toMatch(/\.tabs \{[^}]*position:sticky/);
    // The tab strip sticks below the measured filter bar.
    expect(html).toContain('top:var(--tabstop');
  });

  it('uses manifest case colors when present', () => {
    const html = render({
      manifest: manifest({
        colors: {
          'control-none': { light: '#000001', dark: '#000002' },
          full: { light: '#123456', dark: '#654321' },
          empty: { light: '#0000AA', dark: '#0000BB' },
        },
      }),
    });
    expect(html).toContain('--c-full:#123456');
    expect(html).toContain('--c-full:#654321');
  });

  it('solos a chip on ctrl-click and never filters the summary list', () => {
    const html = render({});
    expect(html).toContain('ctrlKey');
    expect(html).not.toContain('.summary li[data-t]');
  });

  it('mentions equal workflow weighting only in aggregate mode', () => {
    expect(
      render({
        manifest: aggregateManifest(),
        estimates: [row({ scope: 'pooled' })],
      })
    ).toContain('every workflow equally');
    expect(render({})).not.toContain('every workflow equally');
  });

  it('groups effects into family sections with intros', () => {
    const html = render({
      estimates: [
        row({}),
        row({
          metric: 'docsCalls',
          direction: 'neutral',
          transform: 'none',
          pctChange: null,
          beta: 3.2,
        }),
      ],
    });
    expect(html).toContain('>Speed</h3>');
    expect(html).toContain('>Tool use</h3>');
    // A family with no estimates renders no section.
    expect(html).not.toContain('>Complexity</h3>');
  });

  it('never renders the degree-sign marker and states the new legend copy', () => {
    const html = render({
      estimates: [row({ verdict: 'not-significant', q: 0.2 })],
    });
    expect(html).not.toContain('&deg;');
    expect(html).not.toContain('°');
    expect(html).toContain('not significant');
    expect(html).toContain('control value');
  });

  it('prints the control value at the center line with mean and median variants', () => {
    const html = render({
      dataset: [
        datasetRow({ values: { durationSeconds: 900 } }),
        datasetRow({ values: { durationSeconds: 1600 } }),
        datasetRow({ case: 'full', values: { durationSeconds: 800 } }),
      ],
    });
    // Geometric mean of 900 and 1600 = 1200s = 20m 0s; median = 1250s.
    expect(html).toContain('data-mean="20m 00s"');
    expect(html).toContain('data-median="20m 50s"');
  });

  it('positions the dot by the selected statistic, defaulting to the mean', () => {
    const html = render({
      dataset: [
        datasetRow({ values: { durationSeconds: 900 } }),
        datasetRow({ values: { durationSeconds: 1600 } }),
        datasetRow({ case: 'full', values: { durationSeconds: 800 } }),
      ],
    });
    // Mean shift 800/1200−1 = −33.3%, median shift 800/1250−1 = −36% (the
    // widest effect, so it pins the span; range bands are clamped, not fit).
    expect(html).toContain('data-left-mean="9.3%"');
    expect(html).toContain('data-left-median="6.0%"');
    expect(html).toMatch(/class="fdot tipsrc"[^>]*style="left:9\.3%/);
  });

  it('draws the control band as a 95% CI of its mean, with an empty label cell', () => {
    const html = render({
      dataset: [
        datasetRow({ values: { durationSeconds: 900 } }),
        datasetRow({ values: { durationSeconds: 1600 } }),
      ],
    });
    expect(html).toMatch(
      /class="fsd tipsrc"[^>]*data-tip-title="control-none: 95% CI of the mean"/
    );
    expect(html).toContain('<span class="flab fsdlab">&nbsp;</span>');
    // A single usable control value cannot produce the band.
    expect(render({ dataset: [datasetRow()] })).not.toContain('class="fsd');
  });

  it('offers mean and median statistics', () => {
    const html = render({});
    expect(html).toContain('>mean<');
    expect(html).toContain('>median<');
    expect(html).toContain('data-left-median=');
    expect(html).toContain('data-tip-control-median=');
  });

  it('precomputes aggregated groups for proper workflow subsets', () => {
    const base = manifest();
    const html = render({
      manifest: {
        ...base,
        spec: {
          ...base.spec,
          workflows: ['701-a', '703-b', '706-c'],
          mode: 'aggregate' as const,
        },
      },
      estimates: [
        row({ scope: 'pooled' }),
        row({ scope: '701-a', context: true, q: null, verdict: null }),
        row({ scope: '703-b', context: true, q: null, verdict: null, beta: -0.1 }),
        row({ scope: '706-c', context: true, q: null, verdict: null, beta: -0.3 }),
      ],
    });
    for (const id of ['701-a+703-b', '701-a+706-c', '703-b+706-c']) {
      expect(html).toContain(`data-scope="${id}"`);
    }
    // Equal-weight aggregate of the −0.2 and −0.1 betas: exp(−0.15)−1 = −13.9%.
    expect(html).toContain('−13.9%');
    expect(html).toContain('aggregated over the enabled workflows');
  });

  it('carries no Range toggle: the CI is the only interval shown', () => {
    const html = render({});
    expect(html).not.toContain('range-toggle');
    expect(html).not.toContain('r-sd');
    expect(html).toContain('class="fci"');
  });

  it('falls back to the model estimate when a statistic is missing', () => {
    // No treatment rows in the dataset: both positions sit at the model effect.
    const html = render({ dataset: [datasetRow()] });
    const positions = html.match(/data-left-mean="([\d.]+)%" data-left-median="([\d.]+)%"/);
    expect(positions?.[1]).toBe(positions?.[2]);
  });

  it('attaches popover data to forest marks: absolute and percent in the title, CI alone', () => {
    const html = render({});
    // A log metric's % effect, made concrete at the control's own level:
    // 1281s × −18% ≈ −3m 51s.
    expect(html).toContain('data-tip-title="full: −3m 51s (−18.0%)"');
    expect(html).toContain('data-tip-effect="95% CI −25.9% to −9.5%"');
    expect(html).toContain('data-tip-control=');
    expect(html).toContain('data-tip-treatment=');
    expect(html).toContain('id="tip"');
  });

  it('pairs a raw effect with its relative change in the popover title', () => {
    const html = render({
      estimates: [
        row({
          metric: 'docsCalls',
          transform: 'none',
          beta: -2,
          ciLow: -3,
          ciHigh: -1,
          pctChange: null,
        }),
      ],
    });
    // −2 calls against the control mean of 4.
    expect(html).toContain('data-tip-title="full: −2.0 (−50.0%)"');
  });

  it('keeps a share metric to its single percentage-point label in the popover', () => {
    const html = render({
      estimates: [
        row({
          metric: 'dsShareOfAllNodes',
          transform: 'none',
          beta: -0.05,
          ciLow: -0.08,
          ciHigh: -0.02,
          pctChange: null,
        }),
      ],
    });
    // The delta is already in percentage points; a relative percent on top
    // would read as a typo.
    expect(html).toContain('data-tip-title="full: −5.0%"');
    expect(html).not.toContain('data-tip-title="full: −5.0% (');
  });

  it('renders the filter bar with significance select and reset button', () => {
    const html = render({});
    expect(html).toContain('id="sigFilter"');
    expect(html).toContain('id="resetFilters"');
  });

  it('renders workflow pills only in aggregate mode', () => {
    expect(render({})).not.toContain('id="wfFilter"');
    const html = render({
      manifest: aggregateManifest(),
      estimates: [
        row({ scope: 'pooled' }),
        row({
          scope: '701-new-ui-flow',
          context: true,
          q: null,
          verdict: null,
        }),
      ],
    });
    expect(html).toContain('id="wfFilter"');
    expect(html).not.toContain('<select id="wfFilter">');
    expect(html).toMatch(
      /class="chip-toggle wf-toggle" data-wf="701-new-ui-flow" aria-pressed="true"/
    );
    expect(html).toMatch(
      /class="chip-toggle wf-toggle" data-wf="703-fix-bug-flow" aria-pressed="true"/
    );
    expect(html).toContain('not FDR-tested');
    // Per-workflow groups and rows carry the workflow tag shown when several
    // workflows stack.
    expect(html).toContain('<span class="fgw">701-new-ui-flow</span>');
    expect(html).toContain('<span class="rowwf">· 701-new-ui-flow</span>');
  });

  it('renders context rows hidden, scoped to their workflow, in aggregate mode', () => {
    const html = render({
      manifest: aggregateManifest(),
      estimates: [
        row({ scope: 'pooled' }),
        row({
          scope: '703-fix-bug-flow',
          context: true,
          q: null,
          verdict: null,
          beta: -0.4,
          pctChange: -0.33,
        }),
      ],
    });
    expect(html).toContain('data-scope="703-fix-bug-flow"');
  });

  it('omits context rows entirely in single-workflow mode', () => {
    const html = render({
      estimates: [row({}), row({ context: true, verdict: null, q: null, scope: 'other-flow' })],
    });
    expect(html).not.toContain('other-flow');
  });
});

describe('renderHtmlReport definitions', () => {
  it('attaches a two-part hover definition to metric names', () => {
    const html = render({});
    // Effects rows and the full-report table both carry the tooltip.
    expect(html).toContain('class="fname mname tipsrc"');
    expect(html).toMatch(
      /<span class="mname tipsrc"[^>]*data-tip-title="Time to finish"[^>]*data-tip-effect="Wall-clock time/
    );
  });

  it('renders case definitions as a Cases section and chip tooltips', () => {
    const html = render({});
    expect(html).toContain('>Cases</h2>');
    expect(html).toContain('No design-system support at all.');
    expect(html).toMatch(/class="chip-toggle tipsrc"[^>]*data-tip-effect="The complete corpus\."/);
  });

  it('keeps the Cases list, minus definitions, for manifests without them', () => {
    const base = manifest();
    const html = render({
      manifest: {
        ...base,
        spec: {
          ...base.spec,
          control: withoutDefinition(CONTROL),
          treatments: [withoutDefinition(TREATMENT_A), withoutDefinition(TREATMENT_B)],
        },
      },
    });
    expect(html).toContain('>Cases</h2>');
    expect(html).toContain('class="caseverdicts"');
    expect(html).not.toContain('class="casedef"');
  });
});

describe('renderHtmlReport parked metrics, section nav, and URL state', () => {
  it('formats the new churn and coverage-delta metrics', () => {
    expect(formatMetricValue('meanEditsPerFile', 2.512)).toBe('2.5');
    expect(formatMetricValue('dsShareOfAllNodesDelta', 0.0053)).toBe('0.5%');
  });

  it('formats the instance-weighted coverage shares as percentages', () => {
    expect(formatMetricValue('dsShareOfAllInstances', 0.465)).toBe('46.5%');
    expect(formatMetricValue('dsShareOfComponentInstances', 0.62)).toBe('62.0%');
    expect(formatMetricValue('dsShareOfAllInstancesDelta', 0.0053)).toBe('0.5%');
    expect(formatMetricValue('dsShareOfComponentInstancesDelta', -0.021)).toBe('-2.1%');
  });

  it('tags parked metrics for the Metrics toggle to hide', () => {
    const base = manifest();
    const html = render({
      manifest: {
        ...base,
        metrics: [
          ...base.metrics,
          {
            key: 'cyclomaticDelta',
            label: 'Cyclomatic complexity Δ',
            path: 'deltaToBaseline.complexity.cyclomatic.delta',
            family: 'complexity',
            transform: 'none',
            direction: 'lower-better',
          },
        ],
      },
      estimates: [
        row({}),
        row({
          metric: 'cyclomaticDelta',
          direction: 'lower-better',
          transform: 'none',
          beta: -1.2,
          pctChange: null,
        }),
      ],
    });
    expect(html).toContain('id="metricsMode"');
    expect(html).toMatch(/<div class="frow" data-extra="1">/);
    expect(html).toMatch(/<tr[^>]*data-extra="1"/);
  });

  it('renders one fixed section-jump control in the effects tab', () => {
    const html = render({});
    expect(html.match(/class="secjump"/g)).toHaveLength(1);
    expect(html).toMatch(/class="secjump"[^>]*>\s*<button[^>]*data-dir="-1"/);
    expect(html).not.toContain('secnav');
  });

  it('renders the significance filter as pills, not a select', () => {
    const html = render({});
    expect(html).toMatch(/<span class="seg" id="sigFilter"/);
    expect(html).toMatch(/data-sig="all" aria-pressed="true"/);
    expect(html).not.toContain('<select id="sigFilter">');
  });

  it('reads and writes filter state through the URL', () => {
    const html = render({});
    expect(html).toContain('URLSearchParams');
    expect(html).toContain('history.replaceState');
    expect(html).toContain('applyUrlState()');
  });
});

describe('renderHtmlReport significance-test toggle', () => {
  it('renders the FDR/raw-p toggle defaulting to FDR', () => {
    const html = render({});
    expect(html).toContain('id="sigMode"');
    expect(html).toContain('data-sigmode="fdr"');
    expect(html).toContain('data-sigmode="naive"');
    expect(html).toMatch(/<body[^>]*data-sigmode="fdr"/);
  });

  it('encodes raw-p verdicts alongside FDR verdicts', () => {
    const html = render({
      estimates: [row({ verdict: 'not-significant', q: 0.2, p: 0.01 })],
    });
    // FDR says no, raw p says yes: both encoded on the same row.
    expect(html).toMatch(/data-sig="0" data-sig-p="1"/);
    // Dual verdict icons: FDR '?' plus a raw-p arrow.
    expect(html).toMatch(/<span class="m-fdr"><span class="vicon na tipsrc"/);
    expect(html).toMatch(/<span class="m-naive"><span class="vicon (good|bad) tipsrc"/);
  });

  it('summarizes both calls per treatment, coloring non-zero better/worse', () => {
    const html = render({
      estimates: [row({ verdict: 'not-significant', q: 0.2, p: 0.01 })],
    });
    // Four-metric grid, one pair tested: the count carries its own total.
    expect(html).toContain(
      '<span class="m-fdr">0 better · 0 worse · 0 changed · 1 not significant (1 tested)</span>'
    );
    expect(html).toContain(
      '<span class="m-naive"><span class="cgood">1 better</span> · 0 worse · 0 changed · ' +
        '0 not significant (1 tested)</span>'
    );
  });
});

describe('renderHtmlReport full report table', () => {
  it('drops the n and Verdict columns', () => {
    const html = render({});
    expect(html).toContain('<thead>');
    expect(html).not.toContain('<th>n</th>');
    expect(html).not.toContain('<th>Verdict</th>');
    expect(html).not.toContain('10 / 10');
  });

  it('explains β, p, and q in their column headers', () => {
    const html = render({});
    expect(html).toMatch(/<th[^>]*data-tip-title="β[^"]*"/);
    expect(html).toMatch(/<th[^>]*data-tip-title="p[^"]*"/);
    expect(html).toMatch(/<th[^>]*data-tip-title="q[^"]*"[^>]*data-tip-effect="[^"]*Benjamini/);
  });

  it('suffixes the effect with a verdict icon carrying a tooltip', () => {
    const html = render({
      estimates: [
        row({ verdict: 'significant', q: 0.001 }),
        row({
          treatment: 'empty',
          verdict: 'not-significant',
          q: 0.2,
          beta: 0.05,
          pctChange: 0.05,
        }),
      ],
    });
    // Significant improvement on a lower-better metric: down arrow, good color.
    expect(html).toMatch(/class="vicon good tipsrc"[^>]*data-tip-title="[^"]*better[^"]*"[^>]*>↓</);
    // Not significant: gray question mark.
    expect(html).toMatch(
      /class="vicon na tipsrc"[^>]*data-tip-title="[^"]*not significant[^"]*"[^>]*>\?</
    );
  });

  it('uses ± for significant changes of descriptive metrics', () => {
    const html = render({
      estimates: [
        row({
          metric: 'docsCalls',
          direction: 'neutral',
          transform: 'none',
          pctChange: null,
          beta: 3.2,
          verdict: 'significant',
          q: 0.01,
        }),
      ],
    });
    expect(html).toMatch(
      /class="vicon shift tipsrc"[^>]*data-tip-title="[^"]*changed[^"]*"[^>]*>±</
    );
  });

  it('marks rows whose n differs from the rest of their arm', () => {
    const html = render({
      estimates: [
        row({}),
        row({
          metric: 'slocAdded',
          direction: 'neutral',
          transform: 'log',
          nControl: 9,
          pctChange: -0.1,
        }),
      ],
    });
    expect(html).toContain('n=9/10');
  });

  it('marks non-significant rows for dimming via data-sig', () => {
    const html = render({
      estimates: [
        row({ verdict: 'significant', q: 0.001 }),
        row({
          treatment: 'empty',
          verdict: 'not-significant',
          q: 0.2,
          beta: -0.05,
          pctChange: -0.05,
        }),
      ],
    });
    expect(html).toContain('data-sig="1"');
    expect(html).toContain('data-sig="0"');
  });

  it('formats beta, p, and q to three decimals without exponents', () => {
    const html = render({
      estimates: [
        row({
          beta: -0.24656040212469432,
          p: 8.577375451667651e-5,
          q: 0.0005718250301111768,
        }),
      ],
    });
    expect(html).toContain('−0.247');
    expect(html).toContain('&lt; 0.001');
    expect(html).toContain('0.001');
    expect(html).not.toMatch(/e-\d/);
  });

  it('lists untested metric-treatment pairs', () => {
    // Four metrics x two treatments = 8 potential tests; only one ran.
    const html = render({ estimates: [row({})] });
    expect(html).toContain('Not tested');
    expect(html).toContain('docsCalls');
  });
});

describe('renderHtmlReport effect display', () => {
  it('never uses better/worse language for a neutral-direction metric', () => {
    const html = render({
      estimates: [
        row({
          metric: 'docsCalls',
          direction: 'neutral',
          transform: 'none',
          pctChange: null,
          beta: 3.2,
          ciLow: 2.9,
          ciHigh: 3.6,
        }),
      ],
    });
    expect(html).toContain('changed');
    expect(html).not.toMatch(/>better</);
    expect(html).not.toMatch(/>worse</);
  });

  it('renders log transforms as percentages and counts with one decimal', () => {
    const html = render({
      estimates: [
        row({
          metric: 'durationSeconds',
          transform: 'log',
          beta: -0.2231,
          pctChange: -0.2,
        }),
        row({
          metric: 'docsCalls',
          direction: 'neutral',
          transform: 'none',
          beta: 3.24,
          ciLow: 2.9,
          ciHigh: 3.6,
          pctChange: null,
        }),
      ],
    });
    expect(html).toContain('−20.0%');
    expect(html).toContain('+3.2');
    expect(html).not.toContain('+3.24');
  });

  it('renders share-metric effects as %, never pp', () => {
    const html = render({
      estimates: [
        row({
          metric: 'dsShareOfAllNodes',
          direction: 'higher-better',
          transform: 'none',
          beta: 0.0151,
          ciLow: 0.005,
          ciHigh: 0.025,
          pctChange: null,
        }),
      ],
    });
    expect(html).toContain('+1.5%');
    expect(html).not.toMatch(/\d ?pp/);
  });
});

describe('renderHtmlReport curves and escaping', () => {
  it('escapes treatment and metric-adjacent text into HTML', () => {
    const html = render({
      estimates: [row({ treatment: '<script>alert(1)</script>' })],
      manifest: manifest({
        spec: {
          ...manifest().spec,
          treatments: [
            {
              caseName: 'x',
              experiment: 'x',
              shortName: '<script>alert(1)</script>',
            },
            TREATMENT_B,
          ],
        },
      }),
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('drops the XML prolog, DOCTYPE, and metadata block, keeping the svg element', () => {
    const svg: CurveInput = {
      metric: 'durationSeconds',
      workflow: '701-new-ui-flow',
      svg:
        '<?xml version="1.0" encoding="utf-8" standalone="no"?>\n' +
        '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="504pt" height="324pt">\n' +
        ' <metadata>\n  <rdf:RDF>irrelevant</rdf:RDF>\n </metadata>\n' +
        ' <rect width="1" height="1"/>\n</svg>\n',
    };
    const html = render({ curves: [svg] });
    expect(html).not.toContain('<?xml');
    expect(html).not.toContain('<!DOCTYPE svg');
    expect(html).not.toContain('<metadata>');
    expect(html).not.toContain('irrelevant');
    expect(html).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="504pt" height="324pt">');
    expect(html).toContain('<rect width="1" height="1"/>');
  });

  it('tags curve panels with their workflow for filtering', () => {
    const svg: CurveInput = {
      metric: 'durationSeconds',
      workflow: '701-new-ui-flow',
      svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    };
    const html = render({ curves: [svg] });
    expect(html).toContain('data-workflow="701-new-ui-flow"');
  });
});

describe('DS misuse panel', () => {
  it('renders an empty state naming the judge command when nothing is judged', () => {
    const html = render({});
    expect(html).toContain('DS misuse');
    expect(html).toContain('No run in this comparison has been judged yet');
    expect(html).toContain('yarn judge:ds-misuse --dry');
  });

  it('names the plan in the empty state when the comparison was plan-scoped', () => {
    const planned = manifest();
    planned.spec.plan = 'plans/2-docs-vs-stories-create.plan.ts';
    const html = render({ manifest: planned });
    expect(html).toContain('--plan plans/2-docs-vs-stories-create.plan.ts');
  });

  it('renders pooled distributions per case with null as absence, not zero', () => {
    const html = render({ misuse: misusePanel() });
    expect(html).toContain('misuse-summary');
    expect(html).toContain('Right component?');
    // control-none evaluated no local components: an em dash, never a bar.
    expect(html).toContain('No node received this question');
  });

  it("shows each finding with its score, location, and the judge's reason", () => {
    const html = render({ misuse: misusePanel() });
    expect(html).toContain('What the judge flagged');
    expect(html).toContain('src/OrderStatus.tsx:12');
    // The citation is linkified, so match around the anchor.
    expect(html).toContain('rules out Badge for a live status');
    expect(html).toContain('>Badge.mdx</a>');
  });

  it('celebrates a clean bundle instead of rendering an empty findings list', () => {
    const html = render({ misuse: misusePanel({ decisions: [] }) });
    expect(html).toContain('Every judged node scored 1');
  });

  it('links below-perfect counts to the findings they count', () => {
    const html = render({ misuse: misusePanel() });
    // The control-none decision cell has 1 half and 1 zero: both become
    // buttons carrying the finding's full identity for the modal.
    expect(html).toContain(
      'class="mjump s0" data-case="control-none" data-case-name="control-none" ' +
        'data-workflow="701-new-ui-flow" data-q="correctDsDecision" ' +
        'data-qlabel="Right component?" data-score="0"'
    );
    // The finding carries the matching identity so the click can collect it.
    expect(html).toContain('data-case="control-none" data-q="correctDsDecision" data-score="0"');
    // A zero count stays plain text — there is nothing to show.
    expect(html).toContain('<b class="s0">0</b>');
    // The dialog the counts open ships with the panel.
    expect(html).toContain('<dialog class="misuse-modal" id="misuseModal">');
  });

  it('links reason citations to the pinned docs and the DS repo issues', () => {
    const html = render({
      misuse: misusePanel({
        decisions: [
          {
            ...misusePanel().decisions[0]!,
            reasons: [{ text: 'Badge.mdx and BrandGuidelines rule this out; see #268.' }],
          },
        ],
      }),
    });
    expect(html).toContain('https://github.com/org/ds/issues/268');
    expect(html).toContain('https://github.com/org/ds/blob/abc/src/components/Badge/Badge.mdx');
    expect(html).toContain('https://github.com/org/ds/blob/abc/src/docs/BrandGuidelines.mdx');
  });

  it('gives each finding a commands button and ships the commands dialog', () => {
    const html = render({ misuse: misusePanel() });
    expect(html).toContain('class="mopen mcmds" data-project=');
    expect(html).toContain('id="misuseCmdModal"');
  });

  it('warns when artifacts were judged against different guideline pins', () => {
    const html = render({
      misuse: misusePanel({ guidelinesRefs: ['org/ds@new', 'org/ds@old'] }),
    });
    expect(html).toContain('Mixed guideline pins');
  });

  it('flags partial judging coverage instead of passing it off as complete', () => {
    const html = render({ misuse: misusePanel({ judgedRuns: 1, usableRuns: 2 }) });
    expect(html).toContain('1 of 2');
  });
});
