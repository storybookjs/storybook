import React from 'react';

import { IconButton } from 'storybook/internal/components';
import { Consumer, types } from 'storybook/internal/manager-api';
import type { Combo } from 'storybook/internal/manager-api';
import type { Addon_BaseType } from 'storybook/internal/types';

import { BottomBarIcon, SidebarAltIcon } from '@storybook/icons';

const menuMapper = ({ api, state }: Combo) => ({
  isVisible: api.getIsPanelShown(),
  singleStory: state.singleStory,
  panelPosition: state.layout.panelPosition,
  toggle: () => api.togglePanel(),
});

export const addonsTool: Addon_BaseType = {
  title: 'addons',
  id: 'addons',
  type: types.TOOL,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => (
    <Consumer filter={menuMapper}>
      {({ isVisible, toggle, singleStory, panelPosition }) =>
        !singleStory &&
        !isVisible && (
          <>
            <IconButton aria-label="Show addons" key="addons" onClick={toggle} title="Show addons">
              {panelPosition === 'bottom' ? <BottomBarIcon /> : <SidebarAltIcon />}
            </IconButton>
          </>
        )
      }
    </Consumer>
  ),
};
