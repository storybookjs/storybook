import React from 'react';

import { addons, types } from 'storybook/manager-api';

import { BackgroundTool } from './components/Tool';
import { ADDON_ID } from './constants';

export default addons.register(ADDON_ID, () => {
  if (globalThis?.FEATURES?.backgrounds) {
    addons.add(ADDON_ID, {
      title: 'Backgrounds',
      type: types.TOOL,
      match: ({ viewMode, tabId }) => !!(viewMode && viewMode.match(/^(story|docs)$/)) && !tabId,
      render: () => <BackgroundTool />,
    });
  }
});
