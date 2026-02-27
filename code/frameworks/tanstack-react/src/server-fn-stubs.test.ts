import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isMockFunction } from 'storybook/test';

import { createServerFnStub, resetAllServerFnStubs } from './server-fn-stubs';

describe('server-fn-stubs', () => {
  beforeEach(() => {
    // Clear the registry before each test
    resetAllServerFnStubs();
    vi.clearAllMocks();
  });

  describe('createServerFnStub', () => {
    it('returns a mock function from storybook/test', () => {
      const stub = createServerFnStub();
      expect(isMockFunction(stub)).toBe(true);
    });

    it('registers the stub in the global registry', () => {
      const stub1 = createServerFnStub();
      createServerFnStub();

      // After creating stubs, resetting should affect them
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      stub1();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('was called without a mock implementation')
      );
      warnSpy.mockRestore();
    });

    it('applies default implementation that warns', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const stub = createServerFnStub();

      const result = stub();

      expect(result).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        '[@storybook/tanstack-react] a server function was called without a mock implementation.'
      );
      warnSpy.mockRestore();
    });

    it('includes function name in warning when provided', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const stub = createServerFnStub('getTodos');

      stub();

      expect(warnSpy).toHaveBeenCalledWith(
        '[@storybook/tanstack-react] "getTodos" was called without a mock implementation.'
      );
      warnSpy.mockRestore();
    });

    it('allows overriding the default implementation', () => {
      const stub = createServerFnStub('getData');
      stub.mockImplementation(() => ({ data: 'mocked' }));

      const result = stub();

      expect(result).toEqual({ data: 'mocked' });
    });

    it('supports multiple stubs with different names', () => {
      const getTodos = createServerFnStub('getTodos');
      const getUsers = createServerFnStub('getUsers');

      getTodos.mockImplementation(() => ['todo1']);
      getUsers.mockImplementation(() => ['user1']);

      expect(getTodos()).toEqual(['todo1']);
      expect(getUsers()).toEqual(['user1']);
    });

    it('supports calling the stub multiple times', () => {
      const stub = createServerFnStub('getData');
      stub.mockImplementation(() => 42);

      expect(stub()).toBe(42);
      expect(stub()).toBe(42);
      expect(stub).toHaveBeenCalledTimes(2);
    });

    it('works with async implementations', async () => {
      const stub = createServerFnStub('fetchData');
      stub.mockImplementation(async () => ({ data: 'async result' }));

      const result = await stub();

      expect(result).toEqual({ data: 'async result' });
    });
  });

  describe('resetAllServerFnStubs', () => {
    it('clears all mock call history', () => {
      const stub1 = createServerFnStub('fn1');
      const stub2 = createServerFnStub('fn2');

      stub1.mockImplementation(() => 1);
      stub2.mockImplementation(() => 2);

      stub1();
      stub2();

      expect(stub1).toHaveBeenCalledTimes(1);
      expect(stub2).toHaveBeenCalledTimes(1);

      resetAllServerFnStubs();

      expect(stub1).toHaveBeenCalledTimes(0);
      expect(stub2).toHaveBeenCalledTimes(0);
    });

    it('reapplies the default warn implementation', () => {
      const stub = createServerFnStub('getData');
      stub.mockImplementation(() => 'custom');

      // Before reset, should return custom value
      expect(stub()).toBe('custom');

      resetAllServerFnStubs();

      // After reset, should warn and return undefined
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = stub();

      expect(result).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        '[@storybook/tanstack-react] "getData" was called without a mock implementation.'
      );
      warnSpy.mockRestore();
    });

    it('resets multiple stubs', () => {
      const stub1 = createServerFnStub('fn1');
      const stub2 = createServerFnStub('fn2');
      const stub3 = createServerFnStub('fn3');

      stub1.mockImplementation(() => 1);
      stub2.mockImplementation(() => 2);
      stub3.mockImplementation(() => 3);

      stub1();
      stub2();
      stub3();

      expect(stub1).toHaveBeenCalledTimes(1);
      expect(stub2).toHaveBeenCalledTimes(1);
      expect(stub3).toHaveBeenCalledTimes(1);

      resetAllServerFnStubs();

      expect(stub1).toHaveBeenCalledTimes(0);
      expect(stub2).toHaveBeenCalledTimes(0);
      expect(stub3).toHaveBeenCalledTimes(0);
    });

    it('resets stubs with no name', () => {
      const stub = createServerFnStub();
      stub.mockImplementation(() => 'value');

      stub();
      expect(stub).toHaveBeenCalledTimes(1);

      resetAllServerFnStubs();

      expect(stub).toHaveBeenCalledTimes(0);
    });

    it('preserves stub references across resets', () => {
      const stub = createServerFnStub('getData');
      const ref1 = stub;

      resetAllServerFnStubs();

      const ref2 = stub;

      expect(ref1).toBe(ref2);
    });
  });

  describe('integration scenarios', () => {
    it('simulates story lifecycle', () => {
      const getTodos = createServerFnStub('getTodos');

      // After registering but before mocking
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      getTodos();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();

      // Story setup: mock the function
      getTodos.mockImplementation(() => [{ id: 1, text: 'Learn Storybook' }]);

      // Story execution
      const result = getTodos();
      expect(result).toEqual([{ id: 1, text: 'Learn Storybook' }]);
      expect(getTodos).toHaveBeenCalledTimes(1);

      // Story teardown: reset stubs
      resetAllServerFnStubs();

      // Verify reset
      const warnSpy2 = vi.spyOn(console, 'warn').mockImplementation(() => {});
      getTodos();
      expect(warnSpy2).toHaveBeenCalled();
      warnSpy2.mockRestore();
    });

    it('handles multiple stubs in a single story', () => {
      const getTodos = createServerFnStub('getTodos');
      const addTodo = createServerFnStub('addTodo');

      getTodos.mockImplementation(() => []);
      addTodo.mockImplementation(({ data }: { data: string }) => ({
        id: 1,
        text: data,
      }));

      expect(getTodos()).toEqual([]);
      const newTodo = addTodo({ data: 'Buy milk' });
      expect(newTodo).toEqual({ id: 1, text: 'Buy milk' });

      // Verify multiple calls
      expect(getTodos).toHaveBeenCalledTimes(1);
      expect(addTodo).toHaveBeenCalledTimes(1);

      // Reset
      resetAllServerFnStubs();
      expect(getTodos).toHaveBeenCalledTimes(0);
      expect(addTodo).toHaveBeenCalledTimes(0);
    });

    it('tracks call arguments correctly', () => {
      const mutation = createServerFnStub('updateTodo');
      mutation.mockImplementation(({ id, text }: { id: number; text: string }) => ({
        id,
        text,
        updated: true,
      }));

      mutation({ id: 1, text: 'Updated' });
      mutation({ id: 2, text: 'Another' });

      expect(mutation).toHaveBeenCalledTimes(2);
      expect(mutation).toHaveBeenNthCalledWith(1, { id: 1, text: 'Updated' });
      expect(mutation).toHaveBeenNthCalledWith(2, { id: 2, text: 'Another' });
    });
  });
});
