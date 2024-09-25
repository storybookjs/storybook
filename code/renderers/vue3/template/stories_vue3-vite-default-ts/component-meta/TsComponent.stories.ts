import type { Meta, StoryObj } from '@storybook/vue3';

import Component from './ts-component/component';

const meta = {
  component: Component,
  tags: ['autodocs'],
} satisfies Meta<typeof Component>;

type Story = StoryObj<typeof meta>;
export default meta;

export const Default: Story = {
  args: {
    foo: 'bar',
    bar: 20,
  },
};
