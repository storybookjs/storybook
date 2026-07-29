import React, { type FC } from 'react';

import { ReviewSummaryHost } from '../screens/ReviewSummaryHost.tsx';
import { useReviewNavigationInterceptor } from '../useReviewNavigationInterceptor.ts';
import { ReviewNotification } from './ReviewNotification.tsx';
import { ReviewProvider } from './ReviewProvider.tsx';

const ReviewNavigationLayer: FC = () => {
  useReviewNavigationInterceptor();

  return (
    <>
      <ReviewNotification />
      <ReviewSummaryHost />
    </>
  );
};

/**
 * Always-mounted review layer, rendered in the Layout's overlay slot. Hosts the review state
 * provider, navigation interceptor/shortcuts, and the summary host so review survives story
 * navigation. Self-gates: the provider stays dormant until a review is pushed.
 */
export const ReviewPersistentLayer: FC = () => (
  <ReviewProvider>
    <ReviewNavigationLayer />
  </ReviewProvider>
);
