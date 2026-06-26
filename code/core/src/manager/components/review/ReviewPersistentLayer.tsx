import React, { type FC } from 'react';

import { ReviewProvider } from './ReviewProvider.tsx';
import { ReviewSummaryPortal } from './ReviewSummaryPortal.tsx';
import { useReviewNavigationInterceptor } from './useReviewNavigationInterceptor.ts';
import { useReviewShortcuts } from './useReviewShortcuts.ts';

const ReviewNavigationLayer: FC = () => {
  useReviewNavigationInterceptor();
  useReviewShortcuts();

  return <ReviewSummaryPortal />;
};

/**
 * Always-mounted review layer. Hosts the review state provider, navigation
 * interceptor/shortcuts, and the summary portal so review survives story
 * navigation. Self-gates: the provider stays dormant until a review is pushed.
 */
export const ReviewPersistentLayer: FC = () => (
  <ReviewProvider>
    <ReviewNavigationLayer />
  </ReviewProvider>
);
