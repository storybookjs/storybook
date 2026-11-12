import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { z } from 'zod';

import { versionLine } from './lib/cycle.ts';
import { compareExpected, loadExpected, renderExpectReport } from './lib/expected.ts';
import { listQaIssues, releasePublishedAt } from './lib/github.ts';
import { clusterFindings, identityGrouping } from './lib/grouping.ts';
import { fence, loadFindingGroups, QA_LABEL, toProposal } from './lib/proposals.ts';
import { upgraded } from './lib/results.ts';
import { Grouping, type Proposal } from './lib/schema.ts';

const HELP = `Usage: node ecosystem-qa/collect.ts --results <dir> --version <storybook version> --out <proposals.json> --repo <owner/name> [--run-url <url>] [--expect <expected-findings.json>] [--groups <groups.json>]

Reads the result.json of every catalog repo, os and engine under --results, either from a downloaded
artifact (<results>/qa-result-<os>-<engine>/<id>/<os>/<engine>) or from a local run
(<results>/<id>/<os>/<engine>). Merges findings by fingerprint, lists the issues of --repo that carry
the internal-qa label with gh, and writes one proposal per group to --out.
--version is the version the cycle ran; a record that names another version is ignored.
--run-url defaults to this GitHub Actions run, or "local" outside Actions.
--expect compares the findings with the known ones of the repos that ran and prints which were missed.
--groups merges fingerprints that share a root cause into one proposal, led by each group's first
member and optionally matched to an existing issue by similarity; without it each fingerprint is its
own group. Every fingerprint of this collect must be in exactly one group.`;

const { values } = parseArgs({
  options: {
    results: { type: 'string' },
    version: { type: 'string' },
    out: { type: 'string' },
    repo: { type: 'string' },
    'run-url': { type: 'string' },
    expect: { type: 'string' },
    groups: { type: 'string' },
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

const { loaded, groups } = loadFindingGroups(results, version);
const issues = listQaIssues(repo, QA_LABEL);
const publishedAt = releasePublishedAt(repo, version);
console.log(
  publishedAt
    ? `${version} was published at ${publishedAt}; an issue closed as completed after that counts as known.`
    : `${repo} has no release v${version}, so a bug fixed after it is filed again.`
);
const parsed = values.groups
  ? Grouping.safeParse(JSON.parse(readFileSync(values.groups, 'utf8')))
  : { success: true as const, data: identityGrouping(groups.map((group) => group.fingerprint)) };
if (!parsed.success) {
  console.error(`${values.groups} is not a grouping:\n${z.prettifyError(parsed.error)}`);
  process.exit(1);
}
const clustering = clusterFindings(groups, parsed.data, issues);
if ('problems' in clustering) {
  console.error(
    `${values.groups} does not fit this collect:\n${clustering.problems.map((problem) => `- ${problem}`).join('\n')}`
  );
  process.exit(1);
}
const proposals = clustering.clusters.map((cluster) =>
  toProposal(cluster, issues, { runUrl, publishedAt })
);
writeFileSync(out, `${JSON.stringify(proposals, null, 2)}\n`);

for (const { result, resultPath } of loaded) {
  const failed = result.checks.filter((check) => check.state === 'fail').map((check) => check.id);
  console.log(
    `${resultPath}: ${result.status}, ${result.checks.length} checks, failed: ${failed.join(', ') || 'none'}${upgraded(result) ? '' : ', not upgraded'}`
  );
}
const targetOf = (proposal: Proposal): string => {
  switch (proposal.kind) {
    case 'issue':
      return '';
    case 'comment':
      return `${proposal.reason ? ` (${proposal.reason})` : ''} #${proposal.existingIssue}`;
    case 'suppressed':
      return ` (${proposal.reason}) #${proposal.existingIssue}`;
    case 'skipped':
      return ` (${proposal.reason})`;
  }
};
for (const proposal of proposals) {
  const more = proposal.related.length > 0 ? ` (+${proposal.related.length} more)` : '';
  console.log(
    `${proposal.kind}${targetOf(proposal)} ${proposal.fingerprint} ${proposal.title}${more}`
  );
}
console.log(`${loaded.length} results, ${proposals.length} proposals written to ${out}`);

if (values.expect) {
  const ran = new Set(loaded.map(({ result }) => result.request.entry.id));
  const report = renderExpectReport(compareExpected(loadExpected(values.expect), groups, ran));
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n${fence(report)}\n`);
  }
}
