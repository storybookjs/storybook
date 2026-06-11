import React from 'react';

import { addons, types } from 'storybook/manager-api';

import { reviewCompareTool } from './ReviewCompareTool.tsx';
import { ReviewProvider } from './ReviewProvider.tsx';
import { reviewPreviewWrapper } from './ReviewPreviewWrapper.tsx';
import { ReviewSummaryPortal } from './ReviewSummaryPortal.tsx';
import { ReviewToolbarHeader } from './ReviewToolbarHeader.tsx';
import {
  ADDON_ID,
  PAGE_ID,
  REVIEW_CHANGES_URL,
  RESTORE_NAV_SESSION_KEY,
  EVENTS,
} from './constants.ts';
import { isReviewPath } from './ReviewProvider.tsx';
import {
  REVIEW_COLLECTION_QUERY_PARAM,
  isReviewSessionPath,
  parseCollectionIndex,
} from './review-navigation.ts';
import { sessionStore } from './session-store.ts';
import { useReviewNavigationInterceptor } from './useReviewNavigationInterceptor.ts';
import { useReviewShortcuts } from './useReviewShortcuts.ts';

const ReviewPersistentLayer = () => (
  <ReviewProvider>
    <ReviewNavigationLayer />
  </ReviewProvider>
);

const ReviewNavigationLayer = () => {
  useReviewNavigationInterceptor();
  useReviewShortcuts();
  return <ReviewSummaryPortal />;
};

addons.register(ADDON_ID, (api) => {
  const query = new URLSearchParams(window.location.search);
  const path = query.get('path') ?? '';
  const collectionIndex = parseCollectionIndex(
    query.get(REVIEW_COLLECTION_QUERY_PARAM) ?? undefined
  );
  const restoreNav = sessionStore.read(RESTORE_NAV_SESSION_KEY);
  if (!isReviewSessionPath(path, collectionIndex) && restoreNav !== null) {
    sessionStore.remove(RESTORE_NAV_SESSION_KEY);
    if (restoreNav === 'restore') {
      api.toggleNav(true);
    }
  }

  api.getChannel()?.on(EVENTS.DISPLAY_REVIEW, () => {
    const currentPath = new URLSearchParams(window.location.search).get('path') ?? '';
    if (!isReviewPath(currentPath)) {
      api.navigate(REVIEW_CHANGES_URL);
    }
  });

  addons.add(PAGE_ID, {
    type: types.experimental_PAGE,
    url: REVIEW_CHANGES_URL,
    title: 'Review changes',
    render: null,
    persistentRender: ReviewPersistentLayer,
  });

  addons.add(`${ADDON_ID}/toolbar-header`, {
    type: types.TOOLBAR_HEADER,
    title: 'Review navigation',
    match: ({ viewMode }) => viewMode === 'story',
    render: () => <ReviewToolbarHeader />,
  });

  addons.add('storybook/addon-review/compare', reviewCompareTool);
  addons.add('storybook/addon-review/preview', reviewPreviewWrapper);
});
