import React from 'react';

import { Button } from 'storybook/internal/components';
import type { Addon_BaseType } from 'storybook/internal/types';

import { BottomBarIcon, SidebarAltIcon } from '@storybook/icons';

import { Consumer, types } from 'storybook/manager-api';
import type { Combo } from 'storybook/manager-api';

const SHOW_ADDON_PANEL_BUTTON_ID = 'storybook-show-addon-panel';

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
            <Button
              padding="small"
              variant="ghost"
              ariaLabel="Show addon panel"
              id={SHOW_ADDON_PANEL_BUTTON_ID}
              key="addons"
              onClick={toggle}
            >
              {panelPosition === 'bottom' ? <BottomBarIcon /> : <SidebarAltIcon />}
            </Button>
          </>
        )
      }
    </Consumer>
  ),
};
