// Self-contained HTML rendering of a results:compare comparison. Reads the
// estimates.json/manifest.json/dataset.csv/curves that the statistics stage
// emits and renders them as one static tabbed page: no server, no build step,
// no external requests beyond the Google Fonts stylesheet.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { MISUSE_QUESTIONS } from './misuse.ts';
import { isBetter, tallyVerdicts } from './verdict-tally.ts';
import { COMPARISON_METRICS } from '../comparison-metrics.ts';
import { formatCompactCount } from '../utils.ts';

import type {
  MisuseCellSummary,
  MisuseDecision,
  MisusePanel,
  MisuseQuestion,
  ScoreDistribution,
} from './misuse.ts';

export type EstimateVerdict = 'significant' | 'not-significant';
export type EstimateTransform = 'log' | 'log0' | 'none';
export type EstimateDirection = 'lower-better' | 'higher-better' | 'neutral';

export interface EstimateRow {
  metric: string;
  treatment: string;
  scope: string;
  context: boolean;
  nControl: number;
  nTreatment: number;
  beta: number;
  se: number;
  ciLow: number;
  ciHigh: number;
  p: number;
  pctChange: number | null;
  q: number | null;
  verdict: EstimateVerdict | null;
  direction: EstimateDirection;
  transform: EstimateTransform;
  anomalies: number | null;
}

interface ManifestCase {
  caseName: string;
  experiment: string;
  shortName: string;
  /** The case registry's definition of the arm; absent in older manifests. */
  description?: string;
}

interface ManifestMetric {
  key: string;
  label: string;
  path: string;
  family: string;
  transform: EstimateTransform;
  direction: EstimateDirection;
}

interface ManifestCell {
  case: string;
  workflow: string;
  usableRuns: number;
  passed: number;
  failed: number;
  unanalyzed: number;
  superseded: number;
}

export interface ManifestJson {
  spec: {
    control: ManifestCase;
    treatments: ManifestCase[];
    workflows: string[];
    mode: 'single-workflow' | 'aggregate';
    minRuns: number;
    plan: string | null;
  };
  metrics: ManifestMetric[];
  /** Stable per-case colors; absent in manifests from before they existed. */
  colors?: Record<string, { light: string; dark: string }>;
  cells: ManifestCell[];
  excludedRuns: { path?: string; reason?: string }[];
  provenance: {
    generatedAt?: string;
    gitSha?: string | null;
    metricsVersion?: number | string | null;
    statsmodels?: string;
    [key: string]: unknown;
  };
}

export interface CurveInput {
  metric: string;
  workflow: string;
  svg: string;
}

/** One usable run's raw metric values, straight from dataset.csv. */
export interface DatasetRow {
  case: string;
  workflow: string;
  values: Record<string, number | null>;
}

export interface HtmlReportInput {
  estimates: EstimateRow[];
  manifest: ManifestJson;
  curves: CurveInput[];
  dataset: DatasetRow[];
  /** Absent in bundles staged before the misuse panel existed. */
  misuse?: MisusePanel;
}

// Plain-English copy per metric. `description` is the one-liner under the
// metric name; `computes` and `relevance` are the two halves of the hover
// definition, written for readers with no project context: what exactly is
// measured, then why anyone should care. Metrics outside this map render
// under their raw registry key with no description or tooltip.
interface MetricCopy {
  name: string;
  description: string;
  computes: string;
  relevance: string;
}

const METRICS: Record<string, MetricCopy> = {
  estimatedCostUsd: {
    name: 'Cost per run',
    description: 'What one run costs in API dollars',
    computes: "The run's estimated API bill, priced from its token usage at the model's rates.",
    relevance: 'The most direct measure of whether an experiment makes agents cheaper.',
  },
  durationSeconds: {
    name: 'Time to finish',
    description: 'Wall-clock seconds per run',
    computes: 'Wall-clock time for the whole run.',
    relevance: 'The most direct measure of whether an experiment makes agents faster.',
  },
  outputTokens: {
    name: 'Output tokens',
    description: 'Text and code the model writes',
    computes: 'Every token the model generated during the run: prose, code, and tool calls.',
    relevance:
      'Output tokens are the most expensive kind, and heavy output usually means long ' +
      'detours or rewritten work.',
  },
  cacheHitRate: {
    name: 'Cache hit rate',
    description: 'Share of context read from cache',
    computes:
      'The share of everything the model read that came from prompt cache instead of being ' +
      'processed at the full price.',
    relevance: 'A high rate means the agent kept a stable context between turns.',
  },
  inputTokens: {
    name: 'Uncached input tokens',
    description: 'Context paid at the full rate',
    computes: 'Input the model read without cache help, billed at the full rate.',
    relevance:
      'The expensive kind of reading. Good docs shrink it by getting the agent to the ' +
      'answer with less context.',
  },
  turns: {
    name: 'Conversation turns',
    description: 'Agent loop iterations',
    computes:
      'How many rounds the agent loop ran (each turn is one model response, usually ' +
      'followed by tool calls).',
    relevance:
      'Fewer turns means less back-and-forth to reach a result; many turns usually mean ' +
      'searching or retrying.',
  },
  totalToolCalls: {
    name: 'Tool calls',
    description: 'Every tool invocation',
    computes:
      'Every tool invocation across the run: file reads and writes, shell commands, MCP ' +
      'calls, all of it.',
    relevance: 'A rough size of the work performed.',
  },
  docsCalls: {
    name: 'Documentation lookups',
    description: 'Calls that read docs (MCP or web)',
    computes:
      "Tool calls that read documentation: the design system's docs endpoints, plus web " +
      'fetches and searches.',
    relevance: 'Shows whether the agent actually consulted the docs served in an experiment.',
  },
  explorationCalls: {
    name: 'Exploration calls',
    description: 'Reading and searching the codebase',
    computes:
      'Tool calls that read code: file reads, directory listings, searches, and read-only ' +
      'shell commands.',
    relevance:
      'Reading source is how an agent compensates for missing docs, so better docs should ' +
      'push this down.',
  },
  editCalls: {
    name: 'Edit calls',
    description: 'File-writing tool calls',
    computes:
      'Tool calls that write: file edits and creations, plus shell commands that copy, ' +
      'move, or delete.',
    relevance:
      'An increase in edit calls can be evidence of rework from the agent because it did not ' +
      'understand how to use existing code',
  },
  verificationCalls: {
    name: 'Verification calls',
    description: 'Tests, typechecks, builds',
    computes: 'Tool calls that check the work: test runs, typechecking, linting, builds.',
    relevance:
      'An increase in verification calls can mean the agent wrote incorrect code the first time around ' +
      'and noticed through tools like tsc.',
  },
  environmentCalls: {
    name: 'Environment-setup calls',
    description: 'Sandbox provisioning',
    computes:
      'Tool calls that provision the sandbox rather than work on the task: package ' +
      'installation (apt-get, npm install, playwright install), library extraction, etc.',
    relevance:
      'These tool calls relate to experiment setup, so we isolate them to avoid inflating other measurements.',
  },
  filesEdited: {
    name: 'Files touched',
    description: 'Distinct files the agent edited',
    computes:
      'How many distinct project files the agent wrote at least once during the run. ' +
      "Renames are followed, and temp files outside the project don't count.",
    relevance:
      'Touching many files for a contained task is a sign of thrashing; a focused agent ' +
      'edits the few files the change needs.',
  },
  meanEditsPerFile: {
    name: 'Mean edits per file',
    description: 'Average rewrites per touched file',
    computes:
      'For the files the agent touched, the average number of times each one was written ' +
      'over the run.',
    relevance:
      'An agent that understood the change writes a file once or twice; high averages ' +
      'mean write-check-rewrite loops.',
  },
  maxEditsPerFile: {
    name: 'Max edits per file',
    description: 'Rewrites of the most-edited file',
    computes: 'How many times the most-rewritten file was written over the run.',
    relevance:
      'Helps identify outlier runs where an agent got stuck over a specific part of the codebase, which might pollute experiment results.',
  },
  diffFilesChanged: {
    name: 'Files changed in diff',
    description: 'Files in the final change',
    computes:
      'How many files differ between the finished project and the tree the run started from.',
    relevance:
      'The footprint a reviewer faces. Can indicate whether design system reuse was effective, but is affected by things like util factorization.',
  },
  slocAdded: {
    name: 'Lines added',
    description: 'How much new code was needed',
    computes:
      'Source lines the final change adds over the starting tree, with blank lines and ' +
      'comments stripped before counting.',
    relevance:
      'The size of the solution. For the same task, needing fewer new lines usually means ' +
      'leaning on existing components.',
  },
  slocNet: {
    name: 'Lines added minus removed',
    description: 'How much the codebase grew',
    computes:
      'Lines added minus lines removed, with blank lines and ' +
      'comments stripped before counting.',
    relevance:
      'The maintenance cost of the change. A small net with many added lines means the run mostly ' +
      'replaced code rather than piling it on.',
  },
  dsShareOfAllInstances: {
    name: 'DS share of JSX',
    description: 'Instance-weighted DS share among all JSX nodes',
    computes:
      'Of all UI elements in the finished app (including plain HTML tags), the share that ' +
      'comes from the design system. Element counts are weighted based on how many times the ' +
      "element's parent component is used in the codebase, to mirror a dynamic analysis.",
    relevance:
      'The headline DS adoption number, weighted toward what users are actually exposed to: ' +
      'markup in a component used everywhere matters more than in a one-off component.',
  },
  dsShareOfComponentInstances: {
    name: 'DS share of components',
    description: 'Instance-weighted share among component declarations',
    computes:
      'The same instance weighting measurement, but counting only components, ' +
      'with plain HTML tags like div and span left out.',
    relevance:
      'Design systems without layout components expect consumers to have many plain HTML tags. ' +
      'In such cases, this metric is a better measure of DS adoption.',
  },
  dsShareOfAllNodes: {
    name: 'DS share of JSX (unweighted)',
    description: 'Among all JSX nodes in source code',
    computes:
      'Of all UI elements in the finished app (including plain HTML tags), the share that ' +
      'comes from the design system.',
    relevance:
      'The source-level adoption number: every element counts once, however often it ' +
      'renders. This is a more naive, simpler version of the weighted metric.',
  },
  dsShareOfComponentNodes: {
    name: 'DS share of components (unweighted)',
    description: 'Among component declarations in source code',
    computes:
      'The design-system share counting only components, with plain HTML tags like div and ' +
      'span left out.',
    relevance:
      'The source-level adoption number: every element counts once, however often it ' +
      'renders. This is a more naive, simpler version of the weighted metric.',
  },
  dsShareOfAllInstancesDelta: {
    name: 'DS share of JSX Δ',
    description: 'How the weighted DS share moved',
    computes:
      "The change in the instance-weighted share of all UI elements: the finished app's " +
      "share minus the untouched app's.",
    relevance:
      'Whether the run moved what users actually see toward or away from the design system.',
  },
  dsShareOfComponentInstancesDelta: {
    name: 'DS share of components Δ',
    description: 'How the weighted component share moved',
    computes:
      'The change in the instance-weighted share of components (plain HTML tags left ' +
      "out): the finished app's share minus the untouched app's.",
    relevance:
      'Did the components this run put on screen come from the design system, net of ' +
      'what it removed?',
  },
  dsShareOfAllNodesDelta: {
    name: 'DS share of JSX Δ (unweighted)',
    description: 'How the DS share of JSX moved',
    computes:
      "The change in the design system's share of all UI elements: the finished app's " +
      "share minus the untouched app's.",
    relevance:
      'Whether the run moved the app toward or away from the design system — sharper than ' +
      'the absolute share when the app starts with plenty of existing UI.',
  },
  dsShareOfComponentNodesDelta: {
    name: 'DS share of components Δ (unweighted)',
    description: 'How the DS component share moved',
    computes:
      "The change in the design system's share of components (plain HTML tags left out): " +
      "the finished app's share minus the untouched app's.",
    relevance:
      'Did the components this run added come from the design system, net of what it removed?',
  },
  dsMisuseScore: {
    name: 'DS misuse score',
    description: 'Judge score over all introduced usages',
    computes:
      'An LLM judge scores every introduced JSX node against the DS documentation to decide ' +
      'if DS usages use the right component and use it correctly, and if non-DS usages are legitimate. ' +
      'Each of the three questions is scored 0 to 1, and scores are then averaged.',
    relevance:
      'Coverage says how much of the UI came from the design system; this says whether it ' +
      'was used in the right places, and as intended.',
  },
  dsMisuseDecision: {
    name: 'Right DS component',
    description: 'Was each DS usage the right component',
    computes:
      'Per introduced design-system usage: was this the right component for the job, or did ' +
      'a better DS alternative exist? Mean over judged DS usages.',
    relevance:
      "Picking a plausible-but-wrong component is a misuse, but it's invisible to coverage metrics.",
  },
  dsMisuseUsage: {
    name: 'DS usage per docs',
    description: 'DS usages free of documented violations',
    computes:
      'Per introduced design-system usage: does it violate a documented guideline e.g. ' +
      'composition rules, required props, tokens, compound parts? Mean over judged DS usages.',
    relevance:
      'Measures whether the served documentation actually transferred its rules into the code ' +
      'the agent wrote.',
  },
  dsMisuseLocalDecision: {
    name: 'Justified local components',
    description: 'Local only where no DS component fit',
    computes:
      'Per introduced local component: should it be local, or did a design-system component ' +
      'with a relevant API exist? Mean over judged local components.',
    relevance:
      'Measures whether the agent found relevant DS components or decided to duplicate existing UI logic.',
  },
  cyclomaticDelta: {
    name: 'Cyclomatic complexity added',
    description: 'Branching complexity the change adds',
    computes: "How much the project's cyclomatic complexity rose over the run.",
    relevance:
      'More branches means more cases to test and more ways to be wrong. Cyclomatic complexity is a classic metric in QA tools, though it is biased against small reusable functions.',
  },
  cognitiveDelta: {
    name: 'Cognitive complexity added',
    description: 'Readability cost the change adds',
    computes:
      'The SonarQube implementation of complexity, which corrects the biases of cyclomatic complexity. ' +
      "It's a readability metric that punishes code for nesting and tangled control flow.",
    relevance: "The closest number to 'how much harder did this code just get to read'.",
  },
  jsxCognitiveDelta: {
    name: 'JSX-aware complexity added',
    description: 'Markup complexity the change adds',
    computes:
      "Storybook's JSX-aware take on cognitive complexity: render loops and conditional markup " +
      'are counted and weighted by how deep they nest.',
    relevance:
      'In UI code most, of the complexity lives in the markup, which the classic scores ' +
      'do not account for as effectively.',
  },
};

// Metric families, in registry order, with a short intro each.
const FAMILIES: Record<string, { name: string; intro: string }> = {
  speed: {
    name: 'Speed',
    intro: 'How long a run takes: wall-clock time and agent-loop turns.',
  },
  cost: {
    name: 'Cost',
    intro: 'What a run spends: dollars, tokens, cache efficiency, and total tool calls.',
  },
  toolUse: {
    name: 'Tool use',
    intro:
      'Where the calls go: docs, exploration, edits, verification. Descriptive — more is not inherently better or worse.',
  },
  churn: {
    name: 'Churn',
    intro: 'How much the agent rewrites while working: files touched, and repeat edits per file.',
  },
  dsCoverage: {
    name: 'DS coverage',
    intro:
      'How much of the produced UI uses the design system, and how far the run moved it. ' +
      'Rendered shares weight each element by its estimated instantiations; node shares ' +
      'count source elements once.',
  },
  dsMisuse: {
    name: 'DS misuse',
    intro:
      'Whether the design system was used well, judged per introduced usage against its own ' +
      'documentation and averaged per run (1 is clean, 0 is misuse). Judged runs only. ' +
      'See DS misuse tab for details.',
  },
  dsMisuseFacets: {
    name: 'DS misuse by documentation facet',
    intro:
      'Exploratory per-facet drill-downs of misuse scores. Helps identify the types of issues ' +
      "that the experiment's documentation failed to prevent.",
  },
  complexity: {
    name: 'Complexity',
    intro: 'Code complexity the change adds over the baseline.',
  },
  diff: { name: 'Diff footprint', intro: 'The size of the final change.' },
};

