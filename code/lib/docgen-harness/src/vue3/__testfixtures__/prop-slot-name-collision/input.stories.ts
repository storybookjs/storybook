import type { Meta, StoryObj } from '@storybook/vue3';

import PropSlotNameCollision from './PropSlotNameCollision.vue';

const meta = {
  title: 'VueFixtures/PropSlotNameCollision',
  component: PropSlotNameCollision,
} satisfies Meta<typeof PropSlotNameCollision>;

export default meta;

type Story = StoryObj<typeof meta>;

export const IconPropAsWritten: Story = {
  args: { icon: 'pi pi-check' },
};
