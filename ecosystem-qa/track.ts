import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { z } from 'zod';

import { loadEntries } from './lib/catalog.ts';
import { versionLine } from './lib/cycle.ts';
import {
  addDiscussionComment,
  createDiscussion,
  discussionPlace,
  ghParse,
  listDiscussionComments,
  listDiscussions,
  listQaIssues,
  updateDiscussionComment,
  type DiscussionComment,
  type DiscussionPlace,
} from './lib/github.ts';
import { PLANS_BRANCH } from './lib/plan-push.ts';
import { readPlanScope } from './lib/plan-scope.ts';
import { openIssueOf, QA_LABEL } from './lib/proposals.ts';
import { planBatches } from './lib/qa-plan.ts';
import { loadResults } from './lib/results.ts';
import { Proposal } from './lib/schema.ts';
import {
  batchCommentOf,
  batchReport,
  DEFAULT_CAP_USD,
  nextStep,
  renderBatchComment,
  renderTrackingThread,
  resultsExpireOn,
  spentUsd,
  TRACKING_CATEGORY,
  trackingThreadOf,
  type ListedArtifact,
  type ReportedFinding,
} from './lib/tracking.ts';

const HELP = `Usage: node ecosystem-qa/track.ts --results <dir> --plan <file> --batch <n> --version <storybook version> --planned <matrix> --repo <owner/name> [--proposals <proposals.json>] [--runs <run id>[,...]] [--cap-usd <dollars>] [--budget-minutes <n>] [--dry] [--no-chain] [--print]

Writes the numbers of one batch of a QA plan into the tracking discussion of the plan, in the
discussion category "${TRACKING_CATEGORY}" of --repo: the runs of --planned that left a result under
--results and the runs that left none, their dollars, their checks by state, and one line for each
proposal of --proposals. It creates the discussion for the first batch of a plan, and edits the
comment of the batch when the same runs are reported again.
--runs are the workflow runs whose artifacts hold the results; the comment names the day the first
of their result artifacts expires.
Then it starts the next batch with gh workflow run, with the same plan hash, unless the plan has no
next batch, --no-chain is given, the batch was reported before, it left no result, a comment of the
plan was edited by anyone but the workflow, or the plan has spent --cap-usd (default ${DEFAULT_CAP_USD}).
--dry says in the comment that nothing was filed, and without it each filed finding names its issue.
--print reads GitHub but writes nothing: it prints the discussion, the comment, and the next step.`;

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
    dry: { type: 'boolean', default: false },
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

const { results, version, planned, repo } = values;
if (!results || !values.plan || !version || !planned || !repo) {
  fail(`Missing one of --results, --plan, --batch, --version, --planned, --repo.\n\n${HELP}`);
}
versionLine(version!);
const scope = readPlanScope(values, fail)!;
const runs = values.runs === '' ? [] : values.runs.split(',');
if (runs.some((id) => !/^\d+$/.test(id))) {
  fail(`A run id is digits only: ${values.runs}`);
}
const capUsd = values['cap-usd'] ? Number(values['cap-usd']) : DEFAULT_CAP_USD;
if (!Number.isFinite(capUsd) || capUsd < 0) {
  fail(`--cap-usd must be a number of dollars, found "${values['cap-usd']}".`);
}

const Planned = z.object({
  include: z.array(
    z.object({ repo: z.string(), part: z.int().min(1), os: z.string(), engine: z.string() })
  ),
});
const jobs = Planned.parse(JSON.parse(planned!)).include;

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

// Before the filing, every issue proposal is a new issue. After it, the issue that now carries the
// fingerprint is the one it was filed as.
const filed =
  proposals && !values.dry
    ? openIssueOf(
        listQaIssues(repo!, QA_LABEL),
        proposals.map(({ fingerprint }) => fingerprint)
      )
    : new Map<string, number>();

