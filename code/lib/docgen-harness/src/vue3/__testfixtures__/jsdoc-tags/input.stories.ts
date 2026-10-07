import type { Meta, StoryObj } from '@storybook/vue3';

import JsdocTags from './JsdocTags.vue';

const meta = {
  title: 'VueFixtures/JsdocTags',
  component: JsdocTags,
} satisfies Meta<typeof JsdocTags>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PropsAsWritten: Story = {
  args: { label: 'Old label', title: 'New title' },
};
