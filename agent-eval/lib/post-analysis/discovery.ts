// Finding stored runs on disk, and narrowing them the way every analysis CLI does.
//
// Layout: results/<experiment>/<model>/<timestamp>/<eval>/run-N/project
//
import { join } from 'node:path';

import { readRunOutcomes } from '#lib/agentic-reference/collected-runs';
import { findStoredEvalDirs } from '#lib/agentic-reference/results-tree';
import { matchesAnySelector } from '#lib/agentic-reference/selection';

export interface Run {
  runDir: string;
  projectDir: string;
  experiment: string;
  model: string;
  timestamp: string;
  evalName: string;
  run: number;
  /** Whether the run left a project tree behind (see lib/agentic-reference/collected-runs.ts). */
  collected: boolean;
}

export interface RunSelection {
  experiments: string[];
  evals: string[];
  since: string | null;
  latest: boolean;
}

export function findRuns(dir: string): Run[] {
  return findStoredEvalDirs(dir).flatMap((evalDir) =>
    readRunOutcomes(evalDir.dir).map((outcome) => ({
      runDir: outcome.dir,
      projectDir: join(outcome.dir, 'project'),
      experiment: evalDir.experiment,
      model: evalDir.model,
      timestamp: evalDir.timestamp,
      evalName: evalDir.evalName,
      run: outcome.run,
      collected: outcome.collected,
    }))
  );
}

// Result directories are ISO timestamps with the time's ':' replaced by '-',
// e.g. 2026-07-27T10-43-55.864Z.
export function parseTimestamp(timestamp: string): Date {
  return new Date(timestamp.replace(/T(\d\d)-(\d\d)-(\d\d)/, 'T$1:$2:$3'));
}

export function selectRuns(runs: Run[], options: RunSelection): Run[] {
  let selected = runs;
  selected = selected.filter(
    (run) =>
      matchesAnySelector(run.experiment, options.experiments) &&
      matchesAnySelector(run.evalName, options.evals)
  );
  if (options.since) {
    const since = new Date(options.since);
    if (Number.isNaN(since.getTime())) {
      throw new Error(`--since must be a parseable date; received "${options.since}"`);
    }
    selected = selected.filter((run) => parseTimestamp(run.timestamp) >= since);
  }
  if (options.latest) {
    const newest = new Map<string, string>();
    for (const run of selected) {
      const current = newest.get(run.experiment);
      if (current === undefined || run.timestamp > current)
        newest.set(run.experiment, run.timestamp);
    }
    selected = selected.filter((run) => run.timestamp === newest.get(run.experiment));
  }
  return selected;
}
