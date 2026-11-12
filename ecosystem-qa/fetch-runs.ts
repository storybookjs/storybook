import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';

import { join } from 'pathe';

import { loadCatalog } from './lib/catalog.ts';
import { oldestFirst, RunOrigin, untrustedBecause } from './lib/earlier-runs.ts';
import { ghParse } from './lib/github.ts';
import { downloadedRuns } from './lib/results.ts';

const HELP = `Usage: node ecosystem-qa/fetch-runs.ts --out <results dir> --runs <run id>[,<run id>...] --branches <branch>[,<branch>...]

Downloads the qa-result-* artifacts of earlier runs of the Ecosystem QA workflow with gh, from the
repository in GH_REPO, and writes each catalog repo, OS and engine they hold to
<out>/<id>/<os>/<engine>, where collect.ts reads a local run. Where two runs hold the same repo, OS
and engine, the one that started last wins, whatever the order of --runs.
Takes only runs of the workflow that were started by hand on one of --branches, and downloads
nothing when one of the ids is anything else.`;

const { values } = parseArgs({
  options: {
    out: { type: 'string' },
    runs: { type: 'string' },
    branches: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(HELP);
  process.exit(0);
}
const { out, runs, branches } = values;
if (!out || !runs || !branches) {
  console.error(`Missing one of --out, --runs, --branches.\n\n${HELP}`);
  process.exit(1);
}
const runIds = runs.split(',');
const invalid = runIds.filter((id) => !/^\d+$/.test(id));
if (invalid.length > 0) {
  console.error(`A run id is digits only: ${invalid.join(', ')}`);
  process.exit(1);
}

const origins = runIds.map((id) => ({
  id,
  ...ghParse(RunOrigin, ['api', `repos/{owner}/{repo}/actions/runs/${id}`]),
}));
const problems = origins.flatMap(({ id, ...origin }) => {
  const problem = untrustedBecause(origin, branches.split(','));
  return problem ? [`run ${id} ${problem}`] : [];
});
if (problems.length > 0) {
  console.error(`Nothing was downloaded:\n${problems.map((problem) => `- ${problem}`).join('\n')}`);
  process.exit(1);
}

const catalog = loadCatalog();
for (const { id } of oldestFirst(origins)) {
  const download = mkdtempSync(join(tmpdir(), `qa-run-${id}-`));
  try {
    execFileSync('gh', ['run', 'download', id, '--pattern', 'qa-result-*', '--dir', download], {
      stdio: 'inherit',
    });
    for (const { from, to, label } of downloadedRuns(download, out, catalog)) {
      rmSync(to, { recursive: true, force: true });
      cpSync(from, to, { recursive: true });
      console.log(`${label} from run ${id}`);
    }
  } finally {
    rmSync(download, { recursive: true, force: true });
  }
}
