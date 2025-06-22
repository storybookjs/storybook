import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ToggleButton } from './ToggleButton';

const meta = {
  title: 'ToggleButton',
  component: ToggleButton,
  tags: ['autodocs'],
  args: { children: 'Enable feature' },
} satisfies Meta<typeof ToggleButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Base = {};

export const Types: Story = {
  args: { pressed: false },
  render: ({ ...args }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <ToggleButton {...args} variant="solid" />
      <ToggleButton {...args} variant="outline" />
      <ToggleButton {...args} variant="ghost" />
    </div>
  ),
};

export const Pressed: Story = {
  args: { pressed: true },
  render: ({ ...args }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <ToggleButton {...args} variant="solid" />
      <ToggleButton {...args} variant="outline" />
      <ToggleButton {...args} variant="ghost" />
    </div>
  ),
};

export const Sizes: Story = {
  args: { pressed: false, variant: 'solid' },
  render: ({ ...args }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <ToggleButton {...args} size="small" />
      <ToggleButton {...args} size="medium" />
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, pressed: false },
  render: ({ ...args }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <ToggleButton {...args} variant="solid" />
      <ToggleButton {...args} variant="outline" />
      <ToggleButton {...args} variant="ghost" />
    </div>
  ),
};

export const DisabledAndPressed: Story = {
  args: { disabled: true, pressed: true },
  render: ({ ...args }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <ToggleButton {...args} variant="solid" />
      <ToggleButton {...args} variant="outline" />
      <ToggleButton {...args} variant="ghost" />
    </div>
  ),
};
