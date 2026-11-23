import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import Anthropic from '@anthropic-ai/sdk';

import { versionLine } from './lib/cycle.ts';
import { listQaIssues } from './lib/github.ts';
import { askClaude, groupingInput, groupingMode, groupWithModel } from './lib/group-model.ts';
import { identityGrouping } from './lib/grouping.ts';
import { loadFindingGroups, QA_LABEL } from './lib/proposals.ts';
import type { Grouping } from './lib/schema.ts';

const HELP = `Usage: node ecosystem-qa/group.ts --results <dir> --version <storybook version> --repo <owner/name> --out <groups.json>

Reads the results under --results the way collect.ts does, lists the issues of --repo that carry the
internal-qa label with gh, and asks Claude which fingerprints share a root cause and which listed
issue each group resembles. Writes the answer to --out for collect.ts --groups.
The model only groups: no text of its answer reaches an issue. Finding text is sent to the
Anthropic API with ANTHROPIC_API_KEY; the subscription token of agent runs does not work.
Without that key a local run groups nothing and leaves each fingerprint on its own, so collect.ts
makes one proposal per fingerprint. In GitHub Actions a missing key is an error.
With at most one fingerprint it never calls the model.`;

const { values } = parseArgs({
  options: {
    results: { type: 'string' },
    version: { type: 'string' },
    repo: { type: 'string' },
    out: { type: 'string' },
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

const { groups } = loadFindingGroups(results, version);

const NO_KEY =
  'Grouping needs ANTHROPIC_API_KEY. The subscription token used for agent runs (CLAUDE_CODE_OAUTH_TOKEN) does not work for the Messages API.';

const modelGrouping = async (): Promise<Grouping> => {
  const ungrouped = identityGrouping(groups.map((group) => group.fingerprint));
  if (groups.length <= 1) {
    return ungrouped;
  }
  const mode = groupingMode(process.env);
  if (mode === 'fail') {
    throw new Error(NO_KEY);
  }
  if (mode === 'skip') {
    console.warn(
      `ANTHROPIC_API_KEY is not set, so nothing was grouped: each fingerprint stays on its own and becomes its own proposal. ${NO_KEY}`
    );
    return ungrouped;
  }
  const client = new Anthropic();
  return groupWithModel(
    groupingInput(groups, listQaIssues(repo, QA_LABEL)),
    askClaude((params) => client.beta.messages.create(params))
  );
};

let grouping: Grouping;
try {
  grouping = await modelGrouping();
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
