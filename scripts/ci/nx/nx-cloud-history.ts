// What NX Cloud knows about the tasks a run will run, for CircleCI's setup job (select.ts): which
// task hashes earlier runs already stored in the cache, and how long each task usually takes.
//
// From the NX Cloud Public API (https://nx.dev/docs/reference/nx-cloud/public-api), with the
// workspace token CI already has (NX_CLOUD_ACCESS_TOKEN). It is read-only. Without the token (a
// fork's pull request) or when a request fails, it returns nothing, and select.ts counts every task
// as one that runs, as without it.

const API = `${process.env.NX_CLOUD_API ?? 'https://cloud.nx.app'}/nx-cloud/data/v1`;
// Each request counts against the organization's rate limit, which every workspace shares.
const RUNS_PER_BRANCH = 3;
const MAX_PAGES = 4;

type Page<T> = { items: T[]; nextCursor: string | null };

async function get<T>(path: string, query: Record<string, string | string[]>): Promise<Page<T>[]> {
  const token = process.env.NX_CLOUD_ACCESS_TOKEN;
  if (!token) {
    throw new Error('NX_CLOUD_ACCESS_TOKEN is not set');
  }
  const pages: Page<T>[] = [];
  let cursor: string | null = null;
  do {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      for (const v of [value].flat()) {
        params.append(key, v);
      }
    }
    if (cursor) {
      params.set('cursor', cursor);
    }
    const response = await fetch(`${API}/${path}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`GET ${path}: HTTP ${response.status} ${await response.text()}`);
    }
    const page = (await response.json()) as Page<T>;
    pages.push(page);
    cursor = page.nextCursor;
  } while (cursor && pages.length < MAX_PAGES);
  return pages;
}

type Run = { id: string };
type RunTask = { hash: string | null; status: string; cacheable: boolean };

// The hashes the latest runs on these branches stored: a task that succeeded with a hash left its
// outputs in the cache under it. `seen` also holds the ones that failed, to tell a hash that
// differs from Nx's in the run from one that only failed.
export async function cachedHashes(
  branches: readonly string[],
  ciExecutionEnv: string
): Promise<{ succeeded: Set<string>; seen: Set<string>; runs: number } | undefined> {
  try {
    const runs = (
      await Promise.all(
        branches.map((branch) =>
          get<Run>('runs', { branch, ciExecutionEnv, limit: `${RUNS_PER_BRANCH}` }).then(
            ([page]) => page.items
          )
        )
      )
    ).flat();
    const tasks = (
      await Promise.all(
        runs.map((run) =>
          get<RunTask>(`runs/${encodeURIComponent(run.id)}/tasks`, { limit: '500' })
        )
      )
    ).flatMap((pages) => pages.flatMap((page) => page.items));
    const hashed = tasks.filter((task) => task.hash);
    return {
      succeeded: new Set(
        hashed.filter((t) => t.cacheable && t.status === 'SUCCEEDED').map((t) => t.hash!)
      ),
      seen: new Set(hashed.map((t) => t.hash!)),
      runs: runs.length,
    };
  } catch (error) {
    console.warn(`No cache entries from NX Cloud, so every task counts as one that runs: ${error}`);
    return undefined;
  }
}

type TaskStats = {
  projectName: string;
  target: string;
  date: string;
  averageDuration: { cacheMissMs: number | null; remoteCacheHitMs: number | null };
  durationPercentiles?: { percentile: number; cacheMissMs: number | null }[];
};

export type Durations = Map<string, { missSeconds?: number; hitSeconds?: number }>;

// How long each task (`project:target`) took on CI over the last days: the median cache miss, and
// the average restore from the remote cache.
export async function taskDurations(days = 3): Promise<Durations | undefined> {
  try {
    const after = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const rows = (
      await get<TaskStats>('task-stats', {
        isCI: 'true',
        dateAfter: after,
        percentiles: '50',
        limit: '500',
      })
    ).flatMap((page) => page.items);
    const durations: Durations = new Map();
    // The newest day first, so it wins.
    for (const row of rows.sort((a, b) => b.date.localeCompare(a.date))) {
      const key = `${row.projectName}:${row.target}`;
      const known = durations.get(key) ?? {};
      const miss =
        row.durationPercentiles?.find((p) => p.percentile === 50)?.cacheMissMs ??
        row.averageDuration.cacheMissMs;
      const hit = row.averageDuration.remoteCacheHitMs;
      durations.set(key, {
        missSeconds: known.missSeconds ?? (miss != null ? miss / 1000 : undefined),
        hitSeconds: known.hitSeconds ?? (hit != null ? hit / 1000 : undefined),
      });
    }
    return durations;
  } catch (error) {
    console.warn(`No task durations from NX Cloud: ${error}`);
    return undefined;
  }
}
