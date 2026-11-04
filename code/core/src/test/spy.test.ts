import { beforeEach, expect, it, vi } from 'vitest';

import type { Mock } from '@vitest/spy';

import { logger } from 'storybook/internal/client-logger';

import { mockObject } from '@vitest/mocker';

import {
  clearAllMocks,
  fn,
  mocks,
  onMockCall,
  resetAllMocks,
  restoreAllMocks,
  spyOn,
} from './spy.ts';

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

type CreateMockInstance = (options: {
  name?: string;
  originalImplementation?: (...args: any[]) => any;
}) => Mock<(...args: any[]) => any>;
const createModuleMock = (
  globalThis as typeof globalThis & { __STORYBOOK_CREATE_MOCK_INSTANCE__: CreateMockInstance }
).__STORYBOOK_CREATE_MOCK_INSTANCE__;

it('creates reactive, named module mocks for the module mocker runtime', () => {
  const moduleSpy = createModuleMock({ name: 'fetchData', originalImplementation: () => 'data' });
  expect(moduleSpy()).toBe('data');
  expect(moduleSpy.getMockName()).toBe('fetchData');
  expect(vitestSpy).toHaveBeenCalledWith(moduleSpy, []);

  moduleSpy.mockReset();
  expect(moduleSpy.getMockName()).toBe('fetchData');

  // An anonymous export keeps the default name, so its calls are not logged as actions.
  expect(createModuleMock({ name: '' }).getMockName()).toBe('vi.fn()');
});

it('resets module mocks, including nested ones and those of class instances', () => {
  class Service {
    get() {
      return 'real';
    }
  }
  const mocked = mockObject(
    {
      type: 'automock',
      globalConstructors: { Object, Function, Array, Map, RegExp },
      createMockInstance: createModuleMock as never,
    },
    { __esModule: true, fetchData: () => 'data', api: { get: () => 'data' }, Service }
  ) as {
    fetchData: Mock<() => string>;
    api: { get: Mock<() => string> };
    Service: new () => { get: Mock<() => string> };
  };
  const instance = new mocked.Service();
  for (const mock of [mocked.fetchData, mocked.api.get, instance.get]) {
    mock.mockReturnValue('mocked');
    mock();
  }

  clearAllMocks();
  expect([mocked.fetchData, mocked.api.get, instance.get].map((mock) => mock.mock.calls)).toEqual([
    [],
    [],
    [],
  ]);

  restoreAllMocks();
  expect([mocked.fetchData(), mocked.api.get(), instance.get()]).toEqual([
    undefined,
    undefined,
    undefined,
  ]);
});

const automockService = () => {
  class Service {
    get(key: string) {
      return key;
    }
  }
  return mockObject(
    {
      type: 'automock',
      globalConstructors: { Object, Function, Array, Map, RegExp },
      createMockInstance: createModuleMock as never,
    },
    { __esModule: true, Service }
  ).Service as Mock<new () => { get: Mock<(key: string) => string> }> & {
    prototype: { get: Mock<(key: string) => string> };
  };
};

it('resets the mocks of class instances after the class mock is cleared', () => {
  const Service = automockService();
  const service = new Service();
  service.get.mockReturnValue('changed');
  service.get('key');

  Service.mockClear();
  restoreAllMocks();

  expect(service.get('key')).toBeUndefined();
  expect(service.get.mock.calls).toEqual([['key']]);
});

it('notifies calls of class instance members as calls of the prototype member', () => {
  const Service = automockService();
  const service = new Service();
  vitestSpy.mockClear();

  service.get('key');

  expect(vitestSpy).toHaveBeenCalledWith(Service.prototype.get, ['key']);
});

it('names a mock after its named implementation', () => {
  expect(fn(function save() {}).getMockName()).toBe('save');
  expect(fn().getMockName()).toBe('vi.fn()');
});

it('keeps the name of a mock passed to fn', () => {
  const onClick = fn().mockName('onClick');
  expect(fn(onClick)).toBe(onClick);
  expect(onClick.getMockName()).toBe('onClick');
  expect(fn(fn()).getMockName()).toBe('vi.fn()');
});

it('keeps recording the call when a listener throws', () => {
  const unsubscribe = onMockCall(() => {
    throw new Error('listener failed');
  });
  const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
  const mock = fn(() => 'value');

  expect(mock()).toBe('value');
  unsubscribe();

  expect(mock.mock.results).toEqual([{ type: 'return', value: 'value' }]);
  expect(error).toHaveBeenCalledWith(new Error('listener failed'));
});

it('types the return value of fn as the mock of a function', () => {
  const mock: ReturnType<typeof fn> = fn();
  mock();
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
});
