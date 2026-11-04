/**
 * Reports what an NX Cloud CI pipeline execution (CIPE) did, or follows one live, without a browser.
 *
 * It reads the NX Cloud Public API through `npx nx-cloud api` with your own `nx login`, so it needs
 * no token in code or chat. A one-off report covers the pipeline status, why it was canceled, the
 * failed tasks with the end of their logs, and worker steps that failed or timed out (such as the
 * node_modules cache setup) with the reason NX Cloud recorded.
 *
 * `--watch` prints one line per change and exits with the full report once the pipeline is done, so
 * an agent can run it as a background monitor and is woken by each line.
 *
 * Usage:
 *   node scripts/nx-cloud-status.ts [target] [--watch] [--sha <commit>] [--interval <seconds>]
 *
 * `target` is a pull request number, a branch, a CIPE id or a cloud.nx.app link to a CIPE. It
 * defaults to the current git branch. NX Cloud lists a pull request's pipelines under the pull
 * request number and under its branch, so both find them.
 *
 * Exit code: 0 when the pipeline succeeded, 1 when it failed, was canceled or timed out, 2 on errors.
 */
import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs, promisify } from 'node:util';

import { esMain } from './utils/esmain.ts';

const execFileAsync = promisify(execFile);

/** Same version as `.github/workflows/nx.yml`; its `api` command is the NX Cloud Public API client. */
const NX_CLOUD_CLI = 'nx-cloud@19.1.5';
const ROOT = join(import.meta.dirname, '..');
const NX_CLOUD_ID: string = JSON.parse(readFileSync(join(ROOT, 'nx.json'), 'utf8')).nxCloudId;
const TERMINAL = new Set(['SUCCEEDED', 'FAILED', 'CANCELED', 'TIMED_OUT']);
/** At most this many failed tasks and failed worker steps get their log tail in a report. */
const MAX_LOGS = 5;
const LOG_TAIL_LINES = 20;
const FAILURE_LINES = 8;
/** How long `--watch` waits after a pipeline ends for NX Cloud to finish its run groups' details. */
const FINALIZE_TIMEOUT_MS = 10 * 60 * 1000;

type Links = Record<string, string>;

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
  runGroups?: { total: number; statusCounts: Record<string, number> };
  links: Links;
}

interface RunGroup {
  id: string;
  status: string;
  completedBy?: string | null;
  criticalErrorMessage?: string | null;
  workerCount?: number | null;
  runs?: { total: number; statusCounts: Record<string, number> };
  workflow?: {
    status: string;
    steps: { statusCounts: Record<string, number> };
    workers: { total: number };
    instances: { restarted: number; restartAttempts: number };
    estimatedTotalCredits?: number | null;
    links: Links;
  } | null;
  links: Links;
}

interface Run {
  id: string;
  status: string;
  command: string;
  completedAt?: string | null;
  tasks?: { total: number; statusCounts: Record<string, number> };
  links: Links;
}

interface Asset {
  type: string;
  url: string;
}

interface Task {
  id: string;
  status: string;
  workerName?: string | null;
  assets: Asset[];
}

interface Step {
  id: string;
  name: string;
  status: string;
  launchTemplate?: string | null;
  instances: { total: number; statusCounts: Record<string, number> };
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

interface List<T> {
  items: T[];
  nextCursor: string | null;
}

class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

// --- NX Cloud API --------------------------------------------------------------------------------

/**
 * A workspace token in the environment wins over the user's login in `nx-cloud api`. A token for
 * another workspace then fails with 401, so a 401 retries once with the login alone.
 */
let useEnvToken = Boolean(process.env.NX_CLOUD_ACCESS_TOKEN || process.env.NX_CLOUD_AUTH_TOKEN);

async function api<T>(
  path: string,
  {
    query = {},
    pathParams = {},
    output,
  }: {
    query?: Record<string, string | string[]>;
    pathParams?: Record<string, string>;
    output?: string;
  } = {}
): Promise<T> {
  const args = ['-y', NX_CLOUD_CLI, 'api', path, '--nxCloudId', NX_CLOUD_ID];
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
    const { stdout, stderr } = await execFileAsync('npx', args, {
      cwd: ROOT,
      env,
      maxBuffer: 64 * 1024 * 1024,
    });
    if (output) {
      const file = stderr
        .split('\n')
        .flatMap((line) => {
          try {
            return [JSON.parse(line).output?.file];
          } catch {
            return [];
          }
        })
        .find(Boolean);
      return (file ?? output) as T;
    }
    return JSON.parse(stdout) as T;
  } catch (e) {
    const stderr: string = (e as { stderr?: string }).stderr ?? String(e);
    const error = stderr
      .split('\n')
      .map((line) => {
        try {
          return JSON.parse(line).error;
        } catch {
          return undefined;
        }
      })
      .find(Boolean);
    if (error?.status === 401 && useEnvToken) {
      useEnvToken = false;
      return api(path, { query, pathParams, output });
    }
    if (error?.status === 401) {
      throw new ApiError('NX Cloud rejected the login. Run `npx nx login` and try again.', 401);
    }
    const body = typeof error?.body === 'object' ? error.body : undefined;
    throw new ApiError(
      error
        ? `${error.message}${body?.message ? `: ${body.message}` : ''} (${path})`
        : stderr.trim(),
      error?.status
    );
  }
}

