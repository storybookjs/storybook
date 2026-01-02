import type { FC, ReactNode, SyntheticEvent } from 'react';
import React, { useMemo } from 'react';

import { Button, ScrollArea, TabsView } from 'storybook/internal/components';
import { Location, Route } from 'storybook/internal/router';
import type { Addon_PageType } from 'storybook/internal/types';

import { global } from '@storybook/global';
import { CloseIcon } from '@storybook/icons';

import { types, useStorybookApi, useStorybookState } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import { matchesKeyCode, matchesModifiers } from '../keybinding';
import { A11yStatementPage } from './A11yStatementPage';
import { AboutPage } from './AboutPage';
import { GuidePage } from './GuidePage';
import { ShortcutsPage } from './ShortcutsPage';
import { WhatsNewPage } from './whats_new_page';

const { document } = global;

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

  const tabs = useMemo(() => {
    const tabsToInclude = [
      {
        id: 'about',
        title: 'About',
        children: (
          <RouteWrapper path="about">
            <AboutPage key="about" />
          </RouteWrapper>
        ),
      },
    ];

    if (global.CONFIG_TYPE === 'DEVELOPMENT') {
      tabsToInclude.push({
        id: 'guide',
        title: 'Guide',
        children: (
          <RouteWrapper path="guide">
            <GuidePage key="guide" />
          </RouteWrapper>
        ),
      });
    }

    tabsToInclude.push({
      id: 'shortcuts',
      title: 'Keyboard shortcuts',
      children: (
        <RouteWrapper path="shortcuts">
          <ShortcutsPage key="shortcuts" />
        </RouteWrapper>
      ),
    });

    tabsToInclude.push({
      id: 'accessibility-statement',
      title: 'Accessibility statement',
      children: (
        <RouteWrapper path="accessibility-statement">
          <A11yStatementPage key="a11y" />
        </RouteWrapper>
      ),
    });

    if (enableWhatsNew) {
      tabsToInclude.push({
        id: 'whats-new',
        title: "What's new?",
        children: (
          <RouteWrapper path="whats-new">
            <WhatsNewPage key="whats-new" />
          </RouteWrapper>
        ),
      });
    }

    return tabsToInclude;
  }, [enableWhatsNew]);

  return (
    <Location>
      {({ path }) => {
        const selected = tabs.find((tab) => path.includes(`settings/${tab.id}`))?.id;
        return (
          <TabsView
            tabs={tabs}
            tools={
              <Button
                padding="small"
                variant="ghost"
                onClick={(e: SyntheticEvent) => {
                  e.preventDefault();
                  return onClose();
                }}
                ariaLabel="Close settings page"
              >
                <CloseIcon />
              </Button>
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
