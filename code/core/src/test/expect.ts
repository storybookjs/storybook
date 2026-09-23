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

type Any = any;
type Matcher = (...args: Any[]) => Promise<void>;
type MatcherResult = { message: () => string; pass: boolean; actual?: Any; expected?: Any };
type MatcherHintOptions = {
  comment?: string;
  expectedColor?: Any;
  isDirectExpectCall?: boolean;
  isNot?: boolean;
  promise?: string;
  receivedColor?: Any;
  secondArgument?: string;
  secondArgumentColor?: Any;
};
type TesterContext = {
  equals(a: Any, b: Any, customTesters?: EqualityTester[], strictCheck?: boolean): boolean;
};
type EqualityTester = (
  this: TesterContext,
  a: Any,
  b: Any,
  customTesters: EqualityTester[]
) => boolean | undefined;
type MatcherUtils = {
  EXPECTED_COLOR: Any;
  RECEIVED_COLOR: Any;
  INVERTED_COLOR: Any;
  BOLD_WEIGHT: Any;
  DIM_COLOR: Any;
  diff(a: Any, b: Any, options?: Any): Any;
  matcherHint(
    matcherName: string,
    received?: string,
    expected?: string,
    options?: MatcherHintOptions
  ): string;
  printReceived(value: Any): string;
  printExpected(value: Any): string;
  printDiffOrStringify(a: Any, b: Any, aLabel: string, bLabel: string, options?: Any): string;
  printWithType(name: string, value: Any, print: (value: Any) => string): string;
  stringify(value: Any): string;
  iterableEquality: EqualityTester;
  subsetEquality: EqualityTester;
};
type CustomMatcher = (
  this: MatcherState,
  received: Any,
  ...expected: Any[]
) => MatcherResult | Promise<MatcherResult>;
type Matchers<T> = TestingLibraryMatchers<T, Promise<void>>;
type MockReturnValue<T> = T extends (...args: Any[]) => infer R ? R : Any;
type MockParameters<T> = T extends (...args: infer Args) => Any ? Args : Any[];
type AsymmetricMatchers = {
  stringContaining(expected: string): Any;
  objectContaining<T = Any>(object: T): Any;
  arrayContaining<T = Any>(array: T[]): Any;
  stringMatching(expected: RegExp | string): Any;
  closeTo(expected: number, precision?: number): Any;
  toSatisfy(matcher: (value: Any) => boolean, message?: string): Any;
  toBeOneOf<T>(sample: T[]): Any;
};

export interface MatcherState {
  customTesters: EqualityTester[];
  assertionCalls: number;
  currentTestName?: string;
  dontThrow?: () => void;
  error?: Error;
  equals(a: Any, b: Any, customTesters?: EqualityTester[], strictCheck?: boolean): boolean;
  expand?: boolean;
  expectedAssertionsNumber?: number | null;
  expectedAssertionsNumberErrorGen?: (() => Error) | null;
  isExpectingAssertions?: boolean;
  isExpectingAssertionsError?: Error | null;
  isNot: boolean;
  promise: string;
  suppressedErrors: Error[];
  testPath?: string;
  utils: MatcherUtils;
  soft?: boolean;
  poll?: boolean;
}

