import type { Meta, StoryObj } from '@storybook/vue3';

const meta = {
  title: 'Forms/no-component',
} satisfies Meta;

export default meta;

type Story = StoryObj;

/** Field without an explicit component. */
export const Primary = {
  args: {
    value: 'Missing component',
  },
} satisfies Story;
