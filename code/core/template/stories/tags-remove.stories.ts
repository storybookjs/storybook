import type { PartialStoryFn, PlayFunctionContext, StoryContext } from '@storybook/core/types';
import { global as globalThis } from '@storybook/global';
import { expect, within } from '@storybook/test';

export default {
  component: globalThis.Components.Pre,
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
  play: async ({ canvasElement, tags }: PlayFunctionContext<any>) => {
    const canvas = within(canvasElement);
    if (tags.includes('a11ytest')) {
      await expect(JSON.parse(canvas.getByTestId('pre').innerText)).toEqual({
        tags: ['dev', 'test', 'a11ytest', 'component-one', 'autodocs', 'story-one'],
      });
    } else {
      await expect(JSON.parse(canvas.getByTestId('pre').innerText)).toEqual({
        tags: ['dev', 'test', 'component-one', 'autodocs', 'story-one'],
      });
    }
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
