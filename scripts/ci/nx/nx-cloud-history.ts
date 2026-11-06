// What NX Cloud knows about the tasks a run will run, for CircleCI's setup job (select.ts): which
// task hashes the pull request's earlier runs already stored in the cache, and how long each task
// takes.
//
// From the NX Cloud Public API (https://nx.dev/docs/reference/nx-cloud/public-api), with the
// workspace token CI already has (NX_CLOUD_ACCESS_TOKEN). It is read-only. Without the token (a
// fork's pull request) or when a request fails, it returns nothing, and select.ts counts every task
// as one that runs, as without it.
//
// Every request counts against a rate limit the whole organization shares (60 a minute, bursts of
// 10), so a setup job makes as few as it can: one for the runs, one per run for its tasks, and one
// or two for the task statistics.

const API = `${process.env.NX_CLOUD_API ?? 'https://cloud.nx.app'}/nx-cloud/data/v1`;
const RUNS = 3;
const STATS_PAGES = 4;

type Page<T> = { items: T[]; nextCursor: string | null };

async function request<T>(path: string, query: URLSearchParams, retry = true): Promise<Page<T>> {
  const token = process.env.NX_CLOUD_ACCESS_TOKEN;
  if (!token) {
    throw new Error('NX_CLOUD_ACCESS_TOKEN is not set');
  }
  const response = await fetch(`${API}/${path}?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 429 && retry) {
    const seconds = Math.min(10, Number(response.headers.get('retry-after')) || 2);
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    return request(path, query, false);
  }
  if (!response.ok) {
    throw new Error(`GET ${path}: HTTP ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as Page<T>;
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
      return { items, complete: true };
    }
  }
  return { items, complete: false };
}

type RunTask = {
  hash: string | null;
  status: string;
  cacheable: boolean;
  cacheStatus: string | null;
  projectName: string;
  target: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type History = {
  runs: number;
  // Hashes a run succeeded with: the task's outputs are in the cache under them.
  succeeded: Set<string>;
  // Every hash the runs recorded, also of failed tasks. None of them matching the selection means
  // the setup job hashes differently from Nx in the run.
  seen: Set<string>;
  // How long each task (`project:target`) took when it ran, on this OS, in the latest run that ran it.
  seconds: Map<string, number>;
};

// The latest runs NX Cloud recorded for this branch (NX_BRANCH, the pull request's number) on one
// OS (NX_CI_EXECUTION_ENV).
export async function branchHistory(
  branch: string,
  ciExecutionEnv: string
): Promise<History | undefined> {
  try {
    const { items: runs } = await list<{ id: string }>(
      'runs',
      { branch, ciExecutionEnv, limit: `${RUNS}` },
      1
    );
    const tasks = await Promise.all(
      runs.map((run) =>
        list<RunTask>(`runs/${encodeURIComponent(run.id)}/tasks`, { limit: '500' }, 2)
      )
    );
    const history: History = {
      runs: runs.length,
      succeeded: new Set(),
      seen: new Set(),
      seconds: new Map(),
    };
    // The newest run first, so its times win.
    for (const task of tasks.flatMap((t) => t.items)) {
      if (!task.hash) {
        continue;
      }
      history.seen.add(task.hash);
      if (task.status !== 'SUCCEEDED') {
        continue;
      }
      if (task.cacheable) {
        history.succeeded.add(task.hash);
      }
      const key = `${task.projectName}:${task.target}`;
      if (
        /miss/i.test(task.cacheStatus ?? '') &&
        task.startedAt &&
        task.completedAt &&
        !history.seconds.has(key)
      ) {
        history.seconds.set(
          key,
          (Date.parse(task.completedAt) - Date.parse(task.startedAt)) / 1000
        );
      }
    }
    return history;
  } catch (error) {
    console.warn(`No earlier runs from NX Cloud, so every task counts as one that runs: ${error}`);
    return undefined;
  }
}

type TaskStats = {
  projectName: string;
  target: string;
  totalCount: number;
  cacheStatusRatio: { cacheMiss: number };
  averageDuration: { cacheMissMs: number | null };
};

export type Durations = Map<string, { missSeconds?: number }>;

// How long each task (`project:target`) took on CI over the last days, averaged over every run of
// it, so a single slow day does not decide. The average, not the median: the work an agent count is
// worked out from is the sum.
export async function taskDurations(days = 3): Promise<Durations | undefined> {
  try {
    const after = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { items: rows, complete } = await list<TaskStats>(
      'task-stats',
      { isCI: 'true', dateAfter: after, limit: '500' },
      STATS_PAGES
    );
    if (!complete) {
      console.warn(
        `NX Cloud has more task statistics than ${STATS_PAGES} pages; some tasks lack a time.`
      );
    }
    const sums = new Map<string, { miss: number; misses: number }>();
    for (const row of rows) {
      const key = `${row.projectName}:${row.target}`;
      const sum = sums.get(key) ?? { miss: 0, misses: 0 };
      const misses = row.totalCount * row.cacheStatusRatio.cacheMiss;
      if (row.averageDuration.cacheMissMs != null && misses > 0) {
        sum.miss += row.averageDuration.cacheMissMs * misses;
        sum.misses += misses;
      }
      sums.set(key, sum);
    }
    return new Map(
      [...sums].map(([key, sum]) => [
        key,
        {
          missSeconds: sum.misses > 0 ? sum.miss / sum.misses / 1000 : undefined,
        },
      ])
    );
  } catch (error) {
    console.warn(`No task durations from NX Cloud: ${error}`);
    return undefined;
  }
}
