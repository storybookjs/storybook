import { byHarness, type Actor } from './github.ts';
import { PLANS_BRANCH } from './plan-push.ts';
import { USD_PER_RUN } from './qa-plan.ts';
import { CheckResult, type Proposal, type RunResultFile } from './schema.ts';

export const TRACKING_CATEGORY = 'QA sweeps';

export const DEFAULT_CAP_USD = 250;

export type Written = { id: string; url: string; body: string; author: Actor; editor: Actor };

// A body written in the browser comes back with CRLF line ends.
const firstLine = (body: string) => body.split(/\r?\n/, 1)[0] ?? '';

const PLAN_MARKER = /^<!-- sb-qa-plan ([0-9a-f]{12}) \S+ -->$/;
const BATCH_MARKER = /^<!-- sb-qa-batch ([0-9a-f]{12}) batch=\d+ version=\S+ runs=[\d,]* -->$/;
const RUN_LEDGER = /^<!-- sb-qa-run (\S+) usd=(\d+(?:\.\d+)?) -->$/;

export type TrackedPlan = { file: string; hash: string; line: string; version: string };

export const renderTrackingThread = ({
  file,
  hash,
  line,
  version,
}: TrackedPlan): { title: string; body: string } => ({
  title: `[SB ${line.split('.')[0]} QA] Dynamic sweep ${file}`,
  body: [
    `<!-- sb-qa-plan ${hash} ${file} -->`,
    `The logbook of one QA sweep: the plan \`${file}\` with the hash \`${hash}\`, first run on Storybook ${version}.`,
    '',
    'The workflow adds one comment for each batch it runs, with the runs, their dollars, their checks, and their findings, and edits that comment when it collects the batch again.',
    'The spend of the sweep is the sum of those comments, and a comment by anyone else, or one that someone else edited, is not part of it.',
    '',
  ].join('\n'),
});

export const trackingThreadOf = <Thread extends Written & { number: number }>(
  discussions: Thread[],
  hash: string
): Thread | undefined =>
  discussions
    .filter(
      (discussion) =>
        byHarness(discussion.author) && PLAN_MARKER.exec(firstLine(discussion.body))?.[1] === hash
    )
    .toSorted((a, b) => a.number - b.number)[0];

type CheckState = RunResultFile['checks'][number]['state'];

export type ReportedResult = {
  request: { entry: { id: string }; os: string; engine: string; plan?: { part: number } };
  timing: { startedAt: string };
  usage: { usd: number | null };
  status: RunResultFile['status'];
  checks: { state: CheckState }[];
};

export type ReportedFinding = { kind: Proposal['kind']; title: string; issue?: number };

export type Filing = 'dry' | 'pending' | 'filed';

export type PlannedJob = { repo: string; part: number; os: string; engine: string };

