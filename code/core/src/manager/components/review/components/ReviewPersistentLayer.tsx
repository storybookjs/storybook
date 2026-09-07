import React, { type FC } from 'react';

import { ReviewSummaryHost } from '../screens/ReviewSummaryHost.tsx';
import { useReviewNavigationInterceptor } from '../useReviewNavigationInterceptor.ts';
import { ReviewNotification } from './ReviewNotification.tsx';

/**
 * Always-mounted review layer, rendered in the Layout's overlay slot beneath the
 * app-level ReviewProvider. Hosts the navigation interceptor/shortcuts, the
 * arrival notification, and the summary host so review survives story navigation.
 */
export const ReviewPersistentLayer: FC = () => {
  useReviewNavigationInterceptor();

  return (
    <>
      <ReviewNotification />
      <ReviewSummaryHost />
    </>
  );
};