// Metrics measured as a 0-1 share; values and absolute-delta effects display
// as percentages (value * 100), never as a relative percent change.
const SHARE_METRICS = new Set([
  'dsShareOfAllInstances',
  'dsShareOfComponentInstances',
  'dsShareOfAllInstancesDelta',
  'dsShareOfComponentInstancesDelta',
  'dsShareOfAllNodes',
  'dsShareOfComponentNodes',
  'dsShareOfAllNodesDelta',
  'dsShareOfComponentNodesDelta',
  'cacheHitRate',
]);

// Small-count metrics whose values and deltas display with one decimal.
const COUNT_METRICS = new Set([
  'turns',
  'totalToolCalls',
  'docsCalls',
  'explorationCalls',
  'editCalls',
  'verificationCalls',
  'environmentCalls',
  'filesEdited',
  'meanEditsPerFile',
  'maxEditsPerFile',
  'diffFilesChanged',
  'cyclomaticDelta',
  'cognitiveDelta',
  'jsxCognitiveDelta',
]);

// Parked metrics: tested and q-corrected like every other, but hidden until
// the Metrics toggle is set to "all" — the grid stays intact while the default
// view shows the story that matters. Move keys in and out freely; nothing
// statistical depends on this set.
const EXTRA_METRICS = new Set([
  'cyclomaticDelta',
  'cognitiveDelta',
  'environmentCalls',
  'cacheHitRate',
  'slocAdded',
  'maxEditsPerFile',
  // The static node shares park now that the instance-weighted shares are the
  // headline (metricsVersion 8 made the same move in the analyze tables).
  'dsShareOfAllNodes',
  'dsShareOfComponentNodes',
  'dsShareOfAllInstancesDelta',
  'dsShareOfComponentInstancesDelta',
  'dsShareOfAllNodesDelta',
  'dsShareOfComponentNodesDelta',
  // Exploratory metrics (their own BH groups) park behind the Metrics toggle
  // same as the rest of this set — derived from the registry rather than
  // listed by hand, so a metric added there stays parked.
  ...COMPARISON_METRICS.filter((metric) => metric.correctionGroup !== 'confirmatory').map(
    (metric) => metric.key
  ),
]);

// Line counts: whole numbers with thousands separators.
const SLOC_METRICS = new Set(['slocAdded', 'slocNet']);

const LIGHT_TREATMENT_COLORS = ['#E8590C', '#099268', '#6741D9'];
const DARK_TREATMENT_COLORS = ['#FF7E33', '#20C997', '#9775FA'];
const NEUTRAL_GRAY_LIGHT = '#6B7280';
const NEUTRAL_GRAY_DARK = '#9CA3AF';

const MINUS = '−';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// CSS class / DOM id safe token for a treatment's short name.
function slug(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    let minutes = Math.floor(seconds / 60);
    let rest = Math.round(seconds - minutes * 60);
    if (rest === 60) {
      minutes += 1;
      rest = 0;
    }
    return `${minutes}m ${String(rest).padStart(2, '0')}s`;
  }
  let hours = Math.floor(seconds / 3600);
  let minutes = Math.round((seconds - hours * 3600) / 60);
  if (minutes === 60) {
    hours += 1;
    minutes = 0;
  }
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function formatPlain(value: number): string {
  const a = Math.abs(value);
  if (a >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (a >= 10) return value.toFixed(1);
  if (a >= 1) return value.toFixed(2);
  return value.toFixed(3);
}

/** A metric's absolute value, rounded and unit-annotated for that metric. */
export function formatMetricValue(key: string, value: number): string {
  if (key === 'durationSeconds') return formatDuration(value);
  if (key === 'estimatedCostUsd') return `$${value.toFixed(2)}`;
  if (key === 'outputTokens') return formatCompactCount(value);
  if (key === 'inputTokens' || SLOC_METRICS.has(key)) {
    return Math.round(value).toLocaleString('en-US');
  }
  if (SHARE_METRICS.has(key)) return `${(value * 100).toFixed(1)}%`;
  if (COUNT_METRICS.has(key)) return value.toFixed(1);
  return formatPlain(value);
}

/** OLS coefficients: three decimals, never exponent form. */
export function formatBeta(value: number): string {
  return value < 0 ? MINUS + Math.abs(value).toFixed(3) : value.toFixed(3);
}

/** p and q values: three decimals, floored instead of exponent form. */
export function formatPQ(value: number): string {
  return value < 0.0005 ? '< 0.001' : value.toFixed(3);
}

function signed(negative: boolean, body: string): string {
  return (negative ? MINUS : '+') + body;
}

function fmtPct(value: number): string {
  return signed(value < 0, `${Math.abs(value * 100).toFixed(1)}%`);
}

/** An absolute-delta effect, rounded per the metric's own display rules. */
function formatDelta(key: string, value: number): string {
  const a = Math.abs(value);
  if (SHARE_METRICS.has(key)) return signed(value < 0, `${(a * 100).toFixed(1)}%`);
  if (COUNT_METRICS.has(key)) return signed(value < 0, a.toFixed(1));
  if (SLOC_METRICS.has(key)) {
    return signed(value < 0, Math.round(a).toLocaleString('en-US'));
  }
  return signed(value < 0, formatPlain(a));
}

interface Effect {
  value: number;
  lo: number;
  hi: number;
  label: string;
  ciLabel: string;
}

// The effect a row represents, on its own display scale: a percent change for
// log/log0 transforms (beta is a log-ratio), an absolute delta otherwise —
// share metrics display the delta as a percentage.
function effectOf(row: EstimateRow): Effect {
  if (row.transform === 'log' || row.transform === 'log0') {
    const value = row.pctChange ?? Math.exp(row.beta) - 1;
    const lo = Math.exp(row.ciLow) - 1;
    const hi = Math.exp(row.ciHigh) - 1;
    return {
      value,
      lo,
      hi,
      label: fmtPct(value),
      ciLabel: `${fmtPct(lo)} to ${fmtPct(hi)}`,
    };
  }
  return {
    value: row.beta,
    lo: row.ciLow,
    hi: row.ciHigh,
    label: formatDelta(row.metric, row.beta),
    ciLabel: `${formatDelta(row.metric, row.ciLow)} to ${formatDelta(row.metric, row.ciHigh)}`,
  };
}

function directionText(direction: EstimateDirection): string {
  if (direction === 'lower-better') return 'lower is better';
  if (direction === 'higher-better') return 'higher is better';
  return 'descriptive';
}

interface TreatmentStyle {
  shortName: string;
  slug: string;
  lightColor: string;
  darkColor: string;
}

// Stable colors come from the manifest (written by compare-results from
// CASE_COLORS); the index palette only serves manifests from before that.
function treatmentStyles(
  treatments: ManifestCase[],
  colors: ManifestJson['colors']
): TreatmentStyle[] {
  return treatments.map((t, i) => {
    const assigned = colors?.[t.shortName];
    return {
      shortName: t.shortName,
      slug: slug(t.shortName),
      lightColor: assigned?.light ?? (i < 3 ? LIGHT_TREATMENT_COLORS[i]! : NEUTRAL_GRAY_LIGHT),
      darkColor: assigned?.dark ?? (i < 3 ? DARK_TREATMENT_COLORS[i]! : NEUTRAL_GRAY_DARK),
    };
  });
}

function metricName(key: string): string {
  return METRICS[key]?.name ?? key;
}

function metricDescription(key: string): string {
  return METRICS[key]?.description ?? '';
}

// Hover definition for a metric name: what it computes, then why it matters.
// data-tip-q carries the tooltip's third line (see showTip); empty for
// metrics outside the copy map.
function metricTipAttributes(key: string): string {
  const copy = METRICS[key];
  if (!copy) return '';
  return (
    ` tabindex="0" data-tip-title="${escapeHtml(copy.name)}" ` +
    `data-tip-effect="${escapeHtml(copy.computes)}" ` +
    `data-tip-q="${escapeHtml(copy.relevance)}"`
  );
}

/** The metric name as a span, made a hover target when a definition exists. */
function metricNameHtml(key: string, baseClass: string): string {
  const tip = metricTipAttributes(key);
  const cls = [baseClass, ...(tip === '' ? [] : ['mname', 'tipsrc'])].filter(Boolean).join(' ');
  return `<span${cls === '' ? '' : ` class="${cls}"`}${tip}>${escapeHtml(metricName(key))}</span>`;
}

// ---------------------------------------------------------------------------
// Control / treatment statistics from the raw dataset

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function transformValue(value: number, transform: EstimateTransform): number {
  if (transform === 'log') return Math.log(value);
  if (transform === 'log0') return value === 0 ? 0 : Math.log(value);
  return value;
}

function backTransform(value: number, transform: EstimateTransform): number {
  return transform === 'none' ? value : Math.exp(value);
}

function usableValues(
  dataset: DatasetRow[],
  caseName: string,
  workflow: string,
  metric: ManifestMetric
): number[] {
  return dataset
    .filter((row) => row.case === caseName && row.workflow === workflow)
    .map((row) => row.values[metric.key])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    .filter((v) => (metric.transform === 'log' ? v > 0 : true))
    .filter((v) => (metric.transform === 'log0' ? v >= 0 : true));
}

/** The workflows a scope names: pooled = all of them, a '+' id = its parts. */
function scopedWorkflows(scope: string, workflows: string[]): string[] {
  return scope === 'pooled' ? workflows : scope.split('+');
}

// The statistic the model actually references: for the mean, the average on
// the transformed scale, back-transformed (geometric mean for log metrics).
// Multi-workflow scopes combine per-workflow statistics with equal weight.
function caseStat(
  dataset: DatasetRow[],
  caseName: string,
  metric: ManifestMetric,
  scope: string,
  workflows: string[],
  kind: 'mean' | 'median'
): number | null {
  const scoped = scopedWorkflows(scope, workflows);
  const perWorkflow: number[] = [];
  for (const workflow of scoped) {
    const values = usableValues(dataset, caseName, workflow, metric);
    if (values.length === 0) continue;
    perWorkflow.push(
      kind === 'median'
        ? median(values)
        : mean(values.map((v) => transformValue(v, metric.transform)))
    );
  }
  if (perWorkflow.length === 0) return null;
  const combined = mean(perWorkflow);
  return kind === 'median' ? combined : backTransform(combined, metric.transform);
}

/**
 * A symmetric transformed-scale half-width (a CI's t·se) around the control,
 * on the effect display scale.
 */
function spreadExtents(half: number, transform: EstimateTransform): { lo: number; hi: number } {
  if (transform === 'log' || transform === 'log0') {
    return { lo: Math.exp(-half) - 1, hi: Math.exp(half) - 1 };
  }
  return { lo: -half, hi: half };
}

// Two-sided 95% t critical values by degrees of freedom; 1.96 past 30.
const T95 = [
  12.71, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145,
  2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048,
  2.045, 2.042,
];
function t95(df: number): number {
  return df >= 1 && df <= 30 ? T95[df - 1]! : 1.96;
}

/**
 * Half-width of a plain-t 95% CI for the case's mean on the transformed scale,
 * per-workflow standard errors combined with equal weight (matching caseStat's
 * pooling). A visual companion to the model's effect CIs, not a test.
 */
function caseMeanCiHalfWidth(
  dataset: DatasetRow[],
  caseName: string,
  metric: ManifestMetric,
  scope: string,
  workflows: string[]
): number | null {
  const scoped = scopedWorkflows(scope, workflows);
  let seSquares = 0;
  let df = 0;
  let count = 0;
  for (const workflow of scoped) {
    const values = usableValues(dataset, caseName, workflow, metric).map((v) =>
      transformValue(v, metric.transform)
    );
    if (values.length < 2) continue;
    const m = mean(values);
    const sd = Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
    seSquares += (sd * sd) / values.length;
    df += values.length - 1;
    count++;
  }
  if (count === 0) return null;
  return t95(df) * (Math.sqrt(seSquares) / count);
}

// The shift of a case statistic against the control's, on the effect display
// scale: a ratio for log-scaled metrics (they display as percent changes), a
// difference otherwise. Null when a statistic is missing or a ratio is
// undefined; callers fall back to the model estimate then.
function descriptiveEffect(
  transform: EstimateTransform,
  control: number | null,
  treatment: number | null
): number | null {
  if (control === null || treatment === null) return null;
  if (transform === 'log' || transform === 'log0') {
    if (control <= 0 || treatment < 0) return null;
    return treatment / control - 1;
  }
  return treatment - control;
}

// ---------------------------------------------------------------------------
// Page sections

function buildHeader(manifest: ManifestJson): string {
  const { control, treatments, workflows } = manifest.spec;
  const title = `${control.shortName} vs ${treatments
    .map((t) => t.shortName)
    .join(' + ')} @ ${workflows.join(', ')}`;
  const provenance = manifest.provenance;
  const sha = typeof provenance.gitSha === 'string' ? provenance.gitSha.slice(0, 7) : 'unknown';
  const generatedAt =
    typeof provenance.generatedAt === 'string' ? provenance.generatedAt : 'unknown';
  const metricsVersion = provenance.metricsVersion ?? 'unknown';
  return `
<span class="eyebrow">results:compare</span>
<h1>${escapeHtml(title)}</h1>
<p class="lede mono">generated ${escapeHtml(generatedAt)} &middot; ${escapeHtml(
    sha
  )} &middot; metrics v${escapeHtml(String(metricsVersion))}</p>`;
}

function buildFilterBar(manifest: ManifestJson, styles: TreatmentStyle[]): string {
  const definitions = new Map(manifest.spec.treatments.map((t) => [t.shortName, t.description]));
  const chips = styles
    .map((t) => {
      const definition = definitions.get(t.shortName);
      const tip = definition
        ? ` data-tip-title="${escapeHtml(t.shortName)}" data-tip-effect="${escapeHtml(definition)}"`
        : '';
      return (
        `<button type="button" class="chip-toggle${
          definition ? ' tipsrc' : ''
        }" data-t="${t.slug}" aria-pressed="true"${tip} ` +
        `style="--tc:var(--c-${t.slug})"><span class="dot"></span>${escapeHtml(
          t.shortName
        )}</button>`
      );
    })
    .join('\n');
  // Workflow pills: all on shows the pooled headline; disabling any switches
  // to the per-workflow view of whatever stays enabled, because pooled
  // estimates only exist for the full workflow set.
  const workflowSelect =
    manifest.spec.mode === 'aggregate'
      ? `
<span class="select">Workflows
<span class="wfpills" id="wfFilter" role="group" aria-label="Workflows">
${manifest.spec.workflows
  .map(
    (w) =>
      `<button type="button" class="chip-toggle wf-toggle" data-wf="${escapeHtml(
        w
      )}" aria-pressed="true">${escapeHtml(w)}</button>`
  )
  .join('\n')}
</span></span>`
      : '';
  return `
