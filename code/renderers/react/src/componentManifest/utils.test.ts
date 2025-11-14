import { expect, test, vi } from 'vitest';

import { cached, groupBy, invalidateCache, invariant } from './utils';

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
