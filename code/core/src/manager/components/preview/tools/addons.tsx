import React from 'react';

import { Button } from 'storybook/internal/components';
import type { Addon_BaseType } from 'storybook/internal/types';

import { BottomBarIcon, SidebarAltIcon } from '@storybook/icons';

import { Consumer, types } from 'storybook/manager-api';
import type { Combo } from 'storybook/manager-api';

import { focusableUIElements } from '../../../../manager-api/modules/layout';
import { useRegionFocusAnimation } from '../../layout/useLandmarkIndicator';

const SHOW_ADDON_PANEL_BUTTON_ID = 'storybook-show-addon-panel';

const menuMapper = ({ api, state }: Combo) => ({
  isVisible: api.getIsPanelShown(),
  singleStory: state.singleStory,
  panelPosition: state.layout.panelPosition,
  showPanel: async (animateLandmark?: (e: HTMLElement | null) => void) => {
    api.togglePanel(true);
    const success = await api.focusOnUIElement(focusableUIElements.addonPanel, {
      forceFocus: true,
      poll: true,
    });
    if (success) {
      animateLandmark?.(document.getElementById(focusableUIElements.addonPanel));
    }
  },
});

export const addonsTool: Addon_BaseType = {
  title: 'addons',
  id: 'addons',
  type: types.TOOL,
  match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
  render: () => {
    const animateLandmark = useRegionFocusAnimation();

    return (
      <Consumer filter={menuMapper}>
        {({ isVisible, showPanel, singleStory, panelPosition }) =>
          !singleStory &&
          !isVisible && (
            <>
              <Button
                padding="small"
                variant="ghost"
                ariaLabel="Show addon panel"
                id={SHOW_ADDON_PANEL_BUTTON_ID}
                key="addons"
                onClick={() => showPanel()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    showPanel(animateLandmark);
                  }
                }}
              >
                {panelPosition === 'bottom' ? <BottomBarIcon /> : <SidebarAltIcon />}
              </Button>
            </>
          )
        }
      </Consumer>
    );
  },
};
