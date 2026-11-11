import type { Meta, StoryObj } from '@storybook/vue3';

import DocgenUnavailableButton from './DocgenUnavailableButton.vue';

const meta = {
  component: DocgenUnavailableButton,
  title: 'Forms/docgen-unavailable',
} satisfies Meta<typeof DocgenUnavailableButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    label: 'Missing docgen',
  },
};
