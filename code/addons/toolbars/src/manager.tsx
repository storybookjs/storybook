import React from 'react';
import { addons, types } from 'storybook/internal/manager-api';
import { ToolbarManager } from './components/ToolbarManager';
import { ADDON_ID } from './constants';

addons.register(ADDON_ID, () =>
  addons.add(ADDON_ID, {
    title: ADDON_ID,
    type: types.TOOL,
    match: ({ tabId }) => !tabId,
    render: () => <ToolbarManager />,
  })
);
