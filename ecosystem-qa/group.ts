import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import Anthropic from '@anthropic-ai/sdk';

import { versionLine } from './lib/cycle.ts';
import { listQaIssues } from './lib/github.ts';
import { askClaude, modelGrouping, NO_KEY } from './lib/group-model.ts';
import { readPlanScope } from './lib/plan-scope.ts';
import { loadFindingGroups, QA_LABEL } from './lib/proposals.ts';
import type { Grouping } from './lib/schema.ts';

const HELP = `Usage: node ecosystem-qa/group.ts --results <dir> --version <storybook version> --repo <owner/name> --out <groups.json> [--plan <file> --batch <n> [--tier <tier>]]

Reads the results under --results the way collect.ts does, lists the issues of --repo that carry the
internal-qa label with gh, and asks Claude which fingerprints share a root cause and which listed
issue each group resembles. Writes the answer to --out for collect.ts --groups.
The model only groups: no text of its answer reaches an issue. Finding text is sent to the
Anthropic API with ANTHROPIC_API_KEY; the subscription token of agent runs does not work.
Without that key a local run groups nothing and leaves each fingerprint on its own, so collect.ts
makes one proposal per fingerprint. In GitHub Actions a missing key is an error.
Without a fingerprint it never calls the model.
--plan, --batch and --tier load the runs of one batch of a QA plan as collect.ts does.`;

const { values } = parseArgs({
  options: {
    results: { type: 'string' },
    version: { type: 'string' },
    repo: { type: 'string' },
    out: { type: 'string' },
    plan: { type: 'string' },
    batch: { type: 'string' },
    tier: { type: 'string' },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(HELP);
  process.exit(0);
}
const { results, version, repo, out } = values;
if (!results || !version || !repo || !out) {
  console.error(`Missing one of --results, --version, --repo, --out.\n\n${HELP}`);
  process.exit(1);
}
versionLine(version);
const scope = readPlanScope(values);

const { groups } = loadFindingGroups(results, version, scope);

let grouping: Grouping;
try {
  grouping = await modelGrouping(groups, {
    env: process.env,
    issues: () => listQaIssues(repo, QA_LABEL),
    ask: askClaude((params) => new Anthropic().beta.messages.create(params)),
  });
} catch (error) {
  if (error instanceof Anthropic.AuthenticationError) {
    console.error(`The Anthropic API rejected the key (${error.status}). ${NO_KEY}`);
  } else if (error instanceof Anthropic.RateLimitError) {
    console.error(`The Anthropic API rate-limited the request: ${error.message}`);
  } else if (error instanceof Anthropic.APIError) {
    console.error(`The Anthropic API failed with ${error.status}: ${error.message}`);
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exit(1);
}
writeFileSync(out, `${JSON.stringify(grouping, null, 2)}\n`);

for (const { members, existingIssue } of grouping.groups) {
  if (members.length > 1) {
    console.log(
      `${members[0]}: ${members.length} fingerprints${existingIssue !== undefined ? `, like #${existingIssue}` : ''}`
    );
  }
}
console.log(`${groups.length} fingerprints in ${grouping.groups.length} groups written to ${out}`);
