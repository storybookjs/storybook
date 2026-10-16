import type { FC, SyntheticEvent } from 'react';
import React, { memo, useCallback, useMemo } from 'react';

import { PopoverProvider } from 'storybook/internal/components';
import {
  type API_HashEntry,
  type Addon_Collection,
  type Addon_TestProviderType,
  Addon_TypesEnum,
} from 'storybook/internal/types';

import { CopyIcon, EditorIcon, EllipsisIcon } from '@storybook/icons';

import type { API } from 'storybook/manager-api';
import { useStorybookApi } from 'storybook/manager-api';

import type { MenuItem } from '../../container/Menu.tsx';
import { useCopyButton } from '../../../shared/useCopyButton.ts';
import { isStoryRow } from '../../utils/tree.ts';

import { Shortcut } from '../Shortcut.tsx';
import { ContextMenuButton } from './ContextMenuButton.tsx';
import { type SidebarMenuItem, SidebarMenuList } from './Menu.tsx';
import { TypeIconWithSymbol } from './TypeIcon.tsx';

/** How the user opened a context menu. A keyboard open prepends a nav link item and autofocuses it. */
export type ContextMenuTrigger = 'pointer' | 'keyboard';

function getGoToLabel(context: API_HashEntry): string | null {
  if (context.type === 'docs') {
    return 'Go to page';
  }

  if (context.type === 'story') {
    if (context.subtype === 'test') {
      return 'Go to test';
    }
    return 'Go to story';
  }
  return null;
}

export function hasContextMenu(context: API_HashEntry, hasProviderMenuEntries = false): boolean {
  // Never show the ContextMenu in production.
  if (globalThis.CONFIG_TYPE !== 'DEVELOPMENT') {
    return false;
  }

  // The "Story" row of a story with tests stands in for a row that has the menu already.
  if (context.refId || isStoryRow(context)) {
    return false;
  }

  return (
    ('importPath' in context && Boolean(context.importPath)) ||
    context.type === 'story' ||
    context.type === 'docs' ||
    // Test providers contribute entries (e.g. "run tests for this group") to branch rows.
    (hasProviderMenuEntries && (context.type === 'group' || context.type === 'component'))
  );
}

/**
 * Whether a registered test provider contributes menu entries for this one entry. It gates the
 * menu on a group or component row, so that the ⋯ button never opens an empty popover.
 *
 * @param hasTestProviders Whether any test provider addon is registered at all.
 */
export function hasProviderMenuEntriesFor(
  api: API,
  context: API_HashEntry,
  hasTestProviders: boolean
): boolean {
  // Test providers never see a "Story" row: its id names no story they could run.
  if (!hasTestProviders || context.type === 'root' || isStoryRow(context)) {
    return false;
  }
  return (
    generateTestProviderLinks(api.getElements(Addon_TypesEnum.experimental_TEST_PROVIDER), context)
      .length > 0
  );
}

