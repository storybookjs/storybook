import React from 'react';

import { Button, Separator } from 'storybook/internal/components';
import type { Addon_BaseType } from 'storybook/internal/types';

import { MenuIcon } from '@storybook/icons';

import { Consumer, types } from 'storybook/manager-api';
import type { Combo } from 'storybook/manager-api';

import { focusableUIElements } from '../../../../manager-api/modules/layout';
import { useRegionFocusAnimation } from '../../layout/useLandmarkIndicator';

const menuMapper = ({ api, state }: Combo) => ({
  isVisible: api.getIsNavShown(),
  singleStory: state.singleStory,
  viewMode: state.viewMode,
  showSidebar: async (animateLandmark?: (e: HTMLElement | null) => void) => {
    api.toggleNav(true);
    const success = await api.focusOnUIElement(focusableUIElements.sidebarRegion, {
      forceFocus: true,
      poll: true,
    });
    if (success) {
      animateLandmark?.(document.getElementById(focusableUIElements.sidebarRegion));
    }
  },
});

export const menuTool: Addon_BaseType = {
  title: 'menu',
  id: 'menu',
  type: types.TOOL,
  // @ts-expect-error (non strict)
  match: ({ viewMode }) => ['story', 'docs'].includes(viewMode),
  render: () => {
    const animateLandmark = useRegionFocusAnimation();

    return (
      <Consumer filter={menuMapper}>
        {({ isVisible, showSidebar, singleStory }) =>
          !singleStory &&
          !isVisible && (
            <>
              <Button
                padding="small"
                variant="ghost"
                ariaLabel="Show sidebar"
                id={focusableUIElements.showSidebar}
                key="menu"
                onClick={() => showSidebar()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    showSidebar(animateLandmark);
                  }
                }}
              >
                <MenuIcon />
              </Button>
              <Separator />
            </>
          )
        }
      </Consumer>
    );
  },
};
