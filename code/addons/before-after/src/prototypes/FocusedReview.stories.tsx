import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { FocusedReview } from './FocusedReview.tsx';
import { mockMixedSizeData, mockReviewData } from './mockData.ts';
import { withAdeMode } from './withAdeMode.tsx';

const meta = {
  title: 'prototypes/Review · Focused (page-level)',
  component: FocusedReview,
  decorators: [withAdeMode],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Prototype C — solves the layout problem the team conversation raised: page-level stories (manager/Main, manager/Layout, onboarding screens) do not fit in card-grid thumbnails. One story per screen, full-bleed iframe, viewport selector (Mobile/Tablet/Desktop/Auto), Latest ↔ Baseline toggle, keyboard navigation (← → arrows, B for baseline toggle, M to mark reviewed). The same view also makes sense as a click-through from either of the other two prototypes — pass `enteredFromClusterId` to enter inside a cluster context.',
      },
    },
  },
} satisfies Meta<typeof FocusedReview>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Walk a mixed cascade — starts on the Button component (small), then
 * walks through layout-level stories that progressively need more
 * space. Use ←/→ to navigate, B to toggle baseline, M to mark reviewed.
 */
export const MixedCascade: Story = {
  args: {
    data: mockMixedSizeData,
    initialIndex: 0,
  },
};

/**
 * Start the walk on a page-level story (`manager-main--default`). This
 * is the case the flat-list and clustered prototypes handle badly — the
 * full Storybook UI shell doesn't render in a 320×180 card.
 */
export const StartOnPageLevel: Story = {
  args: {
    data: mockMixedSizeData,
    initialIndex: 4, // manager-main--default
  },
};

/**
 * Entered from a cluster (zoom-in from Prototype B). Shows the cluster
 * rationale chip above the preview and walks only the stories in that
 * cluster.
 */
export const EnteredFromCluster: Story = {
  args: {
    data: mockMixedSizeData,
    enteredFromClusterId: 'manager-layout-pages',
    initialIndex: 0,
  },
};

/**
 * Cluster of onboarding-screen stories — every story in this cluster
 * is page-level. Tests the case where the focused view is the ONLY
 * usable layout (cards would never work).
 */
export const OnboardingCluster: Story = {
  args: {
    data: mockMixedSizeData,
    enteredFromClusterId: 'onboarding-pages',
    initialIndex: 0,
  },
};

/**
 * Component-only walk — should feel a little overkill, but verifies
 * the focused view still works for the case where the user would
 * normally stick with the card grid.
 */
export const ComponentOnly: Story = {
  args: {
    data: {
      ...mockReviewData,
      stories: mockReviewData.stories.slice(0, 4),
      cascadeSize: 4,
    },
    initialIndex: 0,
  },
};
