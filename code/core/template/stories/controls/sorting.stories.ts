import type { PartialStoryFn, StoryContext } from 'storybook/internal/types';

import { global as globalThis } from '@storybook/global';

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Pre,
  decorators: [
    (storyFn: PartialStoryFn, context: StoryContext) =>
      storyFn({ args: { object: { ...context.args } } }),
  ],
  argTypes: {
    x: { type: { required: true }, table: { category: 'bar' } },
    y: { type: { required: true }, table: { category: 'foo' } },
    z: {},
    a: { type: { required: true } },
    b: { table: { category: 'foo' } },
    c: {},
  },
  args: {
    x: 'x',
    y: 'y',
    z: 'z',
    a: 'a',
    b: 'b',
    c: 'c',
  },
  parameters: { chromatic: { disable: true } },
};

export const None = { parameters: { controls: { sort: 'none' } } };

export const Alpha = { parameters: { controls: { sort: 'alpha' } } };

export const RequiredFirst = { parameters: { controls: { sort: 'requiredFirst' } } };

export const Pinned = { parameters: { controls: { sort: { pinned: ['z', 'a', 'style'] } } } };

export const PinnedWithFallback = {
  parameters: { controls: { sort: { pinned: ['z', 'a'], fallback: 'alpha' } } },
};

export const GroupSort = {
  parameters: { controls: { sort: { group: 'alpha' } } },
};

export const GroupSortPinned = {
  parameters: { controls: { sort: { group: { pinned: ['foo', 'bar'] } } } },
};
