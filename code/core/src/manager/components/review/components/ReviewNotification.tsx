import React, { useCallback, useLayoutEffect, type FC } from 'react';

import { WandIcon } from '@storybook/icons';

import { useNavigate } from 'storybook/internal/router';
import { useStorybookApi, useStorybookState } from 'storybook/manager-api';
import { reviewAvailableNotificationId } from '../constants.ts';
import { navigateToReviewSummary } from '../review-actions.ts';
import {
  acceptReviewNotification,
  claimNotificationSlot,
  pickReviewToNotify,
  readCollectionIndex,
  shouldAutoAcceptOnRoute,
  shouldSkipArrivalNotification,
} from '../review-notification.ts';
import { reviewStore, useReview } from '../review-store.ts';
import { useReviewFiltersRef } from '../useReviewFiltersRef.ts';

/** Sidebar notification for unseen review pushes. Does not auto-navigate. */
export const ReviewNotification: FC = () => {
  const api = useStorybookApi();
  const navigate = useNavigate();
  const { path, customQueryParams } = useStorybookState();
  const { state: displayed, pendingReview: deferred, onAcceptPendingUpdate } = useReview();
  const filtersRef = useReviewFiltersRef();
  const collectionIndex = readCollectionIndex(customQueryParams);

  const openReview = useCallback(() => {
    navigateToReviewSummary(api, navigate, filtersRef.current);
  }, [api, navigate, filtersRef]);

  const handleNotificationClick = useCallback(
    (createdAt: number) => {
      if (reviewStore.getState().pendingReview?.createdAt === createdAt) {
        onAcceptPendingUpdate();
        return;
      }
      acceptReviewNotification(api, createdAt);
      openReview();
    },
    [api, onAcceptPendingUpdate, openReview]
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
