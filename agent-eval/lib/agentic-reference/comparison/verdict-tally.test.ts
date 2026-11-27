import { describe, expect, it } from 'vitest';

import { isBetter, tallyVerdicts } from './verdict-tally.ts';

import type { EstimateRow } from './html-report.ts';

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

describe('isBetter', () => {
  it('is true for a negative beta on a lower-better metric', () => {
    expect(isBetter(-0.2, 'lower-better')).toBe(true);
    expect(isBetter(0.2, 'lower-better')).toBe(false);
  });

  it('is true for a positive beta on a higher-better metric', () => {
    expect(isBetter(0.2, 'higher-better')).toBe(true);
    expect(isBetter(-0.2, 'higher-better')).toBe(false);
  });
});

describe('tallyVerdicts', () => {
  const isSig = (r: EstimateRow) => r.verdict === 'significant';

  it('splits significant rows into better and worse by direction', () => {
    const rows = [
      row({ metric: 'durationSeconds', direction: 'lower-better', beta: -0.2 }),
      row({ metric: 'outputTokens', direction: 'lower-better', beta: 0.3 }),
      row({ metric: 'passRate', direction: 'higher-better', beta: 0.4 }),
    ];
    const { better, worse } = tallyVerdicts(rows, isSig);
    expect(better.map((r) => r.metric)).toEqual(['durationSeconds', 'passRate']);
    expect(worse.map((r) => r.metric)).toEqual(['outputTokens']);
  });

  it('buckets non-significant rows as inconclusive rather than better/worse', () => {
    const rows = [row({ verdict: 'not-significant' }), row({ verdict: null })];
    const tally = tallyVerdicts(rows, isSig);
    expect(tally.better).toEqual([]);
    expect(tally.worse).toEqual([]);
    expect(tally.inconclusive).toHaveLength(2);
  });

  it('buckets significant neutral-direction rows as changed, not better/worse', () => {
    const rows = [row({ direction: 'neutral', beta: 3.2 })];
    const tally = tallyVerdicts(rows, isSig);
    expect(tally.better).toEqual([]);
    expect(tally.worse).toEqual([]);
    expect(tally.changed).toHaveLength(1);
  });

  it('uses a caller-supplied value instead of beta when given one', () => {
    // beta is negative (would read as better on a lower-better metric) but
    // the caller's display-scale value disagrees in sign.
    const rows = [row({ direction: 'lower-better', beta: -0.2 })];
    const tally = tallyVerdicts(rows, isSig, () => 0.5);
    expect(tally.better).toEqual([]);
    expect(tally.worse).toHaveLength(1);
  });
});
