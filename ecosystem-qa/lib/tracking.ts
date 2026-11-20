import { z } from 'zod';

import { byHarness, type Actor } from './github.ts';
import { USD_PER_RUN } from './qa-plan.ts';
import { CheckResult, type Proposal, type RunResultFile } from './schema.ts';

export const TRACKING_CATEGORY = 'QA sweeps';

export const DEFAULT_CAP_USD = 250;

export type Written = { id: string; url: string; body: string; author: Actor; editor: Actor };

// A body written in the browser comes back with CRLF line ends.
export const firstLine = (body: string) => body.split(/\r?\n/, 1)[0] ?? '';

const PLAN_MARKER = /^<!-- sb-qa-plan ([0-9a-f]{12}) \S+ -->$/;
const BATCH_MARKER = /^<!-- sb-qa-batch ([0-9a-f]{12}) batch=(\d+) version=\S+ runs=[\d,]* -->$/;
const END_MARKER = /^<!-- sb-qa-end ([0-9a-f]{12}) batch=\d+ run=\d+ -->$/;
const NEXT_LINE = /^Next: (.+)$/;
const STARTED = /^Batch (\d+) is started\.$/;
const RUN_LEDGER = /^<!-- sb-qa-run (\S+) usd=(\d+(?:\.\d+)?) -->$/;
const TOTAL_LINE = /^<!-- sb-qa-total usd=(\d+(?:\.\d+)?) runs=(\d+) -->$/;
const RESUME_LINE = /^To start batch (\d+) by hand /;
// The first form is the line that the workflow wrote before the cost of a batch had a line of its
// own, which a discussion may still hold.
const SHORT_SPEND = /^(?:Spent on this plan:|The plan cost) at least /m;

export const qaPrefix = (line: string): string => `[SB ${line.split('.')[0]} QA]`;

export const trackingTitle = (line: string, file: string): string =>
  `${qaPrefix(line)} Dynamic sweep ${file}`;

export type TrackedPlan = {
  file: string;
  hash: string;
  line: string;
  version: string;
  // The discussion that holds the manual checks of the plan, none when it has none yet.
  manualDiscussion?: number;
};

export const renderTrackingThread = ({
  file,
  hash,
  line,
  version,
  manualDiscussion,
}: TrackedPlan): { title: string; body: string } => ({
  title: trackingTitle(line, file),
  body: [
    `<!-- sb-qa-plan ${hash} ${file} -->`,
    `The logbook of one QA sweep: the plan \`${file}\` with the hash \`${hash}\`, first run on Storybook ${version}.`,
    ...(manualDiscussion === undefined
      ? []
      : [`The checks of the plan that a person does by hand are in #${manualDiscussion}.`]),
    '',
    'The workflow adds one comment for each batch it runs, with the runs, their dollars, their checks, and their findings, and edits that comment when it collects the batch again.',
    'The spend of the sweep is the sum of those comments. A comment by anyone else is not part of it, and a comment of the workflow that anyone else edits stops the sweep, because its dollars can no longer be read.',
    '',
  ].join('\n'),
});

export type ChainEnd = {
  file: string;
  hash: string;
  batch: number;
  run: string;
  // The hash of the plan at the commit of the run, none when the plan is gone.
  now: string | undefined;
};

// The comment that says in the discussion of a plan that a run of a batch ran nothing because the
// plan changed, none when the discussion says so already for this batch and run.
export const chainEndComment = (comments: Written[], end: ChainEnd): string | undefined => {
  const marker = `<!-- sb-qa-end ${end.hash} batch=${end.batch} run=${end.run} -->`;
  const found = end.now ? `\`${end.file}\` with the hash \`${end.now}\`` : `no \`${end.file}\``;
  return comments.some((comment) => byHarness(comment.author) && firstLine(comment.body) === marker)
    ? undefined
    : [
        marker,
        `Workflow run ${end.run} ran nothing for batch ${end.batch} of this plan, because it found ${found} where this sweep has the hash \`${end.hash}\`.`,
        'A changed plan is a sweep of its own, with a discussion of its own.',
        '',
      ].join('\n');
};

