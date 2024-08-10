import type { PartialStoryFn, PlayFunctionContext, StoryContext } from '@storybook/core/types';
import { global as globalThis } from '@storybook/global';
import { expect, within } from '@storybook/test';

const arrows = {
  ArrowUp: { name: 'ArrowUp' },
  ArrowDown: { name: 'ArrowDown' },
  ArrowLeft: { name: 'ArrowLeft' },
  ArrowRight: { name: 'ArrowRight' },
};

const labels = {
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
};

export default {
  component: globalThis.Components.Pre,
  decorators: [
    (storyFn: PartialStoryFn, context: StoryContext) => {
      return storyFn({
        args: { object: { ...context.args } },
      });
    },
  ],
};

export const Single = {
  args: {
    mappingArg: 'ArrowRight',
  },
  argTypes: {
    mappingArg: {
      options: Object.keys(arrows),
      mapping: arrows,
      control: {
        type: 'select',
        labels,
      },
    },
  },
  play: async ({ canvasElement }: PlayFunctionContext<any>) => {
    await expect(JSON.parse(within(canvasElement).getByTestId('pre').innerText)).toMatchObject({
      mappingArg: { name: 'ArrowRight' },
    });
  },
};

export const Multiple = {
  args: {
    mappingArg: ['ArrowRight', 'ArrowLeft'],
  },
  argTypes: {
    mappingArg: {
      options: Object.keys(arrows),
      mapping: arrows,
      control: {
        type: 'multi-select',
        labels,
      },
    },
  },
  play: async ({ canvasElement }: PlayFunctionContext<any>) => {
    await expect(JSON.parse(within(canvasElement).getByTestId('pre').innerText)).toMatchObject({
      mappingArg: [{ name: 'ArrowRight' }, { name: 'ArrowLeft' }],
    });
  },
};
