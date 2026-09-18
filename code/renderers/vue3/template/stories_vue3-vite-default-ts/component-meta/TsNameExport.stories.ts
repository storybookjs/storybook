import type { Meta, StoryObj } from '@storybook/vue3';

import { ComponentA } from './ts-named-export/component';

const meta = {
  component: ComponentA,
  tags: ['autodocs'],
} satisfies Meta<typeof ComponentA>;

type Story = StoryObj<typeof meta>;
export default meta;

export const Default: Story = {
  args: {
    size: 'large',
    backgroundColor: 'blue',
  },
};