export type BatchInput = {
  plan: { file: string; hash: string };
  // The branch the batch ran on, which every later dispatch of the plan runs on too.
  ref: string;
  batch: number;
  batches: number;
  version: string;
  runs: string[];
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

export const batchReport = ({ planned, results, ...input }: BatchInput): BatchReport => {
  const finished = new Set(results.map((result) => jobKey(jobOf(result))));
  const lost = planned
    .filter((job) => !finished.has(jobKey(job)))
    .map((job): RunLine => ({
      key: `${jobKey(job)}/lost-${input.runs.join('+')}`,
      job,
      outcome: 'no result',
      usd: USD_PER_RUN,
      flat: true,
    }));
  const states = results.flatMap((result) => result.checks.map((check) => check.state));
  return {
    ...input,
    planned: planned.length,
    engines: [...new Set(planned.map(({ engine }) => engine))].toSorted().join(','),
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

export type Spend = { usd: number; runs: number; editedComments: string[] };

const editedByOther = (comment: Written) => comment.editor !== null && !byHarness(comment.editor);

type LedgerEntry = { key: string; usd: number };

const ledgerOf = (body: string): LedgerEntry[] =>
  body.split(/\r?\n/).flatMap((line) => {
    const match = RUN_LEDGER.exec(line);
    return match ? [{ key: match[1]!, usd: Number(match[2]) }] : [];
  });

export const carriedRuns = (existing: Written | undefined, report: BatchReport): LedgerEntry[] => {
  const reported = new Set(report.lines.map(({ key }) => key));
  return existing && !editedByOther(existing)
    ? ledgerOf(existing.body).filter(({ key }) => !reported.has(key))
    : [];
};

export const spentUsd = (comments: Written[], hash: string, current?: BatchReport): Spend => {
  const counted = comments.filter(
    (comment) =>
      byHarness(comment.author) && BATCH_MARKER.exec(firstLine(comment.body))?.[1] === hash
  );
  const ledger = new Map<string, number>();
  const entries = [
    ...counted.filter((comment) => !editedByOther(comment)).flatMap(({ body }) => ledgerOf(body)),
    ...(current?.lines ?? []),
  ];
  for (const { key, usd } of entries) {
    ledger.set(key, Math.max(usd, ledger.get(key) ?? 0));
  }
  return {
    usd: [...ledger.values()].reduce((sum, usd) => sum + usd, 0),
    runs: ledger.size,
    editedComments: counted.filter(editedByOther).map((comment) => comment.url),
  };
};

export type NextStep = { start: number } | { stop: string };

export type StepInput = {
  report: BatchReport;
  spend: Spend;
  capUsd: number;
  chain: boolean;
  reportedBefore: boolean;
  // False after an edit took the marker out of the discussion, which hides the earlier spend.
  tracked: boolean;
};

const dollars = (usd: number) => `$${usd.toFixed(2)}`;

const runCount = (count: number) => (count === 1 ? '1 run' : `${count} runs`);

export const nextStep = ({
  report,
  spend,
  capUsd,
  chain,
  reportedBefore,
  tracked,
}: StepInput): NextStep => {
  const next = report.batch + 1;
  const notStarted = `Batch ${next} was not started`;
  if (report.batch >= report.batches) {
    return { stop: `Batch ${report.batch} is the last batch of the plan.` };
  }
  if (reportedBefore) {
    return {
      stop: `Batch ${next} is not started from this report, because batch ${report.batch} was reported before and its first report decided that.`,
    };
  }
  if (!chain) {
    return { stop: `${notStarted}, because this run does not chain.` };
  }
  if (!tracked && report.batch > 1) {
    return {
      stop: `${notStarted}, because the plan had no tracking discussion before batch ${report.batch}, so the spend of its earlier batches is unknown.`,
    };
  }
  if (spend.editedComments.length > 0) {
    return {
      stop: `${notStarted}, because someone other than the workflow edited ${spend.editedComments.join(', ')}, so its dollars are not counted.`,
    };
  }
  if (report.lines.every((line) => line.outcome === 'no result')) {
    return { stop: `${notStarted}, because batch ${report.batch} left no result.` };
  }
  if (spend.usd >= capUsd) {
    return {
      stop: `${notStarted}, because ${dollars(spend.usd)} is spent and the cap is ${dollars(capUsd)}.`,
    };
  }
  return { start: next };
};

// A title in a body is inline markdown: a newline would start a block, a `<` HTML, and an `@` a
// mention, which notifies whoever it names.
const inline = (text: string) =>
  text.replace(/\s+/g, ' ').replaceAll('<', '&lt;').replaceAll('@', '@\u200B');

const findingLine = (filing: Filing, { kind, title, issue }: ReportedFinding) => {
  const unfiled = filing === 'filed' ? 'not filed' : 'new issue';
  const where = {
    issue: issue === undefined ? unfiled : `filed as #${issue}`,
    comment: `comment on #${issue}`,
    suppressed: `known as #${issue}`,
    skipped: 'skipped',
  }[kind];
  return `- ${where}: ${inline(title)}`;
};

export type ListedArtifact = { name: string; expires_at: string };

export const resultsExpireOn = (artifacts: ListedArtifact[]): string | undefined =>
  artifacts
    .filter(({ name }) => name.startsWith('qa-result-'))
    .map(({ expires_at }) => new Date(expires_at).toISOString().slice(0, 10))
    .toSorted()[0];

export type CommentContext = {
  spend: Spend;
  capUsd: number;
  next: NextStep;
  expiresOn: string;
  carried: LedgerEntry[];
};

export const renderBatchComment = (
  report: BatchReport,
  { spend, capUsd, next, expiresOn, carried }: CommentContext
): string => {
  const lost = report.lines.filter((line) => line.outcome === 'no result').length;
  const fileCommand = [
    'gh workflow run ecosystem-qa.yml',
    `--ref ${PLANS_BRANCH}`,
    `-f plan=${report.plan.file}`,
    `-f batch=${report.batch}`,
    `-f plan_hash=${report.plan.hash}`,
    `-f version=${report.version}`,
    `-f from_runs=${report.runs.join(',')}`,
    '-f dry=false',
  ].join(' ');
  return [
    batchMarker(report),
    ...[...report.lines, ...carried].map(
      ({ key, usd }) => `<!-- sb-qa-run ${key} usd=${usd.toFixed(6)} -->`
    ),
    `### Batch ${report.batch} of ${report.batches} on Storybook ${report.version}`,
    '',
    `${report.planned} runs planned, ${report.lines.length - lost} finished, ${lost} without a result, ${report.runs.length > 0 ? `from workflow run ${report.runs.join(', ')}` : 'from local results'}.`,
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
    `Spent on this plan: ${dollars(spend.usd)} for ${runCount(spend.runs)}, of a cap of ${dollars(capUsd)}. ${'start' in next ? `Batch ${next.start} is started next.` : next.stop}`,
    '',
    {
      dry:
        report.runs.length > 0
          ? `Dry run, so nothing was filed. To file this batch, run \`${fileCommand}\` before its artifacts expire on ${expiresOn}.`
          : 'Dry run of local results, so nothing was filed, and no workflow run holds them to file.',
      pending: `The file job of this run files the batch next and then names each issue here. The artifacts of this batch expire on ${expiresOn}.`,
      filed: `Filed. The artifacts of this batch expire on ${expiresOn}.`,
    }[report.filing],
    '',
  ].join('\n');
};

export type TrackInput<Comment extends Written> = {
  report: BatchReport;
  // Every comment of the tracking discussion of the plan, none when it has no discussion yet.
  comments: Comment[];
  tracked: boolean;
  capUsd: number;
  chain: boolean;
  expiresOn: string;
};

export type Tracked<Comment extends Written> = {
  existing: Comment | undefined;
  next: NextStep;
  body: string;
  stopped: (stop: string) => string;
};

export const trackBatch = <Comment extends Written>({
  report,
  comments,
  tracked,
  capUsd,
  chain,
  expiresOn,
}: TrackInput<Comment>): Tracked<Comment> => {
  const existing = batchCommentOf(comments, report);
  const spend = spentUsd(comments, report.plan.hash, report);
  const next = nextStep({
    report,
    spend,
    capUsd,
    chain,
    reportedBefore: existing !== undefined,
    tracked,
  });
  const context = { spend, capUsd, expiresOn, carried: carriedRuns(existing, report) };
  return {
    existing,
    next,
    body: renderBatchComment(report, { ...context, next }),
    stopped: (stop) => renderBatchComment(report, { ...context, next: { stop } }),
  };
};

export const batchDispatch = (
  report: BatchReport,
  { repo, batch, budgetMinutes }: { repo: string; batch: number; budgetMinutes?: string }
): string[] => [
  'workflow',
  'run',
  'ecosystem-qa.yml',
  '--repo',
  repo,
  '--ref',
  report.ref,
  '-f',
  `plan=${report.plan.file}`,
  '-f',
  `batch=${batch}`,
  '-f',
  `plan_hash=${report.plan.hash}`,
  '-f',
  'chain=true',
  '-f',
  `version=${report.version}`,
  '-f',
  `engines=${report.engines}`,
  ...(budgetMinutes ? ['-f', `budget_minutes=${budgetMinutes}`] : []),
];
