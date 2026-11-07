// Reports what an NX Cloud CI pipeline execution (CIPE) did, or follows one live, without a browser.
//
// It reads the NX Cloud Public API through `nx-cloud api` with your own `npx nx login`, so it needs
// no token in code or chat. A one-off report covers the pipeline status, why it was canceled, the
// failed tasks with the end of their logs, and worker steps that failed or timed out (such as the
// node_modules cache setup) with the reason NX Cloud recorded.
//
// `--watch` prints one line per change and exits with the full report once the pipeline is done, so
// an agent can run it as a background monitor and is woken by each line.
//
// Usage:
//   node scripts/ci/nx-cloud-status.ts [target] [--watch] [--sha <commit>] [--interval <seconds>]
//
// `target` is a pull request number (`37181`, `#37181` or its GitHub link), a branch, a CIPE id, a
// cloud.nx.app/cipes link, or an NX Cloud overview link with a `branch` parameter. NX
// Cloud lists a pull request's pipelines under its number and under its branch, so both find them.
// Without a target it follows the current branch at the local HEAD commit.
//
// To follow one GitHub Actions run, such as a `workflow_dispatch` run next to the pull request's own
// pipeline on the same branch, pass its run id (`41939428103`), its run group (`41939428103-1`, that
// is `<run id>-<attempt>`), or its GitHub link. A bare run id takes the latest attempt. NX Cloud
// records no nx command for a GitHub re-run (attempt 2 or later); for those, GitHub's conclusion
// (through `gh`) decides the exit code.
//
// `--sha` picks the pipeline of that commit. After a push, pass `--sha HEAD`: without it the watch
// follows the newest pipeline, which until NX Cloud registers the push is the previous one.
//
// Exit code: 0 when the pipeline succeeded, 1 when it failed, was canceled or timed out, 2 on errors
// (and when `--watch` saw no pipeline start for 15 minutes), 3 for a one-off report on a pipeline
// that is still running, 4 for a GitHub re-run whose result `gh` could not read.
import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs, promisify } from 'node:util';

import { esMain } from '../utils/esmain.ts';

const execFileAsync = promisify(execFile);

// Same version as the NX DTE jobs (circleci-dte.ts); its `api` command is the NX Cloud Public API client.
const NX_CLOUD_CLI = 'nx-cloud@19.1.5';
const ROOT = join(import.meta.dirname, '../..');
const NX_CLOUD_ID: string = JSON.parse(readFileSync(join(ROOT, 'nx.json'), 'utf8')).nxCloudId;
const TERMINAL = new Set(['SUCCEEDED', 'FAILED', 'CANCELED', 'TIMED_OUT']);
// At most this many failed tasks and failed worker steps get their log tail in a report.
const MAX_LOGS = 5;
const LOG_TAIL_LINES = 20;
const FAILURE_LINES = 8;
// Workers whose details are read per failed worker step, for the reason they stopped.
const INSTANCE_SAMPLES = 3;
// How long `--watch` waits after a pipeline ends for NX Cloud to finish its run groups' details.
const FINALIZE_TIMEOUT_MS = 10 * 60 * 1000;
// How long `--watch` waits for a pipeline to appear before it gives up.
const START_TIMEOUT_MS = 15 * 60 * 1000;
// How long `--watch` on a branch waits for a new pipeline when the newest one has already finished.
// A push or `workflow_dispatch` reaches NX Cloud only once its job starts, so right after one the
// newest pipeline is still the previous one, possibly on the same commit.
const FINISHED_GRACE_MS = 3 * 60 * 1000;
const EXIT = { succeeded: 0, failed: 1, error: 2, running: 3, unknown: 4 } as const;
const GITHUB_REPO = 'storybookjs/storybook';

type Links = Record<string, string>;
type Counts = Record<string, number>;

interface Cipe {
  id: string;
  status: string;
  createdAt: string;
  completedAt?: string | null;
  branch?: string | null;
  vcsContext?: {
    branch?: string;
    ref?: string | null;
    title?: string | null;
    headSha?: string | null;
  };
  cancellationRequest?: { source: string; actor: string; requestedAt: string } | null;
  links: Links;
}

interface RunGroup {
  id: string;
  status: string;
  branch?: string | null;
  completedBy?: string | null;
  criticalErrorMessage?: string | null;
  runs?: { total: number; statusCounts: Counts };
  workflow?: {
    status: string;
    steps: { statusCounts: Counts };
    workers: { total: number };
    instances: { restarted: number };
    estimatedTotalCredits?: number | null;
    links: Links;
  } | null;
  links: Links;
}

