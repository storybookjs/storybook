import React from 'react';

import { addons, types } from 'storybook/internal/manager-api';
import { styled } from 'storybook/internal/theming';

import { BackgroundTool } from './components/Tool';
import { ADDON_ID } from './constants';
import { BackgroundToolLegacy } from './legacy/BackgroundSelectorLegacy';
import { GridToolLegacy } from './legacy/GridSelectorLegacy';

addons.register(ADDON_ID, () => {
  addons.add(ADDON_ID, {
    title: 'Backgrounds',
    type: types.TOOL,
    match: ({ viewMode, tabId }) => !!(viewMode && viewMode.match(/^(story|docs)$/)) && !tabId,
    render: () =>
      FEATURES?.backgroundsStoryGlobals ? (
        <BackgroundTool />
      ) : (
        <ToolList>
          <li>
            <BackgroundToolLegacy />
          </li>
          <li>
            <GridToolLegacy />
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
