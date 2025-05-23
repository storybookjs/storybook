import type { PartialStoryFn, PlayFunctionContext, StoryContext } from 'storybook/internal/types';

import { global as globalThis } from '@storybook/global';

import { expect, within } from 'storybook/test';

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Pre,
  tags: ['component-one', 'autodocs'],
  decorators: [
    (storyFn: PartialStoryFn, context: StoryContext) => {
      return storyFn({
        args: { object: { tags: context.tags } },
      });
    },
  ],
  parameters: { chromatic: { disable: true } },
};

export const Inheritance = {
  tags: ['story-one', '!vitest'],
  play: async ({ canvasElement }: PlayFunctionContext<any>) => {
    const canvas = within(canvasElement);
    await expect(JSON.parse(canvas.getByTestId('pre').innerText)).toEqual({
      tags: ['dev', 'test', 'component-one', 'autodocs', 'story-one'],
    });
  },
  parameters: { chromatic: { disable: false } },
};

export const NoDev = {
  tags: ['!dev'],
};

export const NoAutodocs = {
  tags: ['!autodocs'],
};

export const NoTest = {
  tags: ['!test'],
};
