import React from 'react';

import { ADDON_ID, PANEL_ID, PARAM_KEY, SNIPPET_RENDERED } from 'storybook/internal/docs-tools';
import { addons, types } from 'storybook/manager-api';

import { CodePanel } from './CodePanel.tsx';

addons.register(ADDON_ID, (api) => {
  addons.add(PANEL_ID, {
    title: 'Code',
    type: types.PANEL,
    paramKey: PARAM_KEY,
    disabled: (parameters) => parameters?.docs?.codePanel === false,
    match: ({ viewMode }) => viewMode === 'story',
    render: ({ active }) => {
      const channel = api.getChannel();
      const currentStory = api.getCurrentStoryData();

      const lastEvent = channel?.last(SNIPPET_RENDERED)?.[0];

      return (
        <CodePanel
          currentStoryId={currentStory?.id}
          storyParameters={currentStory?.parameters}
          storyPrepared={currentStory?.prepared}
          lastEvent={lastEvent}
          active={active}
        />
      );
    },
  });
});
