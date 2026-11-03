import type { MockInstance, MockInstanceOption } from '@vitest/spy';
import {
  type MaybeMocked,
  type MaybeMockedDeep,
  type MaybePartiallyMocked,
  type MaybePartiallyMockedDeep,
  type Constructable,
  type Mock as VitestMock,
  type Procedure,
  createMockInstance as vitestCreateMockInstance,
  isMockFunction,
  fn as vitestFn,
  spyOn as vitestSpyOn,
} from '@vitest/spy';

import { logger } from 'storybook/internal/client-logger';

export type * from '@vitest/spy';

export { isMockFunction };

/**
 * Every mock created through `fn()` and `spyOn()` of storybook/test.
 *
 * `@vitest/spy` stopped exporting its own registry in Vitest 4, so storybook/test keeps one, which
 * `clearAllMocks`/`resetAllMocks`/`restoreAllMocks` iterate over.
 */
export const mocks: Set<MockInstance> = new Set();

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
interface StorybookMockGlobals {
  __STORYBOOK_MODULE_MOCK_SPIES__?: Set<MockInstance>;
  /**
   * Used by the module mocker runtime (`mocking-utils/mocker-runtime.js`) to create the mocks of
   * automocked and autospied modules with this `@vitest/spy` instance, so they are reactive too.
   */
  __STORYBOOK_CREATE_MOCK_INSTANCE__?: (options?: MockInstanceOption) => MockInstance;
}

const storybookGlobals = globalThis as typeof globalThis & StorybookMockGlobals;

const moduleMockSpies: Set<MockInstance> = (storybookGlobals.__STORYBOOK_MODULE_MOCK_SPIES__ ??=
  new Set<MockInstance>());

type Listener = (mock: MockInstance, args: unknown[]) => void;
const listeners = new Set<Listener>();

export function onMockCall(callback: Listener): () => void {
  listeners.add(callback);
  return () => void listeners.delete(callback);
}

export const spyOn = ((...args: unknown[]) => {
  const mock = (vitestSpyOn as (...args: unknown[]) => MockInstance)(...args);
  mocks.add(mock);
  return reactiveMock(mock);
}) as typeof vitestSpyOn;

/**
 * The mock of a function, as `fn()` returns it. It keeps the shape of Vitest 3's `Mock`, which
 * storybook/test exported before: Vitest 4 made `Mock<T>` a conditional type, which TypeScript can
 * neither infer `T` from (e.g. from the type of the arg a `fn()` is assigned to) nor carry the type
 * parameters of a generic implementation through. It is assignable to Vitest's `Mock<T>` and back.
 */
export interface Mock<T extends Procedure = Procedure> extends MockInstance<T> {
  new (...args: Parameters<T>): ReturnType<T>;
  (...args: Parameters<T>): ReturnType<T>;
}

export function fn<T extends Procedure = Procedure>(implementation?: T): Mock<T>;
export function fn<T extends Constructable>(implementation: T): VitestMock<T>;
// Repeats the first overload last, so `ReturnType<typeof fn>` is the mock of a function.
export function fn<T extends Procedure = Procedure>(implementation?: T): Mock<T>;
export function fn(implementation?: Procedure | Constructable) {
  const mock = implementation ? vitestFn(implementation) : vitestFn();
  // Like before Vitest 4, a mock is named after its named implementation, e.g. in actions. Since
  // Vitest 4, `fn(mock)` returns that mock itself, which keeps its name.
  if (implementation?.name && !isMockFunction(implementation)) {
    mock.mockName(implementation.name);
  }
  mocks.add(mock);
  return reactiveMock(mock);
}

storybookGlobals.__STORYBOOK_CREATE_MOCK_INSTANCE__ = (options) => {
  // `resetToMockName` names the mock after the mocked function (like `spyOn` does), so calls of
  // module mocks show up as actions, and keeps that name when the mock is reset. Anonymous functions
  // keep the default name, which isn't logged.
  const mock = vitestCreateMockInstance({ ...options, resetToMockName: Boolean(options?.name) });
  // Registered like `fn()` and `spyOn()` mocks, so the helpers below reset them between stories,
  // including mocks of nested functions, which the automock code doesn't register.
  mocks.add(mock);
  if (options?.prototypeMembers?.length) {
    classMemberNames.set(mock, options.prototypeMembers);
  }
  return reactiveMock(mock);
};

