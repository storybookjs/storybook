/**
 * Manager entry - registers the addon panel in Storybook manager
 */

import React from 'react';
import { addons, types } from 'storybook/manager-api';
import { ADDON_ID, PANEL_ID, PARAM_KEY } from './constants';
import { Panel } from './Panel';

addons.register(ADDON_ID, (api) => {
  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: '⚡ Performance',
    match: ({ viewMode }) => viewMode === 'story',
    paramKey: PARAM_KEY,
    render: ({ active }) => {
      const storyData = api.getCurrentStoryData();
      const storyId = storyData?.id;

      return <Panel active={!!active} storyId={storyId} />;
    },
  });
});