interface Run {
  id: string;
  status: string;
  command: string;
  tasks?: { total: number; statusCounts: Counts };
  links: Links;
}

interface Asset {
  type: string;
  url: string;
}

interface Task {
  id: string;
  workerName?: string | null;
  assets: Asset[];
}

interface Step {
  name: string;
  status: string;
  launchTemplate?: string | null;
  instances: { statusCounts: Counts };
  links: Links;
}

interface Instance {
  workerName?: string | null;
  status: string;
  assets: Asset[];
  timeoutInfo?: { reason: string; durationSeconds: number } | null;
  priorRuns?: { status: string }[];
  links: Links;
}

interface Worker {
  name: string;
  instances: { restarted: number };
}

interface List<T> {
  items: T[];
}

class ApiError extends Error {
  // Worth trying again later: rate limits, server errors, network errors, a pipeline not found yet.
  retryable: boolean;
  status?: number;

  constructor(message: string, retryable: boolean, status?: number) {
    super(message);
    this.retryable = retryable;
    this.status = status;
  }
}

let cliPath: string | undefined;

// Resolves the pinned `nx-cloud` CLI once: starting it through `npx` on every call costs seconds.
function nxCloudCli() {
  cliPath ??= realpathSync(
    execFileSync('npx', ['-y', '-p', NX_CLOUD_CLI, '-c', 'command -v nx-cloud'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim()
  );
  return cliPath;
}

// A workspace token in the environment wins over the user's login in `nx-cloud api`. A token for
// another workspace then fails with 401, so a 401 retries once with the login alone.
let useEnvToken = Boolean(process.env.NX_CLOUD_ACCESS_TOKEN || process.env.NX_CLOUD_AUTH_TOKEN);

interface ApiOptions {
  query?: Record<string, string | string[]>;
  pathParams?: Record<string, string>;
  // Save the response (an asset download) to this file; resolves to the file `nx-cloud` wrote.
  output?: string;
}

async function api<T>(path: string, options: ApiOptions = {}, attempt = 1): Promise<T> {
  const { query = {}, pathParams = {}, output } = options;
  const args = [nxCloudCli(), 'api', path, '--nxCloudId', NX_CLOUD_ID];
  for (const [key, value] of Object.entries(query)) {
    for (const v of [value].flat()) args.push('-f', `${key}=${v}`);
  }
  for (const [key, value] of Object.entries(pathParams)) args.push('-p', `${key}=${value}`);
  if (output) args.push('-o', output);

  const env = { ...process.env };
  if (!useEnvToken) {
    delete env.NX_CLOUD_ACCESS_TOKEN;
    delete env.NX_CLOUD_AUTH_TOKEN;
  }
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, args, {
      cwd: ROOT,
      env,
      maxBuffer: 64 * 1024 * 1024,
    });
    if (output) return (jsonLines(stderr).find((l) => l.output?.file)?.output?.file ?? output) as T;
    return JSON.parse(stdout) as T;
  } catch (e) {
    const stderr: string = (e as { stderr?: string }).stderr ?? String(e);
    const error = jsonLines(stderr).find((l) => l.error)?.error;
    const status: number | undefined = error?.status;
    if (status === 401 && useEnvToken) {
      useEnvToken = false;
      console.error(
        'nx-cloud-status: NX Cloud rejected the token in NX_CLOUD_ACCESS_TOKEN (it is for another workspace?); using your `nx login` instead'
      );
      return api(path, options, attempt);
    }
    if (status === 401) {
      throw new ApiError(
        'NX Cloud rejected the login. Run `npx nx login` and try again.',
        false,
        401
      );
    }
    // The CLI already retried rate limits and capacity errors a few times; back off longer.
    if ((status === 429 || status === 503) && attempt < 3) {
      await sleep(30 * attempt);
      return api(path, options, attempt + 1);
    }
    const body = typeof error?.body === 'object' ? error.body : undefined;
    const target = Object.entries(pathParams).reduce((p, [k, v]) => p.replace(`{${k}}`, v), path);
    throw new ApiError(
      error
        ? `${error.message}${body?.message ? `: ${body.message}` : ''} (${target})`
        : stderr.trim(),
      status === undefined || status === 409 || status === 429 || status >= 500,
      status
    );
  }
}

// A line of `nx-cloud api` stderr, or of an NDJSON worker log.
interface JsonLine {
  error?: { message: string; status?: number; body?: { message?: string } | string };
  output?: { file?: string };
  message?: string;
}

function jsonLines(text: string): JsonLine[] {
  return text.split('\n').flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
}

