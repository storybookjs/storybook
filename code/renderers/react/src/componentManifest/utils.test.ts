import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('empathic/find', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

import { getProjectRoot } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import * as find from 'empathic/find';

import { asyncCache, cached, findTsconfigPath, groupBy, invalidateCache, invariant } from './utils';

// Helpers
const calls = () => {
  let n = 0;
  return {
    inc: () => ++n,
    count: () => n,
  };
};

test('groupBy groups items by key function', () => {
  const items = [
    { k: 'a', v: 1 },
    { k: 'b', v: 2 },
    { k: 'a', v: 3 },
  ];
  const grouped = groupBy(items, (it) => it.k);
  expect(grouped).toMatchInlineSnapshot(`
    {
      "a": [
        {
          "k": "a",
          "v": 1,
        },
        {
          "k": "a",
          "v": 3,
        },
      ],
      "b": [
        {
          "k": "b",
          "v": 2,
        },
      ],
    }
  `);
});

test('invariant throws only when condition is falsy and lazily evaluates message', () => {
  const spy = vi.fn(() => 'Expensive message');

  // True branch: does not throw and does not call message factory
  expect(() => invariant(true, spy)).not.toThrow();
  expect(spy).not.toHaveBeenCalled();

  // False branch: throws and evaluates message lazily
  expect(() => invariant(false, spy)).toThrowError('Expensive message');
  expect(spy).toHaveBeenCalledTimes(1);
});

test('cached memoizes by default on first argument value', () => {
  const c = calls();
  const fn = (x: number) => (c.inc(), x * 2);
  const m = cached(fn);

  expect(m(2)).toBe(4);
  expect(m(2)).toBe(4);
  expect(m(3)).toBe(6);
  expect(m(3)).toBe(6);

  // Underlying function should have been called only once per distinct key (2 keys => 2 calls)
  expect(c.count()).toBe(2);
});

test('cached supports custom key selector', () => {
  const c = calls();
  const fn = (x: number, y: number) => (c.inc(), x + y);
  // Cache only by the first arg
  const m = cached(fn, { key: (x) => `${x}` });

  expect(m(1, 10)).toBe(11);
  expect(m(1, 99)).toBe(11); // cached by key 1, result should be from first call
  expect(m(2, 5)).toBe(7);
  expect(m(2, 8)).toBe(7);

  expect(c.count()).toBe(2);
});

test('cached stores and returns undefined results without recomputing', () => {
  const c = calls();
  const fn = (x: string) => {
    c.inc();
    return x === 'hit' ? undefined : x.toUpperCase();
  };
  const m = cached(fn);

  expect(m('hit')).toBeUndefined();
  expect(m('hit')).toBeUndefined();
  expect(m('miss')).toBe('MISS');
  expect(m('miss')).toBe('MISS');

  expect(c.count()).toBe(2);
});

test('cached shares cache across wrappers of the same function', () => {
  const c = calls();
  const f = (x: string) => (c.inc(), x.length);

  const m1 = cached(f, { key: (x) => x });
  const m2 = cached(f, { key: (x) => x });

  // First computes via m1 and caches the value 3 for key 'foo'
  expect(m1('foo')).toBe(3);
  // m2 should now return the cached value (from shared module store), not call f again
  expect(m2('foo')).toBe(3);

  // Verify call counts: underlying function called once
  expect(c.count()).toBe(1);
});

test('asyncCache memoizes in-flight work and resolved results', async () => {
  const c = calls();
  const f = async (x: number) => {
    c.inc();
    return x * 2;
  };
  const m = asyncCache(f);

  const [first, second] = await Promise.all([m(2), m(2)]);

  expect(first).toBe(4);
  expect(second).toBe(4);
  expect(c.count()).toBe(1);
  expect(await m(2)).toBe(4);
  expect(c.count()).toBe(1);
});

test('asyncCache drops rejected promises so retries can recompute', async () => {
  const c = calls();
  const f = async (x: string) => {
    if (c.inc() === 1) {
      throw new Error('boom');
    }
    return x.toUpperCase();
  };
  const m = asyncCache(f);

  await expect(m('hit')).rejects.toThrow('boom');
  await expect(m('hit')).resolves.toBe('HIT');
  expect(c.count()).toBe(2);
});

test('invalidateCache clears the module-level memo store', () => {
  const c = calls();
  const f = (x: number) => (c.inc(), x * 2);
  const m = cached(f);

  expect(m(2)).toBe(4);
  expect(c.count()).toBe(1);

  // Cached result
  expect(m(2)).toBe(4);
  expect(c.count()).toBe(1);

  // Invalidate and ensure it recomputes
  invalidateCache();
  expect(m(2)).toBe(4);
  expect(c.count()).toBe(2);
});

test('invalidateCache clears async module-level memo store', async () => {
  const c = calls();
  const f = async (x: number) => (c.inc(), x * 2);
  const m = asyncCache(f);

  expect(await m(2)).toBe(4);
  expect(c.count()).toBe(1);

  expect(await m(2)).toBe(4);
  expect(c.count()).toBe(1);

  invalidateCache();
  expect(await m(2)).toBe(4);
  expect(c.count()).toBe(2);
});

describe('findTsconfigPath', () => {
  beforeEach(() => {
    invalidateCache();
    vi.mocked(getProjectRoot).mockReturnValue('/project-root');
  });

  test('returns tsconfig.json when found', () => {
    vi.mocked(find.up).mockImplementation((name) => {
      if (name === 'tsconfig.json') {
        return '/project-root/tsconfig.json';
      }
      return undefined;
    });

    const result = findTsconfigPath('/project-root');

    expect(result).toBe('/project-root/tsconfig.json');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('falls back to tsconfig.base.json when tsconfig.json is not found', () => {
    vi.mocked(find.up).mockImplementation((name) => {
      if (name === 'tsconfig.base.json') {
        return '/project-root/tsconfig.base.json';
      }
      return undefined;
    });

    const result = findTsconfigPath('/project-root');

    expect(result).toBe('/project-root/tsconfig.base.json');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('No tsconfig.json found'));
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('tsconfig.base.json'));
  });

  test('falls back to tsconfig.app.json when neither tsconfig.json nor tsconfig.base.json is found', () => {
    vi.mocked(find.up).mockImplementation((name) => {
      if (name === 'tsconfig.app.json') {
        return '/project-root/tsconfig.app.json';
      }
      return undefined;
    });

    const result = findTsconfigPath('/project-root');

    expect(result).toBe('/project-root/tsconfig.app.json');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('tsconfig.app.json'));
  });

  test('returns undefined when no tsconfig variant is found', () => {
    vi.mocked(find.up).mockReturnValue(undefined);

    const result = findTsconfigPath('/project-root');

    expect(result).toBeUndefined();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test('prefers tsconfig.json over fallback variants', () => {
    vi.mocked(find.up).mockImplementation((name) => {
      if (name === 'tsconfig.json') {
        return '/project-root/tsconfig.json';
      }
      if (name === 'tsconfig.base.json') {
        return '/project-root/tsconfig.base.json';
      }
      return undefined;
    });

    const result = findTsconfigPath('/project-root');

    expect(result).toBe('/project-root/tsconfig.json');
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
