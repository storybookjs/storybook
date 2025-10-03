import type { Meta, StoryObj } from '@storybook/react-vite';

import { Textarea as Component } from './Textarea';

const meta = {
  title: 'Form/Textarea',
  component: Component,
} satisfies Meta<typeof Component>;

type Story = StoryObj<typeof meta>;

export default meta;

export const Textarea: Story = {
  render: (args) => <Component aria-label="Sample textarea" {...args} />,
};
