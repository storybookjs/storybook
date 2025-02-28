import { describe, expect, it, vi } from 'vitest';

import { addons } from 'storybook/internal/preview-api';

import { action, configureActions } from '../..';

vi.mock('storybook/internal/preview-api');

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

describe('allowFunction config', () => {
  it('with global allowFunction false', () => {
    const channel = createChannel();

    const allowFunction = false;

    configureActions({
      allowFunction,
    });

    action('test-action')({
      root: {
        one: {
          a: 1,
          b: () => 'foo',
        },
      },
    });

    expect(getChannelData(channel)).toEqual({
      root: {
        one: {
          a: 1,
          b: expect.any(Function),
        },
      },
    });
  });

  // TODO: this test is pretty pointless, as the real channel isn't used, nothing is changed
  it('with global allowFunction true', () => {
    const channel = createChannel();

    const allowFunction = true;

    configureActions({
      allowFunction,
    });

    action('test-action')({
      root: {
        one: {
          a: 1,
          b: () => 'foo',
        },
      },
    });

    expect(getChannelData(channel)).toEqual({
      root: {
        one: {
          a: 1,
          b: expect.any(Function),
        },
      },
    });
  });
});
