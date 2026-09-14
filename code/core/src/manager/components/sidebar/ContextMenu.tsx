import type { ComponentProps, FC, SyntheticEvent } from 'react';
import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { PopoverProvider, TooltipLinkList } from 'storybook/internal/components';
import {
  type API_HashEntry,
  type Addon_Collection,
  type Addon_TestProviderType,
  Addon_TypesEnum,
} from 'storybook/internal/types';

import { CopyIcon, EditorIcon, EllipsisIcon } from '@storybook/icons';

import type { API } from 'storybook/manager-api';
import { useStorybookApi } from 'storybook/manager-api';

import type { Link } from '../../../components/components/tooltip/TooltipLinkList.tsx';
import { useCopyButton } from '../../../shared/useCopyButton.ts';

import { Shortcut } from '../Shortcut.tsx';
import { ContextMenuButton } from './ContextMenuButton.tsx';
import { TypeIconWithSymbol } from './TypeIcon.tsx';

/** How the user opened a context menu. A keyboard open also focuses the first menu item. */
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

  if (context.refId) {
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
  if (!hasTestProviders || context.type === 'root') {
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
}> = memo(
  ({
    context,
    isOpen,
    setIsOpen,
    onSelectStoryId,
    api,
    openedBy,
    hasProviderMenuEntries = false,
  }) => {
    const exportName = context && 'exportName' in context ? (context.exportName ?? '') : '';
    const { children: copyText, buttonProps: copyButtonProps } = useCopyButton<string>({
      children: 'Copy story name',
      content: exportName,
    });

    const topLinks = useMemo<Link[]>(() => {
      const defaultLinks: Link[] = [];

      const shortcutKeys = api.getShortcutKeys();

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

      return defaultLinks;
    }, [api, onSelectStoryId, context, copyText, copyButtonProps, openedBy, setIsOpen]);

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
        popover={<ContextMenuContent context={context} links={topLinks} openedBy={openedBy} />}
        hasChrome={true}
        padding={0}
      >
        <ContextMenuButton
          data-displayed={isOpen ? 'on' : 'off'}
          data-testid="context-menu"
          ariaLabel="Open context menu"
          type="button"
          onClick={handleOpen}
          shortcut={api.getShortcutKeys()?.contextMenu}
          tooltipPlacement="bottom-end"
        >
          <EllipsisIcon />
        </ContextMenuButton>
      </PopoverProvider>
    );
  }
);
ContextMenu.displayName = 'ContextMenu';

/**
 * The body of the sidebar context menu, rendered as a tooltip link list. It reads the registered
 * test providers on every render, so the provider links stay current, and it renders them below
 * the given links.
 */
const ContextMenuContent: FC<
  {
    context: API_HashEntry;
    openedBy?: ContextMenuTrigger;
  } & ComponentProps<typeof TooltipLinkList>
> = ({ context, links, openedBy, ...rest }) => {
  const registeredTestProviders = useStorybookApi().getElements(
    Addon_TypesEnum.experimental_TEST_PROVIDER
  );
  const providerLinks: Link[] = generateTestProviderLinks(registeredTestProviders, context);

  // Move focus to the first actionable item when the menu opens from the keyboard, so the user
  // can operate the menu without a Tab press. An open from the pointer keeps focus on the popover
  // container, because a focused item there makes screen readers announce the item twice.
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (openedBy !== 'keyboard') {
      return;
    }
    const firstItem = containerRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    );
    firstItem?.focus();
  }, [openedBy]);

  /**
   * The context menu can take a list of lists of links, so that the links are grouped and separated
   * by a line separator, so we need to make sure that links are contained within arrays (but not
   * more than one level deep)
   */
  const groups: Link[][] =
    Array.isArray(links[0]) || links.length === 0 ? (links as Link[][]) : [links as Link[]];

  const all = groups.concat([providerLinks]).filter((group) => group.length > 0);

  // The wrapper scopes the focus query. display: contents keeps the wrapper out of the layout.
  return (
    <div ref={containerRef} style={{ display: 'contents' }}>
      <TooltipLinkList {...rest} links={all} />
    </div>
  );
};

type ExcludesNull = <T>(x: T | null) => x is T;
export function generateTestProviderLinks(
  registeredTestProviders: Addon_Collection<Addon_TestProviderType>,
  context: API_HashEntry
): Link[] {
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
