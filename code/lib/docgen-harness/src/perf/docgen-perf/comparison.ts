/** Pure scheduling, work-equivalence, and paired-statistics helpers for docgen comparisons. */

import type { EngineId } from '../docgen-shared/engine-ids.ts';

export const COMPARISON_PAIRS = [
  { name: 'react', control: 'react-legacy', candidate: 'react-osa' },
  { name: 'vue', control: 'vue-docgen-api', candidate: 'vue-component-meta' },
  {
    name: 'vue-component-meta-version',
    control: 'vue-component-meta',
    candidate: 'vue-component-meta-next',
    versionsMustDiffer: true,
  },
] as const satisfies ReadonlyArray<{
  name: string;
  control: EngineId;
  candidate: EngineId;
  versionsMustDiffer?: boolean;
}>;

export type PairName = (typeof COMPARISON_PAIRS)[number]['name'];

export type ComparisonSide = 'control' | 'candidate';

export interface ComparisonBlock {
  /** One-based block number, used to join the two adjacent measurements after they run. */
  block: number;
  /** Both sides run once per block; the tuple records which side runs first. */
  order: readonly [ComparisonSide, ComparisonSide];
}

export interface ComparisonPlan {
  pair: string;
  scenario: string;
  repetitions: number;
  /** Stable seed derived from the caller's seed and this pair/scenario identity. */
  seed: number;
  blocks: ComparisonBlock[];
}

export interface ComparisonPlanOptions {
  seed: number | string;
  pair: string;
  scenario: string;
  /** Number of paired blocks. Each side therefore runs this many times. */
  repetitions: number;
}

export interface ExecutedComparisonBlock<Value> extends ComparisonBlock {
  control: Value;
  candidate: Value;
}

/** Executes each block adjacently and publishes only complete two-sided blocks. */
export async function executeComparisonPlan<Value>(
  plan: ComparisonPlan,
  measure: (side: ComparisonSide, block: number) => Promise<Value>
): Promise<Array<ExecutedComparisonBlock<Value>>> {
  const completed: Array<ExecutedComparisonBlock<Value>> = [];
  for (const scheduled of plan.blocks) {
    const values: Partial<Record<ComparisonSide, Value>> = {};
    for (const side of scheduled.order) {
      values[side] = await measure(side, scheduled.block);
    }
    completed.push({
      ...scheduled,
      control: values.control!,
      candidate: values.candidate!,
    });
  }
  return completed;
}

function seedPart(value: number | string): string {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new Error('comparison seed must be a safe integer or a non-empty string');
    }
    return `number:${value}`;
  }
  if (value.length === 0) {
    throw new Error('comparison seed must be a safe integer or a non-empty string');
  }
  return `string:${value}`;
}

function namedPart(name: string, value: string): string {
  if (value.length === 0) {
    throw new Error(`${name} must not be empty`);
  }
  // Length-prefixing makes identities such as ("a:b", "c") and ("a", "b:c") unambiguous.
  return `${value.length}:${value}`;
}

/**
 * Derives an unsigned 32-bit seed without relying on platform-specific hashing or object order.
 * Pair/scenario derivation lets suites add or remove unrelated comparisons without perturbing a
 * surviving comparison's plan.
 */
