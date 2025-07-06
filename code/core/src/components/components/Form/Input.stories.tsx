import type { Meta, StoryObj } from '@storybook/react-vite';

import { Input as Component } from './Input';

const meta = {
  title: 'Form/Input',
  component: Component,
} satisfies Meta<typeof Component>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Input: Story = {};
