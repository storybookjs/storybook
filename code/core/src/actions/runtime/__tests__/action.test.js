import { Window } from 'happy-dom';
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
  const win = new Window({ url: 'http://localhost/' });
  win.__STORYBOOK_STORY_STORE__ = createStoryStoreProxy(onAccess);
  return win;
};

const createReactSyntheticEvent = (win) => {
  function SyntheticEvent() {}
  const event = Object.create(SyntheticEvent.prototype);
  const target = win.document.createElement('button');
  event.persist = vi.fn();
  event.view = win;
  event.nativeEvent = new win.MouseEvent('click', { bubbles: true, view: win });
  event.type = 'click';
  event.target = target;
  return event;
};

const assertNoStoryStoreAccessViaChannel = (channel, storyStoreAccesses) => {
  const emitted = getEmittedAction(channel);
  stringify(
    {
      key: 'storybook-channel',
      event: { type: 'storybook/actions/action-event', args: [emitted] },
    },
    { maxDepth: emitted.options.maxDepth }
  );
  expect(storyStoreAccesses).toEqual([]);
  return emitted;
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
  it.each([
    {
      name: 'a synthetic event',
      invoke: (handler, event) => handler(event),
      getSerialized: (emitted) => emitted.data.args,
    },
    {
      // loaders.ts calls `action(name)(args)` with the mock's args array
      name: 'the loaders.ts mock args array',
      invoke: (handler, event) => handler([event]),
      getSerialized: (emitted) => emitted.data.args[0],
    },
  ])('does not touch the deprecated story store for $name', ({ invoke, getSerialized }) => {
    const channel = createChannel();
    const storyStoreAccesses = [];
    const win = createWindowWithStoryStore((method) => storyStoreAccesses.push(method));
    expect(win.constructor.name).toBe('Window');
    const event = createReactSyntheticEvent(win);

    invoke(action('onClick'), event);

    const emitted = assertNoStoryStoreAccessViaChannel(channel, storyStoreAccesses);
    const serialized = getSerialized(emitted);

    expect(serialized.view).not.toBe(win);
    expect(serialized.nativeEvent.type).toBe('click');
    expect(serialized.nativeEvent.view).not.toBe(win);
  });
});
