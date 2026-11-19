// Reading the layout of the results tree:
// results/<experiment>/[<model>/]<timestamp>/<eval>/run-N
//
// The model segment appears only for multi-model experiments, so positions are
// resolved from the ends of the path: the last segment under a result directory
// is the eval, the one before it the timestamp, and anything between the
// experiment and the timestamp is the model.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { RESULTS_DIR, RUN_DIR } from './constants.ts';
import { parseResultTimestamp } from './comparability.ts';

/** One eval directory found under results/. */
export interface StoredEvalDir {
  /** Absolute path. */
  dir: string;
  experiment: string;
  /** Model path segment, empty for a single-model experiment. */
  model: string;
  /** Result directory name, normally the collection's ISO timestamp. */
  timestamp: string;
  evalName: string;
}

/** Every directory under `resultsDir` that holds run-N entries. */
export function findStoredEvalDirs(resultsDir: string = RESULTS_DIR): StoredEvalDir[] {
  const found: StoredEvalDir[] = [];
  const walk = (dir: string, parts: string[]) => {
    const entries = readdirSync(dir, { withFileTypes: true }).filter((entry) =>
      entry.isDirectory()
    );
    if (parts.length >= 3 && entries.some((entry) => RUN_DIR.test(entry.name))) {
      found.push({
        dir,
        experiment: parts[0]!,
        model: parts.slice(1, -2).join('/'),
        timestamp: parts.at(-2)!,
        evalName: parts.at(-1)!,
      });
      return;
    }
    for (const entry of entries) {
      walk(join(dir, entry.name), [...parts, entry.name]);
    }
  };
  if (existsSync(resultsDir)) {
    walk(resultsDir, []);
  }
  return found;
}

/**
 * Result directories of one experiment, as `[<model>/]<timestamp>` relative to
 * the experiment's directory. Includes directories that hold no eval yet, which
 * is what lets a caller snapshot the tree before and after a collection.
 */
export function findResultDirs(experiment: string): string[] {
  const experimentDir = join(RESULTS_DIR, experiment);
  if (!existsSync(experimentDir)) {
    return [];
  }

  const dirs: string[] = [];
  for (const entry of readdirSync(experimentDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (parseResultTimestamp(entry.name) !== null) {
      dirs.push(entry.name);
      continue;
    }
    for (const nested of readdirSync(join(experimentDir, entry.name), {
      withFileTypes: true,
    })) {
      if (nested.isDirectory()) {
        dirs.push(join(entry.name, nested.name));
      }
    }
  }
  return dirs;
}
