import { parseArgs } from 'node:util';

import { resolve } from 'pathe';

import { loadEntries } from './lib/catalog.ts';
import { fetchIssue } from './lib/issue-brief.ts';

const HELP = `Usage: node ecosystem-qa/fetch-issue.ts --issue <number> --out <empty dir> [--repo <owner/name>]

Prints a brief of one issue that the Ecosystem QA workflow filed, and downloads what it points at
into --out: the evidence of its fingerprint on the qa-assets branch, and for each sighting the
result of that repo from the run that filed it, with the session, the logs, the evidence and the
cycle bundle. It only reads GitHub, with gh, and writes nothing outside --out.
A sighting whose artifact expired is named as gone, and the rest is still fetched.
--repo is the repository of the issue, storybookjs/storybook by default.
Exits 1 for an issue without the internal-qa label or without the metadata block of the workflow.`;

const { values } = parseArgs({
  options: {
    issue: { type: 'string' },
    out: { type: 'string' },
    repo: { type: 'string', default: 'storybookjs/storybook' },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(HELP);
  process.exit(0);
}
const { issue, out, repo } = values;
if (!issue || !out) {
  console.error(`Missing one of --issue, --out.\n\n${HELP}`);
  process.exit(1);
}
if (!/^[1-9]\d*$/.test(issue)) {
  console.error(`An issue number is digits only: ${issue}`);
  process.exit(1);
}

const brief = fetchIssue({ repo, issue: Number(issue), out: resolve(out), catalog: loadEntries() });
if (brief.kind === 'refused') {
  console.error(brief.reason);
  process.exit(1);
}
console.log(brief.lines.join('\n'));
