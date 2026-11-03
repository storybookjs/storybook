import { beforeEach, expect, it, vi } from 'vitest';

import type { Mock } from '@vitest/spy';

import { fn, mocks, onMockCall, resetAllMocks, restoreAllMocks, spyOn } from './spy.ts';

const vitestSpy = vi.fn();

beforeEach(() => {
  vitestSpy.mockClear();
  const unsubscribe = onMockCall(vitestSpy);
  return () => unsubscribe();
});

it('mocks are reactive', () => {
  const storybookSpy = fn();
  storybookSpy(1);
  expect(vitestSpy).toHaveBeenCalledWith(storybookSpy, [1]);
});

class Foo {
  bar = 'bar';

  transform(postfix: string) {
    return this.bar + postfix;
  }
}
const foo = new Foo();

it('this is correctly binded when making spies reactive', () => {
  const storybookSpy = spyOn(foo, 'transform');
  expect(foo.transform('!')).toEqual('bar!');
  expect(vitestSpy).toHaveBeenCalledWith(storybookSpy, ['!']);
});

it('this is correctly binded after mock implementation', () => {
  const storybookSpy = spyOn(foo, 'transform').mockImplementation(function (this: Foo) {
    return this.bar + 'mocked';
  });

  expect(foo.transform('!')).toEqual('barmocked');
  expect(vitestSpy).toHaveBeenCalledWith(storybookSpy, ['!']);
});

it('keeps notifying after the call history is cleared or reset', () => {
  const storybookSpy = fn();
  storybookSpy.mockClear();
  storybookSpy(1);
  storybookSpy.mockReset();
  storybookSpy(2);
  expect(vitestSpy.mock.calls).toEqual([
    [storybookSpy, [1]],
    [storybookSpy, [2]],
  ]);
  expect(storybookSpy.mock.calls).toEqual([[2]]);
});

it('notifies once per call, also when an existing mock is spied on again', () => {
  const target = { method: () => 'value' };
  const first = spyOn(target, 'method');
  const second = spyOn(target, 'method');
  target.method();
  expect(second).toBe(first);
  expect(vitestSpy).toHaveBeenCalledTimes(1);
});

it('notifies when a mocked class is constructed', () => {
  const MockedClass = fn(
    class {
      constructor(readonly value: string) {}
    }
  );
  const instance = new MockedClass('value');
  expect(instance.value).toBe('value');
  expect(vitestSpy).toHaveBeenCalledWith(MockedClass, ['value']);
});

it('notifies before the implementation runs', () => {
  const order: string[] = [];
  const unsubscribe = onMockCall(() => order.push('listener'));
  fn(() => order.push('implementation'))();
  unsubscribe();
  expect(order).toEqual(['listener', 'implementation']);
});

it('keeps generic implementations generic', () => {
  const identity = fn(<T>(value: T) => value);
  const text: string = identity('value');
  const count: number = identity(1);
  expect([text, count]).toEqual(['value', 1]);
});

it('creates reactive, named module mocks for the module mocker runtime', () => {
  const createMockInstance = (
    globalThis as typeof globalThis & {
      __STORYBOOK_CREATE_MOCK_INSTANCE__: (options: {
        name: string;
        originalImplementation?: (...args: any[]) => any;
      }) => Mock<() => string>;
    }
  ).__STORYBOOK_CREATE_MOCK_INSTANCE__;

  const moduleSpy = createMockInstance({ name: 'fetchData', originalImplementation: () => 'data' });
  expect(moduleSpy()).toBe('data');
  expect(moduleSpy.getMockName()).toBe('fetchData');
  expect(vitestSpy).toHaveBeenCalledWith(moduleSpy, []);

  moduleSpy.mockReset();
  expect(moduleSpy.getMockName()).toBe('fetchData');
});

it('keeps mock names when all mocks are reset or restored', () => {
  const named = fn(() => 'value').mockName('onClick');
  named();

  resetAllMocks();
  expect(named.getMockName()).toBe('onClick');
  expect(named.mock.calls).toEqual([]);
  expect(named()).toBe('value');

  restoreAllMocks();
  expect(named.getMockName()).toBe('onClick');
  expect(named.mock.calls).toEqual([]);
});

it('restores spied methods with restoreAllMocks', () => {
  const target = { method: () => 'original' };
  spyOn(target, 'method').mockReturnValue('mocked');
  expect(target.method()).toBe('mocked');
  restoreAllMocks();
  expect(target.method()).toBe('original');
  expect(mocks.size).toBeGreaterThan(0);
});
