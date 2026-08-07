import type { Meta, StoryObj } from '@storybook/vue3';

import BasicButton from './BasicButton.vue';

const meta = {
  component: BasicButton,
  title: 'Forms/basic',
} satisfies Meta<typeof BasicButton>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Primary button description.
 *
 * @summary Primary button summary.
 */
export const Primary = {
  args: {
    label: 'Submit',
  },
} satisfies Story;
