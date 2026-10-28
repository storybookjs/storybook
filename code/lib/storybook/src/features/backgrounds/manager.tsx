import React from 'react';

import { addons, getFeatures, types } from '@storybook/manager/manager-api';

import { BackgroundTool } from './components/Tool.tsx';
import { ADDON_ID } from './constants.ts';

export default addons.register(ADDON_ID, () => {
  if (getFeatures().backgrounds) {
    addons.add(ADDON_ID, {
      title: 'Backgrounds',
      type: types.TOOL,
      match: ({ viewMode }) => !!(viewMode && viewMode.match(/^(story|docs)$/)),
      render: () => <BackgroundTool />,
    });
  }
});
