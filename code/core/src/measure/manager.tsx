import React from 'react';

import { addons, types } from 'storybook/manager-api';

import { Tool } from './Tool';
import { ADDON_ID, TOOL_ID } from './constants';

export default addons.register(ADDON_ID, () => {
  if (globalThis?.FEATURES?.measure) {
    addons.add(TOOL_ID, {
      type: types.TOOL,
      title: 'Measure',
      match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
      render: () => <Tool />,
    });
  }
});
