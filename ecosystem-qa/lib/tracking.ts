import { byHarness, type Actor } from './github.ts';
import { PLANS_BRANCH } from './plan-push.ts';
import { USD_PER_RUN } from './qa-plan.ts';
import { CheckResult, type Proposal, type RunResultFile } from './schema.ts';

export const TRACKING_CATEGORY = 'QA sweeps';

export const DEFAULT_CAP_USD = 250;

// A discussion or a comment as the GraphQL listing returns it.
export type Written = { url: string; body: string; author: Actor; editor: Actor };

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

// The discussion of a plan is the oldest one the workflow wrote for its hash.
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

// The fields of a run record that a batch comment reports.
export type ReportedResult = {
  request: { entry: { id: string }; os: string; engine: string; plan?: { part: number } };
  timing: { startedAt: string };
  usage: { usd: number | null };
  status: RunResultFile['status'];
  checks: { state: CheckState }[];
};

// What the comment says of one proposal. `issue` is the issue it was filed as or commented on.
export type ReportedFinding = { kind: Proposal['kind']; title: string; issue?: number };

export type PlannedJob = { repo: string; part: number; os: string; engine: string };

export type BatchInput = {
  plan: { file: string; hash: string };
  batch: number;
  batches: number;
  version: string;
  // The workflow runs whose artifacts hold the results.
  runs: string[];
  dry: boolean;
  planned: PlannedJob[];
  results: ReportedResult[];
  findings: ReportedFinding[];
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

// The spend counts each run once by this key. A run is its job with the moment its runner started,
// so collecting the same artifact again gives the same key and running the batch again a new one. A
// run that left no result has no start, so the workflow runs that should hold it stand in for it.
const resultLine = (result: ReportedResult): RunLine => {
  const job = jobOf(result);
  const started = Date.parse(result.timing.startedAt);
  return {
    // Parsed, so no text of the record can reach the ledger line.
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
    lines: [...results.map(resultLine), ...lost],
    checks: CheckResult.shape.state.options
      .map((state) => ({ state, count: states.filter((seen) => seen === state).length }))
      .filter(({ count }) => count > 0),
  };
};

export const batchMarker = ({ plan, batch, version, runs }: BatchReport): string =>
  `<!-- sb-qa-batch ${plan.hash} batch=${batch} version=${version} runs=${runs.join(',')} -->`;

// The comment the workflow writes for this report, if it wrote one: the one to edit.
export const batchCommentOf = <Comment extends Written>(
  comments: Comment[],
  report: BatchReport
): Comment | undefined =>
  comments.find(
    (comment) => byHarness(comment.author) && firstLine(comment.body) === batchMarker(report)
  );

export type Spend = { usd: number; runs: number; editedComments: string[] };

const editedByOther = (comment: Written) => comment.editor !== null && !byHarness(comment.editor);

// Sum the dollars of every run of a plan once, from the hidden ledger lines of the batch comments
// the workflow wrote, and from `current` in place of its own comment.
//
// The visible table is never read, so editing it changes no sum, and a comment that anyone but the
// workflow edited is left out of the sum and named instead.
export const spentUsd = (comments: Written[], hash: string, current?: BatchReport): Spend => {
  const replaced = current && batchMarker(current);
  const counted = comments.filter((comment) => {
    const marker = firstLine(comment.body);
    return (
      byHarness(comment.author) && BATCH_MARKER.exec(marker)?.[1] === hash && marker !== replaced
    );
  });
  const trusted = counted.filter((comment) => !editedByOther(comment));
  const ledger = new Map<string, number>();
  const book = (key: string, usd: number) => ledger.set(key, Math.max(usd, ledger.get(key) ?? 0));
  for (const comment of trusted) {
    for (const line of comment.body.split(/\r?\n/)) {
      const match = RUN_LEDGER.exec(line);
      if (match) {
        book(match[1]!, Number(match[2]));
      }
    }
  }
  for (const line of current?.lines ?? []) {
    book(line.key, line.usd);
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
};

const dollars = (usd: number) => `$${usd.toFixed(2)}`;

// Start the batch after this one, or say why not. A cycle only ever moves forward.
export const nextStep = ({ report, spend, capUsd, chain }: StepInput): NextStep => {
  const next = report.batch + 1;
  const notStarted = `Batch ${next} was not started`;
  if (report.batch >= report.batches) {
    return { stop: `Batch ${report.batch} is the last batch of the plan.` };
  }
  if (!chain) {
    return { stop: `${notStarted}, because this run does not chain.` };
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

// A title in a body is inline markdown: a newline would start a block and a lone `<` an HTML
// comment, which could pose as a ledger line.
const inline = (text: string) => text.replace(/\s+/g, ' ').replaceAll('<', '&lt;');

const findingLine = ({ kind, title, issue }: ReportedFinding) => {
  const where = {
    issue: issue === undefined ? 'new issue' : `filed as #${issue}`,
    comment: `comment on #${issue}`,
    suppressed: `known as #${issue}`,
    skipped: 'skipped',
  }[kind];
  return `- ${where}: ${inline(title)}`;
};

export type CommentContext = { spend: Spend; capUsd: number; next: NextStep; expiresOn: string };

export const renderBatchComment = (
  report: BatchReport,
  { spend, capUsd, next, expiresOn }: CommentContext
): string => {
  const lost = report.lines.filter((line) => line.outcome === 'no result').length;
  const fileCommand = [
    'gh workflow run ecosystem-qa.yml',
    `--ref ${PLANS_BRANCH}`,
    `-f plan=${report.plan.file}`,
    `-f batch=${report.batch}`,
    `-f version=${report.version}`,
    `-f from_runs=${report.runs.join(',')}`,
    '-f dry=false',
  ].join(' ');
  return [
    batchMarker(report),
    ...report.lines.map((line) => `<!-- sb-qa-run ${line.key} usd=${line.usd.toFixed(6)} -->`),
    `### Batch ${report.batch} of ${report.batches} on Storybook ${report.version}`,
    '',
    `${report.planned} runs planned, ${report.lines.length - lost} finished, ${lost} without a result, from workflow run ${report.runs.join(', ')}.`,
    '',
    '| Run | Outcome | Dollars |',
    '| --- | --- | --- |',
    ...report.lines.map(
      ({ job, outcome, usd, flat }) =>
        `| \`${job.repo}\` part ${job.part}, ${job.os}, ${job.engine} | ${outcome} | ${usd.toFixed(2)}${flat ? ' (flat)' : ''} |`
    ),
    '',
    `A run without a result or without a price counts as the flat ${dollars(USD_PER_RUN)} of a run.`,
    '',
    `Checks: ${report.checks.length > 0 ? report.checks.map(({ state, count }) => `${count} ${state}`).join(', ') : 'none'}.`,
    '',
    ...(report.findings.length > 0
      ? ['Findings:', '', ...report.findings.map(findingLine)]
      : ['No findings.']),
    '',
    `Spent on this plan: ${dollars(spend.usd)} for ${spend.runs} runs, of a cap of ${dollars(capUsd)}. ${'start' in next ? `Batch ${next.start} is started next.` : next.stop}`,
    '',
    report.dry
      ? `Dry run, so nothing was filed. To file this batch, run \`${fileCommand}\` before its artifacts expire on ${expiresOn}.`
      : `Filed. The artifacts of this batch expire on ${expiresOn}.`,
    '',
  ].join('\n');
};
