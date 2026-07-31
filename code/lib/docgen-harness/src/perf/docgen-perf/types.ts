/** Storybook-owned result shapes for the docgen latency suite. */
import type { EngineId } from '../docgen-shared/engine-ids.ts';
import type {
  LatencyObservation,
  LatencyRepetition,
  WarmLatencyObservation,
} from '../docgen-shared/latency-series.ts';
import type {
  BudgetVerdict,
  ComparisonSide,
  PairedEffectResult,
  WorkAssessment,
} from './comparison.ts';

export type { EngineId, LatencyObservation, LatencyRepetition, WarmLatencyObservation };

export interface ProcessLatencySummary {
  /** One independent value per fresh process. */
  processSamplesMs: number[];
  medianMs: number;
}

export interface ScenarioLatencySummary {
  cold: ProcessLatencySummary;
  /** Each process contributes the median of its ordered save trajectory. */
  warm: ProcessLatencySummary;
  /** Only whole-project one-shot engines report this. */
  scan?: ProcessLatencySummary;
}

export interface ScenarioResult {
  params: Record<string, number | string | boolean>;
  /** Ordered by fresh-process repetition; each warm trajectory remains ordered by save. */
  repetitions: LatencyRepetition[];
  summary: ScenarioLatencySummary;
}

export type EngineResult =
  | { status: 'measured'; scenarios: Record<string, ScenarioResult> }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string };

export interface RawPairedBlock {
  block: number;
  order: readonly [ComparisonSide, ComparisonSide];
  control: LatencyRepetition;
  candidate: LatencyRepetition;
}

export interface ComparisonMetricResult {
  work: WorkAssessment;
  effect?: PairedEffectResult;
  gate: BudgetVerdict;
}

export interface ComparisonScenarioResult {
  seed?: number;
  blocks: RawPairedBlock[];
  cold: ComparisonMetricResult;
  warm: ComparisonMetricResult;
}

export interface ComparisonResult {
  mode: 'descriptive' | 'paired-gate';
  control: EngineId;
  candidate: EngineId;
  controlVersion?: string;
  candidateVersion?: string;
  scenarios: Record<string, ComparisonScenarioResult>;
}

export interface SuiteResults {
  schemaVersion: 1;
  generatedAt: string;
  nodeVersion: string;
  profile: 'full' | 'quick';
  repetitions: number;
  mode: 'descriptive' | 'paired-gate';
  /** False for descriptive and --quick smoke runs, even when paired blocks were requested. */
  gating: boolean;
  comparisonMethod?: 'paired-log-ratio-t95-v1';
  seed?: number;
  engineVersions: Partial<Record<EngineId, string>>;
  engines: Partial<Record<EngineId, EngineResult>>;
  comparisons: Record<string, ComparisonResult>;
}
