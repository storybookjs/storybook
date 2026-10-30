import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Channel } from 'storybook/internal/channels';
import type { StoryContext } from 'storybook/internal/types';

import { addons } from 'storybook/preview-api';
import { fn } from 'storybook/test';

import { EVENT_ID } from './constants.ts';
import { loaders } from './loaders.ts';

vi.mock('storybook/preview-api', { spy: true });

const context = { parameters: {} } as StoryContext;
const channel = new Channel({});
const emit = vi.spyOn(channel, 'emit');

beforeEach(() => {
  vi.mocked(addons.getChannel).mockReturnValue(channel);
});

const emittedArgs = () => {
  expect(emit).toHaveBeenCalledExactlyOnceWith(EVENT_ID, expect.anything());
  return emit.mock.calls[0][1].data.args;
};

describe('loaders', () => {
  it('emits each mock call argument to the action channel, not the args array', () => {
    loaders[0](context);

    const event = { type: 'click' };
    fn().mockName('onClick')(event);

    expect(emittedArgs()).toBe(event);
  });

  it('logs a mock call without arguments as an empty list', () => {
    loaders[0](context);

    fn().mockName('onClose')();

    expect(emittedArgs()).toEqual([]);
  });

  it('forwards multiple mock-call arguments in order', () => {
    loaders[0](context);

    const event = { type: 'click' };
    fn().mockName('onClick')(event, 'extra', 42);

    expect(emittedArgs()).toEqual([event, 'extra', 42]);
  });
});