<div class="filterbar">
<div class="fbrow">
<div class="legend">${chips}</div>
<button type="button" id="resetFilters">Reset filters</button>
</div>
<div class="fbrow fbopts">${workflowSelect}
<span class="select">Significance
<span class="seg" id="sigFilter" role="group" aria-label="Significance filter">
<button type="button" data-sig="all" aria-pressed="true">All</button>
<button type="button" data-sig="sig" aria-pressed="false">Significant</button>
<button type="button" data-sig="nonsig" aria-pressed="false">Not significant</button>
</span></span>
<span class="select">Test
<span class="seg" id="sigMode" role="group" aria-label="Significance test">
<button type="button" data-sigmode="fdr" aria-pressed="true">FDR q &le; 0.05</button>
<button type="button" data-sigmode="naive" aria-pressed="false">raw p &lt; 0.05</button>
</span></span>
<span class="select">Metrics
<span class="seg" id="metricsMode" role="group" aria-label="Metric set">
<button type="button" data-metrics="core" aria-pressed="true">core</button>
<button type="button" data-metrics="all" aria-pressed="false">all</button>
</span></span>
</div>
</div>`;
}

// Only headline estimates enter significance testing (rows.context === false);
// per-workflow context rows in aggregate mode carry no q/verdict.
function headlineRows(estimates: EstimateRow[]): EstimateRow[] {
  return estimates.filter((row) => !row.context && row.verdict !== null);
}

// Naive per-test call, before FDR correction; the report's Test toggle switches
// every verdict between this and row.verdict === 'significant'.
function isNaiveSignificant(row: EstimateRow): boolean {
  return row.p < 0.05;
}

// One treatment's verdict tally as markup: better/worse carry color when they
// have anything to say; the grid size is stated once by the caller, so a
// count only appends its total when some pairs went untested.
function countsHtml(
  rows: EstimateRow[],
  isSig: (row: EstimateRow) => boolean,
  gridSize: number
): string {
  const { better, worse, changed, inconclusive } = tallyVerdicts(
    rows,
    isSig,
    (row) => effectOf(row).value
  );
  const mark = (count: number, cls: string, word: string) =>
    count > 0 ? `<span class="${cls}">${count} ${word}</span>` : `${count} ${word}`;
  const suffix = rows.length === gridSize ? '' : ` (${rows.length} tested)`;
  return (
    `${mark(better.length, 'cgood', 'better')} · ${mark(worse.length, 'cbad', 'worse')} · ` +
    `${changed.length} changed · ${inconclusive.length} not significant${suffix}`
  );
}

// One merged list per arm: the verdict tally (for treatments) and the case
// registry's definition, in the same aligned definition list.
function buildCases(
  estimates: EstimateRow[],
  manifest: ManifestJson,
  styles: TreatmentStyle[]
): string {
  const rows = headlineRows(estimates);
  const gridSize = manifest.metrics.length;
  const { control, treatments } = manifest.spec;
  const bySlug = new Map(styles.map((t) => [t.shortName, t.slug]));
  const item = (c: ManifestCase, isControl: boolean) => {
    const slug = bySlug.get(c.shortName);
    const dot = isControl
      ? '<span class="dot" style="background:var(--ink-3)"></span>'
      : `<span class="dot" style="background:var(--c-${slug ?? ''})"></span>`;
    const badge = isControl ? ' <span class="chip control">control</span>' : '';
    const forTreatment = isControl ? [] : rows.filter((r) => r.treatment === c.shortName);
    const verdicts =
      forTreatment.length === 0
        ? ''
        : `<span class="caseverdicts"><span class="m-fdr">${countsHtml(
            forTreatment,
            (r) => r.verdict === 'significant',
            gridSize
          )}</span><span class="m-naive">${countsHtml(
            forTreatment,
            isNaiveSignificant,
            gridSize
          )}</span></span>`;
    const definition = c.description
      ? `<span class="casedef">${escapeHtml(c.description)}</span>`
      : '';
    return `<dt>${dot}<b>${escapeHtml(c.shortName)}</b>${badge}</dt><dd>${verdicts}${definition}</dd>`;
  };
  return `
<h2>Cases</h2>
<p class="note">Verdict counts span the ${gridSize}-metric test grid.</p>
<dl class="deflist cases">
${[item(control, true), ...treatments.map((t) => item(t, false))].join('\n')}
</dl>`;
}

function buildStatsBox(estimates: EstimateRow[], manifest: ManifestJson): string {
  const tests = headlineRows(estimates).length;
  const aggregate = manifest.spec.mode === 'aggregate';
  const statsmodelsVersion =
    typeof manifest.provenance.statsmodels === 'string'
      ? ` ${manifest.provenance.statsmodels}`
      : '';
  const lines = [
    '<li><b>What one result means.</b> Every result compares one treatment with the control, ' +
      'using only those two arms&#39; runs. The estimate (β) is the effect on the model scale: ' +
      'for raw metrics, the difference in average values; for log-scaled metrics (durations, ' +
      'cost, tokens), the log of the ratio — displayed as a percent change.</li>',
    '<li><b>How sure we are.</b> The 95% CI is the range of effects still compatible with the ' +
      'data: were the experiment repeated many times, 95% of such intervals would contain the ' +
      'true effect. A wide interval means little certainty. Standard errors are HC3-robust, so ' +
      'arms with unequal variance cannot fake precision.</li>',
    `<li><b>Why p alone misleads.</b> p is the chance of seeing an effect at least this large ` +
      `when the treatment truly does nothing. This report runs ${tests} test${
        tests === 1 ? '' : 's'
      } ` +
      'at once; at p &lt; 0.05 each, about 1 in 20 true-null tests would come out significant ' +
      'by luck alone.</li>',
    '<li><b>The correction.</b> Benjamini&ndash;Hochberg rescales every p to the size of the ' +
      'whole grid, giving q — the false-discovery rate. Among all the results this report calls ' +
      'significant, at most about 5% are expected to be false discoveries. A result is ' +
      'significant iff q &le; 0.05.</li>',
    '<li><b>The Test toggle.</b> The filter bar can switch every verdict, icon, and filter ' +
      'from the corrected call (q &le; 0.05) to the naive per-test call (p &lt; 0.05). ' +
      'Raw p ignores the multiple-testing problem above; treat it as exploratory, not ' +
      'confirmatory.</li>',
  ];
  if (aggregate) {
    lines.push(
      '<li><b>Aggregation.</b> Multi-workflow effects weight every workflow equally, ' +
        'regardless of run counts. Disabling workflows shows an equal-weight aggregate of ' +
        'the per-workflow estimates with normal-approximation CIs — outside the FDR ' +
        'grid, so treat those views as exploratory.</li>'
    );
  }
  lines.push(
    `<li><b>Engine.</b> statsmodels${escapeHtml(
      statsmodelsVersion
    )} OLS (Python); full provenance in manifest.json.</li>`
  );
  return `
<h2>How the statistics work</h2>
<div class="statsbox">
<ul>
${lines.join('\n')}
</ul>
</div>`;
}

// Rows grouped by workflow, the workflow cell spanning its group. Every row
// carries a (mostly hidden) workflow cell so the refresh script can re-span
// groups around whatever rows the case filters leave visible.
function buildSample(manifest: ManifestJson, styles: TreatmentStyle[]): string {
  const controlShortName = manifest.spec.control.shortName;
  const bySlug = new Map(styles.map((t) => [t.shortName, t.slug]));
  const groups = manifest.spec.workflows
    .map((workflow) => ({
      workflow,
      cells: manifest.cells.filter((c) => c.workflow === workflow),
    }))
    .filter((g) => g.cells.length > 0);
  const rows = groups
    .flatMap(({ workflow, cells }) =>
      cells.map((c, i) => {
        const isControl = c.case === controlShortName;
        const t = bySlug.get(c.case);
        const attrs = isControl
          ? 'class="control-row"'
          : `class="t-${t ?? ''}" data-t="${t ?? ''}"`;
        const badge = isControl ? ' <span class="chip control">control</span>' : '';
        const wfCell = `<td class="wfcell"${
          i === 0 ? ` rowspan="${cells.length}"` : ' hidden'
        }>${escapeHtml(workflow)}</td>`;
        return (
          `<tr ${attrs} data-workflow="${escapeHtml(c.workflow)}">${wfCell}` +
          `<td>${escapeHtml(c.case)}${badge}</td><td class="num">${c.usableRuns}</td></tr>`
        );
      })
    )
    .join('\n');
  return `
<h2>Sample</h2>
<div class="tablewrap"><table id="sampleTable">
<thead><tr><th>Workflow</th><th>Case</th><th>Runs used</th></tr></thead>
<tbody>
${rows}
</tbody>
</table></div>`;
}

interface Scoped {
  scope: string;
  context: boolean;
  rows: EstimateRow[];
}

// Two-sided normal-approximation p for z (Abramowitz–Stegun 7.1.26 erf).
function normalP(z: number): number {
  const a = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * a);
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-a * a);
  return Math.max(0, Math.min(1, 1 - erf));
}

/** Every proper subset of 2+ workflows, sorted, for precomputed aggregates. */
function workflowSubsets(workflows: string[]): string[][] {
  const sorted = [...workflows].sort();
  const subsets: string[][] = [];
  for (let bits = 1; bits < (1 << sorted.length) - 1; bits++) {
    const subset = sorted.filter((_, i) => (bits >> i) & 1);
    if (subset.length >= 2) subsets.push(subset);
  }
  return subsets;
}

/**
 * Equal-weight aggregate of per-workflow context estimates over a workflow
 * subset: betas averaged (the same weighting the pooled model uses), standard
 * errors combined as sqrt(Σse²)/W, a normal-approximation CI and p. These are
 * approximate companions to the statsmodels estimates — never FDR-tested —
 * so a view with a workflow disabled still shows one aggregate row per metric.
 */
function aggregateRows(
  contextRows: EstimateRow[],
  subset: string[],
  scopeId: string
): EstimateRow[] {
  const byTreatment = new Map<string, EstimateRow[]>();
  for (const row of contextRows) {
    if (!subset.includes(row.scope)) continue;
    const rows = byTreatment.get(row.treatment) ?? [];
    rows.push(row);
    byTreatment.set(row.treatment, rows);
  }
  const out: EstimateRow[] = [];
  for (const rows of byTreatment.values()) {
    const parts = rows.filter((r) => Number.isFinite(r.se) && r.se > 0);
    if (parts.length === 0) continue;
    const beta = mean(parts.map((r) => r.beta));
    const se = Math.sqrt(parts.reduce((sum, r) => sum + r.se * r.se, 0)) / parts.length;
    const first = parts[0]!;
    out.push({
      metric: first.metric,
      treatment: first.treatment,
      scope: scopeId,
      context: true,
      nControl: parts.reduce((sum, r) => sum + r.nControl, 0),
      nTreatment: parts.reduce((sum, r) => sum + r.nTreatment, 0),
      beta,
      se,
      ciLow: beta - 1.96 * se,
      ciHigh: beta + 1.96 * se,
      p: normalP(beta / se),
      pctChange: first.transform === 'none' ? null : Math.exp(beta) - 1,
      q: null,
      verdict: null,
      direction: first.direction,
      transform: first.transform,
      anomalies: null,
    });
  }
  return out.sort((a, b) => a.treatment.localeCompare(b.treatment));
}

// Rows for one metric: the headline scope, one context scope per workflow,
// and (in aggregate mode) one precomputed aggregate per proper workflow
// subset, so disabling workflows still shows a single combined row.
function scopesFor(metricKey: string, estimates: EstimateRow[], manifest: ManifestJson): Scoped[] {
  const headline = headlineRows(estimates).filter((row) => row.metric === metricKey);
  const defaultScope = defaultScopeOf(manifest);
  const scopes: Scoped[] = [];
  if (headline.length > 0) scopes.push({ scope: defaultScope, context: false, rows: headline });
  if (manifest.spec.mode === 'aggregate') {
    const contextRows = estimates.filter((row) => row.context && row.metric === metricKey);
    for (const workflow of manifest.spec.workflows) {
      const rows = contextRows.filter((row) => row.scope === workflow);
      if (rows.length > 0) scopes.push({ scope: workflow, context: true, rows });
    }
    for (const subset of workflowSubsets(manifest.spec.workflows)) {
      const scopeId = subset.join('+');
      const rows = aggregateRows(contextRows, subset, scopeId);
      if (rows.length > 0) scopes.push({ scope: scopeId, context: true, rows });
    }
  }
  return scopes;
}

function defaultScopeOf(manifest: ManifestJson): string {
  return manifest.spec.mode === 'aggregate' ? 'pooled' : (manifest.spec.workflows[0] ?? 'pooled');
}

// Shown while workflows are disabled: a single-workflow context view, or an
// equal-weight aggregate over the enabled subset. Neither is FDR-tested.
function wfBadge(manifest: ManifestJson): string {
  if (manifest.spec.mode !== 'aggregate') return '';
  return (
    '<span class="wfBadge" hidden><span class="v-single">per-workflow view — not FDR-tested</span>' +
    '<span class="v-subset">aggregated over the enabled workflows — approximate CIs, not FDR-tested</span></span>'
  );
}

/**
 * The popover's headline: both spellings of the effect whenever both are
 * well-defined — a log metric's % change made concrete at the control's own
 * level, a raw metric's delta with its size relative to the control mean.
 * Share metrics keep the single label: their delta is already in percentage
 * points, and a relative percent on top would read as a typo.
 */
function dualEffectLabel(row: EstimateRow, effect: Effect, controlMean: number | null): string {
  if (controlMean === null || controlMean <= 0 || SHARE_METRICS.has(row.metric)) {
    return effect.label;
  }
  if (row.transform === 'log' || row.transform === 'log0') {
    const absolute = controlMean * effect.value;
    return `${signed(absolute < 0, formatMetricValue(row.metric, Math.abs(absolute)))} (${effect.label})`;
  }
  return `${effect.label} (${fmtPct(effect.value / controlMean)})`;
}

function tipAttributes(
  row: EstimateRow,
  effect: Effect,
  stats: {
    control: string;
    treatment: string;
    controlMedian: string;
    treatmentMedian: string;
  },
  controlMean: number | null
): string {
  const sig = row.verdict === 'significant';
  const call = row.context
    ? `p=${formatPQ(row.p)} · not FDR-tested`
    : `q=${formatPQ(row.q ?? Number.NaN)} · ${sig ? 'significant' : 'not significant'} · n=${
        row.nControl
      }/${row.nTreatment}`;
  const naiveCall =
    `p=${formatPQ(row.p)} · ${
      isNaiveSignificant(row) ? 'significant' : 'not significant'
    } (raw, no FDR)` + ` · n=${row.nControl}/${row.nTreatment}`;
  // The metric is visible beside the plot, so the title names the arm and its
  // effect; the CI gets a line of its own.
  return (
    `data-tip-title="${escapeHtml(`${row.treatment}: ${dualEffectLabel(row, effect, controlMean)}`)}" ` +
    `data-tip-effect="${escapeHtml(`95% CI ${effect.ciLabel}`)}" ` +
    `data-tip-q="${escapeHtml(call)}" ` +
    `data-tip-qn="${escapeHtml(naiveCall)}" ` +
    `data-tip-control="${escapeHtml(stats.control)}" ` +
    `data-tip-control-median="${escapeHtml(stats.controlMedian)}" ` +
    `data-tip-treatment="${escapeHtml(stats.treatment)}" ` +
    `data-tip-treatment-median="${escapeHtml(stats.treatmentMedian)}"`
  );
}

function buildEffects(
  estimates: EstimateRow[],
  manifest: ManifestJson,
  styles: TreatmentStyle[],
  dataset: DatasetRow[]
): string {
  const byShortName = new Map(styles.map((t) => [t.shortName, t]));
  const controlName = manifest.spec.control.shortName;
  const workflows = manifest.spec.workflows;
  const defaultScope = defaultScopeOf(manifest);
  const metricByKey = new Map(manifest.metrics.map((m) => [m.key, m]));

  const familySections: string[] = [];
  const familyOrder = [...new Set(manifest.metrics.map((m) => m.family))];
  for (const family of familyOrder) {
    const metricRows: string[] = [];
    for (const metric of manifest.metrics.filter((m) => m.family === family)) {
      const scopes = scopesFor(metric.key, estimates, manifest);
      if (scopes.length === 0 || scopes.every((s) => s.rows.length === 0)) continue;
      const groups: string[] = [];
      const valueGroups: string[] = [];
      for (const { scope, context, rows } of scopes) {
        const controlMean = caseStat(dataset, controlName, metric, scope, workflows, 'mean');
        const controlMedian = caseStat(dataset, controlName, metric, scope, workflows, 'median');
        const controlCiHw = caseMeanCiHalfWidth(dataset, controlName, metric, scope, workflows);
        const ciExtents =
          controlCiHw === null ? null : spreadExtents(controlCiHw, metric.transform);
        const marks = rows
          .filter((row) => byShortName.has(row.treatment))
          .map((row) => {
            const tMean = caseStat(dataset, row.treatment, metric, scope, workflows, 'mean');
            const tMedian = caseStat(dataset, row.treatment, metric, scope, workflows, 'median');
            return {
              row,
              effect: effectOf(row),
              tMean,
              tMedian,
              meanEff: descriptiveEffect(metric.transform, controlMean, tMean),
              medianEff: descriptiveEffect(metric.transform, controlMedian, tMedian),
            };
          });
        if (marks.length === 0) continue;
        // The scale fits the effects; SD/CI bands are context and get clamped
        // to the plot edges rather than allowed to squash the dots.
        const span = Math.max(
          ...marks.flatMap(({ effect, meanEff, medianEff }) => [
            Math.abs(effect.value),
            Math.abs(effect.lo),
            Math.abs(effect.hi),
            Math.abs(meanEff ?? 0),
            Math.abs(medianEff ?? 0),
          ]),
          1e-9
        );
        const x = (v: number) => 50 + (v / span) * 44;
        const bx = (v: number) => Math.min(94, Math.max(6, x(v)));
        const controlLabel =
          controlMean === null
            ? ''
            : `<span class="fctrl" data-mean="${escapeHtml(
                formatMetricValue(metric.key, controlMean)
              )}" ` +
              `data-median="${escapeHtml(
                formatMetricValue(metric.key, controlMedian ?? controlMean)
              )}">` +
              `${escapeHtml(formatMetricValue(metric.key, controlMean))}</span>`;
        // Marks are percent-positioned HTML, not SVG: an SVG stretched to the
        // column width (preserveAspectRatio="none") scales circles into ovals.
        const plotParts = ['<span class="fzero"></span>', controlLabel];
        const labelParts: string[] = [];
        // The control's own uncertainty leads the group as a grey band: a 95%
        // CI of its mean, the same kind of interval as the treatments' bars.
        const laneOffset = ciExtents === null ? 0 : 1;
        if (ciExtents !== null) {
          const fmtBand = (v: number) =>
            metric.transform === 'none' ? formatDelta(metric.key, v) : fmtPct(v);
          const tip =
            `data-tip-title="${escapeHtml(`${controlName}: 95% CI of the mean`)}" ` +
            `data-tip-effect="${escapeHtml(
              `${fmtBand(ciExtents.lo)} to ${fmtBand(ciExtents.hi)} around the control value`
            )}"`;
          const lo = bx(ciExtents.lo);
          plotParts.push(
            `<span class="fsd tipsrc" tabindex="0" ${tip} style="left:${lo.toFixed(1)}%;width:${(
              bx(ciExtents.hi) - lo
            ).toFixed(1)}%;top:${18 + 0.5 * 16}px"></span>`
          );
          // An empty label still occupies the control's slot in the value
          // column, so treatment values keep lining up with their lanes; the
          // legend names the range.
          labelParts.push('<span class="flab fsdlab">&nbsp;</span>');
        }
        marks.forEach(({ row, effect, tMean, tMedian, meanEff, medianEff }, i) => {
          const t = byShortName.get(row.treatment)!;
          const lane = 18 + (i + laneOffset + 0.5) * 16;
          const sig = row.verdict === 'significant';
          const sigP = isNaiveSignificant(row);
          const stats = {
            control: controlMean === null ? '' : formatMetricValue(metric.key, controlMean),
            controlMedian:
              controlMedian === null ? '' : formatMetricValue(metric.key, controlMedian),
            treatment: tMean === null ? '' : formatMetricValue(metric.key, tMean),
            treatmentMedian: tMedian === null ? '' : formatMetricValue(metric.key, tMedian),
          };
          const tip = tipAttributes(row, effect, stats, controlMean);
          const lo = x(effect.lo);
          // Significance styling (dot fill, CI/label dimming) lives in CSS keyed
          // on data-sig / data-sig-p so the Test toggle can switch it live.
          const sigAttrs = `${context ? '' : ` data-sig="${sig ? 1 : 0}"`} data-sig-p="${
            sigP ? 1 : 0
          }"`;
          // The dot sits at the shift of the selected statistic; the CI is the
          // model's and stays put, so the mean dot can sit off its center.
          const xMean = x(meanEff ?? effect.value).toFixed(1);
          const xMedian = x(medianEff ?? effect.value).toFixed(1);
          plotParts.push(
            `<span class="fmark" data-t="${t.slug}"${sigAttrs} style="--tc:var(--c-${t.slug})">` +
              `<span class="fci" style="left:${lo.toFixed(1)}%;width:${(x(effect.hi) - lo).toFixed(
                1
              )}%;top:${lane}px"></span>` +
              `<span class="fdot tipsrc" tabindex="0" ${tip} data-left-mean="${xMean}%" ` +
              `data-left-median="${xMedian}%" ` +
              `style="left:${xMean}%;top:${lane}px"></span>` +
              '</span>'
          );
          labelParts.push(
            `<span class="flab fmark-lab tipsrc" tabindex="0" data-t="${t.slug}"` +
              `${sigAttrs} ${tip} style="color:var(--c-${t.slug})">` +
              `${escapeHtml(effect.label)}</span>`
          );
        });
        const height = 18 + (marks.length + laneOffset) * 16 + 6;
        const hidden = scope === defaultScope ? '' : ' hidden';
        // The tag names the workflow (or workflow subset) behind a context view.
        const groupTag =
          scope === 'pooled'
            ? ''
            : `<span class="fgw">${escapeHtml(scope.split('+').join(' + '))}</span>`;
        groups.push(
          `<div class="fgroup" data-scope="${escapeHtml(
            scope
          )}"${hidden} style="height:${height}px">${groupTag}${plotParts.join('')}</div>`
        );
        valueGroups.push(
          `<div class="fvgroup" data-scope="${escapeHtml(scope)}"${hidden}>${labelParts.join(
            ''
          )}</div>`
        );
      }
      if (groups.length === 0) continue;
      const desc = metricDescription(metric.key);
      // The direction gets its own line: run into the description it reads as
      // part of the sentence rather than as the metric's polarity.
      const descLabel = desc ? `${escapeHtml(desc)}<br>` : '';
      const extraAttr = EXTRA_METRICS.has(metric.key) ? ' data-extra="1"' : '';
      metricRows.push(
        `<div class="frow"${extraAttr}>` +
          `<div class="fmeta">${metricNameHtml(metric.key, 'fname')}` +
          `<span class="fdesc">${descLabel}${directionText(metric.direction)}</span></div>` +
          `<div class="fplot">${groups.join('')}</div>` +
          `<div class="fvals">${valueGroups.join('')}</div>` +
          '</div>'
      );
    }
    if (metricRows.length === 0) continue;
    const meta = FAMILIES[family] ?? { name: family, intro: '' };
    familySections.push(
      `<section class="family" data-family="${escapeHtml(family)}">` +
        `<h3>${escapeHtml(meta.name)}</h3>` +
        (meta.intro ? `<p class="family-intro">${escapeHtml(meta.intro)}</p>` : '') +
        metricRows.join('\n') +
        '</section>'
    );
  }
  void metricByKey;

  const badge = wfBadge(manifest);
  return `
<div class="effects-head">
<div class="glyphs">
<span class="glyph"><span class="g-dot solid"></span>significant (<span class="m-fdr">q &le; 0.05</span><span class="m-naive">p &lt; 0.05, raw</span>)</span>
<span class="glyph"><span class="g-dot hollow"></span>not significant</span>
<span class="glyph"><span class="g-ci"></span>95% CI</span>
<span class="glyph"><span class="g-line"></span>center line = control value</span>
<span class="glyph">dot = shift of the selected statistic; CI from the model</span>
<span class="glyph">% for log-scaled metrics, absolute &Delta; otherwise</span>
<span class="glyph">hover a dot or value for exact numbers</span>
</div>
<div class="effects-tools">
<span class="select">Statistic
<span class="seg stat-toggle">
<button type="button" data-stat="mean" aria-pressed="true">mean</button><button type="button" data-stat="median" aria-pressed="false">median</button>
</span></span>
${badge}
</div>
</div>
${familySections.join('\n')}
<p class="empty-note" id="effectsEmpty" hidden>Nothing matches the current filters.</p>
<div class="secjump" role="group" aria-label="Jump between sections">
<button type="button" class="secbtn" data-dir="-1" aria-label="Previous section">↑</button>
<button type="button" class="secbtn" data-dir="1" aria-label="Next section">↓</button>
</div>`;
}

