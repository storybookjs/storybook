import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { basename } from 'pathe';
import { z } from 'zod';

import { loadEntries } from './lib/catalog.ts';
import { versionLine } from './lib/cycle.ts';
import {
  addDiscussionComment,
  createDiscussion,
  discussionPlace,
  listDiscussionComments,
  listDiscussions,
  listRunArtifacts,
  listQaIssues,
  updateDiscussionComment,
  type DiscussionComment,
  type DiscussionPlace,
} from './lib/github.ts';
import { manualDiscussionsOf } from './lib/manual-qa.ts';
import { PLANS_BRANCH } from './lib/plan-push.ts';
import { readPlanScope } from './lib/plan-scope.ts';
import { openIssueOf, QA_LABEL } from './lib/proposals.ts';
import { planBatches } from './lib/qa-plan.ts';
import { loadResults } from './lib/results.ts';
import { FiledIssues, PlanRecord, Proposal } from './lib/schema.ts';
import {
  attemptOf,
  batchDispatch,
  batchReport,
  chainEndComment,
  DEFAULT_CAP_USD,
  findingsOf,
  PlannedMatrix,
  renderTrackingThread,
  resultsExpireOn,
  startNext,
  TRACKING_CATEGORY,
  trackBatch,
  trackingThreadsOf,
} from './lib/tracking.ts';

const HELP = `Usage: node ecosystem-qa/track.ts --results <dir> --plan <file> --batch <n> --version <storybook version> --planned <matrix> --repo <owner/name> [--proposals <proposals.json>] [--runs <run id>[,...]] --filing <dry|pending|filed|failed> [--filed <filed.json>] [--cap-usd <dollars>] [--budget-minutes <n>] [--no-chain] [--print]
       node ecosystem-qa/track.ts --ended <hash|gone> --plan <file> --batch <n> --hash <hash> --runs <run id> --repo <owner/name> [--print]

Writes the numbers of one batch of a QA plan into the tracking discussion of the plan, in the
discussion category "${TRACKING_CATEGORY}" of --repo: the runs of --planned that left a result under
--results and the runs that left none, their dollars, their checks by state, and one line for each
proposal of --proposals. It creates the discussion for the first batch of a plan, and edits the
comment of the batch when the same runs are reported again.
--runs are the workflow runs whose artifacts hold the results; the comment names the day the first
of their result artifacts expires.
Then it starts the next batch with gh workflow run, with the same plan hash, unless the plan has no
next batch, --no-chain is given, the batch was reported before, it left no result, the spend of the
plan may be short of what it spent, the discussion holds a report of a later batch, or the plan has
spent --cap-usd (default ${DEFAULT_CAP_USD}). It never writes over a comment that someone else edited.
It writes the comment after the dispatch, and if the dispatch fails, the comment says so in place of
the next batch. A comment that starts no batch prints the dispatch that starts it by hand.
--filing says what the comment says of the filing: dry prints the dispatch that files the batch,
pending says that the file job of this run files it next, filed names the issue of each finding,
and failed says that the filing did not finish. A filed or failed comment names the issues of
--filed, which file.ts --filed wrote, and without that file the open internal-qa issues.
--print reads GitHub but writes nothing: it prints the discussion, the comment, and the next step.

With --ended, says in the discussion of the plan with the hash --hash that run --runs ran nothing for
batch <n>, because it found the plan --plan with the hash --ended, or gone.`;

