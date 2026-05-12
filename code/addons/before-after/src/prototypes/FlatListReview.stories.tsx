import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { FlatListReview } from './FlatListReview.tsx';
import { mockReviewData } from './mockData.ts';
import { withAdeMode } from './withAdeMode.tsx';

const meta = {
  title: 'prototypes/Review · Flat list (deterministic, no AI)',
  component: FlatListReview,
  decorators: [withAdeMode],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Prototype A — iteration-1 deterministic-only fork. Lists every flagged story grouped by status (Modified / New / Related). No clustering, no agent involvement. Each card embeds the real story iframe so previews render live against the running Storybook. Search and per-status filter chips at the top.',
      },
    },
  },
} satisfies Meta<typeof FlatListReview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    data: mockReviewData,
  },
};

/**
 * Same prototype with the cascade shrunk to a small bounded case
 * (≤ 10 stories). Represents the 70% "single-file edit" workflow
 * where deterministic alone is enough.
 */
export const SmallCascade: Story = {
  args: {
    data: {
      ...mockReviewData,
      cascadeSize: 8,
      modifiedCount: 4,
      newCount: 0,
      relatedCount: 4,
      stories: mockReviewData.stories.slice(0, 8),
    },
  },
};

/**
 * The "no changes" empty state — shouldn't really be shown, but the
 * prototype renders it gracefully.
 */
export const Empty: Story = {
  args: {
    data: {
      ...mockReviewData,
      cascadeSize: 0,
      modifiedCount: 0,
      newCount: 0,
      relatedCount: 0,
      stories: [],
    },
  },
};
