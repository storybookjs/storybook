import {
  RESET_STORY_ARGS,
  STORY_ARGS_UPDATED,
  UPDATE_STORY_ARGS,
} from 'storybook/internal/core-events';

import { global as globalThis } from '@storybook/global';
import { userEvent, within } from '@storybook/test';
import type { Meta, StoryObj } from '@storybook/vue3';

import { h } from 'vue';

import Reactivity from './Reactivity.vue';

const meta = {
  component: Reactivity,
  argTypes: {
    header: { control: { type: 'text' } },
    footer: { control: { type: 'text' } },
    default: { control: { type: 'text' } },
  },
  args: {
    label: 'If you see this then the label arg was not reactive.',
    default: 'If you see this then the default slot was not reactive.',
    header: 'If you see this, the header slot was not reactive.', // this can be useless if you have custom render function that overrides the slot
    footer: 'If you see this, the footer slot was not reactive.',
  },
  play: async ({ canvasElement, id, args }) => {
    const channel = (globalThis as any).__STORYBOOK_ADDONS_CHANNEL__;

    const canvas = within(canvasElement);

    await channel.emit(RESET_STORY_ARGS, { storyId: id });
    await new Promise((resolve) => channel.once(STORY_ARGS_UPDATED, resolve));

    const input = await canvas.findByLabelText<HTMLInputElement>('Some input:');
    await userEvent.type(input, 'value');

    await channel.emit(UPDATE_STORY_ARGS, {
      storyId: id,
      updatedArgs: {
        label: 'updated label',
        header: 'updated header slot', // this can be useless if you have custom render function that overrides the slot which the case here
        footer: 'updated footer slot',
        default: 'updated default slot',
      },
    });
    await new Promise((resolve) => channel.once(STORY_ARGS_UPDATED, resolve));
  },
} satisfies Meta<typeof Reactivity>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoDecorators: Story = {};

export const DecoratorFunctionalComponent: Story = {
  decorators: [
    (storyFn, context) => {
      const story = storyFn();
      return () => h('div', [h('h2', ['Decorator not using args']), [h(story)]]);
    },
  ],
};

export const DecoratorFunctionalComponentArgsFromContext: Story = {
  decorators: [
    (storyFn, context) => {
      const story = storyFn();
      return () =>
        h('div', [h('h2', ['Decorator using args.label: ', context.args.label]), [h(story)]]);
    },
  ],
};

export const DecoratorComponentOptions: Story = {
  decorators: [
    (storyFn, context) => {
      return {
        template: '<div><h2>Decorator not using args</h2><story/></div>',
      };
    },
  ],
};

export const DecoratorComponentOptionsArgsFromData: Story = {
  decorators: [
    (storyFn, context) => {
      return {
        data: () => ({ args: context.args }),
        template: '<div><h2>Decorator using args.label: {{args.label}}</h2><story/></div>',
      };
    },
  ],
};
