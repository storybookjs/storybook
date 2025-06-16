import React from 'react';

import { FaceHappyIcon } from '@storybook/icons';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ToggleIconButton } from './ToggleIconButton';

const meta = {
  title: 'ToggleIconButton',
  component: ToggleIconButton,
  tags: ['autodocs'],
  args: { children: <FaceHappyIcon /> },
} satisfies Meta<typeof ToggleIconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Base = {};

export const Types: Story = {
  render: ({ ...args }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <ToggleIconButton {...args} variant="solid" />
      <ToggleIconButton {...args} variant="outline" />
      <ToggleIconButton {...args} variant="ghost" />
    </div>
  ),
};

export const Active: Story = {
  args: { active: true },
  render: ({ ...args }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <ToggleIconButton {...args} variant="solid" />
      <ToggleIconButton {...args} variant="outline" />
      <ToggleIconButton {...args} variant="ghost" />
    </div>
  ),
};

export const Sizes: Story = {
  args: { variant: 'solid' },
  render: ({ ...args }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <ToggleIconButton {...args} size="small" />
      <ToggleIconButton {...args} size="medium" />
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: ({ ...args }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <ToggleIconButton {...args} variant="solid" />
      <ToggleIconButton {...args} variant="outline" />
      <ToggleIconButton {...args} variant="ghost" />
    </div>
  ),
};

export const Animated: Story = {
  render: ({ ...args }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <ToggleIconButton {...args} animation="glow" />
      <ToggleIconButton {...args} animation="rotate360" />
      <ToggleIconButton {...args} animation="jiggle" />
    </div>
  ),
};

export const WithHref: Story = {
  render: ({ ...args }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <ToggleIconButton {...args} onClick={() => console.log('Hello')} />
      <ToggleIconButton {...args} asChild>
        <a href="https://storybook.js.org/" aria-label="Visit Storybook website">
          <FaceHappyIcon />
        </a>
      </ToggleIconButton>
    </div>
  ),
};
