import type { Mock, MockInstance } from '@vitest/spy';
import {
  type MaybeMocked,
  type MaybeMockedDeep,
  type MaybePartiallyMocked,
  type MaybePartiallyMockedDeep,
  isMockFunction,
  fn as vitestFn,
  spyOn as vitestSpyOn,
} from '@vitest/spy';
import * as vitestSpy from '@vitest/spy';

export type * from '@vitest/spy';

export { isMockFunction };

type Listener = (mock: MockInstance, args: unknown[]) => void;
const listeners = new Set<Listener>();

export function onMockCall(callback: Listener): () => void {
  listeners.add(callback);
  return () => void listeners.delete(callback);
}

// @ts-expect-error Make sure we export the exact same type as @vitest/spy
export const spyOn: typeof vitestSpyOn = (...args) => {
  const [obj, methodName, accessor] = args as [Record<string, unknown>, string, string | undefined];

  // Capture the original method before vitestSpyOn replaces it so our wrapper
  // can still call through to the original when no mockImplementation is set.
  const originalImpl =
    !accessor && typeof obj[methodName] === 'function'
      ? (obj[methodName] as (...args: any[]) => any)
      : undefined;

  const mock = vitestSpyOn(...(args as Parameters<typeof vitestSpyOn>));
  return reactiveMock(mock, originalImpl);
};

type Procedure = (...args: any[]) => any;

// WeakMaps that store per-mock state needed to intercept calls without
// relying on tinyspy internals (which Vitest 4's @vitest/spy no longer uses).
//
// spyImplToCallThrough: the "real" user-facing implementation that our
//   interceptor wrapper should delegate to after notifying listeners.
//   For fn(impl) this is impl; for spyOn() this is the original method
//   (captured before vitestSpyOn replaces it); for fn() this is undefined.
//
// spyRealMockImplementation: the original, unoverridden mockImplementation
//   method on the Mock object, captured before we replace it with our own
//   version in reactiveMock. Used so that listenWhenCalled can always reach
//   the real setter without accidentally calling our override recursively.
const spyImplToCallThrough = new WeakMap<MockInstance, ((...args: any[]) => any) | undefined>();
const spyRealMockImplementation = new WeakMap<MockInstance, MockInstance['mockImplementation']>();

export function fn<T extends Procedure = Procedure>(implementation?: T): Mock<T>;
export function fn(implementation?: Procedure) {
  const mock = implementation ? vitestFn(implementation) : vitestFn();
  return reactiveMock(mock);
}

function reactiveMock(mock: MockInstance, originalImpl?: (...args: any[]) => any) {
  // Guard: if this mock has already been made reactive (e.g. vitestSpyOn returned
  // an existing mock when called a second time on the same method), do not
  // re-initialise.  Re-initialising would overwrite spyRealMockImplementation with
  // our own override, breaking the recursion guard in listenWhenCalled.
  if (spyRealMockImplementation.has(mock)) {
    return mock;
  }

  // Save the real mockImplementation before we shadow it on the instance.
  spyRealMockImplementation.set(mock, mock.mockImplementation);

  // Determine what the wrapper should delegate to:
  //   • spyOn():     the captured original method
  //   • fn(impl):    getMockImplementation() returns impl
  //   • fn():        getMockImplementation() returns undefined
  const implToCallThrough =
    originalImpl !== undefined ? originalImpl : mock.getMockImplementation();
  spyImplToCallThrough.set(mock, implToCallThrough);

  listenWhenCalled(mock);

  // Override mockImplementation on the instance so that if the user later
  // calls .mockImplementation(fn), we update spyImplToCallThrough and
  // re-install our listener wrapper (rather than losing it).
  mock.mockImplementation = (fn) => {
    spyImplToCallThrough.set(mock, fn);
    return listenWhenCalled(mock);
  };

  return mock;
}

function listenWhenCalled(mock: MockInstance) {
  const impl = spyImplToCallThrough.get(mock);

  // Use the real (un-overridden) mockImplementation setter so we don't
  // recursively trigger our own override above.
  const setImpl = spyRealMockImplementation.get(mock) ?? mock.mockImplementation;

  setImpl.call(mock, function (this: unknown, ...args: unknown[]) {
    listeners.forEach((listener) => listener(mock, args));
    return impl?.apply(this, args);
  });

  return mock;
}

// This is needed for Vitest 3 compatibility purposes. The mocks object does not exist in Vitest 4,
// in favor of using functions directly like clearAllMocks, resetAllMocks, etc.
const getMocks: () => MockInstance[] | undefined = () => {
  // @ts-expect-error These will exist in Vitest 3
  return vitestSpy.mocks;
};

/**
 * Calls [`.mockClear()`](https://vitest.dev/api/mock#mockclear) on every mocked function. This will
 * only empty `.mock` state, it will not reset implementation.
 *
 * It is useful if you need to clean up mock between different assertions.
 */
export function clearAllMocks() {
  const mocks = getMocks();
  if (mocks) {
    mocks.forEach((spy) => spy.mockClear());
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
  const mocks = getMocks();
  if (mocks) {
    mocks.forEach((spy) => spy.mockReset());
  } else {
    vitestSpy.resetAllMocks();
  }
}

/**
 * Calls [`.mockRestore()`](https://vitest.dev/api/mock#mockrestore) on every mocked function. This
 * will restore all original implementations.
 */
export function restoreAllMocks() {
  const mocks = getMocks();
  if (mocks) {
    mocks.forEach((spy) => spy.mockRestore());
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
