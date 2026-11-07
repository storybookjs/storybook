// What NX Cloud knows about the tasks a run will run, for CircleCI's setup job (select.ts): which
// task hashes earlier runs already stored in the cache.
//
// From the NX Cloud Public API (https://nx.dev/docs/reference/nx-cloud/public-api), with the
// workspace token CI already has (NX_CLOUD_ACCESS_TOKEN). It is read-only. Without the token (a
// fork's pull request) or when a request fails, it returns nothing, and select.ts counts every task
// as one that runs, as without it.
//
// Every request counts against a rate limit the whole organization shares (60 a minute, bursts of
// 10), so a setup job makes few, at most CONCURRENCY at a time. After a 429 or 503 it waits as long
// as asked before it tries again, up to MAX_WAIT_SECONDS and until DEADLINE; longer, and it goes on
// without that request's history.

const API = `${process.env.NX_CLOUD_API ?? 'https://cloud.nx.app'}/nx-cloud/data/v1`;
const RUNS = 3;
const BASE_RUNS = 3;
const CONCURRENCY = 4;
const ATTEMPTS = 4;
const MAX_WAIT_SECONDS = 30;
// No retry waits past this, counted from the setup job's start: Nx's own task selection, which runs
// meanwhile, takes about as long, so the history never holds up the agents.
const DEADLINE = Date.now() + 60_000;

type Page<T> = { items: T[]; nextCursor: string | null };

let active = 0;
const waiting: (() => void)[] = [];

async function limited<T>(work: () => Promise<T>): Promise<T> {
  if (active < CONCURRENCY) {
    active++;
  } else {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  try {
    return await work();
  } finally {
    // The slot passes straight to the next request, so none can start in between.
    const next = waiting.shift();
    if (next) {
      next();
    } else {
      active--;
    }
  }
}

// How long to wait before trying again, or undefined when NX Cloud asks for longer than the setup job
// can spare: the run is then sized without this request's history, instead of asking again too soon.
function retryAfterSeconds(response: Response, attempt: number) {
  const header = response.headers.get('retry-after');
  const seconds = header === null ? NaN : Number(header);
  const wait = Number.isNaN(seconds) ? 2 ** attempt : seconds;
  return wait <= MAX_WAIT_SECONDS && Date.now() + wait * 1000 <= DEADLINE ? wait : undefined;
}

async function request<T>(path: string, query: URLSearchParams): Promise<Page<T>> {
  const token = process.env.NX_CLOUD_ACCESS_TOKEN;
  if (!token) {
    throw new Error('NX_CLOUD_ACCESS_TOKEN is not set');
  }
  return limited(async () => {
    for (let attempt = 1; ; attempt++) {
      const response = await fetch(`${API}/${path}?${query}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      });
      const seconds =
        (response.status === 429 || response.status === 503) && attempt < ATTEMPTS
          ? retryAfterSeconds(response, attempt)
          : undefined;
      if (seconds !== undefined) {
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
        continue;
      }
      if (!response.ok) {
        throw new Error(`GET ${path}: HTTP ${response.status} ${await response.text()}`);
      }
      return (await response.json()) as Page<T>;
    }
  });
}

// Up to `pages` pages of a list.
async function list<T>(path: string, query: Record<string, string>, pages: number) {
  const items: T[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < pages; page++) {
    const params = new URLSearchParams(query);
    if (cursor) {
      params.set('cursor', cursor);
    }
    const result: Page<T> = await request<T>(path, params);
    items.push(...result.items);
    cursor = result.nextCursor;
    if (!cursor) {
      return items;
    }
  }
  return items;
}

type RunTask = {
  hash: string | null;
  status: string;
  cacheable: boolean;
  projectName: string;
  target: string;
};

export type Run = { id: string; tasks: RunTask[] };

// The latest runs that match `filter`, newest first, with their tasks. A run whose tasks NX Cloud
// does not return is left out, and none when the runs themselves do not come.
async function latestRuns(
  filter: Record<string, string>,
  {
    limit,
    tasks = {},
    pages = 2,
  }: { limit: number; tasks?: Record<string, string>; pages?: number }
): Promise<Run[]> {
  const described = new URLSearchParams(filter).toString();
  try {
    const runs = await list<{ id: string }>('runs', { ...filter, limit: `${limit}` }, 1);
    const results = await Promise.allSettled(
      runs.map(async ({ id }) => {
        const path = `runs/${encodeURIComponent(id)}/tasks`;
        return { id, tasks: await list<RunTask>(path, { limit: '500', ...tasks }, pages) };
      })
    );
    return results.flatMap((result) => {
      if (result.status === 'rejected') {
        console.warn(`Left out a run (${described}) whose tasks did not come: ${result.reason}`);
        return [];
      }
      return [result.value];
    });
  } catch (error) {
    console.warn(`No runs (${described}) from NX Cloud: ${error}`);
    return [];
  }
}

export type History = {
  // The branch's own runs on this OS.
  runs: number;
  // Hashes a run succeeded with: the task's outputs are in the cache under them.
  succeeded: Set<string>;
  // Every hash the branch's own runs recorded, also of failed tasks. None of them matching the
  // selection means the setup job hashes differently from Nx in the run.
  seen: Set<string>;
};

// `own`: the branch's runs on this OS. `base`: the base branch's, whose hashes count only where
// they equal the run's.
export function historyOf(own: readonly Run[], base: readonly Run[]): History {
  const history: History = { runs: own.length, succeeded: new Set(), seen: new Set() };
  for (const task of own.flatMap((run) => run.tasks)) {
    if (task.hash) {
      history.seen.add(task.hash);
    }
  }
  for (const task of [...own, ...base].flatMap((run) => run.tasks)) {
    if (task.hash && task.status === 'SUCCEEDED' && task.cacheable) {
      history.succeeded.add(task.hash);
    }
  }
  return history;
}

// What the base branch's latest runs stored, in every environment: nx-cache.yml, which fills
// `compile` and `check` on each push to `next`, sets no NX_CI_EXECUTION_ENV. Only the tasks that
// succeeded, earliest first, so the first page holds the `compile` tasks that start a run.
export const baseRuns = (baseBranch: string) =>
  latestRuns(
    { branch: baseBranch },
    { limit: BASE_RUNS, tasks: { statuses: 'SUCCEEDED', sort: 'ASC' }, pages: 1 }
  );

// What NX Cloud knows about one OS's tasks (NX_CI_EXECUTION_ENV): the latest runs of the branch
// (NX_BRANCH, the pull request's number) on it, and what the base branch's runs stored.
export async function osHistory(
  os: 'linux' | 'windows',
  branch: string | undefined,
  base: Promise<Run[]>
): Promise<History> {
  const own = branch ? await latestRuns({ branch, ciExecutionEnv: os }, { limit: RUNS }) : [];
  return historyOf(own, await base);
}