// The verdict, folded into the Effect column as a suffix icon: colored arrows
// for significant directional results, ± for a significant change of a
// descriptive metric, ? in gray when no call can be made.
function verdictIcon(row: EstimateRow, effect: Effect, mode: 'fdr' | 'naive'): string {
  const icon = (cls: string, tip: string, glyph: string) =>
    `<span class="vicon ${cls} tipsrc" tabindex="0" data-tip-title="${escapeHtml(
      tip
    )}">${glyph}</span>`;
  if (mode === 'fdr' && row.context) return icon('na', 'not FDR-tested (per-workflow view)', '?');
  const sig = mode === 'fdr' ? row.verdict === 'significant' : isNaiveSignificant(row);
  const call = mode === 'fdr' ? `q=${formatPQ(row.q ?? Number.NaN)}` : `p=${formatPQ(row.p)}, raw`;
  if (!sig) {
    return icon(
      'na',
      `not significant at ${mode === 'fdr' ? 'FDR 5%' : 'raw p < 0.05'} (${call})`,
      '?'
    );
  }
  if (row.direction === 'neutral') {
    return icon('shift', 'significant — changed (descriptive metric)', '±');
  }
  const better = isBetter(effect.value, row.direction);
  return icon(
    better ? 'good' : 'bad',
    `significant — ${better ? 'better' : 'worse'} (${call})`,
    effect.value < 0 ? '↓' : '↑'
  );
}

// Both modes' icons; CSS shows the one matching body[data-sigmode].
function verdictIcons(row: EstimateRow, effect: Effect): string {
  return (
    `<span class="m-fdr">${verdictIcon(row, effect, 'fdr')}</span>` +
    `<span class="m-naive">${verdictIcon(row, effect, 'naive')}</span>`
  );
}

function buildFullReport(
  estimates: EstimateRow[],
  manifest: ManifestJson,
  styles: TreatmentStyle[]
): string {
  const byShortName = new Map(styles.map((t) => [t.shortName, t]));
  const orderedMetrics = manifest.metrics.map((m) => m.key);
  const defaultScope = defaultScopeOf(manifest);
  const sortRows = (a: EstimateRow, b: EstimateRow) => {
    const byMetric = orderedMetrics.indexOf(a.metric) - orderedMetrics.indexOf(b.metric);
    if (byMetric !== 0) return byMetric;
    return a.treatment.localeCompare(b.treatment);
  };
  const headline = [...headlineRows(estimates)].sort(sortRows);
  const contexts =
    manifest.spec.mode === 'aggregate'
      ? [...estimates.filter((row) => row.context)].sort(sortRows)
      : [];
  // A pair whose n falls below its arm's usual sample lost runs to missing
  // values for that metric; the * marker calls that out.
  const maxN = new Map<string, { c: number; t: number }>();
  for (const row of [...headline, ...contexts]) {
    const key = `${row.treatment} ${row.context ? row.scope : defaultScope}`;
    const entry = maxN.get(key) ?? { c: 0, t: 0 };
    entry.c = Math.max(entry.c, row.nControl);
    entry.t = Math.max(entry.t, row.nTreatment);
    maxN.set(key, entry);
  }
  let anomalyTotal = 0;
  const trs = [...headline, ...contexts]
    .map((row) => {
      const t = byShortName.get(row.treatment);
      if (!t) return '';
      const effect = effectOf(row);
      const sig = row.verdict === 'significant';
      const scope = row.context ? row.scope : defaultScope;
      const hidden = scope === defaultScope ? '' : ' hidden';
      const sigAttr =
        (row.context ? '' : ` data-sig="${sig ? 1 : 0}"`) +
        ` data-sig-p="${isNaiveSignificant(row) ? 1 : 0}"` +
        (EXTRA_METRICS.has(row.metric) ? ' data-extra="1"' : '');
      const anomalies = row.anomalies ?? 0;
      if (!row.context) anomalyTotal += anomalies;
      const anomalyMarker =
        anomalies > 0 ? `<sup title="${anomalies} anomalous value(s) excluded">&dagger;</sup>` : '';
      const arm = maxN.get(`${row.treatment} ${scope}`)!;
      const nMarker =
        row.nControl < arm.c || row.nTreatment < arm.t
          ? `<sup class="nnote tipsrc" tabindex="0" data-tip-title="n=${row.nControl}/${row.nTreatment} — some runs lack this metric">*</sup>`
          : '';
      return (
        `<tr class="t-${t.slug}" data-t="${t.slug}" data-scope="${escapeHtml(
          scope
        )}"${sigAttr}${hidden}>` +
        `<td>${metricNameHtml(row.metric, '')}${anomalyMarker}${nMarker}</td>` +
        `<td><span class="dot" style="background:var(--c-${t.slug})"></span>${escapeHtml(
          row.treatment
        )}${row.context ? ` <span class="rowwf">· ${escapeHtml(row.scope)}</span>` : ''}</td>` +
        `<td class="num">${escapeHtml(effect.label)} ${verdictIcons(row, effect)}</td>` +
        `<td class="num">${escapeHtml(effect.ciLabel)}</td>` +
        `<td class="num">${escapeHtml(formatBeta(row.beta))}</td>` +
        `<td class="num">${escapeHtml(formatPQ(row.p))}</td>` +
        `<td class="num">${row.q === null ? '—' : escapeHtml(formatPQ(row.q))}</td></tr>`
      );
    })
    .join('\n');

  const tested = new Set(headline.map((row) => `${row.metric} ${row.treatment}`));
  const untested: string[] = [];
  for (const metric of manifest.metrics) {
    for (const t of manifest.spec.treatments) {
      if (!tested.has(`${metric.key} ${t.shortName}`)) {
        untested.push(
          `<li><span class="mono">${escapeHtml(metric.key)}</span> × ${escapeHtml(
            t.shortName
          )}</li>`
        );
      }
    }
  }
  const untestedSection =
    untested.length > 0
      ? `
<h3>Not tested</h3>
<p class="note">No estimate exists for these pairs (too few values, or a degenerate fit).</p>
<ul class="untested">${untested.join('\n')}</ul>`
      : '';

  const excluded = manifest.excludedRuns ?? [];
  const excludedSection =
    excluded.length > 0
      ? `
<h3>Excluded runs</h3>
<ul class="untested">${excluded
          .map(
            (run) =>
              `<li><span class="mono">${escapeHtml(run.path ?? '')}</span> — ${escapeHtml(
                run.reason ?? ''
              )}</li>`
          )
          .join('\n')}</ul>`
      : '';

  const anomalyNote =
    anomalyTotal > 0
      ? `
<p class="note">&dagger; ${anomalyTotal} value(s) &le; 0 were excluded from log-scaled metrics; see report.md for the run list.</p>`
      : '';

  return `
${wfBadge(manifest)}
<div class="tablewrap tall"><table id="verdictTable">
<thead><tr><th>Metric</th><th>Arm</th><th class="num">Effect</th><th class="num">95% CI</th><th class="num nocase tipsrc" tabindex="0" data-tip-title="β — regression coefficient" data-tip-effect="The effect on the model scale: a difference in means for raw metrics, a log-ratio for log-scaled ones (the Effect column shows it as a % change).">β</th><th class="num nocase tipsrc" tabindex="0" data-tip-title="p — raw p-value" data-tip-effect="The chance of an effect at least this large when the treatment truly does nothing (HC3-robust t-test), before correcting for running many tests at once.">p</th><th class="num nocase tipsrc" tabindex="0" data-tip-title="q — corrected p-value" data-tip-effect="p adjusted for the whole test grid with Benjamini–Hochberg false-discovery-rate control. Significant iff q ≤ 0.05.">q</th></tr></thead>
<tbody>
${trs}
</tbody>
</table></div>
<p class="empty-note" id="fullEmpty" hidden>Nothing matches the current filters.</p>
<p class="note">Icons follow each metric's own direction: colored arrows mark significant
improvements or regressions, ± a significant change of a descriptive metric, and ? no call
(the bar is <span class="m-fdr">q&nbsp;&le;&nbsp;0.05</span><span class="m-naive">p&nbsp;&lt;&nbsp;0.05,
uncorrected</span>). * marks a pair where some runs lack the metric. β is on the
model scale (log for log-scaled metrics); Effect and CI are on the display
scale.</p>${anomalyNote}${untestedSection}${excludedSection}`;
}

