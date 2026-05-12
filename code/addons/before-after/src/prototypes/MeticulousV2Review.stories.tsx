import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { MeticulousV2Review } from './MeticulousV2Review.tsx';
import { mockMixedSizeData, mockReviewData } from './mockData.ts';
import { withAdeMode } from './withAdeMode.tsx';

const meta = {
  title: 'prototypes/Review · Meticulous v2 (real UI)',
  component: MeticulousV2Review,
  decorators: [withAdeMode],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Prototype G — modelled on the actual Meticulous dashboard from screenshots (different from Prototype F, which was extrapolated from their marketing copy). Dark layout with two modes: (1) **Tests** view — a left "route tree" of cluster paths (e.g. `/components/button/[variant]`) with A/B/C variant chips, each route expandable into an inline thumbnail grid; right pane shows the selected screenshot at near-full panel width with the same email-verify banner Meticulous uses, plus a "And sub-variants N tested" strip of sibling thumbnails below. (2) **Changes** view — a Grouping radio (HTML Diff / URLs / User Flow), then collapsible "Change #N" sections of thumbnails with red diff marks; the active "After" tile gets a purple outline and the right pane highlights the changed region with a pulsing orange ring.',
      },
    },
  },
} satisfies Meta<typeof MeticulousV2Review>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Tests view (default). Routes expanded; thumbnail grids visible per
 * cluster. Click any thumbnail to swap the big preview.
 */
export const Tests: Story = {
  args: {
    data: mockReviewData,
    initialMode: 'tests',
  },
};

/**
 * Changes view. Grouping radio at the top, "Change #1, #2…" sections
 * below with red diff marks on each thumbnail. Active tile shows the
 * "After" overlay; right pane has the pulsing highlight ring.
 */
export const Changes: Story = {
  args: {
    data: mockReviewData,
    initialMode: 'changes',
  },
};

/**
 * Mixed-size dataset (page-level layouts and onboarding screens).
 * Verifies the thumbnail grid still reads when the underlying stories
 * are full-app shells, not just small components.
 */
export const MixedSize: Story = {
  args: {
    data: mockMixedSizeData,
    initialMode: 'tests',
  },
};
