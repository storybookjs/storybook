import React, { type FC } from 'react';

import { useChannel, useStorybookApi } from 'storybook/manager-api';

import { ReviewProvider, isReviewPath } from './ReviewProvider.tsx';
import { ReviewSummaryPortal } from './ReviewSummaryPortal.tsx';
import { EVENTS, REVIEW_CHANGES_URL } from './constants.ts';
import { useReviewNavigationInterceptor } from './useReviewNavigationInterceptor.ts';
import { useReviewShortcuts } from './useReviewShortcuts.ts';

const ReviewNavigationLayer: FC = () => {
  const api = useStorybookApi();
  useReviewNavigationInterceptor();
  useReviewShortcuts();

  // Surface the summary when a review is pushed while the user is elsewhere.
  useChannel({
    [EVENTS.DISPLAY_REVIEW]: () => {
      const currentPath = new URLSearchParams(window.location.search).get('path') ?? '';
      if (!isReviewPath(currentPath)) {
        api.navigate(REVIEW_CHANGES_URL);
      }
    },
  });

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
