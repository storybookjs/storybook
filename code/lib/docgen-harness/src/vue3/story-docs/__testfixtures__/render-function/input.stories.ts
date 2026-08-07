import { h } from 'vue';

import type { Meta, StoryObj } from '@storybook/vue3';

import RenderFunctionButton from './RenderFunctionButton.vue';

const meta = {
  component: RenderFunctionButton,
  title: 'Forms/render-function',
} satisfies Meta<typeof RenderFunctionButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    label: 'Render',
  },
  render: (args) => h(RenderFunctionButton, args),
};
