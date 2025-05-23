import type { PartialStoryFn, PlayFunctionContext, StoryContext } from 'storybook/internal/types';

import { global as globalThis } from '@storybook/global';

import { expect, within } from 'storybook/test';

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Pre,
  parameters: {
    componentParameter: 'componentParameter',
    storyParameter: 'componentStoryParameter', // Checking this gets overridden
    storyObject: {
      a: 'component',
      b: 'component',
    },
  },
  decorators: [
    (storyFn: PartialStoryFn, context: StoryContext) => {
      const { projectParameter, componentParameter, storyParameter, storyObject } =
        context.parameters;
      return storyFn({
        args: { object: { projectParameter, componentParameter, storyParameter, storyObject } },
      });
    },
  ],
};

export const Inheritance = {
  parameters: {
    storyParameter: 'storyParameter',
    storyObject: {
      a: 'story',
    },
  },
  play: async ({ canvasElement }: PlayFunctionContext<any>) => {
    const canvas = within(canvasElement);
    await expect(JSON.parse(canvas.getByTestId('pre').innerText)).toEqual({
      projectParameter: 'projectParameter',
      componentParameter: 'componentParameter',
      storyParameter: 'storyParameter',
      storyObject: {
        a: 'story',
        b: 'component',
        c: 'project',
      },
    });
  },
};
