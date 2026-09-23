import {
  isMockFunction as vitestIsMockFunction,
  mocks as vitestMocks,
  fn as vitestFn,
  spyOn as vitestSpyOn,
} from '@vitest/spy';
import type { MockInstance as VitestMockInstance } from '@vitest/spy';
import type { SpyInternalImpl } from 'tinyspy';
import * as tinyspy from 'tinyspy';

type Procedure = (...args: any[]) => any;
type MethodKeys<T> = keyof { [K in keyof T as T[K] extends Procedure ? K : never]: T[K] };
type ClassKeys<T> = keyof {
  [K in keyof T as T[K] extends abstract new (...args: any[]) => any ? K : never]: T[K];
};
type PropertyKeys<T> = {
  [K in keyof T]: T[K] extends Procedure ? never : K;
}[keyof T] &
  (string | symbol);

export interface MockResultReturn<T> {
  type: 'return';
  value: T;
}

export interface MockResultIncomplete {
  type: 'incomplete';
  value: undefined;
}

export interface MockResultThrow {
  type: 'throw';
  value: object;
}

export type MockResult<T> = MockResultReturn<T> | MockResultThrow | MockResultIncomplete;

export interface MockSettledResultFulfilled<T> {
  type: 'fulfilled';
  value: T;
}

export interface MockSettledResultRejected {
  type: 'rejected';
  value: object;
}

export type MockSettledResult<T> = MockSettledResultFulfilled<T> | MockSettledResultRejected;

export interface MockContext<T extends Procedure> {
  calls: Parameters<T>[];
  instances: ReturnType<T>[];
  contexts: ThisParameterType<T>[];
  invocationCallOrder: number[];
  results: MockResult<ReturnType<T>>[];
  settledResults: MockSettledResult<Awaited<ReturnType<T>>>[];
  lastCall: Parameters<T> | undefined;
}

export interface MockInstance<T extends Procedure = Procedure> {
  getMockName(): string;
  mockName(name: string): this;
  mock: MockContext<T>;
  mockClear(): this;
  mockReset(): this;
  mockRestore(): void;
  getMockImplementation(): ((...args: Parameters<T>) => ReturnType<T>) | undefined;
  mockImplementation(fn: (...args: Parameters<T>) => ReturnType<T>): this;
  mockImplementationOnce(fn: (...args: Parameters<T>) => ReturnType<T>): this;
  withImplementation<T2>(
    fn: (...args: Parameters<T>) => ReturnType<T>,
    cb: () => T2
  ): T2 extends Promise<unknown> ? Promise<this> : this;
  mockReturnThis(): this;
  mockReturnValue(value: ReturnType<T>): this;
  mockReturnValueOnce(value: ReturnType<T>): this;
  mockResolvedValue(value: Awaited<ReturnType<T>>): this;
  mockResolvedValueOnce(value: Awaited<ReturnType<T>>): this;
  mockRejectedValue(error: object): this;
  mockRejectedValueOnce(error: object): this;
}

export interface Mock<T extends Procedure = Procedure> extends MockInstance<T> {
  new (...args: Parameters<T>): ReturnType<T>;
  (...args: Parameters<T>): ReturnType<T>;
}

export interface PartialMock<T extends Procedure = Procedure> extends MockInstance<
  (
    ...args: Parameters<T>
  ) => ReturnType<T> extends Promise<Awaited<ReturnType<T>>>
    ? Promise<Partial<Awaited<ReturnType<T>>>>
    : Partial<ReturnType<T>>
> {
  new (...args: Parameters<T>): ReturnType<T>;
  (...args: Parameters<T>): ReturnType<T>;
}

export type MaybeMockedConstructor<T> = T extends abstract new (...args: never[]) => infer R
  ? Mock<(...args: ConstructorParameters<T>) => R>
  : T;
