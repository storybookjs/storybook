import type { Meta, StoryObj } from '@storybook/vue3';

import PropSlotCollision from './PropSlotCollision.vue';

const meta = {
  component: PropSlotCollision,
  title: 'Forms/prop-slot-collision',
} satisfies Meta<typeof PropSlotCollision>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    icon: 'pi pi-check',
    default: 'fallback text',
  },
};