// A terminal entity returns its details; a running one returns 409, so undefined means "still running".
async function getIfTerminal<T>(path: string, pathParams: Record<string, string>) {
  try {
    return await api<T>(path, { pathParams });
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) return undefined;
    throw e;
  }
}

async function listCipes(branch: string, limit = 10): Promise<Cipe[]> {
  return (await api<List<Cipe>>('cipes', { query: { branch, limit: String(limit) } })).items;
}

const cipeBranches = new Map<string, string>();

// A terminal CIPE is served by id; a running one only appears in the list of its branch.
async function findCipe(id: string): Promise<Cipe> {
  let branch = cipeBranches.get(id);
  if (!branch) {
    const cipe = await getIfTerminal<Cipe>('cipes/{cipeId}', { cipeId: id });
    if (cipe) return cipe;
    const groups = await api<List<RunGroup>>('run-groups', { query: { cipeId: id } });
    branch = groups.items.find((g) => g.branch)?.branch ?? undefined;
    if (!branch) throw new ApiError(`CIPE ${id} is running, but has no branch yet.`, true);
    cipeBranches.set(id, branch);
  }
  const match = (await listCipes(branch, 50)).find((c) => c.id === id);
  if (match) return match;
  const cipe = await getIfTerminal<Cipe>('cipes/{cipeId}', { cipeId: id });
  if (cipe) return cipe;
  throw new ApiError(`CIPE ${id} is running, but is not in the list of ${branch}.`, true);
}

interface RunGroupState {
  group: RunGroup;
  // A pipeline and its run groups can be listed as done while the workers' workflow still runs.
  // Until that finishes NX Cloud serves no details (and often no runs) for the run group.
  final: boolean;
}

async function runGroupsOf(cipe: Cipe): Promise<RunGroupState[]> {
  const list = await api<List<RunGroup>>(cipe.links.runGroups);
  return Promise.all(
    list.items.map(async (g) => {
      const details = await getIfTerminal<RunGroup>('run-groups/{runGroupId}', {
        runGroupId: g.id,
      });
      return { group: details ?? g, final: Boolean(details) };
    })
  );
}

async function runsOf(group: RunGroup): Promise<Run[]> {
  const list = await api<List<Run>>(group.links.runs, { query: { limit: '100' } });
  return Promise.all(list.items.map((r) => api<Run>(r.links.self)));
}

let logDir: string | undefined;

// Lines that name a failure in the test runners and compilers this repo uses (Vitest and Jest `FAIL`,
// `×`/`✖` marks, TypeScript errors, npm/yarn errors). Expected errors that tests log are not matched.
const FAILURE_LINE = /^\s*(FAIL\b|×|✖)|\berror TS\d+|\bERR!/;

export function logLines(text: string) {
  return stripAnsi(text)
    .split('\n')
    .map((l) => l.trimEnd())
    .filter(Boolean);
}

// The lines that name the failure, then the last lines of the log.
export function summarizeLog(lines: string[]) {
  const tail = lines.slice(-LOG_TAIL_LINES);
  const failures = lines
    .slice(0, -LOG_TAIL_LINES)
    .filter((l) => FAILURE_LINE.test(l))
    .slice(-FAILURE_LINES);
  return [...failures, ...(failures.length ? ['…'] : []), ...tail];
}

// Downloads a logs asset to a readable text file (task logs come as a tarball, worker step logs as
// NDJSON) and returns its path with the lines that name the failure and the last lines.
async function readLog(asset: Asset | undefined, name: string): Promise<string[]> {
  if (!asset) return [];
  logDir ??= mkdtempSync(join(tmpdir(), 'nx-cloud-status-'));
  // No dots: `nx-cloud api` keeps an extension it is given and adds the right one (.tar.gz, .ndjson) otherwise.
  const base = join(logDir, name.replace(/[^\w-]+/g, '_'));
  try {
    const file = await api<string>(asset.url, { output: `${base}_raw` });
    let text: string;
    if (file.endsWith('.tar.gz')) {
      text = execFileSync('tar', ['-xzOf', file], {
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
      });
    } else if (file.endsWith('.ndjson')) {
      text = jsonLines(readFileSync(file, 'utf8'))
        .flatMap((l) => (l.message === undefined ? [] : [l.message]))
        .join('\n');
    } else {
      text = readFileSync(file, 'utf8');
    }
    const lines = logLines(text);
    writeFileSync(`${base}.log`, lines.join('\n') + '\n');
    rmSync(file, { force: true });
    return [`log: ${base}.log (${lines.length} lines)`, ...summarizeLog(lines)];
  } catch (e) {
    return [`(could not read the log: ${(e as Error).message})`];
  }
}

