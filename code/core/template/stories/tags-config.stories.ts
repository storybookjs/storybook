import type { PartialStoryFn, PlayFunctionContext, StoryContext } from '@storybook/core/types';
import { global as globalThis } from '@storybook/global';
import { expect, within } from '@storybook/test';

export default {
  component: globalThis.Components.Pre,
  tags: ['component-one', 'component-two', 'autodocs'],
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
  tags: ['story-one'],
  play: async ({ canvasElement }: PlayFunctionContext<any>) => {
    const canvas = within(canvasElement);
    await expect(JSON.parse(canvas.getByTestId('pre').innerText)).toEqual({
      tags: ['dev', 'test', 'component-one', 'component-two', 'autodocs', 'story-one'],
    });
  },
  parameters: { chromatic: { disable: false } },
};

export const DocsOnly = {
  tags: ['docs-only'],
};

export const TestOnly = {
  tags: ['test-only'],
};

export const DevOnly = {
  tags: ['dev-only'],
};

export const TagRemoval = {
  tags: ['!component-two'],
};
