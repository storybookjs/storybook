/**
 * Integration test fixtures demonstrating the server function mocking. These fixtures show what the
 * transform produces and how stubs behave.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createServerFnStub, resetAllServerFnStubs } from './server-fn-stubs';

describe('server-fn integration scenarios', () => {
  afterEach(() => {
    resetAllServerFnStubs();
  });

  describe('getTodos scenario (from sandbox)', () => {
    it('mocks getTodos for story use', () => {
      // Simulating what the Vite transform would produce:
      // Before: const getTodos = createServerFn({...}).handler(async () => ...)
      // After: const getTodos = createServerFnStub('getTodos')
      const getTodos = createServerFnStub('getTodos');

      // Story test: mock implementation
      getTodos.mockImplementation(() => [
        { id: 1, name: 'Get groceries' },
        { id: 2, name: 'Buy a new phone' },
      ]);

      // Component uses the stub
      const result = getTodos();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 1, name: 'Get groceries' });
    });
  });

  describe('addTodo scenario (from sandbox)', () => {
    it('mocks addTodo with input validation', () => {
      const addTodo = createServerFnStub('addTodo');

      addTodo.mockImplementation(({ data }: { data: string }) => ({
        id: 3,
        name: data,
      }));

      const result = addTodo({ data: 'Buy milk' });

      expect(result).toEqual({
        id: 3,
        name: 'Buy milk',
      });
      expect(addTodo).toHaveBeenCalledWith({ data: 'Buy milk' });
    });
  });

  describe('multiple server functions in one file', () => {
    it('handles getTodos and addTodo together', () => {
      const getTodos = createServerFnStub('getTodos');
      const addTodo = createServerFnStub('addTodo');

      getTodos.mockImplementation(() => []);
      addTodo.mockImplementation(({ data }: { data: string }) => ({
        id: 1,
        name: data,
      }));

      expect(getTodos()).toEqual([]);
      expect(addTodo({ data: 'task' })).toEqual({ id: 1, name: 'task' });
    });
  });

  describe('getPunkSongs scenario', () => {
    it('mocks getPunkSongs server function', () => {
      const getPunkSongs = createServerFnStub('getPunkSongs');

      getPunkSongs.mockImplementation(() => [
        { id: 1, name: 'Teenage Dirtbag', artist: 'Wheatus' },
        { id: 2, name: 'Smells Like Teen Spirit', artist: 'Nirvana' },
      ]);

      const songs = getPunkSongs();

      expect(songs).toHaveLength(2);
      expect(songs[0].artist).toBe('Wheatus');
    });
  });

  describe('async mock implementations', () => {
    it('supports async server functions', async () => {
      const fetchData = createServerFnStub('fetchData');

      fetchData.mockImplementation(async () => ({
        data: 'async result',
        timestamp: Date.now(),
      }));

      const result = await fetchData();

      expect(result.data).toBe('async result');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('reset between stories', () => {
    it('story setup -> test -> teardown -> reset', () => {
      const fn = createServerFnStub('getData');

      // Story 1 setup
      fn.mockImplementation(() => 'story1-data');
      expect(fn()).toBe('story1-data');
      expect(fn).toHaveBeenCalledTimes(1);

      // Story 1 teardown (reset)
      resetAllServerFnStubs();

      // Verify reset
      expect(fn).toHaveBeenCalledTimes(0);

      // Story 2 setup with same stub name
      fn.mockImplementation(() => 'story2-data');
      expect(fn()).toBe('story2-data');
    });
  });

  describe('default behavior without mock', () => {
    it('warns when called without mock implementation', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fn = createServerFnStub('unmockedFn');

      // Reset first to apply default impl
      resetAllServerFnStubs();

      const result = fn();

      expect(result).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unmockedFn'));

      warnSpy.mockRestore();
    });
  });
});
