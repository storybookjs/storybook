#!/usr/bin/env node
// Finds — and, when asked, deletes — run directories that hold no run.
//
//   yarn results:prune [--experiments <list>] [--evals <list>] [--delete]
//
//   --experiments <list>  only under results/<name>/, by name or glob
//   --evals <list>        only these evals, by name, number (706) or glob
//   --delete              remove them; without it nothing is touched
//
// Runs without a project tree hold nothing to measure (see
// lib/agentic-reference/collected-runs.ts). Deleting them removes any eval
// directory left with no runs, and any result directory left with no evals.
// The next `yarn eval:plan` will see the gap and collect it.
//
// Selection follows the shared grammar in lib/agentic-reference/selection.ts,
// AGENTIC_REF_<FLAG> fallbacks included, so the selection that ran an
// experiment also narrows this.
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  type RunOutcome,
  classifyRunError,
  deleteRunDirs,
  readRunOutcomes,
} from '../lib/agentic-reference/collected-runs.ts';
import { matchesAnySelector, selectionFlags } from '../lib/agentic-reference/selection.ts';
import { RESULTS_DIR } from '#lib/agentic-reference/constants';
import { findStoredEvalDirs } from '#lib/agentic-reference/results-tree';

/** One eval directory, with the runs in it that produced nothing. */
interface IncompleteEvalDir {
  dir: string;
  experiment: string;
  evalName: string;
  incomplete: RunOutcome[];
  /** Runs in the same directory that did produce a tree. */
  collected: number;
}

function findIncomplete(selection: {
  experiments: string[];
  evals: string[];
}): IncompleteEvalDir[] {
  const found: IncompleteEvalDir[] = [];
  for (const { dir, experiment, evalName } of findStoredEvalDirs(RESULTS_DIR)) {
    if (
      !matchesAnySelector(experiment, selection.experiments) ||
      !matchesAnySelector(evalName, selection.evals)
    ) {
      continue;
    }
    const outcomes = readRunOutcomes(dir);
    const incomplete = outcomes.filter((outcome) => !outcome.collected);
    if (incomplete.length > 0) {
      found.push({
        dir,
        experiment,
        evalName,
        incomplete,
        collected: outcomes.length - incomplete.length,
      });
    }
  }
  return found;
}

function directorySize(dir: string): number {
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    // Symlinks are not followed, to avoid counting bytes outside this tree.
    if (entry.isDirectory()) {
      bytes += directorySize(path);
    } else if (entry.isFile()) {
      bytes += statSync(path).size;
    }
  }
  return bytes;
}

function formatBytes(bytes: number): string {
  const units = ['B', 'kB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/** The kinds present, as `billing (7), timeout (1)`, commonest first. */
function summarizeKinds(outcomes: readonly RunOutcome[]): string {
  const counts = new Map<string, number>();
  for (const outcome of outcomes) {
    const kind = classifyRunError(outcome.error);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([kind, count]) => `${kind} (${count})`)
    .join(', ');
}

function firstError(outcomes: readonly RunOutcome[]): string | null {
  const error = outcomes.find((outcome) => outcome.error !== null)?.error ?? null;
  return error === null ? null : error.length > 120 ? `${error.slice(0, 117)}…` : error;
}

function report(evalDirs: readonly IncompleteEvalDir[]): void {
  for (const entry of evalDirs) {
    const total = entry.incomplete.length + entry.collected;
    console.log(`\n  ${relative(RESULTS_DIR, entry.dir)}`);
    console.log(
      `    ${entry.incomplete.length}/${total} runs left no project tree — ` +
        summarizeKinds(entry.incomplete)
    );
    console.log(`    runs ${entry.incomplete.map((outcome) => outcome.run).join(', ')}`);
    const error = firstError(entry.incomplete);
    if (error !== null) {
      console.log(`    ${error}`);
    }
  }
}

function main(): void {
  const flags = selectionFlags(process.env);
  const argv = flags
    .parser(
      process.argv.slice(2),
      {
        scriptName: 'results:prune',
        usage: 'Usage: yarn results:prune [flags]',
      },
      {
        experiments: flags.experiments,
        evals: flags.evals,
        delete: flags.switch('delete', 'Remove the directories; without it nothing is touched'),
      }
    )
    .parseSync();

  const evalDirs = findIncomplete({
    experiments: argv.experiments,
    evals: argv.evals,
  });
  if (evalDirs.length === 0) {
    console.log('No incomplete runs under results/: every run directory holds a project tree.');
    return;
  }

  const runs = evalDirs.reduce((total, entry) => total + entry.incomplete.length, 0);
  // Measured before any deletion, so a dry run can print it too.
  const bytes = evalDirs.reduce(
    (total, entry) =>
      total + entry.incomplete.reduce((sum, outcome) => sum + directorySize(outcome.dir), 0),
    0
  );

  console.log(
    `Incomplete runs under results/ — ${runs} run director${runs === 1 ? 'y' : 'ies'} across ` +
      `${evalDirs.length} eval director${
        evalDirs.length === 1 ? 'y' : 'ies'
      }, ${formatBytes(bytes)}.`
  );
  report(evalDirs);

  if (argv.delete !== true) {
    console.log('\nNothing deleted. Pass --delete to remove them.');
    return;
  }

  const deleted = deleteRunDirs(
    evalDirs.flatMap((entry) => entry.incomplete.map((outcome) => outcome.dir)),
    RESULTS_DIR
  );
  console.log(
    `\nDeleted ${deleted.runs} run director${deleted.runs === 1 ? 'y' : 'ies'} ` +
      `(${formatBytes(bytes)})` +
      (deleted.directories === 0
        ? '.'
        : `, and ${deleted.directories} director${
            deleted.directories === 1 ? 'y' : 'ies'
          } left empty.`)
  );
  console.log('Run `yarn eval:plan --config <plan> --dry` to see what is now missing.');
}

main();
