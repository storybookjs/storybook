/* eslint-disable @typescript-eslint/ban-ts-comment */
// TODO SB11: Upgrade @testing-library/jest-dom to v7+ across the monorepo.
import * as matchers from '@testing-library/jest-dom/matchers';
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

import type {
  ExpectStatic as VitestExpectStatic,
  MatcherState as VitestMatcherState,
  MatchersObject as VitestMatchersObject,
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

type ExpectedValue = string | number | boolean | bigint | symbol | object | null | undefined;
type Matcher = (...args: ExpectedValue[]) => Promise<void>;
type MatcherResult = { message: () => string; pass: boolean };
type CustomMatcher = (
  this: MatcherState,
  received: never,
  ...expected: never[]
) => MatcherResult | Promise<MatcherResult>;
type Matchers<T> = TestingLibraryMatchers<T, Promise<void>>;
type MockReturnValue<T> = T extends (...args: infer _Args) => infer R ? R : ExpectedValue;
type MockParameters<T> = T extends (...args: infer Args) => infer _Return ? Args : ExpectedValue[];

export interface MatcherState {
  assertionCalls: number;
  currentTestName?: string;
  expectedAssertionsNumber?: number | null;
  isExpectingAssertions?: boolean;
  soft?: boolean;
}

// We only expose the jest compatible API for now
export interface ExpectAssertion<T> extends Matchers<T> {
  toBe: Matcher;
  toBeCalled: Matcher;
  toBeCalledWith(...args: MockParameters<T>): Promise<void>;
  toBeCloseTo: Matcher;
  toBeDefined: Matcher;
  toBeFalsy: Matcher;
  toBeFunction: Matcher;
  toBeGreaterThan: Matcher;
  toBeGreaterThanOrEqual: Matcher;
  toBeInstanceOf: Matcher;
  toBeLessThan: Matcher;
  toBeLessThanOrEqual: Matcher;
  toBeNaN: Matcher;
  toBeNull: Matcher;
  toBeTruthy: Matcher;
  toBeTypeOf: Matcher;
  toBeUndefined: Matcher;
  toContain: Matcher;
  toContainEqual: Matcher;
  toEqual: Matcher;
  toEqualTypeOf: Matcher;
  toHaveBeenCalled: Matcher;
  toHaveBeenCalledExactlyOnceWith: Matcher;
  toHaveBeenCalledTimes: Matcher;
  toHaveBeenCalledWith(...args: MockParameters<T>): Promise<void>;
  toHaveBeenLastCalledWith(...args: MockParameters<T>): Promise<void>;
  toHaveBeenNthCalledWith(nthCall: number, ...args: MockParameters<T>): Promise<void>;
  toHaveLength: Matcher;
  toHaveLiveRegion: Matcher;
  toHaveProperty: Matcher;
  toHaveReturnedTimes(times: number): Promise<void>;
  toHaveReturnedWith(value: MockReturnValue<T>): Promise<void>;
  toHaveLastReturnedWith(value: MockReturnValue<T>): Promise<void>;
  toHaveNthReturnedWith(nthCall: number, value: MockReturnValue<T>): Promise<void>;
  toMatch: Matcher;
  toMatchFileSnapshot: Matcher;
  toMatchInlineSnapshot: Matcher;
  toMatchObject: Matcher;
  toMatchSnapshot: Matcher;
  toMatchTypeOf: Matcher;
  toPass: Matcher;
  toStrictEqual: Matcher;
  toThrow: Matcher;
  toThrowError: Matcher;
  toThrowErrorMatchingInlineSnapshot: Matcher;
  toThrowErrorMatchingSnapshot: Matcher;
  toHaveBeenCalledOnce(): Promise<void>;
  toSatisfy<E>(matcher: (value: E) => boolean, message?: string): Promise<void>;
  resolves: ExpectAssertion<T>;
  rejects: ExpectAssertion<T>;
  not: ExpectAssertion<T>;
}

export interface Assertion<T> extends ExpectAssertion<T> {}

export interface Expect {
  <T>(actual: T, message?: string): ExpectAssertion<T>;
  unreachable(message?: string): Promise<never>;
  soft<T>(actual: T, message?: string): ExpectAssertion<T>;
  extend(expects: Record<string, CustomMatcher>): void;
  assertions(expected: number): Promise<void>;
  hasAssertions(): Promise<void>;
  anything(): ExpectedValue;
  any(constructor: abstract new (...args: never[]) => object): ExpectedValue;
  arrayContaining<T>(array: T[]): T[];
  objectContaining<T extends object>(object: T): T;
  stringContaining(expected: string): string;
  stringMatching(expected: RegExp | string): string;
  getState(): MatcherState;
  setState(state: Partial<MatcherState>): void;
  not: Omit<Expect, 'not'>;
}

export function createExpect(): Expect {
  chai.use(JestExtend);
  chai.use(JestChaiExpect);
  chai.use(JestAsymmetricMatchers);

  const expect = ((value: unknown, message?: string) => {
    const { assertionCalls } = getState(expect);
    setState({ assertionCalls: assertionCalls + 1, soft: false }, expect);
    return chai.expect(value, message);
  }) as VitestExpectStatic;

  Object.assign(expect, chai.expect);

  // The below methods are added to make chai jest compatible

  expect.getState = () => getState<VitestMatcherState>(expect);
  expect.setState = (state) => setState(state as Partial<VitestMatcherState>, expect);

  // @ts-expect-error chai.extend is not typed
  expect.extend = (expects: VitestMatchersObject) => chai.expect.extend(expect, expects);

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

  setState<VitestMatcherState>(
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
