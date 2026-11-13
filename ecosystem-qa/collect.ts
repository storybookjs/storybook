import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { z } from 'zod';

import { versionLine } from './lib/cycle.ts';
import { listQaIssues, releasePublishedAt } from './lib/github.ts';
import { clusterFindings, identityGrouping } from './lib/grouping.ts';
import { CHECKOUT_GUIDE } from './lib/migration-guide.ts';
import { loadFindingGroups, QA_LABEL, toProposal } from './lib/proposals.ts';
import { upgraded } from './lib/results.ts';
import { Grouping, type Proposal } from './lib/schema.ts';
import { writeStepSummary } from './lib/step-summary.ts';
import { withoutResult } from './lib/sweep-matrix.ts';

const HELP = `Usage: node ecosystem-qa/collect.ts --results <dir> --version <storybook version> --out <proposals.json> --repo <owner/name> [--run-url <url>] [--groups <groups.json>]

Reads the result.json of every catalog repo, os and engine under --results, either from a downloaded
artifact (<results>/qa-result-<id>-<os>-<engine>/<id>/<os>/<engine>) or from a local run
(<results>/<id>/<os>/<engine>). Merges findings by fingerprint, lists the issues of --repo that carry
the internal-qa label with gh, and writes one proposal per group to --out.
--version is the version the cycle ran; a record that names another version is ignored.
--run-url defaults to this GitHub Actions run, or "local" outside Actions.
--groups merges fingerprints that share a root cause into one proposal, led by each group's first
member and optionally matched to an existing issue by similarity; without it each fingerprint is its
own group. Every fingerprint of this collect must be in exactly one group.
--planned takes the job matrix of the sweep, as plan.ts prints it, and names every job of it that left
no result.`;

const { values } = parseArgs({
  options: {
    results: { type: 'string' },
    version: { type: 'string' },
    out: { type: 'string' },
    repo: { type: 'string' },
    'run-url': { type: 'string' },
    groups: { type: 'string' },
    planned: { type: 'string' },
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
    `${resultPath}: ${result.status}, ${result.checks.length} checks, failed: ${failed.join(', ') || 'none'}${upgraded(result) ? '' : ', not upgraded'}${result.migrationGuide === CHECKOUT_GUIDE ? ', judged against the migration guide of the checkout' : ''}`
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
const Planned = z.object({
  include: z.array(z.object({ repo: z.string(), os: z.string(), engine: z.string() })),
});
const missing = values.planned
  ? withoutResult(
      Planned.parse(JSON.parse(values.planned)).include,
      loaded.map(({ result }) => ({
        repo: result.request.entry.id,
        os: result.request.os,
        engine: result.request.engine,
      }))
    )
  : [];
for (const run of missing) {
  console.log(
    `${process.env.GITHUB_ACTIONS ? '::warning::' : ''}No result from ${run}: its job left none, which is what a lost runner or a cancelled job looks like.`
  );
}
if (missing.length > 0) {
  writeStepSummary(
    ['### Runs without a result', '', ...missing.map((run) => `- ${run}`), ''].join('\n')
  );
}
console.log(
  `${loaded.length} results, ${proposals.length} proposals written to ${out}${values.planned ? `, ${missing.length} of the planned runs left no result` : ''}`
);
