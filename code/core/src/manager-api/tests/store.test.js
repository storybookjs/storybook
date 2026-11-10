import { describe, expect, it, vi } from 'vitest';

import flushPromises from 'flush-promises';
import store2 from 'store2';

import Store, { STORAGE_KEY } from '../store';

vi.mock('store2', () => ({
  default: {
    local: {
      set: vi.fn(),
      get: vi.fn(),
    },
    session: {
      set: vi.fn(),
      get: vi.fn(),
    },
    _: { fn: () => {} },
  },
}));

describe('store', () => {
  it('sensibly combines local+session storage for initial state', () => {
    store2.session.get.mockReturnValueOnce({ foo: 'bar', combined: { a: 'b' } });
    store2.local.get.mockReturnValueOnce({ foo: 'baz', another: 'value', combined: { c: 'd' } });

    const store = new Store({});
    expect(store.getInitialState()).toEqual({
      foo: 'bar',
      another: 'value',
      // We don't combine subfields from the two sources.
      combined: { a: 'b' },
    });
  });

  it('omits v10.3 tag filters from local storage and deletes them', () => {
    store2.local.get.mockReturnValueOnce({
      includedTagFilters: ['legacy'],
      excludedTagFilters: ['blocked'],
      foo: 'local',
    });
    store2.session.get.mockReturnValueOnce({ bar: 'session' });

    const store = new Store({});
    expect(store.getInitialState()).toEqual({
      foo: 'local',
      bar: 'session',
    });
    expect(store2.local.set).toHaveBeenCalledWith(STORAGE_KEY, { foo: 'local' });
  });

  it('leaves local storage untouched when it holds no v10.3 tag filters', () => {
    store2.local.get.mockReturnValueOnce({ foo: 'local' });
    store2.session.get.mockReturnValueOnce({});

    new Store({}).getInitialState();
    expect(store2.local.set).not.toHaveBeenCalled();
  });

  it('passes getState right through', () => {
    const getState = vi.fn();
    const store = new Store({ getState });

    store.getState();

    expect(getState).toHaveBeenCalled();
  });

  describe('setState', () => {
    it('sets values in React only by default', async () => {
      const setState = vi.fn().mockImplementation((x, cb) => cb());
      const getState = vi.fn();
      const store = new Store({ setState, getState });

      await store.setState({ foo: 'bar' });

      expect(setState).toHaveBeenCalledWith({ foo: 'bar' }, expect.any(Function));
      expect(store2.session.set).not.toHaveBeenCalled();
      expect(store2.local.set).not.toHaveBeenCalled();
    });

    it('sets values in React and sessionStorage if persistence === session', async () => {
      const setState = vi.fn().mockImplementation((x, cb) => cb());
      const getState = vi.fn();
      const store = new Store({ setState, getState });

      await store.setState({ foo: 'bar' }, { persistence: 'session' });

      expect(setState).toHaveBeenCalledWith({ foo: 'bar' }, expect.any(Function));
      expect(store2.session.set).toHaveBeenCalledWith(STORAGE_KEY, { foo: 'bar' });
      expect(store2.local.set).not.toHaveBeenCalled();
    });

    it('sets values in React and sessionStorage if persistence === permanent', async () => {
      const setState = vi.fn().mockImplementation((x, cb) => cb());
      const getState = vi.fn();
      const store = new Store({ setState, getState });

      await store.setState({ foo: 'bar' }, { persistence: 'permanent' });

      expect(setState).toHaveBeenCalledWith({ foo: 'bar' }, expect.any(Function));
      expect(store2.session.set).not.toHaveBeenCalled();
      expect(store2.local.set).toHaveBeenCalledWith(STORAGE_KEY, { foo: 'bar' });
    });

    it('properly patches existing values', async () => {
      const setState = vi.fn().mockImplementation((x, cb) => cb());
      const getState = vi.fn();
      store2.session.get.mockReturnValueOnce({
        foo: 'baz',
        another: 'value',
        combined: { a: 'b' },
      });
      const store = new Store({ setState, getState });

      await store.setState({ foo: 'bar', combined: { c: 'd' } }, { persistence: 'session' });

      expect(setState).toHaveBeenCalledWith(
        { foo: 'bar', combined: { c: 'd' } },
        expect.any(Function)
      );
      expect(store2.session.set).toHaveBeenCalledWith(STORAGE_KEY, {
        foo: 'bar',
        another: 'value',
        combined: { c: 'd' },
      });
    });

    it('waits for react to setState', async () => {
      let cb;
      const setState = vi.fn().mockImplementation((x, inputCb) => {
        cb = inputCb;
      });
      const getState = vi.fn();
      const store = new Store({ setState, getState });

      // NOTE: not awaiting here
      let done = false;
      store.setState({ foo: 'bar' }).then(() => {
        done = true;
      });

      await flushPromises();
      expect(setState).toHaveBeenCalledWith({ foo: 'bar' }, expect.any(Function));
      expect(done).toBe(false);

      cb();
      await flushPromises();
      expect(done).toBe(true);
    });

    it('returns react.setState result', async () => {
      const setState = vi.fn().mockImplementation((x, cb) => cb('RESULT'));
      const getState = vi.fn(() => 'RESULT');
      const store = new Store({ setState, getState });

      const result = await store.setState({ foo: 'bar' });

      expect(result).toEqual('RESULT');
    });

    it('allows a callback', async () =>
      new Promise((resolve) => {
        const setState = vi.fn().mockImplementation((x, cb) => cb('RESULT'));
        const getState = vi.fn(() => 'RESULT');
        const store = new Store({ setState, getState });

        store.setState({ foo: 'bar' }, (result) => {
          expect(result).toEqual('RESULT');
          resolve();
        });
      }));

    it('allows a patch function and persists its results', async () => {
      const setState = vi.fn().mockImplementation((x, cb) => cb());
      const getState = vi.fn().mockReturnValue({ foo: 'OLD' });
      const store = new Store({ setState, getState });

      const patch = vi.fn().mockReturnValue({ foo: 'bar' });
      await store.setState(patch, { persistence: 'session' });

      expect(patch).toHaveBeenCalledWith({ foo: 'OLD' });
      expect(setState).toHaveBeenCalledWith({ foo: 'bar' }, expect.any(Function));
      expect(store2.session.set).toHaveBeenCalledWith(STORAGE_KEY, { foo: 'bar' });
    });
  });

  describe('writes the upstream has not committed yet', () => {
    // Mimics React: patches are queued and committed later, callbacks run after the commit
    function createDeferredUpstream(initial) {
      let committed = initial;
      const queue = [];
      return {
        getState: () => committed,
        setState: (patch, cb) => queue.push({ patch, cb }),
        commit: () => {
          for (const { patch } of queue) {
            committed = { ...committed, ...patch };
          }
          queue.splice(0).forEach(({ cb }) => cb());
        },
      };
    }

    it('are visible to getState before the commit', () => {
      const upstream = createDeferredUpstream({ a: 1, b: 1 });
      const store = new Store(upstream);

      void store.setState({ a: 2 });

      expect(store.getState()).toEqual({ a: 2, b: 1 });
    });

    it('are not overwritten by a later write based on getState', async () => {
      const upstream = createDeferredUpstream({ list: ['old'], other: 0 });
      const store = new Store(upstream);

      const first = store.setState({ list: ['old', 'new'] });
      const { list } = store.getState();
      const second = store.setState({ list, other: 1 });
      upstream.commit();
      await Promise.all([first, second]);

      expect(upstream.getState()).toEqual({ list: ['old', 'new'], other: 1 });
      expect(store.getState()).toBe(upstream.getState());
    });

    it('are passed to patch functions', async () => {
      const upstream = createDeferredUpstream({ count: 0 });
      const store = new Store(upstream);

      const first = store.setState((s) => ({ count: s.count + 1 }));
      const second = store.setState((s) => ({ count: s.count + 1 }));
      upstream.commit();
      await Promise.all([first, second]);

      expect(store.getState()).toEqual({ count: 2 });
    });
  });
});