// The discussions of the plan, oldest first. A plan has one, and the workflow writes into the first.
export const trackingThreadsOf = <Thread extends Written & { number: number }>(
  discussions: Thread[],
  hash: string
): Thread[] =>
  discussions
    .filter(
      (discussion) =>
        byHarness(discussion.author) && PLAN_MARKER.exec(firstLine(discussion.body))?.[1] === hash
    )
    .toSorted((a, b) => a.number - b.number);

type CheckState = RunResultFile['checks'][number]['state'];

export type ReportedResult = {
  request: { entry: { id: string }; os: string; engine: string; plan?: { part: number } };
  timing: { startedAt: string };
  usage: { usd: number | null };
  status: RunResultFile['status'];
  checks: { state: CheckState }[];
};

export type ReportedFinding = { kind: Proposal['kind']; title: string; issue?: number };

type Proposed =
  | { kind: 'issue'; title: string; fingerprint: string }
  | { kind: 'comment' | 'suppressed'; title: string; existingIssue: number }
  | { kind: 'skipped'; title: string };

// `filed` maps the fingerprint of each filed issue to its number.
export const findingsOf = (proposals: Proposed[], filed: Map<string, number>): ReportedFinding[] =>
  proposals.map((proposal) => {
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
  });

// The attempt of a workflow run that reports its own batch, and 1 for a collect of other runs.
export const attemptOf = (
  runs: string[],
  { GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT = '1' }: Record<string, string | undefined>
): number => (runs.length === 1 && runs[0] === GITHUB_RUN_ID ? Number(GITHUB_RUN_ATTEMPT) : 1);

// `failed` is a file job whose filing did not finish.
export type Filing = 'dry' | 'pending' | 'filed' | 'failed';

export const PlannedMatrix = z.object({
  include: z.array(
    z.object({ repo: z.string(), part: z.int().min(1), os: z.string(), engine: z.string() })
  ),
});

export type PlannedJob = z.infer<typeof PlannedMatrix>['include'][number];

const enginesOf = (planned: PlannedJob[]) =>
  [...new Set(planned.map(({ engine }) => engine))].toSorted().join(',');

export type BatchInput = {
  plan: { file: string; hash: string };
  // The branch the batch ran on, which every later dispatch of the plan runs on too.
  ref: string;
  batch: number;
  batches: number;
  version: string;
  runs: string[];
  // The attempt of the workflow run in `runs` that reports its own batch, which "Re-run failed
  // jobs" raises while the run id stays.
  attempt: number;
  budgetMinutes?: string;
  filing: Filing;
  planned: PlannedJob[];
  results: ReportedResult[];
  findings: ReportedFinding[] | null;
};

export type RunLine = {
  key: string;
  job: PlannedJob;
  outcome: RunResultFile['status'] | 'no result';
  usd: number;
  flat: boolean;
};

export type BatchReport = Omit<BatchInput, 'planned' | 'results'> & {
  planned: number;
  engines: string;
  lines: RunLine[];
  checks: { state: CheckState; count: number }[];
};

const jobKey = ({ repo, part, os, engine }: PlannedJob) => `${repo}/${part}/${os}/${engine}`;

const jobOf = ({ request }: ReportedResult): PlannedJob => ({
  repo: request.entry.id,
  part: request.plan?.part ?? 1,
  os: request.os,
  engine: request.engine,
});

// A run is its job and the moment its runner started, so a second collect of the same artifact
// counts it once and a second run of the batch counts again.
const resultLine = (result: ReportedResult): RunLine => {
  const job = jobOf(result);
  const started = Date.parse(result.timing.startedAt);
  return {
    key: `${jobKey(job)}/${Number.isNaN(started) ? 'unknown-start' : new Date(started).toISOString()}`,
    job,
    outcome: result.status,
    usd: result.usage.usd ?? USD_PER_RUN,
    flat: result.usage.usd === null,
  };
};

export const batchReport = ({ planned, results, runs, ...input }: BatchInput): BatchReport => {
  const sorted = runs.toSorted((a, b) => Number(a) - Number(b));
  const finished = new Set(results.map((result) => jobKey(jobOf(result))));
  const lost = planned
    .filter((job) => !finished.has(jobKey(job)))
    .map((job): RunLine => ({
      key: `${jobKey(job)}/lost-${sorted.join('+')}${input.attempt > 1 ? `-attempt-${input.attempt}` : ''}`,
      job,
      outcome: 'no result',
      usd: USD_PER_RUN,
      flat: true,
    }));
  const states = results.flatMap((result) => result.checks.map((check) => check.state));
  return {
    ...input,
    runs: sorted,
    planned: planned.length,
    engines: enginesOf(planned),
    lines: [...results.map(resultLine), ...lost],
    checks: CheckResult.shape.state.options
      .map((state) => ({ state, count: states.filter((seen) => seen === state).length }))
      .filter(({ count }) => count > 0),
  };
};

