import React from 'react';

import { addons, types } from 'storybook/internal/manager-api';

import { OutlineSelector } from './OutlineSelector';
import { ADDON_ID } from './constants';

addons.register(ADDON_ID, () => {
  addons.add(ADDON_ID, {
    title: 'Outline',
    type: types.TOOL,
    match: ({ viewMode, tabId }) => !!(viewMode && viewMode.match(/^(story|docs)$/)) && !tabId,
    render: () => <OutlineSelector />,
  });
});
