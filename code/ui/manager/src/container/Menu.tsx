import type { FC } from 'react';
import React, { useCallback, useMemo } from 'react';

import { Badge } from '@storybook/components';
import type { API, State } from '@storybook/manager-api';
import { shortcutToHumanString } from '@storybook/manager-api';
import { styled, useTheme } from '@storybook/theming';
import type { DropdownMenuItemProps } from '@storybook/components';
import { STORIES_COLLAPSE_ALL } from '@storybook/core-events';
import { CheckIcon } from '@storybook/icons';

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

const KeyChild = styled.code(
  ({ theme }) => `
  padding: 0;
  vertical-align: middle;

  & + & {
    margin-left: 6px;
  }
`
);

export const Shortcut: FC<{ keys: string[] }> = ({ keys }) => (
  <>
    <Key>
      {keys.map((key, index) => (
        <KeyChild key={key}>{shortcutToHumanString([key])}</KeyChild>
      ))}
    </Key>
  </>
);

/**
 * @deprecated Use useDropdownMenu instead
 */
export const useMenu = (
  state: State,
  api: API,
  showToolbar: boolean,
  isFullscreen: boolean,
  isPanelShown: boolean,
  isNavShown: boolean,
  enableShortcuts: boolean
) => {
  const theme = useTheme();
  const shortcutKeys = api.getShortcutKeys();

  const about = useMemo(
    () => ({
      id: 'about',
      title: 'About your Storybook',
      onClick: () => api.navigateToSettingsPage('/settings/about'),
    }),
    [api]
  );

  const whatsNewNotificationsEnabled =
    state.whatsNewData?.status === 'SUCCESS' && !state.disableWhatsNewNotifications;
  const isWhatsNewUnread = api.isWhatsNewUnread();
  const whatsNew = useMemo(
    () => ({
      id: 'whats-new',
      title: "What's new?",
      onClick: () => api.navigateToSettingsPage('/settings/whats-new'),
      right: whatsNewNotificationsEnabled && isWhatsNewUnread && (
        <Badge status="positive">Check it out</Badge>
      ),
    }),
    [api, whatsNewNotificationsEnabled, isWhatsNewUnread]
  );

  const shortcuts = useMemo(
    () => ({
      id: 'shortcuts',
      title: 'Keyboard shortcuts',
      onClick: () => api.navigateToSettingsPage('/settings/shortcuts'),
      right: enableShortcuts ? <Shortcut keys={shortcutKeys.shortcutsPage} /> : null,
      style: {
        borderBottom: `4px solid ${theme.appBorderColor}`,
      },
    }),
    [api, enableShortcuts, shortcutKeys.shortcutsPage, theme.appBorderColor]
  );

  const sidebarToggle = useMemo(
    () => ({
      id: 'S',
      title: 'Show sidebar',
      onClick: () => api.toggleNav(),
      active: isNavShown,
      right: enableShortcuts ? <Shortcut keys={shortcutKeys.toggleNav} /> : null,
      left: isNavShown ? <CheckIcon /> : null,
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
      left: showToolbar ? <CheckIcon /> : null,
    }),
    [api, enableShortcuts, shortcutKeys, showToolbar]
  );

  const addonsToggle = useMemo(
    () => ({
      id: 'A',
      title: 'Show addons',
      onClick: () => api.togglePanel(),
      active: isPanelShown,
      right: enableShortcuts ? <Shortcut keys={shortcutKeys.togglePanel} /> : null,
      left: isPanelShown ? <CheckIcon /> : null,
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
      left: isFullscreen ? <CheckIcon /> : null,
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
      onClick: () => api.collapseAll(),
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
    () => [
      about,
      ...(state.whatsNewData?.status === 'SUCCESS' ? [whatsNew] : []),
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
      ...getAddonsShortcuts(),
    ],
    [
      about,
      state,
      whatsNew,
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
    ]
  );
};

function parseKeyShortcuts(keyboardShortcut: string[]): DropdownMenuItemProps['keyboardShortcut'] {
  return {
    label: keyboardShortcut.map((key) => shortcutToHumanString([key])).join(' '),
    ariaKeyshortcuts: keyboardShortcut.join('+'),
  };
}

export const useDropdownMenu = (
  state: State,
  api: API,
  showToolbar: boolean,
  isFullscreen: boolean,
  isPanelShown: boolean,
  isNavShown: boolean,
  enableShortcuts: boolean
) => {
  const shortcutKeys = api.getShortcutKeys();

  const about: DropdownMenuItemProps = useMemo(
    () => ({
      id: 'about',
      label: 'About your Storybook',
      onClick: () => api.changeSettingsTab('/settings/about'),
      startInlineIndent: true,
    }),
    [api]
  );

  const whatsNewNotificationsEnabled =
    state.whatsNewData?.status === 'SUCCESS' && !state.disableWhatsNewNotifications;

  const isWhatsNewUnread = api.isWhatsNewUnread();

  const whatsNew: DropdownMenuItemProps = useMemo(
    () => ({
      id: 'whats-new',
      label: "What's new?",
      onClick: () => api.changeSettingsTab('/settings/whats-new'),
      badgeLabel: whatsNewNotificationsEnabled && isWhatsNewUnread ? 'Check it out' : undefined,
      startInlineIndent: true,
    }),
    [api, whatsNewNotificationsEnabled, isWhatsNewUnread]
  );

  const shortcuts: DropdownMenuItemProps = useMemo(
    () => ({
      id: 'shortcuts',
      label: 'Keyboard shortcuts',
      onClick: () => api.changeSettingsTab('/settings/shortcuts'),
      keyboardShortcut: enableShortcuts ? parseKeyShortcuts(shortcutKeys.shortcutsPage) : undefined,
      withBottomSeparator: true,
    }),
    [api, enableShortcuts, shortcutKeys.shortcutsPage]
  );

  const sidebarToggle: DropdownMenuItemProps = useMemo(
    () => ({
      id: 'S',
      label: 'Show sidebar',
      onClick: () => api.toggleNav(),
      active: isNavShown,
      keyboardShortcut: enableShortcuts ? parseKeyShortcuts(shortcutKeys.toggleNav) : undefined,
      icon: isNavShown ? 'check' : undefined,
    }),
    [api, enableShortcuts, shortcutKeys, isNavShown]
  );

  const toolbarToogle: DropdownMenuItemProps = useMemo(
    () => ({
      id: 'T',
      label: 'Show toolbar',
      onClick: () => api.toggleToolbar(),
      active: showToolbar,
      keyboardShortcut: enableShortcuts ? parseKeyShortcuts(shortcutKeys.toolbar) : undefined,
      icon: showToolbar ? 'check' : undefined,
    }),
    [api, enableShortcuts, shortcutKeys, showToolbar]
  );

  const addonsToggle: DropdownMenuItemProps = useMemo(
    () => ({
      id: 'A',
      label: 'Show addons',
      onClick: () => api.togglePanel(),
      active: isPanelShown,
      keyboardShortcut: enableShortcuts ? parseKeyShortcuts(shortcutKeys.togglePanel) : undefined,
      icon: isPanelShown ? 'check' : undefined,
    }),
    [api, enableShortcuts, shortcutKeys, isPanelShown]
  );

  const addonsOrientationToggle: DropdownMenuItemProps = useMemo(
    () => ({
      id: 'D',
      label: 'Change addons orientation',
      onClick: () => api.togglePanelPosition(),
      keyboardShortcut: enableShortcuts ? parseKeyShortcuts(shortcutKeys.panelPosition) : undefined,
    }),
    [api, enableShortcuts, shortcutKeys]
  );

  const fullscreenToggle: DropdownMenuItemProps = useMemo(
    () => ({
      id: 'F',
      label: 'Go full screen',
      onClick: () => api.toggleFullscreen(),
      active: isFullscreen,
      keyboardShortcut: enableShortcuts ? parseKeyShortcuts(shortcutKeys.fullScreen) : undefined,
      icon: isFullscreen ? 'check' : undefined,
    }),
    [api, enableShortcuts, shortcutKeys, isFullscreen]
  );

  const searchToggle: DropdownMenuItemProps = useMemo(
    () => ({
      id: '/',
      label: 'Search',
      onClick: () => {
        api.focusOnUIElement(focusableUIElements.storySearchField);
      },
      keyboardShortcut: enableShortcuts ? parseKeyShortcuts(shortcutKeys.search) : undefined,
    }),
    [api, enableShortcuts, shortcutKeys]
  );

  const up: DropdownMenuItemProps = useMemo(
    () => ({
      id: 'up',
      label: 'Previous component',
      onClick: () => api.jumpToComponent(-1),
      keyboardShortcut: enableShortcuts ? parseKeyShortcuts(shortcutKeys.prevComponent) : undefined,
    }),
    [api, enableShortcuts, shortcutKeys]
  );

  const down: DropdownMenuItemProps = useMemo(
    () => ({
      id: 'down',
      label: 'Next component',
      onClick: () => api.jumpToComponent(1),
      keyboardShortcut: enableShortcuts ? parseKeyShortcuts(shortcutKeys.nextComponent) : undefined,
    }),
    [api, enableShortcuts, shortcutKeys]
  );

  const prev: DropdownMenuItemProps = useMemo(
    () => ({
      id: 'prev',
      label: 'Previous story',
      onClick: () => api.jumpToStory(-1),
      keyboardShortcut: enableShortcuts ? parseKeyShortcuts(shortcutKeys.prevStory) : undefined,
    }),
    [api, enableShortcuts, shortcutKeys]
  );

  const next: DropdownMenuItemProps = useMemo(
    () => ({
      id: 'next',
      label: 'Next story',
      onClick: () => api.jumpToStory(1),
      keyboardShortcut: enableShortcuts ? parseKeyShortcuts(shortcutKeys.nextStory) : undefined,
    }),
    [api, enableShortcuts, shortcutKeys]
  );

  const collapse: DropdownMenuItemProps = useMemo(
    () => ({
      id: 'collapse',
      label: 'Collapse all',
      onClick: () => api.emit(STORIES_COLLAPSE_ALL),
      keyboardShortcut: enableShortcuts ? parseKeyShortcuts(shortcutKeys.collapseAll) : undefined,
    }),
    [api, enableShortcuts, shortcutKeys]
  );

  const getAddonsShortcuts = useCallback(() => {
    const addonsShortcuts = api.getAddonsShortcuts();
    const keys = shortcutKeys;

    const builtAddonsShortcuts: DropdownMenuItemProps[] = Object.entries(addonsShortcuts)
      .filter(([_, { showInMenu }]) => showInMenu)
      .map(([actionName, { label, action }]) => ({
        id: actionName,
        label,
        onClick: () => action(),
        keyboardShortcut: enableShortcuts
          ? parseKeyShortcuts(keys[actionName as keyof typeof keys])
          : undefined,
      }));

    return builtAddonsShortcuts;
  }, [api, enableShortcuts, shortcutKeys]);

  return useMemo(
    () => [
      about,
      ...(state.whatsNewData?.status === 'SUCCESS' ? [whatsNew] : []),
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
      ...getAddonsShortcuts(),
    ],
    [
      about,
      state,
      whatsNew,
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
    ]
  );
};
