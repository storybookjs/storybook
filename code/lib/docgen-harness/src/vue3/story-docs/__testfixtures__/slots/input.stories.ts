import type { Meta, StoryObj } from '@storybook/vue3';

import SlotsPanel from './SlotsPanel.vue';

const meta = {
  component: SlotsPanel,
  title: 'Forms/slots',
} satisfies Meta<typeof SlotsPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    default: 'Body copy',
    header: 'Header copy',
    footer: 42,
  },
};
