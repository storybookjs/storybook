import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { basename, dirname, join, relative, resolve } from 'pathe';

import { searchFingerprint } from './lib/github.ts';
import { groupFindings, toProposal, type LoadedResult } from './lib/proposals.ts';
import { RunResultFile } from './lib/schema.ts';

const HELP = `Usage: node ecosystem-qa/collect.ts --results <dir> --out <proposals.json> --repo <owner/name> [--run-url <url>]

Reads every result.json under --results, merges findings by fingerprint, searches --repo for each
fingerprint with gh, and writes one proposal per fingerprint to --out.
--run-url defaults to this GitHub Actions run, or "local" outside Actions.`;

const { values } = parseArgs({
  options: {
    results: { type: 'string' },
    out: { type: 'string' },
    repo: { type: 'string' },
    'run-url': { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(HELP);
  process.exit(0);
}
if (!values.results || !values.out || !values.repo) {
  console.error(`Missing one of --results, --out, --repo.\n\n${HELP}`);
  process.exit(1);
}

const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
const runUrl =
  values['run-url'] ??
  (GITHUB_RUN_ID
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
    : 'local');

const resultPaths = readdirSync(resolve(values.results), { recursive: true, encoding: 'utf8' })
  .filter((path) => basename(path) === 'result.json')
  .map((path) => relative(process.cwd(), join(resolve(values.results!), path)))
  .sort();

const loaded: LoadedResult[] = resultPaths.map((resultPath) => {
  const result = RunResultFile.parse(JSON.parse(readFileSync(resultPath, 'utf8')));
  const infoFile = join(dirname(resultPath), result.paths.evidenceDir, 'storybook-info.txt');
  return {
    resultPath,
    result,
    ...(existsSync(infoFile) ? { systemInfo: readFileSync(infoFile, 'utf8') } : {}),
  };
});

const proposals = groupFindings(loaded).map((group) =>
  toProposal(group, searchFingerprint(values.repo!, group.fingerprint), runUrl)
);
writeFileSync(values.out, `${JSON.stringify(proposals, null, 2)}\n`);

for (const { result, resultPath } of loaded) {
  const failed = result.checks.filter((check) => check.state === 'fail').map((check) => check.id);
  console.log(
    `${resultPath}: ${result.status}, ${result.checks.length} checks, failed: ${failed.join(', ') || 'none'}`
  );
}
for (const proposal of proposals) {
  const target = proposal.existingIssue ? ` #${proposal.existingIssue}` : '';
  console.log(`${proposal.kind}${target} ${proposal.fingerprint} ${proposal.title}`);
}
console.log(`${loaded.length} results, ${proposals.length} proposals written to ${values.out}`);
