import { global as globalThis } from '@storybook/global';
import type { Channel } from 'storybook/internal/channels';
import { within, expect } from '@storybook/test';
import {
  UPDATE_STORY_ARGS,
  STORY_ARGS_UPDATED,
  RESET_STORY_ARGS,
} from 'storybook/internal/core-events';

import type { Meta, StoryObj } from '@storybook/vue3';
import MySlotComponent from './MySlotComponent.vue';

declare global {
  // eslint-disable-next-line no-var,@typescript-eslint/naming-convention
  var __STORYBOOK_ADDONS_CHANNEL__: Channel;
}

const meta = {
  component: MySlotComponent,
  args: {
    label: 'Storybook Day',
    year: 2022,
    default: ({ text, year }) => `${text}, ${year}`,
  },
  tags: ['autodocs'],
} satisfies Meta<typeof MySlotComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  // test that args are updated correctly in reactive mode
  play: async ({ canvasElement, id }) => {
    const channel = globalThis.__STORYBOOK_ADDONS_CHANNEL__;
    const canvas = within(canvasElement);

    await channel.emit(RESET_STORY_ARGS, { storyId: id });
    await new Promise((resolve) => channel.once(STORY_ARGS_UPDATED, resolve));
    await expect(canvas.getByTestId('scoped-slot').innerText).toMatch(
      'Hello Storybook Day from the slot, 2022'
    );

    await channel.emit(UPDATE_STORY_ARGS, {
      storyId: id,
      updatedArgs: {
        label: 'Storybook Day updated',
        year: 2023,
      },
    });
    await new Promise((resolve) => {
      channel.once(STORY_ARGS_UPDATED, resolve);
    });

    await expect(canvas.getByTestId('scoped-slot').innerText).toMatch(
      'Hello Storybook Day updated from the slot, 2023'
    );
  },
};

export const CustomRender: Story = {
  render: (args) => ({
    components: { MySlotComponent },
    setup() {
      return { args };
    },
    template: `<MySlotComponent v-bind="args" v-slot="slotProps">
  	              {{ slotProps.text }}, {{ slotProps.year }}
              </MySlotComponent>`,
  }),
  play: Basic.play,
};

export const CustomRenderUsingFunctionSlot: Story = {
  render: (args: any) => ({
    components: { MySlotComponent },
    setup() {
      return { args };
    },
    template: `<MySlotComponent v-bind="args" v-slot="slotProps">
  	            {{args.default(slotProps)}}
              </MySlotComponent>`,
  }),
  play: Basic.play,
};
