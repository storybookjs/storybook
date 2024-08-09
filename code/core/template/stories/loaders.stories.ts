import type { PartialStoryFn, PlayFunctionContext, StoryContext } from '@storybook/core/types';
import { global as globalThis } from '@storybook/global';
import { expect, within } from '@storybook/test';

export default {
  component: globalThis.Components.Pre,
  loaders: [async () => new Promise((r) => setTimeout(() => r({ componentValue: 7 }), 3000))],
  decorators: [
    (storyFn: PartialStoryFn, context: StoryContext) =>
      storyFn({ args: { ...context.args, object: context.loaded } }),
  ],
};

export const Inheritance = {
  loaders: [async () => new Promise((r) => setTimeout(() => r({ storyValue: 3 }), 1000))],
  play: async ({ canvasElement }: PlayFunctionContext<any>) => {
    const canvas = within(canvasElement);
    await expect(JSON.parse(canvas.getByTestId('pre').innerText)).toEqual({
      projectValue: 2,
      componentValue: 7,
      storyValue: 3,
    });
  },
};

export const ZIndex = {
  args: {
    style: {
      position: 'relative',
      zIndex: 1000,
      width: '500px',
      height: '500px',
      background: 'coral',
    },
  },
};
