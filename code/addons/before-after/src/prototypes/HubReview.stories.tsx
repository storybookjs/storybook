import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { HubReview } from './HubReview.tsx';
import { mockMixedSizeData, mockReviewData } from './mockData.ts';
import { withAdeMode } from './withAdeMode.tsx';

const meta = {
  title: 'prototypes/Review · Hub (rail + focused pane)',
  component: HubReview,
  decorators: [withAdeMode],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Prototype E — split-pane "explorer + editor" layout that combines what worked in the previous four prototypes and adds persistent review state. Left rail is the always-visible cluster overview (clickable to expand → story list, per-cluster progress bar, reviewed stories dimmed and struck-through). Main pane is the focused single-story preview (full width, Latest ↔ Baseline toggle, viewport selector, primary CTA "Mark reviewed + Next"). Top bar shows global progress (X / Y reviewed). The "Group by" toggle (Cluster vs Status) lives in the rail header so you get both perspectives in the same UI. Keyboard: ↓/j next, ↑/k prev, m mark reviewed and advance, b toggle baseline, h toggle hide-reviewed.',
      },
    },
  },
} satisfies Meta<typeof HubReview>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Default — opens on the first story in the first cluster. The rail's
 * first cluster is auto-expanded so the story list is immediately
 * visible.
 */
export const Default: Story = {
  args: {
    data: mockReviewData,
  },
};

/**
 * Same prototype on the mixed-size dataset (button → sidebar →
 * manager/Main → onboarding splashscreen). Exercises the full-width
 * preview for the page-level cases.
 */
export const MixedSize: Story = {
  args: {
    data: mockMixedSizeData,
  },
};

/**
 * Status grouping instead of clusters. Same UI, different rail
 * organisation — proves the layout works with or without the agent.
 */
export const StatusGrouping: Story = {
  args: {
    data: mockReviewData,
    initialGroupBy: 'status',
  },
};

/**
 * Opens directly on a page-level story (manager/Main). Verifies the
 * Hub layout still gives enough preview space for the case the
 * Focused prototype was designed for.
 */
export const StartOnPageLevel: Story = {
  args: {
    data: mockMixedSizeData,
    initialStoryId: 'manager-main--default',
  },
};
