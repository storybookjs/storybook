import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { Input } from './Input';
import './grid.css';

const meta = {
  title: 'Input',
  component: Input,
  render: (args, context) => <Input defaultValue={context.name} {...args} />,
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const All: Story = {
  render: () => (
    <div className="story-grid pseudo">
      <div>
        <Input defaultValue="Normal" />
      </div>
      <div className="pseudo-hover-all">
        <Input defaultValue="Hover" />
      </div>
      <div className="pseudo-focus-all">
        <Input defaultValue="Focus" />
      </div>
      <div className="pseudo-hover-all pseudo-focus-all">
        <Input defaultValue="Hover Focus" />
      </div>
    </div>
  ),
};

export const Default: Story = {};

export const Hover: Story = {
  parameters: { pseudo: { hover: true } },
};

export const Focus: Story = {
  parameters: { pseudo: { focus: true } },
};
