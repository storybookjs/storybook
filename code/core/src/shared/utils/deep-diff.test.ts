import { afterEach, describe, expect, it, vi } from 'vitest';

import { once } from 'storybook/internal/client-logger';

import { DEEP_DIFF_MAX_DEPTH, deepDiff, DEEPLY_EQUAL, isObject } from './deep-diff.ts';

vi.mock('storybook/internal/client-logger', () => ({
  once: { warn: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('isObject', () => {
  it('returns true for plain objects and arrays', () => {
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(true);
    expect(isObject(new Date())).toBe(true);
  });

  it('returns false for null and primitives', () => {
    expect(isObject(null)).toBe(false);
    expect(isObject(undefined)).toBe(false);
    expect(isObject(1)).toBe(false);
    expect(isObject('a')).toBe(false);
    expect(isObject(true)).toBe(false);
  });
});

describe('deepDiff', () => {
  describe('equality', () => {
    it('returns DEEPLY_EQUAL for equal primitives', () => {
      expect(deepDiff(1, 1)).toBe(DEEPLY_EQUAL);
      expect(deepDiff('a', 'a')).toBe(DEEPLY_EQUAL);
      expect(deepDiff(true, true)).toBe(DEEPLY_EQUAL);
      expect(deepDiff(null, null)).toBe(DEEPLY_EQUAL);
      expect(deepDiff(undefined, undefined)).toBe(DEEPLY_EQUAL);
    });

    it('returns DEEPLY_EQUAL for deeply equal objects and arrays', () => {
      expect(deepDiff({ foo: [{ bar: 1 }] }, { foo: [{ bar: 1 }] })).toBe(DEEPLY_EQUAL);
      expect(deepDiff([1, [2, 3]], [1, [2, 3]])).toBe(DEEPLY_EQUAL);
      expect(deepDiff({}, {})).toBe(DEEPLY_EQUAL);
      expect(deepDiff([], [])).toBe(DEEPLY_EQUAL);
    });

    it('prunes equal subtrees rather than returning empty objects', () => {
      // The nested `bar` object is unchanged, so it must not appear in the diff at all.
      expect(deepDiff({ foo: 1, bar: { baz: 2 } }, { foo: 2, bar: { baz: 2 } })).toStrictEqual({
        foo: 2,
      });
    });
  });

  describe('primitives and type changes', () => {
    it('returns the update when types differ', () => {
      expect(deepDiff(true, 1)).toBe(1);
      expect(deepDiff(1, 'a')).toBe('a');
      expect(deepDiff({}, 1)).toBe(1);
      expect(deepDiff([], {})).toStrictEqual({});
    });

    it('returns the update for changed primitives', () => {
      expect(deepDiff(1, 2)).toBe(2);
      expect(deepDiff('a', 'b')).toBe('b');
    });
  });

  describe('arrays', () => {
    it('returns a sparse array when updating an array', () => {
      expect(deepDiff([1, 2], [1, 3])).toStrictEqual([, 3]);
    });

    it('returns undefined for removed array values', () => {
      expect(deepDiff([1, 2], [1])).toStrictEqual([, undefined]);
    });

    it('returns a longer array when adding to an array', () => {
      expect(deepDiff([1, 2], [1, 2, 3])).toStrictEqual([, , 3]);
    });
  });

  describe('objects', () => {
    it('returns a partial when updating an object', () => {
      expect(deepDiff({ foo: 1, bar: 2 }, { foo: 1, bar: 3 })).toStrictEqual({ bar: 3 });
    });

    it('returns undefined for omitted object properties', () => {
      expect(deepDiff({ foo: 1, bar: 2 }, { foo: 1 })).toStrictEqual({ bar: undefined });
    });

    it('traverses into nested objects and arrays', () => {
      expect(deepDiff({ foo: { bar: [1, 2], baz: [3, 4] } }, { foo: { bar: [3] } })).toStrictEqual({
        foo: { bar: [3, undefined], baz: undefined },
      });
    });
  });

  describe('built-in objects', () => {
    it('compares Dates by value', () => {
      expect(deepDiff(new Date('2020-01-01'), new Date('2020-01-01'))).toBe(DEEPLY_EQUAL);
      const changed = deepDiff(new Date('2020-01-01'), new Date('2021-01-01'));
      expect(changed).toBeInstanceOf(Date);
      expect((changed as Date).getFullYear()).toBe(2021);
    });

    it('compares RegExps by value', () => {
      expect(deepDiff(/a/g, /a/g)).toBe(DEEPLY_EQUAL);
      expect(deepDiff(/a/g, /b/g)).toStrictEqual(/b/g);
    });
  });

  describe('non-plain objects', () => {
    class Point {
      constructor(
        public x: number,
        public y: number
      ) {}
    }

    it('treats the same reference as equal', () => {
      const point = new Point(1, 2);
      expect(deepDiff({ point }, { point })).toBe(DEEPLY_EQUAL);
    });

    it('treats a different reference as changed without recursing into it', () => {
      const next = new Point(1, 2);
      const diff = deepDiff({ point: new Point(1, 2) }, { point: next });
      expect(diff).toStrictEqual({ point: next });
      expect((diff as { point: Point }).point).toBe(next);
    });
  });

  describe('cycle and depth guards', () => {
    it('does not overflow on a circular update value', () => {
      const initial = { a: 1 };
      const update: Record<string, unknown> = { a: 2 };
      update.self = update;

      expect(() => deepDiff(initial, update)).not.toThrow();
      expect(deepDiff(initial, update)).toMatchObject({ a: 2 });
    });

    it('does not overflow when both sides share a cycle', () => {
      const a: Record<string, unknown> = { tag: 'a' };
      a.self = a;
      const b: Record<string, unknown> = { tag: 'b' };
      b.self = b;

      expect(() => deepDiff(a, b)).not.toThrow();
      expect(deepDiff(a, b)).toMatchObject({ tag: 'b' });
    });

    it('does not overflow on pathologically deep structures and warns once', () => {
      const makeDeep = (leaf: number) => {
        const root: Record<string, unknown> = {};
        let node: Record<string, unknown> & { child?: Record<string, unknown> } = root;
        for (let i = 0; i < 5000; i += 1) {
          node.child = {};
          node = node.child;
        }
        node.value = leaf;
        return root;
      };

      expect(() => deepDiff(makeDeep(1), makeDeep(2))).not.toThrow();
      expect(once.warn).toHaveBeenCalled();
    });

    it('does not overflow on a reactive-like proxy that yields fresh references per access', () => {
      // Vue's reactive()/VNode graphs can return a *new* reference on each access, defeating
      // identity-based cycle guards — only the depth guard prevents overflow here.
      const makeInfinite = (tag: string): unknown =>
        new Proxy(
          {},
          {
            get: (_t, prop) =>
              prop === 'tag' ? tag : prop === 'child' ? makeInfinite(tag) : undefined,
            ownKeys: () => ['tag', 'child'],
            getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
          }
        );

      expect(() => deepDiff(makeInfinite('a'), makeInfinite('b'))).not.toThrow();
    });

    it('does not warn for shallow structures within the depth limit', () => {
      deepDiff({ a: { b: { c: 1 } } }, { a: { b: { c: 2 } } });
      expect(once.warn).not.toHaveBeenCalled();
    });
  });
});

describe('DEEP_DIFF_MAX_DEPTH', () => {
  it('is a positive backstop limit', () => {
    expect(DEEP_DIFF_MAX_DEPTH).toBeGreaterThan(0);
  });
});
