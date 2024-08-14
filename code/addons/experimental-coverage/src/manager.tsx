import React from 'react';

import { STORY_RENDERED } from 'storybook/internal/core-events';
import { addons } from 'storybook/internal/manager-api';
import { Addon_TypesEnum } from 'storybook/internal/types';

import { ADDON_ID, REQUEST_COVERAGE_EVENT } from './constants';
import { CoveragePanel } from './coverage-panel';

addons.register(ADDON_ID, (api) => {
  addons.add(ADDON_ID, {
    title: 'Coverage',
    type: Addon_TypesEnum.PANEL,
    match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
    render: ({ active }) => <CoveragePanel active={!!active} api={api} />,
  });

  const emitRequest = () => {
    const { importPath, ...data } = api.getCurrentStoryData();
    api.emit(REQUEST_COVERAGE_EVENT, {
      importPath,
      componentPath: (data as any).componentPath as string,
    });
  };

  api.on(STORY_RENDERED, emitRequest);
});
