import type { FC } from 'react';
import React, { useCallback, useMemo } from 'react';

import { Badge } from 'storybook/internal/components';
import { STORIES_COLLAPSE_ALL } from 'storybook/internal/core-events';

import { CheckIcon, CommandIcon, InfoIcon, ShareAltIcon, WandIcon } from '@storybook/icons';

import type { API, State } from 'storybook/manager-api';
import { shortcutToHumanString } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import type { Link } from '../../components/components/tooltip/TooltipLinkList';

const focusableUIElements = {
  storySearchField: 'storybook-explorer-searchfield',
  storyListMenu: 'storybook-explorer-menu',
  storyPanelRoot: 'storybook-panel-root',
};

const Key = styled.span(({ theme }) => ({
  display: 'inline-block',
  height: 16,
  lineHeight: '16px',
  textAlign: 'center',
  fontSize: '11px',
  background: theme.base === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
  color: theme.base === 'light' ? theme.color.dark : theme.textMutedColor,
  borderRadius: 2,
  userSelect: 'none',
  pointerEvents: 'none',
  padding: '0 6px',
}));

const KeyChild = styled.code({
  padding: 0,
  verticalAlign: 'middle',
  '& + &': {
    marginLeft: 6,
  },
});

export const Shortcut: FC<{ keys: string[] }> = ({ keys }) => (
  <Key>
    {keys.map((key) => (
      <KeyChild key={key}>{shortcutToHumanString([key])}</KeyChild>
    ))}
  </Key>
);

