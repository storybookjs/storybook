import type { Meta, StoryObj } from '@storybook/vue3';

import AsCastButton from './AsCastButton.vue';

const meta = {
  component: AsCastButton,
  title: 'Forms/as-cast',
} as Meta<typeof AsCastButton>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Cast story description. */
export const Primary = {
  args: {
    label: 'Cast',
  },
} as Story;