// Strip the XML prolog, DOCTYPE, and matplotlib <metadata> block matplotlib
// emits — everything before the opening <svg> tag except that tag itself,
// plus the rdf metadata block matplotlib nests just inside it.
function stripSvgWrapper(svg: string): string {
  const svgStart = svg.indexOf('<svg');
  const body = svgStart >= 0 ? svg.slice(svgStart) : svg;
  return body.replace(/<metadata>[\s\S]*?<\/metadata>/, '');
}

function buildCurves(curves: CurveInput[], manifest: ManifestJson): string {
  const orderedMetrics = manifest.metrics.map((m) => m.key);
  const sorted = [...curves].sort((a, b) => {
    const byMetric = orderedMetrics.indexOf(a.metric) - orderedMetrics.indexOf(b.metric);
    if (byMetric !== 0) return byMetric;
    return a.workflow.localeCompare(b.workflow);
  });
  const multiScope = manifest.spec.workflows.length > 1;
  const details = sorted
    .map((curve) => {
      const title = multiScope
        ? `${metricName(curve.metric)} · ${curve.workflow}`
        : metricName(curve.metric);
      const extraAttr = EXTRA_METRICS.has(curve.metric) ? ' data-extra="1"' : '';
      return (
        `<details class="curve" data-workflow="${escapeHtml(curve.workflow)}"${extraAttr}><summary>` +
        escapeHtml(title) +
        '</summary><div class="curve-card">' +
        stripSvgWrapper(curve.svg) +
        '</div></details>'
      );
    })
    .join('\n');
  const empty = sorted.length === 0 ? '<p class="note">No curves were generated.</p>' : '';
  return `
<p class="note">Empirical CDF of every run per arm. Case toggles cannot reach inside these
static images. Curves render on a white card in both themes: the source SVGs assume a white
ground.</p>
${details}${empty}`;
}

// The misuse questions, worded for a reader who has not seen the judge's
// prompt. Order matches MISUSE_QUESTIONS so summary columns and finding
// groups line up.
const MISUSE_QUESTION_META: Record<MisuseQuestion, { label: string; description: string }> = {
  correctDsDecision: {
    label: 'Right component?',
    description:
      'The right design-system component for the job, or a better DS alternative existed.',
  },
  correctDsUsage: {
    label: 'Used per the docs?',
    description: 'Whether the usage violates a documented guideline.',
  },
  correctLocalDecision: {
    label: 'Rightly local?',
    description: 'Whether a local component was justified, or a DS component covered the need.',
  },
};

function distributionCell(
  distribution: ScoreDistribution | null,
  cell: MisuseCellSummary,
  question: MisuseQuestion
): string {
  if (distribution === null) {
    return '<td class="dist-cell none" title="No node received this question">—</td>';
  }
  const total = distribution.ones + distribution.halves + distribution.zeros;
  const width = (n: number) => ((n / total) * 100).toFixed(1);
  const seg = (kind: string, n: number) =>
    n === 0 ? '' : `<span class="seg ${kind}" style="width:${width(n)}%"></span>`;
  // Below-perfect counts link to the verdicts they count: each becomes a jump
  // button targeting the findings that share its cell, question, and score.
  const jump = (kind: 's05' | 's0', n: number) => {
    if (n === 0) return `<b class="${kind}">0</b>`;
    return (
      `<button type="button" class="mjump ${kind}" data-case="${slug(cell.case)}" ` +
      `data-case-name="${escapeHtml(cell.case)}" ` +
      `data-workflow="${escapeHtml(cell.workflow)}" data-q="${question}" ` +
      `data-qlabel="${escapeHtml(MISUSE_QUESTION_META[question].label)}" ` +
      `data-score="${kind === 's0' ? '0' : '05'}" ` +
      `title="Show the ${n} finding(s) behind this count">${n}</button>`
    );
  };
  const counts = [
    `<b class="s1">${distribution.ones}</b>`,
    jump('s05', distribution.halves),
    jump('s0', distribution.zeros),
  ].join('<span class="sep">·</span>');
  return (
    `<td class="dist-cell" title="${total} node(s): ${distribution.ones} scored 1, ` +
    `${distribution.halves} scored 0.5, ${distribution.zeros} scored 0">` +
    `<div class="dist">${seg('good', distribution.ones)}${seg('half', distribution.halves)}${seg(
      'zero',
      distribution.zeros
    )}</div><span class="num">${counts}</span></td>`
  );
}

function misuseSummaryTable(
  cells: MisuseCellSummary[],
  workflow: string | null,
  controlShortName: string
): string {
  const rows = cells
    .map((cell) => {
      const coverage =
        cell.judged === cell.usable
          ? `${cell.judged}/${cell.usable}`
          : `<b class="partial">${cell.judged}/${cell.usable}</b>`;
      const caseAttr =
        cell.case === controlShortName
          ? ' class="m-case"'
          : ` class="m-case" data-t="${slug(cell.case)}"`;
      return (
        `<tr${caseAttr}><th scope="row">${escapeHtml(cell.case)}</th>` +
        `<td class="num">${coverage}</td>` +
        `<td class="num">${cell.evaluated.ds} · ${cell.evaluated.local}</td>` +
        MISUSE_QUESTIONS.map((question) =>
          distributionCell(cell.questions[question], cell, question)
        ).join('') +
        '</tr>'
      );
    })
    .join('\n');
  const heading = workflow === null ? '' : `<h3>${escapeHtml(workflow)}</h3>`;
  const wfAttr = workflow === null ? '' : ` data-workflow="${escapeHtml(workflow)}"`;
  return `<div class="m-wf"${wfAttr}>${heading}
<div class="tablewrap"><table class="misuse-summary">
<thead><tr><th scope="col">Case</th><th scope="col" title="Runs judged / usable runs">Judged</th>
<th scope="col" title="Nodes evaluated: design-system · local">DS · local</th>
${MISUSE_QUESTIONS.map(
  (question) =>
    `<th scope="col" title="${escapeHtml(MISUSE_QUESTION_META[question].description)}">${escapeHtml(
      MISUSE_QUESTION_META[question].label
    )}</th>`
).join('')}
</tr></thead>
<tbody>${rows}</tbody>
</table></div></div>`;
}

function misuseFinding(
  finding: MisuseDecision,
  docsPin: { repo: string; ref: string } | null
): string {
  const score = finding.score === 0 ? '<b class="score zero">0</b>' : '<b class="score half">½</b>';
  return `<article class="finding m-wf" data-workflow="${escapeHtml(finding.workflow)}" data-case="${slug(
    finding.case
  )}" data-q="${finding.question}" data-score="${finding.score === 0 ? '0' : '05'}">
<div class="finding-head">${score}
<span class="mono tag">&lt;${escapeHtml(finding.tag)}&gt;</span>
<span class="q">${escapeHtml(MISUSE_QUESTION_META[finding.question].label)}</span>
<button type="button" class="mopen" data-path="${escapeHtml(finding.projectPath)}/${escapeHtml(
    finding.file
  )}" data-line="${finding.line}" title="Open in your editor (set the repo root via the ? button)">open</button>
<button type="button" class="mopen mcmds" data-project="${escapeHtml(
    finding.projectPath
  )}" data-file="${escapeHtml(finding.file)}" data-line="${finding.line}"${
    finding.inBaseline === false ? ' data-new-file="1"' : ''
  } title="Commands for digging into this finding">cmds</button>
</div>
<div class="finding-meta"><span class="mono where">${escapeHtml(finding.file)}:${finding.line}</span>
<span class="mono run">${escapeHtml(finding.workflow)} · ${escapeHtml(finding.runLabel)}</span></div>
${finding.reasons
  .map(
    (reason) =>
      `<p class="reason">${
        reason.facet === undefined ? '' : `<span class="mono">[${escapeHtml(reason.facet)}]</span> `
      }${linkifyReason(reason.text, docsPin)}</p>`
  )
  .join('\n')}
${findingExcerpt(finding)}
</article>`;
}

// Guideline documents that live under src/docs rather than beside a component.
const DS_DOC_PAGES = new Set([
  'AccessibilityGuidelines',
  'BrandGuidelines',
  'ChoosingComponents',
  'DesignTokensColor',
  'DesignTokensMotion',
  'DesignTokensSpacing',
  'DesignTokensTypography',
  'GettingStarted',
  'TechnicalGuidelines',
]);

/**
 * Judge reasons cite their sources by name — "Badge.mdx", "BrandGuidelines",
 * "#268". Those become links into the pinned docs and the DS repo's issues, so
 * checking a citation costs one click on any machine, no local setup.
 */
function linkifyReason(reason: string, docsPin: { repo: string; ref: string } | null): string {
  const escaped = escapeHtml(reason);
  if (docsPin === null) return escaped;
  const base = `https://github.com/${docsPin.repo}`;
  const docHref = (name: string) =>
    DS_DOC_PAGES.has(name)
      ? `${base}/blob/${docsPin.ref}/src/docs/${name}.mdx`
      : `${base}/blob/${docsPin.ref}/src/components/${name}/${name}.mdx`;
  return escaped
    .replace(
      /(?<!&)#(\d+)\b/g,
      `<a href="${base}/issues/$1" target="_blank" rel="noopener">#$1</a>`
    )
    .replace(
      /\b([A-Z][A-Za-z]+)\.mdx\b/g,
      (_, name: string) =>
        `<a href="${docHref(name)}" target="_blank" rel="noopener">${name}.mdx</a>`
    )
    .replace(
      /\b(AccessibilityGuidelines|BrandGuidelines|ChoosingComponents|DesignTokensColor|DesignTokensMotion|DesignTokensSpacing|DesignTokensTypography|TechnicalGuidelines)\b(?![^<]*<\/a>)/g,
      (_, name: string) => `<a href="${docHref(name)}" target="_blank" rel="noopener">${name}</a>`
    );
}

/** The flagged source under the reason, the finding's line marked. */
function findingExcerpt(finding: MisuseDecision): string {
  if (finding.excerpt === undefined) return '';
  const gutter = String(finding.excerpt.start + finding.excerpt.lines.length - 1).length;
  const rows = finding.excerpt.lines
    .map((text, index) => {
      const lineNo = finding.excerpt!.start + index;
      const row = `${String(lineNo).padStart(gutter)}  ${escapeHtml(text)}`;
      return lineNo === finding.line ? `<mark>${row}</mark>` : row;
    })
    .join('\n');
  return `<pre class="excerpt"><code>${rows}</code></pre>`;
}

function docsPinOf(panel: MisusePanel): { repo: string; ref: string } | null {
  const ref = (panel.guidelinesRefs ?? [])[0];
  if (ref === undefined) return null;
  const at = ref.lastIndexOf('@');
  return at === -1 ? null : { repo: ref.slice(0, at), ref: ref.slice(at + 1) };
}

/**
 * The panel's decisions kept whole, perfect scores included, so charts get
 * true denominators; this report's finding cards only ever show the rest —
 * every renderer downstream of this filter sees exactly what it always saw.
 */
function belowPerfectDecisions(panel: MisusePanel): MisuseDecision[] {
  return panel.decisions.filter((decision) => decision.score !== 1);
}

function misuseFindings(panel: MisusePanel, controlShortName: string): string {
  const docsPin = docsPinOf(panel);
  const findings = belowPerfectDecisions(panel);
  if (findings.length === 0) {
    return `<h2>What the judge flagged</h2>
<p class="lede">Nothing. Every judged node scored 1 on every question it received.</p>`;
  }
  const byCase = new Map<string, MisuseDecision[]>();
  for (const finding of findings) {
    const list = byCase.get(finding.case) ?? [];
    list.push(finding);
    byCase.set(finding.case, list);
  }
  const groups = [...byCase.entries()]
    .map(([caseName, findings]) => {
      const zeros = findings.filter((f) => f.score === 0).length;
      const caseAttr = caseName === controlShortName ? '' : ` data-t="${slug(caseName)}"`;
      return `<details class="finding-group m-case"${caseAttr} open>
<summary><b>${escapeHtml(caseName)}</b> — ${findings.length} finding(s), ${zeros} scored 0</summary>
${findings.map((finding) => misuseFinding(finding, docsPin)).join('\n')}
</details>`;
    })
    .join('\n');
  return `<h2>What the judge flagged</h2>
<p class="lede">Every verdict below 1, verbatim from the judge, worst first. A finding names the
guideline it rests on; one that does not is a judge bug worth filing.</p>
${groups}`;
}

function buildMisuse(panel: MisusePanel | undefined, manifest: ManifestJson): string {
  const intro = `<p class="lede">DS coverage measures how much of a run's UI came from the design
system; this panel measures whether it was used well. An LLM judge scores every JSX node a run
introduced against the design system's own documentation — 1 sound, 0.5 debatable, 0 wrong —
and gives a reason for each verdict.</p>`;

  if (panel === undefined || panel.judgedRuns === 0) {
    return `<h2>DS misuse</h2>${intro}
<div class="empty-state">
<p><b>No run in this comparison has been judged yet.</b> Judging is a separate, paid step
(one model call per run) and its verdicts are cached per run, so a bundle regenerated after
judging picks them up automatically.</p>
<p class="mono">yarn workspace agent-eval run judge:ds-misuse --dry &nbsp;# plan first, spend nothing<br>
yarn workspace agent-eval run judge:ds-misuse ${manifest.spec.plan === null ? '' : `--plan ${escapeHtml(manifest.spec.plan)} `}&nbsp;# then judge, and re-run results:compare</p>
</div>`;
  }

  const coverage =
    panel.judgedRuns === panel.usableRuns
      ? `<p class="lede">All ${panel.usableRuns} usable runs are judged.</p>`
      : `<p class="lede"><b class="partial">${panel.judgedRuns} of ${panel.usableRuns}</b> usable runs
are judged; unjudged runs contribute nothing below. <span class="mono">yarn workspace agent-eval run judge:ds-misuse</span>
judges the rest and a fresh <span class="mono">results:compare</span> picks them up.</p>`;

  const pinWarning =
    panel.guidelinesRefs.length > 1
      ? `<div class="warn"><b>Mixed guideline pins.</b> Judgements in this bundle were scored against
${panel.guidelinesRefs.length} different guideline versions (${panel.guidelinesRefs
          .map((ref) => `<span class="mono">${escapeHtml(ref)}</span>`)
          .join(', ')}), so their scores are not comparable. Re-judge with
<span class="mono">yarn workspace agent-eval run judge:ds-misuse --recompute</span>.</div>`
      : '';

  const controlShortName = manifest.spec.control.shortName;
  const workflows = [...new Set(panel.cells.map((cell) => cell.workflow))];
  const tables =
    workflows.length === 1
      ? misuseSummaryTable(panel.cells, null, controlShortName)
      : workflows
          .map((workflow) =>
            misuseSummaryTable(
              panel.cells.filter((cell) => cell.workflow === workflow),
              workflow,
              controlShortName
            )
          )
          .join('\n');

  const ref = panel.guidelinesRefs[0];
  const judgedAgainst =
    panel.guidelinesRefs.length === 1 && ref !== undefined
      ? `<p class="fineprint">Every arm is judged against the complete pinned guidelines
(<span class="mono">${escapeHtml(ref)}</span>) — deliberately not the docs variant it was served,
so a degraded arm is scored against the same bar as the rest.</p>`
      : '';

  // Older staged bundles predate these fields; the help text degrades to
  // placeholders instead of refusing to render them.
  const fixture = (panel.fixtureRefs ?? [])[0] ?? '<repo>@<ref>';
  const baselineDir = fixture
    .replace('/', '__')
    .replace('@', '@')
    .replace(/@(.+)$/, (_, ref: string) => `@${ref.replace(/\//g, '__')}`);
  const example = belowPerfectDecisions(panel)[0];
  const examplePath = example
    ? `${example.projectPath}/${example.file}`
    : 'agent-eval/results/<experiment>/<batch>/<workflow>/run-N/project/src/File.tsx';
  const exampleProject = example
    ? example.projectPath
    : 'agent-eval/results/<experiment>/<batch>/<workflow>/run-N/project';
  const help = `<dialog class="misuse-modal" id="misuseHelpModal">
<div class="modal-head"><b>Digging into a finding</b>
<button type="button" class="modal-close" data-close="misuseHelpModal">Close</button></div>
<div class="modal-body">
<p class="lede">Every finding lives in a run directory this repo already holds. Paths below are
relative to the repo root; the <i>open</i> buttons resolve them against
<span class="mono" id="misuseRootShown"></span>
<button type="button" class="modal-close" id="misuseRootChange">Change</button></p>
<h3>Read the code</h3>
<p class="mono mcmd" data-cmd="code $ROOT/${escapeHtml(examplePath)}"></p>
<h3>Diff the run against its pinned baseline</h3>
<p class="mono mcmd" data-cmd="git diff --no-index $ROOT/agent-eval/.eval-cache/refs/${escapeHtml(
    baselineDir
  )}/src $ROOT/${escapeHtml(exampleProject)}/src"></p>
<p class="fineprint">Comparing the src trees keeps the harness's __agent_eval__ directory and the
lockfiles out of the diff. The pin is ${escapeHtml(fixture)}. On a machine that has never analyzed
or judged, materialize the baseline cache once:</p>
<p class="mono mcmd" data-cmd="yarn --cwd $ROOT/agent-eval results:analyze --recompute"></p>
<h3>Read the agent's reasoning</h3>
<p class="mono mcmd" data-cmd="less $ROOT/${escapeHtml(exampleProject)}/__agent_eval__/transcript.txt"></p>
<p class="fineprint">The transcript shows why the agent chose the flagged component — often the real answer.</p>
<h3>Run the app</h3>
<p class="mono mcmd" data-cmd="cd $ROOT/${escapeHtml(exampleProject)}"></p>
<p class="fineprint">Then install and start it the way its own package.json scripts say — fixtures
differ. The tree sits inside this repo's yarn workspace, so yarn resolves against the workspace and
fails; use npm here, or copy the tree outside the repo first.</p>
<h3>Re-judge after changing the rubric</h3>
<p class="mono mcmd" data-cmd="yarn --cwd $ROOT/agent-eval judge:ds-misuse --dry"></p>
<p class="fineprint">Reading artifacts is always free; only judging spends. Paths above name this
bundle's first finding — swap in any finding's run directory.</p>
</div>
</dialog>`;
  return `<h2>DS misuse <button type="button" class="mhelp" id="misuseHelpBtn" title="How to dig into a finding">?</button></h2>
<div data-built-from="${escapeHtml(panel.builtFrom ?? '')}" data-baseline-dir="${escapeHtml(
    baselineDir
  )}" id="misuseRootHint" hidden></div>
<dialog class="misuse-modal" id="misuseCmdModal">
<div class="modal-head"><b>Dig into this finding</b>
<button type="button" class="modal-close" data-close="misuseCmdModal">Close</button></div>
<div class="modal-body" id="misuseCmdBody"></div>
</dialog>
${help}${intro}${coverage}${pinWarning}
<h3 class="sr-only">Scores</h3>
${tables}
<p class="fineprint">Counts are pooled nodes across a cell's judged runs, shown as
<b class="s1">1</b><span class="sep">·</span><b class="s05">0.5</b><span class="sep">·</span><b class="s0">0</b>.
An em dash means no node received that question — absence of evidence, not a zero.</p>
${judgedAgainst}
${misuseFindings(panel, controlShortName)}
<dialog class="misuse-modal" id="misuseModal">
<div class="modal-head"><b id="misuseModalTitle"></b><span class="mono" id="misuseModalMeta"></span>
<button type="button" class="modal-close" id="misuseModalClose">Close</button></div>
<div class="modal-body" id="misuseModalBody"></div>
</dialog>`;
}

