import React from 'react';

import { Button, Separator } from 'storybook/internal/components';
import type { Addon_BaseType } from 'storybook/internal/types';

import { MenuIcon } from '@storybook/icons';

import { Consumer, types } from 'storybook/manager-api';
import type { Combo } from 'storybook/manager-api';

import { focusableUIElements } from '../../../../manager-api/modules/layout.ts';

const menuMapper = ({ api, state }: Combo) => ({
  navAvailability: api.getNavAvailability(),
  singleStory: state.singleStory,
  showSidebar: async (forceFocus: boolean) => {
    api.toggleNav(true);
    api.focusOnUIElement(focusableUIElements.sidebarRegion, {
      forceFocus,
      poll: true,
    });
  },
});

export const menuTool: Addon_BaseType = {
  title: 'menu',
  id: 'menu',
  type: types.TOOL,
  // @ts-expect-error (non strict)
  match: ({ viewMode }) => ['story', 'docs'].includes(viewMode),
  render: () => {
    return (
      <Consumer filter={menuMapper}>
        {({ navAvailability, showSidebar, singleStory }) =>
          !singleStory &&
          navAvailability === 'hidden' && (
            <>
              <Button
                padding="small"
                variant="ghost"
                ariaLabel="Show sidebar"
                id={focusableUIElements.showSidebar}
                key="menu"
                onClick={() => showSidebar(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    showSidebar(true);
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
