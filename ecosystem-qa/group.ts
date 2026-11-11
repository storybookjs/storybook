import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import { versionLine } from './lib/cycle.ts';
import { listQaIssues } from './lib/github.ts';
import {
  GroupingAnswer,
  groupingInput,
  groupWithModel,
  SYSTEM_PROMPT,
  type Ask,
} from './lib/group-model.ts';
import { identityGrouping } from './lib/grouping.ts';
import { loadFindingGroups } from './lib/proposals.ts';
import type { Grouping } from './lib/schema.ts';

const HELP = `Usage: node ecosystem-qa/group.ts --results <dir> --version <storybook version> --repo <owner/name> --out <groups.json>

Reads the results under --results the way collect.ts does, lists the issues of --repo that carry the
internal-qa label with gh, and asks Claude which fingerprints share a root cause and which listed
issue each group resembles. Writes the answer to --out for collect.ts --groups.
The model only groups: no text of its answer reaches an issue. Finding text is sent to the
Anthropic API, so ANTHROPIC_API_KEY must be set; the subscription token of agent runs does not work.
With at most one fingerprint it writes the identity grouping without calling the model.`;

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

const askClaude =
  (client: Anthropic): Ask =>
  async (messages) => {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM_PROMPT,
      output_config: { effort: 'high', format: zodOutputFormat(GroupingAnswer) },
      messages,
    });
    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
      throw new Error(`The model stopped with ${response.stop_reason} instead of answering.`);
    }
    const text = response.content.find((block) => block.type === 'text');
    if (!text) {
      throw new Error(`The model answered with no text (stop reason ${response.stop_reason}).`);
    }
    return JSON.parse(text.text);
  };

const NO_KEY =
  'Grouping needs ANTHROPIC_API_KEY. The subscription token used for agent runs (CLAUDE_CODE_OAUTH_TOKEN) does not work for the Messages API.';

const modelGrouping = async (): Promise<Grouping> => {
  if (groups.length <= 1) {
    return identityGrouping(groups.map((group) => group.fingerprint));
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(NO_KEY);
  }
  return groupWithModel(groupingInput(groups, listQaIssues(repo)), askClaude(new Anthropic()));
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
