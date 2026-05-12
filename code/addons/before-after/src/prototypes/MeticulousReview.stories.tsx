import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { MeticulousReview } from './MeticulousReview.tsx';
import { mockMixedSizeData, mockReviewData } from './mockData.ts';
import { withAdeMode } from './withAdeMode.tsx';

const meta = {
  title: 'prototypes/Review · Meticulous-style (approve/reject)',
  component: MeticulousReview,
  decorators: [withAdeMode],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Prototype F — modelled on meticulous.ai\'s PR-style visual-regression review flow. Top banner frames the work as a merge gate ("🤖 meticulous spotted X visual differences · Review required" → flips to "✓ Safe to merge" when every diff is resolved) and exposes a big peach "Approve all visual differences" CTA for trusted bulk acceptance. Left rail groups screens by cluster, each with its own "Approve all (N)" shortcut and a state-dot per screen (● pending, ✓ approved, ✕ rejected, ↺ follow-up). Main pane is side-by-side Before / After with an optional diff overlay; primary actions at the bottom are Approve / Reject / Follow-up with keyboard a/r/f shortcuts. The Before pane is a placeholder until the production version wires addon-before-after\'s env=before iframe.',
      },
    },
  },
} satisfies Meta<typeof MeticulousReview>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Fresh review — every diff is pending. Use the rail to navigate or
 * keyboard a/r/f to act and auto-advance.
 */
export const FreshReview: Story = {
  args: {
    data: mockReviewData,
  },
};

/**
 * Mixed-size dataset (page-level stories included). Exercises the
 * side-by-side layout with stories that need more real estate.
 */
export const MixedSize: Story = {
  args: {
    data: mockMixedSizeData,
  },
};

/**
 * Opens directly on a page-level screen (`manager-main--default`).
 * Verifies the Before / After panes hold up for full-app stories.
 */
export const StartOnPageLevel: Story = {
  args: {
    data: mockMixedSizeData,
    initialStoryId: 'manager-main--default',
  },
};
