import {
  describeFacet,
  facetMetricKey,
  MISUSE_FACET_IDS,
  UNCATEGORISED,
  type FacetId,
} from './facets.ts';

// The curated metric registry for results:compare.
export type MetricTransform = 'log' | 'log0' | 'none';
export type MetricDirection = 'lower-better' | 'higher-better' | 'neutral';

/**
 * BH correction group. 'confirmatory' is the headline family: moving a metric
 * in or out changes every existing q-value in that group, so the partition is
 * edited deliberately, never as a side effect of adding metrics. (Last edit:
 * 2026-08-31, environmentCalls and the four instance-weighted coverage shares —
 * the taxonomy change behind the former re-valued its sibling tool-use metrics
 * anyway, so the family was re-based, not perturbed; the latter are the
 * headline shares of metricsVersion 8+, which this registry had lagged behind.)
 * Facet metrics are exploratory drill-downs of the misuse composite and are
 * corrected among themselves.
 */
export type CorrectionGroup = 'confirmatory' | 'exploratory-misuse-facets';

export interface ComparisonMetric {
  /** Unique id; doubles as the dataset.csv column name. */
  key: string;
  label: string;
  /** Dot-path into a run's analysis.json. */
  path: string;
  family:
    | 'speed'
    | 'cost'
    | 'toolUse'
    | 'churn'
    | 'dsCoverage'
    | 'dsMisuse'
    | 'dsMisuseFacets'
    | 'complexity'
    | 'diff';
  /** log requires y > 0 (violations become reported missing values); log0 maps log(0) to 0. */
  transform: MetricTransform;
  direction: MetricDirection;
  correctionGroup: CorrectionGroup;
}

