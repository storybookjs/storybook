import type { PartialStoryFn, StoryContext } from 'storybook/internal/types';

import { expect, within } from 'storybook/test';

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Pre,
  argTypes: {
    componentArg: { type: 'string' },
  },
};

export const HiddenFromPlay = {
  play: async (context: StoryContext<any>) => {
    await expect('argTypes' in context).toBe(false);
    await expect(() => context.argTypes).toThrow(/no longer part of the story context/);
  },
};

export const HiddenFromDecorators = {
  decorators: [
    (storyFn: PartialStoryFn, context: StoryContext) => {
      let outcome: string;
      try {
        outcome = `read ${Object.keys(context.argTypes).length} argTypes`;
      } catch (error) {
        outcome = (error as Error).message;
      }
      return storyFn({ args: { object: { hasArgTypes: 'argTypes' in context, outcome } } });
    },
  ],
  play: async ({ canvasElement }: StoryContext<any>) => {
    const read = JSON.parse(within(canvasElement).getByTestId('pre').innerText);
    await expect(read.hasArgTypes).toBe(false);
    await expect(read.outcome).toMatch(/no longer part of the story context/);
  },
};