export const ContextMenu: FC<{
  context: API_HashEntry;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSelectStoryId: (id: string) => void;
  api: API;
  openedBy?: ContextMenuTrigger;
  /** Whether a test provider contributes menu entries for this entry. */
  hasProviderMenuEntries?: boolean;
  /** The current shortcuts, read once by the tree. */
  shortcutKeys: ReturnType<API['getShortcutKeys']>;
}> = memo(
  ({
    context,
    isOpen,
    setIsOpen,
    onSelectStoryId,
    api,
    openedBy,
    hasProviderMenuEntries = false,
    shortcutKeys,
  }) => {
    const exportName = context && 'exportName' in context ? (context.exportName ?? '') : '';
    const { children: copyText, buttonProps: copyButtonProps } = useCopyButton<string>({
      children: 'Copy story name',
      content: exportName,
    });

    const topLinks = useMemo<MenuItem[]>(() => {
      const defaultLinks: MenuItem[] = [];

      // Add a navigation link at the top when the menu opens from the keyboard.
      // Keyboard-only users then have a way to open a story that has child tests.
      if (openedBy === 'keyboard') {
        const goToLabel = getGoToLabel(context);
        if (goToLabel) {
          defaultLinks.push({
            id: 'go-to-item',
            title: goToLabel,
            icon: <TypeIconWithSymbol item={context} />,
            onClick: (e: SyntheticEvent) => {
              e.preventDefault();
              onSelectStoryId(context.id);
              setIsOpen(false);
            },
          });
        }
      }

      if (context && 'importPath' in context && context.importPath) {
        defaultLinks.push({
          id: 'open-in-editor',
          title: 'Open in editor',
          icon: <EditorIcon />,
          right: shortcutKeys?.openInEditor ? <Shortcut keys={shortcutKeys.openInEditor} /> : null,
          onClick: (e: SyntheticEvent) => {
            if (context.importPath) {
              e.preventDefault();
              api.openInEditor({ file: context.importPath });
            }
          },
        });
      }

      if (context.type === 'story') {
        defaultLinks.push({
          id: 'copy-story-name',
          title: copyText,
          icon: <CopyIcon />,
          onClick: (e: SyntheticEvent) => {
            e.preventDefault();
            copyButtonProps.onClick(e);
          },
        });
      }

      // Move focus to the first item when opening from the keyboard, so the user can operate the
      // menu without a Tab press. A pointer open keeps focus on the dialog container, because a
      // focused item makes screen readers announce it twice. React honors autoFocus on the
      // buttons these links render as.
      if (openedBy === 'keyboard' && defaultLinks[0]) {
        defaultLinks[0].autoFocus = true;
      }

      return defaultLinks;
    }, [
      api,
      onSelectStoryId,
      context,
      copyText,
      copyButtonProps,
      openedBy,
      setIsOpen,
      shortcutKeys,
    ]);

    const handleOpen = useCallback(
      (event: SyntheticEvent) => {
        event.stopPropagation();
        setIsOpen(true);
      },
      [setIsOpen]
    );

    // Never show the ContextMenu in production.
    if (globalThis.CONFIG_TYPE !== 'DEVELOPMENT') {
      return null;
    }

    const shouldRender = !context.refId && (topLinks.length > 0 || hasProviderMenuEntries);
    if (!shouldRender) {
      return null;
    }

    return (
      <PopoverProvider
        ariaLabel="Context menu"
        placement="bottom-end"
        defaultVisible={false}
        visible={isOpen}
        onVisibleChange={setIsOpen}
        popover={({ onHide }) => (
          <ContextMenuContent context={context} links={topLinks} onHide={onHide} />
        )}
        hasChrome={true}
        padding={0}
      >
        <ContextMenuButton
          data-displayed={isOpen ? 'on' : 'off'}
          data-testid="context-menu"
          ariaLabel="Open context menu"
          type="button"
          onClick={handleOpen}
          shortcut={shortcutKeys?.contextMenu}
          tooltipPlacement="bottom-end"
          disableAllTooltips={isOpen}
        >
          <EllipsisIcon />
        </ContextMenuButton>
      </PopoverProvider>
    );
  }
);
ContextMenu.displayName = 'ContextMenu';

/**
 * The body of the sidebar context menu. It reads the registered test providers on every render, so
 * the provider links stay current, and it renders them below the given links.
 */
const ContextMenuContent: FC<{
  context: API_HashEntry;
  links: SidebarMenuItem[];
  onHide: () => void;
}> = ({ context, links, onHide }) => {
  const registeredTestProviders = useStorybookApi().getElements(
    Addon_TypesEnum.experimental_TEST_PROVIDER
  );
  const providerLinks = generateTestProviderLinks(registeredTestProviders, context);

  return <SidebarMenuList menu={[links, providerLinks]} onHide={onHide} />;
};

type ExcludesNull = <T>(x: T | null) => x is T;
export function generateTestProviderLinks(
  registeredTestProviders: Addon_Collection<Addon_TestProviderType>,
  context: API_HashEntry
): SidebarMenuItem[] {
  return Object.entries(registeredTestProviders)
    .map(([testProviderId, state]) => {
      if (!state) {
        return null;
      }
      const content = state.sidebarContextMenu?.({ context });

      if (!content) {
        return null;
      }

      return {
        id: testProviderId,
        content,
      };
    })
    .filter(Boolean as unknown as ExcludesNull);
}
