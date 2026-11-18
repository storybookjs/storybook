import { stringify } from 'telejson';
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
const getEmittedAction = (channel) => channel.emit.mock.calls[0][1];

const createStoryStoreProxy = (onAccess) =>
  new Proxy(
    {},
    {
      get: (_, method) => {
        onAccess(String(method));
        return undefined;
      },
    }
  );

const createWindowWithStoryStore = (onAccess) => {
  function Window() {}
  const win = Object.create(Window.prototype);
  Object.defineProperty(win, 'constructor', { value: Window });
  win.__STORYBOOK_STORY_STORE__ = createStoryStoreProxy(onAccess);
  return win;
};

const createReactSyntheticEvent = (win) => {
  function SyntheticEvent() {}
  const event = Object.create(SyntheticEvent.prototype);
  event.persist = vi.fn();
  event.view = win;
  event.nativeEvent = { view: win, type: 'click', target: {} };
  event.type = 'click';
  event.target = { tagName: 'BUTTON' };
  return event;
};

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

describe('React event serialization', () => {
  it('does not touch the deprecated story store when serializing a synthetic event', () => {
    const channel = createChannel();
    const storyStoreAccesses = [];
    const win = createWindowWithStoryStore((method) => storyStoreAccesses.push(method));
    const event = createReactSyntheticEvent(win);

    action('clicked')(event);

    const emitted = getEmittedAction(channel);
    expect(emitted.data.args.view).not.toBe(win);
    expect(emitted.data.args.nativeEvent.view).not.toBe(win);

    stringify(
      {
        key: 'storybook-channel',
        event: { type: 'storybook/actions/action-event', args: [emitted] },
      },
      { maxDepth: 10 }
    );

    expect(storyStoreAccesses).toEqual([]);
  });

  it('does not touch the deprecated story store when a mock passes args as an array', () => {
    const channel = createChannel();
    const storyStoreAccesses = [];
    const win = createWindowWithStoryStore((method) => storyStoreAccesses.push(method));
    const event = createReactSyntheticEvent(win);

    // loaders call `action(name)(args)` with the mock's args array
    action('onClick')([event]);

    const emitted = getEmittedAction(channel);
    expect(emitted.data.args[0].view).not.toBe(win);
    expect(emitted.data.args[0].nativeEvent.view).not.toBe(win);

    stringify(
      {
        key: 'storybook-channel',
        event: { type: 'storybook/actions/action-event', args: [emitted] },
      },
      { maxDepth: 10 }
    );

    expect(storyStoreAccesses).toEqual([]);
  });
});
