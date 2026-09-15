import React from 'react';

import { Button } from 'storybook/internal/components';

import { SweepIcon } from '@storybook/icons';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { EmptyState } from './EmptyState.tsx';

export default {
  title: 'State/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof EmptyState>;

type Story = StoryObj<typeof EmptyState>;

export const TitleOnly: Story = {
  args: {
    title: 'No controls configured',
  },
};

export const TitleAndDescription: Story = {
  args: {
    title: 'No controls configured',
    description: 'Define args or argTypes on this story to see controls here.',
  },
};

export const TitleDescriptionAndAction: Story = {
  args: {
    title: 'No stories found',
    description: 'Your selected filters did not match any stories.',
    action: (
      <Button size="small" variant="outline">
        <SweepIcon />
        Clear filters
      </Button>
    ),
  },
};