function stripAnsi(text: string) {
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

function duration(from: string, to?: string | null) {
  const seconds = Math.round(((to ? Date.parse(to) : Date.now()) - Date.parse(from)) / 1000);
  const m = Math.floor(seconds / 60);
  return m ? `${m}m ${seconds % 60}s` : `${seconds}s`;
}

function counts(statusCounts: Counts = {}) {
  return Object.entries(statusCounts)
    .map(([status, n]) => `${n} ${status.toLowerCase()}`)
    .join(', ');
}

function time() {
  return new Date().toTimeString().slice(0, 5);
}

function cipeTitle(cipe: Cipe) {
  const sha = cipe.vcsContext?.headSha?.slice(0, 7) ?? '?';
  const title = cipe.vcsContext?.title?.split('\n')[0];
  return `${cipe.id.slice(0, 8)} on ${cipe.branch ?? cipe.vcsContext?.branch} (${sha}${title ? ` "${title}"` : ''})`;
}

function cipeUrl(cipe: Cipe) {
  return `https://cloud.nx.app/cipes/${cipe.id}`;
}

// NX Cloud names a GitHub Actions run group `<run id>-<attempt>`.
const RUN_GROUP = /^(\d{8,})-([1-9]\d*)$/;

function githubRun(group: RunGroup) {
  const match = RUN_GROUP.exec(group.id);
  return match ? { runId: match[1], attempt: Number(match[2]) } : undefined;
}

// NX Cloud records no nx command for a GitHub re-run (attempt 2 or later): it answers the Nx
// client's request for the distributed execution summary with 404. The run group then ends by
// heartbeat with no runs, and the pipeline's status says nothing about the tasks.
function unrecordedRerun({ group, final }: RunGroupState) {
  return final && group.runs?.total === 0 && (githubRun(group)?.attempt ?? 1) >= 2;
}

const conclusions = new Map<string, string | undefined>();

// GitHub's conclusion of a run attempt (`success`, `failure`, …), or undefined without `gh`.
function githubConclusion(runId: string, attempt: number) {
  const key = `${runId}-${attempt}`;
  if (!conclusions.has(key)) {
    let conclusion: string | undefined;
    try {
      conclusion =
        gh([
          'api',
          `repos/${GITHUB_REPO}/actions/runs/${runId}/attempts/${attempt}`,
          '--jq',
          '.conclusion',
        ]) || undefined;
    } catch {
      conclusion = undefined;
    }
    conclusions.set(key, conclusion);
  }
  return conclusions.get(key);
}

function gh(args: string[]) {
  return execFileSync('gh', args, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }).trim();
}

function cancelReason(cipe: Cipe) {
  const c = cipe.cancellationRequest;
  if (!c) return undefined;
  const reasons: Record<string, string> = {
    NEW_CIPE_PUSHED: 'a newer pipeline started on the same branch',
  };
  return `${reasons[c.source] ?? c.source} (by ${c.actor})`;
}

function cipeLine(cipe: Cipe) {
  // NX Cloud sets a canceled pipeline's completedAt to about its start; the request time is the end.
  const end =
    cipe.status === 'CANCELED' && cipe.cancellationRequest
      ? cipe.cancellationRequest.requestedAt
      : cipe.completedAt;
  const state = TERMINAL.has(cipe.status)
    ? `${cipe.status} after ${duration(cipe.createdAt, end)}`
    : `${cipe.status}, running for ${duration(cipe.createdAt)}`;
  const reason = cancelReason(cipe);
  return `pipeline ${cipeTitle(cipe)}: ${state}${reason ? `, canceled because ${reason}` : ''}`;
}

function runLine(run: Run) {
  return `${run.status === 'SUCCEEDED' ? '✔' : '✖'} ${run.status} ${run.command} — ${run.tasks?.total ?? '?'} tasks: ${counts(
    run.tasks?.statusCounts
  )} (run ${run.id})`;
}

function indent(lines: string[], prefix: string) {
  return lines.map((l) => `${prefix}${l}`);
}

const FAILED_TASK = ['FAILED', 'TIMED_OUT'];

async function taskReport(run: Run): Promise<string[]> {
  if (!FAILED_TASK.some((s) => run.tasks?.statusCounts[s])) return [];
  const tasks = (
    await api<List<Task>>(run.links.tasks, { query: { statuses: FAILED_TASK, limit: '100' } })
  ).items;
  const out: string[] = [];
  for (const [i, task] of tasks.entries()) {
    out.push(`    ✖ ${task.id}${task.workerName ? ` on ${task.workerName}` : ''}`);
    if (i < MAX_LOGS) {
      const logs = task.assets.find((a) => a.type === 'logs');
      out.push(...indent(await readLog(logs, task.id), '        │ '));
    }
  }
  return out;
}

