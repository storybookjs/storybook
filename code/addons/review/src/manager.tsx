import React from 'react';

import { addons, types } from 'storybook/manager-api';
import { Route } from 'storybook/internal/router';

import {
  ADDON_ID,
  PAGE_ID,
  REVIEW_CHANGES_URL,
  RESTORE_NAV_SESSION_KEY,
  EVENTS,
} from './constants.ts';
import { ReviewPage } from './ReviewPage.tsx';
import { sessionStore } from './session-store.ts';

addons.register(ADDON_ID, (api) => {
  // Safety net: the review page hides the sidebar and has no in-app exit, so
  // if the user left it via a full reload (typed URL, bookmark) the
  // component cleanup never ran. On any manager load that is NOT the review
  // route, restore a sidebar we hid. SPA exits (browser back) are already
  // handled by ReviewPage's effect cleanup.
  const path = new URLSearchParams(window.location.search).get('path') ?? '';
  const restoreNav = sessionStore.read(RESTORE_NAV_SESSION_KEY);
  if (!path.startsWith(REVIEW_CHANGES_URL) && restoreNav !== null) {
    // Clear both 'restore' and 'keep' so a stale marker can't block fresh
    // nav-state capture on the next review visit.
    sessionStore.remove(RESTORE_NAV_SESSION_KEY);
    if (restoreNav === 'restore') {
      api.toggleNav(true);
    }
  }

  // When the agent pushes a review, pull any open tab to the page — but only
  // if it is not already there. The review page replays cached state on load
  // (REQUEST_REVIEW), which echoes back as DISPLAY_REVIEW; without
  // this guard that echo would re-navigate to the bare review URL, dropping
  // the detail subpath and bouncing a detail page to the summary.
  api.getChannel()?.on(EVENTS.DISPLAY_REVIEW, () => {
    const currentPath = new URLSearchParams(window.location.search).get('path') ?? '';
    if (!currentPath.startsWith(REVIEW_CHANGES_URL)) {
      api.navigate(REVIEW_CHANGES_URL);
    }
  });

  addons.add(PAGE_ID, {
    type: types.experimental_PAGE,
    url: REVIEW_CHANGES_URL,
    title: 'Review changes',
    render: () => (
      <Route path={REVIEW_CHANGES_URL} startsWith>
        <ReviewPage />
      </Route>
    ),
  });
});
