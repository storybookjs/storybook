import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';

import { basename, join } from 'pathe';

import { loadEntries } from './lib/catalog.ts';
import { ghText, listMarkedIssues, openMilestones } from './lib/github.ts';
import { manualIssueOf, manualIssuesOf } from './lib/manual-qa.ts';
import { checkPlanText, planHash } from './lib/qa-plan.ts';
import { PlanRecord } from './lib/schema.ts';
import { Window } from './lib/window.ts';

const HELP = `Usage: node ecosystem-qa/manual-issue.ts --plan <file> --window <file> --repo <owner/name> --commit <sha> [--print]

Creates the manual QA issue of a QA plan in --repo: the checklist that qa-plan.ts manual prints,
under a hidden first line with the plan's hash, and a link to the plan file at --commit, in the
milestone that the findings of the plan's line go into.
It creates nothing when an issue of that hash exists, open or closed, that the workflow or an
owner, member, or collaborator of --repo opened, and it never edits an issue.
A plan without manual checks gets no issue. A plan that fails qa-plan.ts check with that window, a
milestone that does not exist or is closed, and a checklist longer than GitHub takes are refused.
--print reads GitHub but writes nothing: it prints the issue it would create, or the one that exists.`;

const { values } = parseArgs({
  options: {
    plan: { type: 'string' },
    window: { type: 'string' },
    repo: { type: 'string' },
    commit: { type: 'string' },
    print: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(HELP);
  process.exit(0);
}

const annotate = (level: 'error' | 'notice', message: string) =>
  process.env.GITHUB_ACTIONS ? `::${level}::${message}` : message;

// A declaration, because TypeScript narrows after a call only to a declared function.
function fail(message: string): never {
  console.error(annotate('error', message));
  process.exit(1);
}

const { plan: path, window: windowPath, repo, commit } = values;
if (!path || !windowPath || !repo || !commit) {
  fail(`Missing one of --plan, --window, --repo, --commit.\n\n${HELP}`);
}
if (!/^[0-9a-f]{40}$/.test(commit)) {
  fail(`--commit is the full SHA of a commit, found "${commit}".`);
}
const file = basename(path);
if (!PlanRecord.shape.file.safeParse(file).success) {
  fail(`--plan must name a plan file, found "${path}".`);
}

const bytes = readFileSync(path);
const window = Window.parse(JSON.parse(readFileSync(windowPath, 'utf8')));
const { plan, problems } = checkPlanText(bytes.toString('utf8'), {
  catalog: loadEntries(),
  window,
});
if (!plan || problems.length > 0) {
  fail(problems.map((problem) => `${path}:${problem.line}: ${problem.message}`).join('\n'));
}
const hash = planHash(bytes);

const issue = manualIssueOf({ plan, window, file, hash, repo, commit });
if ('skip' in issue) {
  console.log(annotate('notice', issue.skip));
  process.exit(0);
}
if ('refuse' in issue) {
  fail(issue.refuse);
}
const { title, body, milestone } = issue.create;

const [existing] = manualIssuesOf(listMarkedIssues(repo, `sb-qa-manual ${hash}`), hash);
if (existing) {
  console.log(
    `The manual QA issue of ${file} with the hash ${hash} exists as #${existing.number} (${existing.state}), ${existing.html_url}, so nothing is to create.`
  );
  process.exit(0);
}

if (!openMilestones(repo).includes(milestone)) {
  fail(
    `Nothing was created. In ${repo}: milestone "${milestone}" does not exist or is closed. Create it, then run the job again.`
  );
}

if (values.print) {
  console.log(`New issue in ${repo}, milestone ${milestone}: ${title}\n\n${body}`);
  process.exit(0);
}

const bodyFile = join(mkdtempSync(join(tmpdir(), 'qa-manual-')), 'body.md');
writeFileSync(bodyFile, body);
const url = ghText([
  ...['issue', 'create', '--repo', repo, '--title', title],
  ...['--body-file', bodyFile, '--milestone', milestone],
]).trim();
console.log(`Created ${url}, the manual QA issue of ${file} with the hash ${hash}.`);
