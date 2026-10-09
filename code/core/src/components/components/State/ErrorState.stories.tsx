import React from 'react';

import { Link } from 'storybook/internal/components';

import { DocumentIcon } from '@storybook/icons';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ErrorState } from './ErrorState.tsx';

export default {
  title: 'State/ErrorState',
  component: ErrorState,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ErrorState>;

type Story = StoryObj<typeof ErrorState>;

export const Negative: Story = {
  args: {
    severity: 'negative',
    title: 'Addon panel failed to render',
    summary:
      'An error in this addon prevented the panel from rendering. Check the browser console for more details.',
  },
};

export const Critical: Story = {
  args: {
    severity: 'critical',
    title: 'Storybook crashed',
    summary: 'The Storybook UI encountered a fatal error. Reload the page to continue.',
  },
};

export const WithActions: Story = {
  args: {
    severity: 'negative',
    title: 'No docs found for this component',
    summary:
      'Import the story file whose meta.component is this component, or pass `of={ComponentStories}`.',
    actions: (
      <Link href="https://storybook.js.org/docs?ref=ui" target="_blank" withArrow>
        <DocumentIcon /> Read the docs
      </Link>
    ),
  },
};

export const WithoutBadge: Story = {
  args: {
    severity: 'negative',
    title: 'Addon panel failed to render',
    summary:
      'An error in this addon prevented the panel from rendering. Check the browser console for more details.',
    showBadge: false,
  },
};
