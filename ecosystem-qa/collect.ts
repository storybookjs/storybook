import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { z } from 'zod';

import { CATALOG_FILE, parseCatalog } from './lib/catalog.ts';
import { versionLine } from './lib/cycle.ts';
import { searchFingerprint } from './lib/github.ts';
import { groupFindings, toProposal } from './lib/proposals.ts';
import { loadResults } from './lib/results.ts';
import { sanitizeFinding } from './lib/sanitize.ts';
import { Proposal } from './lib/schema.ts';

const HELP = `Usage: node ecosystem-qa/collect.ts --results <dir> --version <storybook version> --out <proposals.json> --repo <owner/name> [--run-url <url>]

Reads the result.json of every catalog repo, os and engine under --results, either from a downloaded
artifact (<results>/qa-result-<os>-<engine>/<id>/<os>/<engine>) or from a local run
(<results>/<id>/<os>/<engine>). Merges findings by fingerprint, searches --repo for each fingerprint
with gh, and writes one proposal per fingerprint to --out.
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
  catalog: parseCatalog(JSON.parse(readFileSync(CATALOG_FILE, 'utf8'))),
  warn: (message) => console.warn(`::warning::${message}`),
}).map((run) => ({
  ...run,
  result: { ...run.result, findings: run.result.findings.map(sanitizeFinding) },
}));

const proposals = z
  .array(Proposal)
  .parse(
    groupFindings(loaded).map((group) =>
      toProposal(group, searchFingerprint(repo, group.fingerprint), runUrl)
    )
  );
writeFileSync(out, `${JSON.stringify(proposals, null, 2)}\n`);

for (const { result, resultPath } of loaded) {
  const failed = result.checks.filter((check) => check.state === 'fail').map((check) => check.id);
  console.log(
    `${resultPath}: ${result.status}, ${result.checks.length} checks, failed: ${failed.join(', ') || 'none'}`
  );
}
for (const proposal of proposals) {
  const target = proposal.kind === 'issue' ? '' : ` #${proposal.existingIssue}`;
  console.log(`${proposal.kind}${target} ${proposal.fingerprint} ${proposal.title}`);
}
console.log(`${loaded.length} results, ${proposals.length} proposals written to ${out}`);