function instanceReason(detail: Instance) {
  if (detail.timeoutInfo) {
    return `${detail.timeoutInfo.reason} after ${detail.timeoutInfo.durationSeconds}s`;
  }
  if ((detail.priorRuns ?? []).some((p) => p.status === 'MACHINE_TERMINATED')) {
    return `${detail.status.toLowerCase()}, after an earlier boot was MACHINE_TERMINATED`;
  }
  return detail.status.toLowerCase();
}

async function workflowReport(group: RunGroup): Promise<string[]> {
  const wf = group.workflow;
  if (!wf) return [];
  // `instances.restarted` counts each step a restarted worker ran again, so one restart of a worker
  // with 11 steps counts 11. Count the workers instead.
  let restarts = '';
  if (wf.instances.restarted) {
    const workers = (await api<List<Worker>>(wf.links.workers, { query: { limit: '100' } })).items;
    const restarted = workers.filter((w) => w.instances.restarted > 0).length;
    restarts = `, ${restarted} of ${wf.workers.total} workers restarted`;
  }
  const out = [
    `  workers: ${wf.workers.total}, steps: ${counts(wf.steps.statusCounts)}${restarts}${
      wf.estimatedTotalCredits ? `, ~${wf.estimatedTotalCredits} credits` : ''
    }`,
  ];
  const bad = ['FAILED', 'TIMED_OUT', 'MACHINE_TERMINATED', 'CANCELED'];
  const steps = (await api<List<Step>>(wf.links.steps, { query: { statuses: bad, limit: '100' } }))
    .items;
  let logs = 0;
  for (const step of steps) {
    out.push(
      `  ✖ worker step "${step.name}"${step.launchTemplate ? ` (${step.launchTemplate})` : ''}: ${step.status}, workers: ${counts(
        step.instances.statusCounts
      )}`
    );
    // A canceled step needs no reason: the pipeline line says why it was canceled.
    if (step.status === 'CANCELED') continue;
    // The reason sits on the step's workers (instances), in each one's details. A few say enough.
    const instances = (
      await api<List<Instance>>(step.links.instances, {
        query: { statuses: bad.filter((s) => s !== 'CANCELED'), limit: '100' },
      })
    ).items;
    const samples = [
      ...instances.filter((i) => i.status === 'FAILED'),
      ...instances.filter((i) => i.status !== 'FAILED'),
    ].slice(0, INSTANCE_SAMPLES);
    const details = await Promise.all(samples.map((i) => api<Instance>(i.links.self)));
    const reasons = [...new Set(details.map(instanceReason))];
    if (reasons.length) {
      out.push(
        `      reason (${details.length} of ${instances.length} workers read): ${reasons.join('; ')}`
      );
    }
    // A failed worker says more than one that timed out.
    const first = samples[0];
    if (first && logs++ < MAX_LOGS) {
      const log = first.assets.find((a) => a.type === 'logs');
      out.push(`      worker ${first.workerName}:`);
      out.push(...indent(await readLog(log, `${step.name}-${first.workerName}`), '        │ '));
    }
  }
  return out;
}

async function report(cipe: Cipe, groups: RunGroupState[]): Promise<string[]> {
  const out = [cipeLine(cipe), `  ${cipeUrl(cipe)}`];
  for (const state of groups) {
    const { group, final } = state;
    const gh = githubRun(group);
    out.push(
      `  run group ${group.id}${gh ? ` (GitHub Actions run ${gh.runId}, attempt ${gh.attempt})` : ''}: ${group.status}${
        group.completedBy ? `, ended by ${group.completedBy}` : ''
      }`
    );
    if (group.criticalErrorMessage) out.push(`  ✖ critical error: ${group.criticalErrorMessage}`);
    for (const run of await runsOf(group)) {
      out.push(`  ${runLine(run)}`, ...(await taskReport(run)));
    }
    out.push(...(await workflowReport(group)));
    if (gh && unrecordedRerun(state)) {
      const conclusion = githubConclusion(gh.runId, gh.attempt) ?? 'unknown (no gh)';
      out.push(
        `  ✖ NX Cloud records no nx command for a GitHub re-run, so this status says nothing about the tasks. GitHub concluded: ${conclusion}`,
        `    gh run view ${gh.runId} --attempt ${gh.attempt} --repo ${GITHUB_REPO}`
      );
    } else if (final && group.runs?.total === 0) {
      out.push('  no nx command finished in this run group');
    } else if (!final) {
      out.push(
        '  (NX Cloud is still finishing this run group: its workers and runs may be incomplete)'
      );
    }
  }
  return out;
}