export type MockedFunction<T extends Procedure> = Mock<T> & { [K in keyof T]: T[K] };
export type PartiallyMockedFunction<T extends Procedure> = PartialMock<T> & {
  [K in keyof T]: T[K];
};
export type MockedObject<T> = MaybeMockedConstructor<T> & {
  [K in MethodKeys<T>]: T[K] extends Procedure ? MockedFunction<T[K]> : T[K];
} & { [K in PropertyKeys<T>]: T[K] };
export type MockedObjectDeep<T> = MaybeMockedConstructor<T> & {
  [K in MethodKeys<T>]: T[K] extends Procedure ? MockedFunctionDeep<T[K]> : T[K];
} & { [K in PropertyKeys<T>]: MaybeMockedDeep<T[K]> };
export type MockedFunctionDeep<T extends Procedure> = Mock<T> & MockedObjectDeep<T>;
export type PartiallyMockedFunctionDeep<T extends Procedure> = PartialMock<T> & MockedObjectDeep<T>;
export type MaybeMocked<T> = T extends Procedure
  ? MockedFunction<T>
  : T extends object
    ? MockedObject<T>
    : T;
export type MaybeMockedDeep<T> = T extends Procedure
  ? MockedFunctionDeep<T>
  : T extends object
    ? MockedObjectDeep<T>
    : T;
export type MaybePartiallyMocked<T> = T extends Procedure
  ? PartiallyMockedFunction<T>
  : T extends object
    ? MockedObject<T>
    : T;
export type MaybePartiallyMockedDeep<T> = T extends Procedure
  ? PartiallyMockedFunctionDeep<T>
  : T extends object
    ? MockedObjectDeep<T>
    : T;
export type MockedClass<T extends abstract new (...args: never[]) => object> = MockInstance<
  (...args: ConstructorParameters<T>) => InstanceType<T>
> & {
  prototype: T extends { prototype: infer P } ? Mocked<P> : never;
} & T;
export type Mocked<T> = {
  [P in keyof T]: T[P] extends Procedure
    ? MockInstance<T[P]>
    : T[P] extends abstract new (...args: never[]) => object
      ? MockedClass<T[P]>
      : T[P];
} & T;

export const mocks: Set<MockInstance> = vitestMocks as unknown as Set<MockInstance>;

export function isMockFunction(value: object): value is MockInstance {
  return vitestIsMockFunction(value);
}

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
const moduleMockSpies: Set<VitestMockInstance> = ((
  globalThis as any
).__STORYBOOK_MODULE_MOCK_SPIES__ ??= new Set<VitestMockInstance>());

type Listener = (mock: MockInstance, args: unknown[]) => void;
const listeners = new Set<Listener>();

export function onMockCall(callback: Listener): () => void {
  listeners.add(callback);
  return () => void listeners.delete(callback);
}

type SpyOn = {
  <T extends object, S extends PropertyKeys<Required<T>>>(
    obj: T,
    methodName: S,
    accessType: 'get'
  ): MockInstance<() => T[S]>;
  <T extends object, G extends PropertyKeys<Required<T>>>(
    obj: T,
    methodName: G,
    accessType: 'set'
  ): MockInstance<(arg: T[G]) => void>;
  <T extends object, M extends MethodKeys<Required<T>>>(
    obj: T,
    methodName: M
  ): T[M] extends Procedure ? MockInstance<T[M]> : never;
  <T extends object, M extends ClassKeys<Required<T>>>(
    obj: T,
    methodName: M
  ): T[M] extends abstract new (...args: infer A) => infer R
    ? MockInstance<(this: R, ...args: A) => R>
    : never;
};

export const spyOn = ((...args: Parameters<typeof vitestSpyOn>) => {
  const mock = vitestSpyOn(...args);
  return reactiveMock(mock) as unknown as MockInstance;
}) as SpyOn;

export function fn<T extends Procedure = Procedure>(implementation?: T): Mock<T>;
export function fn(implementation?: Procedure) {
  const mock = implementation ? vitestFn(implementation) : vitestFn();
  return reactiveMock(mock) as unknown as Mock;
}

function reactiveMock(mock: VitestMockInstance) {
  const reactive = listenWhenCalled(mock);
  const originalMockImplementation = reactive.mockImplementation.bind(null);
  reactive.mockImplementation = (fn) => listenWhenCalled(originalMockImplementation(fn));
  return reactive;
}

function listenWhenCalled(mock: VitestMockInstance) {
  const state = tinyspy.getInternalState(mock as unknown as SpyInternalImpl);
  const impl = state.impl;
  state.willCall(function (this: unknown, ...args) {
    listeners.forEach((listener) => listener(mock as unknown as MockInstance, args));
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
  return item as MaybeMocked<T>;
}
