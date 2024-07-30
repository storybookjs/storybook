/* eslint-disable @typescript-eslint/no-shadow */
import type { MockInstance } from '@vitest/spy';
import {
  spyOn as vitestSpyOn,
  isMockFunction,
  fn as vitestFn,
  mocks,
  type MaybeMocked,
  type MaybeMockedDeep,
  type MaybePartiallyMocked,
  type MaybePartiallyMockedDeep,
} from '@vitest/spy';
import type { SpyInternalImpl } from 'tinyspy';
import * as tinyspy from 'tinyspy';

export type * from '@vitest/spy';

export { isMockFunction, mocks };

type Listener = (mock: MockInstance, args: unknown[]) => void;
const listeners = new Set<Listener>();

export function onMockCall(callback: Listener): () => void {
  listeners.add(callback);
  return () => void listeners.delete(callback);
}

// @ts-expect-error Make sure we export the exact same type as @vitest/spy
export const spyOn: typeof vitestSpyOn = (...args) => {
  const mock = vitestSpyOn(...(args as Parameters<typeof vitestSpyOn>));
  return reactiveMock(mock);
};

// @ts-expect-error Make sure we export the exact same type as @vitest/spy
export const fn: typeof vitestFn = (implementation) => {
  const mock = implementation ? vitestFn(implementation) : vitestFn();
  return reactiveMock(mock);
};

function reactiveMock(mock: MockInstance) {
  const reactive = listenWhenCalled(mock);
  const originalMockImplementation = reactive.mockImplementation.bind(null);
  reactive.mockImplementation = (fn) => listenWhenCalled(originalMockImplementation(fn));
  return reactive;
}

function listenWhenCalled(mock: MockInstance) {
  const state = tinyspy.getInternalState(mock as unknown as SpyInternalImpl);
  const impl = state.impl;
  state.willCall(function (this: unknown, ...args) {
    listeners.forEach((listener) => listener(mock, args));
    return impl?.apply(this, args);
  });
  return mock;
}

/**
 * Calls [`.mockClear()`](https://vitest.dev/api/mock#mockclear) on every mocked function. This will only empty `.mock` state, it will not reset implementation.
 *
 * It is useful if you need to clean up mock between different assertions.
 */
export function clearAllMocks() {
  mocks.forEach((spy) => spy.mockClear());
}

/**
 * Calls [`.mockReset()`](https://vitest.dev/api/mock#mockreset) on every mocked function. This will empty `.mock` state, reset "once" implementations and force the base implementation to return `undefined` when invoked.
 *
 * This is useful when you want to completely reset a mock to the default state.
 */
export function resetAllMocks() {
  mocks.forEach((spy) => spy.mockReset());
}

/**
 * Calls [`.mockRestore()`](https://vitest.dev/api/mock#mockrestore) on every mocked function. This will restore all original implementations.
 */
export function restoreAllMocks() {
  mocks.forEach((spy) => spy.mockRestore());
}

/**
 * Type helper for TypeScript. Just returns the object that was passed.
 *
 * When `partial` is `true` it will expect a `Partial<T>` as a return value. By default, this will only make TypeScript believe that
 * the first level values are mocked. You can pass down `{ deep: true }` as a second argument to tell TypeScript that the whole object is mocked, if it actually is.
 *
 * @param item Anything that can be mocked
 * @param deep If the object is deeply mocked
 * @param options If the object is partially or deeply mocked
 */
export function mocked<T>(item: T, deep?: false): MaybeMocked<T>;
export function mocked<T>(item: T, deep: true): MaybeMockedDeep<T>;
export function mocked<T>(item: T, options: { partial?: false; deep?: false }): MaybeMocked<T>;
export function mocked<T>(item: T, options: { partial?: false; deep: true }): MaybeMockedDeep<T>;
export function mocked<T>(
  item: T,
  options: { partial: true; deep?: false }
): MaybePartiallyMocked<T>;
export function mocked<T>(
  item: T,
  options: { partial: true; deep: true }
): MaybePartiallyMockedDeep<T>;
export function mocked<T>(item: T): MaybeMocked<T>;
export function mocked<T>(item: T, _options = {}): MaybeMocked<T> {
  return item as any;
}
