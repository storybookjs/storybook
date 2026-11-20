import { getStoryArgTypes } from 'storybook/internal/preview-api';
import type { PartialStoryFn, StoryContext } from 'storybook/internal/types';

import { global as globalThis } from '@storybook/global';

import { expect, within } from 'storybook/test';

export default {
  component: globalThis.__TEMPLATE_COMPONENTS__.Pre,
  // Compose all the argTypes into `object`, so the pre component only needs a single prop
  decorators: [
    (storyFn: PartialStoryFn, context: StoryContext) =>
      storyFn({ args: { object: { ...getStoryArgTypes(context) } } }),
  ],
  argTypes: {
    componentArg: { type: 'string' },
    storyArg: { type: 'string' },
    composedArg: { type: 'string' },
  },
};

export const Inheritance = {
  argTypes: {
    storyArg: { type: 'number' },
    composedArg: { options: ['a', 'b'] },
  },
  play: async ({ canvasElement }: StoryContext<any>) => {
    // NOTE: these stories don't test project-level argTypes inheritance as it is too problematic
    // to have an argType floating around that will apply too *all* other stories in our sandboxes.
    await expect(JSON.parse(within(canvasElement).getByTestId('pre').innerText)).toMatchObject({
      componentArg: { type: { name: 'string' } },
      storyArg: { type: { name: 'number' } },
      composedArg: { type: { name: 'string' }, options: ['a', 'b'] },
    });
  },
};

// Check the inferred arg types from the args
export const ArgTypeInference = {
  args: {
    a: 1,
    b: '1',
    c: true,
    d: { a: 'b' },
    e: ['a', 'b'],
  },
  play: async ({ canvasElement }: StoryContext<any>) => {
    const argTypes = JSON.parse(within(canvasElement).getByTestId('pre').innerText);
    // `prepareStory` skips `inferArgTypes` when `docgenServer` is on; the manager
    // runs that second pass in `mergeServiceArgTypes`, so the preview canvas never sees types
    // inferred from args.
    if (globalThis.FEATURES?.docgenServer) {
      await expect(argTypes.a).toBeUndefined();
      await expect(argTypes).toMatchObject({
        componentArg: { type: { name: 'string' } },
        storyArg: { type: { name: 'string' } },
        composedArg: { type: { name: 'string' } },
      });
      return;
    }
    await expect(argTypes).toMatchObject({
      a: { type: { name: 'number' } },
      b: { type: { name: 'string' } },
      c: { type: { name: 'boolean' } },
      d: { type: { name: 'object', value: { a: { name: 'string' } } } },
      e: { type: { name: 'array', value: { name: 'string' } } },
    });
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
