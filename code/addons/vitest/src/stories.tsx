import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect } from 'storybook/test';

const meta = {
  title: 'StoriesTsx',
  render: () => <div>This is a story coming from a /stories.tsx file detected via custom glob</div>,
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async () => {
    expect(true).toBe(true);
  },
};