function buildTabs(panels: { id: string; label: string; body: string }[]): string {
  const tabs = panels
    .map(
      (panel, i) =>
        `<button class="tab" role="tab" id="tab-${panel.id}" aria-controls="panel-${panel.id}" ` +
        `aria-selected="${i === 0 ? 'true' : 'false'}"${i === 0 ? '' : ' tabindex="-1"'}>${
          panel.label
        }</button>`
    )
    .join('\n');
  const sections = panels
    .map(
      (panel, i) =>
        `<section class="panel" id="panel-${panel.id}" role="tabpanel" aria-labelledby="tab-${
          panel.id
        }"${i === 0 ? '' : ' hidden'}>
${panel.body}
</section>`
    )
    .join('\n');
  return `
<div class="tabs" role="tablist" aria-label="Report sections">
${tabs}
</div>
${sections}`;
}

function buildStyle(styles: TreatmentStyle[]): string {
  const lightVars = styles.map((t) => `--c-${t.slug}:${t.lightColor};`).join(' ');
  const darkVars = styles.map((t) => `--c-${t.slug}:${t.darkColor};`).join(' ');
  return `
:root {
  --surface:#FAF9F7; --ink:#1B1E22; --ink-2:#4A5058; --ink-3:#8A9098;
  --line:#E4E1DB; --card:#FFFFFF; --wash:#F1EFEA;
  --good:#0B7A45; --bad:#B4232A; --half:#B7791F;
  ${lightVars}
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --surface:#16181C; --ink:#E8E6E1; --ink-2:#AFB4BB; --ink-3:#767C85;
  --line:#2C2F35; --card:#1D2025; --wash:#22252B;
  --good:#3AA46F; --bad:#D96B70; --half:#D9A441;
  ${darkVars}
} }
:root[data-theme="dark"] {
  --surface:#16181C; --ink:#E8E6E1; --ink-2:#AFB4BB; --ink-3:#767C85;
  --line:#2C2F35; --card:#1D2025; --wash:#22252B;
  --good:#3AA46F; --bad:#D96B70; --half:#D9A441;
  ${darkVars}
}
* { box-sizing:border-box; }
::selection { background:var(--ink); color:var(--surface); }
[hidden] { display:none !important; }
body { background:var(--surface); color:var(--ink); margin:0;
  font:16px/1.6 "IBM Plex Sans",system-ui,sans-serif; }
main { max-width:920px; margin:0 auto; padding:48px 24px 96px; }
h1,h2,h3 { font-family:Spectral,Georgia,serif; text-wrap:balance; line-height:1.2; }
h1 { font-size:2.1rem; font-weight:700; margin:8px 0 4px; }
h2 { font-size:1.3rem; font-weight:600; margin:36px 0 12px; }
h3 { font-size:1.05rem; font-weight:600; margin:32px 0 6px; }
.eyebrow { font-size:.72rem; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-3); font-weight:600; }
.lede { color:var(--ink-2); max-width:62ch; }
.mono, .num { font-family:"IBM Plex Mono",monospace; font-variant-numeric:tabular-nums; font-size:.86em; }
.filterbar { display:flex; flex-direction:column; gap:10px; margin:22px 0 0;
  padding:12px 14px; background:var(--wash); border:1px solid var(--line); border-radius:12px;
  position:sticky; top:0; z-index:30; box-shadow:0 6px 18px rgba(0,0,0,.10); }
.filterbar.stuck { border-radius:0; }
.fbrow { display:flex; flex-wrap:wrap; gap:10px 18px; align-items:center; }
.fbopts { border-top:1px solid var(--line); padding-top:10px; }
.legend { display:flex; gap:8px; flex-wrap:wrap; font-size:.85rem; margin-right:auto; }
body[data-sigmode="fdr"] .m-naive { display:none; }
body[data-sigmode="naive"] .m-fdr { display:none; }
body[data-wfview="single"] .v-subset { display:none; }
body[data-wfview="subset"] .v-single { display:none; }
.chip-toggle { display:inline-flex; align-items:center; gap:7px; font:inherit; font-weight:600;
  color:var(--ink-2); background:var(--card); border:1px solid var(--line); border-radius:99px;
  padding:4px 12px; cursor:pointer; }
.chip-toggle[aria-pressed="false"] { opacity:.4; }
.chip-toggle .dot { background:var(--tc); margin:0; }
.select { display:inline-flex; align-items:center; gap:7px; font-size:.72rem; font-weight:600;
  letter-spacing:.07em; text-transform:uppercase; color:var(--ink-3); }
.wfpills { display:inline-flex; gap:6px; flex-wrap:wrap; }
.wf-toggle { padding:4px 10px; font-size:.8rem; }
.fgw { position:absolute; left:0; top:0; font:500 .68rem/1.3 "IBM Plex Mono",monospace;
  color:var(--ink-3); display:none; }
body[data-multiwf="1"] .fgw { display:block; }
.rowwf { color:var(--ink-3); font-size:.8em; display:none; }
body[data-multiwf="1"] .rowwf { display:inline; }
#resetFilters { font:600 .8rem/1.4 "IBM Plex Sans",system-ui,sans-serif; color:var(--ink-2);
  background:none; border:1px solid var(--line); border-radius:8px; padding:5px 10px; cursor:pointer; }
#resetFilters:hover { background:var(--card); }
.tabs { display:flex; gap:2px; border-bottom:1px solid var(--line); margin:26px 0 0; overflow-x:auto;
  position:sticky; top:var(--tabstop, 150px); z-index:29; background:var(--surface); }
.tab { font:600 .92rem/1.4 "IBM Plex Sans",system-ui,sans-serif; color:var(--ink-2); background:none;
  border:none; border-bottom:2px solid transparent; padding:9px 14px; cursor:pointer; white-space:nowrap; }
.tab[aria-selected="true"] { color:var(--ink); border-bottom-color:var(--ink); }
.panel { padding-top:8px; }
.dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:7px; vertical-align:baseline; }
.deflist { display:grid; grid-template-columns:minmax(160px, max-content) 1fr; gap:9px 24px;
  margin:12px 0; font-size:.92rem; color:var(--ink-2); align-items:baseline; }
.deflist dt { white-space:nowrap; }
.deflist dd { margin:0; max-width:72ch; }
.deflist b { color:var(--ink); }
.cases { font-size:.9rem; }
.caseverdicts { display:block; }
.casedef { display:block; font-size:.85rem; color:var(--ink-3); margin-top:2px; }
.cgood { color:var(--good); font-weight:600; }
.cbad { color:var(--bad); font-weight:600; }
td.wfcell { vertical-align:top; color:var(--ink-2); }
#sampleTable { width:auto; }
#sampleTable th, #sampleTable td { padding-right:36px; }
.mname.tipsrc { cursor:help; text-decoration:underline dotted; text-underline-offset:3px;
  text-decoration-color:var(--ink-3); }
.statsbox { background:var(--wash); border:1px solid var(--line); border-radius:12px;
  padding:6px 18px; margin:12px 0 28px; font-size:.84rem; color:var(--ink-2); }
.statsbox ul { margin:10px 0 10px; padding-left:18px; }
.statsbox li { margin:7px 0; }
.statsbox b { color:var(--ink); }
.effects-head { margin:14px 0 6px; }
.glyphs { display:flex; flex-wrap:wrap; gap:6px 16px; font-size:.76rem; color:var(--ink-3); }
.glyph { display:inline-flex; align-items:center; gap:6px; }
.g-dot { width:9px; height:9px; border-radius:50%; border:1.5px solid var(--ink-2); }
.g-dot.solid { background:var(--ink-2); }
.g-dot.hollow { background:var(--card); }
.g-ci { width:16px; height:3px; border-radius:2px; background:var(--ink-2); }
.g-line { width:1px; height:12px; background:var(--line); outline:1px solid var(--line); }
.effects-tools { display:flex; align-items:center; gap:14px; margin-top:10px; font-size:.8rem; color:var(--ink-2); }
.seg { display:inline-flex; }
.seg button { font:600 .78rem/1.3 "IBM Plex Sans",system-ui,sans-serif; color:var(--ink-2);
  background:var(--card); border:1px solid var(--line); padding:4px 10px; cursor:pointer;
  white-space:nowrap; }
.seg button:first-child { border-radius:7px 0 0 7px; }
.seg button:last-child { border-radius:0 7px 7px 0; margin-left:-1px; }
.seg button[aria-pressed="true"] { color:var(--surface); background:var(--ink);
  border-color:var(--ink); position:relative; }
.seg button:disabled { opacity:.45; cursor:default; }
.wfBadge { font-size:.74rem; font-weight:600; color:var(--ink-2); background:var(--wash);
  border:1px solid var(--line); border-radius:99px; padding:3px 11px; }
.family { scroll-margin-top:var(--fbh, 190px); }
.family h3 { margin:34px 0 2px; font-size:1.3rem; }
.secjump { position:fixed; right:18px; bottom:18px; display:flex; flex-direction:column;
  gap:4px; z-index:20; }
.secbtn { width:32px; height:32px; padding:0; font:600 .95rem/1 "IBM Plex Sans",system-ui,sans-serif;
  color:var(--ink-2); background:var(--card); border:1px solid var(--line); border-radius:8px;
  cursor:pointer; box-shadow:0 2px 10px rgba(0,0,0,.18); }
.secbtn:hover { color:var(--ink); border-color:var(--ink-3); }
.family-intro { font-size:.82rem; color:var(--ink-3); margin:0 0 8px; max-width:70ch; }
.frow { display:grid; grid-template-columns:220px 1fr 130px; gap:14px; align-items:center;
  padding:9px 0; border-bottom:1px solid var(--line); }
.fname { display:block; font-weight:600; font-size:.9rem; }
.fdesc { display:block; font-size:.74rem; color:var(--ink-3); }
.fgroup { position:relative; }
.fzero { position:absolute; left:50%; top:14px; bottom:0; width:1px; background:var(--line); }
.fctrl { position:absolute; left:50%; top:-2px; transform:translateX(-50%);
  font:500 .68rem/1.3 "IBM Plex Mono",monospace; color:var(--ink-3);
  background:var(--surface); padding:0 5px; white-space:nowrap; }
.fci { position:absolute; height:3px; border-radius:2px; transform:translateY(-50%);
  background:var(--tc); }
.fdot { position:absolute; width:9px; height:9px; box-sizing:border-box; border-radius:50%;
  border:1.5px solid var(--tc); background:var(--card); transform:translate(-50%,-50%);
  cursor:default; transition:left .2s ease; }
body[data-sigmode="fdr"] .fmark[data-sig="1"] .fdot { background:var(--tc); }
body[data-sigmode="naive"] .fmark[data-sig-p="1"] .fdot { background:var(--tc); }
body[data-sigmode="fdr"] .fmark:not([data-sig="1"]) .fci { opacity:.45; }
body[data-sigmode="naive"] .fmark:not([data-sig-p="1"]) .fci { opacity:.45; }
.fvals { display:flex; flex-direction:column; }
.fvgroup { display:flex; flex-direction:column; gap:2px; align-items:flex-end; }
.flab { font-family:"IBM Plex Mono",monospace; font-size:.8rem; cursor:default; }
body[data-sigmode="fdr"] .flab:not([data-sig="1"]) { opacity:.55; }
body[data-sigmode="naive"] .flab:not([data-sig-p="1"]) { opacity:.55; }
.fsd { position:absolute; height:3px; border-radius:2px; background:var(--ink-3); opacity:.55;
  transform:translateY(-50%); cursor:default; }
.fsdlab { color:var(--ink-3); font-size:.72rem; }
#tip { position:fixed; z-index:50; max-width:320px; background:var(--ink); color:var(--surface);
  padding:9px 12px; border-radius:8px; font-size:.78rem; line-height:1.5; pointer-events:none; }
#tip .tip-title { font-weight:600; }
table { border-collapse:collapse; width:100%; font-size:.88rem; }
thead th { text-align:left; font-size:.72rem; letter-spacing:.08em; text-transform:uppercase;
  color:var(--ink-3); font-weight:600; padding:8px 10px; border-bottom:1px solid var(--line);
  position:sticky; top:0; background:var(--surface); z-index:2; }
thead th.num { text-align:right; }
thead th.nocase { text-transform:none; font-size:.82rem; }
td { padding:7px 10px; border-bottom:1px solid var(--line); }
td.num { text-align:right; white-space:nowrap; }
body[data-sigmode="fdr"] tr[data-sig="0"] td { opacity:.55; }
body[data-sigmode="naive"] tr[data-sig-p="0"] td { opacity:.55; }
.control-row td:not(.wfcell) { background:color-mix(in srgb, var(--good) 7%, transparent); }
.chip { font-size:.72rem; font-weight:600; padding:2px 9px; border-radius:99px; white-space:nowrap; }
.chip.control { background:color-mix(in srgb, var(--good) 14%, transparent); color:var(--good);
  margin-left:6px; }
.vicon { display:inline-block; min-width:1.15em; text-align:center; font-weight:700;
  margin-left:5px; cursor:default; font-family:"IBM Plex Sans",system-ui,sans-serif; }
.vicon.good { color:var(--good); }
.vicon.bad { color:var(--bad); }
.vicon.na { color:var(--ink-3); }
.vicon.shift { color:var(--ink); }
.nnote { color:var(--ink-3); cursor:default; margin-left:2px; }
thead th.tipsrc { cursor:help; text-decoration:underline dotted; text-underline-offset:3px; }
.tablewrap { overflow-x:auto; }
.tablewrap.tall { max-height:74vh; overflow:auto; margin-top:14px; }
.s1 { color:var(--good); } .s05 { color:var(--half); } .s0 { color:var(--bad); }
.sep { color:var(--ink-3); margin:0 3px; }
.partial { color:var(--half); }
.dist-cell { min-width:130px; }
.dist-cell.none { color:var(--ink-3); }
.dist { display:flex; height:6px; border-radius:3px; overflow:hidden; background:var(--wash);
  margin-bottom:4px; min-width:110px; }
.dist .seg.good { background:var(--good); }
.dist .seg.half { background:var(--half); }
.dist .seg.zero { background:var(--bad); }
.empty-state, .warn { background:var(--wash); border:1px solid var(--line); border-radius:12px;
  padding:16px 18px; margin:18px 0; font-size:.92rem; }
.warn { border-color:var(--half); }
.fineprint { font-size:.8rem; color:var(--ink-3); max-width:70ch; }
.finding-group { border-top:1px solid var(--line); padding:10px 0 4px; }
.finding-group summary { cursor:pointer; font-size:.92rem; color:var(--ink-2); padding:6px 0;
  position:sticky; top:calc(var(--fbh, 164px) - 16px); z-index:25; background:var(--surface);
  border-bottom:1px solid var(--line); box-shadow:0 -3px 0 var(--surface); }
.finding { padding:10px 0 6px 14px; border-left:2px solid var(--line); margin:10px 0; }
.finding-head { display:flex; flex-wrap:wrap; gap:8px 12px; align-items:baseline; }
.finding-head .mopen { margin-left:0; }
.finding-head .mopen:first-of-type { margin-left:auto; }
.finding-meta { display:flex; flex-wrap:wrap; gap:4px 14px; margin-top:2px; }
.finding .reason a { color:inherit; font-weight:600; text-decoration:underline;
  text-decoration-color:var(--ink-3); text-underline-offset:3px; }
.finding .reason a:hover { text-decoration-color:var(--ink); }
.finding .score { font-family:"IBM Plex Mono",monospace; font-size:.82rem; border-radius:6px;
  padding:1px 7px; color:#fff; }
.finding .score.zero { background:var(--bad); }
.finding .score.half { background:var(--half); }
.finding .tag { font-weight:600; }
.finding .q { font-size:.8rem; font-weight:600; color:var(--ink-2); }
.finding .where, .finding .run { font-size:.76rem; color:var(--ink-3); }
.finding .reason { margin:6px 0 0; font-size:.9rem; color:var(--ink-2); max-width:75ch; }
.sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
.mjump { font:inherit; font-weight:700; background:none; border:none; padding:0; cursor:pointer;
  text-decoration:underline dotted; text-underline-offset:3px; }
.mjump.s05 { color:var(--half); } .mjump.s0 { color:var(--bad); }
.misuse-modal { border:1px solid var(--line); border-radius:14px; background:var(--card);
  color:var(--ink); padding:0; max-width:min(820px, 92vw); max-height:82vh; }
.misuse-modal::backdrop { background:rgba(0,0,0,.45); }
.misuse-modal .modal-head { display:flex; align-items:baseline; gap:12px; padding:14px 18px;
  border-bottom:1px solid var(--line); position:sticky; top:0; background:var(--card); }
.misuse-modal .modal-head b { font-size:1rem; }
.misuse-modal .modal-head .mono { color:var(--ink-3); font-size:.8rem; }
.misuse-modal .modal-close { margin-left:auto; font:600 .85rem/1 "IBM Plex Sans",system-ui,sans-serif;
  color:var(--ink-2); background:none; border:1px solid var(--line); border-radius:8px;
  padding:5px 10px; cursor:pointer; }
.misuse-modal .modal-body { padding:6px 18px 16px; overflow:auto; max-height:calc(82vh - 58px); }
body:has(.misuse-modal[open]) { overflow:hidden; }
.mopen { font:600 .72rem/1.3 "IBM Plex Sans",system-ui,sans-serif; color:var(--ink-2);
  background:none; border:1px solid var(--line); border-radius:6px; padding:2px 8px;
  cursor:pointer; margin-left:auto; }
.mopen:hover { background:var(--wash); }
.mhelp { font:700 .8rem/1 "IBM Plex Mono",monospace; color:var(--ink-2); background:none;
  border:1px solid var(--line); border-radius:50%; width:22px; height:22px; cursor:pointer;
  vertical-align:3px; }
.mhelp:hover { background:var(--wash); }
.mcmd { background:var(--wash); border:1px solid var(--line); border-radius:8px;
  padding:8px 12px; font-size:.78rem; white-space:pre-wrap; word-break:break-all;
  user-select:all; }
.misuse-modal .modal-body, .finding .excerpt { scrollbar-width:thin;
  scrollbar-color:var(--line) transparent; }
.misuse-modal .modal-body::-webkit-scrollbar, .finding .excerpt::-webkit-scrollbar {
  width:8px; height:8px; }
.misuse-modal .modal-body::-webkit-scrollbar-thumb,
.finding .excerpt::-webkit-scrollbar-thumb { background:var(--line); border-radius:4px; }
.misuse-modal .modal-body::-webkit-scrollbar-track,
.finding .excerpt::-webkit-scrollbar-track { background:transparent; }
.finding .excerpt { margin:8px 0 2px; padding:8px 12px; background:var(--wash);
  border:1px solid var(--line); border-radius:8px; font-size:.78rem; line-height:1.55;
  overflow-x:auto; }
.finding .excerpt mark { display:inline-block; width:100%; color:inherit;
  background:color-mix(in srgb, var(--half) 18%, transparent); }
.untested { font-size:.85rem; color:var(--ink-2); margin:6px 0; padding-left:18px; }
.untested li { margin:3px 0; }
.empty-note { font-size:.85rem; color:var(--ink-3); font-style:italic; margin:18px 0; }
.note { font-size:.8rem; color:var(--ink-3); margin-top:10px; max-width:70ch; }
.curve summary { cursor:pointer; font-weight:600; padding:10px 0; border-bottom:1px solid var(--line); }
.curve-card { background:#FFFFFF; border-radius:10px; padding:16px; margin:12px 0 20px; }
.curve-card svg { width:100%; height:auto; max-width:100%; display:block; }
@media (max-width:640px) {
  .frow { grid-template-columns:1fr; gap:4px; }
  .fvgroup { flex-direction:row; gap:14px; align-items:baseline; }
  .filterbar { gap:8px; }
}`;
}

