import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { loadCatalog } from './lib/catalog.ts';
import { versionLine } from './lib/cycle.ts';
import { listQaIssues } from './lib/github.ts';
import { groupFindings, hitsFor, QA_LABEL, toProposal } from './lib/proposals.ts';
import { loadResults, upgraded } from './lib/results.ts';

const HELP = `Usage: node ecosystem-qa/collect.ts --results <dir> --version <storybook version> --out <proposals.json> --repo <owner/name> [--run-url <url>]

Reads the result.json of every catalog repo, os and engine under --results, either from a downloaded
artifact (<results>/qa-result-<os>-<engine>/<id>/<os>/<engine>) or from a local run
(<results>/<id>/<os>/<engine>). Merges findings by fingerprint, lists the issues of --repo that carry
the internal-qa label with gh, and writes one proposal per fingerprint to --out.
--version is the version the cycle ran; a record that names another version is ignored.
--run-url defaults to this GitHub Actions run, or "local" outside Actions.`;

const { values } = parseArgs({
  options: {
    results: { type: 'string' },
    version: { type: 'string' },
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
const { results, version, out, repo } = values;
if (!results || !version || !out || !repo) {
  console.error(`Missing one of --results, --version, --out, --repo.\n\n${HELP}`);
  process.exit(1);
}
versionLine(version);

const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
const runUrl =
  values['run-url'] ??
  (GITHUB_RUN_ID
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
    : 'local');

const loaded = loadResults(results, {
  version,
  catalog: loadCatalog(),
  warn: (message) => console.warn(`::warning::${message}`),
});

const groups = groupFindings(loaded);
const issues = listQaIssues(repo, QA_LABEL);
const proposals = groups.map((group) =>
  toProposal(group, hitsFor(issues, group.fingerprint), runUrl)
);
writeFileSync(out, `${JSON.stringify(proposals, null, 2)}\n`);

for (const { result, resultPath } of loaded) {
  const failed = result.checks.filter((check) => check.state === 'fail').map((check) => check.id);
  console.log(
    `${resultPath}: ${result.status}, ${result.checks.length} checks, failed: ${failed.join(', ') || 'none'}${upgraded(result) ? '' : ', not upgraded'}`
  );
}
for (const proposal of proposals) {
  const target = proposal.kind === 'issue' ? '' : ` #${proposal.existingIssue}`;
  console.log(`${proposal.kind}${target} ${proposal.fingerprint} ${proposal.title}`);
}
console.log(`${loaded.length} results, ${proposals.length} proposals written to ${out}`);
