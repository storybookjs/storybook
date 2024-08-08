import * as React from 'react';
import { addons, types } from 'storybook/internal/manager-api';

import { ADDON_ID } from './constants';

import { ViewportToolLegacy } from './legacy/ToolLegacy';
import { ViewportTool } from './components/Tool';

addons.register(ADDON_ID, (api) => {
  addons.add(ADDON_ID, {
    title: 'viewport / media-queries',
    type: types.TOOL,
    match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
    render: () =>
      FEATURES?.viewportStoryGlobals ? <ViewportTool api={api} /> : <ViewportToolLegacy />,
  });
});