export function deriveComparisonSeed(
  seed: number | string,
  pair: string,
  scenario: string
): number {
  const identity = `${namedPart('seed', seedPart(seed))}|${namedPart('pair', pair)}|${namedPart(
    'scenario',
    scenario
  )}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < identity.length; i++) {
    hash ^= identity.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function randomFrom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

/** Builds deterministic adjacent blocks, balanced within every two-block stratum. */
export function createComparisonPlan(options: ComparisonPlanOptions): ComparisonPlan {
  if (
    !Number.isInteger(options.repetitions) ||
    options.repetitions < 10 ||
    options.repetitions % 2 !== 0
  ) {
    throw new Error('paired comparisons require an even repetition count of at least 10');
  }

  const seed = deriveComparisonSeed(options.seed, options.pair, options.scenario);
  const random = randomFrom(seed);
  const firstSides: ComparisonSide[] = [];
  for (let stratum = 0; stratum < options.repetitions / 2; stratum++) {
    const first = random() < 0.5 ? 'control' : 'candidate';
    firstSides.push(first, first === 'control' ? 'candidate' : 'control');
  }

  return {
    pair: options.pair,
    scenario: options.scenario,
    repetitions: options.repetitions,
    seed,
    blocks: firstSides.map((first, index) => ({
      block: index + 1,
      order: first === 'control' ? ['control', 'candidate'] : ['candidate', 'control'],
    })),
  };
}

export interface WorkSignature {
  members?: number;
  opaqueTypes?: number;
}

export interface WarmWorkSignature extends WorkSignature {
  /** Present for macro trajectories; two sides must identify the same ordered save. */
  save?: number;
}

export interface WorkProfile {
  /** Required when the pair compares two pins of the same package. */
  version?: string;
  cold?: WorkSignature;
  /** Kept in save order because a stateful trajectory is not an IID sample set. */
  warm?: readonly WarmWorkSignature[];
}

export type WorkStatus = 'same-work' | 'different-work' | 'unknown-work' | 'same-version';

export type WorkReason =
  | 'matching-signatures'
  | 'different-cold-signature'
  | 'different-warm-signature'
  | 'different-warm-length'
  | 'missing-signature'
  | 'missing-version'
  | 'matching-version';

export interface WorkAssessment {
  status: WorkStatus;
  reason: WorkReason;
}

export interface WorkAssessmentOptions {
  /** Enable for a current/next pair that must resolve distinct package versions. */
  versionsMustDiffer?: boolean;
}

export type WorkMetric = 'cold' | 'warm';

function knownCount(value: number | undefined): value is number {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0;
}

function knownSignature(signature: WorkSignature | undefined): signature is WorkSignature & {
  members: number;
} {
  return (
    knownCount(signature?.members) &&
    (signature.opaqueTypes === undefined || knownCount(signature.opaqueTypes))
  );
}

function knownWarmSignature(
  signature: WarmWorkSignature | undefined
): signature is WarmWorkSignature & { members: number; save: number } {
  return (
    signature !== undefined &&
    knownCount(signature.members) &&
    (signature.opaqueTypes === undefined || knownCount(signature.opaqueTypes)) &&
    knownCount(signature.save) &&
    signature.save > 0
  );
}

function compareSignature(
  control: WarmWorkSignature & { members: number },
  candidate: WarmWorkSignature & { members: number }
): 'same' | 'different' | 'unknown' {
  if ((control.save === undefined) !== (candidate.save === undefined)) {
    return 'unknown';
  }
  if (control.save !== candidate.save) {
    return 'different';
  }
  if (control.members !== candidate.members) {
    return 'different';
  }
  if ((control.opaqueTypes === undefined) !== (candidate.opaqueTypes === undefined)) {
    return 'unknown';
  }
  return control.opaqueTypes === candidate.opaqueTypes ? 'same' : 'different';
}

/**
 * Proves equal work from the cold signature and every ordered warm signature. Missing or malformed
 * counts remain unknown rather than being interpreted as zero or agreement.
 */
function assessVersion(
  control: WorkProfile,
  candidate: WorkProfile,
  options: WorkAssessmentOptions
): WorkAssessment | undefined {
  if (options.versionsMustDiffer) {
    if (!control.version || !candidate.version) {
      return { status: 'unknown-work', reason: 'missing-version' };
    }
    if (control.version === candidate.version) {
      return { status: 'same-version', reason: 'matching-version' };
    }
  }
  return undefined;
}

function assessColdWork(control: WorkProfile, candidate: WorkProfile): WorkAssessment {
  if (!knownSignature(control.cold) || !knownSignature(candidate.cold)) {
    return { status: 'unknown-work', reason: 'missing-signature' };
  }
  const coldComparison = compareSignature(control.cold, candidate.cold);
  if (coldComparison === 'unknown') {
    return { status: 'unknown-work', reason: 'missing-signature' };
  }
  if (coldComparison === 'different') {
    return { status: 'different-work', reason: 'different-cold-signature' };
  }
  return { status: 'same-work', reason: 'matching-signatures' };
}

function assessWarmWork(control: WorkProfile, candidate: WorkProfile): WorkAssessment {
  if (!control.warm || !candidate.warm) {
    return { status: 'unknown-work', reason: 'missing-signature' };
  }
  if (control.warm.length === 0 || candidate.warm.length === 0) {
    return { status: 'unknown-work', reason: 'missing-signature' };
  }
  if (control.warm.length !== candidate.warm.length) {
    return { status: 'different-work', reason: 'different-warm-length' };
  }
  for (let i = 0; i < control.warm.length; i++) {
    const controlSignature = control.warm[i];
    const candidateSignature = candidate.warm[i];
    if (!knownWarmSignature(controlSignature) || !knownWarmSignature(candidateSignature)) {
      return { status: 'unknown-work', reason: 'missing-signature' };
    }
    const warmComparison = compareSignature(controlSignature, candidateSignature);
    if (warmComparison === 'unknown') {
      return { status: 'unknown-work', reason: 'missing-signature' };
    }
    if (warmComparison === 'different') {
      return { status: 'different-work', reason: 'different-warm-signature' };
    }
  }
  return { status: 'same-work', reason: 'matching-signatures' };
}

/** Proves equal work for one timing metric, so cold and warm comparisons fail independently. */
export function assessMetricWork(
  control: WorkProfile,
  candidate: WorkProfile,
  metric: WorkMetric,
  options: WorkAssessmentOptions = {}
): WorkAssessment {
  return (
    assessVersion(control, candidate, options) ??
    (metric === 'cold' ? assessColdWork(control, candidate) : assessWarmWork(control, candidate))
  );
}

/** Proves equal work across the full repetition for callers that need one aggregate status. */
export function assessWork(
  control: WorkProfile,
  candidate: WorkProfile,
  options: WorkAssessmentOptions = {}
): WorkAssessment {
  const version = assessVersion(control, candidate, options);
  if (version) {
    return version;
  }
  const cold = assessColdWork(control, candidate);
  return cold.status === 'same-work' ? assessWarmWork(control, candidate) : cold;
}

export interface PairedTiming {
  block: number;
  controlMs?: number;
  candidateMs?: number;
}

export type InvalidEffectReason =
  | 'incomplete-data'
  | 'nonfinite-data'
  | 'nonpositive-data'
  | 'insufficient-pairs';

export interface InvalidPairedEffect {
  status: 'invalid';
  reason: InvalidEffectReason;
}

export interface PairedEffect {
  status: 'measured';
  pairs: number;
  /** One value per block. Positive values mean the candidate was slower. */
  logRatios: number[];
  meanLogRatio: number;
  standardError: number;
  criticalValue95: number;
  candidateOverControl: {
    estimate: number;
    lower95: number;
    upper95: number;
  };
}

export type PairedEffectResult = PairedEffect | InvalidPairedEffect;

export interface PairedEffectOptions {
  /** Detects a child that stopped before every scheduled block completed. */
  expectedPairs?: number;
}

// Two-sided 95% Student-t critical values. Larger degrees of freedom use a convergent expansion.
const T_CRITICAL_95 = [
  Number.NaN,
  12.7062047364,
  4.30265272975,
  3.18244630528,
  2.7764451052,
  2.57058183564,
  2.44691184879,
  2.36462425101,
  2.3060041352,
  2.2621571628,
  2.22813885196,
  2.20098516008,
  2.17881282966,
  2.16036865646,
  2.14478668792,
  2.13144954556,
  2.11990529922,
  2.10981557783,
  2.10092204024,
  2.09302405441,
  2.08596344727,
  2.07961384473,
  2.0738730679,
  2.06865761042,
  2.06389856163,
  2.05953855275,
  2.05552943864,
  2.05183051648,
  2.0484071418,
  2.04522964213,
  2.0422724563,
];

export function studentTCritical95(degreesOfFreedom: number): number {
  if (!Number.isInteger(degreesOfFreedom) || degreesOfFreedom < 1) {
    throw new Error('Student-t degrees of freedom must be a positive integer');
  }
  if (degreesOfFreedom < T_CRITICAL_95.length) {
    return T_CRITICAL_95[degreesOfFreedom];
  }

  const v = degreesOfFreedom;
  const z = 1.959963984540054;
  const z2 = z * z;
  const z3 = z2 * z;
  const z5 = z3 * z2;
  const z7 = z5 * z2;
  const z9 = z7 * z2;
  return (
    z +
    (z3 + z) / (4 * v) +
    (5 * z5 + 16 * z3 + 3 * z) / (96 * v ** 2) +
    (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * v ** 3) +
    (79 * z9 + 776 * z7 + 1482 * z5 - 1920 * z3 - 945 * z) / (92_160 * v ** 4)
  );
}

/** Computes the geometric candidate/control effect and a two-sided 95% Student-t interval. */
export function computePairedEffect(
  timings: readonly PairedTiming[],
  options: PairedEffectOptions = {}
): PairedEffectResult {
  if (
    options.expectedPairs !== undefined &&
    (!Number.isInteger(options.expectedPairs) ||
      options.expectedPairs < 1 ||
      timings.length !== options.expectedPairs)
  ) {
    return { status: 'invalid', reason: 'incomplete-data' };
  }
  if (timings.length < 2) {
    return { status: 'invalid', reason: 'insufficient-pairs' };
  }

  const blocks = new Set<number>();
  const logRatios: number[] = [];
  for (const timing of timings) {
    if (
      !Number.isSafeInteger(timing.block) ||
      timing.block < 1 ||
      blocks.has(timing.block) ||
      timing.controlMs === undefined ||
      timing.candidateMs === undefined
    ) {
      return { status: 'invalid', reason: 'incomplete-data' };
    }
    blocks.add(timing.block);
    if (!Number.isFinite(timing.controlMs) || !Number.isFinite(timing.candidateMs)) {
      return { status: 'invalid', reason: 'nonfinite-data' };
    }
    if (timing.controlMs <= 0 || timing.candidateMs <= 0) {
      return { status: 'invalid', reason: 'nonpositive-data' };
    }
    // Subtracting logs avoids overflowing candidate/control before taking its logarithm.
    const logRatio = Math.log(timing.candidateMs) - Math.log(timing.controlMs);
    if (!Number.isFinite(logRatio)) {
      return { status: 'invalid', reason: 'nonfinite-data' };
    }
    logRatios.push(logRatio);
  }
  for (let block = 1; block <= timings.length; block++) {
    if (!blocks.has(block)) {
      return { status: 'invalid', reason: 'incomplete-data' };
    }
  }

  const meanLogRatio = logRatios.reduce((sum, value) => sum + value, 0) / logRatios.length;
  const squaredError = logRatios.reduce((sum, value) => sum + (value - meanLogRatio) ** 2, 0);
  const standardDeviation = Math.sqrt(squaredError / (logRatios.length - 1));
  const standardError = standardDeviation / Math.sqrt(logRatios.length);
  const criticalValue95 = studentTCritical95(logRatios.length - 1);
  const margin = criticalValue95 * standardError;
  const estimate = Math.exp(meanLogRatio);
  const lower95 = Math.exp(meanLogRatio - margin);
  const upper95 = Math.exp(meanLogRatio + margin);
  if (
    !Number.isFinite(meanLogRatio) ||
    !Number.isFinite(standardError) ||
    !Number.isFinite(estimate) ||
    !Number.isFinite(lower95) ||
    !Number.isFinite(upper95)
  ) {
    return { status: 'invalid', reason: 'nonfinite-data' };
  }

  return {
    status: 'measured',
    pairs: logRatios.length,
    logRatios,
    meanLogRatio,
    standardError,
    criticalValue95,
    candidateOverControl: { estimate, lower95, upper95 },
  };
}

export interface PairedComparisonInput {
  controlWork: WorkProfile;
  candidateWork: WorkProfile;
  timings: readonly PairedTiming[];
  expectedPairs?: number;
  versionsMustDiffer?: boolean;
  /** Omit only when a caller intentionally requires the full cold-and-warm work profile. */
  metric?: WorkMetric;
}

export interface PairedComparison {
  work: WorkAssessment;
  /** Deliberately absent unless the two sides proved they performed identical work. */
  effect?: PairedEffectResult;
}

/** Assesses work before calculating any timing effect. */
export function comparePairedTimings(input: PairedComparisonInput): PairedComparison {
  const work = input.metric
    ? assessMetricWork(input.controlWork, input.candidateWork, input.metric, {
        versionsMustDiffer: input.versionsMustDiffer,
      })
    : assessWork(input.controlWork, input.candidateWork, {
        versionsMustDiffer: input.versionsMustDiffer,
      });
  return work.status === 'same-work'
    ? {
        work,
        effect: computePairedEffect(input.timings, { expectedPairs: input.expectedPairs }),
      }
    : { work };
}

export type BudgetStatus =
  | 'not-configured'
  | 'smoke'
  | 'within-budget'
  | 'inconclusive'
  | 'regression'
  | 'invalid-gate';

export type InvalidGateReason =
  | 'invalid-budget'
  | 'invalid-repetition-count'
  | 'work-not-comparable'
  | 'missing-effect'
  | 'invalid-effect'
  | 'incomplete-effect';

export interface BudgetVerdict {
  status: BudgetStatus;
  /** Fractional limit: 0.1 means the candidate may be at most 10% slower. */
  maxRegression?: number;
  maxCandidateOverControl?: number;
  reason?: InvalidGateReason;
}

export interface BudgetOptions {
  /** Number of blocks planned for each side. */
  repetitions: number;
  /** Fractional slowdown, such as 0.1 for 10%. Undefined keeps the run descriptive. */
  maxRegression?: number;
  /** Smoke results are never suitable for a timing verdict, even if a budget was supplied. */
  smoke?: boolean;
}

/** Applies an explicit budget; only a confidence interval wholly beyond it is a regression. */
export function evaluateBudget(
  comparison: PairedComparison,
  options: BudgetOptions
): BudgetVerdict {
  if (options.maxRegression === undefined) {
    return { status: 'not-configured' };
  }
  if (!Number.isFinite(options.maxRegression) || options.maxRegression < 0) {
    return { status: 'invalid-gate', reason: 'invalid-budget' };
  }
  if (
    !Number.isInteger(options.repetitions) ||
    options.repetitions < 10 ||
    options.repetitions % 2 !== 0
  ) {
    return { status: 'invalid-gate', reason: 'invalid-repetition-count' };
  }
  if (comparison.work.status !== 'same-work') {
    return { status: 'invalid-gate', reason: 'work-not-comparable' };
  }
  if (!comparison.effect) {
    return { status: 'invalid-gate', reason: 'missing-effect' };
  }
  if (comparison.effect.status === 'invalid') {
    return { status: 'invalid-gate', reason: 'invalid-effect' };
  }
  if (comparison.effect.pairs !== options.repetitions) {
    return { status: 'invalid-gate', reason: 'incomplete-effect' };
  }

  const maxCandidateOverControl = 1 + options.maxRegression;
  const base = { maxRegression: options.maxRegression, maxCandidateOverControl };
  if (options.smoke) {
    return { status: 'smoke', ...base };
  }
  if (comparison.effect.candidateOverControl.lower95 > maxCandidateOverControl) {
    return { status: 'regression', ...base };
  }
  if (comparison.effect.candidateOverControl.upper95 <= maxCandidateOverControl) {
    return { status: 'within-budget', ...base };
  }
  return { status: 'inconclusive', ...base };
}
