import type { ComponentProps, FC, SyntheticEvent } from 'react';
import React, { memo, useCallback, useMemo } from 'react';

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

import { useCopyButton } from '../../../shared/useCopyButton.ts';
import type { Link } from '../../../components/components/tooltip/TooltipLinkList.tsx';

import { Shortcut } from '../Shortcut.tsx';
import { ContextMenuButton } from './ContextMenuButton.tsx';
import { TypeIconWithSymbol } from './TypeIcon.tsx';

export type ContextMenuEntryMethod = 'pointer' | 'keyboard';

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

export function hasContextMenu(context: API_HashEntry): boolean {
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
    context.type === 'docs'
  );
}

export const ContextMenu: FC<{
  context: API_HashEntry;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSelectStoryId: (id: string) => void;
  api: API;
  entryMethod?: ContextMenuEntryMethod;
}> = memo(({ context, isOpen, setIsOpen, onSelectStoryId, api, entryMethod }) => {
  const exportName = context && 'exportName' in context ? (context.exportName ?? '') : '';
  const { children: copyText, buttonProps: copyButtonProps } = useCopyButton<string>({
    children: 'Copy story name',
    content: exportName,
  });

  const topLinks = useMemo<Link[]>(() => {
    const defaultLinks: Link[] = [];

    const shortcutKeys = api.getShortcutKeys();

    // When opened via keyboard shortcut, put a navigation link at the top, so users with
    // motor disability have a way to navigate to stories with child tests.
    if (entryMethod === 'keyboard') {
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
        right: shortcutKeys ? <Shortcut keys={shortcutKeys.openInEditor} /> : null,
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
        // FIXME/TODO: bring this back once we want to add shortcuts for this
        // right:
        //   enableShortcuts && shortcutKeys.copyStoryName ? (
        //     <Shortcut keys={shortcutKeys.copyStoryName} />
        //   ) : null,
        onClick: (e: SyntheticEvent) => {
          e.preventDefault();
          copyButtonProps.onClick(e);
        },
      });
    }

    return defaultLinks;
  }, [api, onSelectStoryId, context, copyText, copyButtonProps, entryMethod, setIsOpen]);

  const handleOpen = useCallback(
    (event: SyntheticEvent) => {
      event.stopPropagation();
      setIsOpen(true);
    },
    [setIsOpen]
  );

  // Never show the ContextMenu in production
  if (globalThis.CONFIG_TYPE !== 'DEVELOPMENT') {
    return null;
  }

  const shouldRender = !context.refId && topLinks.length > 0;
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
      popover={<LiveContextMenu context={context} links={topLinks} />}
      hasChrome={true}
      padding={0}
    >
      <ContextMenuButton
        data-displayed={isOpen ? 'on' : 'off'}
        data-testid="context-menu"
        ariaLabel="Open context menu"
        type="button"
        onClick={handleOpen}
        shortcut={api.getShortcutKeys().contextMenu}
        tooltipPlacement="bottom-end"
      >
        <EllipsisIcon />
      </ContextMenuButton>
    </PopoverProvider>
  );
});
ContextMenu.displayName = 'ContextMenu';

/**
 * This component re-subscribes to storybook's core state, hence the Live prefix. It is used to
 * render the context menu for the sidebar. it self is a tooltip link list that renders the links
 * provided to it. In addition to the links, it also renders the test providers.
 */
const LiveContextMenu: FC<{ context: API_HashEntry } & ComponentProps<typeof TooltipLinkList>> = ({
  context,
  links,
  ...rest
}) => {
  const registeredTestProviders = useStorybookApi().getElements(
    Addon_TypesEnum.experimental_TEST_PROVIDER
  );
  const providerLinks: Link[] = generateTestProviderLinks(registeredTestProviders, context);

  /**
   * The context menu can take a list of lists of links, so that the links are grouped and separated
   * by a line separator, so we need to make sure that links are contained within arrays (but not
   * more than one level deep)
   */
  const groups: Link[][] =
    Array.isArray(links[0]) || links.length === 0 ? (links as Link[][]) : [links as Link[]];

  const all = groups.concat([providerLinks]);

  return <TooltipLinkList {...rest} links={all} />;
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
