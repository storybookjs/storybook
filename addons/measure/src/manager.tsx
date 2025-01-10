import React from 'react';

import { addons, types } from 'storybook/internal/manager-api';

import { Tool } from './Tool';
import { ADDON_ID, TOOL_ID } from './constants';

addons.register(ADDON_ID, () => {
  addons.add(TOOL_ID, {
    type: types.TOOL,
    title: 'Measure',
    match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
    render: () => <Tool />,
  });
});
