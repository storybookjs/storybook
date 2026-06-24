import React, { useCallback, useLayoutEffect, type FC } from 'react';

import { WandIcon } from '@storybook/icons';

import { useNavigate } from 'storybook/internal/router';
import { useStorybookApi, useStorybookState } from 'storybook/manager-api';
import { useTheme } from 'storybook/theming';

import { reviewAvailableNotificationId } from '../constants.ts';
import { navigateToReviewSummary } from '../review-actions.ts';
import {
  acceptReviewNotification,
  claimNotificationSlot,
  pickReviewToNotify,
  readCollectionIndex,
  shouldAutoAcceptOnRoute,
} from '../review-notification.ts';
import { reviewStore, useReview } from '../review-store.ts';
import { useReviewFiltersRef } from '../useReviewFiltersRef.ts';

/** Sidebar notification for unseen review pushes. Does not auto-navigate. */
export const ReviewNotification: FC = () => {
  const api = useStorybookApi();
  const theme = useTheme();
  const navigate = useNavigate();
  const { path, customQueryParams } = useStorybookState();
  const { state, notificationKey, onAcceptPendingUpdate } = useReview();
  const filtersRef = useReviewFiltersRef();
  const collectionIndex = readCollectionIndex(customQueryParams);

  const openReview = useCallback(() => {
    navigateToReviewSummary(api, navigate, filtersRef.current);
  }, [api, navigate, filtersRef]);

  const handleNotificationClick = useCallback(
    (createdAt: number) => {
      const deferred = reviewStore.getPendingReview();
      if (deferred?.createdAt === createdAt) {
        onAcceptPendingUpdate();
        return;
      }
      acceptReviewNotification(api, createdAt);
      openReview();
    },
    [api, onAcceptPendingUpdate, openReview]
  );

  useLayoutEffect(() => {
    const displayed = state;
    const deferred = reviewStore.getPendingReview();
    const review = pickReviewToNotify(displayed, deferred);
    if (!review) {
      return;
    }

    if (shouldAutoAcceptOnRoute(path, collectionIndex, review, displayed, deferred)) {
      acceptReviewNotification(api, review.createdAt);
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
      icon: <WandIcon color={theme.fgColor.agentic} />,
      onClick: ({ onDismiss }) => {
        handleNotificationClick(createdAt);
        onDismiss();
      },
    });
  }, [api, collectionIndex, handleNotificationClick, notificationKey, path, state, theme]);

  return null;
};
