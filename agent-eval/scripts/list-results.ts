#!/usr/bin/env node
// Lists the result directories on this machine, one per line, so two machines
// can swap listings and see which directories to send each other.
//
//   yarn results:list                     print this machine's manifest
//   yarn results:list > mine.txt          save it to share
//   yarn results:list --compare theirs.txt  diff against a shared manifest
//
// A line names one result directory — the unit a collection saves and the unit
// worth copying whole — followed by the evals it holds and their run counts:
//
//   agentic-ref-cc-full-opus-high/2026-08-14T10-20-03.503Z  702-rework-ui-flow(3) 703-fix-bug-flow(3)
//
// --compare matches lines by the directory alone, so differing run counts do
// not hide a directory both sides have.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { countCollectedRuns } from '../lib/agentic-reference/collected-runs.ts';
import { findStoredEvalDirs } from '../lib/agentic-reference/results-tree.ts';
import { selectionFlags } from '../lib/agentic-reference/selection.ts';

/** One manifest line: the result directory, then its evals and run counts. */
interface ManifestEntry {
  /** `<experiment>/[<model>/]<timestamp>`, the path to copy. */
  resultDir: string;
  evals: string[];
}

function manifest(): ManifestEntry[] {
  const byResultDir = new Map<string, string[]>();
  for (const evalDir of findStoredEvalDirs()) {
    const resultDir = [evalDir.experiment, evalDir.model, evalDir.timestamp]
      .filter((part) => part !== '')
      .join('/');
    const evals = byResultDir.get(resultDir) ?? [];
    evals.push(`${evalDir.evalName}(${countCollectedRuns(evalDir.dir)})`);
    byResultDir.set(resultDir, evals);
  }
  return [...byResultDir]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([resultDir, evals]) => ({ resultDir, evals: evals.sort() }));
}

function formatEntry(entry: ManifestEntry): string {
  return `${entry.resultDir}  ${entry.evals.join(' ')}`;
}

/** Directory names of a manifest, from ours or from a shared file. */
function directoriesOf(lines: string[]): Set<string> {
  return new Set(
    lines
      .map((line) => line.trim().split(/\s+/)[0]!)
      .filter((dir) => dir !== '' && !dir.startsWith('#'))
  );
}

function compare(entries: ManifestEntry[], theirsPath: string): void {
  const mine = directoriesOf(entries.map((entry) => entry.resultDir));
  const theirs = directoriesOf(readFileSync(theirsPath, 'utf8').split('\n'));

  const toSend = [...mine].filter((dir) => !theirs.has(dir));
  const toFetch = [...theirs].filter((dir) => !mine.has(dir));

  console.log(
    `They are missing ${toSend.length} result director${toSend.length === 1 ? 'y' : 'ies'} you have:`
  );
  for (const dir of toSend) {
    console.log(`  ${join('results', dir)}`);
  }
  console.log(`\nYou are missing ${toFetch.length} they have:`);
  for (const dir of toFetch) {
    console.log(`  ${join('results', dir)}`);
  }
}

function main(): void {
  const flags = selectionFlags(process.env);
  const argv = flags
    .parser(
      process.argv.slice(2),
      {
        scriptName: 'results:list',
        usage: 'Usage: yarn results:list [--compare <manifest file>]',
      },
      {
        compare: flags.text('compare', 'Diff against a manifest saved by results:list elsewhere'),
      }
    )
    .parseSync();

  const entries = manifest();
  if (typeof argv.compare === 'string' && argv.compare !== '') {
    compare(entries, argv.compare);
    return;
  }
  for (const entry of entries) {
    console.log(formatEntry(entry));
  }
}

main();
