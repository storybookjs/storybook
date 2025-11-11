// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SET_CURRENT_STORY, STORY_RENDER_PHASE_CHANGED } from 'storybook/internal/core-events';

import { global } from '@storybook/global';

import { EVENTS } from './EVENTS';
import { Instrumenter, isClass } from './instrumenter';
import { addons } from './preview-api';
import type { Options } from './types';

const mocks = await vi.hoisted(async () => {
  const { Channel } = await import('storybook/internal/channels');
  const { EVENTS: INSTRUMENTER_EVENTS } = await import('./EVENTS');
  const { FORCE_REMOUNT } = await import('storybook/internal/core-events');

  const transport = {
    setHandler: () => {},
    send: () => {},
  };

  const channel = new Channel({ transport });

  const callSpy = vi.fn();
  const syncSpy = vi.fn();
  const forceRemountSpy = vi.fn();

  channel.on(INSTRUMENTER_EVENTS.CALL, callSpy);
  channel.on(INSTRUMENTER_EVENTS.SYNC, syncSpy);
  channel.on(FORCE_REMOUNT, forceRemountSpy);

  return {
    callSpy,
    syncSpy,
    forceRemountSpy,
    ready: vi.fn().mockResolvedValue(Promise.resolve(true)),
    channel,
  };
});

vi.mock('storybook/internal/client-logger');
vi.mock('./preview-api', () => {
  return {
    addons: {
      ready: mocks.ready,
      getChannel: vi.fn().mockImplementation(() => {
        return mocks.channel;
      }),
    },
  };
});

class HTMLElement {
  constructor(props: any) {
    Object.assign(this, props);
  }
}

// @ts-expect-error (global scope type conflicts)
delete global.location;
// @ts-expect-error (global scope type conflicts)
global.location = { reload: vi.fn() };
// @ts-expect-error (global scope type conflicts)
global.HTMLElement = HTMLElement;

const storyId = 'kind--story';
global.window.__STORYBOOK_PREVIEW__ = {
  selectionStore: { selection: { storyId, viewMode: 'story' } },
} as any;

const setRenderPhase = (newPhase: string) =>
  addons.getChannel().emit(STORY_RENDER_PHASE_CHANGED, { newPhase, storyId });

let instrumenter: Instrumenter;
const instrument = <TObj extends Record<string, any>>(obj: TObj, options: Options = {}) =>
  instrumenter.instrument(obj, options);

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(async () => {
  vi.useRealTimers();
  global.window.parent.__STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER_STATE__ = {};
  mocks.callSpy.mockClear();
  mocks.syncSpy.mockClear();
  mocks.forceRemountSpy.mockClear();
  mocks.ready.mockClear();
  instrumenter = new Instrumenter();
  await tick();
  setRenderPhase('loading');
});

afterEach(() => {
  addons.getChannel().emit(SET_CURRENT_STORY); // trigger a cleanup
});

