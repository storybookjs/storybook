import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { LayeredReview } from './LayeredReview.tsx';
import { mockMixedSizeData, mockReviewData } from './mockData.ts';

const meta = {
  title: 'prototypes/Review · Layered (2D nav)',
  component: LayeredReview,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Prototype D — "layered paper" 2D navigation. ↑/↓ moves between clusters (rows are stacked sheets, inactive ones peek above and below as collapsed bars). ←/→ moves between stories within the active cluster (horizontal carousel with the focused story centered, neighbours peeking at reduced size and opacity). Switch the top-right toggle between "Clusters" (agent grouping) and "Status groups" (deterministic Modified/New/Related rows) — both perspectives in one UI. Press C to toggle modes without leaving the keyboard. Click any peek strip or dot to jump directly.',
      },
    },
  },
} satisfies Meta<typeof LayeredReview>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Clustered mode (default) — rows are the agent's clusters. Opens on the
 * first cluster. ↑/↓ to move between clusters; ←/→ within a cluster.
 */
export const Clustered: Story = {
  args: {
    data: mockReviewData,
    initialMode: 'clustered',
  },
};

/**
 * Flat mode — same component, no AI. Rows are status groups
 * (Modified / Related). The 2D nav still works: ↑/↓ moves between
 * Modified and Related; ←/→ within. Verifies the prototype is useful
 * even before the agent layer ships.
 */
export const Flat: Story = {
  args: {
    data: mockReviewData,
    initialMode: 'flat',
  },
};

/**
 * Clustered mode using the mixed-size dataset (button → sidebar →
 * full-page layouts → onboarding). Shows how the carousel handles a
 * cluster that mixes component-scale and page-scale stories.
 */
export const MixedSizeClustered: Story = {
  args: {
    data: mockMixedSizeData,
    initialMode: 'clustered',
  },
};

/**
 * Flat mode on the mixed-size dataset.
 */
export const MixedSizeFlat: Story = {
  args: {
    data: mockMixedSizeData,
    initialMode: 'flat',
  },
};
