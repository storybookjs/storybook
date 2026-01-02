import React from 'react';

import type { Combo, StoriesHash } from 'storybook/manager-api';
import { Consumer, experimental_useStatusStore } from 'storybook/manager-api';

import { Sidebar as SidebarComponent } from '../components/sidebar/Sidebar';
import { useMenu } from './Menu';

export type Item = StoriesHash[keyof StoriesHash];

const Sidebar = React.memo(function SidebarContainer() {
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

    const whatsNewNotificationsEnabled =
      state.whatsNewData?.status === 'SUCCESS' && !state.disableWhatsNewNotifications;

    return {
      api,
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
      showToolbar,
      isPanelShown: api.getIsPanelShown(),
      isNavShown: api.getIsNavShown(),
      menuHighlighted: whatsNewNotificationsEnabled && api.isWhatsNewUnread(),
      enableShortcuts,
    };
  };

  return (
    <Consumer filter={mapper}>
      {({ api, showToolbar, isPanelShown, isNavShown, enableShortcuts, ...state }) => {
        const menu = useMenu({ api, showToolbar, isPanelShown, isNavShown, enableShortcuts });
        const allStatuses = experimental_useStatusStore();

        return (
          <SidebarComponent
            {...state}
            menu={menu}
            allStatuses={allStatuses}
            enableShortcuts={enableShortcuts}
          />
        );
      }}
    </Consumer>
  );
});

export default Sidebar;
