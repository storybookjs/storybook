import type { Meta, StoryObj } from '@storybook/vue3';

import ImportOverrideButton from './ImportOverrideButton.vue';

/**
 * Import override button.
 *
 * @import import { ImportOverride } from 'my-design-system';
 */
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
