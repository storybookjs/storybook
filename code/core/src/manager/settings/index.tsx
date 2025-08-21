import type { FC, ReactNode, SyntheticEvent } from 'react';
import React, { useMemo } from 'react';

import { AriaTabs, IconButton, ScrollArea } from 'storybook/internal/components';
import { Location, Route } from 'storybook/internal/router';
import type { Addon_PageType } from 'storybook/internal/types';

import { global } from '@storybook/global';
import { CloseIcon } from '@storybook/icons';

import { types, useStorybookApi, useStorybookState } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

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

const Content = styled(ScrollArea)(({ theme }) => ({
  background: theme.background.content,
}));

const RouteWrapper: FC<{ children: ReactNode; path: string }> = ({ children, path }) => {
  return (
    <Content vertical horizontal={false}>
      <Route path={path}>{children}</Route>
    </Content>
  );
};

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

  const tabs = useMemo(
    () => [
      {
        id: 'about',
        title: 'About',
        children: (
          <RouteWrapper path="about">
            <AboutPage key="about" />
          </RouteWrapper>
        ),
      },
      {
        id: 'whats-new',
        title: "What's new?",
        children: (
          <RouteWrapper path="whats-new">
            <WhatsNewPage key="whats-new" />
          </RouteWrapper>
        ),
      },
      {
        id: 'shortcuts',
        title: 'Keyboard shortcuts',
        children: (
          <RouteWrapper path="shortcuts">
            <ShortcutsPage key="shortcuts" />
          </RouteWrapper>
        ),
      },
    ],
    []
  );

  return (
    <Location>
      {({ path }) => {
        const selected = tabs.find((tab) => path.includes(`settings/${tab.id}`))?.id;
        return (
          <AriaTabs
            tabs={tabs}
            tools={
              <IconButton
                onClick={(e: SyntheticEvent) => {
                  e.preventDefault();
                  return onClose();
                }}
                title="Close settings page"
              >
                <CloseIcon />
              </IconButton>
            }
            selected={selected}
            onSelectionChange={changeTab}
          />
        );
      }}
    </Location>
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
