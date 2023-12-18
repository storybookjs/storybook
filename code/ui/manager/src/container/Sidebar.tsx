import React, { useMemo } from 'react';

import type { Combo, StoriesHash } from '@storybook/manager-api';
import { types, Consumer } from '@storybook/manager-api';

import type { SidebarProps as SidebarComponentProps } from '../components/sidebar/Sidebar';
import { Sidebar as SidebarComponent } from '../components/sidebar/Sidebar';
import { useDropdownMenu } from './Menu';

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
      index,
      status,
      indexError,
      previewInitialized,
      refs,
    } = state;

    const menu = useDropdownMenu(
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

    const items = api.getElements(types.experimental_SIDEBAR_BOTTOM);
    const bottom = useMemo(() => Object.values(items), [items]);
    const top = useMemo(() => Object.values(api.getElements(types.experimental_SIDEBAR_TOP)), []);

    return {
      title: name,
      url,
      index,
      indexError,
      status,
      previewInitialized,
      refs,
      storyId,
      refId,
      viewMode,
      menu,
      menuHighlighted: whatsNewNotificationsEnabled && api.isWhatsNewUnread(),
      enableShortcuts,
      bottom,
      extra: top,
    };
  };

  return (
    <Consumer filter={mapper}>
      {(fromState) => {
        return <SidebarComponent {...fromState} onMenuClick={onMenuClick} />;
      }}
    </Consumer>
  );
});

export default Sidebar;
