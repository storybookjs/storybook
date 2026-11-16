import { byHarness, type Actor } from './github.ts';
import { USD_PER_RUN } from './qa-plan.ts';
import { CheckResult, type Proposal, type RunResultFile } from './schema.ts';

export const TRACKING_CATEGORY = 'QA sweeps';

export const DEFAULT_CAP_USD = 250;

export type Written = { id: string; url: string; body: string; author: Actor; editor: Actor };

// A body written in the browser comes back with CRLF line ends.
const firstLine = (body: string) => body.split(/\r?\n/, 1)[0] ?? '';

const PLAN_MARKER = /^<!-- sb-qa-plan ([0-9a-f]{12}) \S+ -->$/;
const BATCH_MARKER = /^<!-- sb-qa-batch ([0-9a-f]{12}) batch=(\d+) version=\S+ runs=[\d,]* -->$/;
const NEXT_LINE = /^Next: (.+)$/;
const STARTED = /^Batch (\d+) is started\.$/;
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
    'The spend of the sweep is the sum of those comments. A comment by anyone else is not part of it, and a comment of the workflow that anyone else edits stops the sweep, because its dollars can no longer be read.',
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
  // The attempt of the workflow run in `runs` that reports its own batch, which "Re-run failed
  // jobs" raises while the run id stays.
  attempt: number;
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

