import type { PartialStoryFn, PlayFunctionContext, StoryContext } from '@storybook/core/types';
import { global as globalThis } from '@storybook/global';
import { expect, within } from '@storybook/test';

import {
  RESET_STORY_ARGS,
  STORY_ARGS_UPDATED,
  UPDATE_STORY_ARGS,
} from '@storybook/core/core-events';

function pick(obj, keys) {
  const result = {};
  for (const key of keys) {
    result[key] = obj[key];
  }
  return result;
}

export default {
  component: globalThis.Components.Pre,
  args: {
    componentArg: 'componentArg',
    storyArg: 'componentStoryArg',
    object: {
      a: 'component',
      b: 'component',
    },
  },
  // Compose the set of  args into `object`, so the pre component only needs a single prop
  //   (selecting only the args specified on parameters.argNames if set)
  decorators: [
    (storyFn: PartialStoryFn, context: StoryContext) => {
      const { argNames } = context.parameters;
      const args = { ...context.args };
      const object = argNames ? pick(args, argNames) : args;
      return storyFn({ args: { object } });
    },
  ],
};

export const Inheritance = {
  args: {
    storyArg: 'storyArg',
    object: {
      a: 'story',
    },
  },
  play: async ({ canvasElement }: PlayFunctionContext<any>) => {
    // NOTE: these stories don't test project-level args inheritance as it is too problematic
    // to have an arg floating around that will apply too *all* other stories in our sandboxes.
    await expect(JSON.parse(within(canvasElement).getByTestId('pre').innerText)).toEqual({
      componentArg: 'componentArg',
      storyArg: 'storyArg',
      object: {
        a: 'story',
      },
    });
  },
};

export const Targets = {
  args: {
    a: 'a',
    b: 'b',
  },
  argTypes: {
    a: { target: 'elsewhere' },
  },
  parameters: { argNames: ['a', 'b'] },
  play: async ({ canvasElement }: PlayFunctionContext<any>) => {
    // Check that `a` doesn't end up set
    await expect(JSON.parse(within(canvasElement).getByTestId('pre').innerText)).toEqual({
      b: 'b',
    });
  },
  tags: ['!vitest'],
};

export const Events = {
  args: {
    test: 'initial',
  },
  parameters: { argNames: ['test'] },
  play: async ({ canvasElement, id }: PlayFunctionContext<any>) => {
    const channel = globalThis.__STORYBOOK_ADDONS_CHANNEL__;
    await channel.emit(RESET_STORY_ARGS, { storyId: id });
    await new Promise((resolve) => channel.once(STORY_ARGS_UPDATED, resolve));

    await within(canvasElement).findByText(/initial/);

    await channel.emit(UPDATE_STORY_ARGS, { storyId: id, updatedArgs: { test: 'updated' } });
    await new Promise((resolve) => channel.once(STORY_ARGS_UPDATED, resolve));
    await within(canvasElement).findByText(/updated/);
  },
  tags: ['!vitest'],
};
