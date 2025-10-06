import * as React from 'react';

import { addons, types } from 'storybook/manager-api';

import { ViewportTool } from './components/Tool';
import { ADDON_ID, TOOL_ID } from './constants';

export default addons.register(ADDON_ID, (api) => {
  if (globalThis?.FEATURES?.viewport) {
    addons.add(TOOL_ID, {
      title: 'viewport / media-queries',
      type: types.TOOL,
      match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
      render: () => <ViewportTool api={api} />,
    });
  }
});
