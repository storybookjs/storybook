import React from 'react';

import { addons, types } from 'storybook/manager-api';
import { Route } from 'storybook/internal/router';

import { ADDON_ID, PAGE_ID, REVIEW_CHANGES_URL, EVENTS } from './constants.ts';
import { ReviewChangesPage } from './ReviewChangesPage.tsx';

addons.register(ADDON_ID, (api) => {
  // When the agent pushes a review, navigate any open tab to the page.
  api.getChannel()?.on(EVENTS.APPLY_REVIEW_STATE, () => {
    api.navigate(REVIEW_CHANGES_URL);
  });

  addons.add(PAGE_ID, {
    type: types.experimental_PAGE,
    url: REVIEW_CHANGES_URL,
    title: 'Review changes',
    render: () => (
      <Route path={REVIEW_CHANGES_URL} startsWith>
        <ReviewChangesPage />
      </Route>
    ),
  });
});
