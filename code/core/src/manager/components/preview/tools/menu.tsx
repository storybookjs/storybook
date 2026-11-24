import React from 'react';

import { Button, Separator } from 'storybook/internal/components';
import type { Addon_BaseType } from 'storybook/internal/types';

import { MenuIcon } from '@storybook/icons';

import { Consumer, types } from 'storybook/manager-api';
import type { API, Combo } from 'storybook/manager-api';

import { focusableUIElements } from '../../../../manager-api/modules/layout.ts';

// Only values, so the consumer re-renders the button when one of them changes and not on
// every store commit.
const menuMapper = ({ api, state }: Combo) => ({
  api,
  navAvailability: api.getNavAvailability(),
  singleStory: state.singleStory,
});

const showSidebar = (api: API, forceFocus: boolean) => {
  api.toggleNav(true);
  api.focusOnUIElement(focusableUIElements.sidebarRegion, {
    forceFocus,
    poll: true,
  });
};

export const menuTool: Addon_BaseType = {
  title: 'menu',
  id: 'menu',
  type: types.TOOL,
  // @ts-expect-error (non strict)
  match: ({ viewMode }) => ['story', 'docs'].includes(viewMode),
  render: () => {
    return (
      <Consumer filter={menuMapper}>
        {({ api, navAvailability, singleStory }) =>
          !singleStory &&
          navAvailability === 'hidden' && (
            <>
              <Button
                padding="small"
                variant="ghost"
                ariaLabel="Show sidebar"
                id={focusableUIElements.showSidebar}
                key="menu"
                onClick={() => showSidebar(api, false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    showSidebar(api, true);
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
