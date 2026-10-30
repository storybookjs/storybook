import { afterEach, describe, expect, it, vi } from 'vitest';

import { ImplicitActionsDuringRendering } from 'storybook/internal/preview-errors';
import { addons } from 'storybook/preview-api';

import { action, configureActions } from '../..';

vi.mock('storybook/preview-api');

const createChannel = () => {
  const channel = { emit: vi.fn() };
  addons.getChannel.mockReturnValue(channel);
  return channel;
};
const getChannelData = (channel) => channel.emit.mock.calls[0][1].data.args;

describe('Action', () => {
  it('with one argument', () => {
    const channel = createChannel();

    action('test-action')('one');

    expect(getChannelData(channel)).toEqual('one');
  });

  it('with multiple arguments', () => {
    const channel = createChannel();

    action('test-action')('one', 'two', 'three');

    expect(getChannelData(channel)).toEqual(['one', 'two', 'three']);
  });
});

describe('serializing React synthetic events', () => {
  // a Window self-references via .window, including cross-origin windows
  class Window {}
  const fakeWindow = new Window();
  fakeWindow.window = fakeWindow;

  const createSyntheticEvent = (win = fakeWindow) => {
    class SyntheticBaseEvent {}
    class PointerEvent {}
    // DOM events expose `view` through the prototype chain…
    Object.defineProperty(PointerEvent.prototype, 'view', { get: () => win });
    const nativeEvent = Object.create(PointerEvent.prototype);
    // …and React 19 also stamps it as a non-configurable own accessor
    Object.defineProperty(nativeEvent, 'view', { enumerable: true, get: () => win });
    return Object.assign(Object.create(SyntheticBaseEvent.prototype), {
      persist: () => {},
      nativeEvent,
      view: win,
    });
  };

  it('stubs `view` and `nativeEvent.view` so no Window reaches the channel', () => {
    const channel = createChannel();
    const event = createSyntheticEvent();

    action('test-action')(event);

    const emitted = getChannelData(channel);
    expect(emitted).not.toBe(event);
    expect(emitted.view).not.toBe(fakeWindow);
    expect(Object.keys(emitted.view)).toEqual([]);
    expect(emitted.nativeEvent).not.toBe(event.nativeEvent);
    expect(emitted.nativeEvent.view).not.toBe(fakeWindow);
    expect(Object.keys(emitted.nativeEvent.view)).toEqual([]);
    // the event the story (and spy) retains is left untouched
    expect(event.view).toBe(fakeWindow);
    expect(event.nativeEvent.view).toBe(fakeWindow);
  });

  it('stubs `view` without reading `constructor` — a cross-origin Window throws on it', () => {
    const channel = createChannel();
    // cross-origin windows only allow a whitelist of property reads; anything
    // else, including `constructor`, throws a SecurityError
    const foreignWindow = {};
    Object.defineProperties(foreignWindow, {
      window: { get: () => foreignWindow },
      constructor: {
        get: () => {
          throw new Error('SecurityError');
        },
      },
    });
    const event = createSyntheticEvent(foreignWindow);

    action('test-action')(event);

    // `===` instead of `.not.toBe` so vitest's equality internals never read
    // properties (e.g. `constructor`) on the simulated cross-origin window
    const emitted = getChannelData(channel);
    expect(emitted.view === foreignWindow).toBe(false);
    expect(emitted.view).toEqual({});
    expect(emitted.nativeEvent.view === foreignWindow).toBe(false);
    expect(emitted.nativeEvent.view).toEqual({});
  });

  it('keeps a non-Window `view` whose `window` getter throws', () => {
    const channel = createChannel();
    const view = { payload: 'kept' };
    Object.defineProperty(view, 'window', {
      get: () => {
        throw new Error('not a window');
      },
    });

    action('test-action')(createSyntheticEvent(view));

    expect(getChannelData(channel).view).toBe(view);
  });
});

describe('Depth config', () => {
  it('with global depth configuration', () => {
    const channel = createChannel();

    const depth = 1;

    configureActions({
      depth,
    });

    action('test-action')({
      root: {
        one: {
          two: 'foo',
        },
      },
    });

    expect(getChannelData(channel)).toEqual({
      root: {
        one: {
          two: 'foo',
        },
      },
    });
  });

  it('per action depth option overrides global config', () => {
    const channel = createChannel();

    configureActions({
      depth: 1,
    });

    action('test-action', { depth: 3 })({
      root: {
        one: {
          two: {
            three: {
              four: {
                five: 'foo',
              },
            },
          },
        },
      },
    });

    expect(getChannelData(channel)).toEqual({
      root: {
        one: {
          two: {
            three: {
              four: {
                five: 'foo',
              },
            },
          },
        },
      },
    });
  });
});

describe('Implicit actions during rendering', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('throws ImplicitActionsDuringRendering while a render is playing', () => {
    createChannel();
    vi.stubGlobal('__STORYBOOK_PREVIEW__', { storyRenders: [{ phase: 'playing' }] });
    const warnSpy = vi.spyOn(console, 'warn');

    let thrown;
    try {
      action('test-action', { implicit: true })('one');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ImplicitActionsDuringRendering);
    expect(thrown.data).toEqual({ phase: 'playing', name: 'test-action' });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('throws ImplicitActionsDuringRendering while a render is rendering', () => {
    createChannel();
    vi.stubGlobal('__STORYBOOK_PREVIEW__', { storyRenders: [{ phase: 'rendering' }] });
    const warnSpy = vi.spyOn(console, 'warn');

    expect(() => action('test-action', { implicit: true })('one')).toThrowError(
      ImplicitActionsDuringRendering
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('emits on the channel when no render is in progress', () => {
    const channel = createChannel();
    vi.stubGlobal('__STORYBOOK_PREVIEW__', { storyRenders: [] });

    action('test-action', { implicit: true })('one');

    expect(getChannelData(channel)).toEqual('one');
  });
});
