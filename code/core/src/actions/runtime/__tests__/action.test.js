import { describe, expect, it, vi } from 'vitest';

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

  const createSyntheticEvent = () => {
    class SyntheticBaseEvent {}
    class PointerEvent {}
    // DOM events expose `view` through the prototype chain…
    Object.defineProperty(PointerEvent.prototype, 'view', { get: () => fakeWindow });
    const nativeEvent = Object.create(PointerEvent.prototype);
    // …and React 19 also stamps it as a non-configurable own accessor
    Object.defineProperty(nativeEvent, 'view', { enumerable: true, get: () => fakeWindow });
    return Object.assign(Object.create(SyntheticBaseEvent.prototype), {
      persist: () => {},
      nativeEvent,
      view: fakeWindow,
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
