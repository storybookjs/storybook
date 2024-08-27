import type { FC, SyntheticEvent } from 'react';
import React, { Fragment } from 'react';

import { IconButton, ScrollArea, TabBar, TabButton } from '@storybook/core/components';
import { Location, Route } from '@storybook/core/router';
import { styled } from '@storybook/core/theming';
import type { Addon_PageType } from '@storybook/core/types';
import { global } from '@storybook/global';
import { CloseIcon } from '@storybook/icons';

import { types, useStorybookApi, useStorybookState } from '@storybook/core/manager-api';

import { matchesKeyCode, matchesModifiers } from '../keybinding';
import { AboutPage } from './AboutPage';
import { ShortcutsPage } from './ShortcutsPage';
import { WhatsNewPage } from './whats_new_page';

const { document } = global;

const Header = styled.div(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  height: 40,
  boxShadow: `${theme.appBorderColor}  0 -1px 0 0 inset`,
  background: theme.barBg,
  paddingRight: 8,
}));

const TabBarButton = React.memo(function TabBarButton({
  changeTab,
  id,
  title,
}: {
  changeTab: (tab: string) => void;
  id: string;
  title: string;
}) {
  return (
    <Location>
      {({ path }) => {
        const active = path.includes(`settings/${id}`);
        return (
          <TabButton
            id={`tabbutton-${id}`}
            className={['tabbutton'].concat(active ? ['tabbutton-active'] : []).join(' ')}
            type="button"
            key="id"
            active={active}
            onClick={() => changeTab(id)}
            role="tab"
          >
            {title}
          </TabButton>
        );
      }}
    </Location>
  );
});

const Content = styled(ScrollArea)(({ theme }) => ({
  background: theme.background.content,
}));

const Pages: FC<{
  onClose: () => void;
  enableShortcuts?: boolean;
  changeTab: (tab: string) => void;
  enableWhatsNew: boolean;
}> = ({ changeTab, onClose, enableShortcuts = true, enableWhatsNew }) => {
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (!enableShortcuts || event.repeat) {
        return;
      }
      if (matchesModifiers(false, event) && matchesKeyCode('Escape', event)) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [enableShortcuts, onClose]);

  return (
    <Fragment>
      <Header className="sb-bar">
        <TabBar role="tablist">
          <TabBarButton id="about" title="About" changeTab={changeTab} />
          {enableWhatsNew && (
            <TabBarButton id="whats-new" title="What's new?" changeTab={changeTab} />
          )}
          <TabBarButton id="shortcuts" title="Keyboard shortcuts" changeTab={changeTab} />
        </TabBar>
        <IconButton
          onClick={(e: SyntheticEvent) => {
            e.preventDefault();
            return onClose();
          }}
          title="Close settings page"
        >
          <CloseIcon />
        </IconButton>
      </Header>
      <Content vertical horizontal={false}>
        <Route path="about">
          <AboutPage key="about" />
        </Route>
        <Route path="whats-new">
          <WhatsNewPage key="whats-new" />
        </Route>
        <Route path="shortcuts">
          <ShortcutsPage key="shortcuts" />
        </Route>
      </Content>
    </Fragment>
  );
};

const SettingsPages: FC = () => {
  const api = useStorybookApi();
  const state = useStorybookState();
  const changeTab = (tab: string) => api.changeSettingsTab(tab);

  return (
    <Pages
      enableWhatsNew={state.whatsNewData?.status === 'SUCCESS'}
      enableShortcuts={state.ui.enableShortcuts}
      changeTab={changeTab}
      onClose={api.closeSettings}
    />
  );
};

export const settingsPageAddon: Addon_PageType = {
  id: 'settings',
  url: '/settings/',
  title: 'Settings',
  type: types.experimental_PAGE,
  render: () => (
    <Route path="/settings/" startsWith>
      <SettingsPages />
    </Route>
  ),
};
