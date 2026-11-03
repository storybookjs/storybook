import { execFileSync } from 'node:child_process';

import { it, expect as vitestExpect } from 'vitest';

import { expect } from './expect.ts';

const JEST_MATCHERS_OBJECT = Symbol.for('$$jest-matchers-object');
const STORYBOOK_JEST_MATCHERS_OBJECT = Symbol.for('$$jest-matchers-object-storybook');

type MatchersObject = { matchers: Record<string, unknown> };
const matchersOf = (symbol: symbol) =>
  (globalThis as unknown as Record<symbol, MatchersObject>)[symbol].matchers;

// These tests cover the yarn patch of `@vitest/expect` (see `.yarn/patches/@vitest-expect-*`).

it('registers its matchers apart from the jest matchers object of the test runner', () => {
  expect.extend({
    toBeStorybookOnlyMatcher(received: unknown) {
      return { pass: received === 1, message: () => 'expected 1' };
    },
  });

  vitestExpect(Object.keys(matchersOf(STORYBOOK_JEST_MATCHERS_OBJECT))).toContain(
    'toBeStorybookOnlyMatcher'
  );
  vitestExpect(Object.keys(matchersOf(JEST_MATCHERS_OBJECT))).not.toContain(
    'toBeStorybookOnlyMatcher'
  );
});

it('can be loaded after Jest defined its non-configurable jest matchers object', () => {
  // Mirrors what Jest's `expect` package does before any test file runs.
  const script = `
    const JEST_MATCHERS_OBJECT = Symbol.for('$$jest-matchers-object');
    const jestMatchers = Object.create(null);
    Object.defineProperty(globalThis, JEST_MATCHERS_OBJECT, {
      value: { customEqualityTesters: [], matchers: jestMatchers, state: {} },
    });

    const chai = await import('chai');
    const { JestAsymmetricMatchers, JestChaiExpect, JestExtend, GLOBAL_EXPECT } = await import(
      '@vitest/expect'
    );
    chai.use(JestExtend);
    chai.use(JestChaiExpect);
    chai.use(JestAsymmetricMatchers);
    globalThis[GLOBAL_EXPECT] = chai.expect;
    chai.expect.extend(chai.expect, {
      toBeStorybookOnlyMatcher: (received) => ({ pass: received === 1, message: () => '' }),
    });
    chai.expect(1).toBeStorybookOnlyMatcher();
    chai.expect([1]).toEqual([1]);

    process.stdout.write(JSON.stringify(Object.keys(jestMatchers)));
  `;

  const output = execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: import.meta.dirname,
    encoding: 'utf-8',
  });

  vitestExpect(JSON.parse(output)).toEqual([]);
});