function buildScript(): string {
  return `
var $ = function (sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); };
var byId = function (id) { return document.getElementById(id); };

// The sticky filter bar and tab strip overlap scrolled-to content, so section
// jumps aim below them: their measured heights feed the .family scroll-margin
// and the tab strip's own sticky offset.
var filterbar = document.querySelector('.filterbar');
var tabStrip = document.querySelector('.tabs');
function fbHeight() { return filterbar ? filterbar.offsetHeight : 0; }
function stickyHeight() { return fbHeight() + (tabStrip ? tabStrip.offsetHeight : 0); }
function syncScrollMargin() {
  document.documentElement.style.setProperty('--fbh', (stickyHeight() + 14) + 'px');
  document.documentElement.style.setProperty('--tabstop', fbHeight() + 'px');
}
window.addEventListener('resize', syncScrollMargin);

var tabs = $('.tab');
function selectTab(index, focus) {
  tabs.forEach(function (tab, i) {
    var on = i === index;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
    byId(tab.getAttribute('aria-controls')).hidden = !on;
  });
  if (focus !== false) tabs[index].focus();
  syncUrl();
}
tabs.forEach(function (tab, i) {
  tab.addEventListener('click', function () { selectTab(i); });
  tab.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') selectTab((i + 1) % tabs.length);
    if (e.key === 'ArrowLeft') selectTab((i - 1 + tabs.length) % tabs.length);
  });
});

var sigButtons = $('#sigFilter button');
var sigFilterMode = 'all';
function setSigFilter(mode) {
  sigFilterMode = mode;
  sigButtons.forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.getAttribute('data-sig') === mode));
  });
  refresh();
}
sigButtons.forEach(function (b) {
  b.addEventListener('click', function () { setSigFilter(b.getAttribute('data-sig')); });
});
var wfButtons = $('#wfFilter button');
var chips = $('.legend .chip-toggle');
var mode = document.body.getAttribute('data-mode');
var defaultScope = document.body.getAttribute('data-default-scope');

function enabledWorkflows() {
  return wfButtons
    .filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; })
    .map(function (b) { return b.getAttribute('data-wf'); });
}
function allWorkflowsOn() {
  return wfButtons.length === 0 || enabledWorkflows().length === wfButtons.length;
}
// Disabling workflows switches the plot to a context scope: one workflow's
// own estimates, or the precomputed equal-weight aggregate of the enabled
// subset. Neither carries FDR verdicts.
function isContextView() { return mode === 'aggregate' && !allWorkflowsOn(); }
function plotScope() {
  if (!isContextView()) return defaultScope;
  var enabled = enabledWorkflows();
  return enabled.length === 1 ? enabled[0] : enabled.slice().sort().join('+');
}
function sigNaive() { return document.body.getAttribute('data-sigmode') === 'naive'; }
function offTreatments() {
  var off = {};
  chips.forEach(function (chip) {
    if (chip.getAttribute('aria-pressed') === 'false') off[chip.getAttribute('data-t')] = true;
  });
  return off;
}
function sigMatch(el, sigMode, contextView) {
  if (sigMode === 'all') return true;
  // Per-workflow rows carry no FDR verdict, so the filter only bites there
  // when the raw-p test is selected.
  if (contextView && !sigNaive()) return true;
  var s = el.getAttribute(sigNaive() ? 'data-sig-p' : 'data-sig');
  return sigMode === 'sig' ? s === '1' : s === '0';
}
function anyVisible(els) {
  return els.some(function (el) { return !el.hidden; });
}
function isExtra(el) { return el.getAttribute('data-extra') === '1'; }
function refresh() {
  var contextView = isContextView();
  var enabled = enabledWorkflows();
  var scope = plotScope();
  var sigMode = sigFilterMode;
  var off = offTreatments();
  var extrasOff = metricsMode === 'core';
  // Per-workflow rows carry no FDR verdict, so the filter is inert there
  // unless the raw-p test is selected.
  var sigDisabled = contextView && !sigNaive();
  sigButtons.forEach(function (b) { b.disabled = sigDisabled; });
  $('.wfBadge').forEach(function (el) { el.hidden = !contextView; });
  document.body.setAttribute(
    'data-wfview',
    !contextView ? 'all' : enabled.length === 1 ? 'single' : 'subset',
  );
  // Workflow annotations on table rows when several workflows' rows mix.
  document.body.setAttribute('data-multiwf', contextView && enabled.length > 1 ? '1' : '0');
  $('.fgroup, .fvgroup').forEach(function (group) {
    group.hidden = group.getAttribute('data-scope') !== scope;
  });
  $('.fmark, .fmark-lab').forEach(function (el) {
    el.hidden = off[el.getAttribute('data-t')] === true || !sigMatch(el, sigMode, contextView);
  });
  $('.frow').forEach(function (row) {
    var group = $('.fgroup', row).filter(function (g) { return !g.hidden; })[0];
    row.hidden =
      (extrasOff && isExtra(row)) || !group || !anyVisible($('.fmark', group));
  });
  $('.family').forEach(function (section) {
    section.hidden = !anyVisible($('.frow', section));
  });
  var effectsEmpty = byId('effectsEmpty');
  if (effectsEmpty) effectsEmpty.hidden = anyVisible($('.family'));
  // The table stays per-workflow in context views: it lists the enabled
  // workflows' own rows while the plot shows their aggregate.
  $('#verdictTable tbody tr').forEach(function (tr) {
    var trScope = tr.getAttribute('data-scope');
    var scopeOk = contextView ? enabled.indexOf(trScope) >= 0 : trScope === defaultScope;
    tr.hidden =
      (extrasOff && isExtra(tr)) ||
      !scopeOk ||
      off[tr.getAttribute('data-t')] === true ||
      !sigMatch(tr, sigMode, contextView);
  });
  var fullEmpty = byId('fullEmpty');
  if (fullEmpty) fullEmpty.hidden = anyVisible($('#verdictTable tbody tr'));
  var sampleRows = $('#sampleTable tbody tr');
  sampleRows.forEach(function (tr) {
    var wfOk = !contextView || enabled.indexOf(tr.getAttribute('data-workflow')) >= 0;
    var t = tr.getAttribute('data-t');
    tr.hidden = !wfOk || (t !== null && off[t] === true);
  });
  // DS misuse tab: workflow scope hides per-workflow tables and findings,
  // treatment chips hide case rows and finding groups. Significance does not
  // apply — per-node verdicts carry no q; the four dsMisuse* estimate rows in
  // the other tabs react to it instead.
  $('#panel-misuse .m-wf').forEach(function (el) {
    var wf = el.getAttribute('data-workflow');
    el.hidden = contextView && wf !== null && wf !== scope;
  });
  $('#panel-misuse .m-case').forEach(function (el) {
    var t = el.getAttribute('data-t');
    el.hidden = t !== null && off[t] === true;
  });
  $('#panel-misuse .finding-group').forEach(function (group) {
    var t = group.getAttribute('data-t');
    group.hidden = (t !== null && off[t] === true) || !anyVisible($('.finding', group));
  });
  // Re-span each workflow group's cell around the rows the filters left.
  var sampleGroups = {};
  sampleRows.forEach(function (tr) {
    var wf = tr.getAttribute('data-workflow');
    (sampleGroups[wf] || (sampleGroups[wf] = [])).push(tr);
  });
  Object.keys(sampleGroups).forEach(function (wf) {
    var visible = sampleGroups[wf].filter(function (tr) { return !tr.hidden; });
    sampleGroups[wf].forEach(function (tr) {
      var cell = tr.querySelector('.wfcell');
      if (!cell) return;
      var first = visible.length > 0 && visible[0] === tr;
      cell.hidden = !first;
      if (first) cell.rowSpan = visible.length;
    });
  });
  $('.curve').forEach(function (curve) {
    curve.hidden =
      (extrasOff && isExtra(curve)) ||
      (contextView && enabled.indexOf(curve.getAttribute('data-workflow')) < 0);
  });
  syncUrl();
}
// Case chips and workflow pills share toggling: plain click flips one,
// ctrl-click solos it, ctrl-click on the only active one restores all.
function wireToggleGroup(buttons) {
  buttons.forEach(function (btn) {
    btn.addEventListener('click', function (event) {
      if (event.ctrlKey || event.metaKey) {
        var alreadySolo = buttons.every(function (b) {
          return (b.getAttribute('aria-pressed') === 'true') === (b === btn);
        });
        buttons.forEach(function (b) {
          b.setAttribute('aria-pressed', String(alreadySolo || b === btn));
        });
      } else {
        var on = btn.getAttribute('aria-pressed') === 'true';
        btn.setAttribute('aria-pressed', String(!on));
      }
      refresh();
    });
  });
}
wireToggleGroup(chips);
wireToggleGroup(wfButtons);

var sigModeButtons = $('#sigMode button');
function setSigMode(sigmode) {
  document.body.setAttribute('data-sigmode', sigmode);
  sigModeButtons.forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.getAttribute('data-sigmode') === sigmode));
  });
  refresh();
}
sigModeButtons.forEach(function (b) {
  b.addEventListener('click', function () { setSigMode(b.getAttribute('data-sigmode')); });
});

// Square the filter bar's corners while it is stuck to the viewport top, so
// nothing scrolls visibly behind the rounding.
function syncStuck() {
  if (filterbar) filterbar.classList.toggle('stuck', filterbar.getBoundingClientRect().top <= 0);
}
window.addEventListener('scroll', syncStuck, { passive: true });
window.addEventListener('resize', syncStuck);
syncStuck();

// Findings carry repo-relative paths so a bundle works on any machine; the
// editor links resolve them against a root the reader can override.
function misuseRoot() {
  var hint = byId('misuseRootHint');
  return localStorage.getItem('agenticRefRepoRoot') ||
    (hint ? hint.getAttribute('data-built-from') : '') || '';
}
function showMisuseRoot() {
  var el = byId('misuseRootShown');
  if (el) el.textContent = misuseRoot() || '(repo root not set)';
  var root = misuseRoot() || '<repo-root>';
  $('.mcmd[data-cmd]').forEach(function (cmd) {
    cmd.textContent = cmd.getAttribute('data-cmd').split('$ROOT').join(root);
  });
}
showMisuseRoot();
document.addEventListener('click', function (e) {
  var open = e.target && e.target.closest ? e.target.closest('.mopen') : null;
  if (open && !open.classList.contains('mcmds')) {
    window.location.href = 'vscode://file/' + misuseRoot() + '/' +
      open.getAttribute('data-path') + ':' + open.getAttribute('data-line');
    return;
  }
  if (e.target && e.target.id === 'misuseHelpBtn') { byId('misuseHelpModal').showModal(); return; }
  if (e.target && e.target.id === 'misuseRootChange') {
    var next = window.prompt('Absolute path of your storybookjs/mcp checkout:', misuseRoot());
    if (next !== null) {
      while (next.endsWith('/')) next = next.slice(0, -1);
      localStorage.setItem('agenticRefRepoRoot', next);
      showMisuseRoot();
    }
    return;
  }
  var cmds = e.target && e.target.closest ? e.target.closest('.mcmds') : null;
  if (cmds) {
    var root2 = misuseRoot() || '<repo-root>';
    var hint2 = byId('misuseRootHint');
    var baseDir = hint2 ? hint2.getAttribute('data-baseline-dir') : '';
    var project = cmds.getAttribute('data-project');
    var file = cmds.getAttribute('data-file');
    var lineNo = cmds.getAttribute('data-line');
    var refsBase = root2 + '/agent-eval/.eval-cache/refs/' + baseDir;
    var entries = [
      ['Open at the flagged line', 'code -g ' + root2 + '/' + project + '/' + file + ':' + lineNo, ''],
      cmds.getAttribute('data-new-file') === '1'
        ? ['Diff this file (created by the run — no baseline side)',
            'git diff --no-index /dev/null ' + root2 + '/' + project + '/' + file, '']
        : ['Diff this file against the baseline',
            'git diff --no-index ' + refsBase + '/' + file + ' ' + root2 + '/' + project + '/' + file, ''],
      ['Diff the whole run against the baseline',
        'git diff --no-index ' + refsBase + '/src ' + root2 + '/' + project + '/src', ''],
      ['Search the run transcript for this component',
        'less ' + root2 + '/' + project + '/__agent_eval__/transcript.txt', ''],
      ['Go to the run', 'cd ' + root2 + '/' + project, ''],
    ];
    var body2 = byId('misuseCmdBody');
    body2.textContent = '';
    entries.forEach(function (entry) {
      var h = document.createElement('h3');
      h.textContent = entry[0];
      body2.appendChild(h);
      var pre = document.createElement('p');
      pre.className = 'mono mcmd';
      pre.textContent = entry[1];
      body2.appendChild(pre);
      if (entry[2]) {
        var note = document.createElement('p');
        note.className = 'fineprint';
        note.textContent = entry[2];
        body2.appendChild(note);
      }
    });
    var prime = document.createElement('p');
    prime.className = 'fineprint';
    prime.textContent = 'Baseline missing entirely? Materialize the cache once:';
    body2.appendChild(prime);
    var primeCmd = document.createElement('p');
    primeCmd.className = 'mono mcmd';
    primeCmd.textContent = 'yarn --cwd ' + root2 + '/agent-eval results:analyze --recompute';
    body2.appendChild(primeCmd);
    byId('misuseCmdModal').showModal();
    return;
  }
  var cmdModal = byId('misuseCmdModal');
  if (cmdModal && e.target === cmdModal) { cmdModal.close(); return; }
  var anyClose = e.target && e.target.closest ? e.target.closest('[data-close]') : null;
  if (anyClose) { byId(anyClose.getAttribute('data-close')).close(); return; }
  var helpModal = byId('misuseHelpModal');
  if (helpModal && e.target === helpModal) { helpModal.close(); return; }
});

// Below-perfect counts in the misuse summary open a modal with the verdicts
// they count, so reading them costs no scroll position.
document.addEventListener('click', function (e) {
  var modal = byId('misuseModal');
  if (modal && e.target === modal) { modal.close(); return; }
  var closeBtn = e.target && e.target.closest ? e.target.closest('#misuseModalClose') : null;
  if (closeBtn) { modal.close(); return; }
  var btn = e.target && e.target.closest ? e.target.closest('.mjump') : null;
  if (!btn || !modal) return;
  var sel = '#panel-misuse .finding' +
    '[data-case="' + btn.getAttribute('data-case') + '"]' +
    '[data-workflow="' + btn.getAttribute('data-workflow') + '"]' +
    '[data-q="' + btn.getAttribute('data-q') + '"]' +
    '[data-score="' + btn.getAttribute('data-score') + '"]';
  var matches = $(sel);
  if (matches.length === 0) return;
  byId('misuseModalTitle').textContent =
    btn.getAttribute('data-case-name') + ' — ' + btn.getAttribute('data-qlabel') +
    ' scored ' + (btn.getAttribute('data-score') === '0' ? '0' : '0.5');
  byId('misuseModalMeta').textContent =
    btn.getAttribute('data-workflow') + ' · ' + matches.length + ' finding(s)';
  var body = byId('misuseModalBody');
  body.textContent = '';
  matches.forEach(function (el) {
    var clone = el.cloneNode(true);
    clone.hidden = false;
    body.appendChild(clone);
  });
  modal.showModal();
});

var metricsButtons = $('#metricsMode button');
var metricsMode = 'core';
function setMetricsMode(mode) {
  metricsMode = mode;
  metricsButtons.forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.getAttribute('data-metrics') === mode));
  });
  refresh();
}
metricsButtons.forEach(function (b) {
  b.addEventListener('click', function () { setMetricsMode(b.getAttribute('data-metrics')); });
});

// Section hop from the fixed corner control: the current section is the last
// one whose top sits at or above the jump line; up and down go one section
// from there, landing each title at the same viewport spot (scroll-margin),
// so repeated clicks walk the whole tab.
document.addEventListener('click', function (e) {
  var btn = e.target && e.target.closest ? e.target.closest('.secbtn') : null;
  if (!btn) return;
  var sections = $('.family').filter(function (s) { return !s.hidden; });
  if (sections.length === 0) return;
  var line = stickyHeight() + 100;
  var current = -1;
  sections.forEach(function (s, i) {
    if (s.getBoundingClientRect().top <= line) current = i;
  });
  var index = current + Number(btn.getAttribute('data-dir'));
  if (index < 0 || index >= sections.length) return;
  sections[index].scrollIntoView({ block: 'start' });
});

var statButtons = $('.stat-toggle button');
var statKind = 'mean';
function setStat(kind) {
  statKind = kind;
  statButtons.forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.getAttribute('data-stat') === kind));
  });
  $('.fctrl').forEach(function (el) {
    el.textContent = el.getAttribute('data-' + kind) || '';
  });
  $('.fdot').forEach(function (el) {
    var left = el.getAttribute('data-left-' + kind);
    if (left) el.style.left = left;
  });
  syncUrl();
}
statButtons.forEach(function (b) {
  b.addEventListener('click', function () { setStat(b.getAttribute('data-stat')); });
});

var reset = byId('resetFilters');
if (reset) reset.addEventListener('click', function () {
  chips.forEach(function (chip) { chip.setAttribute('aria-pressed', 'true'); });
  wfButtons.forEach(function (b) { b.setAttribute('aria-pressed', 'true'); });
  setSigFilter('all');
  setStat('mean');
  setMetricsMode('core');
  setSigMode('fdr');
});

// Every control writes its non-default state to the query string, so a
// filtered view can be shared by copying the URL. Some browsers refuse
// replaceState on file:// pages; the hash carries the same state there.
function syncUrl() {
  var p = new URLSearchParams();
  var defaultTabId = tabs.length > 0 ? tabs[0].id.slice(4) : '';
  var active = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0];
  var tabId = active ? active.id.slice(4) : defaultTabId;
  if (tabId !== defaultTabId) p.set('tab', tabId);
  var off = Object.keys(offTreatments());
  if (off.length > 0) p.set('hide', off.join(','));
  if (sigFilterMode !== 'all') p.set('sig', sigFilterMode);
  if (sigNaive()) p.set('test', 'raw');
  if (!allWorkflowsOn()) p.set('wf', enabledWorkflows().join(','));
  if (statKind !== 'mean') p.set('stat', statKind);
  if (metricsMode !== 'core') p.set('metrics', metricsMode);
  var qs = p.toString();
  try {
    history.replaceState(null, '', location.pathname + (qs === '' ? '' : '?' + qs));
  } catch (err) {
    location.hash = qs;
  }
}

function applyUrlState() {
  var qs = location.search.slice(1) || location.hash.slice(1);
  var p;
  try { p = new URLSearchParams(qs); } catch (err) { p = new URLSearchParams(); }
  var index = tabs.map(function (t) { return t.id; }).indexOf('tab-' + p.get('tab'));
  if (index > 0) selectTab(index, false);
  var hide = (p.get('hide') || '').split(',');
  chips.forEach(function (chip) {
    chip.setAttribute('aria-pressed', String(hide.indexOf(chip.getAttribute('data-t')) < 0));
  });
  if (p.get('sig') === 'sig' || p.get('sig') === 'nonsig') setSigFilter(p.get('sig'));
  // A comma list of enabled workflows; old single-workflow links still work.
  var wfParam = p.get('wf');
  if (wfParam !== null && wfButtons.length > 0) {
    var wanted = wfParam.split(',');
    var known = wfButtons.map(function (b) { return b.getAttribute('data-wf'); });
    if (wanted.some(function (w) { return known.indexOf(w) >= 0; })) {
      wfButtons.forEach(function (b) {
        b.setAttribute('aria-pressed', String(wanted.indexOf(b.getAttribute('data-wf')) >= 0));
      });
    }
  }
  var stat = p.get('stat');
  setStat(stat === 'median' ? 'median' : 'mean');
  setMetricsMode(p.get('metrics') === 'all' ? 'all' : 'core');
  setSigMode(p.get('test') === 'raw' ? 'naive' : 'fdr');
}

var tip = byId('tip');
var tipParts = $('#tip div');
function showTip(el) {
  var suffix = statKind === 'mean' ? '' : '-' + statKind;
  var statLabel = statKind === 'median' ? 'median' : 'mean';
  var control = el.getAttribute('data-tip-control' + suffix) || '';
  var treatment = el.getAttribute('data-tip-treatment' + suffix) || '';
  tipParts[0].textContent = el.getAttribute('data-tip-title') || '';
  tipParts[1].textContent = el.getAttribute('data-tip-effect') || '';
  // Marks carry a per-test-mode call line in data-tip-qn/-q; metric and case
  // definitions carry a single data-tip-q line that shows in both modes.
  tipParts[2].textContent =
    (sigNaive() && el.getAttribute('data-tip-qn')) || el.getAttribute('data-tip-q') || '';
  tipParts[3].textContent =
    control && treatment ? statLabel + ': control ' + control + ' \\u2192 ' + treatment : '';
  tip.hidden = false;
  var r = el.getBoundingClientRect();
  var box = tip.getBoundingClientRect();
  var left = Math.min(
    Math.max(8, r.left + r.width / 2 - box.width / 2),
    window.innerWidth - box.width - 8
  );
  var top = r.top - box.height - 8;
  if (top < 8) top = r.bottom + 8;
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}
document.addEventListener('mouseover', function (e) {
  var el = e.target && e.target.closest ? e.target.closest('.tipsrc') : null;
  if (el) showTip(el);
  else tip.hidden = true;
});
document.addEventListener('focusin', function (e) {
  var el = e.target && e.target.closest ? e.target.closest('.tipsrc') : null;
  if (el) showTip(el);
  else tip.hidden = true;
});
document.addEventListener('scroll', function () { tip.hidden = true; }, true);

syncScrollMargin();
applyUrlState();
refresh();`;
}