/**
 * The prototype members of automocked classes. `@vitest/spy` mocks these members on every
 * constructed instance itself, past `__STORYBOOK_CREATE_MOCK_INSTANCE__`. (Their calls are also
 * recorded on the mocks of the prototype members, which are reactive.)
 */
const classMemberNames = new WeakMap<MockInstance, (string | symbol)[]>();

/** Adds the member mocks of the instances of automocked classes to `mocks`. */
function registerInstanceMemberMocks() {
  for (const mock of mocks) {
    const memberNames = classMemberNames.get(mock);
    if (!memberNames) {
      continue;
    }
    for (const instance of mock.mock.instances as (
      | Record<string | symbol, unknown>
      | undefined
    )[]) {
      for (const memberName of memberNames) {
        const member = instance?.[memberName];
        if (isMockFunction(member)) {
          mocks.add(member);
        }
      }
    }
  }
}

const reactiveMocks = new WeakSet<MockInstance>();

/**
 * Notifies the `onMockCall` listeners on every call of the mock, before its implementation runs.
 *
 * `@vitest/spy` has no call hook, but records every call with `mock.mock.calls.push(args)` before
 * invoking the implementation, and replaces the array on `mockClear()`. So every calls array gets
 * a non-enumerable `push` that notifies the listeners. Unlike wrapping the mock function, this
 * keeps the mock's identity, which `spyOn` relies on.
 */
function reactiveMock<T extends MockInstance>(mock: T): T {
  if (reactiveMocks.has(mock)) {
    return mock;
  }
  reactiveMocks.add(mock);

  const state = mock.mock;
  const notifyOnPush = (calls: unknown[][]) => {
    Object.defineProperty(calls, 'push', {
      configurable: true,
      enumerable: false,
      writable: true,
      value(...newCalls: unknown[][]) {
        const length = Array.prototype.push.apply(calls, newCalls);
        for (const args of newCalls) {
          listeners.forEach((listener) => {
            // The mock records its call after this push returns: a failing listener must not
            // leave the call half-recorded.
            try {
              listener(mock, args);
            } catch (error) {
              logger.error(error);
            }
          });
        }
        return length;
      },
    });
    return calls;
  };

  let calls = notifyOnPush(state.calls);
  Object.defineProperty(state, 'calls', {
    configurable: true,
    enumerable: true,
    get: () => calls,
    set: (newCalls: unknown[][]) => {
      calls = notifyOnPush(newCalls);
    },
  });
  return mock;
}

/**
 * Since Vitest 4, `mockReset()` also resets the name given with `mockName()`. Storybook names
 * mocks (e.g. after their arg) to log their calls as actions, so the bulk helpers keep that name.
 */
function keepingMockName(spy: MockInstance, reset: () => void) {
  const name = spy.getMockName();
  reset();
  spy.mockName(name);
}

/**
 * Calls [`.mockClear()`](https://vitest.dev/api/mock#mockclear) on every mocked function. This will
 * only empty `.mock` state, it will not reset implementation.
 *
 * It is useful if you need to clean up mock between different assertions.
 */
export function clearAllMocks() {
  registerInstanceMemberMocks();
  mocks.forEach((spy) => spy.mockClear());
  moduleMockSpies.forEach((spy) => spy.mockClear());
}

/**
 * Calls [`.mockReset()`](https://vitest.dev/api/mock#mockreset) on every mocked function. This will
 * empty `.mock` state, reset "once" implementations and reset the implementation to the original
 * one.
 *
 * This is useful when you want to completely reset a mock to the default state.
 */
export function resetAllMocks() {
  registerInstanceMemberMocks();
  mocks.forEach((spy) => keepingMockName(spy, () => spy.mockReset()));
  moduleMockSpies.forEach((spy) => keepingMockName(spy, () => spy.mockReset()));
}

/**
 * Calls [`.mockRestore()`](https://vitest.dev/api/mock#mockrestore) on every mocked function. This
 * will restore all original implementations.
 */
export function restoreAllMocks() {
  registerInstanceMemberMocks();
  // Module mocks created by storybook/test's module mocker are in `mocks` too. They have nothing to
  // restore, so `mockRestore()` resets them and they stay active for subsequent stories.
  mocks.forEach((spy) => keepingMockName(spy, () => spy.mockRestore()));
  // Module mock spies created by another `@vitest/spy` instance (e.g. Vitest's module mocker) only
  // get their call history cleared, because:
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
  return item as MaybeMocked<T>;
}
