import React from 'react';

import { STORY_RENDERED } from 'storybook/internal/core-events';
import { addons } from 'storybook/internal/manager-api';
import { Addon_TypesEnum } from 'storybook/internal/types';

import { ADDON_ID, REQUEST_COVERAGE_EVENT, type RequestCoverageEventPayload } from './constants';
import { CoveragePanel } from './manager/coverage-panel';
import { CoverageTitle } from './manager/coverage-title';

let initialRequest = true;

addons.register(ADDON_ID, (api) => {
  addons.add(ADDON_ID, {
    title: CoverageTitle,
    type: Addon_TypesEnum.PANEL,
    match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
    render: ({ active }) => <CoveragePanel active={!!active} api={api} />,
  });

  const emitRequest = () => {
    const { importPath, type, ...data } = api.getCurrentStoryData();
    if (type === 'docs') {
      return;
    }

    api.emit(REQUEST_COVERAGE_EVENT, {
      importPath,
      componentPath: (data as any).componentPath as string,
      initialRequest,
    } satisfies RequestCoverageEventPayload);

    initialRequest = false;
  };

  api.on(STORY_RENDERED, emitRequest);
});