export function renderHtmlReport(input: HtmlReportInput): string {
  const { estimates, manifest, curves, dataset } = input;
  const styles = treatmentStyles(manifest.spec.treatments, manifest.colors);
  const title = `${manifest.spec.control.shortName} vs ${manifest.spec.treatments
    .map((t) => t.shortName)
    .join(' + ')}`;
  const panels = [
    {
      id: 'effects',
      label: 'Findings',
      body: buildEffects(estimates, manifest, styles, dataset),
    },
    {
      id: 'summary',
      label: 'Summary',
      body:
        buildCases(estimates, manifest, styles) +
        buildSample(manifest, styles) +
        buildStatsBox(estimates, manifest),
    },
    {
      id: 'full',
      label: 'Full report',
      body: buildFullReport(estimates, manifest, styles),
    },
    {
      id: 'misuse',
      label: 'DS misuse',
      body: buildMisuse(input.misuse, manifest),
    },
    {
      id: 'curves',
      label: 'ECDF curves',
      body: buildCurves(curves, manifest),
    },
  ];
  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Spectral:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>${buildStyle(styles)}</style>
<body data-mode="${escapeHtml(manifest.spec.mode)}" data-default-scope="${escapeHtml(
    defaultScopeOf(manifest)
  )}" data-sigmode="fdr" data-multiwf="0" data-wfview="all">
<main>
${buildHeader(manifest)}
${buildFilterBar(manifest, styles)}
${buildTabs(panels)}
</main>
<div id="tip" role="tooltip" hidden><div class="tip-title"></div><div></div><div></div><div></div></div>
<script>${buildScript()}</script>
</body>
`;
}

function parseDatasetCsv(csv: string): DatasetRow[] {
  const lines = csv.trim().split('\n');
  if (lines.length === 0) return [];
  const header = lines[0]!.split(',');
  const metricKeys = header.slice(4);
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const values: Record<string, number | null> = {};
    metricKeys.forEach((key, i) => {
      const raw = cells[i + 4];
      values[key] = raw === undefined || raw === '' ? null : Number(raw);
    });
    return { case: cells[0]!, workflow: cells[1]!, values };
  });
}

export function writeHtmlReport(stagingDir: string): void {
  const estimates: EstimateRow[] = JSON.parse(
    readFileSync(join(stagingDir, 'estimates.json'), 'utf8')
  );
  const manifest: ManifestJson = JSON.parse(
    readFileSync(join(stagingDir, 'manifest.json'), 'utf8')
  );
  const dataset = parseDatasetCsv(readFileSync(join(stagingDir, 'dataset.csv'), 'utf8'));
  const curvesDir = join(stagingDir, 'curves');
  const curves: CurveInput[] = readdirSync(curvesDir)
    .filter((file) => file.endsWith('.svg'))
    .map((file) => {
      const [metric, workflow] = file.replace(/\.svg$/, '').split('@');
      return {
        metric: metric ?? file,
        workflow: workflow ?? '',
        svg: readFileSync(join(curvesDir, file), 'utf8'),
      };
    });
  const misusePath = join(stagingDir, 'misuse.json');
  const misuse: MisusePanel | undefined = existsSync(misusePath)
    ? JSON.parse(readFileSync(misusePath, 'utf8'))
    : undefined;
  writeFileSync(
    join(stagingDir, 'report.html'),
    renderHtmlReport({ estimates, manifest, curves, dataset, misuse })
  );
}
