import React from 'react';

import { addons, getFeatures, types } from '@storybook/manager/manager-api';

import { Tool } from './Tool.tsx';
import { ADDON_ID, TOOL_ID } from './constants.ts';

export default addons.register(ADDON_ID, () => {
  if (getFeatures().measure) {
    addons.add(TOOL_ID, {
      type: types.TOOL,
      title: 'Measure',
      match: ({ viewMode }) => viewMode === 'story',
      render: () => <Tool />,
    });
  }
});
