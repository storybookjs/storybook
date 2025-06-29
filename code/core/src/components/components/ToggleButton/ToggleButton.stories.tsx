import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { SwitchButton } from './ToggleButton';

const meta = {
  title: 'SwitchButton',
  component: SwitchButton,
  tags: ['autodocs'],
  args: { children: 'Enable feature' },
} satisfies Meta<typeof SwitchButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Base = {};

export const Types: Story = {
  args: { pressed: false },
  render: ({ ...args }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <SwitchButton {...args} variant="solid" />
      <SwitchButton {...args} variant="outline" />
      <SwitchButton {...args} variant="ghost" />
    </div>
  ),
};

export const Pressed: Story = {
  args: { pressed: true },
  render: ({ ...args }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <SwitchButton {...args} variant="solid" />
      <SwitchButton {...args} variant="outline" />
      <SwitchButton {...args} variant="ghost" />
    </div>
  ),
};

export const Sizes: Story = {
  args: { pressed: false, variant: 'solid' },
  render: ({ ...args }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <SwitchButton {...args} size="small" />
      <SwitchButton {...args} size="medium" />
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, pressed: false },
  render: ({ ...args }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <SwitchButton {...args} variant="solid" />
      <SwitchButton {...args} variant="outline" />
      <SwitchButton {...args} variant="ghost" />
    </div>
  ),
};

export const DisabledAndPressed: Story = {
  args: { disabled: true, pressed: true },
  render: ({ ...args }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <SwitchButton {...args} variant="solid" />
      <SwitchButton {...args} variant="outline" />
      <SwitchButton {...args} variant="ghost" />
    </div>
  ),
};
