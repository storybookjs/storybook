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
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

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
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

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
