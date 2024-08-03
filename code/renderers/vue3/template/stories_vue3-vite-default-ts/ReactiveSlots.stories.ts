import { global as globalThis } from '@storybook/global';
import { within, expect } from '@storybook/test';
import {
  STORY_ARGS_UPDATED,
  RESET_STORY_ARGS,
  UPDATE_STORY_ARGS,
} from 'storybook/internal/core-events';
import { h } from 'vue';
import type { Meta, StoryObj } from '@storybook/vue3';
import BaseLayout from './BaseLayout.vue';

const meta = {
  component: BaseLayout,
  args: {
    label: 'Storybook Day',
    default: () => 'Default Text Slot',
    footer: h('p', 'Footer VNode Slot'),
  },
  tags: ['autodocs'],
} satisfies Meta<typeof BaseLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SimpleSlotTest: Story = {
  args: {
    label: 'Storybook Day',
    header: () => h('h1', 'Header Text Slot'),
    default: () => 'Default Text Slot',
    footer: h('p', 'Footer VNode Slot'),
  },
  play: async ({ canvasElement, id }) => {
    const channel = globalThis.__STORYBOOK_ADDONS_CHANNEL__;
    const canvas = within(canvasElement);

    await channel.emit(RESET_STORY_ARGS, { storyId: id });
    await new Promise((resolve) => {
      channel.once(STORY_ARGS_UPDATED, resolve);
    });
    await expect(canvas.getByTestId('footer-slot').innerText).toContain('Footer VNode Slot');
    await expect(canvas.getByTestId('default-slot').innerText).toContain('Default Text Slot');

    await channel.emit(UPDATE_STORY_ARGS, {
      storyId: id,
      updatedArgs: {
        default: () => 'Default Text Slot Updated',
        footer: h('p', 'Footer VNode Slot Updated'),
      },
    });
    await new Promise((resolve) => {
      channel.once(STORY_ARGS_UPDATED, resolve);
    });
    await expect(canvas.getByTestId('default-slot').innerText).toContain(
      'Default Text Slot Updated'
    );
    await expect(canvas.getByTestId('footer-slot').innerText).toContain(
      'Footer VNode Slot Updated'
    );
  },
};

export const NamedSlotTest: Story = {
  args: {
    label: 'Storybook Day',
    header: ({ title }: { title: string }) => h('h1', title),
    default: () => 'Default Text Slot',
    footer: h('p', 'Footer VNode Slot'),
  },
  // test that args are updated correctly in rective mode
  play: async ({ canvasElement, id }) => {
    const channel = globalThis.__STORYBOOK_ADDONS_CHANNEL__;
    const canvas = within(canvasElement);

    await channel.emit(RESET_STORY_ARGS, { storyId: id });
    await new Promise((resolve) => {
      channel.once(STORY_ARGS_UPDATED, resolve);
    });
    await expect(canvas.getByTestId('header-slot').innerText).toContain(
      'Header title from the slot'
    );
    await expect(canvas.getByTestId('default-slot').innerText).toContain('Default Text Slot');
    await expect(canvas.getByTestId('footer-slot').innerText).toContain('Footer VNode Slot');

    await channel.emit(UPDATE_STORY_ARGS, {
      storyId: id,
      updatedArgs: {
        default: () => 'Default Text Slot Updated',
        footer: h('p', 'Footer VNode Slot Updated'),
      },
    });
    await new Promise((resolve) => {
      channel.once(STORY_ARGS_UPDATED, resolve);
    });
    await expect(canvas.getByTestId('default-slot').innerText).toContain(
      'Default Text Slot Updated'
    );
    await expect(canvas.getByTestId('footer-slot').innerText).toContain(
      'Footer VNode Slot Updated'
    );
  },
};

export const SlotWithRenderFn: Story = {
  args: {
    label: 'Storybook Day',
    header: ({ title }: { title: string }) => `${title}`,
    default: () => 'Default Text Slot',
    footer: h('p', 'Footer VNode Slot'),
  },
  render: (args) => ({
    components: { BaseLayout },
    setup() {
      return { args };
    },
    template: `<BaseLayout :label="args.label" data-testid="layout">
  	            {{args.default()}}
                <template #header="{ title }"><h1>{{args.header({title})}}</h1></template>
              </BaseLayout>`,
  }),
  play: async ({ canvasElement, id }) => {
    const channel = globalThis.__STORYBOOK_ADDONS_CHANNEL__;
    const canvas = within(canvasElement);

    await channel.emit(RESET_STORY_ARGS, { storyId: id });
    await new Promise((resolve) => {
      channel.once(STORY_ARGS_UPDATED, resolve);
    });
    await expect(canvas.getByTestId('layout').innerText).toContain('Default Text Slot');
  },
};
