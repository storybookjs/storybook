import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';

import { join } from 'pathe';

import { loadCatalog } from './lib/catalog.ts';
import {
  oldestFirst,
  RunArtifactPages,
  RunOrigin,
  untrustedBecause,
  uploadedAt,
} from './lib/earlier-runs.ts';
import { ghParse } from './lib/github.ts';
import { downloadedRuns } from './lib/results.ts';

const HELP = `Usage: node ecosystem-qa/fetch-runs.ts --out <results dir> --runs <run id>[,<run id>...] --branches <branch>[,<branch>...]

Downloads the qa-result-* artifacts of earlier runs of the Ecosystem QA workflow with gh, from the
repository in GH_REPO, and writes each catalog repo, OS and engine they hold to
<out>/<id>/<os>/<engine>, where collect.ts reads a local run. Where two runs hold the same repo, OS
and engine, the result that was uploaded last wins, whatever the order of --runs.
Takes only runs of the workflow that were started by hand on one of --branches, and downloads
nothing when one of the ids is anything else. Writes nothing when one of the runs holds no result it
can read.`;

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

const problems = runIds.flatMap((id) => {
  const problem = untrustedBecause(
    ghParse(RunOrigin, ['api', `repos/{owner}/{repo}/actions/runs/${id}`]),
    branches.split(',')
  );
  return problem ? [`run ${id} ${problem}`] : [];
});
if (problems.length > 0) {
  console.error(
    [
      'Nothing was downloaded:',
      ...problems.map((problem) => `- ${problem}`),
      `Only a run of this workflow that was started by hand on ${branches.split(',').join(' or ')} is collected.`,
      'A sweep that ran on another branch has to be collected from that branch, so file it before the branch is merged.',
    ].join('\n')
  );
  process.exit(1);
}

const catalog = loadCatalog();
const downloads: string[] = [];
let unread: string[] = [];
try {
  const fetched = runIds.map((id) => {
    const download = mkdtempSync(join(tmpdir(), `qa-run-${id}-`));
    downloads.push(download);
    execFileSync('gh', ['run', 'download', id, '--pattern', 'qa-result-*', '--dir', download], {
      stdio: 'inherit',
    });
    const listing = ghParse(RunArtifactPages, [
      'api',
      '--paginate',
      '--slurp',
      `repos/{owner}/{repo}/actions/runs/${id}/artifacts?per_page=100`,
    ]);
    return {
      id,
      results: downloadedRuns(download, out, catalog).map((result) => {
        const uploaded = uploadedAt(listing, result.artifact);
        if (!uploaded) {
          throw new Error(`Run ${id} lists no artifact ${result.artifact}.`);
        }
        return { ...result, id, uploadedAt: uploaded };
      }),
    };
  });
  unread = fetched.filter(({ results }) => results.length === 0).map(({ id }) => id);
  if (unread.length === 0) {
    for (const { from, to, label, id } of oldestFirst(fetched.flatMap(({ results }) => results))) {
      rmSync(to, { recursive: true, force: true });
      cpSync(from, to, { recursive: true });
      console.log(`${label} from run ${id}`);
    }
  }
} finally {
  for (const download of downloads) {
    rmSync(download, { recursive: true, force: true });
  }
}
if (unread.length > 0) {
  console.error(
    `Nothing was collected: no result could be read from ${unread.map((id) => `run ${id}`).join(', ')}.\nThat is a run whose agent jobs wrote no result.json, or a run from before the result artifacts carried the repo id. Leave it out, or collect it from a commit before that change.`
  );
  process.exit(1);
}
