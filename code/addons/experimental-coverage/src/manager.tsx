import React from 'react';

import { STORY_CHANGED } from 'storybook/internal/core-events';
import { addons } from 'storybook/internal/manager-api';
import { Addon_TypesEnum } from 'storybook/internal/types';

import { ADDON_ID, REQUEST_EVENT } from './constants';
import { CoveragePanel } from './coverage-panel';

addons.register(ADDON_ID, (api) => {
  addons.add(ADDON_ID, {
    title: 'Coverage',
    type: Addon_TypesEnum.PANEL,
    match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
    render: ({ active }) => <CoveragePanel active={!!active} api={api} />,
  });

  api.on(STORY_CHANGED, () => {
    const { importPath, ...data } = api.getCurrentStoryData();
    api.emit(REQUEST_EVENT, {
      importPath,
      componentPath: (data as any).componentPath as string,
    });
  });
});
