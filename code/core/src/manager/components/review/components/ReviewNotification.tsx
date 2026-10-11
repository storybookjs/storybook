import React, { useCallback, useLayoutEffect, useRef, type FC } from 'react';

import { WandIcon } from '@storybook/icons';

import { useStorybookApi, useStorybookState } from 'storybook/manager-api';
import { reviewAvailableNotificationId } from '../constants.ts';
import { useReviewContext, type ReviewBanner } from '../review-context.ts';
import {
  acceptReviewNotification,
  claimNotificationSlot,
  pickReviewToNotify,
  readCollectionIndex,
  shouldAutoAcceptOnRoute,
  shouldSkipArrivalNotification,
} from '../review-notification.ts';
import type { ReviewState } from '../review-state.ts';

/** Sidebar notification for unseen review pushes. Does not auto-navigate. */
export const ReviewNotification: FC = () => {
  const api = useStorybookApi();
  const { path, customQueryParams } = useStorybookState();
  const { review: displayed, pendingReview: deferred, banner, openSummary } = useReviewContext();
  const collectionIndex = readCollectionIndex(customQueryParams);

  // Notification clicks fire long after the closure was created, so they read
  // the latest pending/banner through refs instead of a render-time snapshot.
  const deferredRef = useRef<ReviewState | null>(deferred);
  deferredRef.current = deferred;
  const bannerRef = useRef<ReviewBanner>(banner);
  bannerRef.current = banner;

  const handleNotificationClick = useCallback(
    (createdAt: number) => {
      const pendingReview = deferredRef.current;
      const currentBanner = bannerRef.current;
      if (pendingReview?.createdAt === createdAt && currentBanner?.kind === 'pending-update') {
        currentBanner.onAccept();
        return;
      }
      acceptReviewNotification(api, createdAt);
      openSummary();
    },
    [api, openSummary]
  );

  useLayoutEffect(() => {
    const review = pickReviewToNotify(displayed, deferred);
    if (!review) {
      return;
    }

    if (shouldAutoAcceptOnRoute(path, collectionIndex, review, displayed, deferred)) {
      acceptReviewNotification(api, review.createdAt);
      return;
    }

    if (shouldSkipArrivalNotification(path, collectionIndex, review, displayed, deferred)) {
      return;
    }

    const createdAt = review.createdAt;
    if (
      createdAt === undefined ||
      !claimNotificationSlot(api, createdAt, displayed?.createdAt, deferred?.createdAt)
    ) {
      return;
    }

    api.addNotification({
      id: reviewAvailableNotificationId(createdAt),
      content: {
        headline: 'New review available',
        subHeadline: review.title ?? 'Open the curated review to spot-check your changes',
      },
      icon: <WandIcon />,
      onClick: ({ onDismiss }) => {
        handleNotificationClick(createdAt);
        onDismiss();
      },
    });
  }, [api, collectionIndex, handleNotificationClick, displayed, deferred, path]);

  return null;
};
