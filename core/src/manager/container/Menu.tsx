import type { FC } from 'react';
import React, { useCallback, useMemo } from 'react';

import { ActionList, ProgressSpinner } from 'storybook/internal/components';
import { STORIES_COLLAPSE_ALL } from 'storybook/internal/core-events';

import { global } from '@storybook/global';
import {
  CheckIcon,
  CommandIcon,
  DocumentIcon,
  InfoIcon,
  ListUnorderedIcon,
  ShareAltIcon,
} from '@storybook/icons';

import type { API } from 'storybook/manager-api';
import { shortcutToHumanString } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import type { NormalLink } from '../../components/components/tooltip/TooltipLinkList';
import { useChecklist } from '../components/sidebar/useChecklist';

export type MenuItem = NormalLink & {
  closeOnClick?: boolean;
};

const Key = styled.span(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 16,
  fontSize: '11px',
  fontWeight: theme.typography.weight.regular,
  background: theme.base === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
  color: theme.base === 'light' ? theme.color.dark : theme.textMutedColor,
  borderRadius: 2,
  userSelect: 'none',
  pointerEvents: 'none',
  padding: '0 4px',
}));

const KeyChild = styled.code(({ theme }) => ({
  padding: 0,
  fontFamily: theme.typography.fonts.base,
  verticalAlign: 'middle',
  '& + &': {
    marginLeft: 6,
  },
}));

const ProgressCircle = styled(ProgressSpinner)(({ theme }) => ({
  color: theme.color.secondary,
}));

export const Shortcut: FC<{ keys: string[] }> = ({ keys }) => (
  <Key>
    {keys.map((key) => (
      <KeyChild key={key}>{shortcutToHumanString([key])}</KeyChild>
    ))}
  </Key>
);

export const useMenu = ({
  api,
  showToolbar,
  isPanelShown,
  isNavShown,
  enableShortcuts,
}: {
  api: API;
  showToolbar: boolean;
  isPanelShown: boolean;
  isNavShown: boolean;
  enableShortcuts: boolean;
}): MenuItem[][] => {
  const shortcutKeys = api.getShortcutKeys();
  const { progress } = useChecklist();

  const about = useMemo(
    () => ({
      id: 'about',
      title: 'About your Storybook',
      onClick: () => api.changeSettingsTab('about'),
      closeOnClick: true,
      icon: <InfoIcon />,
    }),
    [api]
  );

  const guide = useMemo(
    () => ({
      id: 'guide',
      title: 'Onboarding guide',
      onClick: () => api.changeSettingsTab('guide'),
      closeOnClick: true,
      icon: <ListUnorderedIcon />,
      right: progress < 100 && (
        <ActionList.Button as="div" readOnly padding="none" ariaLabel={`${progress}% completed`}>
          <ProgressCircle percentage={progress} running={false} size={16} width={1.5} />
          {progress}%
        </ActionList.Button>
      ),
    }),
    [api, progress]
  );

  const shortcuts = useMemo(
    () => ({
      id: 'shortcuts',
      title: 'Keyboard shortcuts',
      onClick: () => api.changeSettingsTab('shortcuts'),
      closeOnClick: true,
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
      closeOnClick: true,
      active: isNavShown,
      right: enableShortcuts ? <Shortcut keys={shortcutKeys.toggleNav} /> : null,
      icon: isNavShown ? <CheckIcon /> : <></>,
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
      icon: showToolbar ? <CheckIcon /> : <></>,
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
      icon: isPanelShown ? <CheckIcon /> : <></>,
    }),
    [api, enableShortcuts, shortcutKeys, isPanelShown]
  );

  const up = useMemo(
    () => ({
      id: 'up',
      title: 'Previous component',
      onClick: () => api.jumpToComponent(-1),
      right: enableShortcuts ? <Shortcut keys={shortcutKeys.prevComponent} /> : null,
      icon: <></>,
    }),
    [api, enableShortcuts, shortcutKeys]
  );

  const down = useMemo(
    () => ({
      id: 'down',
      title: 'Next component',
      onClick: () => api.jumpToComponent(1),
      right: enableShortcuts ? <Shortcut keys={shortcutKeys.nextComponent} /> : null,
      icon: <></>,
    }),
    [api, enableShortcuts, shortcutKeys]
  );

  const prev = useMemo(
    () => ({
      id: 'prev',
      title: 'Previous story',
      onClick: () => api.jumpToStory(-1),
      right: enableShortcuts ? <Shortcut keys={shortcutKeys.prevStory} /> : null,
      icon: <></>,
    }),
    [api, enableShortcuts, shortcutKeys]
  );

  const next = useMemo(
    () => ({
      id: 'next',
      title: 'Next story',
      onClick: () => api.jumpToStory(1),
      right: enableShortcuts ? <Shortcut keys={shortcutKeys.nextStory} /> : null,
      icon: <></>,
    }),
    [api, enableShortcuts, shortcutKeys]
  );

  const collapse = useMemo(
    () => ({
      id: 'collapse',
      title: 'Collapse all',
      onClick: () => api.emit(STORIES_COLLAPSE_ALL),
      right: enableShortcuts ? <Shortcut keys={shortcutKeys.collapseAll} /> : null,
      icon: <></>,
    }),
    [api, enableShortcuts, shortcutKeys]
  );

  const documentation = useMemo(() => {
    const docsUrl = api.getDocsUrl({ versioned: true, renderer: true });

    return {
      id: 'documentation',
      title: 'Documentation',
      closeOnClick: true,
      href: docsUrl,
      right: (
        <ActionList.Icon>
          <ShareAltIcon />
        </ActionList.Icon>
      ),
      icon: <DocumentIcon />,
    };
  }, [api]);

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
          ...(global.CONFIG_TYPE === 'DEVELOPMENT' ? [guide] : []),
          ...(enableShortcuts ? [shortcuts] : []),
        ],
        [sidebarToggle, toolbarToogle, addonsToggle, up, down, prev, next, collapse],
        getAddonsShortcuts(),
        [documentation],
      ] satisfies NormalLink[][],
    [
      about,
      guide,
      documentation,
      shortcuts,
      sidebarToggle,
      toolbarToogle,
      addonsToggle,
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
