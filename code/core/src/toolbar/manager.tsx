import React from 'react';

import { addons, types } from 'storybook/manager-api';

import { ToolbarManager } from './components/ToolbarManager';
import { TOOLBAR_ID } from './constants';

// Register the toolbar in the manager
addons.register(TOOLBAR_ID, () =>
  addons.add(TOOLBAR_ID, {
    title: TOOLBAR_ID,
    type: types.TOOL,
    match: ({ tabId }) => !tabId,
    render: () => <ToolbarManager />,
  })
);
