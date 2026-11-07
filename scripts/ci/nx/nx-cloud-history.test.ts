import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type Run, baseRuns, historyOf, osHistory, taskDurations } from './nx-cloud-history.ts';

const task = (
  hash: string,
  overrides: Partial<Run['tasks'][number]> = {}
): Run['tasks'][number] => ({
  hash,
  status: 'SUCCEEDED',
  cacheable: true,
  cacheStatus: 'cache-miss',
  projectName: hash,
  target: 'compile',
  startedAt: '2026-11-01T10:00:00Z',
  completedAt: '2026-11-01T10:01:00Z',
  ...overrides,
});

const page = (items: unknown[]) =>
  new Response(JSON.stringify({ items, nextCursor: null }), { status: 200 });

// Answers each request by its path and query, as NX Cloud would.
const nxCloud = (answer: (path: string, query: URLSearchParams) => Response | Promise<Response>) =>
  vi.fn(async (url: string) => {
    const { pathname, searchParams } = new URL(url);
    return answer(pathname.replace('/nx-cloud/data/v1/', ''), searchParams);
  });

beforeEach(() => {
  vi.stubEnv('NX_CLOUD_ACCESS_TOKEN', 'test-token');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the history of a branch', () => {
  it("counts what the base branch's runs stored as cached, but not as the branch's own", () => {
    const own: Run[] = [{ id: 'pr', tasks: [task('h-pr')] }];
    const base: Run[] = [{ id: 'next', tasks: [task('h-next')] }];

    const history = historyOf(own, base);

    expect(history.runs).toBe(1);
    expect([...history.succeeded].sort()).toEqual(['h-next', 'h-pr']);
    expect([...history.seen]).toEqual(['h-pr']);
    expect([...history.seconds.keys()]).toEqual(['h-pr:compile']);
  });

  it("takes the newest run's time for a task, and only the time of a run that missed the cache", () => {
    const newer = task('h1', { completedAt: '2026-11-01T10:02:00Z' });
    const hit = task('h2', { cacheStatus: 'remote-cache-hit' });

    const history = historyOf(
      [
        { id: 'new', tasks: [newer, hit] },
        { id: 'old', tasks: [task('h1')] },
      ],
      []
    );

    expect(history.seconds).toEqual(new Map([['h1:compile', 120]]));
  });

  it('reads the base branch in every environment', async () => {
    const fetch = nxCloud((path) =>
      path === 'runs' ? page([{ id: 'next-1' }]) : page([task('h-next')])
    );
    vi.stubGlobal('fetch', fetch);

    const runs = await baseRuns('next');

    expect(runs).toEqual([{ id: 'next-1', tasks: [task('h-next')] }]);
    const query = new URL(fetch.mock.calls[0][0]).searchParams;
    expect(query.get('branch')).toBe('next');
    expect(query.has('ciExecutionEnv')).toBe(false);
  });

  it("times a branch's first run on an OS from the latest run on that OS on any branch", async () => {
    vi.stubGlobal(
      'fetch',
      nxCloud((path, query) => {
        if (path === 'runs') {
          return page(query.has('branch') ? [] : [{ id: 'other-pr' }]);
        }
        return page([task('h-windows', { completedAt: '2026-11-01T10:05:00Z' })]);
      })
    );

    const history = await osHistory('windows', '123', Promise.resolve([]));

    expect(history.runs).toBe(0);
    expect(history.succeeded.size).toBe(0);
    expect(history.seconds).toEqual(new Map([['h-windows:compile', 300]]));
  });

  it("keeps the other runs when one run's tasks do not come", async () => {
    vi.stubGlobal(
      'fetch',
      nxCloud((path) => {
        if (path === 'runs') {
          return page([{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }]);
        }
        return path === 'runs/r2/tasks'
          ? new Response('boom', { status: 500 })
          : page([task(`h-${path.split('/')[1]}`)]);
      })
    );

    const history = await osHistory('linux', '123', Promise.resolve([]));

    expect(history.runs).toBe(2);
    expect([...history.succeeded].sort()).toEqual(['h-r1', 'h-r3']);
  });

  it('has no history, and no error, when NX Cloud does not answer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('down', { status: 500 }))
    );

    const history = await osHistory('linux', '123', baseRuns('next'));

    expect(history).toMatchObject({ runs: 0, succeeded: new Set(), seen: new Set() });
  });
});

describe('the requests to NX Cloud', () => {
  it('waits as long as a rate-limited request asks before it tries again', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const fetch = vi.fn(async () =>
      ++calls === 1 ? new Response('', { status: 429, headers: { 'retry-after': '3' } }) : page([])
    );
    vi.stubGlobal('fetch', fetch);

    const durations = taskDurations();
    await vi.advanceTimersByTimeAsync(2_999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    expect(await durations).toEqual(new Map());
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('gives up on a request that stays rate-limited', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(
      async () => new Response('', { status: 429, headers: { 'retry-after': '1' } })
    );
    vi.stubGlobal('fetch', fetch);

    const durations = taskDurations();
    await vi.runAllTimersAsync();

    expect(await durations).toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('has at most four requests in flight, well under the burst limit of 10', async () => {
    let inFlight = 0;
    let most = 0;
    vi.stubGlobal(
      'fetch',
      nxCloud(async (path) => {
        inFlight++;
        most = Math.max(most, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
        return path === 'runs'
          ? page(Array.from({ length: 10 }, (_, i) => ({ id: `r${i}` })))
          : page([task(path)]);
      })
    );

    const runs = await Promise.all([baseRuns('next'), baseRuns('next')]);

    expect(runs.flat()).toHaveLength(20);
    expect(most).toBe(4);
  });
});