// `batches` are the batches with a counted comment, `started` the batches that a counted comment
// started, and `unreadable` names each comment of the workflow whose dollars cannot be counted, and
// why.
export type Spend = {
  usd: number;
  runs: number;
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

// The sentence on what came after the batch, as the first report of the batch decided it.
const nextOf = (body: string): string | undefined =>
  body
    .split(/\r?\n/)
    .map((line) => NEXT_LINE.exec(line)?.[1])
    .find((next) => next !== undefined);

const unreadableOf = (comment: Written, hash: string): string | undefined => {
  if (editedByOther(comment)) {
    return `${comment.url}, which someone other than the workflow edited`;
  }
  if (BATCH_MARKER.exec(firstLine(comment.body))?.[1] !== hash) {
    return `${comment.url}, whose first line is not the hidden line of a batch of this plan`;
  }
  return undefined;
};

export const spentUsd = (comments: Written[], hash: string, current?: BatchReport): Spend => {
  const written = comments.filter((comment) => byHarness(comment.author));
  const counted = written.filter((comment) => unreadableOf(comment, hash) === undefined);
  const ledger = new Map<string, number>();
  const entries = [...counted.flatMap(({ body }) => ledgerOf(body)), ...(current?.lines ?? [])];
  for (const { key, usd } of entries) {
    ledger.set(key, Math.max(usd, ledger.get(key) ?? 0));
  }
  return {
    usd: [...ledger.values()].reduce((sum, usd) => sum + usd, 0),
    runs: ledger.size,
    batches: counted.map(({ body }) => Number(BATCH_MARKER.exec(firstLine(body))![2])),
    started: counted.flatMap(({ body }) => {
      const started = STARTED.exec(nextOf(body) ?? '')?.[1];
      return started ? [Number(started)] : [];
    }),
    unreadable: written.flatMap((comment) => unreadableOf(comment, hash) ?? []),
  };
};

// The batches before this one that the discussion holds no counted comment of, whose dollars are
// then unknown.
const missingBatches = ({ batch }: BatchReport, { batches }: Spend): number[] =>
  Array.from({ length: batch - 1 }, (_, index) => index + 1).filter(
    (earlier) => !batches.includes(earlier)
  );

const incomplete = (report: BatchReport, spend: Spend) =>
  spend.unreadable.length > 0 || missingBatches(report, spend).length > 0;

export type NextStep = { start: number } | { stop: string };

export type StepInput = {
  report: BatchReport;
  spend: Spend;
  capUsd: number;
  chain: boolean;
  // The comment of an earlier report of the same batch and runs.
  reported: Written | undefined;
};

const dollars = (usd: number) => `$${usd.toFixed(2)}`;

const runCount = (count: number) => (count === 1 ? '1 run' : `${count} runs`);

export const nextStep = ({ report, spend, capUsd, chain, reported }: StepInput): NextStep => {
  const next = report.batch + 1;
  const notStarted = `Batch ${next} was not started`;
  if (report.batch >= report.batches) {
    return { stop: `Batch ${report.batch} is the last batch of the plan.` };
  }
  if (reported) {
    return {
      stop:
        nextOf(reported.body) ??
        `Batch ${next} is not started from this report, because batch ${report.batch} was reported before.`,
    };
  }
  if (!chain) {
    return { stop: `${notStarted}, because this run does not chain.` };
  }
  if (spend.unreadable.length > 0) {
    return {
      stop: `${notStarted}, because the spend of this plan cannot be read from ${spend.unreadable.join(', nor from ')}.`,
    };
  }
  const missing = missingBatches(report, spend);
  if (missing.length > 0) {
    return {
      stop: `${notStarted}, because this discussion holds no report of ${missing.length === 1 ? 'batch' : 'batches'} ${missing.slice(0, -1).join(', ')}${missing.length > 1 ? ' and ' : ''}${missing.at(-1)}, so the spend of the plan is unknown.`,
    };
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
  // The day the first result artifact of the runs expires, none when they hold no result artifact.
  expiresOn: string | undefined;
  carried: LedgerEntry[];
};

const filingOf = (report: BatchReport, expiresOn: string | undefined, fileCommand: string) => {
  const expiry = expiresOn ? ` The artifacts of this batch expire on ${expiresOn}.` : '';
  const unfiled =
    report.findings?.filter(({ kind, issue }) => kind === 'issue' && issue === undefined).length ??
    0;
  switch (report.filing) {
    case 'dry':
      if (report.runs.length === 0) {
        return 'Dry run of local results, so nothing was filed, and no workflow run holds them to file.';
      }
      return expiresOn
        ? `Dry run, so nothing was filed. To file this batch, run \`${fileCommand}\` before its artifacts expire on ${expiresOn}.`
        : `Dry run, so nothing was filed, and workflow run ${report.runs.join(', ')} holds no result artifact to file.`;
    case 'pending':
      return report.findings === null
        ? `The findings were not collected, so this run files nothing.${expiry}`
        : `The file job of this run files the batch next and then names each issue here.${expiry}`;
    case 'filed':
      if (report.findings === null) {
        return `The findings were not collected, so nothing was filed.${expiry}`;
      }
      return unfiled > 0
        ? `${unfiled === 1 ? '1 new issue was' : `${unfiled} new issues were`} not filed, and the log of the file job says why.${expiry}`
        : `Filed.${expiry}`;
  }
};

export const renderBatchComment = (
  report: BatchReport,
  { spend, capUsd, next, expiresOn, carried }: CommentContext
): string => {
  const lost = report.lines.filter((line) => line.outcome === 'no result').length;
  const fileCommand = [
    'gh workflow run ecosystem-qa.yml',
    `--ref ${report.ref}`,
    `-f plan=${report.plan.file}`,
    `-f batch=${report.batch}`,
    `-f plan_hash=${report.plan.hash}`,
    `-f version=${report.version}`,
    `-f engines=${report.engines}`,
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
    `Spent on this plan: ${incomplete(report, spend) ? 'at least ' : ''}${dollars(spend.usd)} for ${runCount(spend.runs)}, of a cap of ${dollars(capUsd)}.`,
    '',
    `Next: ${('start' in next ? `Batch ${next.start} is started.` : next.stop).replace(/\s+/g, ' ')}`,
    '',
    filingOf(report, expiresOn, fileCommand),
    '',
  ].join('\n');
};

export type TrackInput<Comment extends Written> = {
  report: BatchReport;
  // Every comment of the tracking discussion of the plan, none when it has no discussion yet.
  comments: Comment[];
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
  const spend = spentUsd(comments, report.plan.hash, report);
  const next = nextStep({
    report,
    spend,
    capUsd,
    chain,
    reported: existing,
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