// The exit code for a finished pipeline. For a GitHub re-run NX Cloud's status is not the result
// (see unrecordedRerun), so GitHub's conclusion decides; without `gh` the result is unknown.
function outcome(cipe: Cipe, groups: RunGroupState[]) {
  for (const state of groups.filter(unrecordedRerun)) {
    const gh = githubRun(state.group)!;
    const conclusion = githubConclusion(gh.runId, gh.attempt);
    if (conclusion === undefined) return EXIT.unknown;
    if (conclusion !== 'success') return EXIT.failed;
  }
  return cipe.status === 'SUCCEEDED' ? EXIT.succeeded : EXIT.failed;
}

function print(lines: string | string[]) {
  for (const line of [lines].flat()) console.log(line);
}

// Retries `fn` a few times on errors that can pass; any other error ends the watch.
async function retrying<T>(what: string, fn: () => Promise<T>, interval: number): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof ApiError && e.retryable) || attempt >= 5) throw e;
      print(`[${time()}] nx-cloud: ${what} failed, retrying: ${e.message}`);
      await sleep(interval);
    }
  }
}

async function watch(target: Target, sha: string | undefined, interval: number) {
  const pipelines = pipelinesOf(target);
  const runsSeen = new Set<string>();
  const statusSeen = new Map<string, string>();
  const startedAt = Date.now();
  let followed: Cipe | undefined;
  let waitingSaid = false;
  let graceSaid = false;
  let doneAt: number | undefined;

  for (;;) {
    const { cipes, notInNxCloud } = await retrying('poll', pipelines, interval);
    if (notInNxCloud) {
      print(`[${time()}] nx-cloud: ${notInNxCloud}`);
      return EXIT.error;
    }
    const candidates = sha ? cipes.filter((c) => c.vcsContext?.headSha === sha) : cipes;
    const newest = candidates[0];

    if (!newest) {
      const where = `${sha ? ` for ${sha.slice(0, 7)}` : ''} on ${describeTarget(target)}`;
      if (Date.now() - startedAt > START_TIMEOUT_MS) {
        print(
          `[${time()}] nx-cloud: no pipeline started${where} in ${START_TIMEOUT_MS / 60000} minutes. ${
            target.kind === 'run'
              ? 'Did that run start an NX Cloud pipeline?'
              : 'Is the commit pushed, and does the pull request have an nx: label?'
          }`
        );
        return EXIT.error;
      }
      if (!waitingSaid) print(`[${time()}] nx-cloud: waiting for a pipeline${where}`);
      waitingSaid = true;
      await sleep(interval);
      continue;
    }

    if (
      !followed &&
      target.kind === 'branch' &&
      TERMINAL.has(newest.status) &&
      Date.now() - startedAt < FINISHED_GRACE_MS
    ) {
      if (!graceSaid) {
        print(
          `[${time()}] nx-cloud: the newest pipeline${sha ? ` for ${sha.slice(0, 7)}` : ''} has already finished (${newest.id.slice(0, 8)}, ${newest.status}); waiting ${FINISHED_GRACE_MS / 60000} minutes for a new one before reporting it`
        );
        graceSaid = true;
      }
      await sleep(interval);
      continue;
    }

    if (followed && newest.id !== followed.id) {
      print(`[${time()}] nx-cloud: a newer pipeline started, following it instead`);
      doneAt = undefined;
    }
    followed = newest;

    // Status changes of the followed pipeline and of the ones it replaced.
    for (const cipe of candidates.slice(0, 5)) {
      const before = statusSeen.get(cipe.id);
      if (before === cipe.status) continue;
      statusSeen.set(cipe.id, cipe.status);
      if (cipe.id === followed.id || before !== undefined) {
        print(`[${time()}] nx-cloud: ${cipeLine(cipe)}`);
      }
      if (cipe.id === followed.id && before === undefined) print(`  ${cipeUrl(cipe)}`);
    }

    // Each nx command that finishes, with its failed tasks, while the pipeline still runs.
    if (!TERMINAL.has(followed.status)) {
      try {
        for (const group of (await api<List<RunGroup>>(followed.links.runGroups)).items) {
          for (const run of (await api<List<Run>>(group.links.runs)).items) {
            if (runsSeen.has(run.id)) continue;
            const full = await api<Run>(run.links.self);
            print([`[${time()}] nx-cloud: ${runLine(full)}`, ...(await taskReport(full))]);
            runsSeen.add(run.id);
          }
        }
      } catch (e) {
        if (!(e instanceof ApiError && e.retryable)) throw e;
        print(`[${time()}] nx-cloud: could not read the finished runs yet: ${e.message}`);
      }
      await sleep(interval);
      continue;
    }

    // Done. The run groups' details can lag the pipeline by minutes; wait for them, within reason.
    const done = followed;
    const groups = await retrying('poll', () => runGroupsOf(done), interval);
    const final = groups.every((g) => g.final);
    if (doneAt === undefined && !final && done.status !== 'SUCCEEDED') {
      // Say why it failed now: a newer push can replace this pipeline before its details are final.
      const lines = await retrying('report', () => report(done, groups), interval);
      print([`[${time()}] nx-cloud: first report, worker details follow:`, ...lines]);
    }
    doneAt ??= Date.now();
    if (!final && Date.now() - doneAt < FINALIZE_TIMEOUT_MS) {
      await sleep(Math.min(interval, 20));
      continue;
    }
    const lines = await retrying('report', () => report(done, groups), interval);
    print([`[${time()}] nx-cloud: pipeline done, report:`, ...lines]);
    return outcome(done, groups);
  }
}

