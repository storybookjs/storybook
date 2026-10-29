import React from 'react';

import { addons, types } from '@storybook/manager/manager-api';

import { OutlineSelector } from './OutlineSelector.tsx';
import { ADDON_ID } from './constants.ts';

export default addons.register(ADDON_ID, () => {
  addons.add(ADDON_ID, {
    title: 'Outline',
    type: types.TOOL,
    match: ({ viewMode }) => !!(viewMode && viewMode.match(/^(story|docs)$/)),
    render: () => <OutlineSelector />,
  });
});
