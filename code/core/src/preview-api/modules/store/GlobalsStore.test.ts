import { describe, it, expect, vi } from 'vitest';
import { GlobalsStore } from './GlobalsStore';

vi.mock('@storybook/core/client-logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe('GlobalsStore', () => {
  it('is initialized to the value in globals', () => {
    const store = new GlobalsStore({
      globals: {
        arg1: 'arg1',
        arg2: 2,
        arg3: { complex: { object: ['type'] } },
      },
      globalTypes: {},
    });

    expect(store.get()).toEqual({
      arg1: 'arg1',
      arg2: 2,
      arg3: { complex: { object: ['type'] } },
    });
  });

  it('is initialized to the default values from globalTypes if global is unset', () => {
    const store = new GlobalsStore({
      globals: {
        arg1: 'arg1',
        arg2: 2,
      },
      globalTypes: {
        arg2: { defaultValue: 'arg2' },
        arg3: { defaultValue: { complex: { object: ['type'] } } },
      },
    });

    expect(store.get()).toEqual({
      // NOTE: we keep arg1, even though it doesn't have a globalArgType
      arg1: 'arg1',
      arg2: 2,
      arg3: { complex: { object: ['type'] } },
    });
  });

  describe('update', () => {
    it('changes the global args', () => {
      const store = new GlobalsStore({ globals: { foo: 'old' }, globalTypes: { baz: {} } });

      store.update({ foo: 'bar' });
      expect(store.get()).toEqual({ foo: 'bar' });

      store.update({ baz: 'bing' });
      expect(store.get()).toEqual({ foo: 'bar', baz: 'bing' });
    });

    it('does not merge objects', () => {
      const store = new GlobalsStore({
        globals: { obj: { foo: 'old' } },
        globalTypes: { baz: {} },
      });

      store.update({ obj: { foo: 'bar' } });
      expect(store.get()).toEqual({ obj: { foo: 'bar' } });

      store.update({ obj: { baz: 'bing' } });
      expect(store.get()).toEqual({ obj: { baz: 'bing' } });
    });
  });

  describe('updateFromPersisted', () => {
    it('only sets values for which globals or globalArgs exist', () => {
      const store = new GlobalsStore({
        globals: {
          arg1: 'arg1',
        },
        globalTypes: {
          arg2: { defaultValue: 'arg2' },
        },
      });

      store.updateFromPersisted({
        arg1: 'new-arg1',
        arg2: 'new-arg2',
        arg3: 'new-arg3',
      });

      expect(store.get()).toEqual({ arg1: 'new-arg1', arg2: 'new-arg2' });
    });
  });

  describe('second call to set', () => {
    it('is initialized to the (new) default values from globalTypes if the (new) global is unset', () => {
      const store = new GlobalsStore({ globals: {}, globalTypes: {} });

      expect(store.get()).toEqual({});

      store.set({
        globals: {
          arg1: 'arg1',
          arg2: 2,
        },
        globalTypes: {
          arg2: { defaultValue: 'arg2' },
          arg3: { defaultValue: { complex: { object: ['type'] } } },
        },
      });

      expect(store.get()).toEqual({
        // NOTE: we keep arg1, even though it doesn't have a globalArgType
        arg1: 'arg1',
        arg2: 2,
        arg3: { complex: { object: ['type'] } },
      });
    });

    describe('when underlying globals have not changed', () => {
      it('retains updated values, but not if they are undeclared', () => {
        const store = new GlobalsStore({
          globals: {
            arg1: 'arg1',
            arg2: 'arg2',
            arg3: 'arg3',
          },
          globalTypes: {
            arg2: { defaultValue: 'arg2' },
          },
        });

        store.update({
          arg1: 'new-arg1',
          arg2: 'new-arg2',
          arg3: 'new-arg3',
        });

        // You can set undeclared values (currently, deprecated)
        expect(store.get()).toEqual({ arg1: 'new-arg1', arg2: 'new-arg2', arg3: 'new-arg3' });

        store.set({
          globals: {
            arg1: 'arg1',
          },
          globalTypes: {
            arg2: { defaultValue: 'arg2' },
          },
        });
        // However undeclared values aren't persisted
        expect(store.get()).toEqual({ arg1: 'new-arg1', arg2: 'new-arg2' });
      });
    });

    describe('when underlying globals have changed', () => {
      it('retains a the same delta', () => {
        const store = new GlobalsStore({
          globals: {
            arg1: 'arg1',
            arg2: 'arg1',
            arg3: 'arg1',
            arg4: 'arg4',
          },
          globalTypes: {
            arg2: { defaultValue: 'arg2' },
          },
        });

        store.update({
          arg1: 'new-arg1',
          arg2: 'new-arg2',
          arg3: 'new-arg3',
        });

        expect(store.get()).toEqual({
          arg1: 'new-arg1',
          arg2: 'new-arg2',
          // You can set undeclared values (currently, deprecated)
          arg3: 'new-arg3',
          arg4: 'arg4',
        });

        store.set({
          globals: {
            arg1: 'edited-arg1',
            arg4: 'edited-arg4',
          },
          globalTypes: {
            arg5: { defaultValue: 'edited-arg5' },
          },
        });
        // However undeclared values aren't persisted
        expect(store.get()).toEqual({
          arg1: 'new-arg1',
          arg4: 'edited-arg4',
          arg5: 'edited-arg5',
        });
      });
    });
  });
});
