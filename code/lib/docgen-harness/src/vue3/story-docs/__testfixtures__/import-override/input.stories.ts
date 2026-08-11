import type { Meta, StoryObj } from '@storybook/vue3';

import ImportOverrideButton from './ImportOverrideButton.vue';

const meta = {
  component: ImportOverrideButton,
  title: 'Forms/import-override',
} satisfies Meta<typeof ImportOverrideButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    label: 'Override',
  },
};
