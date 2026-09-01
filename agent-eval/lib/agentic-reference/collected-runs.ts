// Classifies stored run directories. A run stopped by something outside the
// experiment (billing, a timeout, an unreachable endpoint, a killed container)
// leaves result.json and a transcript behind but no `project` tree — and the
// project tree is what every metric is measured from. The plan runner and the
// analyzer both count only runs that produced one, so they agree on what has
// been collected. The harness's own failure classifier deletes most such runs;
// this covers what it leaves behind.
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { readJson } from '../utils/files.ts';
import { RUN_DIR } from './constants.ts';

/** What a stored run directory turned out to be. */
export interface RunOutcome {
  /** Absolute path to the run directory. */
  dir: string;
  /** Its 1-based repetition number, from the directory name. */
  run: number;
  /**
   * Whether the run produced a project tree — the thing every metric reads.
   * A run whose eval failed still collected: the tree it left behind is
   * exactly what the analysis measures.
   */
  collected: boolean;
  /** What the harness recorded as the reason it stopped, where it recorded one. */
  error: string | null;
}

/** Reads one run directory, whether or not it holds a run. */
export function readRunOutcome(runDir: string): RunOutcome {
  const name = basename(runDir);
  const result = readJson<{ error?: unknown }>(join(runDir, 'result.json'));
  return {
    dir: runDir,
    run: Number.parseInt(RUN_DIR.exec(name)?.[1] ?? '0', 10),
    collected: existsSync(join(runDir, 'project')),
    error: typeof result?.error === 'string' ? result.error : null,
  };
}

/** Every run directory an eval directory holds, in run order. */
export function readRunOutcomes(evalDir: string): RunOutcome[] {
  if (!existsSync(evalDir)) {
    return [];
  }
  return readdirSync(evalDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && RUN_DIR.test(entry.name))
    .map((entry) => readRunOutcome(join(evalDir, entry.name)))
    .sort((a, b) => a.run - b.run);
}

/** How many runs of an eval directory produced something to measure. */
export function countCollectedRuns(evalDir: string, successfulOnly = true): number {
  const allOutcomes = readRunOutcomes(evalDir).filter((outcome) => outcome.collected);

  return successfulOnly
    ? allOutcomes.filter((outcome) => outcome.error === null).length
    : allOutcomes.length;
}

/** Removes a directory if nothing is left in it, and says whether it did. */
function removeIfEmpty(dir: string): boolean {
  if (!existsSync(dir) || readdirSync(dir).length > 0) {
    return false;
  }
  rmSync(dir, { recursive: true });
  return true;
}

/**
 * Deletes run directories, then any eval/result/experiment directories they
 * leave empty, up to but not including `stopAt` (normally results/ itself).
 * An eval directory's summary.json goes with it, since it would describe runs
 * that no longer exist. `directories` counts removed directories, not runs.
 */
export function deleteRunDirs(
  runDirs: readonly string[],
  stopAt: string
): { runs: number; directories: number } {
  let runs = 0;
  let directories = 0;

  const evalDirs = new Set<string>();
  for (const runDir of runDirs) {
    rmSync(runDir, { recursive: true, force: true });
    evalDirs.add(dirname(runDir));
    runs += 1;
  }

  for (const evalDir of evalDirs) {
    let dir = evalDir;
    if (readRunOutcomes(evalDir).length === 0 && existsSync(evalDir)) {
      rmSync(evalDir, { recursive: true });
      directories += 1;
    }
    while (dir !== stopAt && dir !== dirname(dir)) {
      dir = dirname(dir);
      if (dir === stopAt || !removeIfEmpty(dir)) {
        break;
      }
      directories += 1;
    }
  }

  return { runs, directories };
}

/** What stopped a run, coarsely — enough to decide what to do about it. */
export type RunErrorKind = 'billing' | 'timeout' | 'network' | 'other' | 'unrecorded';

const ERROR_KINDS: Array<{ kind: RunErrorKind; pattern: RegExp }> = [
  { kind: 'billing', pattern: /\b402\b|credit balance|insufficient funds|quota/i },
  { kind: 'timeout', pattern: /timed out|timeout/i },
  { kind: 'network', pattern: /fetch failed|unreachable|ECONNREFUSED|ENOTFOUND|socket hang up/i },
];

/**
 * Sorts a recorded error into a kind. Billing is checked before timeout: a
 * 402 response often mentions both, and the account is what needs fixing.
 */
export function classifyRunError(error: string | null): RunErrorKind {
  if (error === null) {
    return 'unrecorded';
  }
  return ERROR_KINDS.find(({ pattern }) => pattern.test(error))?.kind ?? 'other';
}