export const batchMarker = ({ plan, batch, version, runs }: BatchReport): string =>
  `<!-- sb-qa-batch ${plan.hash} batch=${batch} version=${version} runs=${runs.join(',')} -->`;

export const batchCommentOf = <Comment extends Written>(
  comments: Comment[],
  report: BatchReport
): Comment | undefined =>
  comments.find(
    (comment) => byHarness(comment.author) && firstLine(comment.body) === batchMarker(report)
  );

export type Total = { usd: number; runs: number };

// `held` is what the counted comments sum to, and `written` the spend of the most runs that any of
// them was written with, which `held` reaches unless a comment that counted toward it is gone. `batches` are
// the batches with a counted comment, `started` the batches that a counted comment started, and
// `unreadable` names each comment of the workflow whose dollars cannot be counted, and why.
export type Spend = Total & {
  held: Total;
  written: Total;
  batches: number[];
  started: number[];
  unreadable: string[];
};

const editedByOther = (comment: Written) => comment.editor !== null && !byHarness(comment.editor);

type LedgerEntry = { key: string; usd: number };

const ledgerOf = (body: string): LedgerEntry[] =>
  body.split(/\r?\n/).flatMap((line) => {
    const match = RUN_LEDGER.exec(line);
    return match ? [{ key: match[1]!, usd: Number(match[2]) }] : [];
  });

export const carriedRuns = (existing: Written | undefined, report: BatchReport): LedgerEntry[] => {
  const reported = new Set(report.lines.map(({ key }) => key));
  return existing ? ledgerOf(existing.body).filter(({ key }) => !reported.has(key)) : [];
};

const lineOf = (body: string, pattern: RegExp): string | undefined =>
  body
    .split(/\r?\n/)
    .map((line) => pattern.exec(line)?.[1])
    .find((found) => found !== undefined);

const nextOf = (body: string) => lineOf(body, NEXT_LINE);

const unreadableOf = (comment: Written, hash: string): string | undefined => {
  if (editedByOther(comment)) {
    return `${comment.url}, which someone other than the workflow edited`;
  }
  const first = firstLine(comment.body);
  if (BATCH_MARKER.exec(first)?.[1] !== hash && END_MARKER.exec(first)?.[1] !== hash) {
    return `${comment.url}, whose first line is not the hidden line of a batch of this plan`;
  }
  return undefined;
};

// A run that two comments hold counts once, at the higher of their prices.
const totalOf = (entries: LedgerEntry[]): Total => {
  const ledger = new Map<string, number>();
  for (const { key, usd } of entries) {
    ledger.set(key, Math.max(usd, ledger.get(key) ?? 0));
  }
  return { usd: [...ledger.values()].reduce((sum, usd) => sum + usd, 0), runs: ledger.size };
};

const countedOf = <Comment extends Written>(comments: Comment[], hash: string): Comment[] =>
  comments.filter(
    (comment) =>
      byHarness(comment.author) &&
      unreadableOf(comment, hash) === undefined &&
      BATCH_MARKER.test(firstLine(comment.body))
  );

const batchOf = (comment: Written) => Number(BATCH_MARKER.exec(firstLine(comment.body))![2]);

export const spentUsd = (comments: Written[], hash: string, current?: BatchReport): Spend => {
  const ours = comments.filter((comment) => byHarness(comment.author));
  const counted = countedOf(comments, hash);
  const ledger = counted.flatMap(({ body }) => ledgerOf(body));
  const totals = counted.flatMap(({ body }) =>
    body.split(/\r?\n/).flatMap((line) => {
      const match = TOTAL_LINE.exec(line);
      return match ? [{ usd: Number(match[1]), runs: Number(match[2]) }] : [];
    })
  );
  return {
    ...totalOf([...ledger, ...(current?.lines ?? [])]),
    held: totalOf(ledger),
    written: totals.toSorted((a, b) => b.runs - a.runs)[0] ?? { usd: 0, runs: 0 },
    batches: counted.map(batchOf),
    started: counted.flatMap(({ body }) => {
      const started = STARTED.exec(nextOf(body) ?? '')?.[1];
      return started ? [Number(started)] : [];
    }),
    unreadable: ours.flatMap((comment) => unreadableOf(comment, hash) ?? []),
  };
};

