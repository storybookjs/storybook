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
      const setState = vi.fn().mockImplementation((x, cb) => {
        x('OLD_STATE');
        cb();
      });
      const getState = vi.fn();
      const store = new Store({ setState, getState });

      const patch = vi.fn().mockReturnValue({ foo: 'bar' });
      await store.setState(patch, { persistence: 'session' });

      expect(patch).toHaveBeenCalledWith('OLD_STATE');
      expect(store2.session.set).toHaveBeenCalledWith(STORAGE_KEY, { foo: 'bar' });
    });
  });
});