// We only expose the jest compatible API for now
export interface Assertion<T> extends Matchers<T> {
  toBe<E>(expected: E): Promise<void>;
  toBeCloseTo(number: number, numDigits?: number): Promise<void>;
  toBeDefined(): Promise<void>;
  toBeFalsy(): Promise<void>;
  toBeFunction(): Promise<void>;
  toBeGreaterThan(number: number | bigint): Promise<void>;
  toBeGreaterThanOrEqual(number: number | bigint): Promise<void>;
  toBeInstanceOf<E>(expected: E): Promise<void>;
  toBeLessThan(number: number | bigint): Promise<void>;
  toBeLessThanOrEqual(number: number | bigint): Promise<void>;
  toBeNaN(): Promise<void>;
  toBeNull(): Promise<void>;
  toBeTruthy(): Promise<void>;
  toBeTypeOf(
    expected:
      | 'bigint'
      | 'boolean'
      | 'function'
      | 'number'
      | 'object'
      | 'string'
      | 'symbol'
      | 'undefined'
  ): Promise<void>;
  toBeUndefined(): Promise<void>;
  toContain<E>(item: E): Promise<void>;
  toContainEqual<E>(item: E): Promise<void>;
  toEqual<E>(expected: E): Promise<void>;
  toEqualTypeOf<_Expected>(): Promise<void>;
  toHaveBeenCalled(): Promise<void>;
  toBeCalled(): Promise<void>;
  toHaveBeenCalledExactlyOnceWith<E extends MockParameters<T>>(...args: E): Promise<void>;
  toHaveBeenCalledTimes(times: number): Promise<void>;
  toBeCalledTimes(times: number): Promise<void>;
  toHaveBeenCalledWith<E extends MockParameters<T>>(...args: E): Promise<void>;
  toBeCalledWith<E extends MockParameters<T>>(...args: E): Promise<void>;
  toHaveBeenLastCalledWith<E extends MockParameters<T>>(...args: E): Promise<void>;
  lastCalledWith<E extends MockParameters<T>>(...args: E): Promise<void>;
  toHaveBeenNthCalledWith<E extends MockParameters<T>>(nthCall: number, ...args: E): Promise<void>;
  nthCalledWith<E extends MockParameters<T>>(nthCall: number, ...args: E): Promise<void>;
  toHaveLength(length: number): Promise<void>;
  toHaveProperty<E>(property: string | (string | number)[], value?: E): Promise<void>;
  toReturn(): Promise<void>;
  toHaveReturned(): Promise<void>;
  toReturnTimes(times: number): Promise<void>;
  toHaveReturnedTimes(times: number): Promise<void>;
  toReturnWith<E extends MockReturnValue<T> = MockReturnValue<T>>(value: E): Promise<void>;
  toHaveReturnedWith<E extends MockReturnValue<T> = MockReturnValue<T>>(value: E): Promise<void>;
  lastReturnedWith<E extends MockReturnValue<T> = MockReturnValue<T>>(value: E): Promise<void>;
  toHaveLastReturnedWith<E extends MockReturnValue<T> = MockReturnValue<T>>(
    value: E
  ): Promise<void>;
  nthReturnedWith<E extends MockReturnValue<T> = MockReturnValue<T>>(
    nthCall: number,
    value: E
  ): Promise<void>;
  toHaveNthReturnedWith<E extends MockReturnValue<T> = MockReturnValue<T>>(
    nthCall: number,
    value: E
  ): Promise<void>;
  toMatch(expected: string | RegExp): Promise<void>;
  toMatchFileSnapshot(filepath: string, message?: string): Promise<void>;
  toMatchInlineSnapshot(): Promise<void>;
  toMatchInlineSnapshot(snapshot: string): Promise<void>;
  toMatchInlineSnapshot(properties: Any, snapshot?: string): Promise<void>;
  toMatchObject<E extends object | Any[]>(expected: E): Promise<void>;
  toMatchSnapshot(message?: string): Promise<void>;
  toMatchSnapshot(properties: Any, message?: string): Promise<void>;
  toMatchTypeOf<_Expected>(): Promise<void>;
  toPass(options?: { interval?: number; timeout?: number }): Promise<void>;
  toStrictEqual<E>(expected: E): Promise<void>;
  toThrow(
    expected?: string | (abstract new (...args: Any[]) => Any) | RegExp | Error
  ): Promise<void>;
  toThrowError(
    expected?: string | (abstract new (...args: Any[]) => Any) | RegExp | Error
  ): Promise<void>;
  toThrowErrorMatchingInlineSnapshot: Matcher;
  toThrowErrorMatchingSnapshot: Matcher;
  toHaveBeenCalledOnce(): Promise<void>;
  toSatisfy<E>(matcher: (value: E) => boolean, message?: string): Promise<void>;
  toBeOneOf<E>(sample: E[]): Promise<void>;
  resolves: Assertion<T>;
  rejects: Assertion<T>;
  not: Assertion<T>;
}

export interface Expect {
  <T>(actual: T, message?: string): Assertion<T>;
  unreachable(message?: string): Promise<never>;
  soft<T>(actual: T, message?: string): Assertion<T>;
  extend(expects: Record<string, CustomMatcher> & ThisType<MatcherState>): void;
  assertions(expected: number): Promise<void>;
  hasAssertions(): Promise<void>;
  anything(): Any;
  any(constructor: Any): Any;
  arrayContaining<T = Any>(array: T[]): Any;
  objectContaining<T = Any>(object: T): Any;
  stringContaining(expected: string): Any;
  stringMatching(expected: RegExp | string): Any;
  closeTo(expected: number, precision?: number): Any;
  toSatisfy(matcher: (value: Any) => boolean, message?: string): Any;
  toBeOneOf<T>(sample: T[]): Any;
  getState(): MatcherState;
  setState(state: Partial<MatcherState>): void;
  not: AsymmetricMatchers;
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
