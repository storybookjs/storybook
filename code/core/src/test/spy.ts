import type { MockInstance } from '@vitest/spy';
import {
  type MaybeMocked,
  type MaybeMockedDeep,
  type MaybePartiallyMocked,
  type MaybePartiallyMockedDeep,
  createMockInstance as VitestSpyCreateMockInstance,
  isMockFunction,
  fn as vitestFn,
  spyOn as vitestSpyOn,
} from '@vitest/spy';
import * as vitestSpy from '@vitest/spy';

export type * from '@vitest/spy';

export { isMockFunction, vitestSpyOn as spyOn, vitestFn as fn };

type Listener = (mock: MockInstance, args: unknown[]) => void;
const listeners = new Set<Listener>();

let mocks = new Set<MockInstance>();

export function onMockCall(callback: Listener): () => void {
  listeners.add(callback);
  return () => void listeners.delete(callback);
}

export const createMockInstance: typeof VitestSpyCreateMockInstance = (...args) => {
  const mock = VitestSpyCreateMockInstance(...args);
  mocks.add(mock);
  return mock;
};

/**
 * Calls [`.mockClear()`](https://vitest.dev/api/mock#mockclear) on every mocked function. This will
 * only empty `.mock` state, it will not reset implementation.
 *
 * It is useful if you need to clean up mock between different assertions.
 */
export function clearAllMocks() {
  if (mocks) {
    mocks.forEach((spy) => spy.mockClear());
    mocks = new Set<MockInstance>();
  } else {
    vitestSpy.clearAllMocks();
  }
}

/**
 * Calls [`.mockReset()`](https://vitest.dev/api/mock#mockreset) on every mocked function. This will
 * empty `.mock` state, reset "once" implementations and force the base implementation to return
 * `undefined` when invoked.
 *
 * This is useful when you want to completely reset a mock to the default state.
 */
export function resetAllMocks() {
  if (mocks) {
    mocks.forEach((spy) => spy.mockReset());
    mocks = new Set<MockInstance>();
  } else {
    vitestSpy.resetAllMocks();
  }
}

/**
 * Calls [`.mockRestore()`](https://vitest.dev/api/mock#mockrestore) on every mocked function. This
 * will restore all original implementations.
 */
export function restoreAllMocks() {
  if (mocks) {
    mocks.forEach((spy) => spy.mockRestore());
    mocks = new Set<MockInstance>();
  } else {
    vitestSpy.restoreAllMocks();
  }
}

/**
 * Type helper for TypeScript. Just returns the object that was passed.
 *
 * When `partial` is `true` it will expect a `Partial<T>` as a return value. By default, this will
 * only make TypeScript believe that the first level values are mocked. You can pass down `{ deep:
 * true }` as a second argument to tell TypeScript that the whole object is mocked, if it actually
 * is.
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
