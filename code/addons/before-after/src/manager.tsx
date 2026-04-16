import React from 'react';

import { addons, types } from 'storybook/manager-api';
import { Route } from 'storybook/internal/router';

import { ADDON_ID, PAGE_ID, TOOL_ID, CHANGES_URL } from './constants.ts';
import { ChangesPage } from './components/ChangesPage.tsx';
import { ChangesToolbarIcon } from './components/ChangesToolbarIcon.tsx';

addons.register(ADDON_ID, () => {
  addons.add(PAGE_ID, {
    type: types.experimental_PAGE,
    url: CHANGES_URL,
    title: 'Changes',
    render: () => (
      <Route path={CHANGES_URL} startsWith>
        <ChangesPage />
      </Route>
    ),
  });

  addons.add(TOOL_ID, {
    type: types.TOOLEXTRA,
    title: 'Changes',
    match: ({ viewMode }) => viewMode === 'story' || viewMode === 'docs',
    render: () => <ChangesToolbarIcon />,
  });
});
