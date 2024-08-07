/* eslint-disable @typescript-eslint/ban-ts-comment */
import * as chai from 'chai';
import type {
  AsymmetricMatchersContaining,
  ExpectStatic,
  JestAssertion,
  MatchersObject,
  MatcherState,
} from '@vitest/expect';
import {
  getState,
  GLOBAL_EXPECT,
  JestAsymmetricMatchers,
  JestChaiExpect,
  JestExtend,
  setState,
} from '@vitest/expect';
import * as matchers from '@testing-library/jest-dom/matchers';
import type { PromisifyObject } from './utils';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

type Matchers<T> = PromisifyObject<JestAssertion<T>> &
  TestingLibraryMatchers<ReturnType<ExpectStatic['stringContaining']>, Promise<void>>;

// We only expose the jest compatible API for now
export interface Assertion<T> extends Matchers<T> {
  toHaveBeenCalledOnce(): Promise<void>;
  toSatisfy<E>(matcher: (value: E) => boolean, message?: string): Promise<void>;
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
    if ('captureStackTrace' in Error && typeof Error.captureStackTrace === 'function')
      Error.captureStackTrace(errorGen(), assertions);

    expect.setState({
      expectedAssertionsNumber: expected,
      expectedAssertionsNumberErrorGen: errorGen,
    });
  }

  function hasAssertions() {
    const error = new Error('expected any number of assertion, but got none');
    if ('captureStackTrace' in Error && typeof Error.captureStackTrace === 'function')
      Error.captureStackTrace(error, hasAssertions);

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
