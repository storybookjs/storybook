// Speed and cost are already recorded by the harness; this module only reads
// them out of result.json and derives the one value that is missing.
//
// Everything here is defensive: an interrupted run can leave result.json
// without metadata, and a metric pass that throws on one bad run loses the
// good ones alongside it.
import { isRecord } from '../../utils/type.ts';

export interface SpeedMetrics {
  durationSeconds: number | null;
  turns: number | null;
}

export interface CostMetrics {
  inputTokens: number | null;
  cacheWriteTokens: number | null;
  cacheReadTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  /** cacheRead / (input + cacheWrite + cacheRead). null when that sum is 0. */
  cacheHitRate: number | null;
  estimatedCostUsd: number | null;
  toolCalls: Record<string, number> | null;
  totalToolCalls: number | null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function readSpeed(result: unknown): SpeedMetrics {
  const record = isRecord(result) ? result : {};
  const o11y = isRecord(record.o11y) ? record.o11y : {};
  return {
    durationSeconds: numberOrNull(record.duration),
    turns: numberOrNull(o11y.totalTurns),
  };
}

export function readCost(result: unknown): CostMetrics {
  const record = isRecord(result) ? result : {};
  const metadata = isRecord(record.metadata) ? record.metadata : {};
  const usage = isRecord(metadata.usage) ? metadata.usage : {};
  const o11y = isRecord(record.o11y) ? record.o11y : {};

  const inputTokens = numberOrNull(usage.inputTokens);
  const cacheWriteTokens = numberOrNull(usage.cacheWriteTokens);
  const cacheReadTokens = numberOrNull(usage.cacheReadTokens);

  // Caching applies to the input side only, so output tokens are excluded from
  // the denominator; including them would understate the hit rate.
  const inputSide = (inputTokens ?? 0) + (cacheWriteTokens ?? 0) + (cacheReadTokens ?? 0);

  return {
    inputTokens,
    cacheWriteTokens,
    cacheReadTokens,
    outputTokens: numberOrNull(usage.outputTokens),
    totalTokens: numberOrNull(usage.totalTokens),
    cacheHitRate: inputSide === 0 ? null : (cacheReadTokens ?? 0) / inputSide,
    estimatedCostUsd: numberOrNull(usage.estimatedCostUsd),
    toolCalls: isRecord(o11y.toolCalls) ? (o11y.toolCalls as Record<string, number>) : null,
    totalToolCalls: numberOrNull(o11y.totalToolCalls),
  };
}
