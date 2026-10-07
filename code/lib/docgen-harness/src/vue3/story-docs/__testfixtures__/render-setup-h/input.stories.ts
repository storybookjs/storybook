import { h } from 'vue';

import type { Meta, StoryObj } from '@storybook/vue3';

import SetupRenderButton from './SetupRenderButton.vue';

const meta = {
  component: SetupRenderButton,
  title: 'Forms/render-setup-h',
} satisfies Meta<typeof SetupRenderButton>;

export default meta;

type Story = StoryObj<typeof meta>;

// The render closure a `setup` returns is the other common home for an `h()` tree.
export const Primary: Story = {
  args: {
    label: 'Click me',
  },
  render: (args) => ({
    setup() {
      return () => h(SetupRenderButton, { label: args.label });
    },
  }),
};