// The comments of the batches before the batch of the report, and of its own batch up to its own
// comment, so that writing that comment again after later reports leaves its cost as it was.
const costScope = (comments: Written[], report: BatchReport): Written[] => {
  const existing = batchCommentOf(comments, report);
  const until = existing ? comments.indexOf(existing) : comments.length;
  return countedOf(comments, report.plan.hash).filter(
    (comment) =>
      batchOf(comment) < report.batch ||
      (batchOf(comment) === report.batch && comments.indexOf(comment) <= until)
  );
};

// `reports` counts the comments of the batch that `batch` sums, this report's own included.
export type Cost = { batch: Total & { reports: number }; plan: Total };

export const costOf = (comments: Written[], report: BatchReport): Cost => {
  const scope = costScope(comments, report);
  const own = scope.filter((comment) => batchOf(comment) === report.batch);
  const existing = batchCommentOf(comments, report);
  const ledger = (counted: Written[]) => [
    ...counted.flatMap(({ body }) => ledgerOf(body)),
    ...report.lines,
  ];
  return {
    batch: {
      ...totalOf(ledger(own)),
      reports: own.filter((comment) => comment !== existing).length + 1,
    },
    plan: totalOf(ledger(scope)),
  };
};

const missingBatches = ({ batch }: BatchReport, { batches }: Spend): number[] =>
  Array.from({ length: batch - 1 }, (_, index) => index + 1).filter(
    (earlier) => !batches.includes(earlier)
  );

// `resume` is the batch that a person can start by hand once the reason of the stop is gone.
export type NextStep = { start: number } | { stop: string; resume?: number };

export type StepInput = {
  report: BatchReport;
  spend: Spend;
  capUsd: number;
  chain: boolean;
  // The comment of an earlier report of the same batch and runs.
  reported: Written | undefined;
  // The address of each discussion of the plan.
  discussions: string[];
};

const dollars = (usd: number) => `$${usd.toFixed(2)}`;

const runCount = (count: number) => (count === 1 ? '1 run' : `${count} runs`);

const spendOf = ({ usd, runs }: Total) => `${dollars(usd)} for ${runCount(runs)}`;

// Why the comments of the discussion may hold less than the plan spent, none when nothing says so.
const shortfall = ({ report, spend, reported, discussions }: StepInput): string | undefined => {
  if (discussions.length > 1) {
    return `the plan has ${discussions.length} discussions, ${discussions.join(' and ')}, which share its spend`;
  }
  if (spend.unreadable.length > 0) {
    return `the spend of this plan cannot be read from ${spend.unreadable.join(', nor from ')}`;
  }
  const missing = missingBatches(report, spend);
  if (missing.length > 0) {
    return `this discussion holds no report of ${missing.length === 1 ? 'batch' : 'batches'} ${missing.slice(0, -1).join(', ')}${missing.length > 1 ? ' and ' : ''}${missing.at(-1)}, so the spend of the plan is unknown`;
  }
  // A run keeps its key in every later report, so only a comment that is gone takes runs away.
  if (spend.held.runs < spend.written.runs) {
    return `the comments of this discussion hold ${spendOf(spend.held)}, where one of them was written with ${spendOf(spend.written)}, so a comment of the workflow is gone`;
  }
  if (report.attempt > 1 && !reported) {
    return `attempt ${report.attempt} of workflow run ${report.runs.join(', ')} is its first report here, so what its earlier attempts spent, and whether one of them started batch ${report.batch + 1}, is unknown`;
  }
  return undefined;
};

