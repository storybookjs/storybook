import type { Meta, StoryObj } from '@storybook/vue3';

import Component from './options-api/component';

const meta = {
  component: Component,
  tags: ['autodocs'],
} satisfies Meta<typeof Component>;

type Story = StoryObj<typeof meta>;
export default meta;

export const Default: Story = {
  args: {
    numberDefault: 12,
    objectDefault: { bar: 'foo' },
    arrayDefault: [1, 2, 3],
    complexDefault: [1, 2, 3, 4, 5],
  },
};
