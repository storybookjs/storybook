#!/usr/bin/env node
// Zips result directories for hand-off to another checkout. The archive keeps
// the results/<experiment>/<timestamp> layout, so unzipping it at agent-eval/
// drops the runs where results:analyze, results:compare, and run plans already
// look — nothing to configure on the receiving side.
//
//   yarn results:export --since <YYYY-MM-DD>                collected on/after a date
//   yarn results:export --since <YYYY-MM-DD> --no-projects  tables only, far smaller
//   yarn results:export --since <YYYY-MM-DD> --out my.zip
//
// --no-projects drops each run's project/ tree (the bulk of the size, tens of
// MB per run). The cached per-run analysis (post-analysis-meta.json) still
// travels, so the analyze and compare tables work on the receiving side;
// what a project-less run cannot do there is --recompute.
//
// Receiving side: unzip <file>.zip -d <repo>/agent-eval
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { findStoredEvalDirs } from '../lib/agentic-reference/results-tree.ts';
import { countCollectedRuns } from '../lib/agentic-reference/collected-runs.ts';
import { AGENT_EVAL_ROOT } from '#lib/agentic-reference/constants';

function fail(message: string): never {
  console.error(`results:export: ${message}`);
  process.exit(1);
}

function parseArgs(): { since: string; out: string; projects: boolean } {
  const argv = process.argv.slice(2);
  let since: string | undefined;
  let out: string | undefined;
  let projects = true;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === '--since') {
      since = argv[(i += 1)];
    } else if (arg === '--out') {
      out = argv[(i += 1)];
    } else if (arg === '--no-projects') {
      projects = false;
    } else {
      fail(`unknown flag "${arg}" (flags: --since <date>, --out <file>, --no-projects)`);
    }
  }
  if (since === undefined || !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
    fail(
      '--since <YYYY-MM-DD> is required; it bounds the archive to runs collected on or after it.'
    );
  }
  return {
    since,
    out: out ?? `results-export-${since}${projects ? '' : '-no-projects'}.zip`,
    projects,
  };
}

function main(): void {
  const { since, out, projects } = parseArgs();

  // Timestamp directory names sort like their collection instants, so a plain
  // string compare against the date selects "collected on or after".
  const evalDirs = findStoredEvalDirs().filter((evalDir) => evalDir.timestamp >= since);
  if (evalDirs.length === 0) {
    fail(`no result directories collected on or after ${since}.`);
  }
  const resultDirs = [
    ...new Set(evalDirs.map((evalDir) => relative(AGENT_EVAL_ROOT, resolve(evalDir.dir, '..')))),
  ].sort();
  const runs = evalDirs.reduce((total, evalDir) => total + countCollectedRuns(evalDir.dir), 0);

  const outPath = resolve(AGENT_EVAL_ROOT, out);
  if (existsSync(outPath)) {
    fail(`${out} already exists; pass a fresh --out or remove it first.`);
  }

  // System zip, from agent-eval/, so entries carry the results/... prefix the
  // receiving checkout expects. -X drops platform extras; the exclusion glob
  // implements --no-projects.
  execFileSync(
    'zip',
    ['-r', '-X', '-q', outPath, ...resultDirs, ...(projects ? [] : ['-x', '*/project/*'])],
    { cwd: AGENT_EVAL_ROOT, stdio: ['ignore', 'inherit', 'inherit'] }
  );

  const size = statSync(outPath).size;
  const mb = (size / 1024 / 1024).toFixed(size > 1024 * 1024 * 10 ? 0 : 1);
  console.log(`Wrote ${relative(process.cwd(), outPath)} — ${mb} MB`);
  console.log(
    `  ${resultDirs.length} result director${resultDirs.length === 1 ? 'y' : 'ies'}, ${runs} collected run(s), since ${since}${projects ? '' : ', without project trees'}`
  );
  console.log(`  Receiving side: unzip ${out} -d <repo>/agent-eval`);
}

main();
