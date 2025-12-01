/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as matchers from '@testing-library/jest-dom/matchers';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

import type {
  AsymmetricMatchersContaining,
  ExpectStatic,
  JestAssertion,
  MatcherState,
  MatchersObject,
} from '@vitest/expect';
import {
  GLOBAL_EXPECT,
  JestAsymmetricMatchers,
  JestChaiExpect,
  JestExtend,
  customMatchers,
  getState,
  setState,
} from '@vitest/expect';
import * as chai from 'chai';

import type { PromisifyObject } from './utils';

type Matchers<T> = PromisifyObject<JestAssertion<T>> &
  TestingLibraryMatchers<ReturnType<ExpectStatic['stringContaining']>, Promise<void>>;

// We only expose the jest compatible API for now
export interface Assertion<T> extends Matchers<T> {
  toHaveBeenCalledOnce(): Promise<void>;
  toSatisfy<E>(matcher: (value: E) => boolean, message?: string): Promise<void>;
  toMatchScreenshot(
    nameOrOptions?: string | ScreenshotMatcherOptions,
    maybeOptions?: ScreenshotMatcherOptions
  ): Promise<void>;
  resolves: Assertion<T>;
  rejects: Assertion<T>;
  not: Assertion<T>;
}

export interface Expect extends AsymmetricMatchersContaining {
  <T>(actual: T, message?: string): Assertion<T>;
  unreachable(message?: string): Promise<never>;
  soft<T>(actual: T, message?: string): Assertion<T>;
  extend(expects: MatchersObject): void;
  assertions(expected: number): Promise<void>;
  hasAssertions(): Promise<void>;
  anything(): any;
  any(constructor: unknown): any;
  getState(): MatcherState;
  setState(state: Partial<MatcherState>): void;
  not: AsymmetricMatchersContaining;
}

// Minimal options surface compatible with Vitest browser toMatchScreenshot
export type ScreenshotMatcherOptions = {
  comparatorName?: string;
  comparatorOptions?: Record<string, any>;
  screenshotOptions?: Record<string, any>;
  timeout?: number;
};

export function createExpect() {
  chai.use(JestExtend);
  chai.use(JestChaiExpect);
  chai.use(JestAsymmetricMatchers);

  const expect = ((value: unknown, message?: string) => {
    const { assertionCalls } = getState(expect);
    setState({ assertionCalls: assertionCalls + 1, soft: false }, expect);
    return chai.expect(value, message);
  }) as ExpectStatic;

  Object.assign(expect, chai.expect);

  // The below methods are added to make chai jest compatible

  expect.getState = () => getState<MatcherState>(expect);
  expect.setState = (state) => setState(state as Partial<MatcherState>, expect);

  // @ts-expect-error chai.extend is not typed
  expect.extend = (expects: MatchersObject) => chai.expect.extend(expect, expects);

  // @ts-ignore tsup borks here for some reason
  expect.soft = (...args) => {
    // @ts-ignore tsup borks here for some reason
    const assert = expect(...args);
    expect.setState({
      soft: true,
    });
    return assert;
  };

  expect.extend(customMatchers);

  // @ts-ignore tsup borks here for some reason
  expect.unreachable = (message?: string): never => {
    chai.assert.fail(`expected${message ? ` "${message}" ` : ' '}not to be reached`);
  };

  function assertions(expected: number) {
    const errorGen = () =>
      new Error(
        `expected number of assertions to be ${expected}, but got ${
          expect.getState().assertionCalls
        }`
      );

    if ('captureStackTrace' in Error && typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(errorGen(), assertions);
    }

    expect.setState({
      expectedAssertionsNumber: expected,
      expectedAssertionsNumberErrorGen: errorGen,
    });
  }

  function hasAssertions() {
    const error = new Error('expected any number of assertion, but got none');

    if ('captureStackTrace' in Error && typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(error, hasAssertions);
    }

    expect.setState({
      isExpectingAssertions: true,
      isExpectingAssertionsError: error,
    });
  }

  setState<MatcherState>(
    {
      // this should also add "snapshotState" that is added conditionally
      assertionCalls: 0,
      isExpectingAssertions: false,
      isExpectingAssertionsError: null,
      expectedAssertionsNumber: null,
      expectedAssertionsNumberErrorGen: null,
    },
    expect
  );

  chai.util.addMethod(expect, 'assertions', assertions);
  chai.util.addMethod(expect, 'hasAssertions', hasAssertions);
  expect.extend(matchers);

  // Provide a guarded placeholder for visual regression assertions. The real implementation
  // is registered by @storybook/addon-vitest when running in Vitest browser mode.
  // If tests call this outside that environment, guide the user with a clear error.
  expect.extend({
    async toMatchScreenshot() {
      // If the addon has registered the real matcher, do nothing here (it overrides this one).
      // Otherwise, throw a helpful error.
      const active = (globalThis as any).__STORYBOOK_TEST_HAS_SCREENSHOT_MATCHER__;

      if (active) {
        return { pass: true, message: () => '' } as any;
      }
      throw new Error(
        'toMatchScreenshot is only available when running tests via @storybook/addon-vitest in Vitest browser mode.\n' +
          '- Enable the Storybook Vitest plugin (storybookTest()) in your vitest config.\n' +
          '- Ensure test.browser.enabled is true and use a browser provider.\n' +
          '- Run transformed stories via @storybook/addon-vitest.'
      );
    },
  } as any);

  return expect as unknown as Expect;
}

const expect: Expect = createExpect();

// @vitest/expect expects this to be set
Object.defineProperty(globalThis, GLOBAL_EXPECT, {
  value: expect,
  writable: true,
  configurable: true,
});

export { expect };