function sleep(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

type Target =
  | { kind: 'branch'; branch: string }
  | { kind: 'cipe'; cipeId: string }
  // A GitHub Actions run: NX Cloud's run group `<runId>-<attempt>`. A job link names its attempt.
  | { kind: 'run'; runId: string; attempt?: number; jobId?: string };

function describeTarget(target: Target) {
  if (target.kind === 'run') {
    return `GitHub Actions run ${target.runId}${target.attempt ? `, attempt ${target.attempt}` : ''}`;
  }
  return target.kind === 'cipe' ? `CIPE ${target.cipeId}` : target.branch;
}

interface RunLookup {
  cipeId?: string;
  // Set when GitHub says the run has finished but NX Cloud has no pipeline for it.
  notInNxCloud?: string;
}

// Finds the pipeline of a GitHub Actions run through its run group. `gh` names the run's branch (to
// narrow the list), its latest attempt and whether it finished; without `gh`, the newest 100 run
// groups of the workspace are searched, and a bare run id takes the latest attempt NX Cloud knows.
async function lookUpRun(target: Extract<Target, { kind: 'run' }>): Promise<RunLookup> {
  let { attempt } = target;
  let branch: string | undefined;
  let finished = false;
  try {
    if (attempt === undefined && target.jobId) {
      attempt = Number(
        gh(['api', `repos/${GITHUB_REPO}/actions/jobs/${target.jobId}`, '--jq', '.run_attempt'])
      );
    }
    const run = JSON.parse(
      gh([
        'run',
        'view',
        target.runId,
        '--repo',
        GITHUB_REPO,
        '--json',
        'headBranch,attempt,status',
      ])
    );
    branch = run.headBranch;
    attempt ??= run.attempt;
    finished = run.status === 'completed' || attempt! < run.attempt;
  } catch {
    if (!ghWarned) {
      print(
        `nx-cloud: gh could not read GitHub Actions run ${target.runId}; searching the newest run groups instead`
      );
      ghWarned = true;
    }
  }
  const query: Record<string, string> = { limit: '100' };
  if (branch) query.branch = branch;
  const groups = (await api<List<RunGroup & { cipeId: string }>>('run-groups', { query })).items;
  const match = groups
    .filter((g) => githubRun(g)?.runId === target.runId)
    .filter((g) => attempt === undefined || githubRun(g)?.attempt === attempt)
    .sort((a, b) => githubRun(b)!.attempt - githubRun(a)!.attempt)[0];
  if (match) {
    // Saves findCipe two requests on its first look at a running pipeline.
    if (match.branch) cipeBranches.set(match.cipeId, match.branch);
    return { cipeId: match.cipeId };
  }
  if (finished) {
    return {
      notInNxCloud: `${describeTarget({ ...target, attempt })} has finished, but NX Cloud has no pipeline for it. Did that run start an NX Cloud pipeline?`,
    };
  }
  return {};
}

let ghWarned = false;

// Polls the pipelines a target names, newest first. For a GitHub run the list stays empty until NX
// Cloud registers it; once found, its pipeline id is kept.
function pipelinesOf(target: Target): () => Promise<{ cipes: Cipe[]; notInNxCloud?: string }> {
  let cipeId = target.kind === 'cipe' ? target.cipeId : undefined;
  return async () => {
    if (target.kind === 'branch') return { cipes: await listCipes(target.branch) };
    if (!cipeId && target.kind === 'run') {
      const lookup = await lookUpRun(target);
      if (!lookup.cipeId) return { cipes: [], notInNxCloud: lookup.notInNxCloud };
      cipeId = lookup.cipeId;
    }
    return { cipes: [await findCipe(cipeId!)] };
  };
}

// Pull request numbers stay well under this; GitHub Actions run ids are far above it.
const MAX_PR_NUMBER = 9_999_999;

export function parseTarget(target: string): Target {
  if (/^[0-9a-f]{24}$/.test(target)) return { kind: 'cipe', cipeId: target };
  const runGroup = RUN_GROUP.exec(target);
  if (runGroup) return { kind: 'run', runId: runGroup[1], attempt: Number(runGroup[2]) };
  if (/^\d+$/.test(target) && Number(target) > MAX_PR_NUMBER) {
    return { kind: 'run', runId: target };
  }
  if (/^#?\d+$/.test(target)) return { kind: 'branch', branch: target.replace('#', '') };
  if (!/^https?:\/\//.test(target)) return { kind: 'branch', branch: target };

  const url = new URL(target);
  const cipeId = /\/cipes\/([0-9a-f]{24})\b/.exec(url.pathname)?.[1];
  if (cipeId) return { kind: 'cipe', cipeId };
  const run = /\/actions\/runs\/(\d+)(?:\/attempts\/(\d+)|\/job\/(\d+))?/.exec(url.pathname);
  if (run) {
    return {
      kind: 'run',
      runId: run[1],
      ...(run[2] ? { attempt: Number(run[2]) } : {}),
      ...(run[3] ? { jobId: run[3] } : {}),
    };
  }
  const pr = /\/pull\/(\d+)\b/.exec(url.pathname)?.[1];
  if (pr) return { kind: 'branch', branch: pr };
  // An NX Cloud overview link names its branch.
  const branch = url.searchParams.get('branch');
  if (url.hostname === 'cloud.nx.app' && branch) return { kind: 'branch', branch };
  throw new Error(
    `Cannot read a pipeline from ${target}. Pass a pull request number, a branch, a CIPE id, a cloud.nx.app/cipes link, a GitHub Actions run id or link, or a run group (<run id>-<attempt>).`
  );
}

function git(args: string[]) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }).trim();
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      watch: { type: 'boolean', short: 'w' },
      sha: { type: 'string' },
      interval: { type: 'string', default: '30' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    // The leading comment block of this file.
    const lines = readFileSync(import.meta.filename, 'utf8').split('\n');
    const end = lines.findIndex((line) => !line.startsWith('//'));
    print(
      lines
        .slice(0, end)
        .map((line) => line.replace(/^\/\/ ?/, ''))
        .join('\n')
    );
    return EXIT.succeeded;
  }

  let target: Target;
  let shaRef = values.sha;
  if (positionals[0]) {
    target = parseTarget(positionals[0]);
  } else {
    const branch = git(['branch', '--show-current']);
    if (!branch) {
      throw new Error('Not on a branch: pass a pull request number, branch, CIPE or GitHub run.');
    }
    target = { kind: 'branch', branch };
    shaRef ??= 'HEAD';
  }
  let sha: string | undefined;
  if (shaRef) {
    try {
      sha = git(['rev-parse', '--verify', `${shaRef}^{commit}`]);
    } catch {
      throw new Error(`Unknown commit ${shaRef}: fetch it first, or pass the full SHA.`);
    }
  }
  const interval = Number(values.interval);
  if (!Number.isFinite(interval))
    throw new Error(`--interval takes seconds, not ${values.interval}.`);

  // Each poll costs a few requests of the organization's shared API quota; stay well under it.
  if (values.watch) return watch(target, sha, Math.max(15, interval));

  const { cipes, notInNxCloud } = await pipelinesOf(target)();
  const cipe = sha ? cipes.find((c) => c.vcsContext?.headSha === sha) : cipes[0];
  if (!cipe) {
    print(
      notInNxCloud ??
        `No NX Cloud pipeline found for ${describeTarget(target)}${sha ? ` at ${sha.slice(0, 7)}` : ''}.`
    );
    return EXIT.error;
  }
  const groups = await runGroupsOf(cipe);
  print(await report(cipe, groups));
  const running = cipes.filter((c) => c.id !== cipe.id && !TERMINAL.has(c.status));
  if (running.length) print(`also running on this branch: ${running.map((c) => c.id).join(', ')}`);
  if (!TERMINAL.has(cipe.status)) return EXIT.running;
  return outcome(cipe, groups);
}

if (esMain(import.meta.url)) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(`nx-cloud-status: ${e instanceof Error ? e.message : e}`);
      process.exit(EXIT.error);
    }
  );
}