export const nextStep = (input: StepInput): NextStep => {
  const { report, spend, capUsd, chain, reported } = input;
  const next = report.batch + 1;
  const notStarted = `Batch ${next} was not started`;
  if (report.batch >= report.batches) {
    return { stop: `Batch ${report.batch} is the last batch of the plan.` };
  }
  if (reported) {
    const resume = lineOf(reported.body, RESUME_LINE);
    return {
      stop:
        nextOf(reported.body) ??
        `Batch ${next} is not started from this report, because batch ${report.batch} was reported before.`,
      ...(resume ? { resume: Number(resume) } : {}),
    };
  }
  if (!chain) {
    return { stop: `${notStarted}, because this run does not chain.`, resume: next };
  }
  const short = shortfall(input);
  if (short) {
    return { stop: `${notStarted}, because ${short}.`, resume: next };
  }
  const ahead = spend.batches.find((batch) => batch >= next);
  if (ahead !== undefined) {
    return {
      stop: `${notStarted}, because this discussion holds a report of batch ${ahead} already, so another run of the plan went on from here.`,
    };
  }
  if (spend.started.includes(next)) {
    return {
      stop: `${notStarted} again, because an earlier report of batch ${report.batch} started it already.`,
    };
  }
  if (report.lines.every((line) => line.outcome === 'no result')) {
    return { stop: `${notStarted}, because batch ${report.batch} left no result.`, resume: next };
  }
  if (spend.usd >= capUsd) {
    return {
      stop: `${notStarted}, because ${dollars(spend.usd)} is spent and the cap is ${dollars(capUsd)}.`,
      resume: next,
    };
  }
  return { start: next };
};

// A title in a body is inline markdown: a newline would start a block, a `<` HTML, and an `@` a
// mention, which notifies whoever it names.
const inline = (text: string) =>
  text.replace(/\s+/g, ' ').replaceAll('<', '&lt;').replaceAll('@', '@\u200B');

const findingLine = (filing: Filing, { kind, title, issue }: ReportedFinding) => {
  const unfiled = filing === 'filed' || filing === 'failed' ? 'not filed' : 'new issue';
  const where = {
    issue: issue === undefined ? unfiled : `filed as #${issue}`,
    comment: `comment on #${issue}`,
    suppressed: `known as #${issue}`,
    skipped: 'skipped',
  }[kind];
  return `- ${where}: ${inline(title)}`;
};

type ListedArtifact = { name: string; expires_at: string };

export const resultsExpireOn = (artifacts: ListedArtifact[]): string | undefined =>
  artifacts
    .filter(({ name }) => name.startsWith('qa-result-'))
    .map(({ expires_at }) => new Date(expires_at).toISOString().slice(0, 10))
    .toSorted()[0];

export type CommentContext = {
  spend: Spend;
  cost: Cost;
  // The cost of the plan may be short of what it spent, so the comment says "at least".
  short: boolean;
  capUsd: number;
  next: NextStep;
  // The day the first result artifact of the runs expires, none when they hold no result artifact.
  expiresOn: string | undefined;
  carried: LedgerEntry[];
};

// The inputs that make a dispatch with `from_runs` collect the results of `runs` again as they were
// collected. Without a plan nothing else of a sweep plays a part once no agent runs.
export type Collect = { ref: string; version: string; runs: string[] } & (
  | { plan: { file: string; hash: string }; batch: number; engines: string }
  | { plan?: undefined; groups: string | undefined }
);

export type CollectInput = {
  // The branch of this workflow run, the only branch besides the default one whose runs a collect
  // takes results from.
  ref: string;
  version: string;
  fromRuns: string | undefined;
  runId: string | undefined;
  groups: string | undefined;
  plan: { scope: { file: string; hash: string; batch: number }; planned: PlannedJob[] } | undefined;
};

// A run started with `from_runs` holds no result artifact of its own.
export const collectOf = ({
  ref,
  version,
  fromRuns,
  runId,
  groups,
  plan,
}: CollectInput): Collect => {
  const runs = (fromRuns ? fromRuns.split(',') : runId ? [runId] : []).toSorted(
    (a, b) => Number(a) - Number(b)
  );
  return plan
    ? {
        ref,
        version,
        runs,
        plan: { file: plan.scope.file, hash: plan.scope.hash },
        batch: plan.scope.batch,
        engines: enginesOf(plan.planned),
      }
    : { ref, version, runs, groups };
};

