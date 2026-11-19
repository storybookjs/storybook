import { describe, expect, it } from 'vitest';

import { COMPARISON_METRICS, metricValueAt } from './comparison-metrics.ts';

describe('COMPARISON_METRICS', () => {
  it('has 52 unique keys and unique paths', () => {
    expect(COMPARISON_METRICS).toHaveLength(52);
    expect(new Set(COMPARISON_METRICS.map((m) => m.key)).size).toBe(52);
    expect(new Set(COMPARISON_METRICS.map((m) => m.path)).size).toBe(52);
  });

  it('corrects environment-setup calls alongside its sibling tool-use metrics', () => {
    // Not a side family: the taxonomy change that introduced this bucket also
    // moved counts out of editCalls and verificationCalls, so the old
    // q-values were stale either way and the family is edited deliberately.
    const metric = COMPARISON_METRICS.find((m) => m.key === 'environmentCalls');
    expect(metric).toMatchObject({
      path: 'toolUse.buckets.environment',
      family: 'toolUse',
      direction: 'neutral',
      correctionGroup: 'confirmatory',
    });
  });

  it('reads the 2026-08-20 additions from fields the analyzers always wrote', () => {
    const paths = new Map(COMPARISON_METRICS.map((m) => [m.key, m.path]));
    expect(paths.get('meanEditsPerFile')).toBe('churn.meanEditsPerFile');
    expect(paths.get('maxEditsPerFile')).toBe('churn.maxEditsPerFile');
    expect(paths.get('dsShareOfAllNodesDelta')).toBe(
      'deltaToBaseline.coverageDelta.dsShareOfAllNodes.delta'
    );
    expect(paths.get('dsShareOfComponentNodesDelta')).toBe(
      'deltaToBaseline.coverageDelta.dsShareOfComponentNodes.delta'
    );
  });

  it('reads the instance-weighted shares from the census aggregates of metricsVersion 8+', () => {
    const paths = new Map(COMPARISON_METRICS.map((m) => [m.key, m.path]));
    expect(paths.get('dsShareOfAllInstances')).toBe('dsCoverage.instances.dsShareOfAllNodes');
    expect(paths.get('dsShareOfComponentInstances')).toBe(
      'dsCoverage.instances.dsShareOfComponentNodes'
    );
    expect(paths.get('dsShareOfAllInstancesDelta')).toBe(
      'deltaToBaseline.coverageDelta.instances.dsShareOfAllNodes.delta'
    );
    expect(paths.get('dsShareOfComponentInstancesDelta')).toBe(
      'deltaToBaseline.coverageDelta.instances.dsShareOfComponentNodes.delta'
    );
  });

  it('only applies log to strictly-positive continuous metrics', () => {
    const logKeys = COMPARISON_METRICS.filter((m) => m.transform === 'log').map((m) => m.key);
    expect(logKeys.sort()).toEqual([
      'durationSeconds',
      'estimatedCostUsd',
      'inputTokens',
      'outputTokens',
    ]);
    const log0Keys = COMPARISON_METRICS.filter((m) => m.transform === 'log0').map((m) => m.key);
    expect(log0Keys).toEqual([]);
  });

  it('splits correction groups conservatively', () => {
    const confirmatory = COMPARISON_METRICS.filter((m) => m.correctionGroup === 'confirmatory');
    const facets = COMPARISON_METRICS.filter(
      (m) => m.correctionGroup === 'exploratory-misuse-facets'
    );
    // 28 pre-facet metrics plus environmentCalls, admitted deliberately on
    // 2026-08-31: the metricsVersion 9 taxonomy change already re-valued its
    // sibling tool-use metrics, so this was a family edit, not a side effect.
    // Plus the four instance-weighted coverage shares, admitted deliberately
    // on 2026-08-31: they are the headline shares of metricsVersion 8+, which
    // the registry had lagged behind.
    expect(confirmatory).toHaveLength(33);
    expect(confirmatory.some((m) => m.key === 'environmentCalls')).toBe(true);
    expect(confirmatory.some((m) => m.key === 'dsShareOfAllInstances')).toBe(true);
    expect(facets).toHaveLength(19);
    expect(facets.every((m) => m.family === 'dsMisuseFacets')).toBe(true);
    expect(facets.every((m) => m.transform === 'none')).toBe(true);
    const keys = facets.map((m) => m.key);
    expect(keys).toContain('dsMisuseFacet_mdx_do_dont');
    expect(keys).toContain('dsMisuseFacet_general_general_tokens');
    expect(keys).toContain('dsMisuseFacet_uncategorised');
  });
});

describe('metricValueAt', () => {
  const analysis = {
    speed: { durationSeconds: 227.4 },
    deltaToBaseline: { complexity: { cognitive: { delta: -2 } } },
    toolUse: null,
  };

  it('reads a nested numeric leaf', () => {
    expect(metricValueAt(analysis, 'speed.durationSeconds')).toBe(227.4);
    expect(metricValueAt(analysis, 'deltaToBaseline.complexity.cognitive.delta')).toBe(-2);
  });

  it('returns null for missing segments, null branches, and non-numbers', () => {
    expect(metricValueAt(analysis, 'speed.nope')).toBeNull();
    expect(metricValueAt(analysis, 'toolUse.buckets.docs')).toBeNull();
    expect(metricValueAt({ a: 'x' }, 'a')).toBeNull();
    expect(metricValueAt({ a: Number.NaN }, 'a')).toBeNull();
  });
});
