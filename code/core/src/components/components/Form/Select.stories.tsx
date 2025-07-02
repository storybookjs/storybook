import type { Meta, StoryObj } from '@storybook/react-vite';

import { action } from 'storybook/actions';

import { Select as Component } from './Input';

const meta = {
  title: 'Form/Select',
  component: Component,
} satisfies Meta<typeof Component>;

type Story = StoryObj<typeof meta>;

export default meta;

export const Select: Story = {
  render: (args: any) => (
    <Component onChange={action('onChange')} {...args}>
      <option value="val1">Value 1</option>
      <option value="val2">Value 2</option>
      <option value="val3">Value 3</option>
    </Component>
  ),
};
