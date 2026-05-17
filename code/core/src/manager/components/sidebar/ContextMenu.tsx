import type { ComponentProps, FC, SyntheticEvent } from 'react';
import React, { useContext, useMemo, useState } from 'react';

import { PopoverProvider, TooltipLinkList } from 'storybook/internal/components';
import {
  type API_HashEntry,
  type Addon_Collection,
  type Addon_TestProviderType,
  Addon_TypesEnum,
  type StatusValue,
} from 'storybook/internal/types';

import { CopyIcon, EditorIcon, EllipsisIcon } from '@storybook/icons';

import type { API } from 'storybook/manager-api';
import { useTheme } from 'storybook/theming';
import { internal_fullStatusStore, useStorybookApi } from 'storybook/manager-api';

import { useCopyButton } from '../../../shared/useCopyButton.ts';
import type { Link } from '../../../components/components/tooltip/TooltipLinkList.tsx';

import { Shortcut } from '../Shortcut.tsx';
import { ContextMenuButton } from './ContextMenuButton.tsx';
import { StatusContext } from './StatusContext.tsx';
import { TypeIconWithSymbol } from './TypeIcon.tsx';
import { getStatus } from '../../utils/status.tsx';

// FIXME/TODO: we must find how to get PopoverProvider to autofocus the first menu item on menu open.

// FIXME/TODO: onMouseEnter is actually a data preloading mechanism for test providers to render custom React nodes.
// It helps with perceived performance as it avoids showing loaders for a short span. Find a way to reinstate this.
// AND: rename it to a more meaningful name.

// FIXME/TODO: move all the status link stuff in here.
// FIXME/TODO: Esc does not close the menu!
// FIXME/TODO: find out why test entries show up as stories in the tree
// FIXME/TODO: pressing ArrowRight in tree breaks kb nav
// FIXME/TODO: check with MA how we wanna present stories with test children.

const empty = {
  onMouseEnter: () => {},
  node: null,
};

const StatusLabelsInContextMenu: Record<StatusValue, string> = {
  'status-value:success': 'Passing',
  'status-value:error': 'Has errors',
  'status-value:warning': 'Has warnings',
  'status-value:pending': 'Status pending',
  'status-value:unknown': 'Status unknown',
  'status-value:new': 'New',
  'status-value:modified': 'Modified',
  'status-value:affected': 'Related', // TODO/FIXME: talk to MA about using better copy here.
};

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

export const useContextMenu = (
  context: API_HashEntry,
  isOpen: boolean,
  setIsOpen: (open: boolean) => void,
  onSelectStoryId: (id: string) => void,
  api: API,
  entryMethod?: ContextMenuEntryMethod,
) => {
  const [hoverCount, setHoverCount] = useState(0);
  const { allStatuses } = useContext(StatusContext);

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

  // FIXME/TODO: remove if possible.
  const handlers = useMemo(() => {
    return {
      onMouseEnter: () => {
        setHoverCount((c) => c + 1);
      },
      onOpen: (event: SyntheticEvent) => {
        event.stopPropagation();
        setIsOpen(true);
      },
      // FIXME/TODO: not called in practice
      onClose: () => {
        setIsOpen(false);
      },
    };
  }, [setIsOpen]);

  /**
   * Calculate the providerLinks whenever the user mouses over the container. We use an incrementor,
   * instead of a simple boolean to ensure that the links are recalculated
   */
  const providerLinks = useMemo(() => {
    const registeredTestProviders = api.getElements(Addon_TypesEnum.experimental_TEST_PROVIDER);

    if (hoverCount) {
      return generateTestProviderLinks(registeredTestProviders, context);
    }
    return [];
  }, [api, context, hoverCount]);

  const theme = useTheme();

  // Compute status items to go in the ContextMenu.
  const statusLinks = useMemo<Link[]>(() => {
    if (context.type !== 'story' && context.type !== 'docs') {
      return [];
    }

    return Object.entries(allStatuses?.[context.id] || {})
      .filter(([, status]) => status.sidebarContextMenu !== false)
      .map(([typeId, status]) => ({
        id: typeId,
        title: status.title,
        description: status.description,
        'aria-label': `${status.title}: ${StatusLabelsInContextMenu[status.value]}.`,
        icon: getStatus(theme, status.value).icon,
        onClick: () => {
          onSelectStoryId(context.id);
          // FIXME/TODO: use another import type as this is deprecated.
          internal_fullStatusStore.selectStatuses([status]);
        },
      }));
  }, [context.id, context.type, onSelectStoryId, allStatuses, theme]);


  const xx = allStatuses?.[context.id]?.["storybook/change-detection"]?.sidebarContextMenu
  const yy = allStatuses?.[context.id]?.["storybook/test"]?.sidebarContextMenu
  if (xx || yy){  console.log('ContextMenu statusLinks', statusLinks, allStatuses?.[context.id]);} 

  const shouldRender =
    !context.refId && (providerLinks.length > 0 || topLinks.length > 0 || statusLinks.length > 0);

  return useMemo(() => {
    // Never show the SidebarContextMenu in production
    if (globalThis.CONFIG_TYPE !== 'DEVELOPMENT') {
      return empty;
    }

    const button = (
      <ContextMenuButton
        tabIndex={-1}
        data-displayed={isOpen ? 'on' : 'off'}
        data-testid="context-menu"
        ariaLabel="Open context menu"
        type="button"
        onClick={handlers.onOpen}
      >
        <EllipsisIcon />
      </ContextMenuButton>
    );

    return {
      onMouseEnter: handlers.onMouseEnter,
      node: shouldRender ? (
        <PopoverProvider
          ariaLabel="Context menu"
          placement="bottom-end"
          defaultVisible={false}
          visible={isOpen}
          onVisibleChange={setIsOpen}
          popover={<LiveContextMenu context={context} links={[...topLinks, ...statusLinks]} />}
          hasChrome={true}
          padding={0}
        >
          {button}
        </PopoverProvider>
      ) : null,
    };
  }, [
    context,
    handlers,
    isOpen,
    setIsOpen,
    shouldRender,
    statusLinks,
    topLinks,
  ]);
};

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