describe('Instrumenter', () => {
  it('patches object methods', () => {
    const fn = () => {};
    const result = instrument({ fn });
    expect(result).toStrictEqual({ fn: expect.any(Function) });
    expect(result.fn.name).toBe('fn');
    expect(result.fn.__originalFn__).toBe(fn);
  });

  it('patches nested methods', () => {
    const fn1: any = () => {};
    const fn2: any = () => {};
    const result = instrument({ foo: { fn1, bar: { fn2 } } });
    expect(result).toStrictEqual({
      foo: {
        fn1: expect.any(Function),
        bar: { fn2: expect.any(Function) },
      },
    });
    expect(result.foo.fn1.__originalFn__).toBe(fn1);
    expect(result.foo.bar.fn2.__originalFn__).toBe(fn2);
  });

  it('does not patch already patched functions', () => {
    const fn: any = () => {};
    const result = instrument(instrument({ fn }));
    expect(result.fn.__originalFn__).toBe(fn);
    expect(result.fn.__originalFn__.__originalFn__).not.toBeDefined();
  });

  it('does not traverse into arrays', () => {
    const fn1: any = () => {};
    const fn2: any = () => {};
    const result = instrument({ arr: [fn1, { fn2 }] });
    expect(result).toStrictEqual({ arr: [fn1, { fn2 }] });
    expect(result.arr[0].__originalFn__).not.toBeDefined();
    expect(result.arr[1].fn2.__originalFn__).not.toBeDefined();
  });

  it('patches function properties on functions', () => {
    const fn1: any = () => {};
    fn1.fn2 = () => {};
    const result = instrument({ fn1 });
    expect(result.fn1).toEqual(expect.any(Function));
    expect(result.fn1.fn2).toEqual(expect.any(Function));
    expect(result.fn1.__originalFn__).toBe(fn1);
    expect(result.fn1.fn2.__originalFn__).toBe(fn1.fn2);
  });

  it('patches functions correctly that reference this', () => {
    const object = {
      name: 'name',
      method() {
        return this.name;
      },
    };

    const instrumented = instrument(object);
    expect(object.method()).toEqual(instrumented.method());

    expect(instrumented.method).toEqual(expect.any(Function));
    expect(instrumented.method.__originalFn__).toBe(object.method);
  });

  it('patches functions correctly that use proxies', () => {
    const object = new Proxy(
      {
        name: 'name',
        method() {
          return this.name;
        },
      },
      {
        get(target, prop, receiver) {
          if (prop === 'name') {
            return `${target[prop]}!`;
          }
          return Reflect.get(target, prop, receiver);
        },
      }
    );

    const instrumented = instrument(object);
    expect(object.method()).toEqual(instrumented.method());

    expect(instrumented.method).toEqual(expect.any(Function));
    expect(instrumented.method.__originalFn__).toBe(object.method);
  });

  it('patched functions call the original function when invoked', () => {
    const { fn } = instrument({ fn: vi.fn() });
    const obj = {};
    fn('foo', obj);
    expect(fn.__originalFn__).toHaveBeenCalledWith('foo', obj);
  });

  it('emits a "call" event every time a patched function is invoked', async () => {
    const { fn } = instrument({ fn: (..._args: any) => {} });

    fn('foo', 'bar');
    fn('baz');
    expect(mocks.callSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'kind--story [0] fn',
        args: ['foo', 'bar'],
      })
    );
    expect(mocks.callSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'kind--story [1] fn',
        args: ['baz'],
      })
    );
  });

  it('handles circular references', () => {
    const { fn } = instrument({ fn: (..._args: any) => {} });
    const obj = { key: 'value', obj: {}, array: [] as any[] };
    obj.obj = obj;
    obj.array = [obj];

    expect(() => fn(obj)).not.toThrow();

    expect(mocks.callSpy.mock.calls[0][0].args).toMatchInlineSnapshot(`
      [
        {
          "array": [
            "[Circular]",
          ],
          "key": "value",
          "obj": "[Circular]",
        },
      ]
    `);
  });

  it('provides metadata about the call in the event', () => {
    const { obj } = instrument({ obj: { fn: () => {} } });
    obj.fn();
    expect(mocks.callSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        path: ['obj'],
        method: 'fn',
        interceptable: false,
        status: 'done',
        ancestors: [],
      })
    );
  });

  it('maps event args which originate from an earlier call to a call ref', () => {
    const { fn1, fn2 } = instrument({
      fn1: (arg: any) => arg,
      fn2: (_arg: any) => {},
    });
    fn2(fn1({}));
    expect(mocks.callSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'fn2',
        args: [{ __callId__: mocks.callSpy.mock.calls[0][0].id, retain: false }],
      })
    );
  });

  it('does not map primitive event args which originate from an earlier call', () => {
    const { fn1, fn2 } = instrument({
      fn1: (...args: any) => args[0],
      fn2: (..._args: any) => {},
    });
    fn2(
      fn1(undefined),
      fn1(null),
      fn1(true),
      fn1('foo'),
      fn1(1),
      fn1(BigInt(1)),
      fn1({}),
      fn1([]),
      fn1(() => {}),
      fn1(Symbol('hi')),
      fn1(new Error('Oops'))
    );
    expect(mocks.callSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'fn2',
        args: [
          /* call 0 */ undefined,
          /* call 1 */ null,
          /* call 2 */ true,
          /* call 3 */ 'foo',
          /* call 4 */ 1,
          /* call 5 */ BigInt(1),
          { __callId__: mocks.callSpy.mock.calls[6][0].id, retain: false },
          { __callId__: mocks.callSpy.mock.calls[7][0].id, retain: false },
          { __callId__: mocks.callSpy.mock.calls[8][0].id, retain: false },
          { __callId__: mocks.callSpy.mock.calls[9][0].id, retain: false },
          { __callId__: mocks.callSpy.mock.calls[10][0].id, retain: false },
        ],
      })
    );
  });

  it('maps HTML Elements in event args to an element ref', () => {
    const { fn } = instrument({ fn: (..._args: any) => {} });
    fn(new HTMLElement({ prefix: '', localName: 'div', id: 'root', classList: [] }));
    expect(mocks.callSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        args: [{ __element__: { prefix: '', localName: 'div', id: 'root', classNames: [] } }],
      })
    );
  });

  it('tracks the parent call id for calls inside callbacks', () => {
    const fn = (callback?: Function) => callback && callback();
    const { fn1, fn2, fn3, fn4, fn5 } = instrument({ fn1: fn, fn2: fn, fn3: fn, fn4: fn, fn5: fn });
    fn1(() => {
      fn2(() => fn3());
      fn4();
    });
    fn5();
    expect(mocks.callSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'kind--story [0] fn1', ancestors: [] })
    );
    expect(mocks.callSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'kind--story [0] fn1 [0] fn2',
        ancestors: ['kind--story [0] fn1'],
      })
    );
    expect(mocks.callSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'kind--story [0] fn1 [0] fn2 [0] fn3',
        ancestors: ['kind--story [0] fn1', 'kind--story [0] fn1 [0] fn2'],
      })
    );
    expect(mocks.callSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'kind--story [0] fn1 [1] fn4',
        ancestors: ['kind--story [0] fn1'],
      })
    );
    expect(mocks.callSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'kind--story [1] fn5', ancestors: [] })
    );
  });

  it('handles exceptions when making calls inside callbacks', () => {
    const fn = (callback?: Function) => callback && callback();
    const { fn1, fn2, fn3 } = instrument({
      fn1: fn,
      fn2: fn,
      fn3: fn,
    });
    const error = new Error('foo');
    let thrownError;
    fn1(() => {
      try {
        fn2(() => {
          throw error;
        });
      } catch (err) {
        thrownError = err;
      }
      fn3();
    });
    expect(mocks.callSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'kind--story [0] fn1', ancestors: [] })
    );
    expect(mocks.callSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'kind--story [0] fn1 [0] fn2',
        ancestors: ['kind--story [0] fn1'],
      })
    );
    expect(thrownError).toBe(error);
    expect(mocks.callSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'kind--story [0] fn1 [1] fn3',
        ancestors: ['kind--story [0] fn1'],
      })
    );
  });

  it('tracks the parent call id for async callbacks', async () => {
    const fn = (callback?: Function) => Promise.resolve(callback && callback());
    const { fn1, fn2, fn3 } = instrument({ fn1: fn, fn2: fn, fn3: fn });
    await fn1(() => fn2());
    await fn3();
    expect(mocks.callSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'kind--story [0] fn1', ancestors: [] })
    );
    expect(mocks.callSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'kind--story [0] fn1 [0] fn2',
        ancestors: ['kind--story [0] fn1'],
      })
    );
    expect(mocks.callSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'kind--story [1] fn3', ancestors: [] })
    );
  });

  it('instruments the call result to support chaining', () => {
    const { fn1 } = instrument({
      fn1: () => ({
        fn2: () => {},
      }),
    });
    fn1().fn2();
    expect(mocks.callSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'fn2',
        path: [{ __callId__: mocks.callSpy.mock.calls[0][0].id }],
      })
    );
  });

  it('handles exceptions when making calls inside async callbacks', async () => {
    const fn = (callback?: Function) => Promise.resolve(callback && callback());
    const { fn1, fn2, fn3 } = instrument({
      fn1: fn,
      fn2: fn,
      fn3: fn,
    });
    const error = new Error('foo');
    let thrownError;
    await fn1(async () => {
      try {
        await fn2(async () => {
          throw error;
        });
      } catch (err) {
        thrownError = err;
      }
      await fn3();
    });
    expect(mocks.callSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'kind--story [0] fn1', ancestors: [] })
    );
    expect(mocks.callSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'kind--story [0] fn1 [0] fn2',
        ancestors: ['kind--story [0] fn1'],
      })
    );
    expect(thrownError).toBe(error);
    expect(mocks.callSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'kind--story [0] fn1 [1] fn3',
        ancestors: ['kind--story [0] fn1'],
      })
    );
  });

  it('emits a "sync" event with debounce after a patched function is invoked', () => {
    const { fn } = instrument({ fn: (..._args: any) => {} }, { intercept: true });
    vi.useFakeTimers();
    mocks.syncSpy.mockClear();
    fn('foo');
    fn('bar');
    vi.runAllTimers();
    expect(mocks.syncSpy).toHaveBeenCalledTimes(1);
  });

  it('sends a folded log with the "sync" event', () => {
    const { fn } = instrument({ fn: (..._args: any) => ({ fn2: () => {} }) }, { intercept: true });
    vi.useFakeTimers();
    mocks.syncSpy.mockClear();
    fn('foo', fn('bar')).fn2();
    fn('baz');
    vi.runAllTimers();
    expect(mocks.syncSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        logItems: [
          { callId: 'kind--story [2] fn2', status: 'done', ancestors: [] },
          { callId: 'kind--story [3] fn', status: 'done', ancestors: [] },
        ],
      })
    );
  });

  it('sends control states with the "sync" event', () => {
    const { fn } = instrument({ fn: (..._args: any) => {} }, { intercept: true });
    vi.useFakeTimers();
    mocks.syncSpy.mockClear();
    fn('foo');
    vi.runAllTimers();
    expect(mocks.syncSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        controlStates: {
          detached: false,
          start: true,
          back: true,
          goto: true,
          next: false,
          end: false,
        },
      })
    );
  });

  it('rethrows errors', () => {
    const { fn } = instrument({
      fn: () => {
        throw new Error('Boom!');
      },
    });
    expect(fn).toThrow('Boom!');
  });

  it('catches nested exceptions and rethrows', () => {
    const { fn1, fn2 } = instrument({
      fn1: (_: any) => {},
      fn2: () => {
        throw new Error('Boom!');
      },
    });
    expect(() => fn1(fn2())).toThrow('Boom!');
  });

  it('bubbles child exceptions up to parent (in callback)', () => {
    const instrumented = instrument({
      fn1: vi.fn((callback: Function) => callback()),
      fn2: () => {
        throw new Error('Boom!');
      },
    });

    vi.spyOn(instrumented, 'fn1');

    const { fn1, fn2 } = instrumented;
    let error;
    try {
      fn1(() => {
        fn2();
      });
    } catch (e) {
      error = e;
    }

    expect(fn1).toHaveBeenCalled();
    expect(error).toEqual(new Error('Boom!'));
    // @ts-expect-error callId is what is tested
    expect(error.callId).toBe('kind--story [0] fn1 [0] fn2');
  });

  it("re-throws anything that isn't an error", () => {
    const { fn } = instrument({
      fn: () => {
        throw 'Boom!';
      },
    });
    expect(fn).toThrow('Boom!');
    expect(mocks.callSpy).not.toHaveBeenCalled();
  });

  it('does not affect intercepted methods', () => {
    const { fn } = instrument({ fn: vi.fn() }, { intercept: true });
    fn('foo');
    expect(fn.__originalFn__).toHaveBeenCalledWith('foo');
  });

  it('clears state when switching stories', () => {
    addons.getChannel().emit(SET_CURRENT_STORY); // initialization
    instrumenter.state = {
      'kind--story': {
        isDebugging: false,
        cursor: 123,
        calls: [{ id: 'kind--story [0] fn' }],
        shadowCalls: [{ id: 'kind--story [0] fn' }, { id: 'kind--story [1] fn' }],
        callRefsByResult: new Map([[{}, 'ref']]),
        chainedCallIds: new Set(['kind--story [0] fn']),
        parentCall: { id: 'kind--story [0] fn' },
        playUntil: 'kind--story [1] fn',
        resolvers: { ref: () => {} },
        syncTimeout: 123,
        forwardedException: new Error('Oops'),
      },
    } as any;
    addons.getChannel().emit(SET_CURRENT_STORY);
    expect(instrumenter.state).toStrictEqual({});
  });

  describe('with intercept: true', () => {
    const options = { intercept: true };

    it('only includes intercepted calls in the log', async () => {
      const fn = (callback?: Function) => callback && callback();
      const { fn1, fn2 } = instrument({ fn1: fn, fn2: fn }, options);
      const { fn3 } = instrument({ fn3: fn }, { intercept: false });
      fn1();
      fn2();
      fn3();
      await tick();
      expect(mocks.syncSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          logItems: [
            { callId: 'kind--story [0] fn1', status: 'done', ancestors: [] },
            { callId: 'kind--story [1] fn2', status: 'done', ancestors: [] },
          ],
        })
      );
    });

    it('also includes child calls in the log', async () => {
      const fn = (callback?: Function) => callback && callback();
      const { fn1, fn2 } = instrument({ fn1: fn, fn2: fn }, options);
      fn1(() => {
        fn2();
      });
      await tick();
      expect(mocks.syncSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          logItems: [
            { callId: 'kind--story [0] fn1', status: 'done', ancestors: [] },
            {
              callId: 'kind--story [0] fn1 [0] fn2',
              status: 'done',
              ancestors: ['kind--story [0] fn1'],
            },
          ],
        })
      );
    });

    it('emits a call event with error data when the function throws', () => {
      const { fn } = instrument(
        {
          fn: () => {
            throw new Error('Boom!');
          },
        },
        options
      );
      expect(fn).toThrow();
      expect(mocks.callSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'kind--story [0] fn',
          exception: expect.objectContaining({
            name: 'Error',
            message: 'Boom!',
            stack: expect.stringContaining('Error: Boom!'),
            callId: 'kind--story [0] fn',
          }),
        })
      );
    });
  });

  describe('while debugging', () => {
    afterEach(() => {
      addons.getChannel().emit(EVENTS.END, { storyId });
    });

    it('remounts on the "start" event', async () => {
      addons.getChannel().emit(EVENTS.START, { storyId });
      expect(mocks.forceRemountSpy).toHaveBeenCalled();
    });

    it('defers calls to intercepted functions', () => {
      const { fn } = instrument({ fn: vi.fn() }, { intercept: true });
      addons.getChannel().emit(EVENTS.START, { storyId });
      expect(fn()).toEqual(expect.any(Promise));
      expect(fn.__originalFn__).not.toHaveBeenCalled();
    });

    it('does not defer calls to non-intercepted functions', () => {
      const { fn } = instrument({ fn: vi.fn(() => 'ok') });
      addons.getChannel().emit(EVENTS.START, { storyId });
      expect(fn()).toBe('ok');
      expect(fn.__originalFn__).toHaveBeenCalled();
    });

    it('does not defer calls to intercepted functions that are chained upon', () => {
      const { fn1 } = instrument(
        { fn1: vi.fn(() => ({ fn2: vi.fn() as any })) },
        { intercept: true }
      );
      fn1().fn2();
      addons.getChannel().emit(EVENTS.START, { storyId });
      const res1 = fn1();
      expect(res1.fn2()).toEqual(expect.any(Promise));
      expect(fn1.__originalFn__).toHaveBeenCalledTimes(2);
      expect(res1.fn2.__originalFn__).not.toHaveBeenCalled();
    });

    it.skip('starts debugging at the first non-nested interceptable call', () => {
      const fn = (...args: any[]) => args;
      const { fn1, fn2, fn3 } = instrument({ fn1: fn, fn2: fn, fn3: fn }, { intercept: true });
      fn3(fn1(), fn2()); // setup the dependencies
      addons.getChannel().emit(EVENTS.START, { storyId });
      const a = fn1('a');
      const b = fn2('b');
      const c = fn3(a, b);
      expect(a).toEqual(['a']);
      expect(b).toEqual(['b']);
      expect(c).toEqual(expect.any(Promise));
    });

    it('steps through each interceptable function on "next"', async () => {
      const fn = vi.fn();
      const { fn: instrumentedFn } = instrument({ fn }, { intercept: true });

      const mockedInstrumentedFn = vi.fn(instrumentedFn);
      const play = async () => {
        await mockedInstrumentedFn();
        await mockedInstrumentedFn();
        await mockedInstrumentedFn();
      };

      await play();
      fn.mockClear();
      mockedInstrumentedFn.mockClear();

      addons.getChannel().emit(EVENTS.START, { storyId });

      const p = play();
      expect(mockedInstrumentedFn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledTimes(0);

      addons.getChannel().emit(EVENTS.NEXT, { storyId });
      await tick();

      expect(mockedInstrumentedFn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenCalledTimes(1);

      addons.getChannel().emit(EVENTS.END, { storyId });
      await tick();

      expect(mockedInstrumentedFn).toHaveBeenCalledTimes(3);
      expect(fn).toHaveBeenCalledTimes(3);

      await p;
    });
  });

  describe('while detached from parent window', () => {
    beforeEach(() => {
      global.window.parent = {
        ...global.window.parent,
        get __STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER_STATE__() {
          throw new Error('Blocked');
        },
        set __STORYBOOK_ADDON_INTERACTIONS_INSTRUMENTER_STATE__(_: unknown) {},
      };
      instrumenter = new Instrumenter();
    });

    it('disables control states', async () => {
      const { fn } = instrument({ fn: (..._args: any) => {} }, { intercept: true });
      vi.useFakeTimers();
      mocks.syncSpy.mockClear();
      fn('foo');
      vi.runAllTimers();

      expect(mocks.syncSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          controlStates: {
            detached: true,
            start: false,
            back: false,
            goto: false,
            next: false,
            end: false,
          },
        })
      );
    });
  });

  describe('isClass', () => {
    it('returns true for class declarations', () => {
      class TestClass {}
      expect(isClass(TestClass)).toBe(true);
    });

    it('returns true for class expressions', () => {
      const TestClass = class {};
      expect(isClass(TestClass)).toBe(true);
    });

    it('returns false for regular functions', () => {
      function testFunction() {}
      expect(isClass(testFunction)).toBe(false);
    });

    it('returns false for arrow functions', () => {
      const arrowFunction = () => {};
      expect(isClass(arrowFunction)).toBe(false);
    });

    it('returns false for function expressions', () => {
      const functionExpression = function () {};
      expect(isClass(functionExpression)).toBe(false);
    });

    it('returns false for functions without prototype', () => {
      expect(isClass(Promise.resolve)).toBe(false);
    });

    it('returns false for method shorthand', () => {
      expect(isClass({ method() {} })).toBe(false);
    });

    it('returns false for non-function values', () => {
      expect(isClass(null)).toBe(false);
      expect(isClass(undefined)).toBe(false);
      expect(isClass(123)).toBe(false);
      expect(isClass('string')).toBe(false);
      expect(isClass({})).toBe(false);
      expect(isClass([])).toBe(false);
      expect(isClass(true)).toBe(false);
      expect(isClass(Symbol('test'))).toBe(false);
    });
  });
});
