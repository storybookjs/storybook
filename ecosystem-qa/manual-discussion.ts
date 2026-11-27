import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { basename } from 'pathe';

import { loadEntries } from './lib/catalog.ts';
import { createDiscussion, discussionPlace, listDiscussions } from './lib/github.ts';
import { manualDiscussionOf, manualDiscussionsOf } from './lib/manual-qa.ts';
import { checkPlanText, planHash } from './lib/qa-plan.ts';
import { PlanRecord } from './lib/schema.ts';
import { TRACKING_CATEGORY } from './lib/tracking.ts';
import { Window } from './lib/window.ts';

const HELP = `Usage: node ecosystem-qa/manual-discussion.ts --plan <file> --window <file> --repo <owner/name> --commit <sha> [--print]

Creates the manual QA discussion of a QA plan in the category "${TRACKING_CATEGORY}" of --repo: the
checklist that qa-plan.ts manual prints, under a hidden first line with the plan's hash, and a link
to the plan file at --commit.
It creates nothing when a discussion of that hash exists in that category that the workflow or an
owner, member, or collaborator of --repo opened, and it never edits a discussion.
A plan without manual checks gets no discussion. A plan that fails qa-plan.ts check with that
window and a checklist longer than GitHub takes are refused.
--print reads GitHub but writes nothing: it prints the discussion it would create, or the one that exists.`;

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

const discussion = manualDiscussionOf({ plan, window, file, hash, repo, commit });
if ('skip' in discussion) {
  console.log(annotate('notice', discussion.skip));
  process.exit(0);
}
if ('refuse' in discussion) {
  fail(discussion.refuse);
}
const { title, body } = discussion.create;

const place = discussionPlace(repo, TRACKING_CATEGORY);
const [existing] = manualDiscussionsOf(listDiscussions(repo, place.categoryId), hash);
if (existing) {
  console.log(
    `The manual QA discussion of ${file} with the hash ${hash} exists as #${existing.number}, ${existing.url}, so nothing is to create.`
  );
  process.exit(0);
}

if (values.print) {
  console.log(`New discussion in "${TRACKING_CATEGORY}" of ${repo}: ${title}\n\n${body}`);
  process.exit(0);
}

const { url } = createDiscussion(place, title, body);
console.log(`Created ${url}, the manual QA discussion of ${file} with the hash ${hash}.`);
