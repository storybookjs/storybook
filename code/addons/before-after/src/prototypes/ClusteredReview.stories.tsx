import React from 'react';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { ClusteredReview } from './ClusteredReview.tsx';
import { mockReviewData } from './mockData.ts';
import { withAdeMode } from './withAdeMode.tsx';

const meta = {
  title: 'prototypes/Review · Clustered (AI categorisation)',
  component: ClusteredReview,
  decorators: [withAdeMode],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Prototype B — iteration-1.5 or iteration-2: AI cluster signatures shape the review page. Default ("zoom-out") view is a grid of cluster cards with the agent\'s rationale + a representative story preview. Click a cluster to "zoom in" to its member stories. Real cluster shapes are drawn from the medium-scenario eval (1,025-story Button.tsx edit → 6 UX-usable clusters).',
      },
    },
  },
} satisfies Meta<typeof ClusteredReview>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Default — opens on the zoom-out view (cluster grid). Click any
 * cluster card to drill in.
 */
export const ZoomOut: Story = {
  args: {
    data: mockReviewData,
  },
};

/**
 * Variant — fewer clusters (5 instead of 6) to represent the small-
 * cascade case where the agent groups more tightly.
 */
export const FewerClusters: Story = {
  args: {
    data: {
      ...mockReviewData,
      cascadeSize: 116,
      modifiedCount: 51,
      relatedCount: 65,
      clusters: mockReviewData.clusters.slice(0, 5),
    },
  },
};

/**
 * Edge case — single huge cluster (e.g. cascade resolves to one
 * coherent root cause). Verifies the layout still works at this
 * extreme.
 */
export const SingleCluster: Story = {
  args: {
    data: {
      ...mockReviewData,
      cascadeSize: 200,
      modifiedCount: 50,
      relatedCount: 150,
      clusters: [
        {
          ...mockReviewData.clusters[0],
          id: 'single-coherent-cluster',
          rationale:
            'All flagged stories share the same root cause — a single CSS-prop change on the Button component. No further sub-clustering would be useful.',
          totalStoryCount: 200,
        },
      ],
    },
  },
};
