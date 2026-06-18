import React from 'react';

import { addons, types } from 'storybook/manager-api';

import { reviewCompareTool } from './ReviewCompareTool.tsx';
import { ReviewProvider } from './ReviewProvider.tsx';
import { reviewPreviewWrapper } from './ReviewPreviewWrapper.tsx';
import { ReviewSummaryPortal } from './ReviewSummaryPortal.tsx';
import { ReviewToolbarHeader } from './ReviewToolbarHeader.tsx';
import { ADDON_ID, PAGE_ID, REVIEW_CHANGES_URL, EVENTS } from './constants.ts';
import { isReviewPath } from './ReviewProvider.tsx';
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