/** A terminal entity returns its details; a running one returns 409, so undefined means "still running". */
async function getIfTerminal<T>(
  path: string,
  pathParams: Record<string, string>
): Promise<T | undefined> {
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

async function findCipe(id: string): Promise<Cipe> {
  const cipe = await getIfTerminal<Cipe>('cipes/{cipeId}', { cipeId: id });
  if (cipe) return cipe;
  // Running: the list holds running CIPEs, so find it there through its run groups' branch.
  const groups = await api<List<{ branch?: string | null }>>('run-groups', {
    query: { cipeId: id },
  });
  const branch = groups.items.find((g) => g.branch)?.branch;
  const match = branch ? (await listCipes(branch, 50)).find((c) => c.id === id) : undefined;
  if (!match) throw new ApiError(`Found CIPE ${id}, but not its branch while it runs.`);
  return match;
}

/**
 * The run groups of a pipeline, with their details once NX Cloud serves them. A pipeline and its
 * run groups can be listed as done while the workers' workflow still runs; until that finishes the
 * details (and often the finished runs) are missing, so `final` is false.
 */
async function runGroupsOf(cipe: Cipe): Promise<{ group: RunGroup; final: boolean }[]> {
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

/**
 * Lines that name a failure in the test runners and compilers this repo uses (Vitest and Jest `FAIL`,
 * `×`/`✖` marks, TypeScript errors, npm/yarn errors). Expected errors that tests log are not matched.
 */
const FAILURE_LINE = /^\s*(FAIL\b|×|✖)|\berror TS\d+|\bERR!/;

export function logLines(text: string) {
  return stripAnsi(text)
    .split('\n')
    .map((l) => l.trimEnd())
    .filter(Boolean);
}

/** The lines that name the failure, then the last lines of the log. */
export function summarizeLog(lines: string[]) {
  const tail = lines.slice(-LOG_TAIL_LINES);
  const failures = lines
    .slice(0, -LOG_TAIL_LINES)
    .filter((l) => FAILURE_LINE.test(l))
    .slice(-FAILURE_LINES);
  return [...failures, ...(failures.length ? ['…'] : []), ...tail];
}

/**
 * Downloads a logs asset to a readable text file (task logs come as a tarball, worker step logs as
 * NDJSON) and returns its path with the lines that look like errors and the last lines.
 */
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
      text = readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line) => {
          try {
            const message = JSON.parse(line).message;
            return message === undefined ? [] : [message];
          } catch {
            return [];
          }
        })
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

// --- Formatting ----------------------------------------------------------------------------------