const shellQuoted = (text: string) => `'${text.replaceAll("'", `'\\''`)}'`;

const fileCommand = (collect: Collect): string =>
  [
    'gh workflow run ecosystem-qa.yml',
    `--ref ${collect.ref}`,
    ...(collect.plan
      ? [
          `-f plan=${collect.plan.file}`,
          `-f batch=${collect.batch}`,
          `-f plan_hash=${collect.plan.hash}`,
          `-f version=${collect.version}`,
          `-f engines=${collect.engines}`,
        ]
      : [
          `-f version=${collect.version}`,
          ...(collect.groups ? [`-f groups=${shellQuoted(collect.groups)}`] : []),
        ]),
    `-f from_runs=${collect.runs.join(',')}`,
    '-f dry=false',
  ].join(' ');

// A reason in a pasted groups.json may hold a backtick, which would end a one-backtick span.
const codeSpan = (text: string) => {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(longest + 1);
  return longest > 0 ? `${fence} ${text} ${fence}` : `${fence}${text}${fence}`;
};

export const dryFiling = (collect: Collect, expiresOn: string | undefined): string => {
  if (collect.runs.length === 0) {
    return 'Dry run of local results, so nothing was filed, and no workflow run holds them to file.';
  }
  return expiresOn
    ? `Dry run, so nothing was filed. To file this ${collect.plan ? 'batch' : 'sweep'}, run ${codeSpan(fileCommand(collect))} before its artifacts expire on ${expiresOn}.`
    : `Dry run, so nothing was filed, and workflow run ${collect.runs.join(', ')} holds no result artifact to file.`;
};

const filingOf = (report: BatchReport, expiresOn: string | undefined) => {
  const expiry = expiresOn ? ` The artifacts of this batch expire on ${expiresOn}.` : '';
  const unfiled =
    report.findings?.filter(({ kind, issue }) => kind === 'issue' && issue === undefined).length ??
    0;
  switch (report.filing) {
    case 'dry':
      return dryFiling(report, expiresOn);
    case 'pending':
      return report.findings === null
        ? `The findings were not collected, so this run files nothing.${expiry}`
        : `The file job of this run files the batch next and then names each issue here.${expiry}`;
    case 'filed':
    case 'failed':
      if (report.findings === null) {
        return `The findings were not collected, so nothing was filed.${expiry}`;
      }
      if (report.filing === 'failed') {
        return `The filing did not finish, and the log of the file job says what was not filed.${expiry}`;
      }
      return unfiled > 0
        ? `${unfiled === 1 ? '1 new issue was' : `${unfiled} new issues were`} not filed, and the log of the file job says why.${expiry}`
        : `Filed.${expiry}`;
  }
};

// The arguments of `gh`, without the repository, that start a batch of the plan of this report on
// its branch and with its hash, engines and budget.
export const batchDispatch = (report: BatchReport, batch: number): string[] => [
  ...['workflow', 'run', 'ecosystem-qa.yml', '--ref', report.ref],
  ...['-f', `plan=${report.plan.file}`, '-f', `batch=${batch}`],
  ...['-f', `plan_hash=${report.plan.hash}`, '-f', 'chain=true'],
  ...['-f', `version=${report.version}`, '-f', `engines=${report.engines}`],
  ...(report.budgetMinutes ? ['-f', `budget_minutes=${report.budgetMinutes}`] : []),
];

export const renderBatchComment = (
  report: BatchReport,
  { spend, cost, short, capUsd, next, expiresOn, carried }: CommentContext
): string => {
  const lost = report.lines.filter((line) => line.outcome === 'no result').length;
  // The total carries the runs of a comment that is gone, so a later write cannot forget them.
  const gone =
    spend.held.runs < spend.written.runs
      ? {
          usd: Math.max(0, spend.written.usd - spend.held.usd),
          runs: spend.written.runs - spend.held.runs,
        }
      : { usd: 0, runs: 0 };
  return [
    batchMarker(report),
    ...[...report.lines, ...carried].map(
      ({ key, usd }) => `<!-- sb-qa-run ${key} usd=${usd.toFixed(6)} -->`
    ),
    `<!-- sb-qa-total usd=${(spend.usd + gone.usd).toFixed(6)} runs=${spend.runs + gone.runs} -->`,
    `### Batch ${report.batch} of ${report.batches} on Storybook ${report.version}`,
    '',
    `${runCount(report.planned)} planned, ${report.lines.length - lost} finished, ${lost} without a result, ${report.runs.length > 0 ? `from workflow run ${report.runs.join(', ')}` : 'from local results'}.`,
    '',
    '| Run | Outcome | Dollars |',
    '| --- | --- | --- |',
    ...report.lines.map(
      ({ job, outcome, usd, flat }) =>
        `| \`${job.repo}\` part ${job.part}, ${job.os}, ${job.engine} | ${outcome} | ${usd.toFixed(2)}${flat ? ' (flat)' : ''} |`
    ),
    '',
    `A run without a result or without a price counts as the flat ${dollars(USD_PER_RUN)} of a run.`,
    ...(carried.length > 0
      ? [
          `The spend also counts ${runCount(carried.length)} of an earlier report of this batch that its results no longer hold, such as the first attempt of a job that ran again.`,
        ]
      : []),
    '',
    `Checks: ${report.checks.length > 0 ? report.checks.map(({ state, count }) => `${count} ${state}`).join(', ') : 'none'}.`,
    '',
    ...(report.findings === null
      ? ['The findings were not collected, so this comment lists none.']
      : report.findings.length > 0
        ? [
            'Findings:',
            '',
            ...report.findings.map((finding) => findingLine(report.filing, finding)),
          ]
        : ['No findings.']),
    '',
    `Batch ${report.batch} cost ${spendOf(cost.batch)}${cost.batch.reports > 1 ? ` in ${cost.batch.reports} reports` : ''}.`,
    `The plan cost ${short ? 'at least ' : ''}${spendOf(cost.plan)} up to batch ${report.batch}, of a cap of ${dollars(capUsd)}.`,
    '',
    `Next: ${('start' in next ? `Batch ${next.start} is started.` : next.stop).replace(/\s+/g, ' ')}`,
    ...('resume' in next && next.resume !== undefined
      ? [
          '',
          `To start batch ${next.resume} by hand once the reason is gone, run \`gh ${batchDispatch(report, next.resume).join(' ')}\`.`,
        ]
      : []),
    '',
    filingOf(report, expiresOn),
    '',
  ].join('\n');
};