const { values } = parseArgs({
  allowNegative: true,
  options: {
    results: { type: 'string' },
    proposals: { type: 'string' },
    plan: { type: 'string' },
    batch: { type: 'string' },
    version: { type: 'string' },
    planned: { type: 'string' },
    runs: { type: 'string', default: '' },
    repo: { type: 'string' },
    'cap-usd': { type: 'string' },
    'budget-minutes': { type: 'string' },
    filing: { type: 'string' },
    filed: { type: 'string' },
    hash: { type: 'string' },
    ended: { type: 'string' },
    chain: { type: 'boolean', default: true },
    print: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});
if (values.help) {
  console.log(HELP);
  process.exit(0);
}

const fail = (message: string): never => {
  console.error(process.env.GITHUB_ACTIONS ? `::error::${message}` : message);
  process.exit(1);
};

const warn = (message: string) =>
  console.warn(process.env.GITHUB_ACTIONS ? `::warning::${message}` : message);

const endChain = (ended: string): never => {
  const { plan = '', batch = '', hash = '', runs, repo } = values;
  const file = basename(plan);
  if (!PlanRecord.shape.file.safeParse(file).success) {
    fail(`--plan must name a plan file, found "${plan}".`);
  }
  if (!/^[0-9a-f]{12}$/.test(hash) || !/^([0-9a-f]{12}|gone)$/.test(ended)) {
    fail(`--hash is a plan hash and --ended a plan hash or gone, found "${hash}" and "${ended}".`);
  }
  if (!/^[1-9]\d*$/.test(batch)) {
    fail(`--batch must be a whole number from 1, found "${batch}".`);
  }
  if (!/^\d+$/.test(runs) || !repo) {
    fail(`--ended needs the one run id of --runs and --repo.\n\n${HELP}`);
  }
  const place = discussionPlace(repo!, TRACKING_CATEGORY);
  const [thread] = trackingThreadsOf(listDiscussions(repo!, place.categoryId), hash);
  if (!thread) {
    console.log(`No discussion tracks the plan with the hash ${hash}, so nothing is said there.`);
    process.exit(0);
  }
  const body = chainEndComment(listDiscussionComments(thread.id), {
    file,
    hash,
    batch: Number(batch),
    run: runs,
    now: ended === 'gone' ? undefined : ended,
  });
  if (!body) {
    console.log(`${thread.url} says already that the chain ended here.`);
  } else if (values.print) {
    console.log(`New comment in ${thread.url}:\n\n${body}`);
  } else {
    console.log(`Added ${addDiscussionComment(thread.id, body).url}`);
  }
  return process.exit(0);
};

if (values.ended !== undefined) {
  endChain(values.ended);
}

const { results, version, planned, repo } = values;
if (!results || !values.plan || !version || !planned || !repo || !values.filing) {
  fail(
    `Missing one of --results, --plan, --batch, --version, --planned, --repo, --filing.\n\n${HELP}`
  );
}
const filing = z.enum(['dry', 'pending', 'filed', 'failed']).safeParse(values.filing).data;
if (!filing) {
  fail(`--filing is dry, pending, filed or failed, found "${values.filing}".`);
}
versionLine(version!);
const scope = readPlanScope(values)!;
const runs = values.runs === '' ? [] : values.runs.split(',');
if (runs.some((id) => !/^\d+$/.test(id))) {
  fail(`A run id is digits only: ${values.runs}`);
}
const capUsd = values['cap-usd'] ? Number(values['cap-usd']) : DEFAULT_CAP_USD;
if (!Number.isFinite(capUsd) || capUsd < 0) {
  fail(`--cap-usd must be a number of dollars, found "${values['cap-usd']}".`);
}

const jobs = PlannedMatrix.parse(JSON.parse(planned!)).include;

const loaded = loadResults(results!, {
  version: version!,
  catalog: loadEntries(scope.plan),
  plan: scope,
  warn,
});

const proposals =
  values.proposals && existsSync(values.proposals)
    ? z.array(Proposal).parse(JSON.parse(readFileSync(values.proposals, 'utf8')))
    : null;
if (!proposals) {
  warn(`No proposals at ${values.proposals ?? 'no --proposals'}, so the comment lists no finding.`);
}

// GitHub's listing of the label can miss an issue created a second before, so the issues that
// file.ts handed over win, and the listing names the issues of a filing that handed none over.
const issuesOfFindings = () =>
  values.filed && existsSync(values.filed)
    ? new Map(Object.entries(FiledIssues.parse(JSON.parse(readFileSync(values.filed, 'utf8')))))
    : openIssueOf(
        listQaIssues(repo!, QA_LABEL),
        proposals!.map(({ fingerprint }) => fingerprint)
      );
const filed =
  proposals && (filing === 'filed' || filing === 'failed')
    ? issuesOfFindings()
    : new Map<string, number>();

const report = batchReport({
  plan: { file: scope.file, hash: scope.hash },
  ref: process.env.GITHUB_REF_NAME ?? PLANS_BRANCH,
  batch: scope.batch,
  batches: planBatches(scope.plan).length,
  version: version!,
  runs,
  attempt: attemptOf(runs, process.env),
  budgetMinutes: values['budget-minutes'],
  filing: filing!,
  planned: jobs,
  results: loaded.map(({ result }) => result),
  findings: proposals ? findingsOf(proposals, filed) : null,
});

const expiresOn = resultsExpireOn(runs.flatMap((id) => listRunArtifacts(repo!, id)));

const placeOf = (): DiscussionPlace | undefined => {
  try {
    return discussionPlace(repo!, TRACKING_CATEGORY);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (values.print) {
      console.error(`${message} Printing the discussion as the first batch would create it.`);
      return undefined;
    }
    return fail(message);
  }
};

const place = placeOf();
const discussions = place ? listDiscussions(repo!, place.categoryId) : [];
const threads = trackingThreadsOf(discussions, scope.hash);
const [thread] = threads;
const comments: DiscussionComment[] = thread ? listDiscussionComments(thread.id) : [];
const tracked = trackBatch({
  report,
  comments,
  discussions: threads.map(({ url }) => url),
  capUsd,
  chain: values.chain,
  expiresOn,
});
const settled = 'refuse' in tracked ? fail(tracked.refuse) : tracked;
const { existing, next, body } = settled;
const newThread = renderTrackingThread({
  file: scope.file,
  hash: scope.hash,
  line: scope.plan.line,
  version: version!,
  manualDiscussion: manualDiscussionsOf(discussions, scope.hash)[0]?.number,
});

const dispatch = (batch: number) => [...batchDispatch(report, batch), '--repo', repo!];

if (values.print) {
  console.log(
    thread
      ? `Discussion ${thread.url}`
      : `New discussion in "${TRACKING_CATEGORY}": ${newThread.title}\n\n${newThread.body}`
  );
  console.log(existing ? `Edit of comment ${existing.url}:\n` : 'New comment:\n');
  console.log(body);
  console.log(
    'start' in next ? `Dispatch: gh ${dispatch(next.start).join(' ')}` : 'Dispatch: none.'
  );
  process.exit(0);
}

const discussion = thread ?? createDiscussion(place!, newThread.title, newThread.body);
const { body: final, failure } = startNext(settled, (batch) =>
  execFileSync('gh', dispatch(batch), { stdio: 'inherit' })
);
const written = existing
  ? updateDiscussionComment(existing.id, final)
  : addDiscussionComment(discussion.id, final);
console.log(`${existing ? 'Edited' : 'Added'} ${written.url}`);
if (failure) {
  fail(failure);
}
console.log('start' in next ? `Started batch ${next.start} of ${scope.file}.` : next.stop);
