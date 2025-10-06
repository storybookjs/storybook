import React from 'react';

import { addons, types } from 'storybook/manager-api';

import { OutlineSelector } from './OutlineSelector';
import { ADDON_ID } from './constants';

export default addons.register(ADDON_ID, () => {
  if (globalThis?.FEATURES?.outline) {
    addons.add(ADDON_ID, {
      title: 'Outline',
      type: types.TOOL,
      match: ({ viewMode, tabId }) => !!(viewMode && viewMode.match(/^(story|docs)$/)) && !tabId,
      render: () => <OutlineSelector />,
    });
  }
});