export type TrackInput<Comment extends Written> = {
  report: BatchReport;
  // Every comment of the tracking discussion of the plan, none when it has no discussion yet.
  comments: Comment[];
  // The address of each discussion of the plan.
  discussions: string[];
  capUsd: number;
  chain: boolean;
  expiresOn: string | undefined;
};

export type Tracked<Comment extends Written> =
  | { refuse: string }
  | {
      existing: Comment | undefined;
      next: NextStep;
      body: string;
      stopped: (stop: string) => string;
    };

export const trackBatch = <Comment extends Written>({
  report,
  comments,
  discussions,
  capUsd,
  chain,
  expiresOn,
}: TrackInput<Comment>): Tracked<Comment> => {
  const existing = batchCommentOf(comments, report);
  if (existing && editedByOther(existing)) {
    return {
      refuse: `Batch ${report.batch} is not reported again, because someone other than the workflow edited ${existing.url}, and writing over it would hide that edit. Every later batch of this plan stops at that comment.`,
    };
  }
  const step = {
    report,
    spend: spentUsd(comments, report.plan.hash, report),
    capUsd,
    chain,
    reported: existing,
    discussions,
  };
  const next = nextStep(step);
  const context = {
    spend: step.spend,
    cost: costOf(comments, report),
    short:
      shortfall(step) !== undefined ||
      costScope(comments, report).some((comment) => SHORT_SPEND.test(comment.body)),
    capUsd,
    expiresOn,
    carried: carriedRuns(existing, report),
  };
  return {
    existing,
    next,
    body: renderBatchComment(report, { ...context, next }),
    stopped: (stop) =>
      renderBatchComment(report, { ...context, next: { stop, resume: report.batch + 1 } }),
  };
};

// The body to write once the next batch was dispatched, or once its dispatch failed, so that no
// comment says that a batch is started before it is.
export const startNext = <Comment extends Written>(
  tracked: Exclude<Tracked<Comment>, { refuse: string }>,
  dispatch: (batch: number) => void
): { body: string; failure?: string } => {
  if (!('start' in tracked.next)) {
    return { body: tracked.body };
  }
  try {
    dispatch(tracked.next.start);
    return { body: tracked.body };
  } catch (error) {
    const failure = `Batch ${tracked.next.start} was not started, because its dispatch failed: ${error instanceof Error ? error.message : String(error)}`;
    return { body: tracked.stopped(failure), failure };
  }
};
