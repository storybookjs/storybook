import type { Mock, MockInstance } from '@vitest/spy';
import {
  type MaybeMocked,
  type MaybeMockedDeep,
  type MaybePartiallyMocked,
  type MaybePartiallyMockedDeep,
  isMockFunction,
  mocks,
  fn as vitestFn,
  spyOn as vitestSpyOn,
} from '@vitest/spy';
import type { SpyInternalImpl } from 'tinyspy';
import * as tinyspy from 'tinyspy';

export type * from '@vitest/spy';

export { isMockFunction, mocks };

/**
 * Global registry for module mock spies created by `sb.mock('...', { spy: true })`.
 *
 * These spies are created by the module mocker (via `__vitest_mocker__.mockObject()`) and may use a
 * different `@vitest/spy` instance than the one bundled with storybook/test. This means they won't
 * appear in the `mocks` Set that `clearAllMocks`/`resetAllMocks`/`restoreAllMocks` iterate over.
 *
 * The automock code generation registers spies here so they can be properly cleared between
 * stories.
 */
const moduleMockSpies: Set<MockInstance> = ((globalThis as any).__STORYBOOK_MODULE_MOCK_SPIES__ ??=
  new Set<MockInstance>());

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

type Procedure = (...args: any[]) => any;

export function fn<T extends Procedure = Procedure>(implementation?: T): Mock<T>;
export function fn(implementation?: Procedure) {
  const mock = implementation ? vitestFn(implementation) : vitestFn();
  return reactiveMock(mock);
}

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
 * Calls [`.mockClear()`](https://vitest.dev/api/mock#mockclear) on every mocked function. This will
 * only empty `.mock` state, it will not reset implementation.
 *
 * It is useful if you need to clean up mock between different assertions.
 */
export function clearAllMocks() {
  mocks.forEach((spy) => spy.mockClear());
  moduleMockSpies.forEach((spy) => spy.mockClear());
}

/**
 * Calls [`.mockReset()`](https://vitest.dev/api/mock#mockreset) on every mocked function. This will
 * empty `.mock` state, reset "once" implementations and force the base implementation to return
 * `undefined` when invoked.
 *
 * This is useful when you want to completely reset a mock to the default state.
 */
export function resetAllMocks() {
  mocks.forEach((spy) => spy.mockReset());
  moduleMockSpies.forEach((spy) => spy.mockReset());
}

/**
 * Calls [`.mockRestore()`](https://vitest.dev/api/mock#mockrestore) on every mocked function. This
 * will restore all original implementations.
 */
export function restoreAllMocks() {
  mocks.forEach((spy) => spy.mockRestore());
  // For module mock spies, we only clear call history (not restore), because:
  // - mockRestore() would try to undo the spyOn on the module export object, which is not
  //   meaningful for automocked modules where the spy reference is captured at module load time
  // - The spy needs to remain active for subsequent stories
  moduleMockSpies.forEach((spy) => spy.mockClear());
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
