import * as React from 'react';

import { addons, getFeatures, types } from '@storybook/manager/manager-api';

import { ViewportTool } from './components/Tool.tsx';
import { ADDON_ID, TOOL_ID } from '@storybook/core/internal/deep/shared/viewport/constants';

export default addons.register(ADDON_ID, () => {
  if (getFeatures().viewport) {
    addons.add(TOOL_ID, {
      title: 'viewport / media-queries',
      type: types.TOOL,
      match: ({ viewMode }) => viewMode === 'story',
      render: () => <ViewportTool />,
    });
  }
});
