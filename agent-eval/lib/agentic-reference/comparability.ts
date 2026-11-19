// Which stored runs measure the same thing: the plan runner reuses them, the
// analyzer averages them. Two runs are comparable when their measurements
// match (see identity.ts). A run whose measurement differs from what its
// (experiment, eval) pair measures today is superseded — kept apart, not
// dropped, since it's still a measurement.
import { existsSync } from 'node:fs';

import { readRunOutcomes } from './collected-runs.ts';
import {
  type Measurement,
  currentMeasurement,
  measurementKey,
  readRunMeasurement,
} from './identity.ts';

// Result directories are the run's ISO start time with the colons swapped out,
// e.g. 2026-08-15T13-20-41.492Z.
const RESULT_TIMESTAMP = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})([.,]\d+)?Z$/;

/** The instant a result directory name stands for, or null if it is not one. */
export function parseResultTimestamp(dirName: string): Date | null {
  const match = RESULT_TIMESTAMP.exec(dirName);
  if (match === null) {
    return null;
  }
  const [, date, hours, minutes, seconds, fraction = ''] = match;
  const parsed = new Date(`${date}T${hours}:${minutes}:${seconds}${fraction.replace(',', '.')}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** The measurement an eval directory's runs share, or null when they record none. */
export function readSampleMeasurement(
  evalDir: string,
  cell: { experiment: string; evalName: string }
): Measurement | null {
  if (!existsSync(evalDir)) {
    return null;
  }
  for (const outcome of readRunOutcomes(evalDir)) {
    const measurement = readRunMeasurement(outcome.dir, cell);
    if (measurement !== null) {
      return measurement;
    }
  }
  return null;
}

/** Whether a stored measurement is what `cell` measures today. */
function matchesCurrent(
  measurement: Measurement | null,
  cell: { experiment: string; evalName: string }
): boolean {
  const current = currentMeasurement(cell.experiment, cell.evalName);
  return (
    measurement !== null &&
    current !== null &&
    measurementKey(measurement) === measurementKey(current)
  );
}

/** Whether an eval directory holds what its (experiment, eval) pair measures today. */
export function isCurrentSample(
  evalDir: string,
  cell: { experiment: string; evalName: string }
): boolean {
  return matchesCurrent(readSampleMeasurement(evalDir, cell), cell);
}

/** One stored run's measurement, against what its (experiment, eval) pair measures today. */
export function describeStoredRun(
  runDir: string,
  cell: { experiment: string; evalName: string }
): { measurement: Measurement | null; current: boolean } {
  const measurement = readRunMeasurement(runDir, cell);
  return { measurement, current: matchesCurrent(measurement, cell) };
}

/** Whether one stored run measures what its (experiment, eval) pair measures today. */
export function isCurrentRun(
  runDir: string,
  cell: { experiment: string; evalName: string }
): boolean {
  return describeStoredRun(runDir, cell).current;
}

// --- grouping --------------------------------------------------------------

/** What decides whether two stored runs can be averaged together. */
export interface Comparability {
  experiment: string;
  /** Model segment of the results path, empty for a single-model experiment. */
  model: string;
  evalName: string;
  /** What the run measured, or null when it recorded nothing readable. */
  measurement: Measurement | null;
  /** Whether that is what its (experiment, eval) pair measures today. */
  current: boolean;
}

/** Runs that measure the same thing, in the order they should be reported. */
export interface ComparableGroup<T> {
  experiment: string;
  model: string;
  evalName: string;
  /** False when these runs were collected under a measurement since replaced. */
  current: boolean;
  measurement: Measurement | null;
  members: T[];
}

const UNREADABLE = 'unreadable';

/**
 * Collects runs into the sets that can be aggregated as one measurement, each
 * replaced generation staying a set of its own. Ordered current-first within
 * each group.
 */
export function groupComparableRuns<T>(
  items: readonly T[],
  describe: (item: T) => Comparability
): Array<ComparableGroup<T>> {
  const groups = new Map<string, ComparableGroup<T>>();

  for (const item of items) {
    const { experiment, model, evalName, measurement, current } = describe(item);
    const generation = measurement === null ? UNREADABLE : measurementKey(measurement);
    const key = [experiment, model, evalName, generation].join('\0');

    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, {
        experiment,
        model,
        evalName,
        current,
        measurement,
        members: [item],
      });
    } else {
      group.members.push(item);
    }
  }

  // Current groups sort before superseded ones, so today's data reads first
  // under each pair's heading.
  return [...groups.values()].sort(
    (a, b) =>
      a.experiment.localeCompare(b.experiment) ||
      a.model.localeCompare(b.model) ||
      a.evalName.localeCompare(b.evalName) ||
      Number(b.current) - Number(a.current) ||
      (a.measurement === null ? '' : measurementKey(a.measurement)).localeCompare(
        b.measurement === null ? '' : measurementKey(b.measurement)
      )
  );
}
