import React from 'react';

import { Button, Separator } from 'storybook/internal/components';
import type { Addon_BaseType } from 'storybook/internal/types';

import { MenuIcon } from '@storybook/icons';

import { Consumer, types } from 'storybook/manager-api';
import type { Combo } from 'storybook/manager-api';

const menuMapper = ({ api, state }: Combo) => ({
  isVisible: api.getIsNavShown(),
  singleStory: state.singleStory,
  viewMode: state.viewMode,
  toggle: () => api.toggleNav(),
});

export const menuTool: Addon_BaseType = {
  title: 'menu',
  id: 'menu',
  type: types.TOOL,
  // @ts-expect-error (non strict)
  match: ({ viewMode }) => ['story', 'docs'].includes(viewMode),
  render: () => (
    <Consumer filter={menuMapper}>
      {({ isVisible, toggle, singleStory, viewMode }) =>
        !singleStory &&
        !isVisible && (
          <>
            <Button
              padding="small"
              variant="ghost"
              ariaLabel="Show sidebar"
              key="menu"
              onClick={toggle}
            >
              <MenuIcon />
            </Button>
            {/* Only show separator in story mode where other tools (like remount) are visible.
                In docs mode, most left-side tools are filtered out, leaving an orphaned separator (fixes #21429) */}
            {viewMode === 'story' && <Separator />}
          </>
        )
      }
    </Consumer>
  ),
};
