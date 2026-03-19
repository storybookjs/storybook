import type { Meta, StoryObj } from '@storybook/react-vite';

import { Input as Component } from './Input';

const meta = {
  title: 'Form/Input',
  component: Component,
} satisfies Meta<typeof Component>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Input: Story = {
  render: (args) => <Component aria-label="Sample input" {...args} />,
};

export const WithSuffix: Story = {
  render: (args) => <Component aria-label="Sample input" suffix="px" value="10" {...args} />,
};
