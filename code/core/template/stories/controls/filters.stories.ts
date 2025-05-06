import type { PartialStoryFn, StoryContext } from 'storybook/internal/types';

import { global as globalThis } from '@storybook/global';

export default {
  component: globalThis.Components.Pre,
  decorators: [
    (storyFn: PartialStoryFn, context: StoryContext) =>
      storyFn({ args: { object: { ...context.args } } }),
  ],
  args: {
    helloWorld: 1,
    helloPlanet: 1,
    byeWorld: 1,
  },
};

export const IncludeList = {
  parameters: {
    controls: {
      include: ['helloWorld'],
    },
  },
};

export const IncludeRegex = {
  parameters: {
    controls: {
      include: /hello*/,
    },
  },
};

export const ExcludeList = {
  parameters: {
    controls: {
      exclude: ['helloPlanet', 'helloWorld'],
    },
  },
};

export const ExcludeRegex = {
  parameters: {
    controls: {
      exclude: /hello*/,
    },
  },
};