export const useMenu = (
  state: State,
  api: API,
  showToolbar: boolean,
  isFullscreen: boolean,
  isPanelShown: boolean,
  isNavShown: boolean,
  enableShortcuts: boolean
): Link[][] => {
  const shortcutKeys = api.getShortcutKeys();

  const about = useMemo(
    () => ({
      id: 'about',
      title: 'About your Storybook',
      onClick: () => api.changeSettingsTab('about'),
      icon: <InfoIcon />,
    }),
    [api]
  );

  const documentation = useMemo(() => {
    const docsUrl = api.getDocsUrl({ versioned: true, renderer: true });

    return {
      id: 'documentation',
      title: 'Documentation',
      href: docsUrl,
      icon: <ShareAltIcon />,
    };
  }, [api]);

  const whatsNewNotificationsEnabled =
    state.whatsNewData?.status === 'SUCCESS' && !state.disableWhatsNewNotifications;
  const isWhatsNewUnread = api.isWhatsNewUnread();

  const whatsNew = useMemo(
    () => ({
      id: 'whats-new',
      title: "What's new?",
      onClick: () => api.changeSettingsTab('whats-new'),
      right: whatsNewNotificationsEnabled && isWhatsNewUnread && (
        <Badge status="positive">Check it out</Badge>
      ),
      icon: <WandIcon />,
    }),
    [api, whatsNewNotificationsEnabled, isWhatsNewUnread]
  );

  const shortcuts = useMemo(
    () => ({
      id: 'shortcuts',
      title: 'Keyboard shortcuts',
      onClick: () => api.changeSettingsTab('shortcuts'),
      right: enableShortcuts ? <Shortcut keys={shortcutKeys.shortcutsPage} /> : null,
      icon: <CommandIcon />,
    }),
    [api, enableShortcuts, shortcutKeys.shortcutsPage]
  );

  const sidebarToggle = useMemo(
    () => ({
      id: 'S',
      title: 'Show sidebar',
      onClick: () => api.toggleNav(),
      active: isNavShown,
      right: enableShortcuts ? <Shortcut keys={shortcutKeys.toggleNav} /> : null,
      icon: isNavShown ? <CheckIcon /> : null,
    }),
    [api, enableShortcuts, shortcutKeys, isNavShown]
  );

  const toolbarToogle = useMemo(
    () => ({
      id: 'T',
      title: 'Show toolbar',
      onClick: () => api.toggleToolbar(),
      active: showToolbar,
      right: enableShortcuts ? <Shortcut keys={shortcutKeys.toolbar} /> : null,
      icon: showToolbar ? <CheckIcon /> : null,
    }),
    [api, enableShortcuts, shortcutKeys, showToolbar]
  );

  const addonsToggle = useMemo(
    () => ({
      id: 'A',
      title: 'Show addons panel',
      onClick: () => api.togglePanel(),
      active: isPanelShown,
      right: enableShortcuts ? <Shortcut keys={shortcutKeys.togglePanel} /> : null,
      icon: isPanelShown ? <CheckIcon /> : null,
    }),
    [api, enableShortcuts, shortcutKeys, isPanelShown]
  );

  const addonsOrientationToggle = useMemo(
    () => ({
      id: 'D',
      title: 'Change addons orientation',
      onClick: () => api.togglePanelPosition(),
      right: enableShortcuts ? <Shortcut keys={shortcutKeys.panelPosition} /> : null,
    }),
    [api, enableShortcuts, shortcutKeys]
  );

  const fullscreenToggle = useMemo(
    () => ({
      id: 'F',
      title: 'Go full screen',
      onClick: () => api.toggleFullscreen(),
      active: isFullscreen,
      right: enableShortcuts ? <Shortcut keys={shortcutKeys.fullScreen} /> : null,
      icon: isFullscreen ? <CheckIcon /> : null,
    }),
    [api, enableShortcuts, shortcutKeys, isFullscreen]
  );

  const searchToggle = useMemo(
    () => ({
      id: '/',
      title: 'Search',
      onClick: () => api.focusOnUIElement(focusableUIElements.storySearchField),
      right: enableShortcuts ? <Shortcut keys={shortcutKeys.search} /> : null,
    }),
    [api, enableShortcuts, shortcutKeys]
  );

  const up = useMemo(
    () => ({
      id: 'up',
      title: 'Previous component',
      onClick: () => api.jumpToComponent(-1),
      right: enableShortcuts ? <Shortcut keys={shortcutKeys.prevComponent} /> : null,
    }),
    [api, enableShortcuts, shortcutKeys]
  );

  const down = useMemo(
    () => ({
      id: 'down',
      title: 'Next component',
      onClick: () => api.jumpToComponent(1),
      right: enableShortcuts ? <Shortcut keys={shortcutKeys.nextComponent} /> : null,
    }),
    [api, enableShortcuts, shortcutKeys]
  );

  const prev = useMemo(
    () => ({
      id: 'prev',
      title: 'Previous story',
      onClick: () => api.jumpToStory(-1),
      right: enableShortcuts ? <Shortcut keys={shortcutKeys.prevStory} /> : null,
    }),
    [api, enableShortcuts, shortcutKeys]
  );

  const next = useMemo(
    () => ({
      id: 'next',
      title: 'Next story',
      onClick: () => api.jumpToStory(1),
      right: enableShortcuts ? <Shortcut keys={shortcutKeys.nextStory} /> : null,
    }),
    [api, enableShortcuts, shortcutKeys]
  );

  const collapse = useMemo(
    () => ({
      id: 'collapse',
      title: 'Collapse all',
      onClick: () => api.emit(STORIES_COLLAPSE_ALL),
      right: enableShortcuts ? <Shortcut keys={shortcutKeys.collapseAll} /> : null,
    }),
    [api, enableShortcuts, shortcutKeys]
  );

  const getAddonsShortcuts = useCallback(() => {
    const addonsShortcuts = api.getAddonsShortcuts();
    const keys = shortcutKeys as any;
    return Object.entries(addonsShortcuts)
      .filter(([_, { showInMenu }]) => showInMenu)
      .map(([actionName, { label, action }]) => ({
        id: actionName,
        title: label,
        onClick: () => action(),
        right: enableShortcuts ? <Shortcut keys={keys[actionName]} /> : null,
      }));
  }, [api, enableShortcuts, shortcutKeys]);

  return useMemo(
    () =>
      [
        [
          about,
          ...(state.whatsNewData?.status === 'SUCCESS' ? [whatsNew] : []),
          documentation,
          ...(enableShortcuts ? [shortcuts] : []),
        ],
        [
          sidebarToggle,
          toolbarToogle,
          addonsToggle,
          addonsOrientationToggle,
          fullscreenToggle,
          searchToggle,
          up,
          down,
          prev,
          next,
          collapse,
        ],
        getAddonsShortcuts(),
      ] satisfies Link[][],
    [
      about,
      state,
      whatsNew,
      documentation,
      shortcuts,
      sidebarToggle,
      toolbarToogle,
      addonsToggle,
      addonsOrientationToggle,
      fullscreenToggle,
      searchToggle,
      up,
      down,
      prev,
      next,
      collapse,
      getAddonsShortcuts,
      enableShortcuts,
    ]
  );
};