const CONFIRMATORY_METRICS: Omit<ComparisonMetric, 'correctionGroup'>[] = [
  {
    key: 'durationSeconds',
    label: 'Duration (s)',
    path: 'speed.durationSeconds',
    family: 'speed',
    transform: 'log',
    direction: 'lower-better',
  },
  {
    key: 'turns',
    label: 'Turns',
    path: 'speed.turns',
    family: 'speed',
    transform: 'none',
    direction: 'lower-better',
  },
  {
    key: 'estimatedCostUsd',
    label: 'Cost (USD)',
    path: 'cost.estimatedCostUsd',
    family: 'cost',
    transform: 'log',
    direction: 'lower-better',
  },
  {
    key: 'inputTokens',
    label: 'Input tokens',
    path: 'cost.inputTokens',
    family: 'cost',
    transform: 'log',
    direction: 'lower-better',
  },
  {
    key: 'outputTokens',
    label: 'Output tokens',
    path: 'cost.outputTokens',
    family: 'cost',
    transform: 'log',
    direction: 'lower-better',
  },
  {
    key: 'cacheHitRate',
    label: 'Cache hit rate',
    path: 'cost.cacheHitRate',
    family: 'cost',
    transform: 'none',
    direction: 'higher-better',
  },
  {
    key: 'totalToolCalls',
    label: 'Tool calls',
    path: 'cost.totalToolCalls',
    family: 'cost',
    transform: 'none',
    direction: 'lower-better',
  },
  {
    key: 'docsCalls',
    label: 'Docs tool calls',
    path: 'toolUse.buckets.docs',
    family: 'toolUse',
    transform: 'none',
    direction: 'neutral',
  },
  {
    key: 'explorationCalls',
    label: 'Exploration tool calls',
    path: 'toolUse.buckets.exploration',
    family: 'toolUse',
    transform: 'none',
    direction: 'neutral',
  },
  {
    key: 'editCalls',
    label: 'Edit tool calls',
    path: 'toolUse.buckets.edit',
    family: 'toolUse',
    transform: 'none',
    direction: 'neutral',
  },
  {
    key: 'verificationCalls',
    label: 'Verification tool calls',
    path: 'toolUse.buckets.verification',
    family: 'toolUse',
    transform: 'none',
    direction: 'neutral',
  },
  {
    // Sandbox provisioning (apt-get, playwright install, …): the browser
    // bootstrap detour behind most duration outliers, measured apart so it
    // can be seen instead of leaking into exploration and verification.
    key: 'environmentCalls',
    label: 'Environment-setup tool calls',
    path: 'toolUse.buckets.environment',
    family: 'toolUse',
    transform: 'none',
    direction: 'neutral',
  },
  {
    key: 'filesEdited',
    label: 'Files edited',
    path: 'churn.filesEdited',
    family: 'churn',
    transform: 'none',
    direction: 'lower-better',
  },
  {
    key: 'meanEditsPerFile',
    label: 'Mean edits per file',
    path: 'churn.meanEditsPerFile',
    family: 'churn',
    transform: 'none',
    direction: 'lower-better',
  },
  {
    key: 'maxEditsPerFile',
    label: 'Max edits per file',
    path: 'churn.maxEditsPerFile',
    family: 'churn',
    transform: 'none',
    direction: 'lower-better',
  },
  {
    // Instance-weighted shares (metricsVersion 8+): each element counts once
    // per estimated render of its owner, so markup inside a component used in
    // ten places weighs ten times its single source appearance. These are the
    // headline coverage numbers; the node shares below keep the source-level
    // view where every element counts once.
    key: 'dsShareOfAllInstances',
    label: 'DS share of all instances',
    path: 'dsCoverage.instances.dsShareOfAllNodes',
    family: 'dsCoverage',
    transform: 'none',
    direction: 'higher-better',
  },
  {
    key: 'dsShareOfComponentInstances',
    label: 'DS share of component instances',
    path: 'dsCoverage.instances.dsShareOfComponentNodes',
    family: 'dsCoverage',
    transform: 'none',
    direction: 'higher-better',
  },
  {
    key: 'dsShareOfAllNodes',
    label: 'DS share of all nodes',
    path: 'dsCoverage.dsShareOfAllNodes',
    family: 'dsCoverage',
    transform: 'none',
    direction: 'higher-better',
  },
  {
    key: 'dsShareOfComponentNodes',
    label: 'DS share of component nodes',
    path: 'dsCoverage.dsShareOfComponentNodes',
    family: 'dsCoverage',
    transform: 'none',
    direction: 'higher-better',
  },
  {
    key: 'dsShareOfAllInstancesDelta',
    label: 'DS share of all instances Δ',
    path: 'deltaToBaseline.coverageDelta.instances.dsShareOfAllNodes.delta',
    family: 'dsCoverage',
    transform: 'none',
    direction: 'higher-better',
  },
  {
    key: 'dsShareOfComponentInstancesDelta',
    label: 'DS share of component instances Δ',
    path: 'deltaToBaseline.coverageDelta.instances.dsShareOfComponentNodes.delta',
    family: 'dsCoverage',
    transform: 'none',
    direction: 'higher-better',
  },
  {
    key: 'dsShareOfAllNodesDelta',
    label: 'DS share of all nodes Δ',
    path: 'deltaToBaseline.coverageDelta.dsShareOfAllNodes.delta',
    family: 'dsCoverage',
    transform: 'none',
    direction: 'higher-better',
  },
  {
    key: 'dsShareOfComponentNodesDelta',
    label: 'DS share of component nodes Δ',
    path: 'deltaToBaseline.coverageDelta.dsShareOfComponentNodes.delta',
    family: 'dsCoverage',
    transform: 'none',
    direction: 'higher-better',
  },
  {
    // The four ds-misuse metrics read per-run means over judged nodes, so
    // every value is already normalised to [0, 1] regardless of how many
    // nodes a diff introduced. They are null on unjudged runs (judging is a
    // separate paid step) — the stats stage drops those rows per metric.
    key: 'dsMisuseScore',
    label: 'DS misuse score',
    path: 'dsMisuse.score',
    family: 'dsMisuse',
    transform: 'none',
    direction: 'higher-better',
  },
  {
    key: 'dsMisuseDecision',
    label: 'Right DS component',
    path: 'dsMisuse.correctDsDecision',
    family: 'dsMisuse',
    transform: 'none',
    direction: 'higher-better',
  },
  {
    key: 'dsMisuseUsage',
    label: 'DS usage per docs',
    path: 'dsMisuse.correctDsUsage',
    family: 'dsMisuse',
    transform: 'none',
    direction: 'higher-better',
  },
  {
    key: 'dsMisuseLocalDecision',
    label: 'Justified local components',
    path: 'dsMisuse.correctLocalDecision',
    family: 'dsMisuse',
    transform: 'none',
    direction: 'higher-better',
  },
  {
    key: 'cyclomaticDelta',
    label: 'Cyclomatic complexity Δ',
    path: 'deltaToBaseline.complexity.cyclomatic.delta',
    family: 'complexity',
    transform: 'none',
    direction: 'lower-better',
  },
  {
    key: 'cognitiveDelta',
    label: 'Cognitive complexity Δ',
    path: 'deltaToBaseline.complexity.cognitive.delta',
    family: 'complexity',
    transform: 'none',
    direction: 'lower-better',
  },
  {
    key: 'jsxCognitiveDelta',
    label: 'JSX cognitive complexity Δ',
    path: 'deltaToBaseline.complexity.jsxCognitive.delta',
    family: 'complexity',
    transform: 'none',
    direction: 'lower-better',
  },
  {
    key: 'slocNet',
    label: 'SLOC net',
    path: 'deltaToBaseline.diff.sloc.net',
    family: 'diff',
    transform: 'none',
    direction: 'neutral',
  },
  {
    key: 'slocAdded',
    label: 'SLOC added',
    path: 'deltaToBaseline.diff.sloc.added',
    family: 'diff',
    transform: 'none',
    direction: 'neutral',
  },
  {
    key: 'diffFilesChanged',
    label: 'Files changed vs baseline',
    path: 'deltaToBaseline.diff.filesChanged',
    family: 'diff',
    transform: 'none',
    direction: 'neutral',
  },
];

const FACET_METRIC_IDS: readonly string[] = [...MISUSE_FACET_IDS, UNCATEGORISED];

const FACET_METRICS: ComparisonMetric[] = FACET_METRIC_IDS.map((id) => ({
  key: `dsMisuseFacet_${facetMetricKey(id)}`,
  label: id === UNCATEGORISED ? 'Misuse: uncategorised' : `Misuse: ${describeFacet(id as FacetId)}`,
  path: `dsMisuse.facets.${facetMetricKey(id)}`,
  family: 'dsMisuseFacets',
  transform: 'none',
  direction: 'higher-better',
  correctionGroup: 'exploratory-misuse-facets',
}));

export const COMPARISON_METRICS: ComparisonMetric[] = [
  ...CONFIRMATORY_METRICS.map((metric) => ({
    ...metric,
    correctionGroup: 'confirmatory' as const,
  })),
  ...FACET_METRICS,
];

/** Numeric leaf at a dot-path, or null when absent, non-numeric, or non-finite. */
export function metricValueAt(analysis: Record<string, unknown>, path: string): number | null {
  let node: unknown = analysis;
  for (const segment of path.split('.')) {
    if (node === null || typeof node !== 'object') return null;
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === 'number' && Number.isFinite(node) ? node : null;
}
