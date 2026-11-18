import { h } from 'vue';

import type { Meta, StoryObj } from '@storybook/vue3';

import ImportOverrideRenderButton from './ImportOverrideRenderButton.vue';

/**
 * Import override on a render-function story.
 *
 * @import import { OverrideButton } from 'my-design-system';
 */
const meta = {
  component: ImportOverrideRenderButton,
  title: 'Forms/import-override-render',
} satisfies Meta<typeof ImportOverrideRenderButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    label: 'Override',
  },
  render: (args) => h(ImportOverrideRenderButton, args),
};