function stripAnsi(text: string) {
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

function duration(from: string, to?: string | null) {
  const seconds = Math.round(((to ? Date.parse(to) : Date.now()) - Date.parse(from)) / 1000);
  const m = Math.floor(seconds / 60);
  return m ? `${m}m ${seconds % 60}s` : `${seconds}s`;
}

function counts(statusCounts: Record<string, number> = {}) {
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

/** NX Cloud names a GitHub Actions run group `<run id>-<attempt>`. */
function githubRun(group: RunGroup) {
  const match = /^(\d+)-(\d+)$/.exec(group.id);
  return match ? `GitHub Actions run ${match[1]}, attempt ${match[2]}` : undefined;
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
  const state = TERMINAL.has(cipe.status)
    ? `${cipe.status} after ${duration(cipe.createdAt, cipe.completedAt)}`
    : `${cipe.status}, running for ${duration(cipe.createdAt)}`;
  const reason = cancelReason(cipe);
  return `pipeline ${cipeTitle(cipe)}: ${state}${reason ? `, canceled because ${reason}` : ''}`;
}

function runLine(run: Run) {
  return `${run.status === 'SUCCEEDED' ? '✔' : '✖'} ${run.status} ${run.command} — ${run.tasks?.total ?? '?'} tasks: ${counts(
    run.tasks?.statusCounts
  )} (run ${run.id})`;
}

// --- Report --------------------------------------------------------------------------------------

async function failedTasks(run: Run): Promise<Task[]> {
  if (!run.tasks?.statusCounts.FAILED) return [];
  return (await api<List<Task>>(run.links.tasks, { query: { statuses: 'FAILED', limit: '100' } }))
    .items;
}

async function taskReport(run: Run): Promise<string[]> {
  const tasks = await failedTasks(run);
  const out: string[] = [];
  for (const [i, task] of tasks.entries()) {
    out.push(`    ✖ ${task.id}${task.workerName ? ` on ${task.workerName}` : ''}`);
    if (i < MAX_LOGS) {
      out.push(
        ...(
          await readLog(
            task.assets.find((a) => a.type === 'logs'),
            task.id
          )
        ).map((l) => `        │ ${l}`)
      );
    }
  }
  return out;
}

async function workflowReport(group: RunGroup): Promise<string[]> {
  const wf = group.workflow;
  if (!wf) return [];
  const out = [
    `  workers: ${wf.workers.total}, steps: ${counts(wf.steps.statusCounts)}${
      wf.instances.restarted ? `, ${wf.instances.restarted} worker restarts` : ''
    }${wf.estimatedTotalCredits ? `, ~${wf.estimatedTotalCredits} credits` : ''}`,
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
    // The reason sits on the failing workers (instances) of the step, not on the step itself.
    const instances = (
      await api<List<Instance>>(step.links.instances, { query: { statuses: bad, limit: '100' } })
    ).items;
    const reasons = new Map<string, number>();
    const details = await mapLimited(instances.slice(0, 20), (i) => api<Instance>(i.links.self));
    for (const detail of details) {
      const reason = detail.timeoutInfo
        ? `${detail.timeoutInfo.reason} after ${detail.timeoutInfo.durationSeconds}s`
        : (detail.priorRuns ?? []).some((p) => p.status === 'MACHINE_TERMINATED')
          ? `${detail.status.toLowerCase()} (an earlier boot was MACHINE_TERMINATED)`
          : detail.status.toLowerCase();
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
    for (const [reason, n] of reasons) out.push(`      ${n}× ${reason}`);
    // A failed worker says more than one that timed out or was canceled.
    const first =
      instances.find((i) => i.status === 'FAILED') ??
      instances.find((i) => i.status !== 'CANCELED');
    if (first && logs++ < MAX_LOGS) {
      out.push(`      worker ${first.workerName}:`);
      out.push(
        ...(
          await readLog(
            first.assets.find((a) => a.type === 'logs'),
            `${step.name}-${first.workerName}`
          )
        ).map((l) => `        │ ${l}`)
      );
    }
  }
  return out;
}

async function report(cipe: Cipe): Promise<string[]> {
  const out = [cipeLine(cipe), `  ${cipeUrl(cipe)}`];
  for (const { group, final } of await runGroupsOf(cipe)) {
    const gh = githubRun(group);
    out.push(
      `  run group ${group.id}${gh ? ` (${gh})` : ''}: ${group.status}${
        group.completedBy ? `, ended by ${group.completedBy}` : ''
      }`
    );
    if (group.criticalErrorMessage) out.push(`  ✖ critical error: ${group.criticalErrorMessage}`);
    for (const run of await runsOf(group)) {
      out.push(`  ${runLine(run)}`, ...(await taskReport(run)));
    }
    if (final && group.runs?.total === 0) {
      out.push('  no nx command finished in this run group');
    }
    out.push(...(await workflowReport(group)));
    if (!final) {
      out.push(
        '  (NX Cloud is still finishing this run group: its workers and runs may be incomplete)'
      );
    }
  }
  return out;
}

// --- Watch ---------------------------------------------------------------------------------------

function print(lines: string | string[]) {
  for (const line of [lines].flat()) console.log(line);
}

async function watch(
  branch: string | undefined,
  cipeId: string | undefined,
  sha: string | undefined,
  interval: number
) {
  const runsSeen = new Set<string>();
  const statusSeen = new Map<string, string>();
  let followed: Cipe | undefined;
  let waitingSaid = false;
  let doneAt: number | undefined;

  for (;;) {
    let cipes: Cipe[];
    try {
      cipes = cipeId ? [await findCipe(cipeId)] : await listCipes(branch!);
    } catch (e) {
      // A failed poll must not end the watch; say it and try again.
      print(`[${time()}] nx-cloud: poll failed, retrying: ${(e as Error).message}`);
      await sleep(interval);
      continue;
    }
    const candidates = sha ? cipes.filter((c) => c.vcsContext?.headSha?.startsWith(sha)) : cipes;
    const newest = candidates[0];

    if (!newest) {
      if (!waitingSaid)
        print(
          `[${time()}] nx-cloud: waiting for a pipeline${sha ? ` for ${sha.slice(0, 7)}` : ''} on ${branch}`
        );
      waitingSaid = true;
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
      if (cipe.id === followed.id || before !== undefined)
        print(`[${time()}] nx-cloud: ${cipeLine(cipe)}`);
      if (cipe.id === followed.id && before === undefined) print(`  ${cipeUrl(cipe)}`);
    }

    // Each nx command that finishes, with its failed tasks, while the pipeline still runs.
    if (!TERMINAL.has(followed.status)) {
      try {
        for (const group of (await api<List<RunGroup>>(followed.links.runGroups)).items) {
          for (const run of (await api<List<Run>>(group.links.runs)).items) {
            if (runsSeen.has(run.id)) continue;
            runsSeen.add(run.id);
            const full = await api<Run>(run.links.self);
            print([`[${time()}] nx-cloud: ${runLine(full)}`, ...(await taskReport(full))]);
          }
        }
      } catch (e) {
        print(`[${time()}] nx-cloud: could not read the finished runs: ${(e as Error).message}`);
      }
      await sleep(interval);
      continue;
    }

    // Done. The run groups' details can lag the pipeline by minutes; wait for them, within reason.
    doneAt ??= Date.now();
    let final = false;
    try {
      final = (await runGroupsOf(followed)).every((g) => g.final);
    } catch (e) {
      print(`[${time()}] nx-cloud: poll failed, retrying: ${(e as Error).message}`);
    }
    if (!final && Date.now() - doneAt < FINALIZE_TIMEOUT_MS) {
      await sleep(Math.min(interval, 20));
      continue;
    }
    print(`[${time()}] nx-cloud: pipeline done, report:`);
    print(await report(followed));
    return followed.status === 'SUCCEEDED' ? 0 : 1;
  }
}

/** Runs `fn` over `items` a few at a time: the API allows bursts of about ten requests. */
async function mapLimited<T, R>(items: T[], fn: (item: T) => Promise<R>, limit = 4): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    results.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return results;
}

function sleep(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

// --- Main ----------------------------------------------------------------------------------------

export function parseTarget(target: string | undefined): { branch?: string; cipeId?: string } {
  if (!target) {
    return {
      branch: execFileSync('git', ['branch', '--show-current'], {
        cwd: ROOT,
        encoding: 'utf8',
      }).trim(),
    };
  }
  const id = /(?:cipes\/)?([0-9a-f]{24})\b/.exec(target)?.[1];
  if (id) return { cipeId: id };
  return { branch: target.replace(/^#/, '').replace(/^.*\/pull\/(\d+).*$/, '$1') };
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
    print(readFileSync(import.meta.filename, 'utf8').split('*/')[0]);
    return 0;
  }
  const { branch, cipeId } = parseTarget(positionals[0]);
  const sha = values.sha
    ? execFileSync('git', ['rev-parse', values.sha], { cwd: ROOT, encoding: 'utf8' }).trim()
    : undefined;
  // Each poll costs a few requests of the organization's shared API quota; stay well under it.
  const interval = Math.max(15, Number(values.interval));

  if (values.watch) return watch(branch, cipeId, sha, interval);

  const cipes = cipeId ? [await findCipe(cipeId)] : await listCipes(branch!);
  const cipe = sha ? cipes.find((c) => c.vcsContext?.headSha?.startsWith(sha)) : cipes[0];
  if (!cipe) {
    print(`No NX Cloud pipeline found for ${branch}${sha ? ` at ${sha.slice(0, 7)}` : ''}.`);
    return 2;
  }
  print(await report(cipe));
  const running = cipes.filter((c) => c.id !== cipe.id && !TERMINAL.has(c.status));
  if (running.length) print(`also running on this branch: ${running.map((c) => c.id).join(', ')}`);
  return cipe.status === 'SUCCEEDED' || !TERMINAL.has(cipe.status) ? 0 : 1;
}

if (esMain(import.meta.url)) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(e instanceof ApiError ? `nx-cloud-status: ${e.message}` : e);
      process.exit(2);
    }
  );
}
