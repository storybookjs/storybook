import React from 'react';
import { addons, types } from 'storybook/internal/manager-api';
import { styled } from 'storybook/internal/theming';

import { ADDON_ID } from './constants';
import { BackgroundSelector } from './containers/BackgroundSelector';
import { GridSelector } from './containers/GridSelector';

addons.register(ADDON_ID, () => {
  addons.add(ADDON_ID, {
    title: 'Backgrounds',
    type: types.TOOL,
    match: ({ viewMode, tabId }) => !!(viewMode && viewMode.match(/^(story|docs)$/)) && !tabId,
    render: () => (
      <ToolList>
        <li>
          <BackgroundSelector />
        </li>
        <li>
          <GridSelector />
        </li>
      </ToolList>
    ),
  });
});

const ToolList = styled.ul({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  listStyle: 'none',
  padding: 0,
  margin: 0,
});
