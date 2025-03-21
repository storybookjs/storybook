import * as React from 'react';

import { addons, types } from 'storybook/manager-api';

import { ViewportTool } from './components/Tool';
import { ADDON_ID } from './constants';

addons.register(ADDON_ID, (api) => {
  addons.add(ADDON_ID, {
    title: 'viewport / media-queries',
    type: types.TOOL,
    match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
    render: () => <ViewportTool api={api} />,
  });
});