const findingOf = (proposal: Proposal): ReportedFinding => {
  const { kind, title } = proposal;
  switch (proposal.kind) {
    case 'issue': {
      const issue = filed.get(proposal.fingerprint);
      return issue === undefined ? { kind, title } : { kind, title, issue };
    }
    case 'comment':
    case 'suppressed':
      return { kind, title, issue: proposal.existingIssue };
    case 'skipped':
      return { kind, title };
  }
};

const report = batchReport({
  plan: { file: scope.file, hash: scope.hash },
  batch: scope.batch,
  batches: planBatches(scope.plan).length,
  version: version!,
  runs,
  dry: values.dry,
  planned: jobs,
  results: loaded.map(({ result }) => result),
  findings: proposals?.map(findingOf) ?? null,
});

const ArtifactPages = z.array(
  z.object({ artifacts: z.array(z.object({ name: z.string(), expires_at: z.string() })) })
);
const artifacts: ListedArtifact[] = runs.flatMap((id) =>
  ghParse(ArtifactPages, [
    'api',
    '--paginate',
    '--slurp',
    `repos/${repo}/actions/runs/${id}/artifacts?per_page=100`,
  ]).flatMap((page) => page.artifacts)
);
const expiresOn =
  resultsExpireOn(artifacts) ??
  (runs.length > 0
    ? `a day GitHub does not list, because run ${runs.join(', ')} holds no result artifact`
    : 'a day no run names, because these results are local');

// A missing category ends a run that writes; --print goes on as if the plan had no discussion yet.
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
const thread = place
  ? trackingThreadOf(listDiscussions(repo!, place.categoryId), scope.hash)
  : undefined;
const comments: DiscussionComment[] = thread ? listDiscussionComments(thread.id) : [];
const existing = batchCommentOf(comments, report);
const spend = spentUsd(comments, scope.hash, report);
const next = nextStep({
  report,
  spend,
  capUsd,
  chain: values.chain,
  reportedBefore: existing !== undefined,
});
const body = renderBatchComment(report, { spend, capUsd, next, expiresOn });
const newThread = renderTrackingThread({
  file: scope.file,
  hash: scope.hash,
  line: scope.plan.line,
  version: version!,
});

const engines = [...new Set(jobs.map(({ engine }) => engine))].toSorted().join(',');
const ref = process.env.GITHUB_REF_NAME ?? PLANS_BRANCH;
const dispatch = (batch: number) => [
  'workflow',
  'run',
  'ecosystem-qa.yml',
  '--repo',
  repo!,
  '--ref',
  ref,
  '-f',
  `plan=${scope.file}`,
  '-f',
  `batch=${batch}`,
  '-f',
  `plan_hash=${scope.hash}`,
  '-f',
  'chain=true',
  '-f',
  `version=${version}`,
  '-f',
  `engines=${engines}`,
  ...(values['budget-minutes'] ? ['-f', `budget_minutes=${values['budget-minutes']}`] : []),
];

if (values.print) {
  console.log(
    thread
      ? `Discussion ${thread.url}`
      : `New discussion in "${TRACKING_CATEGORY}": ${newThread.title}\n\n${newThread.body}`
  );
  console.log(existing ? `Edit of comment ${existing.url}:\n` : 'New comment:\n');
  console.log(body);
  console.log(
    'start' in next ? `Next: gh ${dispatch(next.start).join(' ')}` : `Next: none. ${next.stop}`
  );
  process.exit(0);
}

const discussion = thread ?? createDiscussion(place!, newThread.title, newThread.body);
const written = existing
  ? updateDiscussionComment(existing.id, body)
  : addDiscussionComment(discussion.id, body);
console.log(`${existing ? 'Edited' : 'Added'} ${written.url}`);
if ('start' in next) {
  execFileSync('gh', dispatch(next.start), { stdio: 'inherit' });
  console.log(`Started batch ${next.start} of ${scope.file}.`);
} else {
  console.log(next.stop);
}
