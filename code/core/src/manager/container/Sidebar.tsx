import React from 'react';

import type { Combo, StoriesHash } from 'storybook/manager-api';
import { Consumer, experimental_useStatusStore } from 'storybook/manager-api';

import type { SidebarProps as SidebarComponentProps } from '../components/sidebar/Sidebar';
import { Sidebar as SidebarComponent } from '../components/sidebar/Sidebar';
import { useMenu } from './Menu';

export type Item = StoriesHash[keyof StoriesHash];

interface SidebarProps {
  onMenuClick?: SidebarComponentProps['onMenuClick'];
}

const Sidebar = React.memo(function Sideber({ onMenuClick }: SidebarProps) {
  const mapper = ({ state, api }: Combo) => {
    const {
      ui: { name, url, enableShortcuts },
      viewMode,
      storyId,
      refId,
      layout: { showToolbar },
      // FIXME: This is the actual `index.json` index where the `index` below
      // is actually the stories hash. We should fix this up and make it consistent.
      internal_index,
      filteredIndex: index,
      indexError,
      previewInitialized,
      refs,
    } = state;

    const menu = useMenu(
      state,
      api,
      showToolbar,
      api.getIsFullscreen(),
      api.getIsPanelShown(),
      api.getIsNavShown(),
      enableShortcuts
    );

    const whatsNewNotificationsEnabled =
      state.whatsNewData?.status === 'SUCCESS' && !state.disableWhatsNewNotifications;

    return {
      title: name,
      url,
      indexJson: internal_index,
      index,
      indexError,
      previewInitialized,
      refs,
      storyId,
      refId,
      viewMode,
      menu,
      menuHighlighted: whatsNewNotificationsEnabled && api.isWhatsNewUnread(),
      enableShortcuts,
    };
  };

  return (
    <Consumer filter={mapper}>
      {(fromState) => {
        const allStatuses = experimental_useStatusStore();

        return (
          <SidebarComponent {...fromState} allStatuses={allStatuses} onMenuClick={onMenuClick} />
        );
      }}
    </Consumer>
  );
});

export default Sidebar;
